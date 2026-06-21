import { Schema, model, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  category: string;
  image: string;
  slug: string;
  price: number;
  stock: number;
  active: boolean;
  tags: string[];
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    category: { type: String, required: true, index: true },
    image: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    price: { type: Number, default: 1999 },
    stock: { type: Number, default: 50, min: 0 },
    active: { type: Boolean, default: true },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

export const Product = model<IProduct>("Product", productSchema);
