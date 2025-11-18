import mongoose from "mongoose";

const outstandingLotSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    request: {
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
  },
  { timestamps: true }
);

const outstandingLotModel = mongoose.model(
  "outstandingLot",
  outstandingLotSchema
);

export default outstandingLotModel;
