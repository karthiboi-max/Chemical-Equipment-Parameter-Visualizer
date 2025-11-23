// src/components/UploadForm.js
import React, { useState } from "react";
import { api, setAuthToken } from "../api";

export default function UploadForm({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Select CSV first");

    const token = localStorage.getItem("access");
    if (!token) return alert("You must login first");
    setAuthToken(token);

    const form = new FormData();
    form.append("file", file);

    setLoading(true);

    try {
      // Merge headers so Authorization is preserved
      const res = await api.post("upload/", form, {
        headers: {
          ...api.defaults.headers.common, // ensures Authorization present
          "Content-Type": "multipart/form-data",
        },
      });
      onUploaded(res.data);
      alert("Uploaded successfully");
    } catch (err) {
      console.error("Upload error:", err);
      alert(
        "Upload error: " +
          (err.response?.data?.detail ||
            err.response?.data?.error ||
            err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Uploading..." : "Upload CSV"}
      </button>
    </form>
  );
}
