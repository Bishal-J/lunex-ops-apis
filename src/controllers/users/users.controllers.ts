import type { NextFunction, Request, Response } from "express";

import catchAsync from "../../utils/catchAsync.js";
import { AppError } from "../../utils/appError.js";
import { hashPassword } from "../../utils/password.js";
import { prisma } from "../../lib/prisma.js";

import { RoleType } from "../../generated/prisma/enums.js";

type UserParams = {
  id: string;
};

type CreateUserBody = {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  role?: RoleType;
};

type UpdateUserBody = {
  username?: string;
  email?: string;
  role?: RoleType;
  isActive?: boolean;
  photo?: string | null;
};

/*
 * Fields that are safe to return to the client.
 * Never return passwordHash or password reset fields.
 */
const userSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  photo: true,
  isActive: true,
  role: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
};

/*
 * ─────────────────────────────────────────────
 * USER ACTIONS
 * ─────────────────────────────────────────────
 */

/**
 * Get currently authenticated user's profile
 */
export const getProfile = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user!.id,
      },
      select: userSelect,
    });

    if (!user) {
      return next(
        new AppError(
          "The user belonging to this account no longer exists.",
          404,
        ),
      );
    }

    return res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  },
);

/**
 * Update currently authenticated user's profile
 */
export const updateMe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { username, email, photo } = req.body;

    /*
     * Prevent sensitive fields from being updated
     * through this endpoint.
     */
    if (
      req.body.password ||
      req.body.passwordConfirm ||
      req.body.passwordCurrent ||
      req.body.role ||
      req.body.isActive
    ) {
      return next(
        new AppError("This route is only for updating your profile.", 400),
      );
    }

    const data: {
      username?: string;
      email?: string;
      photo?: string | null;
    } = {};

    if (username !== undefined) {
      if (!username.trim()) {
        return next(new AppError("Username cannot be empty.", 400));
      }

      data.username = username.trim();
    }

    if (email !== undefined) {
      if (!email.trim()) {
        return next(new AppError("Email cannot be empty.", 400));
      }

      data.email = email.trim().toLowerCase();
    }

    if (photo !== undefined) {
      data.photo = photo;
    }

    if (Object.keys(data).length === 0) {
      return next(
        new AppError("Please provide at least one field to update.", 400),
      );
    }

    const user = await prisma.user.update({
      where: {
        id: req.user!.id,
      },
      data,
      select: userSelect,
    });

    return res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  },
);

/**
 * Deactivate currently authenticated user
 */
export const deleteMe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user!.id,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return next(
        new AppError(
          "The user belonging to this account no longer exists.",
          404,
        ),
      );
    }

    if (user.role === RoleType.SUPER_ADMIN) {
      return next(
        new AppError(
          "You cannot deactivate your own account from this endpoint.",
          400,
        ),
      );
    }

    if (!user.isActive) {
      return next(new AppError("Your account is already inactive.", 400));
    }

    await prisma.user.update({
      where: {
        id: req.user!.id,
      },
      data: {
        isActive: false,
      },
    });

    /*
     * Clear authentication cookie.
     */
    res.clearCookie("jwt");

    return res.status(200).json({
      status: "success",
      message: "Your account has been deactivated.",
      data: null,
    });
  },
);

/*
 * ─────────────────────────────────────────────
 * ADMIN USER MANAGEMENT
 * ─────────────────────────────────────────────
 */

/**
 * Get all users
 */
export const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.status(200).json({
    status: "success",
    results: users.length,
    data: {
      users,
    },
  });
});

/**
 * Get a single user
 */
export const getUser = catchAsync(
  async (req: Request<UserParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      select: userSelect,
    });

    if (!user) {
      return next(new AppError("User not found with that ID.", 404));
    }

    return res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  },
);

/**
 * Create a new user
 *
 * This should be protected by authorize()
 * at the route level.
 */
export const createUser = catchAsync(
  async (
    req: Request<{}, {}, CreateUserBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const { username, email, password, passwordConfirm, role } = req.body;

    if (!username || !email || !password || !passwordConfirm) {
      return next(
        new AppError(
          "Username, email, password, and password confirmation are required.",
          400,
        ),
      );
    }

    if (password !== passwordConfirm) {
      return next(new AppError("Passwords do not match.", 400));
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: hashedPassword,
        role: role ?? RoleType.USER,
      },
      select: userSelect,
    });

    return res.status(201).json({
      status: "success",
      data: {
        user,
      },
    });
  },
);

/**
 * Update a user
 *
 * Password changes should go through the
 * authentication/password controller.
 */
export const updateUser = catchAsync(
  async (
    req: Request<UserParams, {}, UpdateUserBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const { id } = req.params;

    const { username, email, role, isActive, photo } = req.body;

    // Prevent password fields from being updated through this endpoint.
    if (
      (req.body as any).password ||
      (req.body as any).passwordConfirm ||
      (req.body as any).passwordCurrent ||
      (req.body as any).passwordHash
    ) {
      return next(
        new AppError(
          "Password updates must be handled through the password endpoint.",
          400,
        ),
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingUser) {
      return next(new AppError("User not found with that ID.", 404));
    }

    // PATCH: only include fields that were actually provided.
    const data: UpdateUserBody = {};

    if (username !== undefined) {
      if (!username.trim()) {
        return next(new AppError("Username cannot be empty.", 400));
      }

      data.username = username.trim();
    }

    if (email !== undefined) {
      if (!email.trim()) {
        return next(new AppError("Email cannot be empty.", 400));
      }

      data.email = email.trim().toLowerCase();
    }

    if (role !== undefined) {
      data.role = role;
    }

    if (isActive !== undefined) {
      data.isActive = isActive;
    }

    if (photo !== undefined) {
      data.photo = photo;
    }

    if (Object.keys(data).length === 0) {
      return next(
        new AppError("Please provide at least one field to update.", 400),
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    return res.status(200).json({
      status: "success",
      data: { user },
    });
  },
);

/**
 * Deactivate a user
 *
 * We use a soft delete rather than physically deleting
 * the record.
 */
export const deleteUser = catchAsync(
  async (req: Request<UserParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!user) {
      return next(new AppError("User not found with that ID.", 404));
    }

    if (!user.isActive) {
      return next(new AppError("User is already inactive.", 400));
    }

    /*
     * Prevent an administrator from accidentally
     * deactivating their own account through the
     * admin delete endpoint.
     */
    if (user.id === req.user!.id) {
      return next(
        new AppError(
          "You cannot deactivate your own account from this endpoint.",
          400,
        ),
      );
    }

    await prisma.user.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });

    return res.status(204).send();
  },
);
