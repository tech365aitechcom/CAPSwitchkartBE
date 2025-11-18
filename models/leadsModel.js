import mongoose from "mongoose";
const { Schema } = mongoose;

const leadsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "users",
    },
    QNA: {
      type: Array,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    aadharNumber: {
      type: String,
      required: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    modelId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "models",
    },
    price: {
      type: Number,
      required: true,
    },
    bonusPrice: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
    },
    is_selled: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      default: "",
    },
    storage: {
      type: String,
      default: "",
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "documents",
    },
    gradeId: {
      type: Schema.ObjectId,
      ref: "condtioncodes",
    },
    actualPrice: {
      type: Number,
      default: 0,
    },
    reciept: {
      type: String,
      default: "",
    },
    ram: {
      type: String,
      required: true,
    },
    uniqueCode: {
      type: String,
      required: true,
      default: "",
    },
    emailId: {
      type: String,
    },
    status: {
      type: String,
      default: "Available For Pickup",
    },
  },
  { timestamps: true }
);

const leadsModel = mongoose.model("leads", leadsSchema);

export default leadsModel;
