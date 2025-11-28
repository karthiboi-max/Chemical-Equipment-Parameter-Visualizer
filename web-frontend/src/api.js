// src/api.js
import axios from "axios";

let API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000/api/";
if (!API_BASE.endsWith("/")) API_BASE += "/";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export function setAuthToken(token) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

function saveTokens({ access, refresh }) {
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
  setAuthToken(access || null);
}

export async function loginGetToken(username, password) {
  const res = await api.post("token/", { username, password });
  saveTokens({ access: res.data.access, refresh: res.data.refresh });
  return res.data;
}

export async function refreshAccessToken() {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return null;
  try {
    const res = await api.post("token/refresh/", { refresh });
    saveTokens({ access: res.data.access });
    return res.data.access;
  } catch (e) {
    logout();
    return null;
  }
}

export function logout() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  setAuthToken(null);
}

// Auto-load access token from storage on import (keeps axios header set)
const saved = localStorage.getItem("access");
if (saved) setAuthToken(saved);

// Retry once on 401 using refresh token
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (!original) return Promise.reject(err);
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const na = await refreshAccessToken();
      if (na) {
        original.headers["Authorization"] = `Bearer ${na}`;
        return api(original);
      }
    }
    return Promise.reject(err);
  }
);

export default api;
