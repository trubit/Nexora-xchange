import User from "../models/User.js";

const SUPER_ADMIN_EMAILS = new Set(
  (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
);

const isSuperAdmin = (user) =>
  Boolean(user?.email && SUPER_ADMIN_EMAILS.has(user.email.toLowerCase()));

// Strip sensitive fields and annotate super-admin status.
const toSafeUser = (user) => {
  if (!user) return null;
  const obj = user.toJSON ? user.toJSON() : { ...user };
  obj.superAdmin = isSuperAdmin(user);
  return obj;
};

// Admin: list all users.
export const listUsers = async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users: users.map(toSafeUser) });
};

// Self-or-admin: fetch a single user by ID.
// A regular user may only retrieve their own profile; admins may retrieve anyone's.
export const getUser = async (req, res) => {
  const requestedId = req.params.id;
  const callerId    = String(req.user._id ?? req.user.id);
  const isSelf      = callerId === requestedId;

  if (!isSelf && req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied." });
  }

  const user = await User.findById(requestedId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  return res.json({ user: toSafeUser(user) });
};

// Admin: update selected user fields.
export const updateUser = async (req, res) => {
  const target = await User.findById(req.params.id).lean();
  if (!target) return res.status(404).json({ message: "User not found." });

  if (isSuperAdmin(target) && req.body.role && req.body.role !== "admin") {
    return res.status(403).json({ message: "Super-admin role cannot be modified." });
  }

  const updates = {
    name: req.body.name?.trim(),
    phone: req.body.phone?.trim(),
    status: req.body.status,
    role: req.body.role,
    kycStatus: req.body.kycStatus,
  };

  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  });

  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  return res.json({ user: toSafeUser(user) });
}; 

