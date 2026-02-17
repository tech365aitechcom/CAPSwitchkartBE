import mongoose from 'mongoose'
const { Schema } = mongoose

const groupsSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    codes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'codes',
      },
    ],
  },
  { timestamps: true },
)

const groupsModel = mongoose.model('groups', groupsSchema)

export default groupsModel
