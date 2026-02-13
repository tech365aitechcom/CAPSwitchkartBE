import mongoose from "mongoose";

const groupsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    codes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Code", // Reference to condition codes collection
      },
    ],
    categories: [
      {
        type: String, // e.g., ["CTG1", "CTG2", "CTG6"]
      },
    ],
    // Optional: Add priority/order field if groups need specific ordering
    order: {
      type: Number,
      default: 0,
    },
    // Optional: Add active/inactive status
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
groupsSchema.index({ name: 1 });
groupsSchema.index({ categories: 1 });

const groups = mongoose.model("groups", groupsSchema);

export default groups;
