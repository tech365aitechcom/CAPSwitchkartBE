import models from "../models/modelsModel.js";
import leadLifecycle from "../models/LeadLifecycle.js";
import s3Controller from "./s3.controller.js";
import leads from "../models/leadsModel.js";
import mongoose from "mongoose";
import timeRangeCal from "../utils/timeRangeCal.js";
import leadsController from "./leadsController.js";
const ISE = "Internal Server Error";

async function addQuickQoute(req, res) {
  const userId = req.userId;
  const { lead_id, phoneNumber, name, emailId, reason } = req.body;
  let { eventType } = req.body;
  const { bonusPrice } = req.body;
  if (!lead_id || !phoneNumber || !name || !emailId || !reason) {
    return res
      .status(400)
      .json({ code: 400, message: "All fields are required" });
  }
  if (!eventType) {
    eventType = "quoteCreated";
  }
  try {
    const leadDoc = await leads.findById(lead_id);
    if (!leadDoc) {
      return res.status(404).json({ code: 404, message: "Lead not found" });
    }

    leadDoc.phoneNumber = phoneNumber;
    leadDoc.name = name;
    leadDoc.emailId = emailId;
    if(eventType === "orderCreated" && bonusPrice){
      leadDoc.bonusPrice = Number(bonusPrice);
    }
    await leadDoc.save();
    await leadLifecycle.findOneAndUpdate(
      { lead_id: lead_id },
      {
        lead_id,
        eventType,
        userid: userId,
        reason: reason,
      },
      { new: true, upsert: true }
    );
    return res
      .status(200)
      .json({ code: 200, message: `Successfully inserted on ${eventType}` });
  } catch (err) {
    return res
      .status(500)
      .json({ code: 500, message: ISE, error: err.toString() });
  }
}

//order cretaed
async function addOrderCreated(req, res) {
  req.body.eventType = "orderCreated";
  addQuickQoute(req, res);
}

async function getCounts(req, res) {
  const userId = req.userId;
  const { time, search, fromdate, todate, datareq } = req.query;
  const { startDate, endDate } = timeRangeCal.timeRangeCal(
    time,
    fromdate,
    todate
  );

  try {
    const match = {
      userid: new mongoose.Types.ObjectId(userId),
      eventType: "orderCreated",
      updatedAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
    };

    const aggregationPipeline = [
      ...leadsController.orderPipe,
      { $match: { "lead.model.type": datareq } },
      { $sort: { createdAt: -1 } },
    ];
    if (search) {
      aggregationPipeline.push({
        $match: {
          $or: [
            { "lead.model.name": { $regex: "^" + search, $options: "i" } },
            { "lead.uniqueCode": { $regex: "^" + search, $options: "i" } },
          ],
        },
      });
    }

    let query = [{ $match: match }];
    aggregationPipeline.push({
      $project: {
        _id: 1,
        lead_id: 1,
        updatedAt: 1,
        "user.name": 1,
        "lead.name": 1,
        "lead.phoneNumber": 1,
        "lead.emailId": 1,
        "lead.uniqueCode": 1,
        "lead.price": { $add: ["$lead.price", "$lead.bonusPrice"] },
        "lead.bonusPrice": 1,
        "lead.storage": 1,
        "lead.model": 1,
      },
    });
    const orders = await leadLifecycle.aggregate([
      ...query,
      ...aggregationPipeline,
    ]);
    match.eventType = "quoteCreated";
    query = [{ $match: match }];
    const quotes = await leadLifecycle.aggregate([
      ...query,
      ...aggregationPipeline,
    ]);

    const data = {
      orderData: {
        count: orders.length,
        data: orders,
      },
      quoteData: {
        count: quotes.length,
        data: quotes,
      },
    };

    return res.status(200).json({ code: 200, data });
  } catch (err) {
    return res
      .status(500)
      .json({ code: 500, message: ISE, error: err.toString() });
  }
}

///delte the instance
const deleteDoc = async (req, res) => {
  try {
    const id = req.params.id;

    const leadLifecycleDoc = await leadLifecycle.findById(id);

    if (!leadLifecycleDoc) {
      return res
        .status(404)
        .send({ message: "No leadLifecycle found with this id." });
    }

    await leads.findByIdAndRemove(leadLifecycleDoc.lead_id);

    await leadLifecycleDoc.deleteOne();

    return res.status(200).send({
      message: "Lead and its lifecycle data have been deleted successfully.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.toString() });
  }
};

//image upload

async function uploadImage(req, res) {
  console.log(req.files);

  try {
    const { modelId } = req.body;
    const { phoneFront, phoneBack, phoneFrontUp, phoneFrontDown } = req.files;

    const model = await models.findById(modelId);
    if (!model) {
      return res.status(400).json({
        message: "No document found with the given modelId.",
      });
    }

    const obj = {
      phonePhotos: {
        front: phoneFront ? await s3Controller.uploadFile(phoneFront[0]) : "",
        back: phoneBack ? await s3Controller.uploadFile(phoneBack[0]) : "",
        upFront: phoneFrontUp
          ? await s3Controller.uploadFile(phoneFrontUp[0])
          : "",
        downFront: phoneFrontDown
          ? await s3Controller.uploadFile(phoneFrontDown[0])
          : "",
      },
    };

    const updatedDoc = await models.findOneAndUpdate(
      { _id: modelId },
      { $set: { phonePhotos: obj.phonePhotos } },
      { new: true }
    );

    return res.status(200).json({
      message: "Images uploaded and document updated successfully!",
      data: updatedDoc,
    });
  } catch (err) {
    return res.status(500).json({
      message:
        "An error occurred while uploading images and updating the document.",
      error: err.toString(),
    });
  }
}

async function bulkuploadImage(req, res) {
  try {
    const notfound = [];
    const duplicate = [];
    let totaluploaded = 0;
    const folderPath = "C:\\Users\\HP\\Downloads\\PhotoUpload\\photos";
    const rejectedPath = "C:\\Users\\HP\\Downloads\\PhotoUpload\\rejected";
    const acceptedPath = "C:\\Users\\HP\\Downloads\\PhotoUpload\\doneMiss";

    const files = fs.readdirSync(folderPath);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const fileExtension = path.extname(filePath).substring(1);
      const modelName = path.basename(file, path.extname(file));
      const model = await models.findOne({
        name: { $regex: `^${modelName}$`, $options: "i" },
      });

      if (model) {
        const fileDetails = {
          fieldname: "phoneFront",
          originalname: file,
          mimetype: fileExtension === "png" ? "image/png" : "image/jpg",
          buffer: fs.readFileSync(filePath),
          size: fs.statSync(filePath).size,
        };

        const obj = {
          phonePhotos: {
            front: filePath ? await s3Controller.uploadFile(fileDetails) : "",
            back: "",
            upFront: "",
            downFront: "",
          },
        };

        await models.findOneAndUpdate(
          { _id: model._id },
          { $set: { phonePhotos: obj.phonePhotos } },
          { new: true }
        );
        fs.copyFileSync(filePath, path.join(acceptedPath, file));
        totaluploaded++;
      } else {
        fs.copyFileSync(filePath, path.join(rejectedPath, file));
        notfound.push(modelName);
      }
    }

    res.status(200).json({
      message: "Images uploaded and document updated successfully!",
      data: {
        totaluploaded,
        duplicate,
        notfound,
        totaldup: duplicate.length,
        totnf: notfound.length,
      },
    });
  } catch (err) {
    res.status(500).json({
      message:
        "An error occurred while uploading images and updating the document.",
      error: err.toString(),
    });
  }
}

export default {
  addQuickQoute,
  addOrderCreated,
  getCounts,
  uploadImage,
  deleteDoc,
  bulkuploadImage,
};
