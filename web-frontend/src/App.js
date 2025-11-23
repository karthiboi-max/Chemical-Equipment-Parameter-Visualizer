// src/App.js
import React, { useState, useEffect } from "react";
import UploadForm from "./components/UploadForm";
import DataTable from "./components/DataTable";
import ChartsPanel from "./components/ChartsPanel";
import LoginForm from "./components/LoginForm";
import "./index.css";
import { api, setAuthToken, logout } from "./api";

function App() {
  const [csvText, setCsvText] = useState("");
  const [summary, setSummary] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("access");
    if (saved) {
      setAuthToken(saved);
      setLoggedIn(true);
      fetchLatest();
    }
  }, []);

  async function fetchLatest() {
    try {
      const res = await api.get("datasets/");
      const dataList = Array.isArray(res.data) ? res.data : (res.data.datasets || []);
      setDatasets(dataList);

      if (dataList.length > 0) {
        const latest = dataList[0];
        const csvResp = await api.get(`download/${latest.id}/`);
        setCsvText(csvResp.data);
        setSummary(latest.summary);
      } else {
        setCsvText("");
        setSummary(null);
      }
    } catch (err) {
      console.error("fetchLatest error:", err);
      // if unauthorized, force logout and show login screen
      if (err.response?.status === 401) {
        logout();
        setLoggedIn(false);
      }
    }
  }

  const handleUploaded = async () => {
    await fetchLatest();
  };

  if (!loggedIn) {
    return <LoginForm onLogin={() => { setLoggedIn(true); fetchLatest(); }} />;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Chemical Equipment Parameter Visualizer</h1>

      <UploadForm onUploaded={handleUploaded} />
      <button style={{ marginLeft: 12 }} onClick={() => { logout(); setLoggedIn(false); }}>Logout</button>
      <hr />

      <ChartsPanel summary={summary} />
      <hr />

      <h2>Data Table</h2>
      <DataTable csvText={csvText} />
      <hr />

      <h3>History (last 5)</h3>
      <ul>
        {datasets.length === 0 && <li>No datasets found.</li>}
        {datasets.slice(0, 5).map((d) => (
          <li key={d.id}>
            {d.file_name} — Uploaded: {new Date(d.uploaded_at).toLocaleString()} —
            <button
              onClick={async () => {
                try {
                  const r = await api.get(`download/${d.id}/`);
                  setCsvText(r.data);
                  setSummary(d.summary);
                } catch (err) {
                  console.error("History load error:", err);
                  if (err.response?.status === 401) {
                    // token problem - force logout
                    logout();
                    setLoggedIn(false);
                  } else {
                    alert("Failed to load dataset");
                  }
                }
              }}
            >
              Load
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
