import mongoose from "mongoose";
const { Schema } = mongoose;

const offerSchema = new Schema(
  {
    offerName: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },
    warranty: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
  },
  { timestamps: true }
);

const offerModel = mongoose.model("offers", offerSchema);

export default offerModel;
