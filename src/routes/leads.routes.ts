import { Router } from "express";

import {
  assignLead,
  deleteLead,
  getLeadById,
  getLeads,
  unassignLead,
  updateLead,
} from "../controllers/leads/leads.controllers.js";

import { authorize, protectRoute } from "../middleware/auth.middleware.js";

import { RoleType } from "../generated/prisma/enums.js";

const router = Router();

/*
 * Lead Management
 *
 * SUPER_ADMIN / ADMIN / MODERATOR
 */

router
  .route("/")
  .get(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
    getLeads,
  );

/*
 * Individual Lead
 */

router
  .route("/:id")
  .get(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
    getLeadById,
  )
  .patch(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
    updateLead,
  );

/*
 * Lead Assignment
 */

router.patch(
  "/:id/assign",
  protectRoute,
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
  assignLead,
);

router.patch(
  "/:id/unassign",
  protectRoute,
  authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.MODERATOR),
  unassignLead,
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
  deleteLead,
);

export default router;
