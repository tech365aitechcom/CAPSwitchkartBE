import mongoose from "mongoose";
const { Schema } = mongoose;

const lqdPriceSchema = new Schema(
  {
    modelId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    liquidatorId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    maxPrice: {
      type: Number,
      required: true,
    },
    minPrice: {
      type: Number,
      required: true,
    },
    storage: {
      type: String,
      required: true,
    },
    RAM: {
      type: String,
    },
  },
  { timestamps: true }
);

const lqdPriceModel = mongoose.model("lqdprice", lqdPriceSchema);

export default lqdPriceModel;
