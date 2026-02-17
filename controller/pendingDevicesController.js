import leads from '../models/leadsModel.js'
import devicesLot from '../models/devicesLotModel.js'
import outstandingLot from '../models/outstandingLotModel.js'
import UsersModel from '../models/UsersModel.js'
import mongoose from 'mongoose'
// CR: Import user model to verify role and store assignment for access control.
const ISE = 'Internal Server Error, Failed To Create New Lot'
const bonusPriceField = '$bonusPrice'
const getAllLeadsPipe = [
  {
    $match: {
      $and: [
        { is_selled: true },
        { status: { $nin: ['Pending'] } },
        { status: { $ne: 'Completed' } },
      ],
    },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'userData',
    },
  },
  {
    $unwind: '$userData',
  },
  {
    $lookup: {
      from: 'models',
      localField: 'modelId',
      foreignField: '_id',
      as: 'modelData',
    },
  },
  {
    $unwind: '$modelData',
  },
  {
    $lookup: {
      from: 'categories',
      localField: 'modelData.type',
      foreignField: 'categoryCode',
      as: 'categoryInfo',
    },
  },
  {
    $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true },
  },
  {
    $lookup: {
      from: 'documents',
      localField: 'documentId',
      foreignField: '_id',
      as: 'docData',
    },
  },
  {
    $unwind: '$docData',
  },
  {
    $lookup: {
      //check storeId and assignedStores
      from: 'stores',
      let: {
        resolvedStoreIds: {
          $cond: [
            {
              $gt: [
                { $size: { $ifNull: ['$userData.assignedStores', []] } },
                0,
              ],
            },
            '$userData.assignedStores',
            [
              {
                $cond: [
                  { $ifNull: ['$userData.storeId', false] },
                  '$userData.storeId',
                  null,
                ],
              },
            ],
          ],
        },
      },
      pipeline: [
        {
          $match: {
            $expr: { $in: ['$_id', '$$resolvedStoreIds'] },
          },
        },
      ],
      as: 'storeData',
    },
  },
  {
    $unwind: '$storeData',
  },

  { $sort: { updatedAt: -1 } },
]

const AllLeadsProjection = [
  {
    $project: {
      is_selled: 1,
      status: 1,
      modelId: 1,
      storage: 1,
      ram: 1,
      price: { $add: ['$price', bonusPriceField] },
      createdAt: 1,
      updatedAt: 1,
      modelName: '$modelData.name',
      ramConfig: '$modelData.config',
      location: '$storeData.region',
      imei: '$docData.IMEI',
      reason: 1,
      category: '$categoryInfo.categoryName',
      QNA: 1, //added for technician role
      storeDetails: {
        storeId: '$storeData._id',
        storeName: '$storeData.storeName',
        region: '$storeData.region',
        address: '$storeData.address',
        phone: '$storeData.phone',
      },
    },
  },
  {
    $group: {
      _id: null,
      totalPrice: { $sum: '$price' },
      count: { $sum: 1 },
      documents: { $push: '$$ROOT' },
    },
  },
  {
    $project: {
      _id: 0,
      totalPrices: '$totalPrice',
      count: '$count',
      documents: 1,
    },
  },
]

// Helper to build match conditions based on user role
const buildAllDevicesMatchConditions = async (user, userId, req) => {
  const matchConditions = { $and: [] }
  const isSuperAdmin = user.role === 'Super Admin'
  const isCompanyAdmin = user.role === 'Company Admin'

  if (isSuperAdmin) {
    const qregion = req.query.region?.trim()
    const qstoreName = req.query.storeName?.trim()
    console.log('👑 Super Admin request. Filters:', { qregion, qstoreName })
    if (qregion) {
      matchConditions.$and.push({ 'storeData.region': qregion })
    }
    if (qstoreName) {
      matchConditions.$and.push({ 'storeData.storeName': qstoreName })
    }
    return matchConditions
  }

  if (isCompanyAdmin && req.companyStoreIds) {
    const storeObjectIds = req.companyStoreIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    )
    console.log(
      `🏢 Company Admin ${userId} restricted to company stores.`,
      storeObjectIds
    )

    const debugCount = await leads.aggregate([
      ...getAllLeadsPipe,
      { $match: { 'storeData._id': { $in: storeObjectIds } } },
      { $count: 'total' },
    ])
    console.log(
      '🔍 Debug: Total leads for company stores:',
      debugCount[0]?.total || 0
    )

    matchConditions.$and.push({ 'storeData._id': { $in: storeObjectIds } })
    return matchConditions
  }

  if (
    (user.role === 'Admin Manager' || user.role === 'Technician') &&
    user.assignedStores &&
    user.assignedStores.length > 0
  ) {
    const storeObjectIds = user.assignedStores.map(
      (id) => new mongoose.Types.ObjectId(id)
    )
    console.log(
      `🏪 ${user.role} ${userId} restricted to assigned stores.`,
      storeObjectIds
    )
    matchConditions.$and.push({ 'storeData._id': { $in: storeObjectIds } })
    return matchConditions
  }

  if (!user.storeId) {
    console.log(`📭 User ${userId} has no store. Returning empty list.`)
    return null
  }

  console.log(`🔒 User ${userId} restricted to store ${user.storeId}.`)
  matchConditions.$and.push({ 'storeData._id': user.storeId })
  return matchConditions
}

const allDevices = async (req, res) => {
  const userId = req.userId

  try {
    const user = await UsersModel.findById(userId).select(
      'role storeId companyId assignedStores'
    )
    if (!user) {
      return res.status(403).json({ msg: 'Forbidden: User not found.' })
    }

    const matchConditions = await buildAllDevicesMatchConditions(
      user,
      userId,
      req
    )

    if (matchConditions === null) {
      return res
        .status(200)
        .json({ data: [], message: 'User is not assigned to a store.' })
    }

    if (matchConditions.$and.length === 0) {
      delete matchConditions.$and
    }

    const fullPipeline = [
      ...getAllLeadsPipe,
      { $match: matchConditions },
      ...AllLeadsProjection,
    ]

    console.log(
      '🧪 Aggregation Pipeline:',
      JSON.stringify(fullPipeline, null, 2)
    )
    const deviceList = await leads.aggregate(fullPipeline)

    console.log('📊 Result count:', deviceList[0]?.count || 0)

    return res
      .status(200)
      .json({ data: deviceList, message: 'Successfully Sent Devices' })
  } catch (err) {
    console.error('❌ Internal Error in allDevices:', err)
    return res
      .status(500)
      .json({ msg: 'Internal Server Error, Failed To Find Devices' })
  }
}

// Helper to build search conditions based on user role
const buildSearchDeviceConditions = (user, req, rid, date, status) => {
  const isSuperAdmin = user.role === 'Super Admin'
  const isCompanyAdmin = user.role === 'Company Admin'

  const searchConditions = [
    {
      $or: [
        { tempId: { $regex: '^' + rid, $options: 'i' } },
        { 'modelData.name': { $regex: rid, $options: 'i' } },
        { 'docData.IMEI': { $regex: rid, $options: 'i' } },
      ],
    },
    { tempDate: { $regex: '^' + date, $options: 'i' } },
    { status: { $regex: '^' + status, $options: 'i' } },
  ]

  if (isSuperAdmin) {
    const qregion = req.query.region
    const qstoreName = req.query.storeName
    if (qregion) {
      searchConditions.push({ 'storeData.region': qregion })
    }
    if (qstoreName) {
      searchConditions.push({ 'storeData.storeName': qstoreName })
    }
    return searchConditions
  }

  if (isCompanyAdmin && req.companyStoreIds) {
    const storeObjectIds = req.companyStoreIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    )
    searchConditions.push({ 'storeData._id': { $in: storeObjectIds } })
    return searchConditions
  }

  if (
    (user.role === 'Admin Manager' || user.role === 'Technician') &&
    user.assignedStores &&
    user.assignedStores.length > 0
  ) {
    const storeObjectIds = user.assignedStores.map(
      (id) => new mongoose.Types.ObjectId(id)
    )
    searchConditions.push({ 'storeData._id': { $in: storeObjectIds } })
    return searchConditions
  }

  if (!user.storeId) {
    return null
  }

  searchConditions.push({ 'storeData._id': user.storeId })
  return searchConditions
}

const searchDevice = async (req, res) => {
  const { rid = '', date = '', status = '' } = req.query
  const userId = req.userId

  try {
    const user = await UsersModel.findById(userId).select(
      'role storeId companyId assignedStores'
    )
    if (!user) {
      return res.status(403).json({ msg: 'Forbidden: User not found.' })
    }

    const searchConditions = buildSearchDeviceConditions(
      user,
      req,
      rid,
      date,
      status
    )

    if (searchConditions === null) {
      return res
        .status(200)
        .json({ data: [], message: 'User not assigned to a store' })
    }

    const deviceList = await leads.aggregate([
      ...getAllLeadsPipe,
      {
        $addFields: {
          tempId: { $toString: '$_id' },
          tempDate: {
            $dateToString: { format: '%d/%m/%Y', date: '$createdAt' },
          },
        },
      },
      { $match: { $and: searchConditions } },
      ...AllLeadsProjection,
    ])

    return res
      .status(200)
      .json({ data: deviceList, message: 'Successfully Searched Devices' })
  } catch (err) {
    console.error('❌ Error in searchDevice:', err)
    return res
      .status(500)
      .json({ msg: 'Internal Server Error, Failed To Search Devices' })
  }
}

// update status of lead
const updateStatus = async (req, res) => {
  const { deviceIDs, newStatus, reason } = req.body //Here deviceIDs means devieStatus _id not lead id

  let updateDevice
  try {
    updateDevice = await leads.updateMany(
      { _id: { $in: deviceIDs } },
      { $set: { status: newStatus, reason: reason } }
    )
  } catch (err) {
    return res
      .status(500)
      .json({ msg: 'Updating status failed, Please try again.' })
  }

  return res.status(200).json({
    data: updateDevice,
    message: 'Successfully updated devices status',
  })
}

// create lot and add to outstanding page
const updateRequest = async (req, res) => {
  const { deviceIDs, newStatus } = req.body //HEre id is lead _id

  let calculations

  const newIDs = deviceIDs.map((el) => {
    return new mongoose.Types.ObjectId(el) //aggregation only take mdb obj type ids as a id
  })

  try {
    calculations = await leads.aggregate([
      { $match: { _id: { $in: newIDs } } },
      {
        $addFields: {
          price: { $add: ['$price', bonusPriceField] }, // Calculate sum of price and bonusPrice
        },
      },
      {
        $group: {
          _id: '000',
          totalSum: { $sum: '$price' },
          count: { $sum: 1 },
        },
      },
    ])
  } catch (error) {
    return res
      .status(500)
      .json({ msg: 'Something went wrong, calculations failed' })
  }

  const createdDevicesLot = new outstandingLot({
    status: 'Pending Payroll Approval',
    request: newStatus,
    totalDevice: calculations[0].count,
    totalAmount: calculations[0].totalSum,
    deviceList: deviceIDs,
  })

  try {
    await createdDevicesLot.save()
    try {
      await leads.updateMany(
        { _id: { $in: deviceIDs } },
        { $set: { status: newStatus } }
      )
    } catch (error) {
      await outstandingLot.deleteOne({ _id: createdDevicesLot._id })
      return res.status(500).json({ msg: ISE })
    }
  } catch (error) {
    return res.status(500).json({ msg: ISE })
  }
  return res
    .status(200)
    .json({ data: createdDevicesLot, msg: 'Successfully created new lot' })
}

// Create lot and add lot to Pickup Devices page
const pickupRequest = async (req, res) => {
  let { deviceIDs, userid, storeid } = await req.body //id is lead _id

  let calculations

  deviceIDs = deviceIDs.map((el) => {
    return new mongoose.Types.ObjectId(el) //aggregation only take mdb obj type ids as a id
  })
  deviceIDs = await leads.distinct('_id', {
    status: { $ne: 'Completed' },
    _id: { $in: deviceIDs },
  })
  try {
    calculations = await leads.aggregate([
      {
        $match: {
          _id: { $in: deviceIDs },
        },
      },
      {
        $addFields: {
          price: { $add: ['$price', bonusPriceField] }, // Calculate sum of price and bonusPrice
        },
      },
      {
        $group: {
          _id: '000',
          totalSum: { $sum: '$price' },
          count: { $sum: 1 },
        },
      },
    ])
  } catch (error) {
    return res
      .status(500)
      .json({ msg: 'Something went wrong, calculations failed' })
  }
  const lastDoc = await devicesLot
    .findOne({ uniqueCode: { $ne: '' } })
    .sort({ createdAt: -1 })
  const inputString = req?.storeName || process.env.STORE_NAME
  const words = inputString?.split(' ')
  const firstCharacters = words.map((word) => word.charAt(0))
  const resultString = firstCharacters.join('')
  let uniqueCode = process.env.UNIQUE_CODE_PREFIX
  if (lastDoc) {
    const numbersArray = lastDoc?.uniqueCode?.match(/\d+/g)
    const code = numbersArray ? Number(numbersArray.join('')) : 0
    const nextCode = (code + 1).toString().padStart(3, '0') // Ensure three digits with leading zeros
    uniqueCode = `${process.env.UNIQUE_CODE_SUBPREFIX}${resultString}${
      Number(nextCode) + 1
    }`
  }

  const createdDevicesLot = new devicesLot({
    status: 'Pending Payment Confirmation',
    totalDevice: calculations[0].count,
    totalAmount: calculations[0].totalSum,
    deviceList: deviceIDs,
    userId: userid,
    storeId: storeid,
    uniqueCode,
  })

  try {
    await createdDevicesLot.save()
    try {
      await leads.updateMany(
        { _id: { $in: deviceIDs } },
        { $set: { status: 'Completed' } }
      )
    } catch (error) {
      await devicesLot.deleteOne({ _id: createdDevicesLot._id })
      return res.status(500).json({ msg: ISE, error: error })
    }
  } catch (error) {
    console.log(error)
    return res.status(500).json({ msg: ISE, error: error })
  }
  return res
    .status(200)
    .json({ data: createdDevicesLot, msg: 'Successfully created new lot' })
}

export default {
  allDevices,
  searchDevice,
  updateStatus,
  updateRequest,
  pickupRequest,
}
