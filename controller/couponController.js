import CouponModel from "../models/couponModel.js";
import CouponRedemptionModel from "../models/couponRedemptionModel.js";
import leadModel from "../models/leadsModel.js";
import userModel from "../models/UsersModel.js";
import mongoose from "mongoose";

const ISE = "Internal Server Error";

const checkSuperAdmin = async (userId) => {
  const authenticatedUser = await userModel.findById(userId).select("role");
  if (!authenticatedUser) {
    throw { status: 404, message: "Authenticated user not found." };
  }
  if (authenticatedUser.role !== "Super Admin") {
    throw {
      status: 403,
      message:
        "Access denied. You do not have permission to perform this action.",
    };
  }
};

const createCoupon = async (req, res) => {
  try {
    await checkSuperAdmin(req.userId);
    const { storeId, devicePriceRange } = req.body;
    const overlappingCoupon = await CouponModel.findOne({
      storeId,
      "devicePriceRange.min": { $lt: devicePriceRange.max },
      "devicePriceRange.max": { $gt: devicePriceRange.min },
    });

    if (overlappingCoupon) {
      return res.status(409).json({
        message: `A coupon ('${overlappingCoupon.couponCode}') already exists for an overlapping price range in this store. One range can only have one coupon.`,
      });
    }

    const newCoupon = new CouponModel({
      ...req.body,
      createdBy: req.userId,
    });
    const savedCoupon = await newCoupon.save();
    return res
      .status(201)
      .json({ message: "Coupon created successfully.", data: savedCoupon });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: `Coupon code '${req.body.couponCode}' already exists. Please choose a unique code.`,
      });
    }
    console.error("Error creating coupon:", error);
    return res.status(500).json({ message: ISE, error: error.message });
  }
};

const findEligibleCoupon = async (req, res) => {
  try {
    const { leadId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({ message: "Invalid Lead ID." });
    }

    const lead = await leadModel.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found." });
    }
    const leadUser = await userModel.findById(lead.userId).select("storeId");
    if (!leadUser || !leadUser.storeId) {
      return res
        .status(404)
        .json({ message: "Lead is not associated with a store." });
    }
    const query = {
      storeId: leadUser.storeId,
      status: "Active",
      "devicePriceRange.min": { $lte: lead.price },
      "devicePriceRange.max": { $gte: lead.price },
    };

    const eligibleCoupon = await CouponModel.findOne(query).sort({
      createdAt: -1,
    });

    if (!eligibleCoupon) {
      return res.status(404).json({
        message: "No eligible coupon found for this device's price range.",
      });
    }

    return res.status(200).json({ data: eligibleCoupon });
  } catch (error) {
    console.error("--- [CRITICAL ERROR] in findEligibleCoupon ---");
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const listCoupons = async (req, res) => {
  try {
    await checkSuperAdmin(req.userId);
    const { storeName, couponCode, imei, id } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    let matchQuery = {};
    if (couponCode) {
      matchQuery.couponCode = { $regex: couponCode, $options: "i" };
    }
    if (id) {
      matchQuery._id = new mongoose.Types.ObjectId(id);
    }
    if (imei) {
      const redemptions = await CouponRedemptionModel.find({
        imei: { $regex: imei, $options: "i" },
      }).select("couponId");
      const couponIds = redemptions.map((r) => r.couponId);
      matchQuery._id = { $in: couponIds };
    }

    const storeLookupPipeline = [
      {
        $lookup: {
          from: "stores",
          localField: "storeId",
          foreignField: "_id",
          as: "store",
        },
      },
      { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
    ];
    if (storeName) {
      storeLookupPipeline.push({
        $match: { "store.storeName": { $regex: storeName, $options: "i" } },
      });
    }

    const pipeline = [
      { $match: matchQuery },
      ...storeLookupPipeline,
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "creator",
        },
      },
      { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "couponredemptions",
          localField: "_id",
          foreignField: "couponId",
          as: "redemptions",
        },
      },
    ];

    pipeline.push(
      {
        $addFields: {
          effectiveStatus: {
            $cond: {
              if: {
                $and: [
                  { $eq: ["$status", "Active"] },
                  { $lt: ["$validTo", new Date()] },
                ],
              },
              then: "Inactive",
              else: "$status",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          couponCode: 1,
          storeId: 1,
          storeName: "$store.storeName",
          devicePriceRange: 1,
          discountType: 1,
          discountValue: 1,
          validFrom: 1,
          validTo: 1,
          status: "$effectiveStatus",
          createdBy: {
            $ifNull: [
              { $concat: ["$creator.firstName", " ", "$creator.lastName"] },
              "N/A",
            ],
          },
          createdAt: 1,
          updatedAt: 1,
          totalRedemptions: { $size: "$redemptions" },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          paginatedResults: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      }
    );

    const result = await CouponModel.aggregate(pipeline);
    const coupons = result[0].paginatedResults;
    const totalRecords = result[0].totalCount[0]
      ? result[0].totalCount[0].count
      : 0;

    res.status(200).json({
      data: coupons,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRecords / limit),
        totalRecords,
      },
    });
  } catch (error) {
    console.error("Error listing coupons:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, leadId, imei } = req.body;
    const { userId } = req;

    if (!couponCode || !leadId || !imei) {
      return res
        .status(400)
        .json({ message: "Coupon code, Lead ID, and IMEI are all required." });
    }

    const existingImeiRedemption = await CouponRedemptionModel.findOne({
      imei: imei,
    });
    if (existingImeiRedemption) {
      return res.status(409).json({
        message: `This device (IMEI) has already used a coupon. Please remove the coupon bonus to proceed with the sale.`,
      });
    }
    const coupon = await CouponModel.findOne({
      couponCode: couponCode.toUpperCase(),
    });
    const lead = await leadModel.findById(leadId);

    if (!lead) return res.status(404).json({ message: "Lead not found." });
    if (!coupon)
      return res
        .status(404)
        .json({ message: `Coupon '${couponCode}' not found.` });

    const leadUser = await userModel.findById(lead.userId).select("storeId");
    if (!leadUser || !leadUser.storeId) {
      return res.status(400).json({
        message: "Cannot apply coupon: Lead is not associated with a store.",
      });
    }

    const now = new Date();
    const indiaTime = now.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    if (coupon.status !== "Active") {
      return res
        .status(400)
        .json({ message: `Coupon '${couponCode}' is not active.` });
    }
    if (indiaTime < coupon.validFrom || indiaTime > coupon.validTo) {
      return res.status(400).json({
        message: `Coupon '${couponCode}' is expired or not yet valid.`,
      });
    }
    if (coupon.storeId.toString() !== leadUser.storeId.toString()) {
      return res.status(400).json({
        message: `Coupon '${couponCode}' is not valid for this store.`,
      });
    }

    const devicePrice = lead.price;
    if (
      devicePrice < coupon.devicePriceRange.min ||
      devicePrice > coupon.devicePriceRange.max
    ) {
      return res.status(400).json({
        message: `Coupon '${couponCode}' is not valid for this device's price (₹${devicePrice}).`,
      });
    }

    const discountAmount =
      coupon.discountType === "Fixed"
        ? coupon.discountValue
        : (devicePrice * coupon.discountValue) / 100;

    const finalBonusPrice = Math.round(discountAmount);

    await CouponRedemptionModel.create({
      couponId: coupon._id,
      leadId: lead._id,
      userId: userId,
      discountAmount: finalBonusPrice,
      imei: imei,
    });

    lead.bonusPrice = finalBonusPrice;
    await lead.save();

    res.status(200).json({
      message: "Coupon applied successfully.",
      data: {
        leadId: lead._id,
        bonusPrice: lead.bonusPrice,
      },
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.leadId) {
      return res.status(409).json({
        message: "A coupon has already been applied to this specific quote.",
      });
    }
    console.error("Error applying coupon:", error);
    res.status(500).json({
      message: `Coupon ${req.body.couponCode} is not valid for this device or has already been used.`,
      error: error.message,
    });
  }
};

const updateCoupon = async (req, res) => {
  try {
    await checkSuperAdmin(req.userId);
    const { id } = req.params;
    const updateData = req.body;
    if (updateData.status && updateData.status === "Active") {
      let validToDate = updateData.validTo
        ? new Date(updateData.validTo)
        : null;

      if (!validToDate) {
        const couponToUpdate = await CouponModel.findById(id);
        if (!couponToUpdate) {
          return res.status(404).json({ message: "Coupon not found." });
        }
        validToDate = couponToUpdate.validTo;
      }
      if (validToDate < new Date()) {
        return res.status(400).json({
          message:
            "Cannot activate an expired coupon. Please update the 'Valid To' date first.",
        });
      }
    }

    delete updateData.createdBy;
    delete updateData.storeId;
    delete updateData.couponCode;

    const updatedCoupon = await CouponModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedCoupon) {
      return res.status(404).json({ message: "Coupon not found." });
    }
    return res
      .status(200)
      .json({ message: "Coupon updated successfully.", data: updatedCoupon });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return res.status(500).json({ message: ISE, error: error.message });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    await checkSuperAdmin(req.userId);
    const { id } = req.params;
    const coupon = await CouponModel.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found." });
    }
    await CouponModel.findByIdAndDelete(id);
    return res.status(200).json({
      message: "Coupon was unused and has been deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return res.status(500).json({ message: ISE, error: error.message });
  }
};

export default {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  listCoupons,
  applyCoupon,
  findEligibleCoupon,
};
