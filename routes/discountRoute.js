import express from "express";
import discountController from "../controller/discountController.js";
import verifyToken from "../middlewares/authJwt.js"

const discountRoute = express.Router();

discountRoute
    .post("/add", verifyToken, discountController.create)
    .put("/update", verifyToken, discountController.update)
    .get("/findByLeadId", verifyToken, discountController.findByLeadId)
    .post("/applyDiscount", verifyToken, discountController.applyDiscount)

export default discountRoute;
