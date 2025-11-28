// src/components/FiltersPanel.jsx
import React, { useMemo } from "react";

export default function FiltersPanel({ filters, setFilters, parsedRows }) {
  // gather unique types for dropdown
  const types = useMemo(() => {
    const s = new Set();
    parsedRows.forEach(r => {
      const t = r.Type || r.type || r.type_name;
      if (t) s.add(t);
    });
    return ["All", ...Array.from(s)];
  }, [parsedRows]);

  return (
    <div className="card">
      <div className="card-title">Filters</div>

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          Date start
          <input type="date" value={filters.startDate} onChange={(e) => setFilters(f => ({...f, startDate: e.target.value}))} />
        </label>

        <label>
          Date end
          <input type="date" value={filters.endDate} onChange={(e) => setFilters(f => ({...f, endDate: e.target.value}))} />
        </label>

        <label>
          Equipment type
          <select value={filters.type} onChange={(e) => setFilters(f => ({...f, type: e.target.value}))}>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label>
          Min Flowrate
          <input type="number" placeholder="e.g. 10" value={filters.minFlow} onChange={(e) => setFilters(f => ({...f, minFlow: e.target.value}))} />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setFilters({ startDate: "", endDate: "", type: "All", minFlow: "" })}>Reset</button>
          <button className="btn" onClick={() => alert("Filters applied")}>Apply</button>
        </div>
      </div>
    </div>
  );
}
