import xlsx from "xlsx";
import mongoose from "mongoose";
import gradeprice from "../models/gradePriceModel.js";
import csv from "../controller/questionnaireController.js";
import modelsModel from "../models/modelsModel.js";
import gradePriceModel from "../models/gradePriceModel.js";
import brandsModel from "../models/brandsModel.js";
import brandModel from "../models/brandsModel.js";
import liquidatorsModel from "../models/liquidatorsModel.js";

const modelDetails = "Model Details";
const SeriesColumn = "Series";
const AWarranty = "A+WARRANTY";

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const processModel = async (a, brandId, category) => {
  const series = a[SeriesColumn] || "";
  const finalMod = a[modelDetails].trim();
  const RAM = a["Ram"]?.trim() || "";
  const storage = a["Storage"]?.trim() || "";

  const frontPhoto = a["Front Photo"] || "";
  const backPhoto = a["Back Photo"] || "";
  const upFrontPhoto = a["Up Front Photo"] || "";
  const downFrontPhoto = a["Down Front Photo"] || "";

  const model = await modelsModel.findOne({
    name: { $regex: `^${escapeRegExp(finalMod)}$`, $options: "i" },
    brandId,
    type: category,
  });

  if (model) {
    return updateExistingModel(model, a, storage, RAM, {
      frontPhoto,
      backPhoto,
      upFrontPhoto,
      downFrontPhoto,
    });
  } else {
    return createNewModel(
      brandId,
      finalMod,
      storage,
      RAM,
      series,
      category,
      a,
      {
        frontPhoto,
        backPhoto,
        upFrontPhoto,
        downFrontPhoto,
      }
    );
  }
};

const updateExistingModel = async (model, a, storage, RAM, photos) => {
  const configExistsIndex = model.config.findIndex(
    (c) => c.storage === storage && c.RAM === RAM
  );
  if (configExistsIndex !== -1) {
    model.config[configExistsIndex].price = a[AWarranty];
  } else {
    model.config.push({
      storage,
      RAM,
      price: a[AWarranty],
    });
  }

  // Update photos if provided
  model.phonePhotos = {
    front: photos.frontPhoto,
    back: photos.backPhoto,
    upFront: photos.upFrontPhoto,
    downFront: photos.downFrontPhoto,
  };

  await model.save();
  await updatePrice(model._id, a, storage, RAM);
  return { updated: true, model };
};

const createNewModel = async (
  brandId,
  finalMod,
  storage,
  RAM,
  series,
  type,
  a,
  photos
) => {
  const newModel = {
    brandId,
    name: finalMod,
    config: [
      {
        storage,
        RAM,
        price: a[AWarranty],
      },
    ],
    series,
    type,
    phonePhotos: {
      front: photos.frontPhoto,
      back: photos.backPhoto,
      upFront: photos.upFrontPhoto,
      downFront: photos.downFrontPhoto,
    },
  };
  const createdModel = await modelsModel.create(newModel);
  await updatePrice(createdModel._id, a, storage, RAM);
  return { updated: false, model: createdModel };
};

const processCsv = async (cs, category) => {
  const rejected = [];
  let inserted = 0;
  let updated = 0;

  for (const a of cs) {
    const brand = await brandModel
      .findOne({ name: { $regex: a["Brand"], $options: "i" } })
      .select("_id");

    if (brand) {
      const { updated: isUpdated, model } = await processModel(
        a,
        brand._id,
        category
      );
      if (isUpdated) {
        updated += 1;
        console.log("Updated:", model.name);
      } else {
        inserted += 1;
        console.log("Inserted:", model.name);
      }
    } else {
      rejected.push(a);
    }
  }

  return { rejected, inserted, updated };
};

const addEditModelsAndPrice = async (req, res) => {
  try {
    const cs = csv.convertCsvToJson(req.file);
    const { rejected, inserted, updated } = await processCsv(
      cs,
      req.body.category
    );

    res.status(200).json({
      data: [],
      rejected,
      message: `${inserted} Model and prices created, ${updated} updated and ${rejected.length} rejected.`,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const updatePrice = async (modelId, data, storage, RAM) => {
  try {
    const query = {
      modelId,
      storage,
      $or: [{ RAM: { $exists: false } }, { RAM }],
    };
    await gradeprice.findOneAndUpdate(
      query,
      {
        $set: {
          modelId,
          storage,
          grades: {
            A_PLUS: data[AWarranty],
            A: data["A"],
            B: data["B"],
            B_MINUS: data["B-"],
            C_PLUS: data["C+"],
            C: data["C"],
            C_MINUS: data["C-"],
            D_PLUS: data["D+"],
            D: data["D"],
            D_MINUS: data["D-"],
            E: data["E"],
          },
          RAM,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.log(error);
  }
};

const modelPriceList = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 0;
    const query = {};
    const search = req.query.search;
    const deviceType = req.query.deviceType || "CTG1";
    if (search) {
      query["$or"] = [{ "model.name": { $regex: search, $options: "i" } }];
    }
    const aggregationPipeline = [
      {
        $lookup: {
          from: "models",
          localField: "modelId",
          foreignField: "_id",
          as: "model",
        },
      },
      { $unwind: "$model" },
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
      { $match: query },
      {
        $match: {
          "model.type": deviceType,
        },
      },
    ];
    const totalRecords = await gradeprice.aggregate([
      ...aggregationPipeline,
      {
        $count: "total",
      },
    ]);
    aggregationPipeline.push(
      {
        $sort: {
          updatedAt: -1,
        },
      },
      {
        $skip: page * limit,
      },
      {
        $limit: limit,
      }
    );
    const result = await gradeprice.aggregate(aggregationPipeline);
    res.status(200).json({ result, totalRecords: totalRecords[0]?.total || 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getModelWisePrice = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 0;

    const data = await gradeprice
      .find()
      .populate("modelId partnerId")
      .limit(limit)
      .skip(limit * page);

    const totalRecords = await gradeprice.countDocuments();

    return res.status(200).json({
      data,
      totalRecords,
      message: "Successfully Fetched models",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

const generateBrandLogoUrl = (brandName) => {
  if (!brandName) return "";

  const clean = brandName
    .trim()
    .replace(/\s+/g, "") // remove all spaces
    .replace(/[^a-zA-Z0-9]/g, ""); // remove special characters

  return `https://grest-c2b-images.s3.ap-south-1.amazonaws.com/${clean}.jpg`;
};

const getNextViewOnValue = async (Brand) => {
  const lastBrand = await Brand.findOne().sort({ viewOn: -1 }).lean();
  return lastBrand ? lastBrand.viewOn + 1 : 1;
};

/**
 * @desc Syncs all existing models from modelsModel to gradePriceModel
 * Creates gradeprice entries for model configs that don't exist yet
 * NOTE: This creates placeholder entries with 0 grades. Real grade data comes from XLSX.
 */
const syncExistingModelsToGradePrice = async () => {
  try {
    console.log("Starting sync of existing models to gradeprice...");

    // Get all models with their configs
    const allModels = await modelsModel.find({}).lean();
    console.log(`Found ${allModels.length} models to process`);

    // Get all existing gradeprice records to compare
    const existingGradePrices = await gradePriceModel.find({}).lean();
    console.log(
      `Found ${existingGradePrices.length} existing gradeprice records`
    );

    // Create a Set of existing combinations for fast lookup
    // Key format: "modelId-storage-RAM"
    const existingSet = new Set(
      existingGradePrices.map(
        (gp) =>
          `${gp.modelId.toString()}-${(gp.storage || "").trim()}-${(
            gp.RAM || ""
          ).trim()}`
      )
    );

    const gradeOps = [];
    let synced = 0;
    let totalConfigs = 0;

    for (const model of allModels) {
      // Each model can have multiple configs (storage/RAM combinations)
      if (model.config && model.config.length > 0) {
        for (const config of model.config) {
          totalConfigs++;
          const storage = (config.storage || "").trim();
          const ram = (config.RAM || "").trim();
          const key = `${model._id.toString()}-${storage}-${ram}`;

          // Only add if this combination doesn't exist
          if (!existingSet.has(key)) {
            gradeOps.push({
              updateOne: {
                filter: {
                  modelId: model._id,
                  storage: storage,
                  RAM: ram,
                },
                update: {
                  $setOnInsert: {
                    modelId: model._id,
                    storage: storage,
                    RAM: ram,
                    price: config.price || 0,
                    grades: {
                      A_PLUS: config.price || 0,
                      A: 0,
                      B: 0,
                      B_MINUS: 0,
                      C_PLUS: 0,
                      C: 0,
                      C_MINUS: 0,
                      D_PLUS: 0,
                      D: 0,
                      D_MINUS: 0,
                      E: 0,
                    },
                  },
                },
                upsert: true,
              },
            });
            synced++;
          }
        }
      }
    }

    console.log(`Total model configs found: ${totalConfigs}`);
    console.log(`New configs to sync: ${synced}`);

    // Execute bulk operations if any
    if (gradeOps.length > 0) {
      const bulkResult = await gradePriceModel.bulkWrite(gradeOps, {
        ordered: false,
      });
      console.log(
        `✅ Synced ${bulkResult.upsertedCount} new model configs to gradeprice (with placeholder grades)`
      );
      return {
        synced: bulkResult.upsertedCount,
        totalModels: allModels.length,
        totalConfigs: totalConfigs,
        alreadyExisting: totalConfigs - bulkResult.upsertedCount,
      };
    } else {
      console.log("✅ All existing models already synced to gradeprice");
      return {
        synced: 0,
        totalModels: allModels.length,
        totalConfigs: totalConfigs,
        alreadyExisting: totalConfigs,
      };
    }
  } catch (error) {
    console.error("Error syncing existing models:", error);
    throw error;
  }
};

/**
 * @desc Enhanced XLSX upload function that:
 * 1. Syncs all existing models to gradeprice first (placeholder entries)
 * 2. Processes XLSX file and checks if models exist
 * 3. Creates brands/models if they don't exist
 * 4. Updates/creates gradeprice entries with ACTUAL grade data from sheets
 */
const addEditModelsAndPricexlsv = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    const Brand = brandsModel;
    const Model = modelsModel;
    const GradePrice = gradePriceModel;

    // STEP 1: SKIP SYNC - Let XLSX data be the source of truth for grades
    console.log("📋 Step 1: Skipping sync - XLSX will provide grade data");

    // STEP 2: Process XLSX file
    console.log("📋 Step 2: Processing XLSX file with grade data...");
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet1Name = "Sheet1";
    const sheet2Name = "Model Need to be Added";

    // allow either sheet missing but still process whatever exists
    const sheet1Data = workbook.Sheets[sheet1Name]
      ? xlsx.utils.sheet_to_json(workbook.Sheets[sheet1Name])
      : [];
    const sheet2Data = workbook.Sheets[sheet2Name]
      ? xlsx.utils.sheet_to_json(workbook.Sheets[sheet2Name])
      : [];
    const allRows = [...sheet1Data, ...sheet2Data];

    console.log(`📊 Found ${sheet1Data.length} rows in Sheet1`);
    console.log(`📊 Found ${sheet2Data.length} rows in Sheet2`);

    if (!allRows.length) {
      return res.status(400).json({
        message: "File is empty or sheets missing.",
      });
    }

    // Preload existing brands & models
    const allBrands = await Brand.find({}).lean();
    const brandMap = new Map(
      allBrands.map((b) => [b.name?.toLowerCase().trim(), b])
    );

    const allModels = await Model.find({}).lean();
    // map key: `${brandId}-${modelNameLower}`
    const modelMap = new Map(
      allModels.map((m) => [
        `${m.brandId.toString()}-${m.name?.toLowerCase().trim()}`,
        m,
      ])
    );

    const gradeOps = []; // gradeprice bulk ops
    let processed = 0;
    let brandsCreated = 0;
    let modelsCreated = 0;
    let rowsWithGrades = 0;

    // helper to normalize keys and extract grade values safely
    const normalizeRow = (row) => {
      const out = {};
      for (const k in row) {
        const normalizedKey = k.trim().toLowerCase();
        const value = typeof row[k] === "string" ? row[k].trim() : row[k];
        out[normalizedKey] = value;
      }
      return out;
    };

    // Helper to safely parse numeric values
    const parseNumber = (val) => {
      if (val === null || val === undefined || val === "") return 0;
      // Handle string numbers
      if (typeof val === "string") {
        const cleaned = val.replace(/[^0-9.-]/g, ""); // Remove non-numeric chars except . and -
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      }
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    for (const row of allRows) {
      processed++;
      const r = normalizeRow(row);

      // Debug: Log first row to see column names
      if (processed === 1) {
        console.log("📋 First row column names:", Object.keys(r));
        console.log("📋 First row sample data:", {
          brand: r["brand"],
          model: r["model details"] || r["model"],
          storage: r["storage"],
          ram: r["ram"],
          "a+warranty": r["a+warranty"],
          a: r["a"],
          b: r["b"],
          c: r["c"],
        });
      }

      // read common column names (fall back to possible variants)
      const brandName = (r["brand"] || r["brand name"] || "") + "";
      const modelName = (r["model details"] || r["model"] || "") + "";
      const storage = (r["storage"] || r["storages"] || "") + "";
      const ram = (r["ram"] || r["ram"] || r["memory"] || "") + "";

      // Skip rows with missing critical data
      if (!brandName || !modelName) {
        console.log(
          `⚠️ Skipping row ${processed}: Missing brand or model name`
        );
        continue;
      }

      // Build grades object - try multiple column name variations and parse safely
      const grades = {
        A_PLUS: parseNumber(
          r["a+warranty"] ||
            r["a+ warranty"] ||
            r["a+warranty "] ||
            r["a warranty"] ||
            r["a+ warranty"] ||
            r["a+warrenty"]
        ),
        A: parseNumber(r["a"]),
        B: parseNumber(r["b"]),
        B_MINUS: parseNumber(r["b-"] || r["b -"] || r["b minus"]),
        C_PLUS: parseNumber(r["c+"] || r["c +"] || r["c plus"]),
        C: parseNumber(r["c"]),
        C_MINUS: parseNumber(r["c-"] || r["c -"] || r["c minus"]),
        D_PLUS: parseNumber(r["d+"] || r["d +"] || r["d plus"]),
        D: parseNumber(r["d"]),
        D_MINUS: parseNumber(r["d-"] || r["d -"] || r["d minus"]),
        E: parseNumber(r["e"]),
      };

      // Check if row has valid grade data
      const hasValidGrades = Object.values(grades).some((val) => val > 0);
      if (hasValidGrades) {
        rowsWithGrades++;
      }

      // Debug logging every 100 rows
      if (processed % 100 === 0 || processed <= 5) {
        console.log(
          `Row ${processed}: ${brandName} - ${modelName} (${storage}/${ram})`
        );
        console.log(
          `  Grades: A+=${grades.A_PLUS}, A=${grades.A}, B=${grades.B}, C=${grades.C}, D=${grades.D}`
        );
      }

      // --- 1) Ensure Brand exists (create if missing) ---
      const brandKey = brandName.toLowerCase().trim();
      let brand = brandMap.get(brandKey);

      if (!brand) {
        // Brand doesn't exist in DB - CREATE IT
        const nextViewOn = await getNextViewOnValue(Brand);

        const newBrandPayload = {
          name: brandName,
          logo: generateBrandLogoUrl(brandName),
          viewOn: nextViewOn,
          deviceTypes: ["CTG1"],
          status: "Initiated",
        };

        brand = await Brand.create(newBrandPayload);
        brandsCreated++;
        console.log(`✨ Created new brand: ${brandName}`);

        // keep in map for future rows
        brandMap.set(brand.name.toLowerCase().trim(), brand);
      }

      // --- 2) Ensure Model exists (create if missing) ---
      const modelKey = `${brand._id.toString()}-${modelName
        .toLowerCase()
        .trim()}`;
      let model = modelMap.get(modelKey);

      if (!model) {
        // Model doesn't exist in DB - CREATE IT
        const configEntry = {
          storage: storage || "",
          RAM: ram || "",
          price: grades.A_PLUS || 0,
        };

        const newModelPayload = {
          brandId: brand._id,
          name: modelName || "Unknown",
          config: [configEntry],
          type: "CTG1",
          series: "",
          status: "Initiated",
          phonePhotos: { front: "", back: "", upFront: "", downFront: "" },
        };

        model = await Model.create(newModelPayload);
        modelsCreated++;
        console.log(
          `✨ Created new model: ${modelName} with config (${storage}/${ram})`
        );

        // keep in map
        modelMap.set(
          `${brand._id.toString()}-${model.name.toLowerCase().trim()}`,
          model
        );
      } else {
        // Model exists - check if this storage/RAM config exists
        const hasConfig = (model.config || []).some(
          (c) =>
            (c.storage || "").trim() === (storage || "").trim() &&
            (c.RAM || "").trim() === (ram || "").trim()
        );

        if (!hasConfig && (storage || ram)) {
          // Add new config to existing model
          await Model.updateOne(
            { _id: model._id },
            {
              $push: {
                config: {
                  storage: storage || "",
                  RAM: ram || "",
                  price: grades.A_PLUS || 0,
                },
              },
            }
          );
          console.log(
            `📝 Added config (${storage}/${ram}) to existing model: ${modelName}`
          );

          // refresh model in map
          const refreshed = await Model.findById(model._id).lean();
          modelMap.set(
            `${brand._id.toString()}-${refreshed.name.toLowerCase().trim()}`,
            refreshed
          );
          model = refreshed;
        }
      }

      // --- 3) Write gradeprice with ACTUAL grade data from sheet ---
      gradeOps.push({
        updateOne: {
          filter: {
            modelId: model._id,
            storage: storage || "",
            RAM: ram || "",
          },
          update: {
            $set: {
              modelId: model._id,
              storage: storage || "",
              RAM: ram || "",
              grades: grades, // Use actual grades from sheet
              price: grades.A_PLUS || 0,
            },
          },
          upsert: true,
        },
      });
    }

    console.log(
      `📊 Total rows with valid grade data: ${rowsWithGrades}/${processed}`
    );

    if (rowsWithGrades === 0) {
      console.warn(
        "⚠️ WARNING: No rows with valid grade data found! Check Excel column names."
      );
      console.warn("   Common issues:");
      console.warn("   - Column names don't match expected format");
      console.warn("   - Grade columns contain non-numeric data");
      console.warn("   - Column names have extra spaces or special characters");
    }

    // Execute bulkWrite for gradeprice
    let bulkResult = null;
    if (gradeOps.length) {
      console.log(`💾 Writing ${gradeOps.length} gradeprice records...`);

      // Show sample of what we're writing
      if (gradeOps.length > 0) {
        console.log(
          "📋 Sample gradeprice operation:",
          JSON.stringify(gradeOps[0], null, 2)
        );
      }

      bulkResult = await GradePrice.bulkWrite(gradeOps, { ordered: false });
      console.log(
        `✅ GradePrice bulk write complete: ${bulkResult.upsertedCount} upserted, ${bulkResult.modifiedCount} modified`
      );
    } else {
      console.warn("⚠️ No gradeprice operations to write!");
    }

    // Prepare response counts
    const upserted = bulkResult?.upsertedCount ?? 0;
    const modified = bulkResult?.modifiedCount ?? 0;
    const totalRows = allRows.length;

    return res.status(200).json({
      message: "✅ File processed successfully with grade data",
      summary: {
        xlsxRowsProcessed: processed,
        rowsWithValidGrades: rowsWithGrades,
        brandsCreated: brandsCreated,
        modelsCreated: modelsCreated,
        gradePriceUpserted: upserted,
        gradePriceModified: modified,
        totalGradePriceRecords: upserted + modified,
      },
      details: {
        sheet1Rows: sheet1Data.length,
        sheet2Rows: sheet2Data.length,
        totalRows: totalRows,
      },
    });
  } catch (error) {
    console.error("❌ Error in addEditModelsAndPricexlsv:", error);
    return res
      .status(500)
      .json({ message: "Failed to process file.", error: error.message });
  }
};

/**
 * @desc Standalone endpoint to sync existing models to gradeprice
 * Can be called independently without XLSX upload
 */
const syncModelsToGradePrice = async (req, res) => {
  try {
    const result = await syncExistingModelsToGradePrice();
    return res.status(200).json({
      message: "Successfully synced existing models to gradeprice",
      synced: result.synced,
      totalModels: result.totalModels,
      totalConfigs: result.totalConfigs,
      alreadyExisting: result.alreadyExisting,
    });
  } catch (error) {
    console.error("Error syncing models:", error);
    return res.status(500).json({
      message: "Failed to sync models",
      error: error.message,
    });
  }
};

export default {
  addEditModelsAndPrice,
  modelPriceList,
  getModelWisePrice,
  addEditModelsAndPricexlsv,
  syncModelsToGradePrice, // New endpoint
};
