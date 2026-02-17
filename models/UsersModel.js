import mongoose from 'mongoose'
import { SELLER } from '../const.js'
const { Schema } = mongoose

const UsersSchema = new Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    name: { type: String, require: [true, 'name is required '] },
    email: {
      type: String,
      require: [true, 'email is required '],
      unique: true,
    },
    phoneNumber: { type: String },
    password: { type: String },
    role: {
      type: String,
      require: [true, 'role is required '],
    },
    state: { type: String },
    city: { type: String },
    status: { type: Boolean, default: true },
    website: { type: String },
    // One-to-One: User belongs to ONE company
    companyId: {
      type: mongoose.Types.ObjectId,
      ref: 'company',
      required: true,
      index: true,
    },
    address: { type: String },
    managerName: { type: String },
    pincode: { type: String },
    profileImage: { type: String },
    grestMember: { type: Boolean, require: true },
    storeId: {
      type: mongoose.Types.ObjectId,
      ref: 'store',
    },
    assignedStores: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'store',
      },
    ],
    createdBy: {
      type: mongoose.Types.ObjectId,
      ref: 'users',
    },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
)

UsersSchema.methods.isBuilderAdmin = async function () {
  return this.role === SELLER
}

const UsersModel = mongoose.model('users', UsersSchema)

export default UsersModel
