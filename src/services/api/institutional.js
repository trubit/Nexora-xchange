import { requestWithRetry } from "../../api/client.js";

export const institutionalApi = {
  tiers:        ()      => requestWithRetry({ method: "get",  url: "/api/institutional/tiers"        }),
  myKeys:       ()      => requestWithRetry({ method: "get",  url: "/api/institutional/keys"         }),
  issueKey:     (body)  => requestWithRetry({ method: "post", url: "/api/institutional/keys", data: body }),
  revokeKey:    (id)    => requestWithRetry({ method: "delete", url: `/api/institutional/keys/${id}` }),
  clients:      (p={})  => requestWithRetry({ method: "get",  url: "/api/institutional/clients",     params: p }),
  myClient:     ()      => requestWithRetry({ method: "get",  url: "/api/institutional/my"           }),
  subAccounts:  (id)    => requestWithRetry({ method: "get",  url: `/api/institutional/clients/${id}/sub-accounts` }),
};
