import express from 'express'
import { createDigilockerKYCRequest } from '../controller/digilockerController.js'
import verifyToken from '../middlewares/authJwt.js'

const digilockerRoute = express.Router()

digilockerRoute.post('/kyc', verifyToken, createDigilockerKYCRequest)

export default digilockerRoute
