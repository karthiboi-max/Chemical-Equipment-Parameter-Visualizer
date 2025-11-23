// src/components/LoginForm.js
import React, { useState } from "react";
import { loginGetToken, setAuthToken } from "../api";

export default function LoginForm({ onLogin }) {
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    // Clear stale tokens
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setAuthToken(null);

    try {
      const data = await loginGetToken(username, password);
      setAuthToken(data.access);
      onLogin();
    } catch (err) {
      console.error("Login failed:", err);
      setError("Invalid username or password");
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Login</h2>
        <form onSubmit={handleLogin}>
          <input
            placeholder="Username"
            onChange={(e) => setUser(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPass(e.target.value)}
          />
          <button type="submit">Login</button>
        </form>

        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  );
}
