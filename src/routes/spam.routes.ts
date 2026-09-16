import { Router } from "express";

import {
  deleteSpamContact,
  getSpamContactById,
  getSpamContacts,
  restoreSpamContact,
} from "../controllers/spam/spam.controllers.js";

import { authorize, protectRoute } from "../middleware/auth.middleware.js";

import { RoleType } from "../../generated/prisma/enums.js";

const router = Router();

/*
 * Spam Management
 *
 * SUPER_ADMIN / ADMIN / MODERATOR
 */

router
  .route("/")
  .get(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
    getSpamContacts,
  );

router
  .route("/:id")
  .get(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
    getSpamContactById,
  );

/*
 * Restore
 *
 * SUPER_ADMIN / ADMIN / MODERATOR
 */

router.post(
  "/:id/restore",
  protectRoute,
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
  restoreSpamContact,
);

/*
 * Permanent deletion
 *
 * SUPER_ADMIN only
 */

router.delete(
  "/:id",
  protectRoute,
  authorize(RoleType.SUPER_ADMIN),
  deleteSpamContact,
);

export default router;
