import express from "express";
import moduleController from "../controller/moduleController.js";
import verifyToken from "../middlewares/authJwt.js";

const moduleRoute = express.Router();

moduleRoute.get("/getModule", verifyToken, moduleController.getModule);
moduleRoute.put("/updateModule", verifyToken, moduleController.updateModule);

export default moduleRoute;
