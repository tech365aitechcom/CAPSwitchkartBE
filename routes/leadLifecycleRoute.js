import express from "express";
import verifyToken from "../middlewares/authJwt.js";
import leadsLifeCycle from "../controller/leadLifecycleController.js";
import multer from "multer";

const leadLifecycleRoute = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "upload");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const uploads = multer({ storage: storage });

leadLifecycleRoute
  .post("/quickQoute", verifyToken, leadsLifeCycle.addQuickQoute)
  .post("/bulkUploadImage", verifyToken, leadsLifeCycle.bulkuploadImage)
  .post("/orderCreated", verifyToken, leadsLifeCycle.addOrderCreated)
  .get("/getCount", verifyToken, leadsLifeCycle.getCounts)
  .delete("/delete/:id", verifyToken, leadsLifeCycle.deleteDoc)
  .post(
    "/uploadimage",
    upload.fields([
      { name: "phoneFront" },
      { name: "phoneBack" },
      { name: "phoneFrontUp" },
      { name: "phoneFrontDown" },
    ]),
    leadsLifeCycle.uploadImage
  );

export default leadLifecycleRoute;
