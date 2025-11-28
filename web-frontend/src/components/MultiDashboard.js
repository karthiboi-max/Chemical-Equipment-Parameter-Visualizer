// src/components/MultiDashboard.jsx
import React, { useMemo, useRef } from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import Papa from "papaparse";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

// Register chart.js components (safe to call multiple times)
ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

/**
 * MultiDashboard
 * Props:
 *  - summary: object from backend (may include averages, type_distribution)
 *  - csvText: raw csv text (used to compute correlation heatmap and charts)
 */
export default function MultiDashboard({ summary = {}, csvText = "" }) {
  const parsed = useMemo(() => {
    if (!csvText) return [];
    return Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
  }, [csvText]);

  // numeric columns we care about
  const numericCols = useMemo(() => {
    const cols = {};
    parsed.forEach((r) => {
      Object.keys(r).forEach((k) => {
        const n = parseFloat(r[k]);
        if (!Number.isNaN(n)) {
          cols[k] = cols[k] || [];
          cols[k].push(n);
        }
      });
    });
    return cols;
  }, [parsed]);

  // summary cards values (prefer summary.averages else compute from parsed)
  const averages = useMemo(() => {
    if (summary?.averages) return summary.averages;
    const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return {
      flowrate_avg: mean(numericCols["Flowrate"] || numericCols["flowrate"] || []),
      pressure_avg: mean(numericCols["Pressure"] || numericCols["pressure"] || []),
      temperature_avg: mean(numericCols["Temperature"] || numericCols["temperature"] || []),
    };
  }, [summary, numericCols]);

  // dataset count
  const totalCount = parsed.length || summary?.total_rows || 0;

  // Prepare two different bar datasets for demonstration:
  //  - Bar A: type distribution (if present in summary)
  //  - Bar B: top 5 columns mean values
  const typeDist = summary?.type_distribution || {};
  const barA = {
    labels: Object.keys(typeDist),
    datasets: [
      {
        label: "Count by Type",
        data: Object.values(typeDist),
        backgroundColor: Object.keys(typeDist).map((_, i) => `rgba(37,99,235,${0.6 - i*0.04})`),
      },
    ],
  };

  const numericMeans = useMemo(() => {
    const arr = Object.keys(numericCols)
      .map((k) => ({ k, mean: (numericCols[k].reduce((a,b)=>a+b,0) / numericCols[k].length) || 0 }))
      .sort((a,b) => Math.abs(b.mean) - Math.abs(a.mean))
      .slice(0, 5);
    return arr;
  }, [numericCols]);

  const barB = {
    labels: numericMeans.map((x) => x.k),
    datasets: [
      {
        label: "Top 5 numeric means",
        data: numericMeans.map((x) => x.mean),
        backgroundColor: "rgba(16,185,129,0.7)",
      },
    ],
  };

  // Line chart (flowrate over time) — looks for timestamp + flowrate columns
  const flowSeries = useMemo(() => {
    const rows = parsed
      .map((r) => ({ t: r.timestamp || r.time || r.date, f: parseFloat(r.Flowrate ?? r.flowrate ?? r.flow_rate) }))
      .filter((x) => x.t && !Number.isNaN(x.f));
    try { rows.sort((a,b) => new Date(a.t) - new Date(b.t)); } catch {}
    return rows;
  }, [parsed]);

  const lineData = {
    labels: flowSeries.map((r) => r.t),
    datasets: [
      {
        label: "Flowrate",
        data: flowSeries.map((r) => r.f),
        borderColor: "rgba(37,99,235,0.9)",
        backgroundColor: "rgba(37,99,235,0.05)",
        fill: true,
      },
    ],
  };

  // Pie chart: reuse type distribution if present, else use numericMeans
  const pieData = {
    labels: Object.keys(typeDist).length ? Object.keys(typeDist) : numericMeans.map(x => x.k),
    datasets: [
      {
        data: Object.keys(typeDist).length ? Object.values(typeDist) : numericMeans.map(x => x.mean),
        backgroundColor: ["#2563eb", "#10b981", "#ff9f40", "#ef4444", "#8b5cf6"],
      },
    ],
  };

  // Correlation matrix (heatmap) computed on numericCols
  const corrMatrix = useMemo(() => {
    const keys = Object.keys(numericCols);
    const matrix = [];
    const corr = (a, b) => {
      const n = Math.min(a.length, b.length);
      if (n === 0) return 0;
      const ma = a.reduce((s,x)=>s+x,0)/a.length;
      const mb = b.reduce((s,x)=>s+x,0)/b.length;
      let num = 0, da = 0, db = 0;
      for (let i=0;i<n;i++){ num += (a[i]-ma)*(b[i]-mb); da += (a[i]-ma)**2; db += (b[i]-mb)**2; }
      const denom = Math.sqrt(da*db);
      return denom === 0 ? 0 : num/denom;
    };
    for (let i=0;i<keys.length;i++){
      const row = [];
      for (let j=0;j<keys.length;j++){
        row.push(Number(corr(numericCols[keys[i]], numericCols[keys[j]])?.toFixed(3) || 0));
      }
      matrix.push(row);
    }
    return { keys, matrix };
  }, [numericCols]);

  // Refs (for PDF generation)
  const containerRef = useRef(null);

  return (
    <div ref={containerRef}>
      {/* SUMMARY CARDS */}
      <div className="dashboard-cards">
        <div className="summary-card">
          <div className="summary-title">Avg Flowrate</div>
          <div className="summary-value">{averages.flowrate_avg ? averages.flowrate_avg.toFixed(2) : "-"}</div>
        </div>
        <div className="summary-card">
          <div className="summary-title">Avg Pressure</div>
          <div className="summary-value">{averages.pressure_avg ? averages.pressure_avg.toFixed(2) : "-"}</div>
        </div>
        <div className="summary-card">
          <div className="summary-title">Avg Temperature</div>
          <div className="summary-value">{averages.temperature_avg ? averages.temperature_avg.toFixed(2) : "-"}</div>
        </div>
        <div className="summary-card">
          <div className="summary-title">Rows</div>
          <div className="summary-value">{totalCount}</div>
        </div>
      </div>

      {/* GRID LAYOUT:
          2x2 top (bar A, bar B)
          2x2 bottom (line, pie) and heatmap spans right
      */}
      <div className="dashboard-grid">
        <div className="chart-card">
          <div className="chart-card-title">Equipment Type Distribution</div>
          <div className="chart-area"><Bar key={`barA-${JSON.stringify(typeDist)}`} data={barA} /></div>
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Numeric Means (top)</div>
          <div className="chart-area"><Bar key={`barB-${JSON.stringify(barB.labels)}`} data={barB} /></div>
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Flowrate Over Time</div>
          <div className="chart-area">{flowSeries.length ? <Line key={`line-${flowSeries.length}`} data={lineData} /> : <div className="no-data">No timestamped flowrate</div>}</div>
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Distribution</div>
          <div className="chart-area"><Pie key={`pie-${JSON.stringify(pieData.labels)}`} data={pieData} /></div>
        </div>

        <div className="chart-card heatmap-card">
          <div className="chart-card-title">Correlation Heatmap</div>
          <div className="heatmap-wrapper">
            <HeatmapTable keys={corrMatrix.keys} matrix={corrMatrix.matrix} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Subcomponent: simple table-based heatmap (styled via CSS).
   Each cell background uses correlation value to compute color.
*/
function HeatmapTable({ keys = [], matrix = [] }) {
  if (!keys.length) return <div className="no-data">Not enough numeric columns for heatmap</div>;

  const colorFor = (v) => {
    // v in [-1,1] -> negative = red tint, positive = blue tint
    const val = Math.max(-1, Math.min(1, v));
    const intensity = Math.round(Math.abs(val) * 200); // 0..200
    if (val >= 0) return `rgba(37,99,235,${0.2 + Math.abs(val)*0.65})`; // blue
    return `rgba(239,68,68,${0.2 + Math.abs(val)*0.65})`; // red
  };

  return (
    <div className="heatmap-table-wrap">
      <table className="heatmap-table">
        <thead>
          <tr>
            <th></th>
            {keys.map((k) => <th key={`h-${k}`}>{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={`r-${i}`}>
              <td className="heatmap-row-label">{keys[i]}</td>
              {row.map((cell, j) => (
                <td key={`c-${i}-${j}`} style={{ background: colorFor(cell), color: Math.abs(cell) > 0.45 ? '#fff' : '#111' }}>
                  {cell.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
