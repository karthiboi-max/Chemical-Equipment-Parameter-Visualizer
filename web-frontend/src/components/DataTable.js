// src/components/DataTable.js
import React from "react";
import Papa from "papaparse";

export default function DataTable({ csvText }) {
  if (!csvText) return <div>No data loaded.</div>;

  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields || [];
  const data = parsed.data || [];

  if (headers.length === 0 || data.length === 0) return <div>No table data.</div>;

  return (
    <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((row, rIdx) => (
          <tr key={rIdx}>
            {headers.map((h, cIdx) => <td key={cIdx}>{row[h]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
