import QuoteLogModel from '../models/QuoteLogModel.js'
import UsersModel from '../models/UsersModel.js'
import mongoose from 'mongoose'
import { Parser } from 'json2csv'

const QUOTE_TYPES = {
  QUICK: 'QuickQuote',
  EXACT: 'Get Exact Value',
  SAVED: 'SavedQuote',
}

const ERROR_MESSAGES = {
  AUTH_NOT_FOUND:
    'Authentication error: User ID not found after token verification.',
  AUTH_USER_NOT_FOUND: 'Authenticated user not found.',
  TARGET_USER_NOT_FOUND: 'Target user not found.',
  FORBIDDEN:
    'Forbidden: You can only view activity logs for users within your own store.',
  INTERNAL_SERVER: 'An internal server error occurred.',
  SERVER_ERROR: 'Server error.',
  SERVER_ERROR_DASHBOARD: 'Server error fetching dashboard data.',
  CSV_ERROR: 'Failed to generate CSV report.',
  NO_EXPORT: 'No data to export for the selected filters.',
  INVALID_QUOTE_TYPE: 'Invalid value for quoteType.',
  QUOTE_AMOUNT_NUMBER: 'quoteAmount must be a non-negative number.',
  DEVICE_DETAILS_INVALID: 'Missing or invalid field: deviceDetails.',
  MISSING_QUOTE_TYPE: 'Missing required field: quoteType.',
  MISSING_QUOTE_AMOUNT: 'Missing required field: quoteAmount.',
}

const ROLES = {
  ADMIN_MANAGER: 'Admin Manager',
  MANAGER: 'Manager',
  TECHNICIAN: 'Technician',
  COMPANY_ADMIN: 'Company Admin',
  SUPER_ADMIN: 'Super Admin',
}

const ROLES_WITH_ASSIGNED_STORES = [
  ROLES.ADMIN_MANAGER,
  ROLES.MANAGER,
  ROLES.TECHNICIAN,
]

const AGGREGATION_CONDITIONS = {
  COUNT_EXACT_QUOTES: { $cond: [{ $eq: ['$quoteType', QUOTE_TYPES.EXACT] }, 1, 0] },
  COUNT_QUICK_QUOTES: { $cond: [{ $eq: ['$quoteType', QUOTE_TYPES.QUICK] }, 1, 0] },
}

// Required fields in deviceDetails
const REQUIRED_DEVICE_FIELDS = [
  'modelId',
  'name',
  'brandId',
  'categoryName',
  'ram',
  'rom',
  'series',
]

// ======================= HELPERS =======================
const checkRequired = (value, name) =>
  value === undefined || value === null || value === ''
    ? `Missing required field in deviceDetails: ${name}`
    : null

const validateDeviceDetails = (deviceDetails) => {
  for (const field of REQUIRED_DEVICE_FIELDS) {
    const error = checkRequired(deviceDetails[field], field)
    if (error) {
      return error
    }
  }
  return null
}

const validateLogAttemptPayload = (body) => {
  const { quoteType, quoteAmount, grade, deviceDetails } = body

  if (!quoteType) {
    return { isValid: false, error: ERROR_MESSAGES.MISSING_QUOTE_TYPE }
  }
  if (quoteAmount == null) {
    return { isValid: false, error: ERROR_MESSAGES.MISSING_QUOTE_AMOUNT }
  }
  if (!deviceDetails || typeof deviceDetails !== 'object') {
    return { isValid: false, error: ERROR_MESSAGES.DEVICE_DETAILS_INVALID }
  }
  if (!Object.values(QUOTE_TYPES).includes(quoteType)) {
    return { isValid: false, error: ERROR_MESSAGES.INVALID_QUOTE_TYPE }
  }
  if (typeof quoteAmount !== 'number' || quoteAmount < 0) {
    return { isValid: false, error: ERROR_MESSAGES.QUOTE_AMOUNT_NUMBER }
  }

  const deviceError = validateDeviceDetails(deviceDetails)
  if (deviceError) {
    return { isValid: false, error: deviceError }
  }

  return {
    isValid: true,
    error: null,
    validatedValue: {
      quoteType,
      quoteAmount,
      grade: grade || null,
      deviceDetails,
    },
  }
}

const isSameStore = (userA, userB) =>
  userA.storeId && userB.storeId && userA.storeId.equals(userB.storeId)

const getDateRange = (range) => {
  const start = new Date()
  const end = new Date()

  switch (range) {
    case 'Today':
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    case 'Yesterday':
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
      break
    case 'Last 7 Days':
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    case '1 Month':
      start.setMonth(start.getMonth() - 1)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    default:
      return null
  }
  return { $gte: start, $lte: end }
}

// Helper to build store filter based on user role
const buildStoreIdFilter = (authenticatedUser, req, storeId, isSuperAdmin) => {
  if (isSuperAdmin) {
    return storeId ? new mongoose.Types.ObjectId(storeId) : null
  }

  const isCompanyAdmin = authenticatedUser.role === ROLES.COMPANY_ADMIN
  const isAdminManager = authenticatedUser.role === ROLES.ADMIN_MANAGER
  const hasAssignedStores = authenticatedUser.assignedStores?.length > 0

  if (isCompanyAdmin && req.companyStoreIds) {
    return storeId ? new mongoose.Types.ObjectId(storeId) : { $in: req.companyStoreIds }
  }

  if (isAdminManager && hasAssignedStores) {
    return { $in: authenticatedUser.assignedStores }
  }

  if (ROLES_WITH_ASSIGNED_STORES.includes(authenticatedUser.role)) {
    return hasAssignedStores ? { $in: authenticatedUser.assignedStores } : new mongoose.Types.ObjectId()
  }

  return authenticatedUser.storeId || new mongoose.Types.ObjectId()
}

const buildMatchStage = async (req) => {
  const { dateRange, search = '', storeId } = req.query
  const matchStage = {}

  const dateFilter = getDateRange(dateRange)
  if (dateFilter) {
    matchStage.timestamp = dateFilter
  }

  const authenticatedUser = await UsersModel.findById(req.userId).select(
    'role storeId companyId assignedStores'
  )
  if (!authenticatedUser) {
    throw new Error(ERROR_MESSAGES.AUTH_USER_NOT_FOUND)
  }

  const isSuperAdmin = authenticatedUser.role === 'Super Admin'
  const storeFilter = buildStoreIdFilter(authenticatedUser, req, storeId, isSuperAdmin)
  if (storeFilter) {
    matchStage.storeId = storeFilter
  }

  if (search) {
    const userFilter = { email: { $regex: search, $options: 'i' } }
    if (matchStage.storeId) {
      userFilter.storeId = matchStage.storeId
    }
    const searchedUsers = await UsersModel.find(userFilter).select('_id')
    matchStage.userId = { $in: searchedUsers.map((u) => u._id) }
  }

  return matchStage
}

// ======================= CONTROLLERS =======================
const logQuoteAttempt = async (req, res) => {
  const { isValid, error, validatedValue } = validateLogAttemptPayload(req.body)
  if (!isValid) {
    return res.status(400).json({ message: error })
  }

  try {
    const authenticatedUserId = req.userId
    if (!authenticatedUserId) {
      return res.status(401).json({ message: ERROR_MESSAGES.AUTH_NOT_FOUND })
    }

    const user = await UsersModel.findById(authenticatedUserId).select(
      'storeId'
    )
    if (!user) {
      return res
        .status(404)
        .json({ message: ERROR_MESSAGES.AUTH_USER_NOT_FOUND })
    }

    const newLogObject = {
      ...validatedValue,
      userId: new mongoose.Types.ObjectId(authenticatedUserId),
      storeId: user.storeId,
    }

    const newLog = new QuoteLogModel(newLogObject)
    await newLog.save()
    return res
      .status(201)
      .json({ message: 'Quote attempt logged successfully.' })
  } catch (err) {
    console.error('Error in logQuoteAttempt:', err)
    return res.status(500).json({
      message: ERROR_MESSAGES.INTERNAL_SERVER,
      error: { name: err.name, message: err.message },
    })
  }
}

const getQuoteTrackingData = async (req, res) => {
  const { page = 1, limit = 10 } = req.query
  const pageNum = parseInt(page)
  const limitNum = parseInt(limit)

  try {
    const matchStage = await buildMatchStage(req)

    const aggregationResult = await QuoteLogModel.aggregate([
      { $match: matchStage },
      { $sort: { timestamp: -1 } },
      {
        $facet: {
          paginatedData: [
            {
              $group: {
                _id: '$userId',
                totalQuotes: {
                  $sum: AGGREGATION_CONDITIONS.COUNT_EXACT_QUOTES,
                },
                totalQuickQuotes: {
                  $sum: AGGREGATION_CONDITIONS.COUNT_QUICK_QUOTES,
                },
                sumOfAllQuotes: { $sum: '$quoteAmount' },
                lastActivityDate: { $max: '$timestamp' },
                lastDevice: { $first: '$deviceDetails' },
              },
            },
            { $sort: { lastActivityDate: -1 } },
            { $skip: (pageNum - 1) * limitNum },
            { $limit: limitNum },
            {
              $lookup: {
                from: 'brands',
                localField: 'lastDevice.brandId',
                foreignField: '_id',
                as: 'brandInfo',
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'userInfo',
              },
            },
            {
              $lookup: {
                from: 'stores',
                localField: 'userInfo.storeId',
                foreignField: '_id',
                as: 'storeInfo',
              },
            },
            { $unwind: '$userInfo' },
            {
              $unwind: { path: '$storeInfo', preserveNullAndEmptyArrays: true },
            },
            {
              $unwind: { path: '$brandInfo', preserveNullAndEmptyArrays: true },
            },
            {
              $project: {
                _id: 0,
                userId: '$userInfo._id',
                email: '$userInfo.email',
                role: '$userInfo.role',
                storeName: '$storeInfo.storeName',
                totalQuotes: 1,
                totalQuickQuotes: 1,
                sumOfAllQuotes: 1,
                lastActivityDate: 1,
                deviceNameAndCategory: '$lastDevice.name',
                brand: '$brandInfo.name',
                deviceDetails: {
                  ram: '$lastDevice.ram',
                  rom: '$lastDevice.rom',
                },
              },
            },
          ],
          totalCount: [{ $group: { _id: '$userId' } }, { $count: 'count' }],
        },
      },
    ])

    const data = aggregationResult[0].paginatedData
    const totalRecords = aggregationResult[0].totalCount[0]?.count || 0

    return res.status(200).json({
      data,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum),
        totalRecords,
      },
    })
  } catch (err) {
    console.error('Error fetching tracking data:', err)
    return res
      .status(500)
      .json({ message: ERROR_MESSAGES.SERVER_ERROR_DASHBOARD })
  }
}

// Helper to check if authenticated user can access target user's logs
const canAccessUserLogs = (authenticatedUser, targetUser) => {
  if (authenticatedUser.role === ROLES.SUPER_ADMIN) {
    return true
  }

  if (authenticatedUser.role === ROLES.COMPANY_ADMIN) {
    return authenticatedUser.companyId && targetUser.companyId &&
           authenticatedUser.companyId.equals(targetUser.companyId)
  }

  if (ROLES_WITH_ASSIGNED_STORES.includes(authenticatedUser.role)) {
    return targetUser.storeId &&
           authenticatedUser.assignedStores?.some(storeId => storeId.equals(targetUser.storeId))
  }

  return authenticatedUser.storeId && targetUser.storeId &&
         authenticatedUser.storeId.equals(targetUser.storeId)
}

const getUserActivityLog = async (req, res) => {
  try {
    const { targetUserId } = req.params
    const targetUser = await UsersModel.findById(targetUserId).select('storeId companyId')
    if (!targetUser) {
      return res
        .status(404)
        .json({ message: ERROR_MESSAGES.TARGET_USER_NOT_FOUND })
    }

    const authenticatedUser = await UsersModel.findById(req.userId).select(
      'role storeId companyId assignedStores'
    )
    if (!authenticatedUser) {
      return res
        .status(403)
        .json({ message: ERROR_MESSAGES.AUTH_USER_NOT_FOUND })
    }

    if (!canAccessUserLogs(authenticatedUser, targetUser)) {
      const message = authenticatedUser.role === ROLES.COMPANY_ADMIN
        ? 'Forbidden: You can only view activity logs for users within your company.'
        : ERROR_MESSAGES.FORBIDDEN
      return res.status(403).json({ message })
    }

    const logs = await QuoteLogModel.find({ userId: targetUser._id })
      .sort({ timestamp: -1 })
      .select('timestamp deviceDetails quoteType quoteAmount -_id')

    return res.status(200).json({ logs })
  } catch (err) {
    console.error('Error fetching activity log:', err)
    return res.status(500).json({ message: ERROR_MESSAGES.SERVER_ERROR })
  }
}

const downloadQuoteTrackingData = async (req, res) => {
  try {
    const matchStage = await buildMatchStage(req)
    const fullData = await QuoteLogModel.aggregate([
      { $match: matchStage },
      { $sort: { lastActivityDate: -1 } },
      {
        $group: {
          _id: '$userId',
          totalQuotes: {
            $sum: AGGREGATION_CONDITIONS.COUNT_EXACT_QUOTES,
          },
          totalQuickQuotes: {
            $sum: AGGREGATION_CONDITIONS.COUNT_QUICK_QUOTES,
          },
          sumOfAllQuotes: { $sum: '$quoteAmount' },
          lastActivityDate: { $max: '$timestamp' },
          lastDevice: { $first: '$deviceDetails' },
        },
      },
      { $sort: { lastActivityDate: -1 } },
      {
        $lookup: {
          from: 'brands',
          localField: 'lastDevice.brandId',
          foreignField: '_id',
          as: 'brandInfo',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $lookup: {
          from: 'stores',
          localField: 'userInfo.storeId',
          foreignField: '_id',
          as: 'storeInfo',
        },
      },
      { $unwind: '$userInfo' },
      { $unwind: { path: '$storeInfo', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$brandInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId: '$userInfo.email',
          role: '$userInfo.role',
          storeName: '$storeInfo.storeName',
          totalQuotes: 1,
          totalQuickQuotes: 1,
          sumOfAllQuotes: 1,
          lastActivityDate: 1,
          deviceNameAndCategory: '$lastDevice.name',
          brand: '$brandInfo.name',
          ram: '$lastDevice.ram',
          rom: '$lastDevice.rom',
          series: '$lastDevice.series',
        },
      },
    ])

    if (fullData.length === 0) {
      return res.status(404).send(ERROR_MESSAGES.NO_EXPORT)
    }

    const fields = [
      { label: 'User ID', value: 'userId' },
      { label: 'Role', value: 'role' },
      { label: 'Store Name', value: 'storeName' },
      { label: 'Total Quotes', value: 'totalQuotes' },
      { label: 'Total Quick Quotes', value: 'totalQuickQuotes' },
      { label: 'Sum of Quote Amount', value: 'sumOfAllQuotes' },
      {
        label: 'Last Activity',
        value: (row) => new Date(row.lastActivityDate).toLocaleString('en-IN'),
      },
      { label: 'Device Name and Category', value: 'deviceNameAndCategory' },
      { label: 'Brand', value: 'brand' },
      { label: 'RAM', value: 'ram' },
      { label: 'ROM', value: 'rom' },
      { label: 'Series', value: 'series' },
    ]

    const json2csvParser = new Parser({ fields, withBOM: true })
    const csv = json2csvParser.parse(fullData)
    res.header('Content-Type', 'text/csv; charset=utf-8')
    res.attachment('quote_tracking_report.csv')
    return res.send(csv)
  } catch (err) {
    console.error('Error generating CSV:', err)
    return res.status(500).json({ message: ERROR_MESSAGES.CSV_ERROR })
  }
}

export default {
  logQuoteAttempt,
  getQuoteTrackingData,
  getUserActivityLog,
  downloadQuoteTrackingData,
}
