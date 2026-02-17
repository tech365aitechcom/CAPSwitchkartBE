import companyModel from "../models/companyModel.js";
import csv from "../controller/questionnaireController.js";
import s3Controller from "../controller/s3.controller.js";
import {
  validateCompanyRegistration,
  generateCompanyCode,
} from "../utils/validationUtils.js";
import { ROLES } from "../middlewares/rbac.js";

const create = async (req, res) => {
  const userId = req.userId;

  try {
    // Validate company data
    const validation = validateCompanyRegistration(req.body);
    if (!validation.valid) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: validation.errors });
    }

    // Check if GST number already exists
    const gstNumber = req.body.gstNumber?.toUpperCase();
    const existingCompany = await companyModel.findOne({ gstNumber });
    if (existingCompany) {
      return res
        .status(400)
        .json({ message: "Company with this GST number already exists" });
    }

    // Prepare company data
    const companyData = {
      name: req.body.name,
      contactNumber: req.body.contactNumber,
      address: req.body.address,
      gstNumber: gstNumber,
      panNumber: req.body.panNumber?.toUpperCase(),
      remarks: req.body.remarks || "",
      showPrice: req.body.showPrice || false,
      maskInfo: req.body.maskInfo || false,
      attachedDocuments: req.body.attachedDocuments || [],
      createdBy: userId,
    };

    // Save company first to get the ID
    const company = await companyModel(companyData).save();

    // Generate and update companyCode
    const companyCode = await generateCompanyCode(
      companyModel,
      companyData.name
    );
    company.companyCode = companyCode;
    await company.save();

    return res.status(201).json({
      message: "Company created successfully",
      result: company,
    });
  } catch (error) {
    console.error("Company creation error:", error);
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

const update = async (req, res) => {
  const userId = req.userId;
  req.body.updatedBy = userId;
  delete req.body.createdBy;
  delete req.body.companyCode; // Prevent changing auto-generated code

  try {
    const exists = await companyModel.findById(req.body._id || req.body.id);

    if (!exists) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Check company scoping - only SuperAdmin can update other companies
    if (
      req.userRole !== ROLES.SUPER_ADMIN &&
      exists._id.toString() !== req.userCompanyId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Forbidden: Cannot update another company" });
    }

    // Handle document uploads
    req.body.attachedDocuments = exists.attachedDocuments || [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const location = await s3Controller.uploadFile(file);
        if (location) {
          req.body.attachedDocuments.push({
            fileName: file.originalname,
            fileUrl: location,
            fileType: file.mimetype,
            uploadedAt: new Date(),
          });
        }
      }
    }

    const result = await companyModel.findByIdAndUpdate(
      req.body._id || req.body.id,
      req.body,
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      message: "Company updated successfully",
      result,
    });
  } catch (error) {
    console.error("Company update error:", error);
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

    // Company scoping - users can only see their own company unless SuperAdmin
    if (req.userRole !== ROLES.SUPER_ADMIN) {
      query._id = req.userCompanyId;
    }

    // Search functionality
    const search = req.query.search || "";
    if (search) {
      query["$or"] = [
        { name: { $regex: search, $options: "i" } },
        { companyCode: { $regex: search, $options: "i" } },
        { contactNumber: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
        { panNumber: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    const result = await companyModel
      .find(query)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(limit * page);

    const totalRecords = await companyModel.countDocuments(query);

    return res.status(200).json({
      result,
      totalRecords,
      currentPage: page,
      totalPages: Math.ceil(totalRecords / limit),
    });
  } catch (error) {
    console.error("Find all companies error:", error);
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
