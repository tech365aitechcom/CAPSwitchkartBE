import mongoose from "mongoose";
const { Schema } = mongoose;

const companySchema = new Schema(
    {
        companyName: {
            type: String,
            required: true
        },
        uniqueId: {
            type: String,
            required: true
        },
        companyCode: {
            type: String,
            required: true
        },
        contactNumber: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        gstNumber: {
            type: String,
            required: true,
            unique: true
        },
        panNumber: {
            type: String,
            required: true
        },
        remarks: {
            type: String,
            required: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'users',
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'users',
        },
        documents: []
    },
    { timestamps: true }
);
const companyModel = mongoose.model("company", companySchema);

export default companyModel;
