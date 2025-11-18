import mongoose from "mongoose";
import leads from "../models/leadsModel.js";
import { CORE2 } from "../const.js";
import condtionCodesWatch from "../models/conditionCodesWatchModel.js";
import phoneCondition from "../models/phoneConditon.js";
import gradeprices from "../models/gradePriceModel.js";
import leadLifecycle from "../models/LeadLifecycle.js";
import timeRangeCal from "../utils/timeRangeCal.js";
import UsersModel from "../models/UsersModel.js";

//grade list
const convertGrade = (grade) => {
  const grades = {
    "A+": "A_PLUS",
    A: "A",
    B: "B",
    "B-": "B_MINUS",
    "C+": "C_PLUS",
    C: "C",
    "C-": "C_MINUS",
    "D+": "D_PLUS",
    D: "D",
    "D-": "D_MINUS",
    E: "E",
  };
  return grades[grade];
};

const userDocPipe = [
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "userId",
    },
  },
  {
    $unwind: {
      path: "$userId",
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: "documents",
      localField: "documentId",
      foreignField: "_id",
      as: "documentId",
    },
  },
  {
    $unwind: {
      path: "$documentId",
      preserveNullAndEmptyArrays: true,
    },
  },
];

const modelStorePipe = [
  {
    $lookup: {
      from: "models",
      localField: "modelId",
      foreignField: "_id",
      as: "modelId",
    },
  },
  {
    $unwind: {
      path: "$modelId",
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: "stores",
      localField: "userId.storeId",
      foreignField: "_id",
      as: "store",
    },
  },
  {
    $unwind: {
      path: "$store",
      preserveNullAndEmptyArrays: true,
    },
  },
];

const findAll = async (req, res) => {
  try {
    const loggedInUser = await UsersModel.findById(req.userId).select(
      "role storeId"
    );
    if (!loggedInUser) {
      return res.status(403).json({ message: "Forbidden: User not found." });
    }
    const isSuperAdmin = loggedInUser.role === "Super Admin";
    const page = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 10;
    const {
      rid = "",
      customerPhone = "",
      deviceType = "CTG1",
      filter,
      grestRec,
      userId,
      is_selled,
      id,
    } = req.query;
    let { store } = req.query;
    const { startDate, endDate } = timeRangeCal.timeRangeCal(
      filter,
      req.query.startDate,
      req.query.endDate
    );

    if (!isSuperAdmin) {
      if (!loggedInUser.storeId) {
        console.log(
          `User ${req.userId} has no store. Returning empty results for findAll.`
        );
        return res.status(200).json({
          data: [],
          totalCounts: 0,
          message: "User not assigned to a store.",
        });
      }
      store = loggedInUser.storeId.toString();
      console.log(
        `🔒 findAll restricted to store: ${store} for user ${req.userId}`
      );
    }

    const query = buildQuery(id, null, userId, is_selled, startDate, endDate);
    const aggregationPipeline = buildAggregationPipeline(
      query,
      rid,
      customerPhone,
      deviceType,
      grestRec,
      store,
      id
    );

    if (id) {
      return fetchSingleLead(res, aggregationPipeline);
    }

    return fetchMultipleLeads(res, aggregationPipeline, page, limit);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};
const findAlled = async (req, res) => {
  try {
    const loggedInUser = await UsersModel.findById(req.userId).select(
      "role storeId"
    );
    if (!loggedInUser) {
      return res.status(403).json({ message: "Forbidden: User not found." });
    }
    const isSuperAdmin = loggedInUser.role === "Super Admin";
    const page = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 10;
    const {
      rid = "",
      customerPhone = "",
      deviceType = "CTG1",
      filter,
      grestRec,
      userId,
      is_selled,
      id,
    } = req.query;
    let { store } = req.query;
    const { startDate, endDate } = timeRangeCal.timeRangeCal(
      filter,
      req.query.startDate,
      req.query.endDate
    );

    if (!isSuperAdmin) {
      if (!loggedInUser.storeId) {
        console.log(
          `User ${req.userId} has no store. Returning empty results for findAll.`
        );
        return res.status(200).json({
          data: [],
          totalCounts: 0,
          message: "User not assigned to a store.",
        });
      }
      store = loggedInUser.storeId.toString();
      console.log(
        `🔒 findAll restricted to store: ${store} for user ${req.userId}`
      );
    }

    const query = buildQuery(id, null, userId, is_selled, startDate, endDate);
    const aggregationPipeline = buildSelledPipeline(
      query,
      rid,
      customerPhone,
      deviceType,
      grestRec,
      store,
      id
    );

    if (id) {
      return fetchSingleLead(res, aggregationPipeline);
    }

    return fetchMultipleLeads(res, aggregationPipeline, page, limit);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

const buildQuery = (id, customerId, userId, isSelled, startDate, endDate) => {
  const query = {
    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
  };
  if (id) {
    query._id = new mongoose.Types.ObjectId(id);
  }
  if (customerId) {
    query._id = new mongoose.Types.ObjectId(customerId);
  }
  if (userId) {
    query.userId = new mongoose.Types.ObjectId(userId);
  }
  if (isSelled) {
    query.is_selled = true;
  }
  return query;
};

const buildAggregationPipeline = (
  query,
  rid,
  customerPhone,
  deviceType,
  grestRec,
  store,
  id
) => {
  const pipeline = [
    { $match: query },
    ...userDocPipe,
    ...modelStorePipe,
    {
      $lookup: {
        from: "deviceslots",
        localField: "_id",
        foreignField: "deviceList",
        as: "lotInfo",
      },
    },
    { $unwind: { path: "$lotInfo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "categories",
        localField: "modelId.type",
        foreignField: "categoryCode",
        as: "categoryInfo",
      },
    },
    { $unwind: "$categoryInfo" },
    { $addFields: { price: { $add: ["$price", "$bonusPrice"] } } },
    { $addFields: { price: "$price" } },
    {
      $addFields: {
        grestReceived: {
          $cond: [
            { $eq: ["$lotInfo.status", "Pickup Confirmed"] },
            "yes",
            "no",
          ],
        },
      },
    },
    {
      $addFields: {
        grestRecDate: {
          $cond: [
            { $eq: ["$lotInfo.status", "Pickup Confirmed"] },
            "$lotInfo.updatedAt",
            null,
          ],
        },
      },
    },
  ];

  if (!id) {
    pipeline.push({
      $match: {
        $or: [
          { "modelId.name": { $regex: rid, $options: "i" } },
          { uniqueCode: { $regex: rid, $options: "i" } },
          { "documentId.IMEI": { $regex: rid, $options: "i" } },
          { "userId.name": { $regex: rid, $options: "i" } },
          { "userId.firstName": { $regex: rid, $options: "i" } },
        ],
      },
    });

    pipeline.push({
      $match: {
        $or: [
          { name: { $regex: customerPhone, $options: "i" } },
          { phoneNumber: { $regex: customerPhone, $options: "i" } },
          { emailId: { $regex: customerPhone, $options: "i" } },
        ],
      },
    });

    pipeline.push({ $match: { "modelId.type": deviceType } });
    if (grestRec) {
      pipeline.push({ $match: { grestReceived: grestRec } });
    }
    if (store) {
      pipeline.push({
        $match: { "userId.storeId": new mongoose.Types.ObjectId(store) },
      });
    }
  }

  return pipeline;
};

const buildSelledPipeline = (
  query,
  rid,
  customerPhone,
  deviceType,
  grestRec,
  store,
  id
) => {
  const pipeline = [
    { $match: query },
    ...userDocPipe,
    ...modelStorePipe,
    {
      $lookup: {
        from: "deviceslots",
        localField: "_id",
        foreignField: "deviceList",
        as: "lotInfo",
      },
    },
    { $unwind: { path: "$lotInfo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "categories",
        localField: "modelId.type",
        foreignField: "categoryCode",
        as: "categoryInfo",
      },
    },
    { $unwind: "$categoryInfo" },
    { $addFields: { price: { $add: ["$price"] } } },
    {
      $addFields: {
        grestReceived: {
          $cond: [
            { $eq: ["$lotInfo.status", "Pickup Confirmed"] },
            "yes",
            "no",
          ],
        },
      },
    },
    {
      $addFields: {
        grestRecDate: {
          $cond: [
            { $eq: ["$lotInfo.status", "Pickup Confirmed"] },
            "$lotInfo.updatedAt",
            null,
          ],
        },
      },
    },
  ];

  if (!id) {
    pipeline.push({
      $match: {
        $or: [
          { "modelId.name": { $regex: rid, $options: "i" } },
          { uniqueCode: { $regex: rid, $options: "i" } },
          { "documentId.IMEI": { $regex: rid, $options: "i" } },
          { "userId.name": { $regex: rid, $options: "i" } },
          { "userId.firstName": { $regex: rid, $options: "i" } },
        ],
      },
    });

    pipeline.push({
      $match: {
        $or: [
          { name: { $regex: customerPhone, $options: "i" } },
          { phoneNumber: { $regex: customerPhone, $options: "i" } },
          { emailId: { $regex: customerPhone, $options: "i" } },
        ],
      },
    });

    pipeline.push({ $match: { "modelId.type": deviceType } });
    if (grestRec) {
      pipeline.push({ $match: { grestReceived: grestRec } });
    }
    if (store) {
      pipeline.push({
        $match: { "userId.storeId": new mongoose.Types.ObjectId(store) },
      });
    }
  }

  return pipeline;
};

const fetchSingleLead = async (res, pipeline) => {
  const data = await leads.aggregate(pipeline);
  return res.status(200).json({
    data: data.length ? data[0] : null,
    message: data.length ? "Lead fetched successfully." : "Lead not found.",
  });
};
const getLeadById = async (id) => {
  const { startDate, endDate } = timeRangeCal.timeRangeCal("all");
  const query = buildQuery(id, null, null, null, startDate, endDate);
  const pipeline = buildAggregationPipeline(
    query,
    "",
    "",
    "CTG1",
    null,
    null,
    id
  );
  const data = await leads.aggregate(pipeline);
  return data.length ? data[0] : null;
};

const fetchMultipleLeads = async (res, pipeline, page, limit) => {
  const skip = parseInt(page) * parseInt(limit);
  const countResult = await leads.aggregate(
    [...pipeline, { $count: "totalCounts" }],
    { allowDiskUse: true }
  );
  const totalCounts = countResult.length ? countResult[0].totalCounts : 0;

  pipeline.push(
    { $sort: { updatedAt: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) }
  );

  const data = await leads.aggregate(pipeline, { allowDiskUse: true });
  return res
    .status(200)
    .json({ data, totalCounts, message: "Leads fetched successfully." });
};

const findAllSelled = async (req, res) => {
  req.query.is_selled = true;
  await findAlled(req, res);
};

const findLeadById = async (req, res) => {
  await findAll(req, res);
};

//this api for calculate price from admin panel
function checkKeysValidity(keys, adminAnswer) {
  let error = false;
  keys.forEach((key) => {
    if (!adminAnswer.hasOwnProperty(key) || adminAnswer[key] === "") {
      console.error(`Missing or empty key: ${key}`);
      error = true;
    }
  });
  return error;
}

const calculatePriceAdminWatch = async (req, res) => {
  const { adminAnswer } = req.body;
  const keys = [
    "MobileID",
    "Warranty",
    "Accessories",
    "Functional",
    "Physical",
  ];

  if (checkKeysValidity(keys, adminAnswer)) {
    return res.status(403).json({
      success: false,
      message: "QNA, modelId are required",
    });
  }

  const modelID = adminAnswer?.MobileID;
  const query = {
    warrentyCode: adminAnswer?.Warranty,
    accessoriesCode: adminAnswer?.Accessories,
    functionalCode: adminAnswer?.Functional,
    cosmeticsCode: adminAnswer?.Physical,
  };

  const gradeData = await condtionCodesWatch.findOne(query).select("grade");
  const priceData = await gradeprices
    .findOne({ modelId: modelID })
    .select("grades");
  const price = priceData.grades[convertGrade(gradeData.grade)];
  return res.status(200).json({
    data: { price, grade: gradeData.grade },
    message: "price fetched successfully.",
  });
};

const calculatePriceAdmin = async (req, res) => {
  try {
    const { adminAnswer } = req.body;

    const modelId = adminAnswer?.MobileID;
    const storage = adminAnswer?.storage;
    const RAM = adminAnswer?.ram;

    // Dynamically build the query object, excluding empty string values
    const query = Object.fromEntries(
      Object.entries({
        coreCode: adminAnswer?.Core,
        warrentyCode: adminAnswer?.Warranty,
        displayCode: adminAnswer?.Display,
        functionalMajorCode: adminAnswer?.Functional_major,
        functionalMinorCode: adminAnswer?.Functional_minor,
        cosmeticsCode: adminAnswer?.Cosmetics,
        accessoriesCode: adminAnswer?.Accessories,
        functionalCode: adminAnswer?.Functional,
      }).filter(([_, value]) => value !== "") // Exclude entries with empty string values
    );

    console.log(query);

    console.log("hi");
    console.log(query);

    const gradeData =
      query?.coreCode !== CORE2
        ? await phoneCondition
            .findOne(
              (() => {
                const { coreCode, ...filteredQuery } = query; // Destructure to exclude coreCode
                return filteredQuery; // Return query without coreCode
              })()
            )
            .select("grade")
        : { grade: "E" };

    const priceData = await gradeprices
      .findOne({
        modelId,
        $or: [
          { storage, RAM: RAM }, // Both storage and RAM match
          { storage, RAM: { $exists: false } }, // Only storage matches, RAM does not exist
          { storage: { $exists: false }, RAM: RAM }, // Only RAM matches, storage does not exist
          { storage: { $exists: false }, RAM: { $exists: false } }, // Neither storage nor RAM exists
        ],
      })
      .select("grades");

    const price =
      query?.coreCode === CORE2
        ? priceData.grades["E"]
        : priceData.grades[convertGrade(gradeData.grade)];

    return res.status(200).json({
      data: { price, grade: gradeData.grade },
      message: "price fetched successfully.",
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
};

const orderPipe = [
  {
    $lookup: {
      from: "users",
      localField: "userid",
      foreignField: "_id",
      as: "user",
    },
  },
  { $unwind: "$user" },
  {
    $lookup: {
      from: "leads",
      localField: "lead_id",
      foreignField: "_id",
      as: "lead",
    },
  },
  { $unwind: "$lead" },
  { $match: { "lead.is_selled": false } },
  {
    $lookup: {
      from: "models",
      localField: "lead.modelId",
      foreignField: "_id",
      as: "lead.model",
    },
  },
  { $unwind: "$lead.model" },
  {
    $lookup: {
      from: "categories",
      localField: "lead.model.type",
      foreignField: "categoryCode",
      as: "categoryInfo",
    },
  },
  {
    $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true },
  },
];

async function orderCreated(req, res) {
  try {
    const loggedInUser = await UsersModel.findById(req.userId).select(
      "role storeId"
    );
    if (!loggedInUser) {
      return res.status(403).json({ message: "Forbidden: User not found." });
    }
    const isSuperAdmin = loggedInUser.role === "Super Admin";

    const { time, search, fromdate, todate } = req.query;
    let { store } = req.query; // Use 'let' to allow modification

    if (!isSuperAdmin) {
      if (!loggedInUser.storeId) {
        console.log(
          `User ${req.userId} (Role: ${loggedInUser.role}) has no store. Returning empty report for orderCreated.`
        );
        return res
          .status(200)
          .json({ code: 200, data: { orderData: { count: 0, data: [] } } });
      }
      store = loggedInUser.storeId.toString();
      console.log(
        `🔒 orderCreated report for User ${req.userId} restricted to store: ${store}`
      );
    } else if (store) {
      console.log(
        `👑 Super Admin generating orderCreated report for store: ${store}`
      );
    } else {
      console.log(
        `👑 Super Admin generating orderCreated report for all stores.`
      );
    }

    const { startDate, endDate } = timeRangeCal.timeRangeCal(
      time,
      fromdate,
      todate
    );

    const aggregationPipeline = [...orderPipe, { $sort: { createdAt: -1 } }];
    if (search) {
      aggregationPipeline.push({
        $match: {
          $or: [
            { "lead.model.name": { $regex: search, $options: "i" } },
            { "lead.uniqueCode": { $regex: search, $options: "i" } },
            { "lead.name": { $regex: search, $options: "i" } },
            { "lead.phoneNumber": { $regex: search, $options: "i" } },
            { "lead.uniqueCode": { $regex: search, $options: "i" } },
            { "user.name": { $regex: search, $options: "i" } },
          ],
        },
      });
    }
    aggregationPipeline.push({
      $addFields: {
        "lead.price": { $add: ["$lead.price", "$lead.bonusPrice"] },
      },
    });
    if (store) {
      const storeId = new mongoose.Types.ObjectId(store);
      aggregationPipeline.push({
        $match: { "user.storeId": storeId },
      });
    }
    const query = [
      {
        $match: {
          eventType: "orderCreated",
          updatedAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
        },
      },
    ];

    const orders = await leadLifecycle.aggregate([
      ...query,
      ...aggregationPipeline,
    ]);

    const data = {
      orderData: {
        count: orders.length,
        data: orders,
      },
    };

    res.status(200).json({ code: 200, data });
  } catch (err) {
    console.error("Error in orderCreated:", err);
    res
      .status(500)
      .json({ code: 500, message: "An error occurred", error: err.toString() });
  }
}

async function QuoteCreated(req, res) {
  try {
    const loggedInUser = await UsersModel.findById(req.userId).select(
      "role storeId"
    );
    if (!loggedInUser) {
      return res.status(403).json({ message: "Forbidden: User not found." });
    }
    const isSuperAdmin = loggedInUser.role === "Super Admin";

    const search = req.query.search || "";
    const { time, fromdate, todate } = req.query;
    let { store } = req.query;

    if (!isSuperAdmin) {
      if (!loggedInUser.storeId) {
        console.log(
          `User ${req.userId} (Role: ${loggedInUser.role}) has no store. Returning empty report for QuoteCreated.`
        );
        return res
          .status(200)
          .json({ code: 200, data: { quoteData: { count: 0, data: [] } } });
      }
      store = loggedInUser.storeId.toString();
      console.log(
        `🔒 QuoteCreated report for User ${req.userId} restricted to store: ${store}`
      );
    } else if (store) {
      console.log(
        `👑 Super Admin generating QuoteCreated report for store: ${store}`
      );
    } else {
      console.log(
        `👑 Super Admin generating QuoteCreated report for all stores.`
      );
    }

    const { startDate, endDate } = timeRangeCal.timeRangeCal(
      time,
      fromdate,
      todate
    );
    const match = {
      eventType: "quoteCreated",
      updatedAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
    };

    const aggregationPipeline = [...orderPipe, { $sort: { createdAt: -1 } }];

    if (store) {
      const storeId = new mongoose.Types.ObjectId(store);
      aggregationPipeline.push({
        $match: { "user.storeId": storeId },
      });
    }

    if (search) {
      aggregationPipeline.push({
        $match: {
          $or: [
            { "lead.model.name": { $regex: search, $options: "i" } },
            { "lead.phoneNumber": { $regex: search, $options: "i" } },
            { "lead.emailId": { $regex: search, $options: "i" } },
            { "user.firstName": { $regex: search, $options: "i" } },
            { "lead.uniqueCode": { $regex: search, $options: "i" } },
            { "lead.name": { $regex: search, $options: "i" } },
            { "user.name": { $regex: search, $options: "i" } },
          ],
        },
      });
    }
    const query = [{ $match: match }];
    const quotes = await leadLifecycle.aggregate([
      ...query,
      ...aggregationPipeline,
    ]);

    const data = {
      quoteData: {
        count: quotes.length,
        data: quotes,
      },
    };

    res.status(200).json({ code: 200, data });
  } catch (err) {
    console.error("Error in QuoteCreated:", err);
    res
      .status(500)
      .json({ code: 500, message: "An error occurred", error: err.toString() });
  }
}

export default {
  findAlled,
  findAllSelled,
  findLeadById,
  calculatePriceAdmin,
  orderCreated,
  QuoteCreated,
  orderPipe,
  getLeadById,
};
