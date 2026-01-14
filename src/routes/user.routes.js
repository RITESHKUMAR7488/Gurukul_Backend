import { Router } from "express";
import {
  loginWithPhone,
  updateProfile,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public Routes
router.route("/login").post(loginWithPhone);

// Protected Routes
router
  .route("/update-profile")
  .patch(verifyJWT, upload.single("profilePic"), updateProfile);

export default router;
