import mongoose from "mongoose";
const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    couponCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
    },
    //storeId is now an array of ObjectIds
    storeId: [
      {
        type: Schema.Types.ObjectId,
        ref: "store",
        required: true,
      },
    ],
    devicePriceRange: {
      min: { type: Number, required: true, default: 0 },
      max: { type: Number, required: true, default: Infinity },
    },
    discountType: {
      type: String,
      enum: ["Fixed", "Percentage"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
  },
  { timestamps: true }
);

couponSchema.index({ storeId: 1, status: 1, validTo: 1 });

const CouponModel = mongoose.model("coupon", couponSchema);
export default CouponModel;
