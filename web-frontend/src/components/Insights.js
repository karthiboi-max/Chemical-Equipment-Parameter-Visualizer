// src/components/Insights.jsx
import React, { useMemo } from "react";

// Simple insights computed client-side (no external API)
export default function Insights({ rows, summary }) {
  const insights = useMemo(() => {
    const out = [];
    if (!rows || rows.length === 0) return ["No data to analyze."];

    // compute numeric columns present
    const numericCols = {};
    rows.forEach(r => {
      for (const k of Object.keys(r)) {
        const v = r[k];
        const n = parseFloat(v);
        if (!Number.isNaN(n)) {
          numericCols[k] = numericCols[k] || [];
          numericCols[k].push(n);
        }
      }
    });

    // Variance check (high variance columns)
    const stats = {};
    for (const k of Object.keys(numericCols)) {
      const arr = numericCols[k];
      const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
      const variance = arr.reduce((a,b)=>a+(b-mean)**2,0)/arr.length;
      stats[k] = { mean, variance, count: arr.length };
      if (variance > Math.pow(Math.abs(mean) || 1, 2) * 0.5) {
        out.push(`High variance detected in ${k} (variance=${variance.toFixed(2)}).`);
      }
    }

    // Correlation detection between Flowrate and Pressure/Temperature
    const getCorr = (a, b) => {
      const n = Math.min(a.length, b.length);
      if (n === 0) return 0;
      const ma = a.reduce((s,x)=>s+x,0)/n;
      const mb = b.reduce((s,x)=>s+x,0)/n;
      let num=0, da=0, db=0;
      for (let i=0;i<n;i++){ num += (a[i]-ma)*(b[i]-mb); da += (a[i]-ma)**2; db += (b[i]-mb)**2; }
      const denom = Math.sqrt(da*db);
      return denom === 0 ? 0 : num/denom;
    };

    const flow = numericCols["Flowrate"] || numericCols["flowrate"] || numericCols["flow_rate"] || numericCols["flowRate"] || [];
    const pressure = numericCols["Pressure"] || numericCols["pressure"] || [];
    const temp = numericCols["Temperature"] || numericCols["temperature"] || numericCols["temp"] || [];
    if (flow.length && pressure.length) {
      const c = getCorr(flow, pressure);
      out.push(`Correlation Flowrate ↔ Pressure: ${c.toFixed(2)}.`);
      if (Math.abs(c) > 0.7) out.push(`Strong correlation between Flowrate and Pressure (${c.toFixed(2)}).`);
    }
    if (flow.length && temp.length) {
      const c = getCorr(flow, temp);
      out.push(`Correlation Flowrate ↔ Temperature: ${c.toFixed(2)}.`);
      if (Math.abs(c) > 0.7) out.push(`Strong correlation between Flowrate and Temperature (${c.toFixed(2)}).`);
    }

    // Trend detection (flow increasing/decreasing)
    if (flow.length > 5) {
      // compute slope via linear regression
      const n = flow.length;
      let sumX=0,sumY=0,sumXY=0,sumXX=0;
      for (let i=0;i<n;i++){ sumX += i; sumY += flow[i]; sumXY += i*flow[i]; sumXX += i*i; }
      const slope = (n*sumXY - sumX*sumY)/(n*sumXX - sumX*sumX || 1);
      if (slope > 0.001) out.push("Flowrate shows an upward trend.");
      else if (slope < -0.001) out.push("Flowrate shows a downward trend.");
    }

    if (out.length === 0) out.push("No significant insights detected.");

    return out;
  }, [rows, summary]);

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="card-title">Automated Insights</div>
      <ul>
        {insights.map((ins,i) => <li key={i} style={{ marginBottom: 8 }}>{ins}</li>)}
      </ul>
    </div>
  );
}
