 import Transaction from "../models/Transaction.js";

export const listTransactions = async (req, res) => {
  const filter = req.user?.role === "admin" ? {} : { user: req.user.id };
  const transactions = await Transaction.find(filter).sort({ createdAt: -1 });
  res.json({ transactions });
};

export const createTransaction = async (req, res) => {
  const payload = { ...req.body, user: req.user.id };
  const transaction = await Transaction.create(payload);
  res.status(201).json({ transaction });
}; 

