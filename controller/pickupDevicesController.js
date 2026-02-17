import devicesLot from '../models/devicesLotModel.js'
import UsersModel from '../models/UsersModel.js'
import storeModel from '../models/storeModel.js'
import mongoose from 'mongoose'
import moment from 'moment'
import s3Controller from './s3.controller.js'
import transporter from '../utils/transporter.js'
import xlsx from 'xlsx'
import AWS from 'aws-sdk'

// ---------- Constants (avoid duplicated literals) ----------
const ERR_FORBIDDEN = 'Forbidden'
const ERR_USER_NOT_FOUND = 'Forbidden: User not found.'
const ERR_USER_NO_STORE = 'User not assigned to a store.'
const ERR_INTERNAL = 'Internal Server Error'
const ERR_NOT_FOUND = 'DevicesLot not found'
const ERR_INVALID_ID = 'Invalid devicesLot ID'
const DEFAULT_USER_ROLE = 'Admin'
const SUPER_ADMIN_ROLE = 'Super Admin'
const ADDITIONAL_EMAILS = [
  'tech@grest.in',
  'exchange@sangeetha.com',
  'Venkatesh@sangeetha.com',
  'Procurement@grest.in',
  'Chanderkant.upadhyay@grest.in',
  'Ketan.saoji@grest.in',
  'misoperator@sangeetha.com',
  'baljeet.singh@grest.in',
]

const PICK_DELIVERED = 'Pickup Complete'
const DELIVERY_AT_WAREHOUSE = 'Delivered At Warehouse'
const FINAL_STATUS = 'Payment Confirmed'

const DEV_LIST = '$deviceList'
const LEADS_DATA = '$leadsData'
const LEADS_UID = 'leadsData.userId'
const USER_STORE_SID = 'userData.storeId'
const STORE_DATA = '$storeData'

const LOCATION_CONCAT = {
  $concat: ['$storeData.storeName', ' - ', '$storeData.region'],
}

// ---------- Common Lookup Stages ----------
const userLookupStage = {
  $lookup: {
    from: 'users',
    localField: LEADS_UID,
    foreignField: '_id',
    as: 'userData',
  },
}

const storeLookupStage = {
  $lookup: {
    from: 'stores',
    localField: 'storeId', //changed to storeId from USER_STORE_SID
    foreignField: '_id',
    as: 'storeData',
  },
}

// ---------- Aggregation pipes ----------
const lotsPipe = [
  {
    $addFields: {
      firstDeviceId: { $arrayElemAt: [DEV_LIST, 0] },
    },
  },
  {
    $lookup: {
      from: 'leads',
      localField: 'firstDeviceId',
      foreignField: '_id',
      as: 'leadsData',
    },
  },
  { $unwind: LEADS_DATA },
  userLookupStage,
  { $unwind: '$userData' },
  storeLookupStage,
  { $unwind: STORE_DATA },
  { $sort: { updatedAt: -1 } },
]

const LotsProject = [
  {
    $addFields: {
      location: '$storeData.region',
    },
  },
  {
    $project: {
      leadsData: 0,
      storeData: 0,
      userData: 0,
    },
  },
]

const LotsByIDPipe = [
  { $unwind: DEV_LIST },
  {
    $lookup: {
      from: 'leads',
      localField: 'deviceList',
      foreignField: '_id',
      as: 'leadsData',
    },
  },
  { $unwind: LEADS_DATA },
  userLookupStage,
  { $unwind: '$userData' },
  storeLookupStage,
  { $unwind: '$storeData' },
  {
    $lookup: {
      from: 'models',
      foreignField: '_id',
      localField: 'leadsData.modelId',
      as: 'modelData',
    },
  },
  { $unwind: '$modelData' },
  {
    $lookup: {
      from: 'categories',
      localField: 'type',
      foreignField: 'categoryCode',
      as: 'categoryInfo',
    },
  },
  { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'documents',
      foreignField: '_id',
      localField: 'leadsData.documentId',
      as: 'docData',
    },
  },
  { $unwind: '$docData' },
  { $sort: { 'leadsData.createdAt': -1 } },
  {
    $project: {
      _id: '$leadsData._id',
      location: LOCATION_CONCAT,
      modelName: '$modelData.name',
      ramConfig: '$modelData.config',
      imei: '$docData.IMEI',
      leadsData: {
        $mergeObjects: [
          '$leadsData',
          { price: { $add: ['$leadsData.price', '$leadsData.bonusPrice'] } },
        ],
      },
    },
  },
]

// ---------- Helper utilities ----------
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

const getUserWithRole = async (userId) => {
  if (!userId) {
    return null
  }
  return UsersModel.findById(userId)
    .select('role storeId companyId assignedStores')
    .lean()
}

/**
 * Return match criteria depending on whether query role is 'Admin' or not
 * and whether we're fetching history or active lists.
 */
const getMatchCriteria = (queryRole = DEFAULT_USER_ROLE, isHistory = false) => {
  if (isHistory) {
    return queryRole === DEFAULT_USER_ROLE
      ? { status: DELIVERY_AT_WAREHOUSE }
      : {
          status: {
            $in: [FINAL_STATUS, DELIVERY_AT_WAREHOUSE, PICK_DELIVERED],
          },
        }
  }

  return queryRole === DEFAULT_USER_ROLE
    ? { status: { $ne: DELIVERY_AT_WAREHOUSE } }
    : {
        status: { $nin: [FINAL_STATUS, DELIVERY_AT_WAREHOUSE, PICK_DELIVERED] },
      }
}

/**
 * Apply store filtering to provided pipeline. Returns true if pipeline updated,
 * false when the user is not assigned to a store (non-super-admin path).
 */
const applyStoreFilterToPipeline = (
  pipeline,
  isSuperAdmin,
  user,
  query = {},
  companyStoreIds = null
) => {
  if (isSuperAdmin) {
    if (query.region) {
      pipeline.push({ $match: { 'storeData.region': query.region } })
    }
    if (query.storeName) {
      pipeline.push({ $match: { 'storeData.storeName': query.storeName } })
    }
    return true
  }

  // Company Admin - filter by all stores in their company
  if (
    user.role === 'Company Admin' &&
    companyStoreIds &&
    companyStoreIds.length > 0
  ) {
    const storeObjectIds = companyStoreIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    )
    pipeline.push({ $match: { 'storeData._id': { $in: storeObjectIds } } })
    return true
  }

  // Admin Manager & Technician - filter by assigned stores
  if (
    (user.role === 'Admin Manager' || user.role === 'Technician') &&
    user.assignedStores &&
    user.assignedStores.length > 0
  ) {
    const storeObjectIds = user.assignedStores.map(
      (id) => new mongoose.Types.ObjectId(id)
    )
    pipeline.push({ $match: { 'storeData._id': { $in: storeObjectIds } } })
    return true
  }

  if (!user?.storeId) {
    return false
  }
  pipeline.push({ $match: { 'storeData._id': user.storeId } })
  return true
}

/**
 * Handle store filter failure with consistent response
 */
const handleStoreFilterFailure = (res) => {
  return res.status(200).json({ data: [], message: ERR_USER_NO_STORE })
}

/**
 * Finalize pipeline by adding project stages and executing aggregation
 */
const finalizePipelineAndExecute = async (pipeline, message) => {
  pipeline.push(...LotsProject)
  const lotsList = await devicesLot.aggregate(pipeline)
  return { data: lotsList, message }
}

// ---------- Controllers ----------
const allLots = async (req, res) => {
  try {
    const user = await getUserWithRole(req.userId)
    if (!user) {
      return res.status(403).json({ msg: ERR_FORBIDDEN })
    }

    const isSuperAdmin = user.role === SUPER_ADMIN_ROLE
    const qrole = req.query.userRole || DEFAULT_USER_ROLE
    const matchCriteria = getMatchCriteria(qrole, false)

    const pipeline = [{ $match: matchCriteria }, ...lotsPipe]

    const ok = applyStoreFilterToPipeline(
      pipeline,
      isSuperAdmin,
      user,
      req.query,
      req.companyStoreIds
    )
    if (!ok) {
      return handleStoreFilterFailure(res)
    }

    const result = await finalizePipelineAndExecute(
      pipeline,
      'Successfully sent Lots'
    )
    return res.status(200).json(result)
  } catch (error) {
    console.error('Error in allLots:', error)
    return res
      .status(500)
      .json({ msg: "Something went wrong, couldn't find Lots" })
  }
}

const searchLots = async (req, res) => {
  try {
    const user = await getUserWithRole(req.userId)
    if (!user) {
      return res.status(403).json({ msg: ERR_FORBIDDEN })
    }

    const isSuperAdmin = user.role === SUPER_ADMIN_ROLE
    const { rid = '', date = '' } = req.query
    const qrole = req.query.userRole || DEFAULT_USER_ROLE
    const matchCriteria = getMatchCriteria(qrole, false)

    const pipeline = [
      { $match: matchCriteria },
      ...lotsPipe,
      {
        $addFields: {
          tempId: { $toString: '$_id' },
          tempDate: {
            $dateToString: { format: '%d/%m/%Y', date: '$createdAt' },
          },
        },
      },
      {
        $match: {
          $and: [
            { uniqueCode: { $regex: `^${rid}`, $options: 'i' } },
            { tempDate: { $regex: `^${date}`, $options: 'i' } },
          ],
        },
      },
    ]

    const ok = applyStoreFilterToPipeline(
      pipeline,
      isSuperAdmin,
      user,
      req.query,
      req.companyStoreIds
    )
    if (!ok) {
      return handleStoreFilterFailure(res)
    }

    const result = await finalizePipelineAndExecute(
      pipeline,
      'Successfully searched data'
    )
    return res.status(200).json({ data: result.data, msg: result.message })
  } catch (error) {
    console.error('Error in searchLots:', error)
    return res.status(500).json({ msg: ERR_INTERNAL })
  }
}

const lotsHistory = async (req, res) => {
  try {
    const user = await getUserWithRole(req.userId)
    if (!user) {
      return res.status(403).json({ msg: ERR_FORBIDDEN })
    }

    const isSuperAdmin = user.role === SUPER_ADMIN_ROLE
    const qrole = req.role || DEFAULT_USER_ROLE
    console.log({ qrole })
    const matchCriteria = getMatchCriteria(qrole, true)

    const pipeline = [{ $match: matchCriteria }, ...lotsPipe]

    const ok = applyStoreFilterToPipeline(
      pipeline,
      isSuperAdmin,
      user,
      req.query,
      req.companyStoreIds
    )
    if (!ok) {
      return handleStoreFilterFailure(res)
    }

    const result = await finalizePipelineAndExecute(
      pipeline,
      'Successfully sent Lots History'
    )
    return res.status(200).json(result)
  } catch (error) {
    console.error('Error in lotsHistory:', error)
    return res
      .status(500)
      .json({ msg: "Something went wrong, couldn't find Lots History" })
  }
}

const updateStatus = async (req, res) => {
  const { refIDs, newStatus, reason } = req.body
  if (!Array.isArray(refIDs) || refIDs.length === 0) {
    return res.status(400).json({ msg: 'refIDs must be a non-empty array' })
  }

  try {
    const updateDevice = await devicesLot.updateMany(
      { _id: { $in: refIDs } },
      { $set: { status: newStatus, remarks: reason } }
    )
    return res.status(200).json({
      data: updateDevice,
      message: 'Successfully updated lots status',
    })
  } catch (err) {
    console.error('Error updating lots status:', err)
    return res
      .status(500)
      .json({ msg: "Updating lot's status failed, Please try again." })
  }
}

const devicesList = async (req, res) => {
  const refId = req.params.rid
  if (!isValidObjectId(refId)) {
    return res.status(400).json({ msg: ERR_INVALID_ID })
  }

  try {
    const deviceList = await devicesLot.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(refId) } },
      ...LotsByIDPipe,
    ])
    return res
      .status(200)
      .json({ data: deviceList, message: 'Successfully sended devicesList' })
  } catch (error) {
    console.error('Error in devicesList:', error)
    return res
      .status(500)
      .json({ msg: "Something went wrong, couldn't find devices" })
  }
}

/**
 * Build date range match criteria
 */
const buildDateMatch = (fromdate, todate) => {
  const match = {}
  if (fromdate && todate) {
    match.updatedAt = {
      $gte: moment(fromdate).startOf('day').toDate(),
      $lte: moment(todate).endOf('day').toDate(),
    }
  }
  return match
}

/**
 * Build search match stage
 */
const buildSearchMatch = (search) => {
  if (!search) {
    return null
  }

  return {
    $match: {
      $or: [
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'store.storeName': { $regex: search, $options: 'i' } },
      ],
    },
  }
}

/**
 * Add store filter if not super admin
 */
const addStoreFilter = (
  pipeline,
  isSuperAdmin,
  loggedInUser,
  companyStoreIds = null
) => {
  if (!isSuperAdmin) {
    // Company Admin - filter by all stores in their company
    if (
      loggedInUser.role === 'Company Admin' &&
      companyStoreIds &&
      companyStoreIds.length > 0
    ) {
      const storeObjectIds = companyStoreIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      )
      pipeline.push({
        $match: { storeId: { $in: storeObjectIds } },
      })
    }
    // Admin Manager & Technician - filter by assigned stores
    else if (
      (loggedInUser.role === 'Admin Manager' ||
        loggedInUser.role === 'Technician') &&
      loggedInUser.assignedStores &&
      loggedInUser.assignedStores.length > 0
    ) {
      pipeline.push({
        $match: { storeId: { $in: loggedInUser.assignedStores } },
      })
    } else if (loggedInUser.storeId) {
      pipeline.push({ $match: { storeId: loggedInUser.storeId } })
    }
  }
}

/**
 * Build technician report pipeline
 */
const buildTechnicianPipeline = (
  match,
  isSuperAdmin,
  loggedInUser,
  search,
  companyStoreIds = null
) => {
  const pipeline = [{ $match: match }]

  addStoreFilter(pipeline, isSuperAdmin, loggedInUser, companyStoreIds)

  pipeline.push(
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          userId: '$userId',
          storeId: '$storeId',
        },
        totalDevice: { $sum: '$totalDevice' },
        docs: { $push: '$$ROOT' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id.userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $lookup: {
        from: 'stores',
        localField: '_id.storeId',
        foreignField: '_id',
        as: 'store',
      },
    },
    { $unwind: '$store' }
  )

  // Filter out non-technician roles (only show Admin role, which are technicians)
  pipeline.push({
    $match: {
      'user.role': 'Technician',
    },
  })

  const searchStage = buildSearchMatch(search)
  if (searchStage) {
    pipeline.push(searchStage)
  }

  pipeline.push(
    { $sort: { '_id.date': -1 } },
    {
      $project: {
        _id: 0,
        date: '$_id.date',
        userId: '$_id.userId',
        storeId: '$_id.storeId',
        totalDevice: 1,
        user: {
          _id: '$user._id',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          name: '$user.name',
          role: '$user.role',
        },
        store: {
          storeName: '$store.storeName',
        },
      },
    }
  )

  return pipeline
}

const technicianReport = async (req, res) => {
  try {
    const loggedInUser = await getUserWithRole(req.userId)
    if (!loggedInUser) {
      return res.status(403).json({ msg: ERR_USER_NOT_FOUND })
    }

    const isSuperAdmin = loggedInUser.role === SUPER_ADMIN_ROLE
    const { search, fromdate, todate } = req.query

    const match = buildDateMatch(fromdate, todate)
    const pipeline = buildTechnicianPipeline(
      match,
      isSuperAdmin,
      loggedInUser,
      search,
      req.companyStoreIds
    )

    const result = await devicesLot.aggregate(pipeline)
    return res.status(200).json(result)
  } catch (err) {
    console.error('Error in technicianReport:', err)
    return res
      .status(500)
      .json({ message: ERR_INTERNAL, error: err.toString() })
  }
}

/**
 * Handle file upload to S3 and return the URL
 */
const handleFileUpload = async (file) => {
  if (!file) {
    return null
  }

  try {
    return await s3Controller.uploadFileBuffer(file)
  } catch (uploadError) {
    console.error('Error uploading file to S3:', uploadError)
    throw new Error('Failed to upload payment receipt file')
  }
}

/**
 * Build update data object from upload URL and remarks
 */
const buildUpdateData = (paymentReceiptUrl, remarks) => {
  const updateData = {}
  if (paymentReceiptUrl) {
    updateData.paymentReceipt = paymentReceiptUrl
  }
  if (remarks !== undefined) {
    updateData.remarks = remarks
  }
  return updateData
}

/**
 * Handle email sending with proper error handling
 */
const handleEmailSending = async (
  res,
  id,
  receiptUrl,
  remarks,
  updatedDevicesLot
) => {
  try {
    await sendPaymentReceiptEmail(id, receiptUrl, remarks)
    return res.status(200).json({
      success: true,
      message: 'Payment receipt uploaded and email sent successfully',
      data: updatedDevicesLot,
    })
  } catch (emailError) {
    console.error('Error sending email:', emailError)
    return res.status(200).json({
      success: true,
      message:
        'Payment receipt uploaded successfully, but email sending failed',
      data: updatedDevicesLot,
      emailError: emailError.message,
    })
  }
}

/**
 * Update payment receipt (S3 upload via s3Controller) and remarks.
 * If a receipt exists (either newly uploaded or already on record), sends email with device list and receipt attached.
 */
const updatePaymentReceiptAndRemarks = async (req, res) => {
  try {
    const { id } = req.params
    const { remarks } = req.body

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: ERR_INVALID_ID })
    }

    const paymentReceiptUrl = await handleFileUpload(req.file)
    const updateData = buildUpdateData(paymentReceiptUrl, remarks)

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'No data provided to update' })
    }

    const updatedDevicesLot = await devicesLot.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )

    if (!updatedDevicesLot) {
      return res.status(404).json({ success: false, message: ERR_NOT_FOUND })
    }

    const receiptExists =
      updateData.paymentReceipt || updatedDevicesLot.paymentReceipt
    if (receiptExists) {
      const receiptUrl =
        updateData.paymentReceipt || updatedDevicesLot.paymentReceipt
      return await handleEmailSending(
        res,
        id,
        receiptUrl,
        remarks,
        updatedDevicesLot
      )
    }

    return res.status(200).json({
      success: true,
      message: 'DevicesLot updated successfully',
      data: updatedDevicesLot,
    })
  } catch (error) {
    if (error.message === 'Failed to upload payment receipt file') {
      return res.status(500).json({
        success: false,
        message: error.message,
        error: error.message,
      })
    }
    console.error('Error updating devicesLot:', error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    })
  }
}

/**
 * Fetch device details for a lot
 */
const fetchDeviceDetails = async (lotId) => {
  const deviceDetails = await devicesLot.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(lotId) } },
    ...LotsByIDPipe,
  ])

  if (!deviceDetails || deviceDetails.length === 0) {
    throw new Error('No device details found for this lot')
  }

  return deviceDetails
}

/**
 * Fetch lot and store information
 */
const fetchLotAndStoreInfo = async (lotId) => {
  const lotInfo = await devicesLot.findById(lotId).lean()
  if (!lotInfo) {
    throw new Error('Lot not found')
  }

  const storeInfo = await storeModel.findById(lotInfo.storeId).lean()
  if (!storeInfo || !storeInfo.email) {
    throw new Error('Store email not found for this lot')
  }

  return { lotInfo, storeInfo }
}

/**
 * Format device data for Excel export
 */
const formatDeviceDataForExcel = (deviceDetails, lotId, lotInfo) => {
  return deviceDetails.map((device) => ({
    'Lead Id':
      device.leadsData?._id?.toString() || device._id?.toString() || 'N/A',
    'Lot Id': lotId,
    'Order Id': device.leadsData?.uniqueCode || 'N/A',
    'Payment Date': moment(lotInfo.updatedAt).format('DD/MM/YYYY'),
    'Device Name': device.modelName || 'N/A',
    'IMEI No': device.imei || 'N/A',
    Storage: device.leadsData?.storage || 'N/A',
    Price: device.leadsData?.price || 0,
    Location: device.location || 'N/A',
  }))
}

/**
 * Create Excel buffer from formatted data
 */
const createExcelBuffer = (formattedData) => {
  const workbook = xlsx.utils.book_new()
  const worksheet = xlsx.utils.json_to_sheet(formattedData)
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Device Details')
  return xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' })
}

/**
 * Download and attach payment receipt from S3
 */
const attachPaymentReceipt = async (paymentReceiptUrl, attachments) => {
  if (!paymentReceiptUrl) {
    return
  }

  try {
    const s3 = new AWS.S3({
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    })

    const urlParts = new URL(paymentReceiptUrl)
    const bucketName = process.env.S3_BUCKET_NAME
    const key = decodeURIComponent(urlParts.pathname.substring(1))

    // Extract original filename from the key or use the last part of the path
    const originalFilename = key.split('/').pop() || 'Payment_Receipt'

    const fileData = await s3
      .getObject({ Bucket: bucketName, Key: key })
      .promise()
    attachments.push({
      filename: originalFilename,
      content: fileData.Body,
    })
  } catch (downloadError) {
    console.error('Error downloading payment receipt from S3:', downloadError)
  }
}

/**
 * Get Sangeeta store IDs from environment variable
 */
const getSangeetaStoreIds = () => {
  const storeIdsString = process.env.SANGEETA_STORE_IDS || ''
  return storeIdsString
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id)
}

/**
 * Check if storeId is a Sangeeta store
 */
const isSangeetaStore = (storeId) => {
  const sangeetaStoreIds = getSangeetaStoreIds()
  return sangeetaStoreIds.includes(storeId.toString())
}

/**
 * Helper to build Excel + send email with attachments (device list + optional receipt PDF from S3).
 */
const sendPaymentReceiptEmail = async (lotId, paymentReceiptUrl, remarks) => {
  try {
    const deviceDetails = await fetchDeviceDetails(lotId)
    const { lotInfo, storeInfo } = await fetchLotAndStoreInfo(lotId)

    const formattedData = formatDeviceDataForExcel(
      deviceDetails,
      lotId,
      lotInfo
    )
    const excelBuffer = createExcelBuffer(formattedData)

    const attachments = [
      { filename: `Devices_In_Lots_Data_${lotId}.xlsx`, content: excelBuffer },
    ]

    await attachPaymentReceipt(paymentReceiptUrl, attachments)

    // Build email HTML
    const emailHtml = `
      <div style="max-width: 600px; margin: auto; padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Payment Receipt and Device Details</h2>
        <p>Dear Team,</p>
        <p>Please find attached the payment receipt and device details for Lot ID: <strong>${lotId}</strong></p>
        <p><strong>Total Devices:</strong> ${formattedData.length}</p>
        <p><strong>Payment Date:</strong> ${moment(lotInfo.updatedAt).format(
          'DD/MM/YYYY'
        )}</p>
        ${remarks ? `<p><strong>UTR Number:</strong> ${remarks}</p>` : ''}
        <p><strong>Remarks:</strong> </p>
        <br>
        <p>Best regards,<br>Grest C2B System</p>
      </div>
    `

    console.log('Store ID:', storeInfo._id.toString())

    let emailRecipients = storeInfo.email

    // If this is a Sangeeta store, also send to additional recipients
    if (isSangeetaStore(storeInfo._id)) {
      emailRecipients = Array.isArray(emailRecipients)
        ? [...emailRecipients, ...ADDITIONAL_EMAILS]
        : [emailRecipients, ...ADDITIONAL_EMAILS]
    }

    console.log('Email recipients:', emailRecipients)

    await transporter.sendMail({
      from: process.env.MAIL,
      to: emailRecipients,
      subject: `Payment Receipt and Device Details - Lot ${lotInfo.uniqueCode}`,
      html: emailHtml,
      attachments,
    })

    return { success: true, message: 'Email sent successfully' }
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

export default {
  allLots,
  searchLots,
  updateStatus,
  devicesList,
  lotsHistory,
  technicianReport,
  updatePaymentReceiptAndRemarks,
  LotsByIDPipe,
}
