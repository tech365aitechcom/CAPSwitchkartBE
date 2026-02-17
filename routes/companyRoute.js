import express from "express";
import companyController from "../controller/companyController.js";
import verifyToken from "../middlewares/authJwt.js";
import companyScopingMiddleware from "../middlewares/companyScopingMiddleware.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

const companyRoute = express.Router();

companyRoute
    .post("/create", verifyToken, companyScopingMiddleware, upload.array("files"), companyController.create)
    .put("/edit", verifyToken, companyScopingMiddleware, upload.array("files"), companyController.update)
    .delete("/deleteById", verifyToken, companyScopingMiddleware, companyController.deleteById)
    .get("/findById", verifyToken, companyScopingMiddleware, companyController.findById)
    .get("/findAll", verifyToken, companyScopingMiddleware, companyController.findAll)
    .post("/uploadCompanies", verifyToken, companyScopingMiddleware, upload.single("file"), companyController.uploadData)

export default companyRoute;
