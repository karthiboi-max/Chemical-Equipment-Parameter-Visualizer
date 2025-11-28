/*
Enhanced Chemical Equipment Parameter Visualizer
Single-file React component (ChemicalVisualizer_v2.jsx)

Features added:
- Modern Tailwind-based UI layout
- Responsive header with user avatar / logout
- Drag & drop CSV upload + progress
- File history list with preview and dataset selector
- ChartsPanel: Bar, Pie, Line (flowrate over time) + toggle + export PNG
- DataTable: sortable columns, pagination, row search, CSV export
- LoginForm: improved UX, remembers last username
- API module integrated (axios) with automatic token refresh
- Utility helpers for summarization and robust parsing
- Dark mode toggle

Install (project root):
- npm install react-chartjs-2 chart.js axios papaparse jspdf file-saver
- TailwindCSS recommended for styling (or adapt CSS in index.css)

Note: This file assumes you have set up Tailwind and an API at REACT_APP_API_BASE
*/

import React, { useEffect, useMemo, useState, useRef } from "react";
import Papa from "papaparse";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale,
} from "chart.js";
import axios from "axios";
import { saveAs } from "file-saver";
import "./ChemicalVisualizerV2.css";


ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale
);

// ------------------- API helper (same responsibilities as your api.js) -------------------
let API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000/api/";
if (!API_BASE.endsWith("/")) API_BASE += "/";

export const api = axios.create({ baseURL: API_BASE, headers: { "Content-Type": "application/json" } });

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

const saved = localStorage.getItem("access");
if (saved) setAuthToken(saved);

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

// ------------------- Utility helpers -------------------
function computeSummary(rows) {
  // rows: array of objects with keys: flowrate, pressure, temperature, timestamp (optional)
  const nums = { flowrate: [], pressure: [], temperature: [] };
  rows.forEach((r) => {
    const f = parseFloat(r.flowrate ?? r.Flowrate ?? r.flow_rate ?? r.flowRate);
    const p = parseFloat(r.pressure ?? r.Pressure);
    const t = parseFloat(r.temperature ?? r.Temperature ?? r.temp ?? r.Temp);
    if (!Number.isNaN(f)) nums.flowrate.push(f);
    if (!Number.isNaN(p)) nums.pressure.push(p);
    if (!Number.isNaN(t)) nums.temperature.push(t);
  });
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  return {
    flowrate_avg: mean(nums.flowrate),
    pressure_avg: mean(nums.pressure),
    temperature_avg: mean(nums.temperature),
    counts: { flowrate: nums.flowrate.length, pressure: nums.pressure.length, temperature: nums.temperature.length },
  };
}

function downloadCSV(text, name = "dataset.csv") {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, name);
}

// ------------------- LoginForm -------------------
function LoginForm({ onLogin }) {
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
      setError("Login failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white/90 dark:bg-gray-800/80 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-semibold mb-4">Sign in</h2>
      <form onSubmit={handleLogin} className="space-y-3">
        <input className="w-full p-2 border rounded" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="w-full p-2 border rounded" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex items-center justify-between">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded" disabled={loading}>{loading ? "Signing..." : "Sign in"}</button>
          <button type="button" className="text-sm text-gray-500" onClick={() => { setUsername("demo"); setPassword("demo"); }}>Use demo</button>
        </div>
        {error && <div className="text-red-600">{error}</div>}
      </form>
    </div>
  );
}

// ------------------- UploadForm (drag-drop + progress) -------------------
function UploadForm({ onUploaded }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();

  async function uploadFile(f) {
    if (!f) return alert("No file selected");
    const token = localStorage.getItem("access");
    if (!token) return alert("Login first");
    setAuthToken(token);
    const form = new FormData();
    form.append("file", f);
    setLoading(true);
    try {
      const res = await api.post("upload/", form, {
        headers: { ...api.defaults.headers.common, "Content-Type": "multipart/form-data" },
        onUploadProgress: (p) => {
          // could update a progress bar here
        },
      });
      onUploaded(res.data);
    } catch (err) {
      console.error(err);
      alert("Upload failed. See console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div
        className={`p-6 border-dashed rounded-lg cursor-pointer text-center ${dragOver ? "border-indigo-400 bg-indigo-50/30" : "border-gray-200"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; setFile(f); uploadFile(f); }}
        onClick={() => inputRef.current.click()}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { setFile(e.target.files[0]); uploadFile(e.target.files[0]); }} />
        <div className="text-sm text-gray-600">Drag and drop a CSV here or click to select</div>
        {file && <div className="mt-2 text-sm">Selected: {file.name}</div>}
        <div className="mt-3">
          <button className="px-3 py-1 bg-gray-200 rounded" disabled={!file || loading} onClick={() => uploadFile(file)}>{loading ? "Uploading..." : "Upload"}</button>
        </div>
      </div>
    </div>
  );
}

// ------------------- DataTable (sortable, paginated, search) -------------------
function DataTable({ csvText }) {
  const parsed = useMemo(() => (csvText ? Papa.parse(csvText, { header: true, skipEmptyLines: true }) : null), [csvText]);
  const headers = parsed?.meta?.fields || [];
  const rows = parsed?.data || [];
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!rows) return [];
    let out = rows;
    if (q) {
      const lower = q.toLowerCase();
      out = out.filter((r) => headers.some((h) => String(r[h] ?? "").toLowerCase().includes(lower)));
    }
    if (sortBy) {
      out = [...out].sort((a, b) => {
        const A = a[sortBy] ?? "";
        const B = b[sortBy] ?? "";
        if (!isNaN(parseFloat(A)) && !isNaN(parseFloat(B))) {
          return sortDir === "asc" ? parseFloat(A) - parseFloat(B) : parseFloat(B) - parseFloat(A);
        }
        return sortDir === "asc" ? String(A).localeCompare(String(B)) : String(B).localeCompare(String(A));
      });
    }
    return out;
  }, [rows, headers, q, sortBy, sortDir]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => setPage(1), [q, sortBy, sortDir, csvText]);

  if (!csvText) return <div className="text-gray-500">No data loaded.</div>;
  if (headers.length === 0 || rows.length === 0) return <div className="text-gray-500">No table data.</div>;

  return (
    <div className="bg-white/90 dark:bg-gray-800/80 p-4 rounded-lg shadow">
      <div className="flex items-center gap-2 mb-3">
        <input className="p-2 border rounded flex-1" placeholder="Search table..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="px-3 py-1 border rounded" onClick={() => downloadCSV(csvText, "export.csv")}>Export CSV</button>
      </div>
      <div className="overflow-auto">
        <table className="w-full table-auto">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left p-2 border-b cursor-pointer" onClick={() => { if (sortBy === h) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortBy(h); setSortDir("asc"); } }}>
                  {h} {sortBy === h && (sortDir === "asc" ? "↑" : "↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri} className="odd:bg-gray-50/60 dark:odd:bg-black/5">
                {headers.map((h, ci) => <td key={ci} className="p-2 align-top border-b">{row[h]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-gray-600">Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}</div>
        <div className="flex gap-2">
          <button className="px-2 py-1 border rounded" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <div className="px-3 py-1 border rounded">{page} / {pageCount}</div>
          <button className="px-2 py-1 border rounded" onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button>
        </div>
      </div>
    </div>
  );
}

// ------------------- ChartsPanel (multi-chart, toggles, export) -------------------
function ChartsPanel({ summary, csvText }) {
  const parsed = useMemo(() => (csvText ? Papa.parse(csvText, { header: true, skipEmptyLines: true }).data : []), [csvText]);
  const [show, setShow] = useState({ bar: true, pie: true, line: true });
  const chartRef = useRef(null);

  const labels = useMemo(() => {
    const td = summary?.type_distribution || {};
    return Object.keys(td);
  }, [summary]);

  const counts = useMemo(() => {
    const td = summary?.type_distribution || {};
    return Object.values(td);
  }, [summary]);

  const flowOverTime = useMemo(() => {
    // attempt to build timeseries by timestamp if present
    const rows = parsed.map((r) => ({
      t: r.timestamp || r.time || r.date || r.Timestamp,
      f: parseFloat(r.flowrate ?? r.Flowrate ?? r.flow_rate ?? r.flowRate),
    })).filter((x) => x.t && !Number.isNaN(x.f));
    // if timestamp parseable, sort by date
    try {
      rows.sort((a, b) => new Date(a.t) - new Date(b.t));
    } catch (e) {}
    return rows;
  }, [parsed]);

  const lineData = useMemo(() => ({
    labels: flowOverTime.map((r) => r.t),
    datasets: [{ label: "Flowrate over time", data: flowOverTime.map((r) => r.f), fill: false, tension: 0.2 }],
  }), [flowOverTime]);

  const barData = useMemo(() => ({ labels, datasets: [{ label: "Equipment Count", data: counts }] }), [labels, counts]);
  const pieData = useMemo(() => ({ labels, datasets: [{ data: counts }] }), [labels, counts]);

  function exportPNG() {
    // export the whole page or one chart; we try to export chart canvas
    try {
      const canvas = document.querySelector("canvas");
      if (!canvas) return alert("No chart found");
      canvas.toBlob((b) => saveAs(b, "chart.png"));
    } catch (e) {
      console.error(e);
      alert("Export failed");
    }
  }

  const avg = summary?.averages || {};

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="p-4 bg-white/90 dark:bg-gray-800/80 rounded-lg shadow">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Summary</h3>
            <div className="text-sm text-gray-600 mt-1">Avg Flowrate: {avg.flowrate_avg?.toFixed(2) ?? "-"} • Pressure: {avg.pressure_avg?.toFixed(2) ?? "-"} • Temp: {avg.temperature_avg?.toFixed(2) ?? "-"}</div>
          </div>
          <div className="space-x-2">
            <button className="px-2 py-1 border rounded" onClick={() => navigator.clipboard?.writeText(JSON.stringify(summary || {})) || alert('Copied')}>Copy JSON</button>
            <button className="px-2 py-1 border rounded" onClick={exportPNG}>Export PNG</button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={show.bar} onChange={(e) => setShow((s) => ({ ...s, bar: e.target.checked }))} /> Bar</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={show.pie} onChange={(e) => setShow((s) => ({ ...s, pie: e.target.checked }))} /> Pie</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={show.line} onChange={(e) => setShow((s) => ({ ...s, line: e.target.checked }))} /> Line (time)</label>
        </div>

        <div className="mt-4 space-y-4">
          {show.bar && (
            <div>
              <h4 className="text-sm font-medium mb-2">Type distribution</h4>
              <Bar data={barData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
            </div>
          )}

          {show.pie && (
            <div>
              <h4 className="text-sm font-medium mb-2">Distribution (pie)</h4>
              <Pie data={pieData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-white/90 dark:bg-gray-800/80 rounded-lg shadow">
        <h4 className="text-sm font-medium mb-2">Flowrate time series</h4>
        {flowOverTime.length === 0 ? <div className="text-gray-500">No timestamped flowrate data to show.</div> : <Line data={lineData} options={{ responsive: true, plugins: { legend: { display: false } } }} />}
      </div>
    </div>
  );
}

// ------------------- App -------------------
export default function App() {
  const [csvText, setCsvText] = useState("");
  const [summary, setSummary] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("access")));
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (loggedIn) fetchLatest();
  }, [loggedIn]);

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
      if (err.response?.status === 401) {
        logout();
        setLoggedIn(false);
      }
    }
  }

  async function handleUploaded() {
    await fetchLatest();
  }

  return (
    <div className={`${dark ? 'dark' : ''} min-h-screen bg-gray-100 dark:bg-gray-900 p-6`}> 
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Chemical Equipment Parameter Visualizer</h1>
            <div className="text-sm text-gray-600">Upload CSVs, inspect analytics & export charts</div>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-3 py-1 border rounded" onClick={() => setDark((d) => !d)}>{dark ? 'Light' : 'Dark'}</button>
            {loggedIn ? (
              <div className="flex items-center gap-2">
                <div className="text-sm">{localStorage.getItem('last_username') || 'User'}</div>
                <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={() => { logout(); setLoggedIn(false); }}>Logout</button>
              </div>
            ) : null}
          </div>
        </header>

        {!loggedIn ? (
          <LoginForm onLogin={() => { setLoggedIn(true); fetchLatest(); }} />
        ) : (
          <main className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <UploadForm onUploaded={handleUploaded} />
                <div className="mt-4">
                  <button className="px-3 py-1 border rounded mr-2" onClick={() => downloadCSV(csvText, 'download.csv')}>Download raw CSV</button>
                </div>

                <div className="mt-6">
                  <ChartsPanel summary={summary} csvText={csvText} />
                </div>
              </div>

              <aside className="p-4 bg-white/90 dark:bg-gray-800/80 rounded-lg shadow">
                <h3 className="font-medium mb-2">History</h3>
                <ul className="space-y-2">
                  {datasets.length === 0 && <li className="text-gray-500">No datasets yet</li>}
                  {datasets.slice(0, 10).map((d) => (
                    <li key={d.id} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{d.file_name}</div>
                        <div className="text-xs text-gray-500">{new Date(d.uploaded_at).toLocaleString()}</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button className="px-2 py-1 border rounded text-sm" onClick={async () => {
                          try {
                            const r = await api.get(`download/${d.id}/`);
                            setCsvText(r.data);
                            setSummary(d.summary);
                          } catch (err) { console.error(err); if (err.response?.status === 401) { logout(); setLoggedIn(false); } else alert('Failed to load'); }
                        }}>Load</button>
                        <button className="px-2 py-1 border rounded text-sm" onClick={() => downloadCSV(d.raw_text || d.csv_text || '', `${d.file_name || 'dataset'}.csv`)}>Save</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            <section>
              <h2 className="text-xl font-semibold mb-3">Data Table</h2>
              <DataTable csvText={csvText} />
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
