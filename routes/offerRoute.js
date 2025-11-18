import express from "express";

import verifyToken from "../middlewares/authJwt.js";
import Offer from "../controller/offerController.js";

const offerRoute = express.Router();

offerRoute
  .post("/create", verifyToken, Offer.createOffer)
  .put("/edit/:id", verifyToken, Offer.editOffer)
  .get("/getOfferList", verifyToken, Offer.getOfferList)
  .delete("/delete/:id", verifyToken, Offer.deleteOffer);

export default offerRoute;
