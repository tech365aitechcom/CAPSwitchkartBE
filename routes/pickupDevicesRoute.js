import express from "express";
import pickupDevicesController from "../controller/pickupDevicesController.js";
import verifyToken from "../middlewares/authJwt.js";

const pickupDevicesRoute = express.Router();

pickupDevicesRoute
  .get("/all", verifyToken, pickupDevicesController.allLots) //get all the lots from deviceLots schema except "Pickup Confirmed" lots
  .get("/search", verifyToken, pickupDevicesController.searchLots) //
  .get("/history", verifyToken, pickupDevicesController.lotsHistory) //get all lots with status: "Pickup Confirmed"
  .post("/update", verifyToken, pickupDevicesController.updateStatus) //update status of lots, take input lotId[] and new status
  .get("/devices/:rid", verifyToken, pickupDevicesController.devicesList)
  .get(
    "/technicianReport",
    verifyToken,
    pickupDevicesController.technicianReport
  );

export default pickupDevicesRoute;
