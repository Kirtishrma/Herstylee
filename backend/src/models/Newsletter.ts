import { Schema, model, Document } from "mongoose";

export interface INewsletter extends Document {
  email: string;
  source: string;
  createdAt: Date;
}

const newsletterSchema = new Schema<INewsletter>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    source: { type: String, default: "home" },
  },
  { timestamps: true }
);

export const Newsletter = model<INewsletter>("Newsletter", newsletterSchema);
