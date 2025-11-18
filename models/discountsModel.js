import mongoose from "mongoose";
const { Schema } = mongoose;

const discountSchema = new Schema(
  {
    leadId: {
      type: Schema.ObjectId,
      required: true,
    },
    discription: {
      type: String,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const discountsModel = mongoose.model("discounts", discountSchema);

export default discountsModel;
