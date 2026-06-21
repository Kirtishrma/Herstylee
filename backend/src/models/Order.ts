import { Schema, model, Document, Types } from "mongoose";

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  image: string;
  price: number;
  quantity: number;
  size?: string;
}

export interface IShippingAddress {
  fullname: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode?: string;
  couponId?: Types.ObjectId;
  totalUsd?: number;
  exchangeRate?: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  paymentStatus?: "unpaid" | "paid" | "failed" | "refunded";
  trackingId?: string;
  trackingCarrier?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  receiptEmailSent?: boolean;
  shipping: IShippingAddress;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        name: { type: String, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        size: { type: String, default: "M" },
      },
    ],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    couponCode: { type: String, default: null },
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", default: null },
    totalUsd: { type: Number, default: null },
    exchangeRate: { type: Number, default: null },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded"],
      default: "unpaid",
    },
    trackingId: { type: String, default: null },
    trackingCarrier: { type: String, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    stripeSessionId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null },
    receiptEmailSent: { type: Boolean, default: false },
    shipping: {
      fullname: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export const Order = model<IOrder>("Order", orderSchema);
