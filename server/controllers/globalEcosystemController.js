import { globalEcosystemService } from "../services/globalEcosystemService.js";

const hasAccess = (user) =>
  user && ["admin", "compliance_officer", "finance_admin"].includes(user.role);

export async function getStatistics(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const stats = await globalEcosystemService.getStatistics();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Partners
export async function getPartners(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { type, status, page, limit } = req.query;
    const result = await globalEcosystemService.getPartners({
      type, status,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "20", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function onboardPartner(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const partner = await globalEcosystemService.onboardPartner(req.body);
    res.status(201).json({ partner });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function activatePartner(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const partner = await globalEcosystemService.activatePartner(req.params.partnerId);
    res.json({ partner });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function updatePartnerRating(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const partner = await globalEcosystemService.updatePartnerRating(
      req.params.partnerId, req.body.score
    );
    res.json({ partner });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Payments
export async function getPayments(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { status, rail, page, limit } = req.query;
    const result = await globalEcosystemService.getPayments({
      status, rail,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "50", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function initiatePayment(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const payment = await globalEcosystemService.initiatePayment({
      ...req.body,
      fromUserId: req.user._id || null,
    });
    res.status(201).json({ payment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Integrations
export async function getIntegrations(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { partnerId, status, page, limit } = req.query;
    const result = await globalEcosystemService.getIntegrations({
      partnerId, status,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "50", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createIntegration(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const integration = await globalEcosystemService.createIntegration(req.body);
    res.status(201).json({ integration });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function recordIntegrationCall(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const integration = await globalEcosystemService.recordIntegrationCall(
      req.params.integrationId, req.body
    );
    res.json({ integration });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
