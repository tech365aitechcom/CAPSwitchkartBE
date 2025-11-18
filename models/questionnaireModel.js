import mongoose from "mongoose";
const { Schema } = mongoose;

const questionnaireSchema = new Schema(
  {
    group: {
      type: String,
      required: true,
    },
    quetion: {
      type: String,
      required: true,
    },
    yes: {
      type: String,
      required: true,
    },
    no: {
      type: String,
      required: true,
    },
    default: {
      type: String,
      required: true,
    },
    viewOn: {
      type: Number,
      default: 0,
    },
    options: [
      {
        img: String,
        caption: String,
      },
    ],
    type: {
      type: String,
      required: true,
    },
    groupName: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const questionnaireModel = mongoose.model("questionnaire", questionnaireSchema);

export default questionnaireModel;
