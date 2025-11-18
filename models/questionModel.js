import mongoose from "mongoose";
const { Schema } = mongoose;

const questionnaireSchema = new Schema(
    {
        question: {
            type: String,
            required: true,
        },
        options: [],
        brandId: {
            type: mongoose.Types.ObjectId,
            required: true,
            ref: "brands"
        },
        viewOn:{
            type: Number
        }
    },
    { timestamps: true }
);

const questionModel = mongoose.model("questions", questionnaireSchema);

export default questionModel;
