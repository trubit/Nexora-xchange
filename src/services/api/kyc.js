import { requestWithRetry, apiClientInstance } from "../../api/client";

export const kycApi = {
  getMyKyc: () =>
    requestWithRetry({ method: "get", url: "/api/kyc/me" }),

  uploadDocument: async (file) => {
    const fd = new FormData();
    fd.append("document", file);
    const res = await apiClientInstance.post("/api/kyc/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  submitKyc: (data) =>
    requestWithRetry({ method: "post", url: "/api/kyc/submit", data }),

  // Admin
  listAll: () =>
    requestWithRetry({ method: "get", url: "/api/kyc" }),

  review: (id, data) =>
    requestWithRetry({ method: "put", url: `/api/kyc/${id}`, data }),
};
