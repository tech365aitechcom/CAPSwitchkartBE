import mongoose from "mongoose";
import brands from "../models/brandsModel.js";
import models from "../models/modelsModel.js";
import s3Controller from "./s3.controller.js";
const categoryInfo = "$categoryInfo";
const create = async (req, res) => {
  try {
    const brandName = req.body.brandName;
    const { brandImage } = req.files;
    const logo = brandImage ? await s3Controller.uploadFile(brandImage[0]) : "";
    let brand = await brands.findOne({ name: brandName });
    if (brand) {
      await brands.findOneAndUpdate(
        { name: brandName },
        { $set: { logo: logo } },
        { new: true }
      );
    } else {
      brand = await brands.create({
        name: brandName,
        logo: logo,
        deviceTypes: ["CTG3"],
      });
    }

    res
      .status(200)
      .json({ data: brand, message: "brand created successfully." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const updateBrand = async (req, res) => {
  try {
    const brandName = req.body.brandName;
    const { brandImage } = req?.files;
    const brandUpd = JSON.parse(req.body.brandUpd);

    const brand = await brands.findOne({ name: brandName });
    const logo = brandImage
      ? await s3Controller.uploadFile(brandImage[0])
      : brand.logo;
    brandUpd.logo = logo;
    await brands.findOneAndUpdate(
      { name: brandName },
      { $set: brandUpd },
      { new: true }
    );

    res
      .status(200)
      .json({ data: brandUpd, message: "brand updated successfully." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const createModel = async (req, res) => {
  try {
    const modal = await models.create(req.body);
    res
      .status(200)
      .json({ data: modal, message: "brand created successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBrands = async (req, res) => {
  try {
    const deviceType = req.query.deviceType;
    const query = deviceType ? { deviceTypes: deviceType } : {};
    const data = await brands.find(query).sort({ viewOn: 1 });
    res.status(200).json({ data, message: "brands fetched successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllBrandsModels = async (req, res) => {
  const deviceType = req.query.type || "CTG1";

  try {
    const data = await models.aggregate([
      {
        $match: {
          type: deviceType,
        },
      },
      {
        $lookup: {
          from: "brands",
          localField: "brandId",
          foreignField: "_id",
          as: "brandInfo",
        },
      },
      {
        $unwind: "$brandInfo",
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
        $unwind: categoryInfo,
      },
      {
        $group: {
          _id: "$brandId",
          brand: { $first: "$brandInfo" },
          models: {
            $push: {
              _id: "$_id",
              name: "$name",
              core: "$core",
              config: "$config",
              chipset: "$chipset",
              back_camera: "$back_camera",
              front_camera: "$front_camera",
              type: "$type",
              categoryName: "$categoryInfo.categoryName",
            },
          },
        },
      },
    ]);
    res.status(200).json({ data, message: "data fetched successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//slecetd brnad all models

const SelectedBrandModels = async (req, res) => {
  const deviceType = req.body.deviceType || "CTG1";
  const brandId = req.body.brandId;
  const search = req.body.search || "";
  const series = req.body.series || "";

  try {
    const documents = await models.aggregate([
      {
        $match: {
          brandId: new mongoose.Types.ObjectId(brandId),
          type: deviceType,
          name: { $regex: search, $options: "i" },
          series: { $regex: series },
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
        $unwind: categoryInfo,
      },
    ]);

    const seriesList = await models.aggregate([
      {
        $match: {
          brandId: new mongoose.Types.ObjectId(brandId),
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
        $unwind: categoryInfo,
      },
      { $group: { _id: "$series" } },
      { $sort: { _id: 1 } },
    ]);
    let uniqueSeriesList = seriesList
      .filter((item) => item._id !== "")
      .map((item) => ({ name: item._id, seriesKey: item._id }));
    uniqueSeriesList = [{ name: "All", seriesKey: "" }, ...uniqueSeriesList];
    res.status(200).json({ seriesList: uniqueSeriesList, models: documents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export default {
  create,
  updateBrand,
  createModel,
  getBrands,
  getAllBrandsModels,
  SelectedBrandModels,
};
