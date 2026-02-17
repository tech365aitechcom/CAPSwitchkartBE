import express from 'express'
import pendingDevicesController from '../controller/pendingDevicesController.js'
import verifyToken from '../middlewares/authJwt.js'
import companyScopingMiddleware from '../middlewares/companyScopingMiddleware.js'

const pendingDevicesRoutes = express.Router()

pendingDevicesRoutes
  .get(
    '/all',
    verifyToken,
    companyScopingMiddleware,
    pendingDevicesController.allDevices
  ) //get all the leads which are selled
  .get(
    '/search',
    verifyToken,
    companyScopingMiddleware,
    pendingDevicesController.searchDevice
  )
  .post('/update', verifyToken, pendingDevicesController.updateStatus) //update the lead Status it take id array and status
  .post('/updatereq', verifyToken, pendingDevicesController.updateRequest)
  .post(
    '/pickupreq',
    verifyToken,
    pendingDevicesController.pickupRequest
  ) /*takes leads id array as input and
   push them to devicesLOts schema's devicesList field and the id of that lot is new refrence id*/

export default pendingDevicesRoutes
