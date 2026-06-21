import { Schema, model, Document, Types } from "mongoose";
import { ProductSize } from "../config/sizes";

export interface ICartItem {
  product: Types.ObjectId;
  quantity: number;
  size: ProductSize;
}

export interface ICart extends Document {
  user: Types.ObjectId;
  items: ICartItem[];
  abandonedReminderSentAt?: Date | null;
}

const cartSchema = new Schema<ICart>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, default: 1, min: 1 },
        size: { type: String, default: "M", enum: ["XS", "S", "M", "L", "XL"] },
      },
    ],
    abandonedReminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Cart = model<ICart>("Cart", cartSchema);
