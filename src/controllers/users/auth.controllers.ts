import { CookieOptions, NextFunction, Request, Response } from "express";

import { prisma } from "../../lib/prisma.js";
import catchAsync from "../../utils/catchAsync.js";
import { signToken, verifyToken } from "../../utils/jwt.js";
import { AppError } from "../../utils/appError.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import crypto from "crypto";
import { sendEmail } from "../../utils/email.js";
import { RoleType } from "../../../generated/prisma/enums.js";

interface ResetPasswordParams {
  token: string;
}

interface UpdatePasswordBody {
  passwordCurrent: string;
  password: string;
  passwordConfirm: string;
}

type SafeUser = {
  id: string;
  username: string;
  email: string;
  role: RoleType;
  createdAt: Date;
};

export const getPasswordChangedAt = () => {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
};

export const createSendToken = (
  user: SafeUser,
  statusCode: number,
  res: Response,
): void => {
  const token = signToken(user.id);

  const cookieOptions: CookieOptions = {
    expires: new Date(
      Date.now() + +process.env.COOKIE_EXPIRES_IN! * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user: user,
    },
  });
};

export const signUp = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { username, email, password, passwordConfirm } = req.body;

    // Validation
    if (password !== passwordConfirm) {
      return next(new AppError("Passwords do not match", 400));
    }

    // Hash Password
    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    createSendToken(newUser, 201, res);
  },
);

export const signIn = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError("Please provide email and password", 400);
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        passwordHash: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError("Incorrect email or password", 401);
    }

    const isPasswordCorrect = await comparePassword(
      password,
      user.passwordHash,
    );

    if (!isPasswordCorrect) {
      throw new AppError("Incorrect email or password", 401);
    }

    const { passwordHash: _, ...safeUser } = user;

    createSendToken(safeUser, 200, res);
  },
);

export const forgotPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;

    // 1. Find user
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return next(new AppError("Email address NOT found.", 404));
    }

    // 2. Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // 3. Hash token before storing it in the database
    const hashedResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // 4. Set token expiration
    // Token will expire after 10 minutes
    const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000);

    // 5. Save hashed token and expiration
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordResetToken: hashedResetToken,
        passwordResetExpires: resetTokenExpires,
      },
    });

    // 6. Create reset URL
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // 7. Send reset email
    await sendEmail({
      email: user.email,
      subject: "Your password reset link",
      message: `Click this link to reset your password: ${resetURL}`,
    });

    // 8. Response
    res.status(200).json({
      status: "success",
      message: "Password reset link has been sent to your email.",
    });
  },
);

export const resetPassword = catchAsync(
  async (
    req: Request<ResetPasswordParams>,
    res: Response,
    next: NextFunction,
  ) => {
    // 1. Get the token from the URL
    const { token } = req.params;
    const { password, passwordConfirm } = req.body;

    // 2. Validate passwords
    if (!password || !passwordConfirm) {
      return next(
        new AppError("Password and password confirmation are required.", 400),
      );
    }

    if (password !== passwordConfirm) {
      return next(new AppError("Passwords do not match.", 400));
    }

    // 3. Hash the token from the URL
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // 4. Find user whose reset token matches
    //    and whose token has not expired
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    // 5. Token is invalid or expired
    if (!user) {
      return next(
        new AppError("Password reset token is invalid or has expired.", 400),
      );
    }

    // 6. Hash the new password
    const hashedPassword = await hashPassword(password);

    // 7. Update password and clear reset token
    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: hashedPassword,
        passwordChangedAt: getPasswordChangedAt(),

        // Invalidate the reset token
        passwordResetToken: null,
        passwordResetExpires: null,
      },
      select: {
        id: true,
        photo: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    createSendToken(updatedUser, 200, res);
  },
);

export const updatePassword = catchAsync(
  async (
    req: Request<{}, {}, UpdatePasswordBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const { passwordCurrent, password, passwordConfirm } = req.body;

    // 1. Get authenticated user
    const user = await prisma.user.findUnique({
      where: {
        id: req.user!.id,
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return next(
        new AppError(
          "The user belonging to this account no longer exists.",
          401,
        ),
      );
    }

    // 2. Validate required fields
    if (!passwordCurrent || !password || !passwordConfirm) {
      return next(
        new AppError(
          "Please provide your current password, new password, and password confirmation.",
          400,
        ),
      );
    }

    // 3. Check current password
    const isPasswordCorrect = await comparePassword(
      passwordCurrent,
      user.passwordHash,
    );

    if (!isPasswordCorrect) {
      return next(new AppError("Your current password is incorrect.", 401));
    }

    // 4. Check new password confirmation
    if (password !== passwordConfirm) {
      return next(new AppError("New passwords do not match.", 400));
    }

    // 5. Prevent using the same password
    const isSamePassword = await comparePassword(password, user.passwordHash);

    if (isSamePassword) {
      return next(
        new AppError(
          "Your new password must be different from your current password.",
          400,
        ),
      );
    }

    // 6. Hash new password
    const hashedPassword = await hashPassword(password);

    // 7. Update password
    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: hashedPassword,
        passwordChangedAt: getPasswordChangedAt(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 8. Issue a new JWT
    const token = signToken(updatedUser.id);

    // 9. Send response
    return res.status(200).json({
      status: "success",
      token,
      data: {
        user: updatedUser,
      },
    });
  },
);

export const logout = catchAsync(
  async (_req: Request, res: Response, next: NextFunction) => {
    res.cookie("jwt", "", {
      expires: new Date(0),
      httpOnly: true,
    });

    res.status(200).json({
      status: "success",
      message: "Logged out successfully.",
    });
  },
);
