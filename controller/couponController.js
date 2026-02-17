import CouponModel from '../models/couponModel.js'
import CouponRedemptionModel from '../models/couponRedemptionModel.js'
import leadModel from '../models/leadsModel.js'
import userModel from '../models/UsersModel.js'
import mongoose from 'mongoose'

const ISE = 'Internal Server Error'
const USER_NOT_FOUND = 'Authenticated user not found.'
const ACCESS_DENIED =
  'Access denied. You do not have permission to perform this action.'
const LEAD_NOT_FOUND = 'Lead not found.'
const COUPON_NOT_FOUND = 'Coupon not found.'

const checkSuperAdmin = async (userId) => {
  const authenticatedUser = await userModel.findById(userId).select('role')
  if (!authenticatedUser) {
    const error = new Error(USER_NOT_FOUND)
    error.status = 404
    throw error
  }
  if (authenticatedUser.role !== 'Super Admin') {
    const error = new Error(ACCESS_DENIED)
    error.status = 403
    throw error
  }
}

const createCoupon = async (req, res) => {
  try {
    await checkSuperAdmin(req.userId)

    const newCoupon = new CouponModel({
      ...req.body,
      createdBy: req.userId,
    })
    const savedCoupon = await newCoupon.save()
    return res
      .status(201)
      .json({ message: 'Coupon created successfully.', data: savedCoupon })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: `Coupon code '${req.body.couponCode}' already exists. Please choose a unique code.`,
      })
    }
    console.error('Error creating coupon:', error)
    return res.status(500).json({ message: ISE, error: error.message })
  }
}

const findEligibleCoupon = async (req, res) => {
  try {
    const { leadId } = req.params
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({ message: 'Invalid Lead ID.' })
    }

    const lead = await leadModel.findById(leadId)
    if (!lead) {
      return res.status(404).json({ message: LEAD_NOT_FOUND })
    }
    const leadUser = await userModel.findById(lead.userId).select('storeId')
    if (!leadUser || !leadUser.storeId) {
      return res
        .status(404)
        .json({ message: 'Lead is not associated with a store.' })
    }
    // Query where the coupon's storeId array contains the lead's storeId
    const query = {
      storeId: leadUser.storeId,
      status: 'Active',
      'devicePriceRange.min': { $lte: lead.price },
      'devicePriceRange.max': { $gte: lead.price },
    }

    // Find all eligible coupons, not just one
    const eligibleCoupons = await CouponModel.find(query).sort({
      createdAt: -1,
    })

    // Always return an array, even if empty
    if (eligibleCoupons.length === 0) {
      return res.status(200).json({
        data: [],
        message: "No eligible coupon found for this device's price range.",
      })
    }

    return res.status(200).json({ data: eligibleCoupons })
  } catch (error) {
    console.error('--- [CRITICAL ERROR] in findEligibleCoupon ---')
    console.error(error)
    return res.status(500).json({ message: ISE, error: error.message })
  }
}

const listCoupons = async (req, res) => {
  try {
    await checkSuperAdmin(req.userId)
    const { storeName, couponCode, imei, id } = req.query
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 10
    const skip = (page - 1) * limit

    const matchQuery = {}
    if (couponCode) {
      matchQuery.couponCode = { $regex: couponCode, $options: 'i' }
    }
    if (id) {
      matchQuery._id = new mongoose.Types.ObjectId(id)
    }
    if (imei) {
      const redemptions = await CouponRedemptionModel.find({
        imei: { $regex: imei, $options: 'i' },
      }).select('couponId')
      const couponIds = redemptions.map((r) => r.couponId)
      matchQuery._id = { $in: couponIds }
    }

    const storeLookupPipeline = [
      {
        $lookup: {
          from: 'stores',
          localField: 'storeId', // This is now an array
          foreignField: '_id',
          as: 'stores',
        },
      },
      // REMOVED: { $unwind: ... } because we want to keep the array of stores
    ]
    //{ $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },

    if (storeName) {
      storeLookupPipeline.push({
        $match: { 'stores.storeName': { $regex: storeName, $options: 'i' } },
      })
    }

    const pipeline = [
      { $match: matchQuery },
      ...storeLookupPipeline,
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'couponredemptions',
          localField: '_id',
          foreignField: 'couponId',
          as: 'redemptions',
        },
      },
    ]

    pipeline.push(
      {
        $addFields: {
          effectiveStatus: {
            $cond: {
              if: {
                $and: [
                  { $eq: ['$status', 'Active'] },
                  { $lt: ['$validTo', new Date()] },
                ],
              },
              then: 'Inactive',
              else: '$status',
            },
          },
          storeNamesList: {
            $reduce: {
              input: '$stores',
              initialValue: '',
              in: {
                $cond: {
                  if: { $eq: ['$$value', ''] },
                  then: '$$this.storeName',
                  else: { $concat: ['$$value', ', ', '$$this.storeName'] },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          couponCode: 1,
          storeId: 1,
          storeName: '$storeNamesList', // Mapped from the reduce above
          devicePriceRange: 1,
          discountType: 1,
          discountValue: 1,
          validFrom: 1,
          validTo: 1,
          status: '$effectiveStatus',
          createdBy: {
            $ifNull: [
              { $concat: ['$creator.firstName', ' ', '$creator.lastName'] },
              'N/A',
            ],
          },
          createdAt: 1,
          updatedAt: 1,
          totalRedemptions: { $size: '$redemptions' },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          paginatedResults: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      }
    )

    const result = await CouponModel.aggregate(pipeline)
    const coupons = result[0].paginatedResults
    const totalRecords = result[0].totalCount[0]
      ? result[0].totalCount[0].count
      : 0

    return res.status(200).json({
      data: coupons,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalRecords / limit),
        totalRecords,
      },
    })
  } catch (error) {
    console.error('Error listing coupons:', error)
    return res.status(500).json({ message: ISE, error: error.message })
  }
}

const validateCouponEligibility = (
  coupon,
  lead,
  leadUser,
  couponCode,
  indiaTime
) => {
  if (coupon.status !== 'Active') {
    return {
      valid: false,
      status: 400,
      message: `Coupon '${couponCode}' is not active.`,
    }
  }
  if (indiaTime < coupon.validFrom || indiaTime > coupon.validTo) {
    return {
      valid: false,
      status: 400,
      message: `Coupon '${couponCode}' is expired or not yet valid.`,
    }
  }
  // Assuming coupon.storeId is an array of ObjectIds
  const isStoreValid = coupon.storeId.some(
    (id) => id.toString() === leadUser.storeId.toString()
  )

  if (!isStoreValid) {
    return {
      valid: false,
      status: 400,
      message: `Coupon '${couponCode}' is not valid for this store.`,
    }
  }

  const devicePrice = lead.price
  if (
    devicePrice < coupon.devicePriceRange.min ||
    devicePrice > coupon.devicePriceRange.max
  ) {
    return {
      valid: false,
      status: 400,
      message: `Coupon '${couponCode}' is not valid for this device's price (₹${devicePrice}).`,
    }
  }

  return { valid: true }
}

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, leadId, imei } = req.body

    if (!couponCode || !leadId || !imei) {
      return res
        .status(400)
        .json({ message: 'Coupon code, Lead ID, and IMEI are all required.' })
    }

    // Check if IMEI already used a coupon
    const existingImeiRedemption = await CouponRedemptionModel.findOne({
      imei: imei,
    })
    if (existingImeiRedemption) {
      return res.status(409).json({
        message: `This device (IMEI) has already used a coupon. Please remove the coupon bonus to proceed with the sale.`,
      })
    }

    const coupon = await CouponModel.findOne({
      couponCode: couponCode.toUpperCase(),
    })
    const lead = await leadModel.findById(leadId)

    if (!lead) {
      return res.status(404).json({ message: LEAD_NOT_FOUND })
    }
    if (!coupon) {
      return res
        .status(404)
        .json({ message: `Coupon '${couponCode}' not found.` })
    }

    const leadUser = await userModel.findById(lead.userId).select('storeId')
    if (!leadUser || !leadUser.storeId) {
      return res.status(400).json({
        message: 'Cannot apply coupon: Lead is not associated with a store.',
      })
    }

    const now = new Date()
    const indiaTime = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
    })

    // Validation checks
    const validation = validateCouponEligibility(
      coupon,
      lead,
      leadUser,
      couponCode,
      indiaTime
    )
    if (!validation.valid) {
      return res.status(validation.status).json({ message: validation.message })
    }

    // Calculate discount
    const devicePrice = lead.price
    const discountAmount =
      coupon.discountType === 'Fixed'
        ? coupon.discountValue
        : (devicePrice * coupon.discountValue) / 100

    const finalBonusPrice = Math.round(discountAmount)

    // Create redemption record
    await CouponRedemptionModel.create({
      couponId: coupon._id,
      leadId: lead._id,
      userId: req.userId,
      discountAmount: finalBonusPrice,
      imei: imei,
    })

    // Update lead with bonus price
    lead.bonusPrice = finalBonusPrice
    await lead.save()

    return res.status(200).json({
      message: 'Coupon applied successfully.',
      data: {
        leadId: lead._id,
        bonusPrice: lead.bonusPrice,
        couponCode: coupon.couponCode,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
    })
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.leadId) {
      return res.status(409).json({
        message: 'A coupon has already been applied to this specific quote.',
      })
    }
    console.error('Error applying coupon:', error)
    return res.status(500).json({
      message: `Coupon ${req.body.couponCode} is not valid for this device or has already been used.`,
      error: error.message,
    })
  }
}

const removeCoupon = async (req, res) => {
  try {
    const { leadId } = req.params

    if (!leadId) {
      return res.status(400).json({ message: 'Lead ID is required.' })
    }

    const lead = await leadModel.findById(leadId)
    if (!lead) {
      return res.status(404).json({ message: LEAD_NOT_FOUND })
    }

    // Find and remove redemption record
    const redemption = await CouponRedemptionModel.findOneAndDelete({
      leadId: leadId,
    })

    if (!redemption) {
      return res.status(404).json({
        message: 'No coupon applied to this lead.',
      })
    }

    // Reset bonus price to 0
    lead.bonusPrice = 0
    await lead.save()

    return res.status(200).json({
      message: 'Coupon removed successfully.',
      data: {
        leadId: lead._id,
        bonusPrice: lead.bonusPrice,
      },
    })
  } catch (error) {
    console.error('Error removing coupon:', error)
    return res.status(500).json({
      message: ISE,
      error: error.message,
    })
  }
}

const updateCoupon = async (req, res) => {
  try {
    await checkSuperAdmin(req.userId)
    const { id } = req.params
    const updateData = req.body

    if (updateData.status && updateData.status === 'Active') {
      let validToDate = updateData.validTo ? new Date(updateData.validTo) : null

      if (!validToDate) {
        const couponToUpdate = await CouponModel.findById(id)
        if (!couponToUpdate) {
          return res.status(404).json({ message: COUPON_NOT_FOUND })
        }
        validToDate = couponToUpdate.validTo
      }
      if (validToDate < new Date()) {
        return res.status(400).json({
          message:
            "Cannot activate an expired coupon. Please update the 'Valid To' date first.",
        })
      }
    }

    delete updateData.createdBy
    delete updateData.couponCode

    const updatedCoupon = await CouponModel.findByIdAndUpdate(id, updateData, {
      new: true,
    })

    if (!updatedCoupon) {
      return res.status(404).json({ message: COUPON_NOT_FOUND })
    }
    return res
      .status(200)
      .json({ message: 'Coupon updated successfully.', data: updatedCoupon })
  } catch (error) {
    console.error('Error updating coupon:', error)
    return res.status(500).json({ message: ISE, error: error.message })
  }
}

const deleteCoupon = async (req, res) => {
  try {
    await checkSuperAdmin(req.userId)
    const { id } = req.params
    const coupon = await CouponModel.findById(id)
    if (!coupon) {
      return res.status(404).json({ message: COUPON_NOT_FOUND })
    }
    await CouponModel.findByIdAndDelete(id)
    return res.status(200).json({
      message: 'Coupon was unused and has been deleted successfully.',
    })
  } catch (error) {
    console.error('Error deleting coupon:', error)
    return res.status(500).json({ message: ISE, error: error.message })
  }
}

export default {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  listCoupons,
  applyCoupon,
  removeCoupon,
  findEligibleCoupon,
}
