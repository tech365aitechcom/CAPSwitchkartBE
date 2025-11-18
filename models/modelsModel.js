import mongoose from "mongoose";
const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    brandId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    core: {
      type: String,
      default: "",
    },
    config: [
      {
        storage: String,
        RAM: String,
        price: Number,
      },
    ],
    chipset: {
      type: String,
      default: "",
    },
    back_camera: {
      type: String,
      default: "",
    },
    front_camera: {
      type: String,
      default: "",
    },
    phonePhotos: {
      front: { type: String, default: "" },
      back: { type: String, default: "" },
      upFront: { type: String, default: "" },
      downFront: { type: String, default: "" },
    },
    type: {
      type: String,
      required: true,
    },
    series: {
      type: String
    },
    partnerId: {
      type: mongoose.Types.ObjectId,
      ref: "liquidators"
    }
  },
  { timestamps: true }
);

const modelsModel = mongoose.model("models", modelSchema);

export default modelsModel;
