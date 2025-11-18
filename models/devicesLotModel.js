import mongoose from "mongoose";

const devicesLotSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    totalDevice: {
      type: Number,
      required: true,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    deviceList: [
      {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "leads",
      },
    ],
    userId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "users", // referencing the 'users' collection
    },
    storeId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "store", // referencing the 'store' collection
    },
    uniqueCode: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const devicesLotModel = mongoose.model("devicesLot", devicesLotSchema);

export default devicesLotModel;
