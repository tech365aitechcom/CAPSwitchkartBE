import express from "express";
import brandsController from "../controller/brandsController.js";
import multer from "multer";
import verifyToken from "../middlewares/authJwt.js";

const brandsRoute = express.Router();
const upload = multer({ storage: multer.memoryStorage()});

brandsRoute
  .post("/add-brand",upload.fields([{ name: "brandImage" }]), verifyToken, brandsController.create)
  .post("/update",upload.fields([{ name: "brandImage" }]), verifyToken, brandsController.updateBrand)
  .post("/add-model", verifyToken, brandsController.createModel)
  .get("/getBrands", verifyToken, brandsController.getBrands)
  .get("/getAllBrandsModels", verifyToken, brandsController.getAllBrandsModels)
  .post("/getSelectedBrandModels", verifyToken, brandsController.SelectedBrandModels)

export default brandsRoute;
