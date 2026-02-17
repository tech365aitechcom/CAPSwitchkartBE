import express from "express";
import storeController from "../controller/storeController.js";
import verifyToken from "../middlewares/authJwt.js";
import { authorizeCompanyAndStore } from "../middlewares/companyScopingMiddleware.js";
import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error('Invalid file type. Only .csv and .xlsx files are allowed.'),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const storeRoute = express.Router();

storeRoute
  .post("/create", verifyToken, authorizeCompanyAndStore, storeController.create)
  .put("/edit", verifyToken, authorizeCompanyAndStore, storeController.update)
  .delete("/deleteById", verifyToken, authorizeCompanyAndStore, storeController.deleteById)
  .get("/findById", verifyToken, authorizeCompanyAndStore, storeController.findById)
  .get("/findAll", verifyToken, authorizeCompanyAndStore, storeController.findAll)
  .post(
    "/uploadStores",
    verifyToken,
    authorizeCompanyAndStore,
    upload.single('file'),
    storeController.uploadData
  )
  .get("/adminReport", verifyToken, authorizeCompanyAndStore, storeController.adminReport);

export default storeRoute;
