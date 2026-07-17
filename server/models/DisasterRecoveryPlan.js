import mongoose from "mongoose";

/**
 * DisasterRecoveryPlan — stores DR runbooks and test outcomes.
 * Status: draft | active | testing | deprecated
 */
const StepSchema = new mongoose.Schema(
  {
    order:       { type: Number, required: true },
    description: { type: String, required: true },
    owner:       { type: String, default: "ops" },
    estimatedMin:{ type: Number, default: 5 },
  },
  { _id: false }
);

const TestResultSchema = new mongoose.Schema(
  {
    testedAt:   { type: Date, required: true },
    outcome:    { type: String, enum: ["pass", "fail", "partial"], required: true },
    rtoAchieved:{ type: Number, default: null }, // minutes
    rpoAchieved:{ type: Number, default: null }, // minutes
    notes:      { type: String, default: null },
    testedBy:   { type: String, default: null },
  },
  { _id: false }
);

const DisasterRecoveryPlanSchema = new mongoose.Schema(
  {
    planId:       { type: String, required: true, unique: true, index: true },
    name:         { type: String, required: true },
    description:  { type: String, default: "" },
    scenario:     { type: String, required: true },
    rtoMinutes:   { type: Number, required: true },
    rpoMinutes:   { type: Number, required: true },
    steps:        { type: [StepSchema], default: [] },
    testResults:  { type: [TestResultSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "active", "testing", "deprecated"],
      default: "draft",
      index: true,
    },
    lastTestedAt: { type: Date, default: null },
    approvedBy:   { type: String, default: null },
    metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("DisasterRecoveryPlan", DisasterRecoveryPlanSchema);
