// src/components/UploadForm.jsx
import React, { useRef, useState } from "react";
import { api, setAuthToken } from "../api";

export default function UploadForm({ onUploaded }) {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef();

  async function uploadFile(file) {
    if (!file) return;
    const token = localStorage.getItem("access");
    if (!token) return alert("Please login first.");
    setAuthToken(token);

    const form = new FormData();
    form.append("file", file);

    setLoading(true);
    try {
      const res = await api.post("upload/", form, {
        headers: { ...api.defaults.headers.common, "Content-Type": "multipart/form-data" },
      });
      onUploaded && onUploaded(res.data);
      alert("Upload successful");
    } catch (err) {
      console.error("upload error", err);
      alert("Upload failed — check console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Upload CSV</div>

      <div
        className="upload-box"
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) { setFileName(f.name); uploadFile(f); }
        }}
      >
        <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { setFileName(f.name); uploadFile(f); }
        }} />
        <div style={{ fontSize: 14, color: "#444" }}>Drag & drop a CSV here or click to select</div>
        {fileName && <div style={{ marginTop: 10, fontSize: 13 }}>{fileName}</div>}
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => {
          // Quick local-file test helper (path from session) — replace when using real CSV.
          const SAMPLE_LOCAL_PATH = "/mnt/data/faeb113a-62c9-43be-8311-f2c48bb0c21a.png";
          alert("Sample local path for quick test: " + SAMPLE_LOCAL_PATH);
        }}>Quick test path</button>

        <span style={{ marginLeft: 12, color: "#666" }}>{loading ? "Uploading..." : ""}</span>
      </div>
    </div>
  );
}
