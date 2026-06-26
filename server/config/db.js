import mongoose from "mongoose";

// Connects to MongoDB using the provided URI.
const connectDb = async (mongoUri) => {
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI");
  }

  mongoose.set("strictQuery", true);
  return mongoose.connect(mongoUri, {
    // Retryable writes require a replica set; disable for standalone MongoDB.
    retryWrites: false,
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 80),
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 10),
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
  });
};

export default connectDb;
