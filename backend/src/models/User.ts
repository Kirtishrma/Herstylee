import { Schema, model, Document, Types } from "mongoose";

export interface IAddress {
  _id: Types.ObjectId;
  label: string;
  fullname: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  isDefault: boolean;
}

export interface IUser extends Document {
  fullname: string;
  email: string;
  password?: string;
  googleId?: string;
  avatar?: string;
  isAdmin?: boolean;
  phone?: string;
  address?: string;
  city?: string;
  pincode?: string;
  addresses: IAddress[];
  resetToken?: string;
  resetExpires?: Date;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullname: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: null },
    googleId: { type: String, default: null, sparse: true, index: true },
    avatar: { type: String, default: null },
    isAdmin: { type: Boolean, default: false },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },
    addresses: {
      type: [
        {
          label: { type: String, trim: true, default: "Home" },
          fullname: { type: String, trim: true, default: "" },
          phone: { type: String, trim: true, default: "" },
          address: { type: String, trim: true, default: "" },
          city: { type: String, trim: true, default: "" },
          pincode: { type: String, trim: true, default: "" },
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    resetToken: { type: String, default: null },
    resetExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);

export function toPublicAddress(addr: IAddress) {
  return {
    id: addr._id.toString(),
    label: addr.label || "Home",
    fullname: addr.fullname || "",
    phone: addr.phone || "",
    address: addr.address || "",
    city: addr.city || "",
    pincode: addr.pincode || "",
    isDefault: Boolean(addr.isDefault),
  };
}

export function toPublicUser(user: IUser) {
  const addresses = (user.addresses ?? []).map(toPublicAddress);
  const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];

  return {
    id: user._id.toString(),
    fullname: user.fullname,
    email: user.email,
    avatar: user.avatar ?? "",
    googleId: user.googleId ?? "",
    isAdmin: Boolean(user.isAdmin),
    hasPassword: Boolean(user.password),
    phone: user.phone ?? defaultAddr?.phone ?? "",
    address: user.address ?? defaultAddr?.address ?? "",
    city: user.city ?? defaultAddr?.city ?? "",
    pincode: user.pincode ?? defaultAddr?.pincode ?? "",
    addresses,
    memberSince: user.createdAt,
  };
}

function syncLegacyAddressFields(user: IUser) {
  const defaultAddr = user.addresses.find((a) => a.isDefault) ?? user.addresses[0];
  if (!defaultAddr) return;
  user.address = defaultAddr.address;
  user.city = defaultAddr.city;
  user.pincode = defaultAddr.pincode;
  if (defaultAddr.phone) user.phone = defaultAddr.phone;
}

export function migrateLegacyAddress(user: IUser) {
  if (user.addresses?.length) return;
  const hasLegacy = Boolean(user.address || user.city || user.pincode);
  if (!hasLegacy) return;

  user.addresses.push({
    _id: new Types.ObjectId(),
    label: "Home",
    fullname: user.fullname,
    phone: user.phone ?? "",
    address: user.address ?? "",
    city: user.city ?? "",
    pincode: user.pincode ?? "",
    isDefault: true,
  } as IAddress);
}

export function isGoogleOnlyUser(user: IUser): boolean {
  return Boolean(user.googleId && !user.password);
}
