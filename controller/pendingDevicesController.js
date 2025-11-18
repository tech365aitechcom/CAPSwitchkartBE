import leads from "../models/leadsModel.js";
import devicesLot from "../models/devicesLotModel.js";
import outstandingLot from "../models/outstandingLotModel.js";
import UsersModel from "../models/UsersModel.js";

import mongoose from "mongoose";
// CR: Import user model to verify role and store assignment for access control.
const ISE = "Internal Server Error, Failed To Create New Lot";
const bonusPriceField = "$bonusPrice";
const getAllLeadsPipe = [
  {
    $match: {
      $and: [
        { is_selled: true },
        { status: { $ne: "Pending" } },
        { status: { $ne: "Completed" } },
      ],
    },
  },
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "userData",
    },
  },
  {
    $unwind: "$userData",
  },
  {
    $lookup: {
      from: "models",
      localField: "modelId",
      foreignField: "_id",
      as: "modelData",
    },
  },
  {
    $unwind: "$modelData",
  },
  {
    $lookup: {
      from: "categories",
      localField: "modelData.type",
      foreignField: "categoryCode",
      as: "categoryInfo",
    },
  },
  {
    $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true },
  },
  {
    $lookup: {
      from: "documents",
      localField: "documentId",
      foreignField: "_id",
      as: "docData",
    },
  },
  {
    $unwind: "$docData",
  },
  {
    $lookup: {
      from: "stores",
      localField: "userData.storeId",
      foreignField: "_id",
      as: "storeData",
    },
  },
  {
    $unwind: "$storeData",
  },
  { $sort: { updatedAt: -1 } },
];

const AllLeadsProjection = [
  {
    $project: {
      is_selled: 1,
      status: 1,
      modelId: 1,
      storage: 1,
      price: "$price",
      createdAt: 1,
      updatedAt: 1,
      modelName: "$modelData.name",
      ramConfig: "$modelData.config",
      location: "$storeData.region",
      imei: "$docData.IMEI",
      reason: 1,
      category: "$categoryInfo.categoryName",
    },
  },
  {
    $group: {
      _id: null,
      totalPrice: { $sum: "$price" },
      count: { $sum: 1 },
      documents: { $push: "$$ROOT" },
    },
  },
  {
    $project: {
      _id: 0,
      totalPrices: "$totalPrice",
      count: "$count",
      documents: 1,
    },
  },
];

const allDevices = async (req, res) => {
  const userId = req.userId;

  try {
    const user = await UsersModel.findById(userId).select("role storeId");
    if (!user) {
      return res.status(403).json({ msg: "Forbidden: User not found." });
    }

    const isSuperAdmin = user.role === "Super Admin";
    const matchConditions = { $and: [] };

    if (isSuperAdmin) {
      const qregion = req.query.region?.trim();
      const qstoreName = req.query.storeName?.trim();
      if (qregion) matchConditions.$and.push({ "storeData.region": qregion });
      if (qstoreName)
        matchConditions.$and.push({ "storeData.storeName": qstoreName });
    } else {
      if (!user.storeId) {
        return res
          .status(200)
          .json({ data: [], message: "User is not assigned to a store." });
      }
      matchConditions.$and.push({ "storeData._id": user.storeId });
    }

    if (matchConditions.$and.length === 0) {
      delete matchConditions.$and;
    }

    const fullPipeline = [
      ...getAllLeadsPipe,
      { $match: matchConditions },
      ...AllLeadsProjection,
    ];

    const deviceList = await leads.aggregate(fullPipeline);

    return res
      .status(200)
      .json({ data: deviceList, message: "Successfully Sent Devices" });
  } catch (err) {
    console.error("❌ Internal Error in allDevices:", err);
    return res
      .status(500)
      .json({ msg: "Internal Server Error, Failed To Find Devices" });
  }
};

const searchDevice = async (req, res) => {
  const { rid = "", date = "", status = "" } = req.query;
  // CR: Get userId from the request for security checks.
  const userId = req.userId;

  try {
    // CR: Fetch user's role and storeId.
    const user = await UsersModel.findById(userId).select("role storeId");
    if (!user) {
      return res.status(403).json({ msg: "Forbidden: User not found." });
    }
    const isSuperAdmin = user.role === "Super Admin";

    // CR: Build the main search conditions.
    const searchConditions = [
      {
        $or: [
          { tempId: { $regex: "^" + rid, $options: "i" } },
          { "modelData.name": { $regex: rid, $options: "i" } },
          { "docData.IMEI": { $regex: rid, $options: "i" } },
        ],
      },
      { tempDate: { $regex: "^" + date, $options: "i" } },
      { status: { $regex: "^" + status, $options: "i" } },
    ];

    // CR: Apply store-level restriction based on role.
    if (isSuperAdmin) {
      const qregion = req.query.region;
      const qstoreName = req.query.storeName;
      if (qregion) searchConditions.push({ "storeData.region": qregion });
      if (qstoreName)
        searchConditions.push({ "storeData.storeName": qstoreName });
    } else {
      if (!user.storeId) {
        return res
          .status(200)
          .json({ data: [], message: "User not assigned to a store" });
      }
      searchConditions.push({ "storeData._id": user.storeId });
    }

    const deviceList = await leads.aggregate([
      ...getAllLeadsPipe,
      {
        $addFields: {
          tempId: { $toString: "$_id" },
          tempDate: {
            $dateToString: { format: "%d/%m/%Y", date: "$createdAt" },
          },
        },
      },
      { $match: { $and: searchConditions } },
      ...AllLeadsProjection,
    ]);

    return res
      .status(200)
      .json({ data: deviceList, message: "Successfully Searched Devices" });
  } catch (err) {
    console.error("❌ Error in searchDevice:", err);
    return res
      .status(500)
      .json({ msg: "Internal Server Error, Failed To Search Devices" });
  }
};

// update status of lead
const updateStatus = async (req, res) => {
  const { deviceIDs, newStatus, reason } = req.body; //Here deviceIDs means devieStatus _id not lead id

  let updateDevice;
  try {
    updateDevice = await leads.updateMany(
      { _id: { $in: deviceIDs } },
      { $set: { status: newStatus, reason: reason } }
    );
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Updating status failed, Please try again." });
  }

  return res.status(200).json({
    data: updateDevice,
    message: "Successfully updated devices status",
  });
};

// create lot and add to outstanding page
const updateRequest = async (req, res) => {
  const { deviceIDs, newStatus } = req.body; //HEre id is lead _id

  let calculations;

  const newIDs = deviceIDs.map((el) => {
    return new mongoose.Types.ObjectId(el); //aggregation only take mdb obj type ids as a id
  });

  try {
    calculations = await leads.aggregate([
      { $match: { _id: { $in: newIDs } } },
      {
        $addFields: {
          correctPrice: { $add: ["$actualPrice"] },
        },
      },
      {
        $group: {
          _id: "000",
          totalSum: { $sum: "$ correctPrice" },
          count: { $sum: 1 },
        },
      },
    ]);
  } catch (error) {
    return res
      .status(500)
      .json({ msg: "Something went wrong, calculations failed" });
  }

  const createdDevicesLot = new outstandingLot({
    status: "Pending Payroll Approval",
    request: newStatus,
    totalDevice: calculations[0].count,
    totalAmount: calculations[0].totalSum,
    deviceList: deviceIDs,
  });

  try {
    await createdDevicesLot.save();
    try {
      await leads.updateMany(
        { _id: { $in: deviceIDs } },
        { $set: { status: "Pending" } }
      );
    } catch (error) {
      await outstandingLot.deleteOne({ _id: createdDevicesLot._id });
      return res.status(500).json({ msg: ISE });
    }
  } catch (error) {
    return res.status(500).json({ msg: ISE });
  }
  return res
    .status(200)
    .json({ data: createdDevicesLot, msg: "Successfully created new lot" });
};

const pickupRequest = async (req, res) => {
  let { deviceIDs, userid, storeid } = req.body;

  if (!deviceIDs || !Array.isArray(deviceIDs) || deviceIDs.length === 0) {
    return res
      .status(400)
      .json({ msg: "deviceIDs must be a non-empty array." });
  }

  let mappedDeviceIDs;
  try {
    mappedDeviceIDs = deviceIDs.map((el) => new mongoose.Types.ObjectId(el));
  } catch (error) {
    return res
      .status(400)
      .json({ msg: "Invalid format for one or more deviceIDs." });
  }

  const filteredDeviceIDs = await leads.distinct("_id", {
    status: { $ne: "Completed" },
    _id: { $in: mappedDeviceIDs },
  });

  if (filteredDeviceIDs.length === 0) {
    return res
      .status(404)
      .json({ msg: "No valid devices found to create a lot." });
  }
  let calculations;
  try {
    calculations = await leads.aggregate([
      {
        $match: { _id: { $in: filteredDeviceIDs } },
      },

      {
        $group: {
          _id: null,
          totalSum: { $sum: "$price" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (!calculations || calculations.length === 0) {
      throw new Error("Aggregation failed to produce a result.");
    }
  } catch (error) {
    return res
      .status(500)
      .json({ msg: "Something went wrong, calculations failed" });
  }

  let uniqueCode = process.env.UNIQUE_CODE_PREFIX || "GREST";
  try {
    const lastDoc = await devicesLot
      .findOne({ uniqueCode: { $ne: "" } })
      .sort({ createdAt: -1 });

    const inputString = req.storeName || process.env.STORE_NAME || "STORE";
    const words = inputString.split(" ");
    const firstCharacters = words.map((word) => word.charAt(0).toUpperCase());
    const resultString = firstCharacters.join("");

    if (lastDoc) {
      const numbersArray = lastDoc.uniqueCode.match(/\d+/g);
      const code = numbersArray
        ? Number(numbersArray[numbersArray.length - 1])
        : 0;
      const nextCode = (code + 1).toString().padStart(3, "0");
      uniqueCode = `${
        process.env.UNIQUE_CODE_SUBPREFIX || "PK"
      }${resultString}${nextCode}`;
    } else {
      uniqueCode = `${
        process.env.UNIQUE_CODE_SUBPREFIX || "PK"
      }${resultString}001`;
    }
  } catch (error) {
    return res
      .status(500)
      .json({ msg: "Failed to generate unique code for the lot." });
  }

  const lotData = {
    status: "Pending Payment Confirmation",
    totalDevice: calculations[0].count,
    totalAmount: calculations[0].totalSum,
    deviceList: filteredDeviceIDs,
    userId: userid,
    storeId: storeid,
    uniqueCode,
  };

  const createdDevicesLot = new devicesLot(lotData);
  try {
    await createdDevicesLot.save();

    try {
      await leads.updateMany(
        { _id: { $in: filteredDeviceIDs } },
        { $set: { status: "Completed" } }
      );
    } catch (error) {
      await devicesLot.deleteOne({ _id: createdDevicesLot._id });
      return res.status(500).json({
        msg: "Failed to update device statuses, operation rolled back.",
        error: error,
      });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ msg: "Failed to save the new lot.", error: error });
  }

  return res
    .status(200)
    .json({ data: createdDevicesLot, msg: "Successfully created new lot" });
};
export default {
  allDevices,
  searchDevice,
  updateStatus,
  updateRequest,
  pickupRequest,
};
