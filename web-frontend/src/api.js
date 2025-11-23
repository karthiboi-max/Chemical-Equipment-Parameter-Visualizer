// src/api.js
import axios from "axios";

let API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000/api/";
if (!API_BASE.endsWith("/")) API_BASE += "/";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach access token to axios defaults when available
export function setAuthToken(token) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

// Save tokens helper (centralized)
function saveTokens({ access, refresh }) {
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
  setAuthToken(access || null);
}

// Login and get tokens
export async function loginGetToken(username, password) {
  const res = await api.post("token/", { username, password });
  saveTokens({ access: res.data.access, refresh: res.data.refresh });
  return res.data;
}

// Refresh access token using refresh token
export async function refreshAccessToken() {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return null;
  try {
    const res = await api.post("token/refresh/", { refresh });
    saveTokens({ access: res.data.access }); // update access only
    return res.data.access;
  } catch (e) {
    // refresh failed (expired/invalid) — clear tokens
    logout();
    return null;
  }
}

// Logout: clear storage & headers
export function logout() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  setAuthToken(null);
}

// Auto load token on module import (page refresh)
const saved = localStorage.getItem("access");
if (saved) setAuthToken(saved);

// Axios response interceptor to handle 401 -> try refresh -> retry once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // Only try once
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Try to refresh the token
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        // Ensure header is set for this request and retry
        originalRequest.headers["Authorization"] = `Bearer ${newAccess}`;
        return api(originalRequest);
      }
      // no refresh -> reject with original error
    }
    return Promise.reject(error);
  }
);

export default api;
