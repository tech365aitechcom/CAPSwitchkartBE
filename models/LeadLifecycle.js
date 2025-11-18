import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadLifecycle = new Schema(
  {
    lead_id: {
      type: Schema.Types.ObjectId,
      unique: true,
      ref: "leads", // This is the name of the other collection
    },
    eventType: {
      type: String,
      required: true,
    },
    userid: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const leadLifecycle = mongoose.model("leadLifecycle", LeadLifecycle);
export default leadLifecycle;

// eventType: 'orderCreated', // or 'quoteCreated'
