import express from 'express'
import quoteLogController from '../controller/quoteLogController.js'
import verifyToken from '../middlewares/authJwt.js'
import companyScopingMiddleware from '../middlewares/companyScopingMiddleware.js'

const quoteLogRoute = express.Router()

quoteLogRoute.post(
  '/log-quote-attempt',
  (req, res, next) => {
    next()
  },
  verifyToken,
  quoteLogController.logQuoteAttempt
)

quoteLogRoute.get(
  '/dashboard',
  (req, res, next) => {
    next()
  },
  verifyToken,
  companyScopingMiddleware,
  quoteLogController.getQuoteTrackingData
)

quoteLogRoute.get(
  '/activity-log/:targetUserId',
  (req, res, next) => {
    next()
  },
  verifyToken,
  companyScopingMiddleware,
  quoteLogController.getUserActivityLog
)

quoteLogRoute.get(
  '/dashboard/download',
  (req, res, next) => {
    next()
  },
  verifyToken,
  companyScopingMiddleware,
  quoteLogController.downloadQuoteTrackingData
)

export default quoteLogRoute
