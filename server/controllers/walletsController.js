 import Wallet from "../models/Wallet.js";

export const listWallets = async (req, res) => {
  const filter = req.user?.role === "admin" ? {} : { user: req.user.id };
  const wallets = await Wallet.find(filter).sort({ asset: 1 });
  res.json({ wallets });
};

export const createWallet = async (req, res) => {
  const payload = { ...req.body, user: req.user.id };
  const wallet = await Wallet.create(payload);
  res.status(201).json({ wallet });
};

export const updateWallet = async (req, res) => {
  const wallet = await Wallet.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!wallet) {
    return res.status(404).json({ message: "Wallet not found." });
  }
  return res.json({ wallet });
}; 

