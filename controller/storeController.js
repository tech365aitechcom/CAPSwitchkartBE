import storeModel from "../models/storeModel.js";
import axios from "axios";
import xlsx from "xlsx";
import utils from "../utils/required.js";
import UsersModel from "../models/UsersModel.js";
import devicesLotModel from "../models/devicesLotModel.js";
import leadModel from "../models/leadsModel.js";
import timeRangeCal from "../utils/timeRangeCal.js";
import AWS from "aws-sdk";
const ISE = "Internal Server Error";

const create = async (req, res) => {
  const userId = req.userId;
  req.body.createdBy = userId;

  try {
    const { error } = utils.storeValidation(req.body);
    if (error) {
      return res.status(400).send({ message: error.details[0].message });
    }
    const lastDoc = await storeModel
      .findOne({ uniqueId: { $ne: "" } })
      .sort({ createdAt: -1 });
    let uniqueId = "STOREG100";
    if (lastDoc) {
      const numbersArray = lastDoc?.uniqueId?.match(/\d+/g);
      const code = numbersArray ? numbersArray.map(Number) : [];
      uniqueId = `STOREG${Number(code) + 1}`;
    }
    const result = await storeModel({
      storeName: req.body.storeName,
      uniqueId: uniqueId,
      email: req.body.email,
      contactNumber: req.body.contactNumber,
      region: req.body.region,
      address: req.body.address,
      createdBy: userId,
    }).save();
    return res.status(200).json({ result });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

const update = async (req, res) => {
  const userId = req.userId;
  req.body.updatedBy = userId;
  delete req.body.createdBy;

  try {
    const result = await storeModel.findByIdAndUpdate(
      { _id: req.body._id || req.body.id },
      req.body,
      { new: true }
    );
    return res.status(200).json({ result });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

const deleteById = async (req, res) => {
  try {
    const result = await storeModel.findByIdAndDelete({
      _id: req.query._id || req.query.id,
    });
    return res.status(200).json({ result });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

const findById = async (req, res) => {
  try {
    const storeData = await storeModel.findById({
      _id: req.query._id || req.query.id,
    });
    return res.status(200).json({ result: storeData });
  } catch (error) {
    return res.status(500).json({ message: ISE, status: 500 });
  }
};

const findAll = async (req, res) => {
  const userId = req.userId;
  try {
    const user = await UsersModel.findById(userId).select("role storeId");
    if (!user) {
      return res.status(403).json({ message: "Forbidden: User not found." });
    }

    if (user.role !== "Super Admin") {
      if (!user.storeId) {
        return res.status(200).json({ result: [], totalRecords: 0 });
      }
      const userStore = await storeModel.findById(user.storeId);
      return res.status(200).json({
        result: userStore ? [userStore] : [],
        totalRecords: userStore ? 1 : 0,
      });
    }

    const query = {};
    const search = req.query.search || "";
    const limit = parseInt(req.query.limit) || 9999;
    const page = parseInt(req.query.page) || 0;

    if (search) {
      query["$or"] = [
        { storeName: { $regex: search, $options: "i" } },
        { region: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { uniqueId: { $regex: search, $options: "i" } },
      ];
    }
    const allstore = await storeModel
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .skip(limit * page);

    const totalRecords = await storeModel.countDocuments(query);
    return res.status(200).json({ result: allstore, totalRecords });
  } catch (error) {
    return res.status(500).json({ message: ISE, status: 500 });
  }
};

const s3Bucket = new AWS.S3({
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
});

const parseS3Url = (url) => {
  const match = url.match(/^https:\/\/(.+)\.s3\.(.+)\.amazonaws\.com\/(.+)$/);
  if (!match) {
    throw new Error("Invalid S3 URL format");
  }
  const [, bucket, key] = match;
  return { bucket, key: decodeURIComponent(key) };
};

const fetchAndProcessFile = async (fileUrl) => {
  try {
    // Extract bucket and key from the S3 URL
    const { bucket, key } = parseS3Url(fileUrl);

    // Generate a signed URL that expires in 60 seconds
    const signedUrl = s3Bucket.getSignedUrl("getObject", {
      Bucket: bucket,
      Key: key,
      Expires: 60,
    });

    // Fetch the file using the signed URL
    const response = await axios.get(signedUrl, {
      responseType: "arraybuffer",
    });

    // Load and process the Excel file
    const workbook = xlsx.read(response.data, { type: "buffer" });
    const sheetNameList = workbook.SheetNames;

    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetNameList[0]], {
      defval: "",
    });
  } catch (error) {
    console.error("Error fetching or processing file:", error.message);
    throw new Error("Failed to fetch or process file");
  }
};

const uploadData = async (req, res) => {
  try {
    const userId = req.userId;
    const { fileUrl } = req.body; // Assume the URL is provided in the request body

    if (!fileUrl) {
      return res.status(400).json({ message: "No file URL provided" });
    }

    // Process the uploaded file using fetchAndProcessFile
    const stores = await fetchAndProcessFile(fileUrl);

    if (!stores || stores.length === 0) {
      return res.status(400).json({ message: "Empty or invalid file format" });
    }

    const updated = [];
    const inserted = [];

    for (const store of stores) {
      if (
        !store.storeName ||
        !store.region ||
        !store.email ||
        !store.uniqueId ||
        !store.contactNumber ||
        !store.address
      ) {
        return res.status(400).json({ message: "Invalid store data format" });
      }
      store.createdBy = userId;
      const exists = await storeModel.findOne({
        storeName: { $regex: store.storeName, $options: "i" },
        region: store.region,
      });

      if (exists) {
        const updatedStore = await storeModel.findByIdAndUpdate(
          exists._id,
          store,
          { new: true }
        );
        updated.push(updatedStore);
      } else {
        const newStore = await storeModel.create(store);
        inserted.push(newStore);
      }
    }
    return res.status(200).json({ updated, inserted });
  } catch (error) {
    console.error("Error processing upload:", error);
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

const adminReport = async (req, res) => {
  try {
    // CR: Get userId from request to enforce store-level visibility for the report.
    const userId = req.userId;
    const user = await UsersModel.findById(userId).select("role storeId");
    if (!user) {
      return res.status(403).json({ message: "Forbidden: User not found." });
    }
    const isSuperAdmin = user.role === "Super Admin";

    const { search, fromDate, toDate } = req.query;

    // This query is for the final search on the aggregated data
    const finalMatchQuery = {};
    if (search) {
      finalMatchQuery["data.storeName"] = { $regex: search, $options: "i" };
    }

    // This query is for the initial data filtering
    const initialMatchQuery = { is_selled: true };
    if (fromDate && toDate) {
      const { startDate, endDate } = timeRangeCal.timeRangeCal(
        "",
        fromDate,
        toDate
      );
      initialMatchQuery["createdAt"] = {
        $gte: startDate.toDate(),
        $lte: endDate.toDate(),
      };
    }

    const leadIds = await devicesLotModel.distinct("deviceList", {
      status: "Pickup Confirmed",
    });

    // CR: Build the aggregation pipeline dynamically.
    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: { path: "$user", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "stores",
          localField: "user.storeId",
          foreignField: "_id",
          as: "store",
        },
      },
      {
        $unwind: "$store",
      },
    ];

    // CR: This is the core of the security implementation.
    // If the user is NOT a Super Admin, inject a match stage to filter by their storeId.
    if (!isSuperAdmin) {
      if (!user.storeId) {
        // If a non-admin user isn't assigned to a store, return an empty report.
        console.log(
          `User ${userId} (Role: ${user.role}) has no store. Returning empty report.`
        );
        return res.status(200).json({ total: {}, result: [] });
      }
      // Add the stage to the pipeline to filter by the user's specific store.
      pipeline.push({
        $match: { "store._id": user.storeId },
      });
      console.log(
        `🔒 Admin Report for User ${userId} restricted to store: ${user.storeId}`
      );
    } else {
      console.log(`👑 Super Admin generating report for all stores.`);
    }

    // CR: Append the rest of the original pipeline stages.
    pipeline.push(
      {
        $match: initialMatchQuery,
      },
      {
        $addFields: {
          price: "$price",
        },
      },
      {
        $group: {
          _id: {
            createdAt: {
              $dateToString: { format: "%d/%m/%Y", date: "$createdAt" },
            },
            storeId: "$store._id",
            storeName: "$store.storeName",
            region: "$store.region",
          },
          leads: {
            $sum: {
              $cond: [{ $eq: ["$is_selled", true] }, 1, 0],
            },
          },
          completedLeads: {
            $sum: {
              $cond: [{ $in: ["$_id", leadIds] }, 1, 0],
            },
          },
          price: {
            $sum: {
              $cond: [{ $eq: ["$is_selled", true] }, "$price", 0],
            },
          },
          completedPrice: {
            $sum: {
              $cond: [{ $in: ["$_id", leadIds] }, "$price", 0],
            },
          },
        },
      },
      {
        $sort: { "_id.createdAt": -1 },
      },
      {
        $group: {
          _id: "$_id.createdAt",
          totalAvailableForPickup: { $sum: "$leads" },
          priceOfferToCustomer: { $sum: "$price" },
          totalPicked: { $sum: "$completedLeads" },
          totalPickedPrice: { $sum: "$completedPrice" },
          data: {
            $push: {
              storeId: "$_id.storeId",
              storeName: "$_id.storeName",
              region: "$_id.region",
              availableForPickup: "$leads",
              price: "$price",
            },
          },
        },
      },
      {
        $match: finalMatchQuery,
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          datenew: {
            $dateFromString: {
              dateString: "$_id", // Convert the date string back to a Date object
              format: "%d/%m/%Y", // Specify the format of the original date string
            },
          },
          totalAvailableForPickup: 1,
          priceOfferToCustomer: 1,
          totalPicked: 1,
          totalPickedPrice: 1,
          pendingForPickup: {
            $subtract: ["$totalAvailableForPickup", "$totalPicked"],
          },
          pendingForPickupPrice: {
            $subtract: ["$priceOfferToCustomer", "$totalPickedPrice"],
          },
          data: 1,
        },
      },
      {
        $sort: { datenew: -1 },
      }
    );

    // Now execute the fully constructed pipeline
    const result = await leadModel.aggregate(pipeline);

    const totalAvailableForPickup = mapData(result, "totalAvailableForPickup");
    const totalPriceOfferToCustomer = mapData(result, "priceOfferToCustomer");
    const totalPicked = mapData(result, "totalPicked");
    const totalPickedPrice = mapData(result, "totalPickedPrice");
    const totalPendingForPickup = mapData(result, "pendingForPickup");
    const totalPendingForPickupPrice = mapData(result, "pendingForPickupPrice");

    const total = {
      totalAvailableForPickup,
      totalPriceOfferToCustomer,
      totalPicked,
      totalPickedPrice,
      totalPendingForPickup,
      totalPendingForPickupPrice,
    };

    return res.status(200).json({ total, result });
  } catch (error) {
    console.error("Error generating admin report:", error);
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

const mapData = (data, key) => {
  try {
    return data
      .map((item) => item[key] || 0)
      .reduce((acc, num) => acc + num, 0);
  } catch (error) {
    return 0;
  }
};

export default {
  create,
  update,
  deleteById,
  findById,
  findAll,
  uploadData,
  adminReport,
};
