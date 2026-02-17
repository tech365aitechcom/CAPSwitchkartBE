import gradeprice from '../models/gradePriceModel.js'
import modelsModel from '../models/modelsModel.js'
import brandModel from '../models/brandsModel.js'
import leadsModel from '../models/leadsModel.js'
import devicesLotModel from '../models/devicesLotModel.js'
import mongoose from 'mongoose'

// ---------------- Constants ----------------
const CATEGORY_MAPPING = {
  Mobile: 'CTG1',
  iPad: 'CTG5',
  Watch: 'CTG2',
}

const MESSAGES = {
  MISSING_PARAMS:
    'Missing required parameters: category, brand, model, storage are required',
  INVALID_CATEGORY: 'Invalid category. Must be one of: Mobile, iPad, Watch',
  BRAND_NOT_FOUND: 'Brand not found',
  MODEL_NOT_FOUND: 'Model not found for the specified brand and category',
  NO_PRICING: 'No pricing found for the specified configuration',
  NO_VALID_PRICES: 'No valid prices found for this configuration',
  LEADS_SUCCESS: 'Leads complete data retrieved successfully',
  DEVICE_STATUS_SUCCESS: 'Device status data retrieved successfully',
}

const SEPARATOR = ' - '
const STATUS_COMPLETED = 'Completed'

// Parse multiple store IDs from environment variable
const getSangeetaStoreIds = () => {
  const storeIdsString = process.env.SANGEETA_STORE_IDS || ''
  return storeIdsString
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id)
    .map((id) => new mongoose.Types.ObjectId(id))
}

const USER_FULL_NAME_CONCAT = {
  $concat: ['$user.firstName', ' ', '$user.lastName'],
}

const DEVICE_LOT_PRODUCT_NAME = {
  $concat: ['Lot of ', { $toString: '$totalDevice' }, ' devices'],
}

const VARIANT_CONCAT = {
  $concat: ['$ram', '/', '$storage'],
}

const PHONE_NUMBER_FIELD = '$phoneNumber'

const STORE_LOCATION_CONCAT = {
  $concat: ['$storeData.storeName', SEPARATOR, '$storeData.region'],
}

const STORE_NAME_FIELD = '$store.storeName'
const STORE_REGION_FIELD = '$store.region'

const IS_SELLED_FIELD = 'is_selled'

// ---------------- Common Helpers ----------------

// Create pagination facet
const createPaginationFacet = (page, limit) => ({
  $facet: {
    data: [
      { $sort: { updatedAt: -1 } },
      { $skip: page * limit },
      { $limit: limit },
    ],
    totalCount: [{ $count: 'count' }],
  },
})

// Aggregation result processor
const processAggregationResult = (result) => {
  const facetResult = result[0]
  return {
    data: facetResult.data,
    totalCount: facetResult.totalCount[0]?.count || 0,
  }
}

// Deduplication stages
const deduplicationStages = [
  { $group: { _id: '$_id', doc: { $first: '$$ROOT' } } },
  { $replaceRoot: { newRoot: '$doc' } },
]

// Error handler
const handleControllerError = (error, res) => {
  console.error(error)
  return res.status(500).json({ message: error.message })
}

// Projection fields (common)
const commonProjectionFields = {
  username: USER_FULL_NAME_CONCAT,
  category: '$category.categoryName',
  productName: '$model.name',
  variant: VARIANT_CONCAT,
  price: '$price',
  finalPrice: '$finalPrice',
  imeiNo: '$document.IMEI',
  customerName: '$name',
  customerMobile: PHONE_NUMBER_FIELD,
}

// Generic lookup + unwind helper
const createLookupUnwind = (
  from,
  localField,
  foreignField,
  as,
  preserve = true
) => [
  {
    $lookup: {
      from,
      localField,
      foreignField,
      as,
    },
  },
  { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: preserve } },
]

// ---------------- Reusable Stages ----------------
const userLookupStage = {
  $lookup: {
    from: 'users',
    localField: 'userId',
    foreignField: '_id',
    as: 'user',
  },
}

const modelLookupStage = {
  $lookup: {
    from: 'models',
    localField: 'modelId',
    foreignField: '_id',
    as: 'model',
  },
}

const documentLookupStage = {
  $lookup: {
    from: 'documents',
    localField: 'documentId',
    foreignField: '_id',
    as: 'document',
  },
}

const categoryLookupStage = {
  $lookup: {
    from: 'categories',
    localField: 'model.type',
    foreignField: 'categoryCode',
    as: 'category',
  },
}

const sangeetaStoreMatchStage = {
  $match: {
    'user.storeId': { $in: getSangeetaStoreIds() },
  },
}

const finalPriceStage = {
  $addFields: { finalPrice: { $add: ['$price', '$bonusPrice'] } },
}

// Pipelines
const userSangeetaFilterPipeline = [
  userLookupStage,
  { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
  sangeetaStoreMatchStage,
]

const documentModelCategoryPipeline = [
  documentLookupStage,
  { $unwind: { path: '$document', preserveNullAndEmptyArrays: true } },
  modelLookupStage,
  { $unwind: { path: '$model', preserveNullAndEmptyArrays: true } },
  categoryLookupStage,
  { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
]

const storeWithUnwindStages = createLookupUnwind(
  'stores',
  'user.storeId',
  '_id',
  'store'
)

const deviceLotStoreLookupStages = createLookupUnwind(
  'stores',
  'storeId',
  '_id',
  'store'
)

// ---------------- Utilities ----------------
const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const findModel = async (brandDoc, model, categoryCode) => {
  const baseQuery = { brandId: brandDoc._id, type: categoryCode }

  // 1. Exact match
  let modelDoc = await modelsModel.findOne({
    ...baseQuery,
    name: { $regex: `^${escapeRegExp(model)}$`, $options: 'i' },
  })

  // 2. Brand prefix + model
  if (!modelDoc) {
    const prefixedModel = `${brandDoc.name} ${model}`
    modelDoc = await modelsModel.findOne({
      ...baseQuery,
      name: { $regex: `^${escapeRegExp(prefixedModel)}$`, $options: 'i' },
    })
  }

  // 3. Partial match
  if (!modelDoc) {
    modelDoc = await modelsModel.findOne({
      ...baseQuery,
      name: { $regex: escapeRegExp(model), $options: 'i' },
    })
  }

  return modelDoc
}

// ---------------- Controllers ----------------
const getUpToValue = async (req, res) => {
  try {
    const { category, brand, model, RAM, storage } = req.body

    if (!category || !brand || !model || !storage) {
      return res.status(400).json({ message: MESSAGES.MISSING_PARAMS })
    }

    const categoryCode = CATEGORY_MAPPING[category]
    if (!categoryCode) {
      return res.status(400).json({ message: MESSAGES.INVALID_CATEGORY })
    }

    const brandDoc = await brandModel.findOne({
      name: { $regex: `^${escapeRegExp(brand)}$`, $options: 'i' },
    })

    if (!brandDoc) {
      return res.status(404).json({ message: MESSAGES.BRAND_NOT_FOUND })
    }

    const modelDoc = await findModel(brandDoc, model, categoryCode)
    if (!modelDoc) {
      return res.status(404).json({ message: MESSAGES.MODEL_NOT_FOUND })
    }

    const query = { modelId: modelDoc._id.toString(), storage }
    if (RAM) {
      query.RAM = RAM
    }

    const gradePrice = await gradeprice.findOne(query)
    if (!gradePrice) {
      return res.status(404).json({ message: MESSAGES.NO_PRICING })
    }

    const grades = gradePrice.grades || {}
    const allPrices = Object.values(grades).filter(
      (price) => price && price > 0
    )

    if (allPrices.length === 0) {
      return res.status(404).json({ message: MESSAGES.NO_VALID_PRICES })
    }

    const baseUpToValue = Math.max(...allPrices)
    const upToValue = Math.round(baseUpToValue * 1.08)

    return res.status(200).json({
      price: upToValue,
      message: 'Up to value retrieved successfully',
    })
  } catch (error) {
    return handleControllerError(error, res)
  }
}

const getAllLeadsComplete = async (req, res) => {
  try {
    const page = Number(req.query.page) || 0
    const limit = Number(req.query.limit) || 10

    const pipeline = [
      { $match: { [IS_SELLED_FIELD]: true } },
      ...userSangeetaFilterPipeline,
      ...documentModelCategoryPipeline,
      ...storeWithUnwindStages,
      finalPriceStage,
      {
        $project: {
          purchaseDate: '$updatedAt',
          ...commonProjectionFields,
          receipt: '$reciept',
          customerDetails: {
            name: '$name',
            mobile: PHONE_NUMBER_FIELD,
            email: '$emailId',
            aadhar: '$aadharNumber',
          },
          moreDetails: '$QNA',
          images: {
            phonePhotos: '$document.phonePhotos',
            adhar: '$document.adhar',
            phoneBill: '$document.phoneBill',
            signature: '$document.signature',
          },
        },
      },
      { $sort: { purchaseDate: -1 } },
      { $skip: page * limit },
      { $limit: limit },
    ]

    const totalCountPipeline = [
      { $match: { [IS_SELLED_FIELD]: true } },
      ...userSangeetaFilterPipeline,
      { $count: 'total' },
    ]

    const [data, totalCount] = await Promise.all([
      leadsModel.aggregate(pipeline),
      leadsModel.aggregate(totalCountPipeline),
    ])

    return res.status(200).json({
      data,
      totalRecords: totalCount[0]?.total || 0,
      page,
      limit,
      message: MESSAGES.LEADS_SUCCESS,
    })
  } catch (error) {
    return handleControllerError(error, res)
  }
}

const getAllDeviceStatus = async (req, res) => {
  try {
    const page = Number(req.query.page) || 0
    const limit = Number(req.query.limit) || 10

    const [pendingLeadsResult, pickupDevicesResult] = await Promise.all([
      getPendingLeadsWithCount(page, limit),
      getPickupDevicesWithCount(page, limit),
    ])

    const combinedData = [
      ...pendingLeadsResult.data,
      ...pickupDevicesResult.data,
    ]

    combinedData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

    const totalUniqueCount =
      pendingLeadsResult.totalCount + pickupDevicesResult.totalCount

    return res.status(200).json({
      data: combinedData,
      totalRecords: totalUniqueCount,
      page,
      limit,
      pendingLeadsCount: pendingLeadsResult.totalCount,
      pickupDevicesCount: pickupDevicesResult.totalCount,
      message: MESSAGES.DEVICE_STATUS_SUCCESS,
    })
  } catch (error) {
    return handleControllerError(error, res)
  }
}

// ---------------- Helper Pipelines ----------------
const getPendingLeadsWithCount = async (page = 0, limit = 10) => {
  const basePipeline = [
    {
      $match: {
        $and: [
          { [IS_SELLED_FIELD]: true },
          { status: { $ne: STATUS_COMPLETED } },
        ],
      },
    },
    ...userSangeetaFilterPipeline,
    ...storeWithUnwindStages,
    ...documentModelCategoryPipeline,
    finalPriceStage,
    {
      $project: {
        _id: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        ...commonProjectionFields,
        storeName: STORE_NAME_FIELD,
        storeRegion: STORE_REGION_FIELD,
        reason: '$reason',
        uniqueCode: '$uniqueCode',
      },
    },
    ...deduplicationStages,
  ]

  const pipeline = [...basePipeline, createPaginationFacet(page, limit)]

  const result = await leadsModel.aggregate(pipeline)
  return processAggregationResult(result)
}

const getPickupDevicesWithCount = async (page = 0, limit = 10) => {
  const basePipeline = [
    userLookupStage,
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ...deviceLotStoreLookupStages,
    {
      $match: {
        storeId: { $in: getSangeetaStoreIds() },
      },
    },
    {
      $lookup: {
        from: 'deviceslots',
        let: { lotId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$lotId'] } } },
          { $unwind: '$deviceList' },
          {
            $lookup: {
              from: 'leads',
              localField: 'deviceList',
              foreignField: '_id',
              as: 'leadsData',
            },
          },
          { $unwind: '$leadsData' },
          ...createLookupUnwind('users', 'leadsData.userId', '_id', 'userData'),
          ...createLookupUnwind(
            'stores',
            'userData.storeId',
            '_id',
            'storeData'
          ),
          ...createLookupUnwind(
            'models',
            'leadsData.modelId',
            '_id',
            'modelData'
          ),
          ...createLookupUnwind(
            'categories',
            'modelData.type',
            'categoryCode',
            'categoryInfo'
          ),
          ...createLookupUnwind(
            'documents',
            'leadsData.documentId',
            '_id',
            'docData'
          ),
          { $sort: { 'leadsData.createdAt': -1 } },
          {
            $project: {
              _id: '$leadsData._id',
              location: STORE_LOCATION_CONCAT,
              modelName: '$modelData.name',
              imei: '$docData.IMEI',
              leadsData: {
                $mergeObjects: [
                  { $unsetField: { field: 'QNA', input: '$leadsData' } },
                  {
                    price: {
                      $add: ['$leadsData.price', '$leadsData.bonusPrice'],
                    },
                  },
                ],
              },
            },
          },
        ],
        as: 'deviceDetails',
      },
    },
    {
      $project: {
        _id: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        totalDevice: 1,
        uniqueCode: 1,
        username: USER_FULL_NAME_CONCAT,
        storeName: STORE_NAME_FIELD,
        storeRegion: STORE_REGION_FIELD,
        deviceDetails: 1,
        category: 'Device Lot',
        productName: DEVICE_LOT_PRODUCT_NAME,
        price: '$totalAmount',
      },
    },
    ...deduplicationStages,
  ]

  const pipeline = [...basePipeline, createPaginationFacet(page, limit)]

  const result = await devicesLotModel.aggregate(pipeline)
  return processAggregationResult(result)
}

const getLeadByUniqueCode = async (req, res) => {
  try {
    const { uniqueCode } = req.body

    if (!uniqueCode) {
      return res.status(400).json({ message: 'uniqueCode is required' })
    }

    const pipeline = [
      { $match: { uniqueCode } },
      ...userSangeetaFilterPipeline,
      ...documentModelCategoryPipeline,
      ...storeWithUnwindStages,
      ...createLookupUnwind('brands', 'model.brandId', '_id', 'brand'),
      finalPriceStage,
      {
        $project: {
          purchaseDate: '$updatedAt',
          ...commonProjectionFields,
          brand: '$brand.name',
          receipt: '$reciept',
          status: '$status',
          uniqueCode: '$uniqueCode',
          storeName: STORE_NAME_FIELD,
          storeRegion: STORE_REGION_FIELD,
          customerDetails: {
            name: '$name',
            mobile: PHONE_NUMBER_FIELD,
            email: '$emailId',
            aadhar: '$aadharNumber',
          },
          moreDetails: '$QNA',
          images: {
            phonePhotos: '$document.phonePhotos',
            adhar: '$document.adhar',
            phoneBill: '$document.phoneBill',
            signature: '$document.signature',
          },
        },
      },
    ]

    const result = await leadsModel.aggregate(pipeline)

    if (!result || result.length === 0) {
      return res
        .status(404)
        .json({ message: 'There is no lead found for this uniqueCode' })
    }

    const leadData = result[0]

    // Check if this lead is part of any deviceLot
    const deviceLot = await devicesLotModel
      .findOne({ deviceList: leadData._id })
      .select('status')

    // Use deviceLot status if lead is part of a deviceLot, otherwise use lead status
    const responseData = {
      ...leadData,
      status: deviceLot ? deviceLot.status : leadData.status,
    }

    return res.status(200).json({
      data: responseData,
      message: 'Lead retrieved successfully',
    })
  } catch (error) {
    return handleControllerError(error, res)
  }
}

export default {
  getUpToValue,
  getAllLeadsComplete,
  getAllDeviceStatus,
  getLeadByUniqueCode,
}
