const API_BASE_URL =
  import.meta.env.VITE_TRUSON_API_URL ||
  import.meta.env.VITE_API_URL ||
  "";

const defaultHeaders = {
  "Content-Type": "application/json",
};

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const request = async (path, options = {}) => {
  const normalizedOptions = {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  };

  if (normalizedOptions.body == null) {
    delete normalizedOptions.headers["Content-Type"];
  }

  const response = await fetch(`${API_BASE_URL}${path}`, normalizedOptions);
  const payload = await parseJson(response);

  if (!response.ok) {
    const message = payload?.message || "Request failed";
    const error = new Error(message);
    if (payload?.code) {
      error.code = payload.code;
    }
    throw error;
  }

  return payload;
};

// Create a new account.
export const registerUser = (body) =>
  request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

// Log in with email + password.
export const loginUser = (body) =>
  request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

// Log in or sign up with Google (ID token).
export const googleAuth = (credential, extra = {}) =>
  request("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential, ...extra }),
  });

// Ask the backend to send a reset email.
export const requestPasswordReset = (email) =>
  request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

// Send the token + new password to finish the reset.
export const resetPassword = (payload) =>
  request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
