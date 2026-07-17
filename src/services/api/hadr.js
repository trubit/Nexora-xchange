import { requestWithRetry } from "../../api/client.js";

export const hadrApi = {
  statistics:       ()        => requestWithRetry({ method: "get",  url: "/api/hadr/statistics" }),
  getHealthChecks:  (p = {})  => requestWithRetry({ method: "get",  url: "/api/hadr/health",           params: p }),
  getFailoverEvents:(p = {})  => requestWithRetry({ method: "get",  url: "/api/hadr/failover",         params: p }),
  triggerFailover:  (body)    => requestWithRetry({ method: "post", url: "/api/hadr/failover",          data: body }),
  getBackups:       (p = {})  => requestWithRetry({ method: "get",  url: "/api/hadr/backups",          params: p }),
  triggerBackup:    (body)    => requestWithRetry({ method: "post", url: "/api/hadr/backups/trigger",   data: body }),
  getDrPlans:       (p = {})  => requestWithRetry({ method: "get",  url: "/api/hadr/dr-plans",         params: p }),
  createDrPlan:     (body)    => requestWithRetry({ method: "post", url: "/api/hadr/dr-plans",          data: body }),
  recordDrTest:     (planId, body) =>
    requestWithRetry({ method: "post", url: `/api/hadr/dr-plans/${planId}/test`, data: body }),
};
