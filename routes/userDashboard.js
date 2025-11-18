import express from "express"
import dashboardController from "../controller/dashboardController.js"
import verifyToken from "../middlewares/authJwt.js"

const userDashboard = express.Router();

userDashboard
     .get("/order/created", verifyToken, dashboardController.Prospect)
     .get("/order/saled", verifyToken, dashboardController.saled)
     .post("/add/PhoneView", verifyToken, dashboardController.addViewedPhone)
     .get("/getPhoneView", verifyToken, dashboardController.getViewedPhone)
     .get("/get/top/sellingModels", verifyToken, dashboardController.topSelling)
     .post("/search/phones", verifyToken, dashboardController.searchPhone)
     .get("/get/top/sellingforadmin", verifyToken, dashboardController.adminSelingget)
     export default userDashboard;
