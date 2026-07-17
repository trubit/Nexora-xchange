import { requestWithRetry } from "../../api/client.js";

export const auditLedgerApi = {
  stats:          ()      => requestWithRetry({ method: "get", url: "/api/audit-ledger/stats"                }),
  entries:        (p={})  => requestWithRetry({ method: "get", url: "/api/audit-ledger/entries",   params: p }),
  verifyChain:    (p={})  => requestWithRetry({ method: "get", url: "/api/audit-ledger/verify-chain",params: p}),
  reports:        (p={})  => requestWithRetry({ method: "get", url: "/api/audit-ledger/reports",   params: p }),
  reconciliation: (p={})  => requestWithRetry({ method: "get", url: "/api/audit-ledger/reconciliation",params:p}),
  runReconciliation: (body)=> requestWithRetry({ method: "post",url: "/api/audit-ledger/reconciliation/run",data:body}),
  generateReport: (body)  => requestWithRetry({ method: "post",url: "/api/audit-ledger/reports",  data: body }),
};
