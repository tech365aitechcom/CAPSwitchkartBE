import mongoose from "mongoose";
import { SELLER } from "../const.js";
const { Schema } = mongoose;

const UsersSchema = new Schema(
  {
    firstName: { type: String }, // added
    lastName: { type: String }, // added
    name: { type: String, require: [true, "name is required "] },
    email: {
      type: String,
      require: [true, "email is required "],
      unique: true,
    },
    phoneNumber: { type: String },
    password: { type: String },
    role: { type: String, require: [true, "role is required "] },
    state: { type: String },
    city: { type: String },
    status: { type: Boolean },
    website: { type: String }, // added
    companyId: { type: mongoose.Types.ObjectId, ref: "company" }, // added
    address: { type: String }, // added
    managerName: { type: String }, // added
    pincode: { type: String }, // added
    profileImage: { type: String }, // added
    grestMember: { type: Boolean, require: true },
    storeId: {
      type: mongoose.Types.ObjectId,
      ref: "store",
    },
  },
  { timestamps: true }
);

UsersSchema.methods.isBuilderAdmin = async function () {
  return this.role === SELLER;
};

const UsersModel = mongoose.model("users", UsersSchema);

export default UsersModel;
