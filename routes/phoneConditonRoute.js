import express from "express";
import phoneConditonController from "../controller/phoneConditonController.js";
import multer from "multer";
import verifyToken from "../middlewares/authJwt.js";

const phoneConditonRoute = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

phoneConditonRoute.post(
  "/add-many",
  verifyToken,
  upload.single("file"),
  phoneConditonController.insertMany
);

export default phoneConditonRoute;
