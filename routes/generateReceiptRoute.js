import express from "express";
import generateReceipt from "../controller/generateReceipt.js";
import verifyToken from "../middlewares/authJwt.js";

const generateReceiptRoute = express.Router();

generateReceiptRoute
  .post("/generate",verifyToken , generateReceipt.receiptController)

export default generateReceiptRoute;
