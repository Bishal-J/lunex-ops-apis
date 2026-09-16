import { type Request, type NextFunction, type Response } from "express";
import { RoleType } from "../../generated/prisma/enums.js";
import { AppError } from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";

export const authorize =
  (...allowedRoles: RoleType[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }

    next();
  };

export const protectRoute = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // ---------------------------------------------------------
    // 1. Check Authorization header
    // ---------------------------------------------------------

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(
        new AppError("You are not authenticated. Please log in.", 401),
      );
    }

    // ---------------------------------------------------------
    // 2. Extract token
    // ---------------------------------------------------------

    const token = authHeader.split(" ")[1];

    if (!token) {
      return next(
        new AppError("You are not authenticated. Please log in.", 401),
      );
    }

    // ---------------------------------------------------------
    // 3. Verify JWT
    // ---------------------------------------------------------

    const decoded = verifyToken(token);

    // ---------------------------------------------------------
    // 4. Find user
    // ---------------------------------------------------------

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        username: true,
        email: true,
        photo: true,
        role: true,
        isActive: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return next(
        new AppError("The user belonging to this token no longer exists.", 401),
      );
    }

    if (!user || !user.isActive) {
      return next(new AppError("Your account is no longer active.", 401));
    }

    // ---------------------------------------------------------
    // 5. Check if password was changed after token was issued
    // ---------------------------------------------------------

    if (
      user.passwordChangedAt &&
      user.passwordChangedAt.getTime() / 1000 > decoded.iat
    ) {
      return next(
        new AppError("Password has been changed. Please log in again.", 401),
      );
    }

    // ---------------------------------------------------------
    // 6. Attach user to request
    // ---------------------------------------------------------

    req.user = user;

    // ---------------------------------------------------------
    // 7. Continue
    // ---------------------------------------------------------

    next();
  },
);
