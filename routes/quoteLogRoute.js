import express from 'express';
import quoteLogController from '../controller/quoteLogController.js';
import verifyToken from '../middlewares/authJwt.js';

const router = express.Router();

router.post(
  '/log-quote-attempt',
  (req, res, next) => {
    next();
  },
  verifyToken,
  quoteLogController.logQuoteAttempt
);

router.get(
  '/dashboard',
  (req, res, next) => {
    next();
  },
  verifyToken,
  quoteLogController.getQuoteTrackingData
);

router.get(
  '/activity-log/:targetUserId',
  (req, res, next) => {
    next();
  },
  verifyToken,
  quoteLogController.getUserActivityLog
);

router.get(
  '/dashboard/download',
  (req, res, next) => {
    next();
  },
  verifyToken,
  quoteLogController.downloadQuoteTrackingData
);

export default router;
