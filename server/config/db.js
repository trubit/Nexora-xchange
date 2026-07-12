import mongoose from "mongoose";

// Connects to MongoDB using the provided URI.
const connectDb = async (mongoUri) => {
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI");
  }

  const isProd = process.env.NODE_ENV === "production";

  mongoose.set("strictQuery", true);
  return mongoose.connect(mongoUri, {
    // Retryable writes require a replica set; disable for standalone MongoDB.
    retryWrites: false,
    // Dev: 2/20 — starts fast and uses little memory.
    // Prod: 5/50 — enough headroom for real traffic.
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || (isProd ? 5  : 2)),
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || (isProd ? 50 : 20)),
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
  });
};

export default connectDb;
