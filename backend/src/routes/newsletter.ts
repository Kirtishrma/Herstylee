import { Router } from "express";
import { Newsletter } from "../models/Newsletter";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/api/newsletter/subscribe", async (req, res) => {
  try {
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const existing = await Newsletter.findOne({ email });
    if (existing) {
      return res.json({ message: "You're already subscribed!", alreadySubscribed: true });
    }

    await Newsletter.create({ email, source: String(req.body.source ?? "home") });
    res.status(201).json({ message: "Welcome to HERSTYLE! You're subscribed." });
  } catch {
    res.status(500).json({ error: "Could not subscribe. Try again later." });
  }
});

export default router;
