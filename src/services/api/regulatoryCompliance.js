import { requestWithRetry } from "../../api/client.js";

export const regulatoryComplianceApi = {
  // Statistics
  statistics: () =>
    requestWithRetry({ method: "get", url: "/api/reg-compliance/statistics" }),

  // Sanctions
  getSanctionHits: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/reg-compliance/sanctions", params }),
  screenEntity: (body) =>
    requestWithRetry({ method: "post", url: "/api/reg-compliance/sanctions/screen", data: body }),
  reviewSanctionHit: (hitId, body) =>
    requestWithRetry({ method: "patch", url: `/api/reg-compliance/sanctions/${hitId}`, data: body }),

  // Travel Rule
  getTravelRuleRecords: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/reg-compliance/travel-rule", params }),
  createTravelRuleRecord: (body) =>
    requestWithRetry({ method: "post", url: "/api/reg-compliance/travel-rule", data: body }),

  // SARs
  getSars: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/reg-compliance/sar", params }),
  createSar: (body) =>
    requestWithRetry({ method: "post", url: "/api/reg-compliance/sar", data: body }),
  submitSar: (sarId, body = {}) =>
    requestWithRetry({ method: "post", url: `/api/reg-compliance/sar/${sarId}/submit`, data: body }),

  // Regulatory reports
  getReports: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/reg-compliance/reports", params }),
  generateReport: (body) =>
    requestWithRetry({ method: "post", url: "/api/reg-compliance/reports/generate", data: body }),
};
