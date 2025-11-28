// src/App.jsx
import React, { useState, useEffect, useMemo } from "react";
import UploadForm from "./components/UploadForm";
import DataTable from "./components/DataTable";
import ChartsPanel from "./components/ChartsPanel";
import MultiDashboard from "./components/MultiDashboard";
import ReportGenerator from "./components/ReportGenerator";
import LoginForm from "./components/LoginForm";
import FiltersPanel from "./components/FiltersPanel";
import Insights from "./components/Insights";
import ExportButtons from "./components/ExportButtons";
import HistoryTimeline from "./components/HistoryTimeline";
import "./index.css";
import { api, setAuthToken, logout } from "./api";

export default function App() {
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("access")));
  const [filters, setFilters] = useState({ startDate: "", endDate: "", type: "All", minFlow: "" });
  const [loadingLatest, setLoadingLatest] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("access");
    if (saved) {
      setAuthToken(saved);
      setLoggedIn(true);
      fetchLatest();
    }
  }, []);

  async function fetchLatest() {
    setLoadingLatest(true);
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
      if (err.response?.status === 401) {
        logout();
        setLoggedIn(false);
      }
    } finally {
      setLoadingLatest(false);
    }
  }

  const handleUploaded = async () => {
    await fetchLatest();
  };

  // Keep a parsed version of CSV for filtering, heatmap, insights, sparklines
  useEffect(() => {
    if (!csvText) { setParsedRows([]); return; }
    // lightweight parse
    const Papa = require("papaparse");
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
    setParsedRows(parsed);
  }, [csvText]);

  // Apply filters to parsedRows (used by charts and table)
  const filteredRows = useMemo(() => {
    if (!parsedRows.length) return [];
    return parsedRows.filter((r) => {
      // date range check (assumes timestamp/time/date columns)
      const t = r.timestamp || r.time || r.date || "";
      if (filters.startDate && new Date(t) < new Date(filters.startDate)) return false;
      if (filters.endDate && new Date(t) > new Date(filters.endDate)) return false;
      if (filters.type && filters.type !== "All" && (r.Type || r.type || r.type_name) !== filters.type) return false;
      const f = parseFloat(r.Flowrate ?? r.flowrate ?? r.flow_rate ?? r.flowRate);
      if (filters.minFlow && !Number.isNaN(f) && f < Number(filters.minFlow)) return false;
      return true;
    });
  }, [parsedRows, filters]);

  if (!loggedIn) {
    return <LoginForm onLogin={() => { setLoggedIn(true); fetchLatest(); }} />;
  }

  return (
    <div className="App" style={{ padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Chemical Equipment Parameter Visualizer</div>
          <div style={{ color: "#6b7280" }}>Upload CSVs, filter data, view insights, export charts</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ExportButtons targetSelector="canvas" />
          <button className="btn btn-secondary" onClick={() => { document.body.classList.toggle("dark-mode"); }}>Toggle Dark</button>
          <button className="btn btn-danger" onClick={() => { logout(); setLoggedIn(false); }}>Logout</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18 }}>
          <div>
            <UploadForm onUploaded={handleUploaded} />
            <div style={{ height: 12 }} />
            <ChartsPanel summary={summary} csvText={csvText} filteredRows={filteredRows} />
            <div style={{ height: 18 }} />
            <ReportGenerator containerSelector=".App" metadata={{ file_name: summary?.file_name || "dataset" }} />
            <MultiDashboard summary={summary} csvText={csvText} />
            <Insights rows={filteredRows} summary={summary} />
            <div style={{ height: 18 }} />
            <h2 style={{ marginBottom: 8 }}>Data Table</h2>
            <FiltersPanel filters={filters} setFilters={setFilters} parsedRows={parsedRows} />
            <div style={{ height: 12 }} />
            <DataTable csvText={csvText} rows={filteredRows} />
            <HistoryTimeline datasets={datasets} onLoad={async (d) => {
              try {
                const r = await api.get(`download/${d.id}/`);
                // set csv and summary
                // keeping setCsvText here to reuse your previous logic
                setCsvText(r.data);
                setSummary(d.summary);
              } catch (err) { console.error(err); }
            }} />
          </div>          
        </div>
      </main>
    </div>
  );
}
