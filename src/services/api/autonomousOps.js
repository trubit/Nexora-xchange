import { requestWithRetry } from "../../api/client.js";

export const autonomousOpsApi = {
  statistics:       ()         => requestWithRetry({ method: "get",  url: "/api/autonomous-ops/statistics" }),
  getScalingEvents: (p = {})   => requestWithRetry({ method: "get",  url: "/api/autonomous-ops/scaling",           params: p }),
  triggerScale:     (body)     => requestWithRetry({ method: "post", url: "/api/autonomous-ops/scaling/trigger",    data: body }),
  getIncidents:     (p = {})   => requestWithRetry({ method: "get",  url: "/api/autonomous-ops/incidents",          params: p }),
  createIncident:   (body)     => requestWithRetry({ method: "post", url: "/api/autonomous-ops/incidents",          data: body }),
  updateIncident:   (id, body) => requestWithRetry({ method: "patch",url: `/api/autonomous-ops/incidents/${id}`,    data: body }),
  getDeployments:   (p = {})   => requestWithRetry({ method: "get",  url: "/api/autonomous-ops/deployments",        params: p }),
  recordDeployment: (body)     => requestWithRetry({ method: "post", url: "/api/autonomous-ops/deployments",        data: body }),
  rollback:         (id)       => requestWithRetry({ method: "post", url: `/api/autonomous-ops/deployments/${id}/rollback` }),
};
