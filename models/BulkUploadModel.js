import mongoose from "mongoose";

const { Schema } = mongoose;

const BulkUserUploadSchema = new Schema(
  {
    fileName: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Types.ObjectId,
      ref: "users",
      required: true,
    },
    totalRecords: {
      type: Number,
      default: 0,
    },
    succeeded: {
      type: Number,
      default: 0,
    },
    failed: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["In Progress", "Completed", "Failed"],
      default: "In Progress",
    },
    category: {
        type: String,
        default: "USER"
    }
  },
  { timestamps: { createdAt: 'createdAt' } } 
);

``
const BulkUserUploadLogSchema = new Schema(
  {
    uploadId: {
      type: mongoose.Types.ObjectId,
      ref: "bulk_user_uploads", 
      required: true,
    },
    rowNumber: {
      type: Number,
      required: true,
    },
    rowData: {
      type: Schema.Types.Mixed, 
      required: true
    },
    status: {
      type: String,
      enum: ["Success", "Fail"],
      required: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export const BulkUserUpload = mongoose.model("bulk_user_uploads", BulkUserUploadSchema);
export const BulkUserUploadLog = mongoose.model("bulk_user_upload_logs", BulkUserUploadLogSchema);