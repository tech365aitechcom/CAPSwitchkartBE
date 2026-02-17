import express from 'express'
import leadsController from '../controller/leadsController.js'
import verifyToken from '../middlewares/authJwt.js'
import companyScopingMiddleware from '../middlewares/companyScopingMiddleware.js'

const leadsRoute = express.Router()

leadsRoute
  .get(
    '/findAll',
    verifyToken,
    companyScopingMiddleware,
    leadsController.findAll
  )
  .get(
    '/findAllSelled',
    verifyToken,
    companyScopingMiddleware,
    leadsController.findAllSelled
  )
  .get(
    '/findLeadById',
    verifyToken,
    companyScopingMiddleware,
    leadsController.findLeadById
  )
  .get(
    '/findAll/ordercreated',
    verifyToken,
    companyScopingMiddleware,
    leadsController.orderCreated
  )
  .get(
    '/findAll/quotecreated',
    verifyToken,
    companyScopingMiddleware,
    leadsController.QuoteCreated
  )
  .post('/Admincalculate', verifyToken, leadsController.calculatePriceAdmin)

export default leadsRoute
