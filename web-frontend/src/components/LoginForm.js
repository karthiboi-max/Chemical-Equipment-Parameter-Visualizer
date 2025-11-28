// src/components/LoginForm.jsx
import React, { useState } from "react";
import { loginGetToken, setAuthToken } from "../api";

export default function LoginForm({ onLogin }) {
  const [username, setUsername] = useState(localStorage.getItem("last_username") || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginGetToken(username, password);
      setAuthToken(data.access);
      localStorage.setItem("last_username", username);
      onLogin();
    } catch (err) {
      setError("Login failed — check credentials.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2 className="card-title">Sign in</h2>
      <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
        <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button className="btn btn-primary" disabled={loading}>{loading ? "Signing..." : "Sign in"}</button>
          <button type="button" className="btn btn-secondary" onClick={() => { setUsername("demo"); setPassword("demo"); }}>
            Demo
          </button>
        </div>
        {error && <div style={{ color: "#bc2b2b" }}>{error}</div>}
      </form>
    </div>
  );
}
