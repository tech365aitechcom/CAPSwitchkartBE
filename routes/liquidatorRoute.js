import express from "express";
import liquidatorController from "../controller/liquidatorController.js";
import verifyToken from "../middlewares/authJwt.js";

const liquidatorRoute = express.Router();

liquidatorRoute.get("/findall", verifyToken, liquidatorController.findAll)
.post("/create", verifyToken, liquidatorController.create)
.put("/update", verifyToken, liquidatorController.update)
.put("/delete", verifyToken, liquidatorController.deleteById);

export default liquidatorRoute;
