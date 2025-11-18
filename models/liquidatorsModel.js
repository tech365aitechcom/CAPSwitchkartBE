import mongoose from "mongoose";
const { Schema } = mongoose;

const liquidatorsSchema = new Schema(
  {
    name: { type: String, required: true },
    uniqueCode: { type: String, required: true, unique: true },
    email: { type: String },
    phoneNumber: { type: String },
    address: { type: String },
  },
  { timestamps: true }
);

const liquidatorsModel = mongoose.model("liquidators", liquidatorsSchema);

export default liquidatorsModel;
