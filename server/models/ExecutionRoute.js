import mongoose from "mongoose";

/**
 * ExecutionRoute — records of how orders were routed and partially executed.
 *
 * Captures the SOR decision, execution result, and performance metrics
 * for latency tracking and strategy improvement.
 */
const RouteLegSchema = new mongoose.Schema(
  {
    venue:           { type: String, required: true },
    side:            { type: String, enum: ["buy", "sell"], required: true },
    quantity:        { type: Number, required: true },
    price:           { type: Number, default: null },
    filledQuantity:  { type: Number, default: 0 },
    status:          { type: String, enum: ["pending", "filled", "partial", "failed"], default: "pending" },
    latencyMs:       { type: Number, default: null },
  },
  { _id: false }
);

const ExecutionRouteSchema = new mongoose.Schema(
  {
    orderId:         { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: "User",  default: null, index: true },
    pair:            { type: String, required: true, index: true },
    side:            { type: String, enum: ["buy", "sell"], required: true },
    totalQuantity:   { type: Number, required: true },
    filledQuantity:  { type: Number, default: 0 },
    averageFillPrice:{ type: Number, default: null },
    estimatedSlippagePct: { type: Number, default: null },
    actualSlippagePct:    { type: Number, default: null },
    strategy:        { type: String, enum: ["single", "split", "twap", "iceberg"], default: "single" },
    legs:            { type: [RouteLegSchema], default: [] },
    status:          { type: String, enum: ["planned", "executing", "completed", "failed"], default: "planned" },
    routingLatencyMs:{ type: Number, default: null },
    totalLatencyMs:  { type: Number, default: null },
    metadata:        { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

ExecutionRouteSchema.index({ userId: 1, createdAt: -1 });
ExecutionRouteSchema.index({ pair: 1, status: 1 });

export default mongoose.model("ExecutionRoute", ExecutionRouteSchema);
