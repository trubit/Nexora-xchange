import { requestWithRetry } from "../../api/client.js";

export const custodyVaultApi = {
  vaults: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/vault/vaults", params }),

  vaultById: (id) =>
    requestWithRetry({ method: "get", url: `/api/vault/vaults/${id}` }),

  createVault: (body) =>
    requestWithRetry({ method: "post", url: "/api/vault/vaults", data: body }),

  lockVault: (id, body = {}) =>
    requestWithRetry({ method: "patch", url: `/api/vault/vaults/${id}/lock`, data: body }),

  unlockVault: (id) =>
    requestWithRetry({ method: "patch", url: `/api/vault/vaults/${id}/unlock` }),

  transactions: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/vault/transactions", params }),

  initiateTransaction: (body) =>
    requestWithRetry({ method: "post", url: "/api/vault/transactions", data: body }),

  approveTransaction: (txId, body = {}) =>
    requestWithRetry({ method: "post", url: `/api/vault/transactions/${txId}/approve`, data: body }),

  rejectTransaction: (txId, body = {}) =>
    requestWithRetry({ method: "post", url: `/api/vault/transactions/${txId}/reject`, data: body }),

  pendingApprovals: () =>
    requestWithRetry({ method: "get", url: "/api/vault/approvals/pending" }),

  statistics: () =>
    requestWithRetry({ method: "get", url: "/api/vault/statistics" }),

  policies: () =>
    requestWithRetry({ method: "get", url: "/api/vault/policies" }),

  createPolicy: (body) =>
    requestWithRetry({ method: "post", url: "/api/vault/policies", data: body }),

  auditLog: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/vault/audit", params }),
};
