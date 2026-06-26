import axios from "axios";

// In dev, use "" so requests go through the Vite proxy (same-origin, no CORS).
// In production, read the explicit API origin from env.
export const API_BASE_URL = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_TRUSON_API_URL ||
     import.meta.env.VITE_API_URL ||
     "");

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_DELAYS_MS = [400, 1200, 2600];
const inflightGetMap = new Map();
let refreshPromise = null;

const wait = (delayMs) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

const buildRequestKey = (config) => {
  const method = String(config?.method || "get").toLowerCase();
  const params = JSON.stringify(config?.params || {});
  const data = typeof config?.data === "string" ? config.data : JSON.stringify(config?.data || {});
  return `${method}:${config?.url || ""}:${params}:${data}`;
};

const normalizeError = (error) => {
  const message =
    error?.response?.data?.message || error?.message || "Request failed.";
  const normalized = new Error(message);
  normalized.status = error?.response?.status;
  normalized.code = error?.response?.data?.code;
  normalized.details = error?.response?.data;
  normalized.originalError = error;
  return normalized;
};

const shouldRetry = (error) => {
  const status = error?.response?.status;
  if (!status) return true;
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500;
};

const getToken = () => localStorage.getItem("token");
const getRefreshToken = () => localStorage.getItem("refreshToken");

const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

const rawClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    // Let the browser set multipart boundaries for FormData.
    if (typeof config.headers?.delete === "function") {
      config.headers.delete("Content-Type");
    }
    if (typeof config.headers?.set === "function") {
      config.headers.set("Content-Type", undefined);
    } else {
      config.headers = {
        ...(config.headers || {}),
        "Content-Type": undefined,
      };
    }
  }
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["X-Client-Timezone"] =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return config;
});

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available.");
  }

  const response = await rawClient.post("/api/auth/refresh", { refreshToken });
  const token = response?.data?.token;
  if (!token) {
    throw new Error("Token refresh failed.");
  }
  localStorage.setItem("token", token);
  if (response?.data?.refreshToken) {
    localStorage.setItem("refreshToken", response.data.refreshToken);
  }
  return token;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;
    if (!original) {
      return Promise.reject(normalizeError(error));
    }

    const status = error?.response?.status;
    const isAuthRoute = String(original.url || "").includes("/api/auth/");

    if (status === 401 && !original._retry && !isAuthRoute) {
      if (getRefreshToken()) {
        original._retry = true;
        try {
          refreshPromise = refreshPromise || refreshAccessToken();
          const token = await refreshPromise;
          refreshPromise = null;
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient.request(original);
        } catch (refreshError) {
          refreshPromise = null;
          clearSession();
          window.dispatchEvent(new Event("auth:session-expired"));
          return Promise.reject(normalizeError(refreshError));
        }
      } else {
        // No refresh token — token is invalid (e.g. server restarted with new JWT secret).
        // Clear the stale session so the user is redirected to login.
        clearSession();
        window.dispatchEvent(new Event("auth:session-expired"));
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

export const requestWithRetry = async (
  config,
  {
    retries = DEFAULT_RETRY_DELAYS_MS.length,
    retryDelays = DEFAULT_RETRY_DELAYS_MS,
    dedupe = String(config?.method || "get").toLowerCase() === "get",
  } = {},
) => {
  const method = String(config?.method || "get").toLowerCase();
  const key = dedupe && method === "get" ? buildRequestKey(config) : null;

  if (key && inflightGetMap.has(key)) {
    return inflightGetMap.get(key);
  }

  const runner = (async () => {
    let attempt = 0;
    let lastError = null;

    while (attempt <= retries) {
      try {
        const response = await apiClient.request(config);
        return response.data;
      } catch (error) {
        lastError = error;
        if (attempt >= retries || !shouldRetry(error)) {
          throw normalizeError(error);
        }
        const delayMs = retryDelays[Math.min(attempt, retryDelays.length - 1)] || 1000;
        await wait(delayMs);
        attempt += 1;
      }
    }

    throw normalizeError(lastError);
  })();

  if (key) {
    inflightGetMap.set(key, runner);
    runner.then(
      () => {
        inflightGetMap.delete(key);
      },
      () => {
        inflightGetMap.delete(key);
      },
    );
  }

  return runner;
};

export const apiClientInstance = apiClient;
