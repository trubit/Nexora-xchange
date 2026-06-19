import { requestWithRetry } from "../../api/client.js";

export const ordersApi = {
  getOpenOrders: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/orders", params }),

  getOrderHistory: (params = {}) =>
    requestWithRetry({ method: "get", url: "/api/orders/history", params }),

  createOrder: (payload) =>
    requestWithRetry(
      { method: "post", url: "/api/orders", data: payload },
      { retries: 0 }
    ),

  createOCOOrder: (payload) =>
    requestWithRetry(
      { method: "post", url: "/api/orders/oco", data: payload },
      { retries: 0 }
    ),

  cancelOrder: (orderId) =>
    requestWithRetry(
      { method: "post", url: `/api/orders/${orderId}/cancel` },
      { retries: 0 }
    ),
};
