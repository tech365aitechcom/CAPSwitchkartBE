import express from "express";
import companyController from "../controller/companyController.js";
import verifyToken from "../middlewares/authJwt.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

const companyRoute = express.Router();

companyRoute
    .post("/create", verifyToken, upload.array("files"), companyController.create)
    .put("/edit", verifyToken,upload.array("files"), companyController.update)
    .delete("/deleteById", verifyToken, companyController.deleteById)
    .get("/findById", verifyToken, companyController.findById)
    .get("/findAll", verifyToken, companyController.findAll)
    .post("/uploadCompanies", upload.single("file"), verifyToken, companyController.uploadData)

export default companyRoute;
