import express from "express";
import multer from "multer";
import userRegistryController from "../controller/userRegistryController.js";
import verifyToken from "../middlewares/authJwt.js";

const userRegistryRoute = express.Router();


const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .csv and .xlsx files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});


userRegistryRoute
  .get("/all", verifyToken, userRegistryController.userList)
  .get("/search", verifyToken, userRegistryController.userSearch)
  .post("/register", userRegistryController.createUser)
  .post("/updatePassword", verifyToken, userRegistryController.updatePassword)
  .put("/update", verifyToken, userRegistryController.editUser)
  .delete("/delete", verifyToken, userRegistryController.deleteUser)
  .post(
    "/bulk-upload",
    verifyToken,
    upload.single("file"),
    userRegistryController.bulkUploadUsers
  )
  .get(
    "/bulk-upload/history",
    verifyToken,
    userRegistryController.getUploadHistory
  )
  .get(
    "/bulk-upload/history/:uploadId",
    verifyToken,
    userRegistryController.getUploadLogDetails 
  );

export default userRegistryRoute;
