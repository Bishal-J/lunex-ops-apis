import { Router } from "express";

import {
  getSettings,
  updateSettings,
} from "../controllers/settings/settings.controllers.js";

import { authorize, protectRoute } from "../middleware/auth.middleware.js";

import { RoleType } from "../../generated/prisma/enums.js";

const router = Router();

/*
 * General Settings
 *
 * SUPER_ADMIN / ADMIN
 */

router
  .route("/")
  .get(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN),
    getSettings,
  )
  .patch(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN),
    updateSettings,
  );

export default router;
