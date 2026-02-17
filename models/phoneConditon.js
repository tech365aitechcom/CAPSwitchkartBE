import mongoose from "mongoose";
const { Schema } = mongoose;

const condtionCodesSchema = new Schema(
  {
    warrentyCode: { type: String },
    coreCode: { type: String },
    displayCode: { type: String },
    functionalMajorCode: { type: String },
    functionalMinorCode: { type: String },
    cosmeticsCode: { type: String },
    functionalCode: { type: String },
    accessoriesCode: { type: String },
    coreCondition: { type: String },
    displayCondition: { type: String },
    functionalMajorCondition: { type: String },
    functionalMinorCondition: { type: String },
    cosmeticsCondition: { type: String },
    functionalCondition: { type: String },
    accessoriesCondition: { type: String },
    grade: { type: String },
    deviceType: { type: String },
    warrentyCondition: { type: String },
  },
  { timestamps: true }
);

const phoneConditon = mongoose.model("condtioncodes", condtionCodesSchema);

export default phoneConditon;
