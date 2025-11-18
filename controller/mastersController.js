import masters from "../models/mastersModel.js";
import csv from "../controller/questionnaireController.js";

const insertMany = async (req, res) => {
  const cs = csv.convertCsvToJson(req.file);
  try {
    const data = await masters.insertMany(cs);
    res
      .status(200)
      .json({ data, message: "questionnaires created successfully." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

export default {
  insertMany,
};
