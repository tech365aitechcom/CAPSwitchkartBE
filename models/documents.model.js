import mongoose from "mongoose";
const { Schema } = mongoose;

const documentSchema = new Schema(
    {
        IMEI: {
            type: String,
            // required: true
        },
        adhar: {
            front: {
                type: String,
                // required: true
            },
            back: {
                type: String,
                // required: true
            },
        },
        phoneBill: {
            type: String,
            // required: true
        },
        phonePhotos: {
            front: {
                type: String,
                // required: true
            },
            back: {
                type: String,
                // required: true
            },
            up: {
                type: String,
                // required: true
            },
            down: {
                type: String,
                // required: true
            },
            left: {
                type: String,
                // required: true
            },
            right: {
                type: String,
                // required: true
            },
        },
        signature: {
            type: String,
        },
        leadId: {
            type: Schema.ObjectId,
            ref: 'leads'
        },
        userId: {
            type: Schema.ObjectId,
            ref: 'users'
        }
    },
    { timestamps: true }
);

const documents = mongoose.model("documents", documentSchema);

export default documents;
