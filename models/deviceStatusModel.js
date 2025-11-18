import mongoose from "mongoose";

const deviceStatusSchema = new mongoose.Schema({
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "leads",
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
});

const deviceStatusModel = mongoose.model("deviceStatus", deviceStatusSchema);

export default deviceStatusModel;
