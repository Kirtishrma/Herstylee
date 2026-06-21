import { Router } from "express";
import { Types } from "mongoose";
import {
  User,
  toPublicUser,
  migrateLegacyAddress,
  toPublicAddress,
  IAddress,
  IUser,
} from "../models/User";
import { requireAuth, requireAuthPage, AuthRequest } from "../middleware/auth";

const router = Router();

function validatePincode(pincode: string): string | null {
  if (pincode && !/^\d{6}$/.test(pincode)) {
    return "Pincode must be 6 digits";
  }
  return null;
}

function setDefaultAddress(user: IUser, addressId: string) {
  user.addresses.forEach((addr) => {
    addr.isDefault = addr._id.toString() === addressId;
  });
  const defaultAddr = user.addresses.find((a) => a.isDefault);
  if (defaultAddr) {
    user.address = defaultAddr.address;
    user.city = defaultAddr.city;
    user.pincode = defaultAddr.pincode;
    if (defaultAddr.phone) user.phone = defaultAddr.phone;
  }
}

function findAddressById(user: IUser, id: string) {
  return user.addresses.find((a) => a._id.toString() === id);
}

router.get("/profile", requireAuthPage, (_req, res) => {
  res.render("profile");
});

router.get("/api/profile", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  migrateLegacyAddress(user);
  if (user.isModified()) await user.save();
  res.json({ user: toPublicUser(user) });
});

router.patch("/api/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    migrateLegacyAddress(user);

    const fullname = String(req.body.fullname ?? user.fullname).trim();
    const phone = String(req.body.phone ?? "").trim();

    if (!fullname) {
      return res.status(400).json({ error: "Name is required" });
    }

    user.fullname = fullname;
    user.phone = phone;
    await user.save();

    res.json({ message: "Profile updated", user: toPublicUser(user) });
  } catch {
    res.status(500).json({ error: "Could not update profile" });
  }
});

router.get("/api/profile/addresses", requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  migrateLegacyAddress(user);
  if (user.isModified()) await user.save();
  res.json({ addresses: (user.addresses ?? []).map(toPublicAddress) });
});

router.post("/api/profile/addresses", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    migrateLegacyAddress(user);

    const label = String(req.body.label ?? "Home").trim() || "Home";
    const fullname = String(req.body.fullname ?? user.fullname).trim();
    const phone = String(req.body.phone ?? user.phone ?? "").trim();
    const address = String(req.body.address ?? "").trim();
    const city = String(req.body.city ?? "").trim();
    const pincode = String(req.body.pincode ?? "").trim();
    const isDefault = Boolean(req.body.isDefault);

    if (!fullname || !phone || !address || !city || !pincode) {
      return res.status(400).json({ error: "All address fields are required" });
    }

    const pinErr = validatePincode(pincode);
    if (pinErr) return res.status(400).json({ error: pinErr });

    if (isDefault || user.addresses.length === 0) {
      user.addresses.forEach((a) => {
        a.isDefault = false;
      });
    }

    const newAddr = {
      _id: new Types.ObjectId(),
      label,
      fullname,
      phone,
      address,
      city,
      pincode,
      isDefault: isDefault || user.addresses.length === 0,
    } as IAddress;

    user.addresses.push(newAddr);
    if (newAddr.isDefault) setDefaultAddress(user, newAddr._id.toString());
    await user.save();

    res.status(201).json({
      message: "Address saved",
      address: toPublicAddress(newAddr),
      addresses: user.addresses.map(toPublicAddress),
    });
  } catch {
    res.status(500).json({ error: "Could not save address" });
  }
});

router.patch("/api/profile/addresses/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const addr = findAddressById(user, String(req.params.id));
    if (!addr) return res.status(404).json({ error: "Address not found" });

    if (req.body.label != null) addr.label = String(req.body.label).trim() || "Home";
    if (req.body.fullname != null) addr.fullname = String(req.body.fullname).trim();
    if (req.body.phone != null) addr.phone = String(req.body.phone).trim();
    if (req.body.address != null) addr.address = String(req.body.address).trim();
    if (req.body.city != null) addr.city = String(req.body.city).trim();
    if (req.body.pincode != null) {
      const pincode = String(req.body.pincode).trim();
      const pinErr = validatePincode(pincode);
      if (pinErr) return res.status(400).json({ error: pinErr });
      addr.pincode = pincode;
    }

    if (req.body.isDefault === true) {
      setDefaultAddress(user, addr._id.toString());
    }

    await user.save();
    res.json({
      message: "Address updated",
      addresses: user.addresses.map(toPublicAddress),
    });
  } catch {
    res.status(500).json({ error: "Could not update address" });
  }
});

router.delete("/api/profile/addresses/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const addr = findAddressById(user, String(req.params.id));
    if (!addr) return res.status(404).json({ error: "Address not found" });

    const wasDefault = addr.isDefault;
    user.addresses = user.addresses.filter((a) => a._id.toString() !== String(req.params.id));

    if (wasDefault && user.addresses.length) {
      user.addresses[0].isDefault = true;
      setDefaultAddress(user, user.addresses[0]._id.toString());
    } else if (!user.addresses.length) {
      user.address = "";
      user.city = "";
      user.pincode = "";
    }

    await user.save();
    res.json({ message: "Address removed", addresses: user.addresses.map(toPublicAddress) });
  } catch {
    res.status(500).json({ error: "Could not delete address" });
  }
});

router.post("/api/profile/addresses/:id/default", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const addr = findAddressById(user, String(req.params.id));
    if (!addr) return res.status(404).json({ error: "Address not found" });

    setDefaultAddress(user, addr._id.toString());
    await user.save();
    res.json({ message: "Default address updated", addresses: user.addresses.map(toPublicAddress) });
  } catch {
    res.status(500).json({ error: "Could not set default address" });
  }
});

export default router;
