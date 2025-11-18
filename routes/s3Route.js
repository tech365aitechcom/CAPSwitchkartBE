import express from "express";

const S3Route = express.Router();

import s3Controller from "../controller/s3.controller.js";

S3Route.get("/get-presigned-url", s3Controller.preSignedUrl);

export default S3Route;
