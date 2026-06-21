import { Schema, model, Document, Types } from "mongoose";

export interface IChatProduct {
  productId: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  reason: string;
}

export interface IChatHistory extends Document {
  user: Types.ObjectId;
  query: string;
  message: string;
  products: IChatProduct[];
  createdAt: Date;
}

const chatHistorySchema = new Schema<IChatHistory>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    query: { type: String, required: true },
    message: { type: String, required: true },
    products: [
      {
        productId: String,
        name: String,
        slug: String,
        image: String,
        price: Number,
        reason: String,
      },
    ],
  },
  { timestamps: true }
);

export const ChatHistory = model<IChatHistory>("ChatHistory", chatHistorySchema);
