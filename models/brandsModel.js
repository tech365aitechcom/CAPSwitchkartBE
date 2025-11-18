import mongoose from "mongoose";
const { Schema } = mongoose;

const brandSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    viewOn: {
      type: Number,
      required: true,
      unique: true,
    },
    logo: {
      type: String,
      required: true
    },
    deviceTypes: {
      type: [String],
      required: true
    }
  },
  { timestamps: true }
);

const brandsModel = mongoose.model("brands", brandSchema);

export default brandsModel;
