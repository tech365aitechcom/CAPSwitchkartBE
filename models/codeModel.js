import mongoose from "mongoose";
const { Schema } = mongoose;

const codeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
    },
    changeHistory: [
      {
        action: { type: String, enum: ["Create", "Edit", "Delete"] },
        user: { type: Schema.Types.ObjectId, ref: "users" }, // or email/string if preferred
        timestamp: { type: Date, default: Date.now },
        changes: { type: Object }, // store changed fields here
        reason: { type: String },  // optional: for delete/edit reason
      },
    ],
  },
  { timestamps: true }
);

const codeModel = (connection) => {
  return connection.model("codes", codeSchema);
};

export default codeModel;
