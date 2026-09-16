import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../utils/appError.js";

interface ErrorWithStatus extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

const sendErrorDev = (err: ErrorWithStatus, res: Response): void => {
  console.error(err);

  res.status(err.statusCode ?? 500).json({
    status: err.status ?? "error",
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: ErrorWithStatus, res: Response): void => {
  // Operational errors are safe to send to the client
  if (err.isOperational) {
    res.status(err.statusCode ?? 500).json({
      status: err.status ?? "error",
      message: err.message,
    });

    return;
  }

  // Unexpected errors should only be logged
  console.error("UNEXPECTED ERROR:", err);

  res.status(500).json({
    status: "error",
    message: "Something went very wrong!",
  });
};

export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let normalizedError: ErrorWithStatus;

  // ---------------------------------------------------------
  // AppError
  // ---------------------------------------------------------

  if (err instanceof AppError) {
    normalizedError = err;
  }

  // ---------------------------------------------------------
  // JWT errors
  // ---------------------------------------------------------
  else if (err instanceof jwt.TokenExpiredError) {
    normalizedError = new AppError(
      "Your authentication token has expired. Please log in again.",
      401,
    );
  } else if (err instanceof jwt.JsonWebTokenError) {
    normalizedError = new AppError(
      "Invalid authentication token. Please log in again.",
      401,
    );
  }

  // ---------------------------------------------------------
  // Prisma known request errors
  // ---------------------------------------------------------
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      // Unique constraint violation
      case "P2002":
        normalizedError = new AppError(
          "A record with this value already exists.",
          409,
        );
        break;

      // Record not found
      case "P2025":
        normalizedError = new AppError(
          "The requested record was not found.",
          404,
        );
        break;

      // Foreign key constraint violation
      case "P2003":
        normalizedError = new AppError("Invalid related record.", 400);
        break;

      // Other known Prisma errors
      default:
        normalizedError = new AppError("A database error occurred.", 500);
    }
  }

  // ---------------------------------------------------------
  // Prisma validation errors
  // ---------------------------------------------------------
  else if (err instanceof Prisma.PrismaClientValidationError) {
    normalizedError = new AppError("Invalid database request.", 400);
  }

  // ---------------------------------------------------------
  // Normal JavaScript Error
  // ---------------------------------------------------------
  else if (err instanceof Error) {
    // Unexpected errors remain non-operational
    normalizedError = err;
  }

  // ---------------------------------------------------------
  // Unknown thrown value
  // ---------------------------------------------------------
  else {
    normalizedError = new Error("Something went wrong.");
  }

  // ---------------------------------------------------------
  // Development
  // ---------------------------------------------------------

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(normalizedError, res);
    return;
  }

  // ---------------------------------------------------------
  // Production
  // ---------------------------------------------------------

  sendErrorProd(normalizedError, res);
};
