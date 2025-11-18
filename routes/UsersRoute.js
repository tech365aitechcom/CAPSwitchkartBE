import express from "express";

const UsersRoute = express.Router();
import usersController from "../controller/UsersController.js";
import verifyToken from "../middlewares/authJwt.js"

UsersRoute
  .post("/login", usersController.login)
  .post("/signUp", verifyToken, usersController.updateEditUsers)
  .post("/editUser", verifyToken, usersController.updateEditUsers)
  .put("/updateUserStatus", verifyToken, usersController.updateUserStatus)
  .post("/sendOTP",  usersController.sendOTP)
  .post("/verifyEmailOtp",  usersController.verifyEmailOtp)
  .get("/getAllUsers", verifyToken, usersController.getAllUsers)
  .post("/reset/Password",  usersController.PasswordSet);

export default UsersRoute;
