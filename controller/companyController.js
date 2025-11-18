import companyModel from "../models/companyModel.js";
import utils from "../utils/required.js";
import csv from "../controller/questionnaireController.js";
import s3Controller from "../controller/s3.controller.js";

const create = async (req, res) => {
  const userId = req.userId;
  req.body.createdBy = userId;

  try {
    const { error } = utils.companyValidation(req.body);
    if (error) {
      return res.status(400).send({ message: error.details[0].message });
    }
    req.body.documents = [];
    if (req.files) {
      for (const file of req.files) {
        const location = await s3Controller.uploadFile(file);
        if (location) {
          req.body.documents.push(location);
        }
      }
    }
    const result = await companyModel(req.body).save();
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
    const exists = await companyModel.findById({
      _id: req.body._id || req.body.id,
    });
    if (exists) {
      req.body.documents = exists?.documents || [];
      if (req.files) {
        req.body.documents = [];
        for (const file of req.files) {
          const location = await s3Controller.uploadFile(file);
          if (location) {
            req.body.documents.push(location);
          }
        }
      }
    }
    const result = await companyModel.findByIdAndUpdate(
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
    const result = await companyModel.findByIdAndDelete({
      _id: req.query._id || req.query.id,
    });
    return res.status(200).json({ result });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

const findById = async (req, res) => {
  try {
    const result = await companyModel.findById({
      _id: req.query._id || req.query.id,
    });
    return res.status(200).json({ result });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

const findAll = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 0;
    const query = {};
    const search = req.query.search || "";
    if (search) {
      query["$or"] = [
        { companyName: { $regex: search, $options: "i" } },
        { companyCode: { $regex: search, $options: "i" } },
        { contactNumber: { $regex: search, $options: "i" } },
        { uniqueId: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
        { panNumber: { $regex: search, $options: "i" } },
      ];
    }
    const result = await companyModel
      .find(query)
      .limit(limit)
      .skip(limit * page);
    const totalRecords = await companyModel.countDocuments(query);
    return res.status(200).json({ result, totalRecords });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

const uploadData = async (req, res) => {
  try {
    const updated = [];
    const inserted = [];
    const data = csv.convertCsvToJson(req.file.buffer.toString().split("\n"));
    for (let i = 0; i < data.length; i++) {
      const exists = await companyModel.findOne({
        gstNumber: data[i].gstNumber,
      });
      if (exists) {
        const up = await companyModel.findByIdAndUpdate(
          { _id: exists._id },
          data[i]
        );
        updated.push(up);
      } else {
        const saved = await companyModel(data[i]).save();
        inserted.push(saved);
      }
    }
    return res.status(200).json({ updated, inserted });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

export default { create, update, deleteById, findById, findAll, uploadData };
