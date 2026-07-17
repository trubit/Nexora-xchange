import { requestWithRetry } from "../../api/client.js";

export const clearingApi = {
  settlements: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/clearing/settlements", params }),

  settlementById: (id) =>
    requestWithRetry({ method: "get", url: `/api/clearing/settlements/${id}` }),

  history: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/clearing/history", params }),

  statistics: () =>
    requestWithRetry({ method: "get", url: "/api/clearing/statistics" }),

  batches: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/clearing/batches", params }),

  auditLogs: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/clearing/audit", params }),

  reconcile: (body = {}) =>
    requestWithRetry({ method: "post", url: "/api/clearing/reconcile", data: body }),

  retry: (id) =>
    requestWithRetry({ method: "post", url: `/api/clearing/retry/${id}` }),
};
