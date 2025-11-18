import mongoose from "mongoose";
const { Schema } = mongoose;

const gradePriceSchema = new Schema(
  {
    modelId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "models"
    },
    grades: {
      A_PLUS: Number,
      A: Number,
      B: Number,
      B_MINUS: Number,
      C_PLUS: Number,
      C: Number,
      C_MINUS: Number,
      D_PLUS: Number,
      D: Number,
      D_MINUS: Number,
      E: Number,
    },
    storage: {
      type: String,
      required: true,
    },
    RAM: {
      type: String,
    },
    price: {
      type: Number,
      default: 0
    },
    partnerId: {
      type: mongoose.Types.ObjectId,
      ref: "liquidators"
    }
  },
  { timestamps: true }
);

const gradePriceModel = mongoose.model("gradeprice", gradePriceSchema);

export default gradePriceModel;
