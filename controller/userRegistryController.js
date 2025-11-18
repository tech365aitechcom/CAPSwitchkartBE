import userRegistry from "../models/UsersModel.js";
import {
  BulkUserUpload,
  BulkUserUploadLog,
} from "../models/BulkUploadModel.js";
import { Readable } from "stream";
import xlsx from "xlsx";
import csv from "csv-parser";
import mongoose from "mongoose";

import bcrypt from "bcryptjs";
const ISE = "Internal Server Error";

const roleSaleUser = "Sale User";
const roleTechnician = "Technician";
const roleAdminManager = "Admin Manager";
const superAdmin = "Super Admin";
const newroleAdminManager = "Admin_Manager_Unicorn";
const newsuperAdmin = "Super_Admin_Unicorn";

const userList = async (req, res) => {
  try {
    const loggedInUser = await userRegistry
      .findById(req.userId)
      .select("role storeId");
    if (!loggedInUser) {
      return res.status(403).json({ msg: "Forbidden: User not found." });
    }
    const isSuperAdmin = loggedInUser.role === "Super Admin";

    const pipeline = [
      {
        $match: {
          role: { $in: [roleSaleUser, roleTechnician, roleAdminManager] },
        },
      },
      {
        $lookup: {
          from: "stores",
          localField: "storeId",
          foreignField: "_id",
          as: "stores",
        },
      },
      { $unwind: { path: "$stores", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "_id",
          as: "companyData",
        },
      },
      { $unwind: { path: "$companyData", preserveNullAndEmptyArrays: true } },
      { $addFields: { companyName: "$companyData.companyName" } },
      { $project: { password: 0, companyData: 0 } },
      { $sort: { updatedAt: -1 } },
    ];

    if (!isSuperAdmin) {
      if (!loggedInUser.storeId) {
        return res
          .status(200)
          .json({ data: [], msg: "User is not assigned to a store." });
      }
      // Forcefully filter the list to only include users in the same store.
      pipeline.unshift({ $match: { storeId: loggedInUser.storeId } });
    }

    const users = await userRegistry.aggregate(pipeline);
    return res
      .status(200)
      .json({ data: users, msg: "Successfully fetched all users" });
  } catch (err) {
    console.error("Error in userList:", err);
    return res
      .status(500)
      .json({ msg: "Fetching users failed, please try again later." });
  }
};

const userSearch = async (req, res) => {
  try {
    const loggedInUser = await userRegistry
      .findById(req.userId)
      .select("role storeId");
    if (!loggedInUser) {
      return res.status(403).json({ msg: "Forbidden: User not found." });
    }

    const isSuperAdmin = loggedInUser.role === "Super Admin";
    const { uid = "", role = "", storeName = "" } = req.query;

    const pipeline = [
      {
        $match: {
          role: { $in: [roleSaleUser, roleTechnician, roleAdminManager] },
        },
      },
      { $addFields: { tempUserId: { $toString: "$_id" } } },
      {
        $lookup: {
          from: "stores",
          localField: "storeId",
          foreignField: "_id",
          as: "stores",
        },
      },
      { $unwind: { path: "$stores", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "_id",
          as: "companyData",
        },
      },
      { $unwind: { path: "$companyData", preserveNullAndEmptyArrays: true } },
      { $addFields: { companyName: "$companyData.companyName" } },
    ];

    if (!isSuperAdmin) {
      if (!loggedInUser.storeId) {
        return res
          .status(200)
          .json({ data: [], msg: "User not assigned to a store." });
      }
      pipeline.unshift({ $match: { storeId: loggedInUser.storeId } });
    }

    pipeline.push({
      $match: {
        $and: [
          {
            $or: [
              { tempUserId: { $regex: uid, $options: "i" } },
              { firstName: { $regex: uid, $options: "i" } },
              { lastName: { $regex: uid, $options: "i" } },
              { name: { $regex: uid, $options: "i" } },
              { phoneNumber: { $regex: uid, $options: "i" } },
              { email: { $regex: uid, $options: "i" } },
            ],
          },
          { role: { $regex: role, $options: "i" } },
          isSuperAdmin
            ? { "stores.storeName": { $regex: storeName, $options: "i" } }
            : {},
        ],
      },
    });

    pipeline.push(
      { $sort: { updatedAt: -1 } },
      { $project: { password: 0, companyData: 0 } }
    );

    const usersList = await userRegistry.aggregate(pipeline);
    return res
      .status(200)
      .json({ data: usersList, msg: "Successfully searched data" });
  } catch (error) {
    console.error("Error in userSearch:", error);
    return res.status(500).json({ msg: ISE });
  }
};

const createUser = async (req, res) => {
  const userDetail = req.body;
  let existingUser;
  try {
    const { storeId, email, password, role, phoneNumber } = req.body;
    if (!storeId || !email || !password || !role || !phoneNumber) {
      return res.status(422).json({
        msg: "storeId, email, password, role, and phoneNumber are required",
      });
    }
    if (
      role !== roleAdminManager &&
      role !== roleTechnician &&
      role !== roleSaleUser
    ) {
      return res
        .status(422)
        .json({ msg: "Cannot Assign This Role Out of Scope" });
    }
    existingUser = await userRegistry.findOne({ email: userDetail.email });

    if (existingUser) {
      return res
        .status(422)
        .json({ msg: "User exists already, please login instead." });
    }

    let hashedPassword;
    if (userDetail.password && userDetail.password.length >= 6) {
      hashedPassword = await bcrypt.hash(userDetail.password, 5);
    } else {
      return res.status(500).json({ msg: "Password size is very too small" });
    }

    await userRegistry.create({
      firstName: userDetail.firstName,
      lastName: userDetail.lastName,
      name: `${userDetail.firstName ? userDetail.firstName : ""} ${
        userDetail.lastName ? userDetail.lastName : ""
      }`,
      email: userDetail.email,
      password: hashedPassword,
      phoneNumber: userDetail.phoneNumber.toString(),
      grestMember: false,
      role: userDetail.role,
      address: userDetail.address,
      city: userDetail.city,
      storeId: storeId,
      companyId: "660bdd6e9f08331a55342ba5",
    });

    return res.status(200).json({ msg: "User registered successfully." });
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "User registration failed, please try again." });
  }
};

const updatePassword = async (req, res) => {
  const email = req.body.email;
  let newPassword = req.body.newPassword;
  const oldPassword = req.body.oldPassword;

  let existingUser;
  try {
    existingUser = await userRegistry.findOne({ email: email });
    if (!existingUser) {
      return res.status(422).json({ msg: "User does not exist" });
    }

    const verifyPassword = await bcrypt.compare(
      oldPassword,
      existingUser.password
    );

    if (!verifyPassword) {
      return res.status(400).json({ msg: "Incorrect Password" });
    }

    if (newPassword && newPassword.length >= 8) {
      newPassword = await bcrypt.hash(newPassword, 5);
    } else {
      return res.status(500).json({ msg: "password size is very too small" });
    }
    const updatedUser = await userRegistry.findByIdAndUpdate(existingUser._id, {
      password: newPassword,
    });
    if (!updatedUser) {
      return res.status(404).json({ msg: "User not found" });
    }
    return res.status(200).json({ msg: "Successfully updated user password " });
  } catch (error) {
    return res.status(500).json({ msg: ISE });
  }
};

const editUser = async (req, res) => {
  try {
    const updateData = req.body;
    const userID = req.body.userID;
    const role = req.body.role;
    delete updateData.password;
    delete updateData._id;
    delete updateData.companyId;
    if (
      role !== roleAdminManager &&
      role !== roleTechnician &&
      role !== roleSaleUser
    ) {
      return res
        .status(422)
        .json({ msg: "Cannot Assign This Role Out of Scope" });
    }
    const updatedUser = await userRegistry.findByIdAndUpdate(
      userID,
      updateData
    );
    if (!updatedUser) {
      return res
        .status(404)
        .json({ msg: "User not found, failed to update data" });
    }
    return res
      .status(200)
      .json({ data: updatedUser, msg: "Successfully updated user data" });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ msg: ISE });
  }
};

const deleteUser = async (req, res) => {
  const { userID } = req.body;
  const modfierId = req.userId;

  try {
    const adminData = await userRegistry.findById(modfierId);
    if (!!adminData) {
      if (
        adminData.role !== "Super Admin" &&
        adminData.role !== roleAdminManager
      ) {
        return res.status(403).json({
          msg: "Unauthorized: You do not have permission to delete a user.",
        });
      }
    } else {
      return res.status(403).json({
        msg: "Unauthorized: Your account information could not be verified.",
      });
    }

    await userRegistry.findByIdAndDelete(userID);
  } catch (error) {
    return res
      .status(500)
      .json({ msg: "Failed to delete user, please try again." });
  }
  return res.status(200).json({ message: "User deleted successfully" });
};

const bulkUploadUsers = async (req, res) => {
  // --- Start of Execution ---
  console.log("--- [START] bulkUploadUsers function triggered ---");

  if (!req.file) {
    console.error("[ERROR] No file found in the request.");
    return res.status(400).json({ msg: "No file uploaded." });
  }

  console.log("Received file:", {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });

  const uploadJob = new BulkUserUpload({
    fileName: req.file.originalname,
    uploadedBy: req.userId,
    status: "In Progress",
  });

  try {
    await uploadJob.save();
    // --- Job Record Created ---
    console.log(
      `[JOB ID: ${uploadJob._id}] BulkUserUpload job record created successfully.`
    );

    // --- File Parsing ---
    let rows;
    console.log(
      `[JOB ID: ${uploadJob._id}] Attempting to parse file based on mimetype: ${req.file.mimetype}`
    );
    if (req.file.mimetype === "text/csv") {
      console.log(`[JOB ID: ${uploadJob._id}] Parsing as CSV...`);
      rows = await new Promise((resolve, reject) => {
        const results = [];
        Readable.from(req.file.buffer)
          .pipe(csv())
          .on("data", (data) => results.push(data))
          .on("end", () => {
            console.log(
              `[JOB ID: ${uploadJob._id}] CSV parsing finished. Found ${results.length} rows.`
            );
            resolve(results);
          })
          .on("error", (error) => {
            console.error(
              `[JOB ID: ${uploadJob._id}] CSV parsing error!`,
              error
            );
            reject(error);
          });
      });
    } else if (
      [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ].includes(req.file.mimetype)
    ) {
      console.log(`[JOB ID: ${uploadJob._id}] Parsing as XLSX/XLS...`);
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      console.log(
        `[JOB ID: ${uploadJob._id}] Reading from sheet: '${sheetName}'`
      );
      rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      console.log(
        `[JOB ID: ${uploadJob._id}] XLSX parsing finished. Found ${rows.length} rows.`
      );
    } else {
      console.error(
        `[JOB ID: ${uploadJob._id}] Unsupported file type: ${req.file.mimetype}`
      );
      uploadJob.status = "Failed";
      await uploadJob.save();
      return res
        .status(400)
        .json({
          msg: "Unsupported file type. Please upload a .csv or .xlsx file.",
        });
    }

    uploadJob.totalRecords = rows.length;
    console.log(
      `[JOB ID: ${uploadJob._id}] Total records to process: ${uploadJob.totalRecords}`
    );

    if (rows.length === 0) {
      console.log(`[JOB ID: ${uploadJob._id}] File is empty. Completing job.`);
      uploadJob.status = "Completed";
      await uploadJob.save();
      return res.status(400).json({ msg: "The uploaded file is empty." });
    }

    // --- Pre-fetching Data for Validation ---
    console.log(
      `[JOB ID: ${uploadJob._id}] Pre-fetching stores and existing users for validation.`
    );
    let succeededCount = 0,
      failedCount = 0;
    const failedRecordsForCSV = [];
    const validRoles = [roleAdminManager, roleTechnician, roleSaleUser];

    const StoreModel = mongoose.model("store");
    const allStores = await StoreModel.find({}, "storeName");
    const storeMap = new Map(
      allStores.map((s) => [s.storeName.toLowerCase(), s._id])
    );
    console.log(
      `[JOB ID: ${uploadJob._id}] Fetched ${storeMap.size} stores. Example:`,
      Array.from(storeMap.keys()).slice(0, 3)
    );

    const allUsers = await userRegistry.find({}, "email");
    const existingEmails = new Set(allUsers.map((u) => u.email.toLowerCase()));
    console.log(
      `[JOB ID: ${uploadJob._id}] Fetched ${existingEmails.size} existing emails. Example:`,
      Array.from(existingEmails).slice(0, 3)
    );

    // --- Processing Rows ---
    console.log(
      `\n--- [JOB ID: ${uploadJob._id}] Starting to process individual rows ---\n`
    );
    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2; // +2 to account for 0-index and header row
      const errors = [];
      console.log(`\n--- Processing Row Number: ${rowNumber} ---`);
      console.log(`[Row ${rowNumber}] Raw Data:`, row);

      // Normalize keys and values
      const normalizedRow = Object.keys(row).reduce((acc, key) => {
        const value =
          row[key] !== null && row[key] !== undefined
            ? row[key].toString().trim()
            : "";
        acc[key.trim()] = value;
        return acc;
      }, {});
      console.log(`[Row ${rowNumber}] Normalized Data:`, normalizedRow);

      const {
        "First Name": firstName,
        "Last Name": lastName,
        Email: email,
        Password: password,
        "Mobile Number": phoneNumber,
        "Store Name": storeName,
        Role: role,
        City: city,
        Address: address,
      } = normalizedRow;

      // --- Start Validation for Row ${rowNumber} ---
      if (!firstName) errors.push("First Name is mandatory.");
      if (!email) errors.push("Email is mandatory.");
      if (!password) errors.push("Password is mandatory.");
      if (!phoneNumber) errors.push("Mobile Number is mandatory.");
      if (!storeName) errors.push("Store Name is mandatory.");
      if (!role) errors.push("Role is mandatory.");

      if (email && !/\S+@\S+\.\S+/.test(email))
        errors.push("Invalid email format.");
      if (email && existingEmails.has(email.toLowerCase()))
        errors.push("User exists already, please login instead.");
      if (password && password.length < 6)
        errors.push("Password must be at least 6 characters.");
      if (phoneNumber && !/^\d{10}$/.test(phoneNumber))
        errors.push("Mobile Number must be 10 digits.");
      if (role && !validRoles.includes(role))
        errors.push(`Invalid role. Use one of: ${validRoles.join(", ")}.`);

      const storeId = storeMap.get(storeName?.toLowerCase());
      if (storeName && !storeId)
        errors.push(`Store Name '${storeName}' not found.`);
      console.log(
        `[Row ${rowNumber}] Store lookup for '${storeName}': Found ID -> ${storeId}`
      );

      // --- Validation Result for Row ${rowNumber} ---
      if (errors.length > 0) {
        failedCount++;
        const errorMessage = errors.join(" ");
        console.error(
          `[Row ${rowNumber}] VALIDATION FAILED. Reason: ${errorMessage}`
        );
        failedRecordsForCSV.push([
          firstName,
          lastName,
          email,
          "",
          phoneNumber,
          storeName,
          role,
          city,
          address,
          errorMessage,
        ]);
        await BulkUserUploadLog.create({
          uploadId: uploadJob._id,
          rowNumber,
          rowData: row,
          status: "Fail",
          errorMessage,
        });
      } else {
        console.log(
          `[Row ${rowNumber}] VALIDATION PASSED. Proceeding to create user.`
        );
        const hashedPassword = await bcrypt.hash(password, 11);
        await userRegistry.create({
          firstName,
          lastName,
          name: `${firstName} ${lastName || ""}`.trim(),
          email,
          password: hashedPassword,
          phoneNumber: phoneNumber.toString(),
          role,
          storeId,
          city,
          address,
          grestMember: false,
          // companyId: "660bdd6e9f08331a55342ba5",
        });

        existingEmails.add(email.toLowerCase()); // Add to set to prevent duplicates within the same file
        succeededCount++;
        console.log(
          `[Row ${rowNumber}] User created successfully for email: ${email}`
        );
        await BulkUserUploadLog.create({
          uploadId: uploadJob._id,
          rowNumber,
          rowData: row,
          status: "Success",
        });
      }
    }

    // --- Finalizing Job ---
    console.log(
      `\n--- [JOB ID: ${uploadJob._id}] Finished processing all rows ---`
    );
    uploadJob.succeeded = succeededCount;
    uploadJob.failed = failedCount;
    uploadJob.status = "Completed";
    console.log(
      `[JOB ID: ${uploadJob._id}] Final Stats: Total=${uploadJob.totalRecords}, Succeeded=${succeededCount}, Failed=${failedCount}`
    );
    await uploadJob.save();
    console.log(
      `[JOB ID: ${uploadJob._id}] Job status updated to 'Completed'.`
    );

    const finalResult = {
      total: uploadJob.totalRecords,
      succeeded: succeededCount,
      failed: failedCount,
      failedRecords: failedRecordsForCSV,
    };

    console.log(`[JOB ID: ${uploadJob._id}] Sending final response to client.`);
    console.log("--- [END] bulkUploadUsers function successful ---");
    return res.status(200).json({
      msg: "File processed successfully.",
      result: finalResult,
    });
  } catch (error) {
    // --- CATCH BLOCK - An unexpected error occurred ---
    console.error(
      `--- [JOB ID: ${uploadJob._id}] !!! CATASTROPHIC ERROR in bulkUploadUsers !!! ---`
    );
    console.error(error);
    uploadJob.status = "Failed";
    await uploadJob.save();
    console.error(
      `[JOB ID: ${uploadJob._id}] Job status marked as 'Failed' due to the error.`
    );
    console.log("--- [END] bulkUploadUsers function with error ---");
    return res.status(500).json({ msg: ISE });
  }
};

const getUploadHistory = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  try {
    const history = await BulkUserUpload.find()
      .populate("uploadedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalRecords = await BulkUserUpload.countDocuments();
    const totalPages = Math.ceil(totalRecords / limit);

    return res.status(200).json({
      data: history,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
      },
      msg: "Successfully fetched upload history.",
    });
  } catch (error) {
    console.error("Fetch Upload History Error:", error);
    return res.status(500).json({ msg: ISE });
  }
};

const getUploadLogDetails = async (req, res) => {
  const { uploadId } = req.params;
  try {
    const logs = await BulkUserUploadLog.find({ uploadId }).sort({
      rowNumber: 1,
    });
    if (!logs.length) {
      const parentJob = await BulkUserUpload.findById(uploadId);
      if (!parentJob) {
        return res.status(404).json({ msg: "Upload job not found." });
      }
    }
    return res
      .status(200)
      .json({ data: logs, msg: "Successfully fetched log details." });
  } catch (error) {
    console.error("Fetch Log Details Error:", error);
    return res.status(500).json({ msg: ISE });
  }
};

export default {
  userList,
  updatePassword,
  userSearch,
  createUser,
  editUser,
  deleteUser,
  bulkUploadUsers,
  getUploadLogDetails,
  getUploadHistory,
};
