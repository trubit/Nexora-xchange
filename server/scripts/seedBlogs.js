import "../env.js";
import mongoose from "mongoose";
import Blog from "../models/Blog.js";

const slugify = (value) =>
  (value || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "post";

const POSTS = [
  {
    title: "Nexora Platform Launch: What's New in 2025",
    description:
      "We're thrilled to announce the official launch of Nexora's upgraded trading platform. This release brings institutional-grade order matching, sub-millisecond execution, multi-chain settlement, and a redesigned dashboard built for both beginners and professional traders. Explore everything that's changed and what's coming next.",
    tag: "Announcement",
    date: "July 2025",
    imageAlt: "Nexora platform launch banner",
  },
  {
    title: "Understanding Crypto Arbitrage: A Complete Guide",
    description:
      "Arbitrage is one of the oldest strategies in financial markets. In crypto, price differences between exchanges can emerge in seconds and disappear just as fast. This guide walks through how arbitrage works, the types of opportunities our scanner detects, and how Nexora's built-in arbitrage engine helps traders capture risk-free spreads automatically.",
    tag: "Education",
    date: "June 2025",
    imageAlt: "Arbitrage strategy infographic",
  },
  {
    title: "Spot vs Futures Trading: Which Is Right for You?",
    description:
      "Spot trading and futures trading serve very different purposes. Spot gives you immediate ownership of an asset, while futures let you speculate on price direction with leverage. We break down the mechanics, risk profiles, margin requirements, and use cases for each so you can build a strategy that fits your goals.",
    tag: "Education",
    date: "May 2025",
    imageAlt: "Spot and futures trading comparison",
  },
  {
    title: "Security Best Practices for Crypto Traders",
    description:
      "Protecting your funds starts long before you place a trade. This post covers the full security stack we've built into Nexora — two-factor authentication, device session management, withdrawal whitelist, real-time anomaly detection — plus the personal habits that keep your account safe regardless of platform.",
    tag: "Security",
    date: "April 2025",
    imageAlt: "Security shield graphic",
  },
  {
    title: "Introducing Institutional API Access",
    description:
      "Nexora now offers dedicated API access for institutional clients, hedge funds, and professional trading desks. Features include co-location support, FIX protocol compatibility, sub-account management, and dedicated support SLAs. Read the full overview and find out how to apply for institutional onboarding.",
    tag: "Product",
    date: "March 2025",
    imageAlt: "Institutional API dashboard screenshot",
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Check your .env file.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB:", mongoose.connection.name);

  const existing = await Blog.countDocuments();
  if (existing > 0) {
    console.log(`Database already has ${existing} post(s). Skipping seed.`);
    await mongoose.disconnect();
    return;
  }

  for (const post of POSTS) {
    const slug = slugify(post.title);
    await Blog.create({ ...post, slug });
    console.log("Inserted:", post.title);
  }

  console.log(`Seeded ${POSTS.length} blog posts successfully.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
