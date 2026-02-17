import express from "express";

const S3Route = express.Router();

import s3Controller from "../controller/s3.controller.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

S3Route.get("/get-presigned-url", s3Controller.preSignedUrl);
S3Route.post("/upload-file", upload.single("file"), s3Controller.uploadFile);
S3Route.get("/proxy-image", s3Controller.proxyImageAsBase64);

export default S3Route;
