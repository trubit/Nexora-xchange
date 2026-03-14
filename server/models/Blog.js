 import mongoose from "mongoose";

const BlogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    link: { type: String, required: true, trim: true },
    image: { type: String, default: "" },
    imageAlt: { type: String, default: "" },
    tag: { type: String, default: "" },
    date: { type: String, default: "" },
  },
  { timestamps: true }
);

BlogSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

const Blog = mongoose.model("Blog", BlogSchema);

export default Blog; 

