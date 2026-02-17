import leads from '../models/leadsModel.js'
import UsersModel from '../models/UsersModel.js'
import outstandingLot from '../models/outstandingLotModel.js'
import mongoose from 'mongoose'
import pickupDevicesController from './pickupDevicesController.js'

const ReqFor = 'Request Forwarded'
const DevList = '$deviceList'
const LeadData = '$leadsData'
const LeadDataUID = 'leadsData.userId'

const LotsPipe = [
  { $addFields: { firstDeviceId: { $arrayElemAt: [DevList, 0] } } },
  {
    $lookup: {
      from: 'leads',
      localField: 'firstDeviceId',
      foreignField: '_id',
      as: 'leadsData',
    },
  },
  { $unwind: LeadData },
  {
    $lookup: {
      from: 'users',
      localField: LeadDataUID,
      foreignField: '_id',
      as: 'userData',
    },
  },
  { $unwind: '$userData' },
  {
    $lookup: {
      from: 'stores',
      localField: 'userData.storeId',
      foreignField: '_id',
      as: 'storeData',
    },
  },
  { $unwind: '$storeData' },
  { $sort: { updatedAt: -1 } },
]

/**
 * Applies store/region filters based on user role.
 */
const applyStoreFilters = (pipeline, user, query) => {
  const isSuperAdmin = user.role === 'Super Admin'

  if (isSuperAdmin) {
    const { region, storeName, qregion, qstoreName } = query
    const regionFilter = region || qregion
    const storeFilter = storeName || qstoreName

    if (regionFilter) {
      pipeline.push({ $match: { 'storeData.region': regionFilter } })
    }
    if (storeFilter) {
      pipeline.push({ $match: { 'storeData.storeName': storeFilter } })
    }
  } else {
    if (!user.storeId) {
      return { error: { data: [], message: 'User not assigned to a store.' } }
    }
    pipeline.push({ $match: { 'storeData._id': user.storeId } })
  }

  pipeline.push({ $project: { leadsData: 0, storeData: 0, userData: 0 } })
  return { pipeline }
}

const allLots = async (req, res) => {
  try {
    const user = await UsersModel.findById(req.userId).select('role storeId')
    if (!user) {
      return res.status(403).json({ msg: 'Forbidden' })
    }

    const pipeline = [{ $match: { status: { $ne: ReqFor } } }, ...LotsPipe]

    const { pipeline: finalPipeline, error } = applyStoreFilters(
      pipeline,
      user,
      req.query
    )
    if (error) {
      return res.status(200).json(error)
    }

    const lotsList = await outstandingLot.aggregate(finalPipeline)
    return res
      .status(200)
      .json({ data: lotsList, message: 'Successfully sent Lots' })
  } catch (error) {
    console.error('Error in outstanding/allLots:', error)
    return res
      .status(500)
      .json({ msg: "Something went wrong, couldn't find Lots" })
  }
}

const searchLots = async (req, res) => {
  try {
    const user = await UsersModel.findById(req.userId).select('role storeId')
    if (!user) {
      return res.status(403).json({ msg: 'Forbidden' })
    }

    const { rid = '', date = '' } = req.query

    const pipeline = [
      { $match: { status: { $ne: ReqFor } } },
      ...LotsPipe,
      {
        $addFields: {
          tempUserId: { $toString: '$_id' },
          tempDate: {
            $dateToString: { format: '%d/%m/%Y', date: '$createdAt' },
          },
        },
      },
      {
        $match: {
          $and: [
            { tempUserId: { $regex: '^' + rid, $options: 'i' } },
            { tempDate: { $regex: '^' + date, $options: 'i' } },
          ],
        },
      },
    ]

    const { pipeline: finalPipeline, error } = applyStoreFilters(
      pipeline,
      user,
      req.query
    )
    if (error) {
      return res.status(200).json(error)
    }

    const lotData = await outstandingLot.aggregate(finalPipeline)
    return res
      .status(200)
      .json({ data: lotData, msg: 'Successfully searched data' })
  } catch (error) {
    console.error('Error in outstanding/searchLots:', error)
    return res.status(500).json({ msg: 'Internal Server Error' })
  }
}

const updateStatus = async (req, res) => {
  const { refIDs, newStatus } = req.body
  try {
    const updateDevice = await outstandingLot.updateMany(
      { _id: { $in: refIDs } },
      { $set: { status: newStatus } }
    )
    return res
      .status(200)
      .json({ data: updateDevice, message: 'Successfully updated lots status' })
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Updating lot's status failed, Please try again." })
  }
}

const forwardRequest = async (req, res) => {
  const { refIDs } = req.body
  try {
    const outStnLot = await outstandingLot.findOne({ _id: refIDs })
    if (!outStnLot) {
      return res.status(500).json({ msg: 'Lot not found with this ref_id' })
    }

    const deviceIDs = outStnLot.deviceList
    const prev = outStnLot.request

    await outstandingLot.updateMany(
      { _id: { $in: [refIDs] } },
      { $set: { status: ReqFor } }
    )

    try {
      await leads.updateMany(
        { _id: { $in: deviceIDs } },
        { $set: { status: prev } }
      )
    } catch (error) {
      await outstandingLot.updateMany(
        { _id: { $in: [refIDs] } },
        { $set: { status: outStnLot.status } }
      )
      return res
        .status(500)
        .json({ msg: 'Failed to forward request, please try again' })
    }

    return res
      .status(200)
      .json({ data: outStnLot, message: 'Successfully Forwarded Request' })
  } catch (error) {
    return res
      .status(500)
      .json({ msg: 'Failed to forward request, please try again' })
  }
}

const devicesList = async (req, res) => {
  const refId = req.params.rid
  try {
    const deviceList = await outstandingLot.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(refId) } },
      ...pickupDevicesController.LotsByIDPipe,
    ])
    return res
      .status(200)
      .json({ data: deviceList, message: 'Successfully sended devicesList' })
  } catch (error) {
    return res
      .status(500)
      .json({ msg: "Something went wrong, couldn't find devices" })
  }
}

export default {
  allLots,
  searchLots,
  updateStatus,
  devicesList,
  forwardRequest,
}
