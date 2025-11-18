import express from "express";
import lqdPricesController from "../controller/lqdPricesController.js";
import multer from "multer";
import verifyToken from "../middlewares/authJwt.js";

const lqdPriceRoute = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

lqdPriceRoute.post(
  "/pricesUpdate",
  upload.fields([{ name: "PriceSheet" }]),
  verifyToken,
  lqdPricesController.addLiquidatorsPrices
);

export default lqdPriceRoute;
