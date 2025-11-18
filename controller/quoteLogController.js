import QuoteLogModel from "../models/QuoteLogMode.js";
import UsersModel from "../models/UsersModel.js";
import mongoose from "mongoose";
import { Parser } from "json2csv";

const validateLogAttemptPayload = (body) => {
  const { quoteType, quoteAmount, grade, deviceDetails } = body;
  if (!quoteType)
    return { isValid: false, error: "Missing required field: quoteType." };
  if (quoteAmount === undefined || quoteAmount === null)
    return { isValid: false, error: "Missing required field: quoteAmount." };
  if (!deviceDetails || typeof deviceDetails !== "object")
    return {
      isValid: false,
      error: "Missing or invalid field: deviceDetails.",
    };
  if (!["QuickQuote", "Get Exact Value", "SavedQuote"].includes(quoteType))
    return { isValid: false, error: "Invalid value for quoteType." };
  if (typeof quoteAmount !== "number" || quoteAmount < 0)
    return {
      isValid: false,
      error: "quoteAmount must be a non-negative number.",
    };
  const { modelId, name, brandId, categoryName, ram, rom, series } =
    deviceDetails;
  if (!modelId)
    return {
      isValid: false,
      error: "Missing required field in deviceDetails: modelId.",
    };
  if (!name)
    return {
      isValid: false,
      error: "Missing required field in deviceDetails: name.",
    };
  if (!brandId)
    return {
      isValid: false,
      error: "Missing required field in deviceDetails: brandId.",
    };
  if (!categoryName)
    return {
      isValid: false,
      error: "Missing required field in deviceDetails: categoryName.",
    };
  if (!ram)
    return {
      isValid: false,
      error: "Missing required field in deviceDetails: ram.",
    };
  if (!rom)
    return {
      isValid: false,
      error: "Missing required field in deviceDetails: rom.",
    };
  if (!series)
    return {
      isValid: false,
      error: "Missing required field in deviceDetails: series.",
    };

  const validatedValue = {
    quoteType,
    quoteAmount,
    grade: grade || null,
    deviceDetails: { modelId, name, brandId, categoryName, ram, rom, series },
  };
  return { isValid: true, error: null, validatedValue };
};

const logQuoteAttempt = async (req, res) => {
  const { isValid, error, validatedValue } = validateLogAttemptPayload(
    req.body
  );
  if (!isValid) {
    return res.status(400).json({ message: error });
  }
  try {
    const authenticatedUserId = req.userId;
    if (!authenticatedUserId) {
      return res.status(401).json({
        message:
          "Authentication error: User ID not found after token verification.",
      });
    }
    const user = await UsersModel.findById(authenticatedUserId).select(
      "storeId"
    );

    if (!user) {
      return res.status(404).json({ message: "Authenticated user not found." });
    }
    const newLogObject = {
      ...validatedValue,
      userId: new mongoose.Types.ObjectId(authenticatedUserId),
      storeId: user.storeId,
    };
    const newLog = new QuoteLogModel(newLogObject);
    await newLog.save();
    res.status(201).json({ message: "Quote attempt logged successfully." });
  } catch (error) {
    console.error("Error in logQuoteAttempt:", error);
    res.status(500).json({
      message: "An internal server error occurred.",
      error: { name: error.name, message: error.message },
    });
  }
};


const getDateRange = (range) => {
  const start = new Date();
  const end = new Date();
  switch (range) {
    case "Today":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "Yesterday":
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case "Last 7 Days":
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "1 Month":
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      return null;
  }
  return { $gte: start, $lte: end };
};


const buildMatchStage = async (req) => {
  const { dateRange, search = "", storeId } = req.query;
  const matchStage = {};

  const dateFilter = getDateRange(dateRange);
  if (dateFilter) {
    matchStage.timestamp = dateFilter;
  }

  const authenticatedUser = await UsersModel.findById(req.userId).select(
    "role storeId"
  );
  if (!authenticatedUser) {
    throw new Error("Authenticated user not found in database.");
  }

  if (authenticatedUser.role !== "Super Admin") {
    if (!authenticatedUser.storeId) {
      matchStage.storeId = new mongoose.Types.ObjectId(); 
    } else {
      matchStage.storeId = authenticatedUser.storeId;
    }
  } else if (storeId) {
    matchStage.storeId = new mongoose.Types.ObjectId(storeId);
  }

  if (search) {
    const userFilter = { email: { $regex: search, $options: "i" } };
    if (matchStage.storeId) {
      userFilter.storeId = matchStage.storeId;
    }
    const searchedUsers = await UsersModel.find(userFilter).select("_id");
    matchStage.userId = { $in: searchedUsers.map((u) => u._id) };
  }

  return matchStage;
};


const getQuoteTrackingData = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  try {
    const matchStage = await buildMatchStage(req);

    const aggregationResult = await QuoteLogModel.aggregate([
      { $match: matchStage },
      { $sort: { timestamp: -1 } },
      {
        $facet: {
          paginatedData: [
            {
              $group: {
                _id: "$userId",
                totalQuotes: {
                  $sum: {
                    $cond: [{ $eq: ["$quoteType", "Get Exact Value"] }, 1, 0],
                  },
                },
                totalQuickQuotes: {
                  $sum: {
                    $cond: [{ $eq: ["$quoteType", "QuickQuote"] }, 1, 0],
                  },
                },
                sumOfAllQuotes: { $sum: "$quoteAmount" },
                lastActivityDate: { $max: "$timestamp" },
                lastDevice: { $first: "$deviceDetails" },
              },
            },
            { $sort: { lastActivityDate: -1 } },
            { $skip: (pageNum - 1) * limitNum },
            { $limit: limitNum },
            {
              $lookup: {
                from: "brands",
                localField: "lastDevice.brandId",
                foreignField: "_id",
                as: "brandInfo",
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "userInfo",
              },
            },
            {
              $lookup: {
                from: "stores",
                localField: "userInfo.storeId",
                foreignField: "_id",
                as: "storeInfo",
              },
            },
            { $unwind: "$userInfo" },
            {
              $unwind: { path: "$storeInfo", preserveNullAndEmptyArrays: true },
            },
            {
              $unwind: { path: "$brandInfo", preserveNullAndEmptyArrays: true },
            },
            {
              $project: {
                _id: 0,
                userId: "$userInfo._id", 
                email: "$userInfo.email", 
                role: "$userInfo.role",
                storeName: "$storeInfo.storeName",
                totalQuotes: "$totalQuotes",
                totalQuickQuotes: "$totalQuickQuotes",
                sumOfAllQuotes: "$sumOfAllQuotes",
                lastActivityDate: "$lastActivityDate",
                deviceNameAndCategory: "$lastDevice.name",
                brand: "$brandInfo.name",
                deviceDetails: {
                  ram: "$lastDevice.ram",
                  rom: "$lastDevice.rom",
                },
              },
            },
          ],
          totalCount: [{ $group: { _id: "$userId" } }, { $count: "count" }],
        },
      },
    ]);

    const data = aggregationResult[0].paginatedData;
    const totalRecords = aggregationResult[0].totalCount[0]?.count || 0;

    res.status(200).json({
      data,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum),
        totalRecords,
      },
    });
  } catch (error) {
    console.error("Error fetching tracking data:", error);
    res.status(500).json({ message: "Server error fetching dashboard data." });
  }
};


const getUserActivityLog = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const targetUser = await UsersModel.findById(targetUserId).select(
      "storeId"
    );
    if (!targetUser) {
      return res.status(404).json({ message: "Target user not found." });
    }

    const authenticatedUser = await UsersModel.findById(req.userId).select(
      "role storeId"
    );
    if (!authenticatedUser) {
      return res
        .status(403)
        .json({ message: "Forbidden: Authenticated user not found." });
    }

    if (authenticatedUser.role !== "Super Admin") {
      if (
        !authenticatedUser.storeId ||
        !targetUser.storeId ||
        !authenticatedUser.storeId.equals(targetUser.storeId)
      ) {
        return res.status(403).json({
          message:
            "Forbidden: You can only view activity logs for users within your own store.",
        });
      }
    }

    const logs = await QuoteLogModel.find({ userId: targetUser._id })
      .sort({ timestamp: -1 })
      .select("timestamp deviceDetails quoteType quoteAmount -_id");

    res.status(200).json({ logs });
  } catch (error) {
    console.error("Error fetching activity log:", error);
    res.status(500).json({ message: "Server error." });
  }
};


const downloadQuoteTrackingData = async (req, res) => {
  try {
    const matchStage = await buildMatchStage(req);
    const fullData = await QuoteLogModel.aggregate([
      { $match: matchStage },
      { $sort: { lastActivityDate: -1 } },
      {
        $group: {
          _id: "$userId",
          totalQuotes: {
            $sum: { $cond: [{ $eq: ["$quoteType", "Get Exact Value"] }, 1, 0] },
          },
          totalQuickQuotes: {
            $sum: { $cond: [{ $eq: ["$quoteType", "QuickQuote"] }, 1, 0] },
          },
          sumOfAllQuotes: { $sum: "$quoteAmount" },
          lastActivityDate: { $max: "$timestamp" },
          lastDevice: { $first: "$deviceDetails" },
        },
      },
      { $sort: { lastActivityDate: -1 } },
      {
        $lookup: {
          from: "brands",
          localField: "lastDevice.brandId",
          foreignField: "_id",
          as: "brandInfo",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $lookup: {
          from: "stores",
          localField: "userInfo.storeId",
          foreignField: "_id",
          as: "storeInfo",
        },
      },
      { $unwind: "$userInfo" },
      { $unwind: { path: "$storeInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$brandInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId: "$userInfo.email",
          role: "$userInfo.role",
          storeName: "$storeInfo.storeName",
          totalQuotes: "$totalQuotes",
          totalQuickQuotes: "$totalQuickQuotes",
          sumOfAllQuotes: "$sumOfAllQuotes",
          lastActivityDate: "$lastActivityDate",
          deviceNameAndCategory: "$lastDevice.name",
          brand: "$brandInfo.name",
          ram: "$lastDevice.ram",
          rom: "$lastDevice.rom",
          series: "$lastDevice.series",
        },
      },
    ]);

    if (fullData.length === 0) {
      return res
        .status(404)
        .send("No data to export for the selected filters.");
    }

    const fields = [
      { label: "User ID", value: "userId" },
      { label: "Role", value: "role" },
      { label: "Store Name", value: "storeName" },
      { label: "Total Quotes", value: "totalQuotes" },
      { label: "Total Quick Quotes", value: "totalQuickQuotes" },
      { label: "Sum of Quote Amount", value: "sumOfAllQuotes" },
      {
        label: "Last Activity",
        value: (row) => new Date(row.lastActivityDate).toLocaleString("en-IN"),
      },
      { label: "Device Name and Category", value: "deviceNameAndCategory" },
      { label: "Brand", value: "brand" },
      { label: "RAM", value: "ram" },
      { label: "ROM", value: "rom" },
      { label: "Series", value: "series" },
    ];

    const json2csvParser = new Parser({ fields, withBOM: true });
    const csv = json2csvParser.parse(fullData);
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("quote_tracking_report.csv");
    return res.send(csv);
  } catch (error) {
    console.error("Error generating CSV:", error);
    res.status(500).json({ message: "Failed to generate CSV report." });
  }
};

export default {
  logQuoteAttempt,
  getQuoteTrackingData,
  getUserActivityLog,
  downloadQuoteTrackingData,
};
