import express from 'express'
import pickupDevicesController from '../controller/pickupDevicesController.js'
import verifyToken from '../middlewares/authJwt.js'
import companyScopingMiddleware from '../middlewares/companyScopingMiddleware.js'
import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage() })

const pickupDevicesRoute = express.Router()

pickupDevicesRoute
  .get(
    '/all',
    verifyToken,
    companyScopingMiddleware,
    pickupDevicesController.allLots
  )
  .get(
    '/search',
    verifyToken,
    companyScopingMiddleware,
    pickupDevicesController.searchLots
  )
  .get(
    '/history',
    verifyToken,
    companyScopingMiddleware,
    pickupDevicesController.lotsHistory
  )
  .post('/update', verifyToken, pickupDevicesController.updateStatus)
  .get('/devices/:rid', verifyToken, pickupDevicesController.devicesList)
  .get(
    '/technicianReport',
    verifyToken,
    companyScopingMiddleware,
    pickupDevicesController.technicianReport
  )
  .put(
    '/updatePaymentReceipt/:id',
    verifyToken,
    upload.single('paymentReceipt'),
    pickupDevicesController.updatePaymentReceiptAndRemarks
  )

export default pickupDevicesRoute
