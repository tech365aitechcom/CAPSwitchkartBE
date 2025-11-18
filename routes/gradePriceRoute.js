import express from "express";
import gradePriceController from "../controller/gradePriceController.js";
import multer from "multer";

const gradePriceRoute = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

gradePriceRoute
  .post(
    "/addEditModelsAndPrice",
    upload.single("file"),
    gradePriceController.addEditModelsAndPrice
  )
  .post(
    "/addEditModelAndPricexlsv",
    upload.single("file"),
    gradePriceController.addEditModelsAndPricexlsv
  )
  .get("/modelPriceList", gradePriceController.modelPriceList)
  .get("/getModelWisePrice", gradePriceController.getModelWisePrice);

export default gradePriceRoute;
