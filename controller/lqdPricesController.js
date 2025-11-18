import csv from "../controller/questionnaireController.js";
import modelsModel from "../models/modelsModel.js";
import brandModel from "../models/brandsModel.js";
import liquidatorsModel from "../models/liquidatorsModel.js";
import lqdPriceModel from "../models/lqdpriceModel.js";

//Bulk Upload Prices
const processModel = async (a, brandId, liquidatorId) => {
  const mod = a["Model Details"].split("(");
  const finalMod = mod[0].trim();
  const store = mod[1].split("/");
  const storage = store[1].replace(")", "");
  const RAM = store[0];
  const series = a["Series"] || "";

  const model = await modelsModel.findOne({
    name: { $regex: `^${finalMod}$`, $options: "i" },
    brandId,
    type: "CTG1",
  });

  if (model) {
    return updateExistingModel(model, a, storage, RAM, liquidatorId);
  } else {
    return createNewModel(brandId, finalMod, storage, RAM, series, liquidatorId, a);
  }
};

const updateExistingModel = async (model, a, storage, RAM, liquidatorId) => {
  const configExistsIndex = model.config.findIndex(
    (c) => c.storage === storage && c.RAM === RAM
  );
  if (configExistsIndex === -1) {
    model.config.push({
      storage: storage,
      RAM: RAM,
      price: "",
    });
  }

  await model.save();
  updateLQDPrice(liquidatorId, model._id, a, storage, RAM);
  return { updated: true, model: model };
};

const createNewModel = async (brandId, finalMod, storage, RAM, series, liquidatorId, a) => {
  const newModel = {
    brandId,
    name: finalMod,
    config: [
      {
        storage: storage,
        RAM: RAM,
        price: "",
      },
    ],
    series: series,
    type: "CTG1",
  };

  const createdModel = await modelsModel.create(newModel);
  updateLQDPrice(liquidatorId, createdModel._id, a, storage, RAM);
  return { updated: false, model: createdModel };
};

const processCsv = async (cs, liquidatorId) => {
  const rejected = [];
  const inserted = [];
  let updated = 0;

  for (const a of cs) {
    const brand = await brandModel
      .findOne({ name: { $regex: a["Brand"], $options: "i" } })
      .select("_id");

    if (brand) {
      const { updated: isUpdated, model } = await processModel(a, brand._id, liquidatorId);
      if (isUpdated) {
        updated += 1;
        console.log("Updated:", model.name);
      } else {
        inserted.push(a);
        console.log("Inserted:", model.name);
      }
    } else {
      rejected.push(a);
    }
  }

  return { rejected, inserted, updated };
};

const addLiquidatorsPrices = async (req, res) => {
  const { PriceSheet } = req.files;
  const cs = csv.convertCsvToJson(PriceSheet[0]);
  const lqdName = req.body.liquidatorName;

  const rejected = [];
  const inserted = [];
  let updated = 0;

  try {
    const liquidator = await liquidatorsModel.findOne({ name: lqdName });

    if (!liquidator) {
      return res.status(500).json({ message: "Liquidator Not Found!!" });
    }

    const { rejected: rejectData, inserted: insertedData, updated: updatedCount } = await processCsv(cs, liquidator._id);

    rejected.push(...rejectData);
    inserted.push(...insertedData);
    updated = updatedCount;

    return res.status(200).json({
      rejected,
      inserted,
      message: `${inserted.length} Model and prices created, ${updated} updated and ${rejected.length} rejected.`,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};


const updateLQDPrice = async (liquidatorId, modelId, data, storage, RAM) => {
  try {
    const query = {
      liquidatorId,
      modelId,
      storage,
      $or: [
        { RAM: { $exists: false } }, // RAM field doesn't exist
        { RAM }, // RAM field exists and matches provided value
      ],
    };

    await lqdPriceModel.findOneAndUpdate(
      query,
      {
        $set: {
          liquidatorId,
          modelId,
          storage,
          RAM,
          maxPrice: data["MaxPrice"],
          minPrice: data["MinPrice"],
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.log(error);
  }
};

export default {
  addLiquidatorsPrices,
};
