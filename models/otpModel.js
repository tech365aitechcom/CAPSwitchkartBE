import mongoose from "mongoose";
const { Schema } = mongoose;

const otpSchema = new Schema(
  {
    email: { type: String, required: true },
    phone: { type: String },
    otp: { type: String, required: true },
    expires: { type: Date, default: () => Date.now() + 10 * 60 * 1000 },
  },
  { timestamps: true, versionKey: false }
);

otpSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

const otpModel = mongoose.model("otp", otpSchema);

export default otpModel;
