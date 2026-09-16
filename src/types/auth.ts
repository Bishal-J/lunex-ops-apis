import { RoleType } from "../../generated/prisma/enums.js";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  photo: string | null;
  passwordChangedAt: Date | null;
  role: RoleType;
  createdAt: Date;
  updatedAt: Date;
}
