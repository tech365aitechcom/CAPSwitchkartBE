import mongoose from 'mongoose'
const { Schema } = mongoose

const counterSchema = new Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
})

const counterModel = mongoose.model('counters', counterSchema)

export default counterModel
