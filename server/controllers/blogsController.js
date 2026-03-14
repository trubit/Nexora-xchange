 import Blog from "../models/Blog.js";

const parseLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 4;
  }
  return Math.min(parsed, 50);
};

const parseSort = (value) => {
  if (!value) {
    return { updatedAt: -1 };
  }

  const isDesc = value.startsWith("-");
  const field = isDesc ? value.slice(1) : value;
  const allowed = new Set(["updatedAt", "createdAt", "title"]);

  if (!allowed.has(field)) {
    return { updatedAt: -1 };
  }

  return { [field]: isDesc ? -1 : 1 };
};

const toPayload = (body) => ({
  title: body.title?.trim() ?? "",
  description: body.description?.trim() ?? "",
  link: body.link?.trim() ?? "",
  image: body.image?.trim() ?? "",
  imageAlt: body.imageAlt?.trim() ?? "",
  tag: body.tag?.trim() ?? "",
  date: body.date?.trim() ?? "",
});

export const listBlogs = async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const sort = parseSort(req.query.sort);
  const posts = await Blog.find().sort(sort).limit(limit);
  res.json({ posts });
};

export const getBlog = async (req, res) => {
  const post = await Blog.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ message: "Post not found." });
  }
  return res.json({ post });
};

export const createBlog = async (req, res) => {
  const payload = toPayload(req.body);
  if (!payload.title || !payload.description || !payload.link) {
    return res.status(400).json({
      message: "Title, description, and link are required.",
    });
  }
  const post = await Blog.create(payload);
  return res.status(201).json({ post });
};

export const updateBlog = async (req, res) => {
  const payload = toPayload(req.body);
  if (!payload.title || !payload.description || !payload.link) {
    return res.status(400).json({
      message: "Title, description, and link are required.",
    });
  }

  const post = await Blog.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });
  if (!post) {
    return res.status(404).json({ message: "Post not found." });
  }
  return res.json({ post });
};

export const deleteBlog = async (req, res) => {
  const post = await Blog.findByIdAndDelete(req.params.id);
  if (!post) {
    return res.status(404).json({ message: "Post not found." });
  }
  return res.json({ ok: true });
}; 

