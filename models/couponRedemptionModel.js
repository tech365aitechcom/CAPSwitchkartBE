import mongoose from "mongoose";
const { Schema } = mongoose;

const couponRedemptionSchema = new Schema(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: "coupon",
      required: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "leads",
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
    },
    imei: {
      type: String,
      required: false,
    },
  },
  { timestamps: { createdAt: "redeemedAt", updatedAt: false } }
);

const CouponRedemptionModel = mongoose.model(
  "couponRedemption",
  couponRedemptionSchema
);
export default CouponRedemptionModel;
