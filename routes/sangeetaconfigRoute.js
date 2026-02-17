import express from 'express'
import sangeetaconfigController from '../controller/sangeetaconfigController.js'

const sangeetaconfigRoute = express.Router()

sangeetaconfigRoute
  .post('/valuation/estimate', sangeetaconfigController.getUpToValue)
  .get('/transactions/completed', sangeetaconfigController.getAllLeadsComplete)
  .get('/devices/status', sangeetaconfigController.getAllDeviceStatus)
  .post('/getLeadByUniquecode', sangeetaconfigController.getLeadByUniqueCode)

export default sangeetaconfigRoute
