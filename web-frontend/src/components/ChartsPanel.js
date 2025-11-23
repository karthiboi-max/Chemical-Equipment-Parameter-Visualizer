// ChartsPanel.js
import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function ChartsPanel({ summary }) {
  if (!summary) return null;

  const typeDist = summary.type_distribution || {};
  const labels = Object.keys(typeDist);
  const counts = Object.values(typeDist);

  const data = {
    labels,
    datasets: [
      {
        label: "Equipment Count",
        data: counts,
        backgroundColor: "rgba(75,192,192,0.6)",
      },
    ],
  };

  const avg = summary.averages || {};

  const avgText = `Avg Flowrate: ${avg.flowrate_avg?.toFixed(2) || 0}, Pressure: ${
    avg.pressure_avg?.toFixed(2) || 0
  }, Temperature: ${avg.temperature_avg?.toFixed(2) || 0}`;

 /* <Pie
  data={{
    labels: Object.keys(summary.type_distribution || {}),
    datasets: [
      {
        data: Object.values(summary.type_distribution || {}),
      }
    ]
  }}
/> */

  return (
    <div>
      <h3>Summary</h3>
      <p>{avgText}</p>

      <div style={{ width: "600px", maxWidth: "100%" }}>
        <Bar data={data} />
      </div>
    </div>
  );
}
