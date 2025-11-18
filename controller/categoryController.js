import categoryModel from "../models/categoryModel.js";
const getCategory = async (req, res) => {
  try {
    const data = await categoryModel.find().sort({ viewOn: 1 });
    res.status(200).json({ data, message: "categories fetched successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export default {
  getCategory,
};
