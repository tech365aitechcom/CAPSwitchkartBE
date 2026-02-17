import mongoose from 'mongoose'
const { Schema } = mongoose

const storeSchema = new Schema(
  {
    storeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    storeName: {
      type: String,
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'company',
      index: true,
    },
    region: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: false,
    },
    uniqueId: {
      type: String,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'users',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'users',
    },
  },
  { timestamps: true }
)

const storeModel = mongoose.model('store', storeSchema)

export default storeModel
