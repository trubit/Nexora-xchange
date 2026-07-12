// Run once: node server/scripts/backfillUids.js
// Assigns a unique 8-digit UID to every user that doesn't have one.

import "../env.js";
import mongoose from "mongoose";
import User from "../models/User.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nexora";

const generateUid = async () => {
  for (let i = 0; i < 20; i++) {
    const uid = String(Math.floor(10000000 + Math.random() * 90000000));
    const exists = await User.exists({ uid });
    if (!exists) return uid;
  }
  throw new Error("UID generation failed after 20 attempts");
};

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const users = await User.find({ $or: [{ uid: { $exists: false } }, { uid: null }, { uid: "" }] }).select("_id email");
  console.log(`Found ${users.length} user(s) without a UID.`);

  let updated = 0;
  for (const user of users) {
    const uid = await generateUid();
    await User.updateOne({ _id: user._id }, { $set: { uid } });
    console.log(`  UID ${uid} → ${user.email}`);
    updated++;
  }

  console.log(`\nDone. ${updated} user(s) updated.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
