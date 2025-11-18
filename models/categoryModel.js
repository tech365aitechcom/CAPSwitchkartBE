import mongoose from "mongoose";
const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    categoryName: {
      type: String,
      required: true,
      unique: true,
    },
    categoryCode: {
      type: String,
      required: true,
      unique: true,
    },
    viewOn: {
      type: Number,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

const categoryModel = mongoose.model("categories", categorySchema);

export default categoryModel;
