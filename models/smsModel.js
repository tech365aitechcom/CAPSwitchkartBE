import mongoose from "mongoose";

const smsSchema = new mongoose.Schema({
  mobileNumber: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Sms", smsSchema);
