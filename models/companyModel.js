import mongoose from "mongoose";
const { Schema } = mongoose;

const companySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        companyCode: {
            type: String,
            unique: true,
            sparse: true // Auto-generated after creation
        },
        contactNumber: {
            type: String,
            required: true,
            trim: true
        },
        address: {
            type: String,
            required: true
        },
        gstNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },
        panNumber: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },
        remarks: {
            type: String,
            default: ''
        },
        showPrice: {
            type: Boolean,
            default: false
        },
        maskInfo: {
            type: Boolean,
            default: false
        },
        attachedDocuments: [{
            fileName: String,
            fileUrl: String,
            fileType: String,
            uploadedAt: { type: Date, default: Date.now }
        }],
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active'
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'users',
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'users',
        }
    },
    { timestamps: true }
);
const companyModel = mongoose.model("company", companySchema);

export default companyModel;
