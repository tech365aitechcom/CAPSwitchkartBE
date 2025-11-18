import express from "express";
import categoryController from "../controller/categoryController.js";
import verifyToken from "../middlewares/authJwt.js";

const categoryRoute = express.Router();

categoryRoute.get("/getAll", verifyToken, categoryController.getCategory);

export default categoryRoute;
