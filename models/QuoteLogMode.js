import mongoose from 'mongoose';
const { Schema } = mongoose;

const QuoteLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'users', 
      required: true,
      index: true, 
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'store', 
      index: true,
    },
    quoteType: {
      type: String,
      enum: ['QuickQuote', 'Get Exact Value', ], 
      required: true,
    },
    quoteAmount: {
      type: Number,
      required: true,
    },
    grade: {
      type: String, 
    },
    deviceDetails: {
      modelId: { type: Schema.Types.ObjectId, ref: 'Model' }, 
      name: { type: String },
      brandId: { type: Schema.Types.ObjectId, ref: 'Brand' }, 
      categoryName: { type: String },
      ram: { type: String },
      rom: { type: String },
      series: { type: String },

    },
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false }, 
  }
);

const QuoteLogModel = mongoose.model('QuickQuote',  QuoteLogSchema);
export default QuoteLogModel;