import express from 'express'
import couponController from '../controller/couponController.js'
import verifyToken from '../middlewares/authJwt.js'

const couponRoute = express.Router()

couponRoute.post('/create', verifyToken, couponController.createCoupon)
couponRoute.put('/update/:id', verifyToken, couponController.updateCoupon)
couponRoute.delete('/delete/:id', verifyToken, couponController.deleteCoupon)
couponRoute.get('/list', verifyToken, couponController.listCoupons)
couponRoute.get(
  '/find-eligible/:leadId',
  verifyToken,
  couponController.findEligibleCoupon
)
couponRoute.post('/apply', verifyToken, couponController.applyCoupon)
couponRoute.delete(
  '/remove/:leadId',
  verifyToken,
  couponController.removeCoupon
)

export default couponRoute
