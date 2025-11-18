import mongoose from "mongoose";
const { Schema } = mongoose;

const mastersSchema = new Schema(
  {
    key: { type: String, default: "" },
    fieldName: { type: String, default: "" },
    fieldLabel: { type: String, default: "" },
    fieldValue: { type: String, default: "" },
    parentId: { type: String, default: "" },
  },
  { timestamps: true }
);

const mastersModel = mongoose.model("masters", mastersSchema);

export default mastersModel;
