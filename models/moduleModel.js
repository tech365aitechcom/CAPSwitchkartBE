import mongoose from 'mongoose'
const { Schema } = mongoose

const moduleSchema = new Schema(
  {
    adminModels: { type: Boolean, default: false },
    gradePricing: { type: Boolean, default: false },
    registerUser: { type: Boolean, default: false },
    storeListing: { type: Boolean, default: false },
    storeReport: { type: Boolean, default: false },
    customerTable: { type: Boolean, default: false },
    companyListing: { type: Boolean, default: false },
    pickupCancelDevice: { type: Boolean, default: false },
    technicianReport: { type: Boolean, default: false },
    adminDashboard: { type: Boolean, default: false },
    createCoupon: {
      type: Boolean,
      default: false,
    },
    bulkUploadHistory: {
      type: Boolean,
      default: false,
    },
    quoteTracking: {
      type: Boolean,
      default: false,
      required: true,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'users' },
  },
  { timestamps: true },
)

const moduleModel = mongoose.model('module', moduleSchema)

export default moduleModel
