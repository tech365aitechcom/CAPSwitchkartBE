import mongoose from "mongoose";
const { Schema } = mongoose;


const condtionCodesWatchSchema = new Schema(
  {
    cosmeticsCode: {
      type: String,
      required: true,
    },
    functionalCode: {
      type: String,
      required: true,
    },
    accessoriesCode: {
      type: String,
      required: true,
    },
    grade: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const conditionCodesWatchModel = mongoose.model(
  "condtionCodesWatch",
  condtionCodesWatchSchema
);

export default conditionCodesWatchModel;








