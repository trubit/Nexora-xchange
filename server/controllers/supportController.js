 import SupportTicket from "../models/SupportTicket.js";

export const listTickets = async (req, res) => {
  const filter = req.user?.role === "admin" ? {} : { user: req.user.id };
  const tickets = await SupportTicket.find(filter).sort({ createdAt: -1 });
  res.json({ tickets });
};

export const createTicket = async (req, res) => {
  const payload = {
    user: req.user.id,
    subject: req.body.subject,
    message: req.body.message,
    priority: req.body.priority,
  };
  const ticket = await SupportTicket.create(payload);
  res.status(201).json({ ticket });
};

export const updateTicket = async (req, res) => {
  const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!ticket) {
    return res.status(404).json({ message: "Ticket not found." });
  }
  return res.json({ ticket });
};

export const addReply = async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) {
    return res.status(404).json({ message: "Ticket not found." });
  }

  ticket.replies.push({
    message: req.body.message,
    author: req.user.id,
  });
  await ticket.save();
  return res.json({ ticket });
}; 

