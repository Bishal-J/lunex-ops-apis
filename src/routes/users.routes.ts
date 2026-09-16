import { Router } from "express";

import {
  createUser,
  deleteMe,
  deleteUser,
  getAllUsers,
  getProfile,
  getUser,
  updateMe,
  updateUser,
} from "../controllers/users/users.controllers.js";

import {
  forgotPassword,
  logout,
  resetPassword,
  signIn,
  signUp,
  updatePassword,
} from "../controllers/users/auth.controllers.js";

import { RoleType } from "../../generated/prisma/enums.js";
import { authorize, protectRoute } from "../middleware/auth.middleware.js";

const router = Router();

/*
 * Authentication
 */

// Public
router.post("/signup", signUp);
router.post("/signin", signIn);
router.post("/forgot-password", forgotPassword);
router.patch("/reset-password/:token", resetPassword);

// Authenticated
router.post("/logout", protectRoute, logout);
router.patch("/update-password", protectRoute, updatePassword);

/*
 * Current User
 */

router.get("/me", protectRoute, getProfile);
router.patch("/me", protectRoute, updateMe);
router.delete("/me", protectRoute, deleteMe);

/*
 * User Management
 *
 * Only admins can manage users.
 */

router
  .route("/")
  .get(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN),
    getAllUsers,
  )
  .post(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN),
    createUser,
  );

router
  .route("/:id")
  .get(protectRoute, authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN), getUser)
  .patch(
    protectRoute,
    authorize(RoleType.SUPER_ADMIN, RoleType.ADMIN),
    updateUser,
  )
  .delete(protectRoute, authorize(RoleType.SUPER_ADMIN), deleteUser);

export default router;
