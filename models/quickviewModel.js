import mongoose from "mongoose";

const quickviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "users",
  },

  modelId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "models",
  },
  viewedAt: {
    type: Date,
    default: Date.now,
  },
});

const quickviewModel = mongoose.model("quickview", quickviewSchema);

export default quickviewModel;
