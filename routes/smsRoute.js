import express from "express";
import { sendOTP, verifyOTP } from "../controller/smsController.js";
import verifyToken from "../middlewares/authJwt.js";

const smsRoute = express.Router();

smsRoute
  .post("/sendOtp",verifyToken, sendOTP)
  .post("/resendOtp",verifyToken, sendOTP)
  .post("/verifyOtp",verifyToken, verifyOTP);

export default smsRoute;
