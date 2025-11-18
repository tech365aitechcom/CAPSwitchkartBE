import mongoose from "mongoose";
const { Schema } = mongoose;

const storeSchema = new Schema(
  {
    storeName: {
      type: String,
      required: true,
    },
    region: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    uniqueId: {
      type: String,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "users",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
  },
  { timestamps: true }
);

const storeModel = mongoose.model("store", storeSchema);

export default storeModel;
