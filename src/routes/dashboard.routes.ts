import { Router } from "express";

import { getDashboard } from "../controllers/dashboard/dashboard.controllers.js";

import { authorize, protectRoute } from "../middleware/auth.middleware.js";

import { RoleType } from "../generated/prisma/enums.js";

const router = Router();

router.get(
  "/",
  protectRoute,
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
  getDashboard,
);

export default router;
