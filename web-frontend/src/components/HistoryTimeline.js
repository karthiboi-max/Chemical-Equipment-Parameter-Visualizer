// src/components/HistoryTimeline.jsx
import React, { useEffect, useRef } from "react";
import Papa from "papaparse";

/**
 * datasets: array of {id, file_name, uploaded_at, summary}
 * onLoad: function to load a dataset (provided by App)
 */
export default function HistoryTimeline({ datasets = [], onLoad = () => {} }) {
  return (
    <div className="card">
      <div className="card-title">History</div>
      <div>
        {datasets.length === 0 && <div style={{ color: "#666" }}>No datasets</div>}
        {datasets.slice(0, 12).map(ds => (
          <HistoryItem key={ds.id} ds={ds} onLoad={onLoad} />
        ))}
      </div>
    </div>
  );
}

function HistoryItem({ ds, onLoad }) {
  const canvasRef = useRef(null);

  // create a tiny sparkline from ds.summary.preview or random
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,200,40);

    // attempt to get numeric series from summary.preview first row
    let series = [];
    try {
      const preview = ds.summary?.preview || [];
      if (preview.length) {
        const row = preview[0];
        series = Object.values(row).map(v => {
          const n = parseFloat(v);
          return Number.isNaN(n) ? null : n;
        }).filter(x => x !== null);
      }
    } catch {}

    if (!series || series.length < 3) {
      // fallback create small series from type_distribution counts
      const td = ds.summary?.type_distribution || {};
      series = Object.values(td).slice(0,10).map(x => Number(x) || 0);
      if (series.length < 3) series = Array.from({length:6}, ()=>Math.random()*10);
    }

    // draw sparkline
    const w = canvas.width, h = canvas.height;
    const max = Math.max(...series), min = Math.min(...series);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    series.forEach((v,i) => {
      const x = (i/(series.length-1)) * (w-2) + 1;
      const y = h - ((v - min) / Math.max(1, (max - min || 1))) * (h-4) - 2;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }, [ds]);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
      <canvas ref={canvasRef} width={120} height={36} style={{ borderRadius: 6, background: "#fff" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{ds.file_name}</div>
        <div style={{ fontSize: 12, color: "#666" }}>{new Date(ds.uploaded_at).toLocaleString()}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button className="btn" onClick={() => onLoad(ds)}>Load</button>
        <a className="btn btn-secondary" href={`#`} onClick={(e)=>{ e.preventDefault(); alert("Download handled by API in production"); }}>Download</a>
      </div>
    </div>
  );
}
