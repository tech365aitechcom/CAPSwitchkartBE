import express from "express";
import mastersController from "../controller/mastersController.js";
import multer from "multer";
import verifyToken from "../middlewares/authJwt.js";

const mastersRoute = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

mastersRoute.post(
  "/add-many",
  verifyToken,
  upload.single("file"),
  mastersController.insertMany
);

export default mastersRoute;
