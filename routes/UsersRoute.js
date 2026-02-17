import express from "express";

const UsersRoute = express.Router();
import usersController from "../controller/UsersController.js";
import verifyToken from "../middlewares/authJwt.js";
import { checkRole, preventPrivilegeEscalation, ROLES } from "../middlewares/rbac.js";
import {
  loginLimiter,
  otpRequestLimiter,
  otpVerificationLimiter,
  passwordResetLimiter
} from "../middlewares/rateLimiter.js";

UsersRoute
  // Login endpoint with rate limiting (5 attempts per 15 minutes)
  .post("/login", loginLimiter, usersController.login)
  .post("/signUp", verifyToken, checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER]), preventPrivilegeEscalation, usersController.updateEditUsers)
  .post("/editUser", verifyToken, checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER]), preventPrivilegeEscalation, usersController.updateEditUsers)
  .put("/updateUserStatus", verifyToken, checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER]), usersController.updateUserStatus)
  // OTP request endpoint with rate limiting (3 attempts per 10 minutes)
  .post("/sendOTP", otpRequestLimiter, usersController.sendOTP)
  // OTP verification endpoint with rate limiting (5 attempts per 5 minutes)
  .post("/verifyEmailOtp", otpVerificationLimiter, usersController.verifyEmailOtp)
  .get("/getAllUsers", verifyToken, checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN_MANAGER]), usersController.getAllUsers)
  // Password reset endpoint with rate limiting (3 attempts per 15 minutes)
  .post("/reset/Password", passwordResetLimiter, usersController.PasswordSet);

export default UsersRoute;
