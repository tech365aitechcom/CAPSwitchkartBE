import express from "express";
import outstandingLotController from "../controller/outstandingController.js";
import verifyToken from "../middlewares/authJwt.js";

const outstandingRoute = express.Router();

outstandingRoute
  .get("/all", verifyToken, outstandingLotController.allLots) //get all the lots from deviceLots schema except "Pickup Confirmed" lots
  .get("/search", verifyToken, outstandingLotController.searchLots) //search lots by refId or date created
  .post("/update", verifyToken, outstandingLotController.updateStatus) //update status of lots, take input lotId[] and new status
  .post("/forwardreq", verifyToken, outstandingLotController.forwardRequest)
  .get("/devices/:rid", verifyToken, outstandingLotController.devicesList); //get all the devices in lot using lotID

export default outstandingRoute;
