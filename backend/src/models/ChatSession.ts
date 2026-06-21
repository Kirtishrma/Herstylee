import { Schema, model, Document, Types } from "mongoose";
import { IChatProduct } from "./ChatHistory";

export interface IChatMessage {
  role: "user" | "assistant";
  content: string;
  products?: IChatProduct[];
}

export interface IChatSession extends Document {
  user: Types.ObjectId;
  title: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    messages: [
      {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true },
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
    ],
  },
  { timestamps: true }
);

export const ChatSession = model<IChatSession>("ChatSession", chatSessionSchema);
