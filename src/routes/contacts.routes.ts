import { Router } from "express";

import {
  acceptContact,
  createContact,
  getContactById,
  getContacts,
  rejectContact,
  updateContact,
} from "../controllers/contacts/contacts.controllers.js";

import { authorize, protectRoute } from "../middleware/auth.middleware.js";

import { RoleType } from "../../generated/prisma/enums.js";

const router = Router();

/*
 * Public
 *
 * Contact form submission from the website.
 */
router.post("/", createContact);

/*
 * Contact Management
 *
 * SUPER_ADMIN / ADMIN / MODERATOR
 */

router
  .route("/")
  .get(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
    getContacts,
  );

router
  .route("/:id")
  .get(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
    getContactById,
  )
  .patch(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
    updateContact,
  );

/*
 * Contact Workflow
 */

/*
 * Accept contact → Create Lead
 */
router.post(
  "/:id/accept",
  protectRoute,
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
  acceptContact,
);

/*
 * Reject contact → Move to Spam
 */
router.post(
  "/:id/reject",
  protectRoute,
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
  rejectContact,
);

export default router;
