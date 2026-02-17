import express from "express";
import verifyToken from "../middlewares/authJwt.js";
import profileContrDColler from "../controller/Profile_crud_Controller.js";
import multer from "multer";

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

const ProfileCrudRoute = express.Router();

ProfileCrudRoute
  .get("/details", verifyToken, profileContrDColler.GetUserDetails)
  .post("/user/edit", verifyToken, profileContrDColler.Edituser)
  .post("/user/upload/Profile_image",verifyToken,upload.fields([{ name: "Profileimage" }]),profileContrDColler.Uploadimage)
  .delete("/user/delete/Profile_image", verifyToken, profileContrDColler.Deleteimage);

export default ProfileCrudRoute;
