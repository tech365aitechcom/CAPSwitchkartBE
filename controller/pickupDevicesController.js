import devicesLot from "../models/devicesLotModel.js";
import UsersModel from "../models/UsersModel.js";
import mongoose from "mongoose";
import moment from "moment";
const StoreErr = "Request Missing Store Info";
const PickDelivered = "Pickup Delivered At Warehouse"; //Technican
const ApprovDelivery = "Approved Delivery At Warehouse"; //Admin Manager
const FinalStatus = "Payment Confirmed"; //Admin Manager
const DevList = "$deviceList";
const LeadData = "$leadsData";
const LeadDataUID = "leadsData.userId";
const UserDataSID = "userData.storeId";
const StrData = "$storeData";
const lotsPipe = [
  {
    $addFields: {
      firstDeviceId: { $arrayElemAt: [DevList, 0] },
    },
  },
  {
    $lookup: {
      from: "leads",
      localField: "firstDeviceId",
      foreignField: "_id",
      as: "leadsData",
    },
  },
  {
    $unwind: LeadData,
  },
  {
    $lookup: {
      from: "users",
      localField: LeadDataUID,
      foreignField: "_id",
      as: "userData",
    },
  },
  {
    $unwind: "$userData",
  },
  {
    $lookup: {
      from: "stores",
      localField: UserDataSID,
      foreignField: "_id",
      as: "storeData",
    },
  },
  {
    $unwind: StrData,
  },
  { $sort: { updatedAt: -1 } },
];

const LotsProject = [
  {
    $project: {
      leadsData: 0,
      storeData: 0,
      userData: 0,
    },
  },
];

const LotsByIDPipe = [
  {
    $unwind: DevList,
  },
  {
    $lookup: {
      from: "leads",
      localField: "deviceList",
      foreignField: "_id",
      as: "leadsData",
    },
  },
  {
    $unwind: LeadData,
  },
  {
    $lookup: {
      from: "users",
      localField: LeadDataUID,
      foreignField: "_id",
      as: "userData",
    },
  },
  {
    $unwind: "$userData", // Unwind the array created by $lookup
  },
  {
    $lookup: {
      from: "stores",
      foreignField: "_id",
      localField: "userData.storeId",
      as: "storeData",
    },
  },
  {
    $unwind: "$storeData", // Unwind the array created by $lookup
  },
  {
    $lookup: {
      from: "models",
      foreignField: "_id",
      localField: "leadsData.modelId",
      as: "modelData",
    },
  },
  {
    $unwind: "$modelData",
  },
  {
    $lookup: {
      from: "categories",
      localField: "type",
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
      foreignField: "_id",
      localField: "leadsData.documentId",
      as: "docData",
    },
  },
  {
    $unwind: "$docData",
  },
  { $sort: { "leadsData.createdAt": -1 } },
  {
    $project: {
      _id: "$leadsData._id",
      location: {
        $concat: ["$storeData.storeName", " - ", "$storeData.region"],
      },
      modelName: "$modelData.name",
      ramConfig: "$modelData.config",
      imei: "$docData.IMEI",
      leadsData: {
        $mergeObjects: ["$leadsData", { price: "$leadsData.price" }],
      },
    },
  },
];

const allLots = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await UsersModel.findById(userId).select("role storeId");
    if (!user) {
      return res.status(403).json({ msg: "Forbidden" });
    }
    const isSuperAdmin = user.role === "Super Admin";
    const qrole = req.query.userRole || "Admin";

    // Determine status filter
    let matchCriteria = { status: { $ne: ApprovDelivery } };
    if (qrole !== "Admin") {
      matchCriteria = {
        status: { $nin: [FinalStatus, ApprovDelivery, PickDelivered] },
      };
    }

    const pipeline = [{ $match: matchCriteria }, ...lotsPipe];

    if (isSuperAdmin) {
      const qregion = req.query.region;
      const qstoreName = req.query.storeName;
      if (qregion) pipeline.push({ $match: { "storeData.region": qregion } });
      if (qstoreName)
        pipeline.push({ $match: { "storeData.storeName": qstoreName } });
    } else {
      if (!user.storeId)
        return res
          .status(200)
          .json({ data: [], message: "User not assigned to a store." });
      pipeline.push({ $match: { "storeData._id": user.storeId } });
    }

    pipeline.push(...LotsProject);

    const lotsList = await devicesLot.aggregate(pipeline);
    return res
      .status(200)
      .json({ data: lotsList, message: "Successfully sent Lots" });
  } catch (error) {
    console.error("Error in allLots:", error);
    return res
      .status(500)
      .json({ msg: "Something went wrong, couldn't find Lots" });
  }
};

const searchLots = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await UsersModel.findById(userId).select("role storeId");
    if (!user) return res.status(403).json({ msg: "Forbidden" });
    const isSuperAdmin = user.role === "Super Admin";

    const { rid = "", date = "" } = req.query;
    const qrole = req.query.userRole || "Admin";

    let matchCriteria = { status: { $ne: ApprovDelivery } };
    if (qrole !== "Admin") {
      matchCriteria = {
        status: { $nin: [FinalStatus, ApprovDelivery, PickDelivered] },
      };
    }

    const pipeline = [
      { $match: matchCriteria },
      ...lotsPipe,
      {
        $addFields: {
          tempId: { $toString: "$_id" },
          tempDate: {
            $dateToString: { format: "%d/%m/%Y", date: "$createdAt" },
          },
        },
      },
      {
        $match: {
          uniqueCode: { $regex: "^" + rid, $options: "i" },
          tempDate: { $regex: "^" + date, $options: "i" },
        },
      },
    ];

    if (isSuperAdmin) {
      const { region, storeName } = req.query;
      if (region) pipeline.push({ $match: { "storeData.region": region } });
      if (storeName)
        pipeline.push({ $match: { "storeData.storeName": storeName } });
    } else {
      if (!user.storeId)
        return res
          .status(200)
          .json({ data: [], message: "User not assigned to a store." });
      pipeline.push({ $match: { "storeData._id": user.storeId } });
    }

    pipeline.push(...LotsProject);
    const lotData = await devicesLot.aggregate(pipeline);
    return res
      .status(200)
      .json({ data: lotData, msg: "Successfully searched data" });
  } catch (error) {
    console.error("Error in searchLots:", error);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
};

const lotsHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await UsersModel.findById(userId).select("role storeId");
    if (!user) return res.status(403).json({ msg: "Forbidden" });
    const isSuperAdmin = user.role === "Super Admin";

    const qrole = req.query.userRole || "Admin";
    let matchCriteria = { status: ApprovDelivery };
    if (qrole !== "Admin") {
      matchCriteria = {
        status: { $in: [FinalStatus, ApprovDelivery, PickDelivered] },
      };
    }

    const pipeline = [{ $match: matchCriteria }, ...lotsPipe];

    if (isSuperAdmin) {
      const { region, storeName } = req.query;
      if (region) pipeline.push({ $match: { "storeData.region": region } });
      if (storeName)
        pipeline.push({ $match: { "storeData.storeName": storeName } });
    } else {
      if (!user.storeId)
        return res
          .status(200)
          .json({ data: [], message: "User not assigned to a store." });
      pipeline.push({ $match: { "storeData._id": user.storeId } });
    }

    pipeline.push(...LotsProject);
    const lotsList = await devicesLot.aggregate(pipeline);
    return res
      .status(200)
      .json({ data: lotsList, message: "Successfully sent Lots History" });
  } catch (error) {
    console.error("Error in lotsHistory:", error);
    return res
      .status(500)
      .json({ msg: "Something went wrong, couldn't find Lots History" });
  }
};

const updateStatus = async (req, res) => {
  const { refIDs, newStatus } = req.body;
  let updateDevice;
  try {
    updateDevice = await devicesLot.updateMany(
      { _id: { $in: refIDs } },
      { $set: { status: newStatus } }
    );
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Updating lot's status failed, Please try again." });
  }
  return res
    .status(200)
    .json({ data: updateDevice, message: "Successfully updated lots status" });
};

const devicesList = async (req, res) => {
  const refId = req.params.rid;
  let deviceList;

  try {
    deviceList = await devicesLot.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(refId) },
      },
      ...LotsByIDPipe,
    ]);
  } catch (error) {
    return res
      .status(500)
      .json({ msg: "Something went wrong, couldn't find devices" });
  }

  return res
    .status(200)
    .json({ data: deviceList, message: "Successfully sended devicesList" });
};

const technicianReport = async (req, res) => {
  try {
    const loggedInUser = await UsersModel.findById(req.userId).select(
      "role storeId"
    );
    if (!loggedInUser) {
      return res.status(403).json({ msg: "Forbidden: User not found." });
    }
    const isSuperAdmin = loggedInUser.role === "Super Admin";

    const { search, fromdate, todate } = req.query;

    const match = {};
    if (fromdate && todate) {
      match.updatedAt = {
        $gte: moment(fromdate).startOf("day").toDate(),
        $lte: moment(todate).endOf("day").toDate(),
      };
    }

    const pipeline = [
      { $match: match },
      !isSuperAdmin && { $match: { storeId: loggedInUser.storeId } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            userId: "$userId",
            storeId: "$storeId",
          },
          totalDevice: { $sum: "$totalDevice" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "stores",
          localField: "_id.storeId",
          foreignField: "_id",
          as: "store",
        },
      },
      { $unwind: "$store" },
      search && {
        $match: {
          $or: [
            { "user.name": { $regex: search, $options: "i" } },
            { "store.storeName": { $regex: search, $options: "i" } },
          ],
        },
      },
      { $sort: { "_id.date": -1 } },
      {
        $project: {
          _id: 1,
          totalDevice: 1,
          "user.firstName": 1,
          "user.lastName": 1,
          "user.name": 1,
          "store.storeName": 1,
        },
      },
    ].filter(Boolean);

    const result = await devicesLot.aggregate(pipeline);
    return res.status(200).json(result);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: err.toString() });
  }
};

export default {
  allLots,
  searchLots,
  updateStatus,
  devicesList,
  lotsHistory,
  technicianReport,
  LotsByIDPipe,
};
