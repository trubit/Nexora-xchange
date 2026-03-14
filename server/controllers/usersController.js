 import User from "../models/User.js";

const toSafeUser = (user) => (user ? user.toJSON() : null);

export const listUsers = async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users: users.map(toSafeUser) });
};

export const getUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  return res.json({ user: toSafeUser(user) });
};

export const updateUser = async (req, res) => {
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

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  return res.json({ user: toSafeUser(user) });
}; 

