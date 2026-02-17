import mongoose from 'mongoose'
import leads from '../models/leadsModel.js'
import { CORE2 } from '../const.js'
import condtionCodesWatch from '../models/conditionCodesWatchModel.js'
import phoneCondition from '../models/phoneConditon.js'
import gradeprices from '../models/gradePriceModel.js'
import leadLifecycle from '../models/LeadLifecycle.js'
import timeRangeCal from '../utils/timeRangeCal.js'
import UsersModel from '../models/UsersModel.js'

// ---- CONSTANTS ---- //
const GRADE_MAP = {
  'A+': 'A_PLUS',
  A: 'A',
  B: 'B',
  'B-': 'B_MINUS',
  'C+': 'C_PLUS',
  C: 'C',
  'C-': 'C_MINUS',
  'D+': 'D_PLUS',
  D: 'D',
  'D-': 'D_MINUS',
  E: 'E',
}

const LITERALS = {
  PICKUP_CONFIRMED: 'Pickup Confirmed',
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  EVENT_ORDER_CREATED: 'orderCreated',
  EVENT_QUOTE_CREATED: 'quoteCreated',
}

// ---- HELPERS ---- //
const convertGrade = (grade) => GRADE_MAP[grade]

function checkKeysValidity(keys, adminAnswer) {
  return keys.some(
    (key) => !adminAnswer.hasOwnProperty(key) || adminAnswer[key] === ''
  )
}

const handleForbidden = (res, message = 'Forbidden: User not found.') => {
  return res.status(403).json({ message })
}

// Helper to get and validate logged-in user
const getLoggedInUser = (userId) => {
  return UsersModel.findById(userId).select(
    'role storeId companyId assignedStores'
  )
}

// ---- PIPELINES ---- //
// Helper to create lookup and unwind pipeline stages
const createLookupStage = (from, localField, foreignField, as, preserveNull = true) => [
  {
    $lookup: {
      from,
      localField,
      foreignField,
      as,
    },
  },
  { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: preserveNull } },
]

const userDocPipe = [
  ...createLookupStage('users', 'userId', '_id', 'userId'),
  ...createLookupStage('companies', 'userId.companyId', '_id', 'companyInfo'),
  ...createLookupStage('documents', 'documentId', '_id', 'documentId'),
]

const modelStorePipe = [
  ...createLookupStage('models', 'modelId', '_id', 'modelId'),
  ...createLookupStage('stores', 'storeId', '_id', 'store'),
  ...createLookupStage('condtioncodes', 'gradeId', '_id', 'gradeId'),
]

const orderPipe = [
  ...createLookupStage('users', 'userid', '_id', 'user', false),
  ...createLookupStage('leads', 'lead_id', '_id', 'lead', false),
  { $match: { 'lead.is_selled': false } },
  ...createLookupStage('models', 'lead.modelId', '_id', 'lead.model', false),
  ...createLookupStage('categories', 'lead.model.type', 'categoryCode', 'categoryInfo'),
]

// ---- QUERY BUILDERS ---- //
const buildQuery = (id, customerId, userId, isSelled, startDate, endDate) => {
  const query = {
    createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
  }
  if (id) {
    query._id = new mongoose.Types.ObjectId(id)
  }
  if (customerId) {
    query._id = new mongoose.Types.ObjectId(customerId)
  }
  if (userId) {
    query.userId = new mongoose.Types.ObjectId(userId)
  }
  if (isSelled) {
    query.is_selled = true
  }
  return query
}

// Helper to build search filters
const buildSearchFilters = (rid, customerPhone) => {
  const searchFilters = []

  if (rid?.trim()) {
    searchFilters.push({
      $or: [
        { 'modelId.name': { $regex: rid, $options: 'i' } },
        { uniqueCode: { $regex: rid, $options: 'i' } },
        { 'documentId.IMEI': { $regex: rid, $options: 'i' } },
        { 'userId.name': { $regex: rid, $options: 'i' } },
        { 'userId.firstName': { $regex: rid, $options: 'i' } },
      ],
    })
  }

  if (customerPhone?.trim()) {
    searchFilters.push({
      $or: [
        { name: { $regex: customerPhone, $options: 'i' } },
        { phoneNumber: { $regex: customerPhone, $options: 'i' } },
        { emailId: { $regex: customerPhone, $options: 'i' } },
      ],
    })
  }

  return searchFilters
}

// Helper to build store filter stages
const buildStoreFilter = (store, fieldName = 'storeId') => {
  if (!store) {
    return []
  }

  const storeIds = Array.isArray(store)
    ? store.map((s) => new mongoose.Types.ObjectId(s))
    : [new mongoose.Types.ObjectId(store)]

  return [
    {
      $match: {
        [fieldName]: Array.isArray(store) ? { $in: storeIds } : storeIds[0],
      },
    },
  ]
}

// Helper to apply store scoping for non-super-admin users
const applyStoreScoping = (loggedInUser, isSuperAdmin) => {
  if (isSuperAdmin) {
    return null
  }

  if (['Admin Manager', 'Manager', 'Technician'].includes(loggedInUser.role)) {
    if (
      !loggedInUser.assignedStores ||
      loggedInUser.assignedStores.length === 0
    ) {
      return { isEmpty: true }
    }
    return { store: loggedInUser.assignedStores.map((s) => s.toString()) }
  }

  if (loggedInUser.storeId) {
    return { store: loggedInUser.storeId.toString() }
  }

  return null
}

// Helper to validate and apply company scoping
const applyCompanyScoping = (companyId, loggedInUser, isSuperAdmin) => {
  if (!companyId && !isSuperAdmin && loggedInUser.companyId) {
    // Auto-apply company filter for non-Super Admins
    return { companyAdminCompanyId: loggedInUser.companyId.toString() }
  }

  if (!companyId) {
    return {}
  }

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    return { error: { status: 400, message: 'Invalid companyId format' } }
  }

  // Only Super Admin can filter by a different company
  if (!isSuperAdmin && companyId !== loggedInUser.companyId.toString()) {
    return {
      error: {
        status: 403,
        message: 'Forbidden: Cannot access prospects from another company',
      },
    }
  }

  return { companyAdminCompanyId: companyId }
}

const buildAggregationPipeline = (config) => {
  const {
    query,
    rid,
    customerPhone,
    deviceType,
    grestRec,
    store,
    id,
    companyAdminCompanyId, // 👈 for Company Admin ONLY
  } = config

  const matchQuery = { ...query }

  if (companyAdminCompanyId) {
    delete matchQuery.companyId
  }

  const pipeline = [
    { $match: matchQuery },

    ...userDocPipe,
    ...modelStorePipe,

    // ---------------- LOT INFO ----------------
    {
      $lookup: {
        from: 'deviceslots',
        localField: '_id',
        foreignField: 'deviceList',
        as: 'lotInfo',
      },
    },
    {
      $unwind: {
        path: '$lotInfo',
        preserveNullAndEmptyArrays: true,
      },
    },

    // ---------------- CATEGORY ----------------
    {
      $lookup: {
        from: 'categories',
        localField: 'modelId.type',
        foreignField: 'categoryCode',
        as: 'categoryInfo',
      },
    },
    {
      $unwind: {
        path: '$categoryInfo',
        preserveNullAndEmptyArrays: true,
      },
    },

    // ---------------- PRICE ----------------
    {
      $addFields: {
        actualPrice: { $add: ['$price', 0] },
        price: { $add: ['$price', '$bonusPrice'] },
      },
    },

    // ---------------- GREST ----------------
    {
      $addFields: {
        grestReceived: {
          $cond: [
            { $eq: ['$lotInfo.status', LITERALS.PICKUP_CONFIRMED] },
            'yes',
            'no',
          ],
        },
        grestRecDate: {
          $cond: [
            { $eq: ['$lotInfo.status', LITERALS.PICKUP_CONFIRMED] },
            '$lotInfo.updatedAt',
            null,
          ],
        },
      },
    },
  ]

  pipeline.push({
    $addFields: {
      grade: { $ifNull: ['$gradeId.grade', 'E'] },
    },
  })

  if (companyAdminCompanyId) {
    pipeline.push({
      $match: {
        $or: [
          { companyId: new mongoose.Types.ObjectId(companyAdminCompanyId) },
          {
            'userId.companyId': new mongoose.Types.ObjectId(
              companyAdminCompanyId
            ),
          },
        ],
      },
    })
  }

  // ---------------- SEARCH & FILTERS ----------------
  if (!id) {
    const searchFilters = buildSearchFilters(rid, customerPhone)

    if (searchFilters.length) {
      pipeline.push({ $match: { $and: searchFilters } })
    }

    // Device type
    pipeline.push({ $match: { 'modelId.type': deviceType } })

    // GREST filter
    if (grestRec) {
      pipeline.push({ $match: { grestReceived: grestRec } })
    }

    // ---------------- STORE FILTER (ObjectId SAFE) ----------------
    const storeFilters = buildStoreFilter(store)
    pipeline.push(...storeFilters)
  }

  // ---------------- SECURITY ----------------
  pipeline.push({
    $project: {
      'userId.password': 0,
      'userId.tokenVersion': 0,
    },
  })

  return pipeline
}

// Helper to process query parameters and apply scoping
const processQueryAndScoping = (req, loggedInUser, isSuperAdmin) => {
  const {
    rid = '',
    customerPhone = '',
    deviceType = 'CTG1',
    filter,
    grestRec,
    userId,
    is_selled,
    id,
    companyId,
  } = req.query

  let { store } = req.query

  const { startDate, endDate } = timeRangeCal.timeRangeCal(
    filter,
    req.query.startDate,
    req.query.endDate
  )

  // Store scoping
  const storeScopingResult = applyStoreScoping(loggedInUser, isSuperAdmin)
  if (storeScopingResult?.store) {
    store = storeScopingResult.store
  }

  // Base query
  const query = buildQuery(id, null, userId, is_selled, startDate, endDate)

  // Company scoping
  const companyScopingResult = applyCompanyScoping(
    companyId,
    loggedInUser,
    isSuperAdmin
  )

  return {
    rid,
    customerPhone,
    deviceType,
    grestRec,
    store,
    id,
    query,
    companyScopingResult,
    storeScopingResult,
  }
}

// ---- CORE CONTROLLERS ---- //
const findAll = async (req, res) => {
  try {
    const loggedInUser = await getLoggedInUser(req.userId)

    if (!loggedInUser) {
      return handleForbidden(res)
    }

    const isSuperAdmin = loggedInUser.role === LITERALS.SUPER_ADMIN
    const page = Number(req.query.page) || 0
    const limit = Number(req.query.limit) || 10

    const {
      rid,
      customerPhone,
      deviceType,
      grestRec,
      store,
      id,
      query,
      companyScopingResult,
      storeScopingResult,
    } = processQueryAndScoping(req, loggedInUser, isSuperAdmin)

    // Check store scoping
    if (storeScopingResult?.isEmpty) {
      return res.status(200).json({
        data: [],
        totalCounts: 0,
        message: 'User not assigned to any stores.',
      })
    }

    // Check company scoping
    if (companyScopingResult.error) {
      return res.status(companyScopingResult.error.status).json({
        message: companyScopingResult.error.message,
      })
    }

    const companyAdminCompanyId =
      companyScopingResult.companyAdminCompanyId || null

    const aggregationPipeline = buildAggregationPipeline({
      query,
      rid,
      customerPhone,
      deviceType,
      grestRec,
      store,
      id,
      companyAdminCompanyId,
    })

    // Single record
    if (id) {
      const singleRecord = await leads.aggregate(aggregationPipeline)
      return res.status(200).json({
        data: singleRecord[0] || null,
        message: singleRecord.length
          ? 'Lead fetched successfully.'
          : 'Lead not found.',
      })
    }

    // Pagination
    const skip = page * limit
    const countResult = await leads.aggregate(
      [...aggregationPipeline, { $count: 'totalCounts' }],
      { allowDiskUse: true }
    )

    const totalCounts = countResult[0]?.totalCounts || 0

    aggregationPipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    )

    const data = await leads.aggregate(aggregationPipeline, {
      allowDiskUse: true,
    })

    return res.status(200).json({
      data,
      totalCounts,
      message: 'Leads fetched successfully.',
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: error.message })
  }
}

const findAllSelled = async (req, res) => {
  req.query.is_selled = true
  return findAll(req, res)
}

const findLeadById = async (req, res) => findAll(req, res)

const getLeadById = async (id) => {
  const { startDate, endDate } = timeRangeCal.timeRangeCal('all')
  const query = buildQuery(id, null, null, null, startDate, endDate)
  const pipeline = buildAggregationPipeline({
    query,
    rid: '',
    customerPhone: '',
    deviceType: 'CTG1',
    grestRec: null,
    store: null,
    id,
    companyAdminCompanyId: null,
  })
  const data = await leads.aggregate(pipeline)
  return data[0] || null
}

const calculatePriceAdminWatch = async (req, res) => {
  const { adminAnswer } = req.body
  const keys = ['MobileID', 'Warranty', 'Accessories', 'Functional', 'Physical']

  if (checkKeysValidity(keys, adminAnswer)) {
    return res
      .status(403)
      .json({ success: false, message: 'QNA, modelId are required' })
  }

  const modelID = adminAnswer.MobileID
  const query = {
    warrentyCode: adminAnswer.Warranty,
    accessoriesCode: adminAnswer.Accessories,
    functionalCode: adminAnswer.Functional,
    cosmeticsCode: adminAnswer.Physical,
  }

  const gradeData = await condtionCodesWatch.findOne(query).select('grade')
  const priceData = await gradeprices
    .findOne({ modelId: modelID })
    .select('grades')
  const price = priceData.grades[convertGrade(gradeData.grade)]

  return res.status(200).json({
    data: { price, grade: gradeData.grade },
    message: 'price fetched successfully.',
  })
}

const calculatePriceAdmin = async (req, res) => {
  try {
    const { adminAnswer } = req.body
    const { MobileID: modelId, storage, ram: RAM } = adminAnswer

    const query = Object.fromEntries(
      Object.entries({
        coreCode: adminAnswer.Core,
        warrentyCode: adminAnswer.Warranty,
        displayCode: adminAnswer.Display,
        functionalMajorCode: adminAnswer.Functional_major,
        functionalMinorCode: adminAnswer.Functional_minor,
        cosmeticsCode: adminAnswer.Cosmetics,
        accessoriesCode: adminAnswer.Accessories,
        functionalCode: adminAnswer.Functional,
      }).filter(([_, value]) => value !== '')
    )

    const gradeData =
      query.coreCode !== CORE2
        ? await phoneCondition
            .findOne((({ coreCode, ...rest }) => rest)(query))
            .select('grade')
        : { grade: 'E' }

    const priceData = await gradeprices
      .findOne({
        modelId,
        $or: [
          { storage, RAM },
          { storage, RAM: { $exists: false } },
          { storage: { $exists: false }, RAM },
          { storage: { $exists: false }, RAM: { $exists: false } },
        ],
      })
      .select('grades')

    const price =
      query.coreCode === CORE2
        ? priceData.grades.E
        : priceData.grades[convertGrade(gradeData.grade)]
    return res.status(200).json({
      data: { price, grade: gradeData.grade },
      message: 'price fetched successfully.',
    })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
}

// ---- LIFECYCLE REPORT HELPERS ---- //
const LIFECYCLE_STORE_FIELD = 'user.storeId'

// Helper to apply role-based store scoping with company scoping
const applyStoreAndCompanyScopingToLifecycle = (
  pipeline,
  isSuperAdmin,
  isCompanyAdmin,
  loggedInUser,
  store
) => {
  if (!isSuperAdmin && !isCompanyAdmin && store) {
    pipeline.push(...buildStoreFilter(store, LIFECYCLE_STORE_FIELD))
    return
  }

  if (isCompanyAdmin && loggedInUser.companyId) {
    pipeline.push({
      $match: { 'user.companyId': loggedInUser.companyId },
    })
    if (store) {
      pipeline.push(...buildStoreFilter(store, LIFECYCLE_STORE_FIELD))
    }
    return
  }

  if (isSuperAdmin && store) {
    pipeline.push(...buildStoreFilter(store, LIFECYCLE_STORE_FIELD))
  }
}


const buildSearchMatchStage = (search) => ({
  $match: {
    $or: [
      { 'lead.model.name': { $regex: search, $options: 'i' } },
      { 'lead.phoneNumber': { $regex: search, $options: 'i' } },
      { 'lead.emailId': { $regex: search, $options: 'i' } },
      { 'user.firstName': { $regex: search, $options: 'i' } },
      { 'lead.uniqueCode': { $regex: search, $options: 'i' } },
      { 'lead.name': { $regex: search, $options: 'i' } },
      { 'user.name': { $regex: search, $options: 'i' } },
    ],
  },
})

// ---- LIFECYCLE REPORTS ---- //
async function lifecycleReport(req, res, eventType, dataKey) {
  try {
    const loggedInUser = await getLoggedInUser(req.userId)
    if (!loggedInUser) {
      return handleForbidden(res)
    }

    const isSuperAdmin = loggedInUser.role === LITERALS.SUPER_ADMIN
    const isCompanyAdmin = loggedInUser.role === LITERALS.COMPANY_ADMIN
    const page = Number(req.query.page) || 0
    const limit = Number(req.query.limit) || 10
    const { time, search, fromdate, todate } = req.query
    let { store } = req.query

    // Store-level filtering for Admin Manager/Manager/Technician
    const storeScopingResult = applyStoreScoping(loggedInUser, isSuperAdmin)
    if (storeScopingResult?.isEmpty) {
      return res
        .status(200)
        .json({ code: 200, data: { [dataKey]: { count: 0, data: [] } } })
    }
    if (storeScopingResult?.store) {
      store = storeScopingResult.store
    }

    const { startDate, endDate } = timeRangeCal.timeRangeCal(
      time,
      fromdate,
      todate
    )

    const query = [
      {
        $match: {
          eventType,
          updatedAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
        },
      },
    ]
    const aggregationPipeline = [...orderPipe, { $sort: { createdAt: -1 } }]

    // Apply role-based store filtering
    applyStoreAndCompanyScopingToLifecycle(
      aggregationPipeline,
      isSuperAdmin,
      isCompanyAdmin,
      loggedInUser,
      store
    )

    // Apply search filter
    if (search) {
      aggregationPipeline.push(buildSearchMatchStage(search))
    }

    const skip = page * limit
    const countResult = await leadLifecycle.aggregate([
      ...query,
      ...aggregationPipeline,
      { $count: 'totalCount' },
    ])
    const totalCount = countResult[0]?.totalCount || 0

    const results = await leadLifecycle.aggregate([
      ...query,
      ...aggregationPipeline,
      { $skip: skip },
      { $limit: limit },
    ])
    const data = { [dataKey]: { count: totalCount, data: results } }

    return res.status(200).json({ code: 200, data })
  } catch (err) {
    return res
      .status(500)
      .json({ code: 500, message: 'An error occurred', error: err.toString() })
  }
}

const orderCreated = (req, res) =>
  lifecycleReport(req, res, LITERALS.EVENT_ORDER_CREATED, 'orderData')
const QuoteCreated = (req, res) =>
  lifecycleReport(req, res, LITERALS.EVENT_QUOTE_CREATED, 'quoteData')

export default {
  findAll,
  findAllSelled,
  findLeadById,
  calculatePriceAdmin,
  orderCreated,
  QuoteCreated,
  orderPipe,
  getLeadById,
}
