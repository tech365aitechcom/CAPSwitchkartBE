import liquidatorModel from "../models/liquidatorsModel.js";

//GetALLLiquidators
const findAll = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 0;
    const query = {};
    const search = req.query.search || "";
    if (search) {
      query["$or"] = [
        { name: { $regex: search, $options: "i" } },
        { uniqueCode: { $regex: search, $options: "i" } },
      ];
    }
    const data = await liquidatorModel
      .find(query)
      .limit(limit)
      .skip(limit * page);

    return res
      .status(200)
      .json({
        data,
        message: "Successfully Fetched Liquidators",
      });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

//Create
const create = async (req, res) => {
  try {
    const { name, email, phoneNumber, uniqueCode, address } = req.body;
    const exist = await liquidatorModel.findOne({ uniqueCode });
    if (exist) {
      return res.status(400).json({ message: "Liquidator Already Exist." })
    }
    const liquidator = await liquidatorModel.create({
      name, email, phoneNumber,
      uniqueCode, address
    });

    return res
      .status(200)
      .json({ data: liquidator, message: "Liquidator Created Successfully." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

//Update
const update = async (req, res) => {
  try {
    const liquidator = await liquidatorModel.findOne({ _id: req.body.id });
    if (!liquidator) {
      return res.status(404).json({ message: "Liquidator Not Found" });
    }

    await liquidatorModel.findOneAndUpdate(
      { _id: req.body.id },
      req.body,
      { new: true }
    );

    return res.status(200).json({ message: "Liquidator Updated Successfully." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

//Delete
const deleteById = async (req, res) => {
  try {
    const { id } = req.body;
    const modfierRole = req.role;

    if (modfierRole !== "Super Admin" && modfierRole !== "Admin Manager") {
      return res.status(403).json({
        msg: "Unauthorized: You do not have permission to delete a Liquidator.",
      });
    }

    await liquidatorModel.findByIdAndDelete(id);
    return res.status(200).json({ message: "Liquidator Deleted Successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ msg: error.message });
  }
};

export default {
  create,
  update,
  deleteById,
  findAll
};
