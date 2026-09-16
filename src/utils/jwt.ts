import jwt from "jsonwebtoken";

import type { StringValue } from "ms";
import { AppError } from "./appError.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as StringValue;

export interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

export const signToken = (userId: string): string => {
  return jwt.sign(
    {
      id: userId,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    },
  );
};

export const verifyToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.id !== "string" ||
    typeof decoded.iat !== "number"
  ) {
    throw new AppError("Invalid authentication token.", 401);
  }

  return decoded as JwtPayload;
};
