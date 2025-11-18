import express from "express";
import questionnaireController from "../controller/questionnaireController.js";
import multer from "multer";
import verifyToken from "../middlewares/authJwt.js"

const questionnaireRoute = express.Router();

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

questionnaireRoute
    .post("/add",verifyToken, questionnaireController.create)
    .post("/add-many",verifyToken, upload.single("file"), questionnaireController.insertMany)
    .get("/findAll",verifyToken, questionnaireController.findAll)
    .post("/calculatePrice", verifyToken, questionnaireController.calculatePrice)
    .post("/item-purchased", verifyToken,upload.single("file"), questionnaireController.itemPurchased)
    .post("/upload-documents", verifyToken, upload.fields([
        { name: "adharFront" },
        { name: "adharBack" },
        { name: "phoneBill" },
        { name: "phoneFront" },
        { name: "phoneBack" },
        { name: "phoneUp" },
        { name: "phoneDown" },
        { name: "phoneLeft" },
        { name: "phoneRight" },
        { name: "signature" },
    ]), questionnaireController.uploadDocuments)
    .post("/getSubmitedData", verifyToken, questionnaireController.getSubmitedData)
    .get("/getDocuments",verifyToken, questionnaireController.getDocuments)
    .get("/questionnaireList",verifyToken, questionnaireController.questionnaireList)
    .put("/edit",verifyToken, questionnaireController.update)
    .delete("/deleteById",verifyToken, questionnaireController.deleteById)
    .post("/calculatePriceWatch",verifyToken, questionnaireController.calculatePriceWatch)
    .post("/customerDetail", questionnaireController.customerDetail)

export default questionnaireRoute;
