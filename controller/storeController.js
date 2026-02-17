import storeModel from '../models/storeModel.js'
import axios from 'axios'
import xlsx from 'xlsx'
import utils from '../utils/required.js'
import UsersModel from '../models/UsersModel.js'
import devicesLotModel from '../models/devicesLotModel.js'
import leadModel from '../models/leadsModel.js'
import timeRangeCal from '../utils/timeRangeCal.js'
import AWS from 'aws-sdk'
import { ROLES } from '../middlewares/rbac.js'
import mongoose from 'mongoose'
import { parseFile } from '../utils/fileParsingUtils.js'

const MESSAGES = {
  INTERNAL_SERVER: 'Internal Server Error',
  FORBIDDEN: 'Forbidden',
  FORBIDDEN_USER: 'Forbidden: User not found.',
  NO_FILE: 'No file URL provided',
  INVALID_FILE: 'Empty or invalid file format',
  INVALID_STORE: 'Invalid store data format',
}

const STATUS = {
  PICKUP_CONFIRMED: 'Pickup Confirmed',
  AVAILABLE_FOR_PICKUP: 'Available For Pickup',
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In Progress',
}

const FIELD_NAMES = {
  BONUS_PRICE: '$bonusPrice',
}

const ROLE_NAMES = {
  ADMIN_MANAGER: 'Admin Manager',
  MANAGER: 'Manager',
  TECHNICIAN: 'Technician',
}

const ROLES_WITH_ASSIGNED_STORES = [
  ROLE_NAMES.ADMIN_MANAGER,
  ROLE_NAMES.MANAGER,
  ROLE_NAMES.TECHNICIAN,
]

const s3Bucket = new AWS.S3({
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
})

// ========== CRUD FUNCTIONS ==========
const create = async (req, res) => {
  try {
    const userId = req.userId
    req.body.createdBy = userId

    // Validate required companyId
    if (!req.body.companyId) {
      return res.status(400).json({ message: 'companyId is required' })
    }

    // Company scoping check
    if (
      req.userRole !== ROLES.SUPER_ADMIN &&
      req.body.companyId.toString() !== req.userCompanyId.toString()
    ) {
      return res
        .status(403)
        .json({ message: 'Cannot create store for another company' })
    }

    const { error } = utils.storeValidation(req.body)
    if (error) {
      return res.status(400).send({ message: error.details[0].message })
    }

    const lastDoc = await storeModel
      .findOne({ uniqueId: { $ne: '' } })
      .sort({ createdAt: -1 })
    let uniqueId = 'STOREG100'

    if (lastDoc) {
      const numbersArray = lastDoc?.uniqueId?.match(/\d+/g)
      const code = numbersArray ? numbersArray.map(Number) : []
      uniqueId = `STOREG${Number(code) + 1}`
    }

    const result = await storeModel({
      ...req.body,
      uniqueId,
      createdBy: userId,
    }).save()

    return res.status(200).json({ result })
  } catch (err) {
    return res.status(500).json({ message: err.message, status: 500 })
  }
}

const update = async (req, res) => {
  try {
    const userId = req.userId
    req.body.updatedBy = userId
    delete req.body.createdBy

    const result = await storeModel.findByIdAndUpdate(
      { _id: req.body._id || req.body.id },
      req.body,
      { new: true }
    )

    return res.status(200).json({ result })
  } catch (err) {
    return res.status(500).json({ message: err.message, status: 500 })
  }
}

const deleteById = async (req, res) => {
  try {
    const result = await storeModel.findByIdAndDelete({
      _id: req.query._id || req.query.id,
    })
    return res.status(200).json({ result })
  } catch (err) {
    return res.status(500).json({ message: err.message, status: 500 })
  }
}

const findById = async (req, res) => {
  try {
    const storeData = await storeModel.findById({
      _id: req.query._id || req.query.id,
    })
    return res.status(200).json({ result: storeData })
  } catch (err) {
    return res
      .status(500)
      .json({ message: MESSAGES.INTERNAL_SERVER, status: 500 })
  }
}

const findAll = async (req, res) => {
  try {
    const userId = req.userId
    const user = await UsersModel.findById(userId).select(
      'role storeId companyId assignedStores'
    )
    if (!user) {
      return res.status(403).json({ message: 'EHRTEHGUTIGHHU4' })
    }

    const query = {}
    const search = req.query.search || ''
    const limit = parseInt(req.query.limit) || 9999
    const page = parseInt(req.query.page) || 1
    const skip = (page - 1) * limit

    // Company scoping - users can only see stores from their company
    if (user.role !== ROLES.SUPER_ADMIN) {
      query.companyId = user.companyId
    }

    // Role-based store filtering
    if (ROLES_WITH_ASSIGNED_STORES.includes(user.role)) {
      // Managers and Technicians see only assigned stores
      if (!user.assignedStores || user.assignedStores.length === 0) {
        return res.status(200).json({ result: [], totalRecords: 0 })
      }
      query._id = { $in: user.assignedStores }
    }

    // Search functionality
    if (search) {
      query.storeName = { $regex: search, $options: 'i' }
    }

    // Company name filter
    if (req.query.companyId) {
      query.companyId = req.query.companyId
    }

    // Status filter
    if (req.query.status) {
      query.status = req.query.status
    }

    const stores = await storeModel
      .find(query)
      .populate('companyId', 'name companyCode')
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const totalRecords = await storeModel.countDocuments(query)

    return res.status(200).json({
      result: stores,
      totalRecords,
      currentPage: page,
      totalPages: Math.ceil(totalRecords / limit),
    })
  } catch (err) {
    console.error('Find all stores error:', err)
    return res.status(500).json({ message: 'URTUIGRTUIGRTUGI' })
  }
}

// ========== FILE UPLOAD HELPERS ==========
const parseS3Url = (url) => {
  const match = url.match(/^https:\/\/(.+)\.s3\.(.+)\.amazonaws\.com\/(.+)$/)
  if (!match) {
    throw new Error('Invalid S3 URL format')
  }
  const [, bucket, key] = match
  return { bucket, key: decodeURIComponent(key) }
}

const fetchAndProcessFile = async (fileUrl) => {
  const { bucket, key } = parseS3Url(fileUrl)
  const signedUrl = s3Bucket.getSignedUrl('getObject', {
    Bucket: bucket,
    Key: key,
    Expires: 60,
  })
  const response = await axios.get(signedUrl, { responseType: 'arraybuffer' })

  const workbook = xlsx.read(response.data, { type: 'buffer' })
  const sheetNameList = workbook.SheetNames
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetNameList[0]], {
    defval: '',
  })
}

// Helper to validate required store fields
const validateStoreFields = (store) => {
  return (
    store.storeName &&
    store.companyCode &&
    store.region &&
    store.contactNumber &&
    store.address
  )
}

// Helper to get company map
const getCompanyMap = async () => {
  const companyModel = (await import('../models/companyModel.js')).default
  const companies = await companyModel.find({}, 'companyCode _id')
  return new Map(
    companies.map((c) => [c.companyCode?.toLowerCase().trim(), c._id])
  )
}

// Helper to get next unique ID number
const getNextUniqueIdNumber = async () => {
  const lastDoc = await storeModel
    .findOne({ uniqueId: { $ne: '' } })
    .sort({ createdAt: -1 })

  if (lastDoc) {
    const numbersArray = lastDoc?.uniqueId?.match(/\d+/g)
    const code = numbersArray ? numbersArray.map(Number) : []
    return Number(code) + 1
  }
  return 100
}

// Helper to process a single store row
const processStoreRow = async (
  store,
  rowNumber,
  companyMap,
  nextUniqueIdNumber,
  userId
) => {
  // Validate required fields
  if (!validateStoreFields(store)) {
    return {
      error: {
        row: rowNumber,
        message:
          'Missing required fields (storeName, companyCode, region, contactNumber, address)',
        data: store,
      },
    }
  }

  // Map companyCode to companyId
  const companyId = companyMap.get(store.companyCode.toLowerCase().trim())
  if (!companyId) {
    return {
      error: {
        row: rowNumber,
        message: `Company not found with code: ${store.companyCode}`,
        data: store,
      },
    }
  }

  // Check if store already exists
  const exists = await storeModel.findOne({
    storeName: { $regex: `^${store.storeName.trim()}$`, $options: 'i' },
    companyId: companyId,
    region: store.region.trim(),
  })

  let uniqueId
  if (exists) {
    uniqueId = exists.uniqueId
  } else {
    uniqueId = `STOREG${nextUniqueIdNumber.value}`
    nextUniqueIdNumber.value++
  }

  // Prepare store data
  const storeData = {
    storeName: store.storeName.trim(),
    companyId: companyId,
    region: store.region.trim(),
    email: store.email?.trim() || '',
    uniqueId: uniqueId,
    contactNumber: store.contactNumber.toString().trim(),
    address: store.address.trim(),
    createdBy: userId,
  }

  if (exists) {
    const updatedStore = await storeModel.findByIdAndUpdate(
      exists._id,
      { ...storeData, uniqueId: exists.uniqueId, updatedBy: userId },
      { new: true }
    )
    return { updated: updatedStore }
  } else {
    const newStore = await storeModel.create(storeData)
    return { inserted: newStore }
  }
}

const uploadData = async (req, res) => {
  try {
    const userId = req.userId

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' })
    }

    const stores = await parseFile(req.file)
    if (!stores || stores.length === 0) {
      return res
        .status(400)
        .json({ message: 'The uploaded file is empty or invalid.' })
    }

    const companyMap = await getCompanyMap()
    const nextUniqueIdNumber = { value: await getNextUniqueIdNumber() }

    const updated = []
    const inserted = []
    const errors = []

    for (const [index, store] of stores.entries()) {
      const rowNumber = index + 2
      const result = await processStoreRow(
        store,
        rowNumber,
        companyMap,
        nextUniqueIdNumber,
        userId
      )

      if (result.error) {
        errors.push(result.error)
      } else if (result.updated) {
        updated.push(result.updated)
      } else if (result.inserted) {
        inserted.push(result.inserted)
      }
    }

    return res.status(200).json({
      success: true,
      updated: updated.length,
      inserted: inserted.length,
      errors: errors.length,
      updatedStores: updated,
      insertedStores: inserted,
      errorDetails: errors,
    })
  } catch (err) {
    return res.status(500).json({ message: err.message, status: 500 })
  }
}

// ========== ADMIN REPORT HELPERS ==========
// Helper to build store access filter based on role
const buildStoreAccessFilter = (user, isCompanyAdmin) => {
  if (isCompanyAdmin) {
    if (!user.companyId) {
      return null
    }
    return { 'store.companyId': user.companyId }
  }

  if (ROLES_WITH_ASSIGNED_STORES.includes(user.role)) {
    if (!user.assignedStores || user.assignedStores.length === 0) {
      return null
    }
    return { 'store._id': { $in: user.assignedStores } }
  }

  if (!user.storeId) {
    return null
  }
  return { 'store._id': user.storeId }
}

// Helper to apply company and store filtering to pipeline
const applyCompanyAndStoreFiltering = (
  pipeline,
  companyId,
  isSuperAdmin,
  user,
  isCompanyAdmin
) => {
  // Filter by companyId if provided
  if (companyId) {
    pipeline.push({
      $match: { 'store.companyId': new mongoose.Types.ObjectId(companyId) },
    })
    return true
  }
  // Apply role-based filtering if no companyId filter was applied
  if (!isSuperAdmin) {
    const storeFilter = buildStoreAccessFilter(user, isCompanyAdmin)
    if (!storeFilter) {
      return false
    }
    pipeline.push({ $match: storeFilter })
  }
  return true
}

const buildPipeline = (
  user,
  isSuperAdmin,
  isCompanyAdmin,
  leadIds,
  initialMatchQuery,
  finalMatchQuery,
  companyId = null
) => {
  const pipeline = [
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'stores',
        localField: 'storeId',
        foreignField: '_id',
        as: 'store',
      },
    },
    { $unwind: '$store' },
  ]

  const hasAccess = applyCompanyAndStoreFiltering(
    pipeline,
    companyId,
    isSuperAdmin,
    user,
    isCompanyAdmin
  )

  if (!hasAccess) {
    return []
  }

  pipeline.push(
    { $match: initialMatchQuery },
    {
      $addFields: {
        data: {
          storeName: '$store.storeName',
          storeId: '$store._id',
          userId: '$user._id',
          userEmail: '$user.email',
          userRole: '$user.role',
        },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%d/%m/%Y', date: '$createdAt' } },
        totalAvailableForPickup: {
          $sum: {
            $cond: [{ $eq: ['$status', STATUS.AVAILABLE_FOR_PICKUP] }, 1, 0],
          },
        },
        priceOfferToCustomer: {
          $sum: {
            $cond: [
              { $eq: ['$status', STATUS.AVAILABLE_FOR_PICKUP] },
              { $add: ['$price', { $ifNull: [FIELD_NAMES.BONUS_PRICE, 0] }] },
              0,
            ],
          },
        },
        totalPicked: {
          $sum: { $cond: [{ $in: ['$_id', leadIds] }, 1, 0] },
        },
        totalPickedPrice: {
          $sum: {
            $cond: [
              { $in: ['$_id', leadIds] },
              { $add: ['$price', { $ifNull: [FIELD_NAMES.BONUS_PRICE, 0] }] },
              0,
            ],
          },
        },
        pendingForPickup: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', STATUS.AVAILABLE_FOR_PICKUP] },
                  { $not: { $in: ['$_id', leadIds] } },
                ],
              },
              1,
              0,
            ],
          },
        },
        pendingForPickupPrice: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', STATUS.AVAILABLE_FOR_PICKUP] },
                  { $not: { $in: ['$_id', leadIds] } },
                ],
              },
              { $add: ['$price', { $ifNull: [FIELD_NAMES.BONUS_PRICE, 0] }] },
              0,
            ],
          },
        },
        data: {
          $push: {
            $cond: [
              { $eq: ['$status', STATUS.COMPLETED] },
              {
                storeId: '$data.storeId',
                storeName: '$data.storeName',
                region: '$store.region',
                availableForPickup: 1,
                price: {
                  $add: ['$price', { $ifNull: [FIELD_NAMES.BONUS_PRICE, 0] }],
                },
              },
              null,
            ],
          },
        },
      },
    },
    { $match: finalMatchQuery },
    {
      $project: {
        _id: 0,
        date: '$_id',
        datenew: {
          $dateFromString: { dateString: '$_id', format: '%d/%m/%Y' },
        },
        totalAvailableForPickup: 1,
        priceOfferToCustomer: 1,
        totalPicked: 1,
        totalPickedPrice: 1,
        pendingForPickup: 1,
        pendingForPickupPrice: 1,
        data: { $filter: { input: '$data', cond: { $ne: ['$$this', null] } } },
      },
    },
    { $sort: { datenew: -1 } }
  )

  return pipeline
}

const mapData = (data, key) => {
  try {
    return data.map((item) => item[key] || 0).reduce((acc, num) => acc + num, 0)
  } catch {
    return 0
  }
}

const calculateTotals = (result) => ({
  totalAvailableForPickup: mapData(result, 'totalAvailableForPickup'),
  totalPriceOfferToCustomer: mapData(result, 'priceOfferToCustomer'),
  totalPicked: mapData(result, 'totalPicked'),
  totalPickedPrice: mapData(result, 'totalPickedPrice'),
  totalPendingForPickup: mapData(result, 'pendingForPickup'),
  totalPendingForPickupPrice: mapData(result, 'pendingForPickupPrice'),
})

// Helper to validate company filter access
const validateCompanyFilter = (companyId, isSuperAdmin, user) => {
  if (!companyId) {
    return null
  }

  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return {
      status: 400,
      message: 'Invalid companyId format',
    }
  }

  if (!isSuperAdmin && companyId !== user.companyId.toString()) {
    return {
      status: 403,
      message: 'Forbidden: Cannot access reports from another company',
    }
  }

  return null
}

// Helper to build match queries
const buildAdminReportQueries = (search, fromDate, toDate) => {
  const finalMatchQuery = search
    ? { 'data.storeName': { $regex: search, $options: 'i' } }
    : {}
  const initialMatchQuery = { is_selled: true }

  if (fromDate && toDate) {
    const { startDate, endDate } = timeRangeCal.timeRangeCal(
      '',
      fromDate,
      toDate
    )
    initialMatchQuery.createdAt = {
      $gte: startDate.toDate(),
      $lte: endDate.toDate(),
    }
  }

  return { initialMatchQuery, finalMatchQuery }
}

const adminReport = async (req, res) => {
  try {
    const userId = req.userId
    const user = await UsersModel.findById(userId).select(
      'role storeId companyId assignedStores'
    )
    if (!user) {
      return res.status(403).json({ message: MESSAGES.FORBIDDEN_USER })
    }

    const isSuperAdmin = user.role === ROLES.SUPER_ADMIN
    const isCompanyAdmin = user.role === 'Company Admin'
    const { search, fromDate, toDate, companyId } = req.query

    // Validate company filter access
    const validationError = validateCompanyFilter(
      companyId,
      isSuperAdmin,
      user
    )
    if (validationError) {
      return res
        .status(validationError.status)
        .json({ message: validationError.message })
    }

    const { initialMatchQuery, finalMatchQuery } = buildAdminReportQueries(
      search,
      fromDate,
      toDate
    )

    const leadIds = await devicesLotModel.distinct('deviceList', {
      status: STATUS.PICKUP_CONFIRMED,
    })

    const pipeline = buildPipeline(
      user,
      isSuperAdmin,
      isCompanyAdmin,
      leadIds,
      initialMatchQuery,
      finalMatchQuery,
      companyId
    )

    if (pipeline.length === 0) {
      return res.status(200).json({ total: {}, result: [] })
    }

    const result = await leadModel.aggregate(pipeline)
    const total = calculateTotals(result)

    return res.status(200).json({ total, result })
  } catch (err) {
    return res.status(500).json({ message: err.message, status: 500 })
  }
}

export default {
  create,
  update,
  deleteById,
  findById,
  findAll,
  uploadData,
  adminReport,
}
