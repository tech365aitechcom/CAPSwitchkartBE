import questionnaire from "../models/questionnaireModel.js";
import leads from "../models/leadsModel.js";
import models from "../models/modelsModel.js";
import gradeprices from "../models/gradePriceModel.js";
import phoneCondition from "../models/phoneConditon.js";
import documents from "../models/documents.model.js";
import groups from "../models/groupsModel.js";
import XLSX from "xlsx";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { fileURLToPath } from "url";
import path, { dirname } from "path";
import leadsController from "./leadsController.js";
import os from "os";
import * as msal from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

const fileName = fileURLToPath(import.meta.url);
const dirName = dirname(fileName);
import {
  CORE1,
  CORE2,
  DISPLAY1,
  DISPLAY2,
  DISPLAY3,
  FUNCTIONAL_MAJOR1,
  FUNCTIONAL_MAJOR2,
  FUNCTIONAL_MAJOR3,
  FUNCTIONAL_MINOR1,
  FUNCTIONAL_MINOR2,
  FUNCTIONAL_MINOR3,
  COSMETICS1,
  COSMETICS2,
  COSMETICS3,
  COSMETICS4,
  WARRANTY1,
  WARRANTY2,
  FUNCTIONAL_MAJOR1_1,
  ACCESSORIES1,
  ACCESSORIES2,
  ACCESSORIES3,
} from "../const.js";
import condtionCodesWatch from "../models/conditionCodesWatchModel.js";
import transporter from "../utils/transporter.js";

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

async function sendMailWithGraph(mailOptions) {
  try {
    const msalConfig = {
      auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
      },
    };
    const cca = new msal.ConfidentialClientApplication(msalConfig);

    const authResponse = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });

    if (!authResponse || !authResponse.accessToken) {
      throw new Error("Failed to acquire access token for Graph API");
    }

    const graphClient = Client.init({
      authProvider: (done) => {
        done(null, authResponse.accessToken);
      },
    });

    const message = {
      subject: mailOptions.subject,
      body: {
        contentType: "HTML",
        content: mailOptions.html,
      },
      toRecipients: [{ emailAddress: { address: mailOptions.to } }],
      attachments: [],
    };

    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      for (const attachment of mailOptions.attachments) {
        message.attachments.push({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: attachment.filename,
          contentType: attachment.contentType,
          contentBytes: attachment.content.toString("base64"),
        });
      }
    }

    await graphClient
      .api(`/users/${process.env.SENDER_MAIL_USER_ID}/sendMail`)
      .post({ message });

    console.log("✅ Email sent successfully using Microsoft Graph!");
  } catch (error) {
    console.error("🔥 Error sending email with Graph API:", error);
    throw error;
  }
}

const create = async (req, res) => {
  try {
    const { group, yes, no, quetion } = req.body;
    if (!group || !yes || !no || !quetion || !req.body.default) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const data = await questionnaire.create(req.body);
    return res
      .status(200)
      .json({ data, message: "questionnaires created successfully." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

const insertMany = async (req, res) => {
  const cs = convertCsvToJson(req.file);
  try {
    const data = await questionnaire.insertMany(cs);
    res
      .status(200)
      .json({ data, message: "questionnaires created successfully." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const findAll = async (req, res) => {
  try {
    const page = Number(req.query.page) || 0;
    const deviceType = req.query.type || "CTG1";
    const limit = 50;
    const data = await questionnaire
      .find({ type: deviceType })
      .limit(limit)
      .skip(page * limit)
      .sort({ viewOn: 1 });
    const totalCounts = await questionnaire.countDocuments({
      type: deviceType,
    });
    res.status(200).json({
      data,
      totalCounts,
      message: "questionnaires fetched successfully.",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// ==================== DYNAMIC GROUP CODE CALCULATION ====================

/**
 * Dynamically calculate the highest code for any group
 * @param {Array} groupAnswers - Array of answers for a specific group
 * @param {Array} possibleCodes - Array of possible codes for this group (sorted from highest to lowest priority)
 * @returns {String} - The highest matching code
 */
function calculateGroupCode(groupAnswers, possibleCodes) {
  if (!groupAnswers || groupAnswers.length === 0) {
    return possibleCodes[possibleCodes.length - 1]; // Return lowest code as default
  }

  // Check each code from highest to lowest priority
  for (const code of possibleCodes) {
    const matchingAnswers = groupAnswers.filter((e) => e.answer === code);
    if (matchingAnswers.length > 0) {
      return code;
    }
  }

  // If no match found, return the lowest code
  return possibleCodes[possibleCodes.length - 1];
}

function DisplayCodeUpd(QNA, query) {
  let display = QNA?.Display
    ? QNA.Display.filter((e) => e.answer === DISPLAY3)
    : [];
  query.displayCode = DISPLAY3;
  if (!display.length) {
    display = QNA.Display.filter((e) => e.answer === DISPLAY2);
    query.displayCode = DISPLAY2;
    if (!display.length) {
      QNA.Display.filter((e) => e.answer === DISPLAY1);
      query.displayCode = DISPLAY1;
    }
  }
}

function FuncMajorUpd(QNA, query) {
  let functionalMajor = QNA?.["Functional Major"]
    ? QNA["Functional Major"].filter((e) => e.answer === FUNCTIONAL_MAJOR3)
    : [];
  query.functionalMajorCode = FUNCTIONAL_MAJOR3;
  if (!functionalMajor.length) {
    functionalMajor = QNA["Functional Major"].filter(
      (e) => e.answer === FUNCTIONAL_MAJOR2,
    );
    query.functionalMajorCode = FUNCTIONAL_MAJOR2;
    if (!functionalMajor.length) {
      QNA["Functional Major"].filter((e) => e.answer === FUNCTIONAL_MAJOR1);
      query.functionalMajorCode = FUNCTIONAL_MAJOR1;
    }
  }
}

function FuncMinorUpd(QNA, query) {
  let functionalMinor = QNA?.["Functional Minor"]
    ? QNA["Functional Minor"].filter((e) => e.answer === FUNCTIONAL_MINOR3)
    : [];
  query.functionalMinorCode = FUNCTIONAL_MINOR3;
  if (!functionalMinor.length) {
    functionalMinor = QNA["Functional Minor"].filter(
      (e) => e.answer === FUNCTIONAL_MINOR2,
    );
    query.functionalMinorCode = FUNCTIONAL_MINOR2;
    if (!functionalMinor.length) {
      QNA["Functional Minor"].filter((e) => e.answer === FUNCTIONAL_MINOR1);
      query.functionalMinorCode = FUNCTIONAL_MINOR1;
    }
  }
}

function CosmeticsUpd(QNA, query) {
  let cosmetics = QNA?.Cosmetics
    ? QNA.Cosmetics.filter((e) => e.answer === COSMETICS4)
    : [];
  query.cosmeticsCode = COSMETICS4;
  if (!cosmetics.length) {
    cosmetics = QNA.Cosmetics.filter((e) => e.answer === COSMETICS3);
    query.cosmeticsCode = COSMETICS3;
    if (!cosmetics.length) {
      cosmetics = QNA.Cosmetics.filter((e) => e.answer === COSMETICS2);
      query.cosmeticsCode = COSMETICS2;
      if (!cosmetics.length) {
        QNA.Cosmetics.filter((e) => e.answer === COSMETICS1);
        query.cosmeticsCode = COSMETICS1;
      }
    }
  }
}

const calculatePrice = async (req, res) => {
  try {
    const { QNA, phoneNumber, modelId, storage, name, ram, aadharNumber } =
      req.body;

    // Validate required inputs
    if (!QNA || !phoneNumber || !modelId) {
      return res.status(403).json({
        success: false,
        message: "QNA, phone number, and modelId are required",
      });
    }

    // Build query and calculate grade
    const query = buildQuery(QNA);
    console.log("query", query);
    const gradeData = await fetchGradeData(query);
    console.log("gradeData", gradeData);
    // Fetch price data
    const priceData = await fetchPriceData(modelId, storage, ram);
    console.log("priceData", priceData);

    if (!priceData || !priceData.grades) {
      console.error(
        `No price data found for modelId: ${modelId}, storage: ${storage}, ram: ${ram}`,
      );
      return res.status(404).json({
        success: false,
        message: "Price data not found for this device configuration.",
      });
    }

    // Calculate price
    const price = calculatePriceFromGrades(priceData, gradeData, query);

    // Fetch additional model data
    const modelData = await models.findOne({ _id: modelId }).select("brandId");

    if (!modelData) {
      console.error(`Model data not found for modelId: ${modelId}`);
      return res.status(404).json({
        success: false,
        message: "Device model not found.",
      });
    }

    const userDetails = {
      QNA,
      phoneNumber,
      aadharNumber,
      name,
    };
    console.log(userDetails);

    const modelDetails = {
      modelId,
      brandId: modelData.brandId,
      storage,
      ram,
    };
    console.log(modelDetails);

    // Build lead object
    const obj = buildLeadObject(
      req,
      userDetails,
      modelDetails,
      gradeData,
      price,
    );
    console.log(obj);

    // Generate lead and return response
    const { lead, uniqueCode } = await generateLeadAndUpdateOrCreate(
      req,
      obj,
      buildQueryParam(phoneNumber, modelId, storage, ram, req.userId),
    );
    console.log(gradeData);

    return res.status(200).json({
      data: {
        id: lead._id,
        price: Number(price),
        grade: gradeData.grade,
        uniqueCode,
      },
      message: "Price fetched successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};

// Helper Functions
/**
 * Build query object dynamically from QNA
 * @param {Object} QNA - Contains all group answers
 * @returns {Object} - Query object with all group codes
 */
function buildQuery(QNA) {
  const query = {};

  // Core group
  if (QNA.Core) {
    const coreCodes = [CORE2, CORE1];
    query.coreCode = calculateGroupCode(QNA.Core, coreCodes);
  }

  // Display group
  if (QNA.Display) {
    const displayCodes = [DISPLAY3, DISPLAY2, DISPLAY1];
    query.displayCode = calculateGroupCode(QNA.Display, displayCodes);
  }

  // Functional Major group
  if (QNA["Functional Major"]) {
    const functionalMajorCodes = [
      FUNCTIONAL_MAJOR3,
      FUNCTIONAL_MAJOR2,
      FUNCTIONAL_MAJOR1,
    ];
    query.functionalMajorCode = calculateGroupCode(
      QNA["Functional Major"],
      functionalMajorCodes,
    );
  }

  // Functional Minor group
  if (QNA["Functional Minor"]) {
    const functionalMinorCodes = [
      FUNCTIONAL_MINOR3,
      FUNCTIONAL_MINOR2,
      FUNCTIONAL_MINOR1,
    ];
    query.functionalMinorCode = calculateGroupCode(
      QNA["Functional Minor"],
      functionalMinorCodes,
    );
  }

  // Cosmetics group
  if (QNA.Cosmetics) {
    const cosmeticsCodes = [COSMETICS4, COSMETICS3, COSMETICS2, COSMETICS1];
    query.cosmeticsCode = calculateGroupCode(QNA.Cosmetics, cosmeticsCodes);
  }

  // Warranty group
  if (QNA.Warranty) {
    const warrantyCodes = [WARRANTY1, WARRANTY2];
    const warrantyMatches = QNA.Warranty.filter((e) => e.answer === WARRANTY1);
    query.warrentyCode = warrantyMatches.length ? WARRANTY1 : WARRANTY2;
  }

  // Accessories group
  if (QNA.Accessories) {
    const accessoriesCodes = [ACCESSORIES3, ACCESSORIES1, ACCESSORIES2];
    query.accessoriesCode = calculateGroupCode(
      QNA.Accessories,
      accessoriesCodes,
    );
  }

  // Handle any new groups dynamically
  // If a group doesn't match the above, it will be skipped for now
  // You can extend this logic to handle completely dynamic groups from database

  return query;
}

/**
 * Fetch grade data from phoneCondition collection
 */
async function fetchGradeData(query) {
  try {
    const gradeData = await phoneCondition.findOne(query).select("grade");

    if (!gradeData) {
      console.error("No matching grade condition found for query:", query);
      // Return default grade E if no condition matches
      return { grade: "E" };
    }

    return gradeData;
  } catch (error) {
    console.error("Error fetching grade data:", error);
    throw error;
  }
}

const fetchPriceData = async (modelId, storage, ram) => {
  return gradeprices
    .findOne({
      modelId,
      $or: [
        { storage, RAM: ram },
        { storage, RAM: { $exists: false } },
        { storage: { $exists: false }, RAM: ram },
        { storage: { $exists: false }, RAM: { $exists: false } },
      ],
    })
    .select("grades");
};

const calculatePriceFromGrades = (priceData, gradeData, query) => {
  // Get all available grades sorted (best to worst)
  const availableGrades = Object.keys(priceData.grades)
    .filter(
      (key) =>
        priceData.grades[key] !== null && priceData.grades[key] !== undefined,
    )
    .sort();

  if (availableGrades.length === 0) {
    throw new Error("No valid grades found in price data");
  }

  const lowestGrade = availableGrades[availableGrades.length - 1];

  // If core issue exists (CORE2), return lowest grade price
  if (query.coreCode && query.coreCode === CORE2) {
    return priceData.grades[lowestGrade];
  }

  // Get the converted grade
  const convertedGrade = convertGrade(gradeData.grade);

  // Check if the exact grade exists
  if (
    priceData.grades[convertedGrade] !== undefined &&
    priceData.grades[convertedGrade] !== null
  ) {
    return priceData.grades[convertedGrade];
  }

  // Fallback: Find the closest lower grade or use lowest available
  console.warn(
    `Grade ${gradeData.grade} (${convertedGrade}) not found in price data. Using fallback logic.`,
  );

  // Define grade hierarchy from best to worst
  const gradeHierarchy = [
    "A_PLUS",
    "A",
    "B_PLUS",
    "B",
    "B_MINUS",
    "C_PLUS",
    "C",
    "C_MINUS",
    "D_PLUS",
    "D",
    "D_MINUS",
    "E",
  ];

  // Find position of requested grade
  const requestedIndex = gradeHierarchy.indexOf(convertedGrade);

  // Look for the nearest available grade (equal or worse)
  for (let i = requestedIndex; i < gradeHierarchy.length; i++) {
    if (priceData.grades[gradeHierarchy[i]] !== undefined) {
      console.log(
        `Using grade ${gradeHierarchy[i]} instead of ${convertedGrade}`,
      );
      return priceData.grades[gradeHierarchy[i]];
    }
  }

  // If still not found, use the lowest available grade
  console.log(`Using lowest available grade ${lowestGrade}`);
  return priceData.grades[lowestGrade];
};

const buildLeadObject = (req, userDetails, modelDetails, gradeData, price) => {
  const { QNA, phoneNumber, aadharNumber, name } = userDetails;
  const { modelId, brandId, storage, ram } = modelDetails;

  return {
    QNA,
    phoneNumber,
    aadharNumber: aadharNumber || "",
    name,
    modelId,
    brandId,
    userId: req.userId,
    price,
    ...(storage && { storage }),
    ...(ram && { ram }),
    gradeId: gradeData._id,
    actualPrice: price,
    uniqueCode: process.env.UNIQUE_CODE,
  };
};

const buildQueryParam = (phoneNumber, modelId, storage, ram, userId) => {
  return {
    phoneNumber,
    modelId,
    userId,
    ...(storage && { storage }),
    ...(ram && { ram }),
    is_selled: false,
  };
};

const customerDetail = async (req, res) => {
  try {
    const { phoneNumber, name, emailId, leadId } = req.body;
    if (!phoneNumber || !name || !emailId || !leadId) {
      return res.status(400).json({ message: "Required fields are missing" });
    }
    await leads.findByIdAndUpdate(
      { _id: leadId },
      {
        phoneNumber,
        name,
        emailId,
        is_selled: true,
        userId: "6540d7df4058702d148699e8",
      },
    );
    return res.status(200).json({ message: "Customer Details Added" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

const convertCsvToJson = (file) => {
  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  var sheetNameList = workbook.SheetNames;
  const options = { defval: "" };
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetNameList[0]], options);
};

function fillTemplate(template, data) {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    return data[key.trim()] ?? ""; // safely replace missing values with empty string
  });
}
const maskPhoneNumber = (phNumber) => {
  const visibleLength = Math.ceil(phNumber?.length * 0.25);
  const maskedSection = phNumber?.slice(0, phNumber.length - visibleLength);
  const visibleSection = phNumber?.slice(phNumber?.length - visibleLength);
  return `${maskedSection.replace(/./g, "x")}${visibleSection}`;
};

const maskEmail = (email) => {
  const [namee, domain] = email.split("@");
  const visibleLength = Math.ceil(namee?.length * 0.25);
  const maskedName = namee?.slice(0, namee?.length - visibleLength);
  const visibleName = namee?.slice(namee?.length - visibleLength);
  return `${maskedName.replace(/./g, "x")}${visibleName}@${domain}`;
};

const itemPurchased = async (req, res) => {
  try {
    const lead = await leadsController.getLeadById(req.body.id);
    if (!lead || lead.userId._id.toString() !== req.userId) {
      console.log("entered lead or userId check");
      return res
        .status(400)
        .json({ success: false, message: "Invalid user or id" });
    }

    if (lead.is_selled) {
      return res
        .status(200)
        .json({ success: true, message: "Item sold out", data: lead });
    }

    lead.bonusPrice = Number(req.body.bonusPrice);
    lead.is_selled = true;
    await leads.findByIdAndUpdate({ _id: lead._id }, lead);

    const templatePath = path.join(dirName, "../templates/invoice.html");
    const htmlTemplate = fs.readFileSync(templatePath, "utf-8");

    let RAMStorage = "";
    const hasRAM = req.body.RAM;
    const hasStorage = req.body.storage;
    if (hasRAM || hasStorage) {
      const ramPart = hasRAM || "";
      const storagePart = hasStorage || "";
      const separator = hasRAM && hasStorage ? "/" : "";
      RAMStorage = `(${ramPart}${separator}${storagePart})`;
    }

    const formattedDate = new Date(lead.updatedAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const totalPrice = Number(lead.price);
    const htmlContent = fillTemplate(htmlTemplate, {
      name: lead.name,
      email: lead.emailId,
      model: lead.modelId.name,
      bonusPrice: lead.bonusPrice,
      phoneName: lead.modelId.name,
      RAM: lead.ram,
      storage: lead.storage,
      price: totalPrice,
      imeiNumber: lead.documentId?.IMEI || "",
      LaptopimeiNumber: lead.documentId?.SerialNumber || "",
      maskedPhoneNumber: maskPhoneNumber(lead.phoneNumber),
      maskedEmail: maskEmail(lead.emailId),
      aadharNumber: lead.aadharNumber,
      uniqueCode: lead.uniqueCode,
      formattedDate,
      storeName: lead?.store?.storeName || "",
      address: lead?.store?.address || "",
      websiteShortName: process.env.SHORT_NAME,
      companyName: process.env.COMPANY_NAME,
      companyGstin: process.env.COMPANY_GSTIN,
      companyAddress: process.env.COMPANY_ADDRESS,
      companyContact: process.env.COMPANY_CONTACT,
      companyEmail: process.env.MAIL,
      logoUrl: process.env.LOGO_URL,
      courtJurisdiction: process.env.COURT_JURISDICTION,
      RAMStorage,
    });

    const tempHtmlPath = path.join(os.tmpdir(), "temp_invoice.html");
    fs.writeFileSync(tempHtmlPath, htmlContent);

    const form = new FormData();
    form.append("file", fs.createReadStream(tempHtmlPath), "file.html");

    const pdfResponse = await axios.post(
      "https://13uvilapjl.execute-api.ap-south-1.amazonaws.com/api/pdf",
      form,
      { headers: form.getHeaders() },
    );

    const base64Data = pdfResponse.data;
    if (!base64Data) {
      throw new Error("No PDF data in response");
    }
    const pdfBuffer = Buffer.from(base64Data, "base64");
    fs.unlinkSync(tempHtmlPath);

    const mailOptions = {
      from: process.env.MAIL,
      to: lead.emailId,
      subject: "Your Purchase Confirmation",
      html: `
        <p>Dear ${lead.name},</p>
        <p>Thank you for selling your device to <strong>${process.env.APP_NAME}</strong>.</p>
        <p>Your purchase receipt is attached to this email for your reference.</p>
        <p>Product: <strong>${lead.modelId.name}</strong></p>
        <p>For any queries, feel free to contact our support team at ${process.env.MAIL} / ${process.env.CONTACT_NUM}</p>
        <br/>
        <p>Best Regards,</p>
        <p><strong>${process.env.APP_NAME}</strong></p>
        <p><a href="${process.env.DOMAIN}">Visit Our Website</a></p>
      `,
      attachments: [
        {
          filename: "receipt.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };
    await sendMailWithGraph(mailOptions);
    return res.status(200).json({
      data: lead.modelId,
      id: lead._id,
      message: "Item Sold Successfully.",
    });
  } catch (error) {
    console.error("🔥 [itemPurchased] Error occurred:", error.message);
    console.error("📛 Stack trace:", error.stack);
    return res.status(500).json({ message: error.message });
  }
};

const getSubmitedData = async (req, res) => {
  try {
    let lead = await leads
      .findOne({ userId: req.userId, _id: req.body.id })
      .populate("modelId");
    if (lead.gradeId) {
      lead = await leads
        .findOne({ userId: req.userId, _id: req.body.id })
        .populate("modelId")
        .populate("gradeId");
    }
    return res
      .status(200)
      .json({ data: lead, message: "Item Fetched Successfully." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const buildToUpdate = async (leadId, documentId, lead, body) => {
  const { emailId, name, phoneNumber, aadharNumber } = body;
  const sampleUpd = { documentId, gradeId: lead.gradeId };
  if (emailId) {
    sampleUpd.emailId = await emailId;
  }
  if (name) {
    sampleUpd.name = await name;
  }
  if (phoneNumber) {
    sampleUpd.phoneNumber = await phoneNumber;
  }
  if (aadharNumber) {
    sampleUpd.aadharNumber = await aadharNumber;
  }
  return sampleUpd;
};

const uploadDocuments = async (req, res) => {
  try {
    const { IMEI, leadId } = req.body;
    const Bucket = process.env.S3_BUCKET_NAME;
    const Region = process.env.S3_REGION;
    const Folder = process.env.S3_FOLDER;

    const obj = {
      IMEI: IMEI || "",
      adhar: {
        front: `https://${Bucket}.s3.${Region}.amazonaws.com/${Folder}/${IMEI}-adhaarFront`,
        back: `https://${Bucket}.s3.${Region}.amazonaws.com/${Folder}/${IMEI}-adhaarBack`,
      },
      phoneBill: `https://${Bucket}.s3.${Region}.amazonaws.com/${Folder}/${IMEI}-phoneBill`,
      phonePhotos: {
        front: `https://${Bucket}.s3.${Region}.amazonaws.com/${Folder}/${IMEI}-phoneFront`,
        back: `https://${Bucket}.s3.${Region}.amazonaws.com/${Folder}/${IMEI}-phoneBack`,
        up: `https://${Bucket}.s3.${Region}.amazonaws.com/${Folder}/${IMEI}-phoneTop`,
        down: `https://${Bucket}.s3.${Region}.amazonaws.com/${Folder}/${IMEI}-phoneLeft`,
        left: `https://${Bucket}.s3.${Region}.amazonaws.com/${Folder}/${IMEI}-phoneRight`,
        right: `https://${Bucket}.s3.${Region}.amazonaws.com/${Folder}/${IMEI}-phoneBottom`,
      },
      signature: `https://${Bucket}.s3.${Region}.amazonaws.com/${Folder}/${IMEI}-signature`,
      userId: req.userId,
      leadId: leadId,
    };
    const data = await documents.create(obj);
    const lead = await leads.findOne({ _id: leadId }).select("gradeId");
    const toUpdate = await buildToUpdate(leadId, data._id, lead, req.body);

    await leads.findByIdAndUpdate({ _id: leadId }, toUpdate);
    return res
      .status(200)
      .json({ data, message: "Documents uploaded successfully." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

const getDocuments = async (req, res) => {
  try {
    const page = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 10;
    const data = await documents
      .find({})
      .populate("userId")
      .populate("leadId")
      .limit(limit)
      .skip(page * limit)
      .sort({ createdAt: -1 });
    const totalCounts = await documents.countDocuments({});
    res
      .status(200)
      .json({ data, totalCounts, message: "documents fetched successfully." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const questionnaireList = async (req, res) => {
  const deviceType = req.query.deviceType || "CTG1";

  try {
    const data = await questionnaire.aggregate([
      {
        $match: {
          type: deviceType,
        },
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
        $group: {
          _id: "$group",
          data: { $push: "$$ROOT" }, // Keep all fields in the array
        },
      },
    ]);
    res
      .status(200)
      .json({ data, message: "questionnaire List fetched successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { id, group, yes, no, quetion } = req.body;
    if (!id || !group || !yes || !no || !quetion || !req.body.default) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const result = await questionnaire.findByIdAndUpdate(
      { _id: req.body._id || req.body.id },
      req.body,
      { new: true },
    );
    return res.status(200).json({ result });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

const deleteById = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ message: "id is required" });
    }
    const result = await questionnaire.findByIdAndDelete(id);
    return res.status(200).json({ result });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: 500 });
  }
};

function FunctionalUpd(QNA, query) {
  const functional = QNA?.Functional
    ? QNA.Functional.filter((e) => e.answer === FUNCTIONAL_MAJOR1)
    : [];
  query.functionalCode = FUNCTIONAL_MAJOR1;
  if (!functional.length) {
    query.functionalCode = FUNCTIONAL_MAJOR1_1;
  }
}

function PhysicalUpd(QNA, query) {
  let physical = QNA?.Physical
    ? QNA.Physical.filter((e) => e.answer === COSMETICS4)
    : [];
  query.cosmeticsCode = COSMETICS4;
  if (!physical.length) {
    physical = QNA.Physical.filter((e) => e.answer === COSMETICS3);
    query.cosmeticsCode = COSMETICS3;
    if (!physical.length) {
      physical = QNA.Physical.filter((e) => e.answer === COSMETICS2);
      query.cosmeticsCode = COSMETICS2;
      if (!physical.length) {
        query.cosmeticsCode = COSMETICS1;
      }
    }
  }
}

function AccessoriesUpd(QNA, query) {
  let accessories = QNA?.Accessories
    ? QNA.Accessories.filter((e) => e.answer === ACCESSORIES3)
    : [];
  query.accessoriesCode = ACCESSORIES3;

  if (!accessories.length) {
    accessories = QNA.Accessories.filter((e) => e.answer === ACCESSORIES1);
    query.accessoriesCode = ACCESSORIES1;
    if (!accessories.length) {
      query.accessoriesCode = ACCESSORIES2;
    }
  }
}

//calcuatle the watch prce
const calculatePriceWatch = async (req, res) => {
  try {
    const { QNA, modelId, name, phoneNumber, aadharNumber } = req.body;
    const query = {};
    if (!QNA || !modelId) {
      return res.status(403).json({
        success: false,
        message: "QNA and modelId are required",
      });
    }

    const warranty = QNA?.Warranty
      ? QNA.Warranty.filter((e) => e.answer === WARRANTY1)
      : [];
    query.warrentyCode = warranty.length ? WARRANTY1 : WARRANTY2;

    FunctionalUpd(QNA, query);
    PhysicalUpd(QNA, query);
    AccessoriesUpd(QNA, query);
    //settig uniquew code
    const gradeData = await condtionCodesWatch.findOne(query).select("grade");

    if (!gradeData) {
      console.error(
        "No matching grade condition found for watch query:",
        query,
      );
      // Default to lowest grade 'E' if no condition matches
      gradeData = { grade: "E" };
    }

    const priceData = await gradeprices.findOne({ modelId }).select("grades");

    if (!priceData || !priceData.grades) {
      console.error(`No price data found for watch modelId: ${modelId}`);
      return res.status(404).json({
        success: false,
        message: "Price data not found for this watch configuration.",
      });
    }

    const price = priceData.grades[convertGrade(gradeData.grade)];
    const actualPrice = price;
    const modelData = await models.findOne({ _id: modelId });

    if (!modelData) {
      console.error(`Model data not found for watch modelId: ${modelId}`);
      return res.status(404).json({
        success: false,
        message: "Device model not found.",
      });
    }

    const queryParam = {
      phoneNumber,
      modelId,
      userId: req.userId,
      is_selled: false,
    };
    const obj = {
      QNA,
      modelId,
      brandId: modelData.brandId,
      userId: req.userId,
      price,
      gradeId: gradeData._id,
      actualPrice,
      uniqueCode: process.env.UNIQUE_CODE,
      ram: modelData.config[0].RAM,
      phoneNumber,
      aadharNumber,
      name,
    };
    const { lead, uniqueCode } = await generateLeadAndUpdateOrCreate(
      req,
      obj,
      queryParam,
    );
    return res.status(200).json({
      data: {
        id: lead._id,
        price: Number(price),
        grade: gradeData.grade,
        uniqueCode,
      },
      message: "price fetched successfully.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

async function generateLeadAndUpdateOrCreate(req, obj, queryParam) {
  let lead;
  const doc = await leads.findOne(queryParam).select("uniqueCode");
  const lastDoc = await leads
    .findOne({ userId: req.userId, uniqueCode: { $ne: "" } })
    .sort({ createdAt: -1 });
  const inputString = req?.storeName || "Switchkart";
  const words = inputString?.split(" ");
  const firstCharacters = words.map((word) => word.charAt(0));
  const resultString = firstCharacters.join("");
  if (lastDoc) {
    const numbersArray = lastDoc.uniqueCode.match(/\d+/g);
    const code = numbersArray ? numbersArray.map(Number) : [];
    obj.uniqueCode = `${process.env.UNIQUE_CODE_SUB}${resultString}${
      Number(code) + 1
    }`;
  }

  if (doc) {
    obj.uniqueCode = doc.uniqueCode;
    lead = await leads.findByIdAndUpdate({ _id: doc._id }, obj);
  } else {
    console.log(obj);
    obj.bonusPrice = 0;
    obj.ram = obj.ram || "NA";
    obj.storage = obj.storage || "NA";
    lead = await leads.create(obj);
  }
  return { lead, uniqueCode: obj.uniqueCode };
}

export default {
  insertMany,
  create,
  findAll,
  calculatePrice,
  itemPurchased,
  convertCsvToJson,
  uploadDocuments,
  getSubmitedData,
  getDocuments,
  questionnaireList,
  update,
  deleteById,
  calculatePriceWatch,
  customerDetail,
};
