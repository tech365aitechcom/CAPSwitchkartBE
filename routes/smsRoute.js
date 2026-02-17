import express from "express";
import { sendOTP, verifyOTP } from "../controller/smsController.js";
import verifyToken from "../middlewares/authJwt.js";
import {
  otpRequestLimiter,
  otpVerificationLimiter
} from "../middlewares/rateLimiter.js";

const smsRoute = express.Router();

smsRoute
  // OTP request with rate limiting (3 attempts per 10 minutes)
  .post("/sendOtp", otpRequestLimiter, verifyToken, sendOTP)
  // OTP resend with rate limiting (3 attempts per 10 minutes)
  .post("/resendOtp", otpRequestLimiter, verifyToken, sendOTP)
  // OTP verification with rate limiting (5 attempts per 5 minutes)
  .post("/verifyOtp", otpVerificationLimiter, verifyToken, verifyOTP);

export default smsRoute;
