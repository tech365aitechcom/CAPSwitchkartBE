import mongoose from "mongoose";
import leads from "../models/leadsModel.js";
import models from "../models/modelsModel.js";
import quickview from "../models/quickviewModel.js";
import timeRangeCal from "../utils/timeRangeCal.js";
import brands from "../models/brandsModel.js";
const ISE = "Interna Server Error";

const Prospect = async (req, res) => {
  try {
    const userId = req.userId;
    const count = await leads.countDocuments({
      userId: userId,
      is_selled: false,
    });
    return res.status(200).json({ success: true, count: count });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
export const leadPipe = [
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
  {
    $lookup: {
      from: "models",
      localField: "modelId",
      foreignField: "_id",
      as: "model",
    },
  },
  {
    $unwind: "$model",
  },
  {
    $lookup: {
      from: "categories",
      localField: "model.type",
      foreignField: "categoryCode",
      as: "categoryInfo",
    },
  },
  {
    $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true },
  },
];

//order complemeted
const saled = async (req, res) => {
  try {
    const userid = req.userId;
    const { time, search, fromdate, todate, datareq } = req.query;
    const { startDate, endDate } = timeRangeCal.timeRangeCal(
      time,
      fromdate,
      todate
    );
    console.log(userid);
    const aggregationPipeline = [
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userid),
          is_selled: true,
          updatedAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
        },
      },
      {
        $lookup: {
          from: "documents",
          localField: "documentId",
          foreignField: "_id",
          as: "doc",
        },
      },
      {
        $unwind: "$doc",
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      ...leadPipe,
      { $match: { "model.type": datareq } },
      {
        $sort: { updatedAt: -1 },
      },
    ];
    //  console.log(aggregationPipeline)
    if (search) {
      aggregationPipeline.push({
        $match: {
          $or: [
            { "model.name": { $regex: "^" + search, $options: "i" } },
            { uniqueCode: { $regex: "^" + search, $options: "i" } },
          ],
        },
      });
    }
    aggregationPipeline.push({
      $project: {
        _id: 1,
        updatedAt: 1,
        "user.name": 1,
        "doc.IMEI": 1,
        store: 1,
        name: 1,
        emailId: 1,
        phoneNumber: 1,
        aadharNumber: 1,
        uniqueCode: 1,
        storage: 1,
        ram: 1,
        price: "$price",
        model: 1,
        category: "$categoryInfo.categoryName",
      },
    });
    const leadss = await leads.aggregate(aggregationPipeline);

    return res
      .status(200)
      .json({ success: true, count: leadss.length, Leads: leadss });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const addViewedPhone = async (req, res) => {
  const userId = req.userId;
  const { modelId } = req.body;
  try {
    const addView = new quickview({ userId, modelId });

    await addView.save();
    res.status(200).json({ message: "Data saved successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getViewedPhone = async (req, res) => {
  const userId = req.userId;

  try {
    const countQuickview = await quickview.countDocuments({ userId });

    const views = await quickview
      .find({ userId })
      .populate("modelId")
      .sort("-viewedAt");

    const viewModelsData = views.map((viewItem) => viewItem.modelId);

    res.status(200).json({ countQuickview, viewModelsData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//top seeling models /phones

async function topSelling(req, res) {
  try {
    const USERid = new mongoose.Types.ObjectId(req.userId);
    const deviceType = req.query.deviceType || "CTG1";
    const result = await leads.aggregate([
      { $match: { is_selled: true, userId: USERid } },
      {
        $lookup: {
          from: "models",
          localField: "modelId",
          foreignField: "_id",
          as: "modelsData",
        },
      },
      {
        $unwind: "$modelsData",
      },
      {
        $lookup: {
          from: "categories",
          localField: "modelsData.type",
          foreignField: "categoryCode",
          as: "categoryInfo",
        },
      },
      {
        $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true },
      },
      {
        $match: {
          "modelsData.type": deviceType,
        },
      },
      { $group: { _id: "$modelId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const modelsSlice = [];
    for (let i = 0; i < result.length; i++) {
      const model = await models.findById(result[i]._id);
      if (model !== null) {
        modelsSlice.push(model);
      }
    }

    const limitedModelsArray = modelsSlice.slice(0, 7);
    res.status(200).json(limitedModelsArray);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: ISE });
  }
}

async function searchPhone(req, res) {
  try {
    let phoneName = req.body.name;
    const deviceType = req.body.deviceType;
    const origin = req.headers.origin;
    const allowedDomain = "https://buyback.grest.in";

    const query = {};
    if (deviceType) {
      query.type = deviceType;
    }

    if (origin === allowedDomain) {
      // Only Apple devices for buyback domain
      const appleBrand = await brands.findOne({ name: "Apple" }).select("_id");
      if (appleBrand) {
        query.brandId = appleBrand._id;
      }
    }

    const phones = await models.find(query).lean();

    phoneName = phoneName.replace(/\s/g, "");
    const regex = new RegExp(phoneName, "i");

    const matchingPhones = phones.filter((phone) => {
      const comparableName = phone.name.replace(/\s/g, "");
      return regex.test(comparableName);
    });

    if (matchingPhones.length > 0) {
      res.status(200).json(matchingPhones);
    } else {
      res.status(404).json({ message: "No phones found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

//for admin selling top
async function adminSelingget(req, res) {
  try {
    const result = await leads.aggregate([
      { $match: { is_selled: true } },
      { $group: { _id: "$modelId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const modelsArray = [];
    for (let i = 0; i < result.length; i++) {
      const model = await models.findById(result[i]._id);

      if (model !== null) {
        modelsArray.push(model);
      }
    }

    const limitedModelsArray = modelsArray.slice(0, 10);

    res.status(200).json(limitedModelsArray);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: ISE });
  }
}
export default {
  Prospect,
  saled,
  addViewedPhone,
  getViewedPhone,
  topSelling,
  searchPhone,
  adminSelingget,
};
