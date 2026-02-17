import mongoose from 'mongoose'
const { Schema } = mongoose

const leadsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'users',
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'store',
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'company',
      index: true
    },
    QNA: {
      type: Array,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    aadharNumber: {
      type: String,
      required: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    modelId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'models',
    },
    price: {
      type: Number,
      required: true,
    },
    bonusPrice: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
    },
    is_selled: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      default: '',
    },
    storage: {
      type: String,
      default: '',
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'documents',
    },
    gradeId: {
      type: Schema.ObjectId,
      ref: 'condtioncodes',
    },
    deviceReport: {
      type: Object,
      default: {}
    },
    actualPrice: {
      type: Number,
      default: 0,
    },
    reciept: {
      type: String,
      default: '',
    },
    ram: {
      type: String,
      required: true,
    },
    uniqueCode: {
      type: String,
      required: true,
      default: '',
      unique: true,
      sparse: true,
    },
    emailId: {
      type: String,
    },
    status: {
      type: String,
      default: 'Pending in QC',
    },
    tncVersion: {
      type: String,
      default: '',
    },
    history: [{
      action: String,
      performedBy: { type: Schema.Types.ObjectId, ref: 'users' },
      timestamp: { type: Date, default: Date.now },
      changes: Object
    }]
  },
  { timestamps: true }
)

const leadsModel = mongoose.model('leads', leadsSchema)

export default leadsModel
