import users from "../models/UsersModel.js";
import s3Controller from "./s3.controller.js";
import pkg from "aws-sdk";
const { S3 } = pkg;
const userNotFound = "User not found";

const s3Bucket = new S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION,
});

async function Edituser(req, res) {
  try {
    const userId = req.userId; // convert userId to ObjectId

    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: userNotFound });
    }

    const {
      firstName,
      lastName,
      website,
      companyName,
      address,
      managerName,
      pincode,
      email,
      phoneNumber,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !website ||
      !companyName ||
      !address ||
      !managerName ||
      !pincode ||
      !email ||
      !phoneNumber
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    user.firstName = firstName;
    user.lastName = lastName;
    user.website = website;
    user.companyName = companyName;
    user.address = address;
    user.managerName = managerName;
    user.pincode = pincode;
    user.email = email;
    user.phoneNumber = phoneNumber;

    await user.save();

    const profile = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      state: user.state,
      city: user.city,
      address: user.address, // added
      companyName: user.companyName, // added
      firstName: user.firstName, // added
      lastName: user.lastName, // added
      managerName: user.managerName, // added
      pincode: user.pincode, // added
      website: user.website, // added
      profileImage: user.profileImage,
      phoneNumber: user.phoneNumber, //added
    };

    return res
      .status(200)
      .json({ message: "User data updated successfully", user: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function Uploadimage(req, res) {
  const userId = req.userId;

  try {
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: userNotFound });
    }

    const { Profileimage } = req.files;
    const profileImageLink = await s3Controller.uploadFile(Profileimage[0]);

    user.profileImage = profileImageLink;

    await user.save();

    return res.status(200).json({
      message: "Profile image uploaded and user data updated successfully!",
      profileImageLink: profileImageLink,
    });
  } catch (err) {
    return res.status(500).json({
      message:
        "An error occurred while uploading the profile image and updating the user data.",
      error: err,
    });
  }
}

async function Deleteimage(req, res) {
  try {
    const userId = req.userId;

    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: userNotFound });
    }

    const urlParts = user.profileImage.split("/");
    const fileKey = urlParts.slice(3).join("/");

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileKey,
    };

    const data = await s3Bucket.deleteObject(params).promise();
    console.log(data);

    user.profileImage = null;

    await user.save();

    return res.status(200).json({
      message: "Profile image deleted and user data updated successfully!",
      data: user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message:
        "An error occurred while deleting the profile image and updating the user data.",
      error: err.toString(),
    });
  }
}

async function GetUserDetails(req, res) {
  try {
    const userId = req.userId;

    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: userNotFound });
    }

    const profile = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      state: user.state,
      city: user.city,
      address: user.address,
      companyName: user.companyName,
      firstName: user.firstName,
      lastName: user.lastName,
      managerName: user.managerName,
      pincode: user.pincode,
      website: user.website,
      profileImage: user.profileImage,
      phoneNumber: user.phoneNumber,
    };

    return res.status(200).json({
      success: true,
      user: profile
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export default {
  Edituser,
  Uploadimage,
  Deleteimage,
  GetUserDetails,
};
