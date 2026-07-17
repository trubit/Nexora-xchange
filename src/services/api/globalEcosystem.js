import { requestWithRetry } from "../../api/client.js";

export const globalEcosystemApi = {
  statistics:     ()          => requestWithRetry({ method: "get",  url: "/api/ecosystem/statistics" }),
  getPartners:    (p = {})    => requestWithRetry({ method: "get",  url: "/api/ecosystem/partners",              params: p }),
  onboardPartner: (body)      => requestWithRetry({ method: "post", url: "/api/ecosystem/partners",              data: body }),
  activatePartner:(id)        => requestWithRetry({ method: "patch",url: `/api/ecosystem/partners/${id}/activate` }),
  ratePartner:    (id, score) => requestWithRetry({ method: "patch",url: `/api/ecosystem/partners/${id}/rating`, data: { score } }),
  getPayments:    (p = {})    => requestWithRetry({ method: "get",  url: "/api/ecosystem/payments",              params: p }),
  initiatePayment:(body)      => requestWithRetry({ method: "post", url: "/api/ecosystem/payments",              data: body }),
  getIntegrations:(p = {})    => requestWithRetry({ method: "get",  url: "/api/ecosystem/integrations",         params: p }),
  createIntegration:(body)    => requestWithRetry({ method: "post", url: "/api/ecosystem/integrations",          data: body }),
  recordCall:     (id, body)  => requestWithRetry({ method: "post", url: `/api/ecosystem/integrations/${id}/call`, data: body }),
};
