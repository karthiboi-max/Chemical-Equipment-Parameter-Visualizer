// src/components/ChartsPanel.jsx
import React, { useMemo } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
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

export default function ChartsPanel({ summary, csvText }) {
  const parsed = useMemo(() => {
    if (!csvText) return [];
    return Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
  }, [csvText]);

  const labels = Object.keys(summary?.type_distribution || {});
  const counts = Object.values(summary?.type_distribution || {});
  const avg = summary?.averages || {};

  const flowOverTime = useMemo(() => {
    const rows = parsed
      .map((r) => ({
        t: r.timestamp || r.time || r.date,
        f: parseFloat(r.flowrate ?? r.Flowrate ?? r.flow_rate),
      }))
      .filter((x) => x.t && !Number.isNaN(x.f));

    try {
      rows.sort((a, b) => new Date(a.t) - new Date(b.t));
    } catch {}

    return rows;
  }, [parsed]);

  const barData = {
    labels,
    datasets: [
      {
        label: "Count",
        data: counts,
        backgroundColor: "rgba(37, 99, 235, 0.65)",
        borderRadius: 6,
      },
    ],
  };

  const pieData = {
    labels,
    datasets: [
      {
        data: counts,
        backgroundColor: [
          "rgba(37,99,235,0.75)",
          "rgba(16,185,129,0.75)",
          "rgba(249,115,22,0.75)",
          "rgba(239,68,68,0.75)",
        ],
        borderWidth: 0,
      },
    ],
  };

  const lineData = {
    labels: flowOverTime.map((r) => r.t),
    datasets: [
      {
        label: "Flowrate",
        data: flowOverTime.map((r) => r.f),
        borderColor: "rgba(37, 99, 235, 0.9)",
        borderWidth: 2,
        pointRadius: 2,
        fill: false,
      },
    ],
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="charts-header">
        <div>
          <div className="card-title">Summary</div>
          <div className="charts-sub">
            Avg Flowrate: {avg.flowrate_avg?.toFixed(2) ?? "-"} · Pressure:{" "}
            {avg.pressure_avg?.toFixed(2) ?? "-"} · Temp:{" "}
            {avg.temperature_avg?.toFixed(2) ?? "-"}
          </div>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() =>
            navigator.clipboard?.writeText(JSON.stringify(summary || {}, null, 2))
          }
        >
          Copy JSON
        </button>
      </div>

      {/* Grid */}
      <div className="chart-grid">
        {/* BAR */}
        <div>
          <div className="chart-label">Type Distribution</div>
          <div className="chart-box">
            <Bar data={barData} />
          </div>
        </div>

        {/* LINE */}
        <div>
          <div className="chart-label">Flowrate Over Time</div>
          <div className="chart-box">
            {flowOverTime.length === 0 ? (
              <div className="no-data">No timestamped data</div>
            ) : (
              <Line data={lineData} />
            )}
          </div>
        </div>

        {/* PIE */}
        <div className="chart-full">
          <div className="chart-label">Distribution (Pie)</div>
          <div className="pie-wrap">
            <Pie data={pieData} />
          </div>
        </div>
      </div>
    </div>
  );
}
