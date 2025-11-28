// src/components/DataTable.jsx
import React, { useMemo, useState, useEffect } from "react";
import Papa from "papaparse";
import { saveAs } from "file-saver";

export default function DataTable({ csvText }) {
  const parsed = useMemo(
    () =>
      csvText
        ? Papa.parse(csvText, { header: true, skipEmptyLines: true })
        : null,
    [csvText]
  );

  const headers = parsed?.meta?.fields || [];
  const rows = parsed?.data || [];

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 12;

  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => setPage(1), [csvText, q, sortBy, sortDir]);

  const filtered = useMemo(() => {
    if (!rows) return [];

    let out = rows;

    if (q) {
      const L = q.toLowerCase();
      out = out.filter((r) =>
        headers.some((h) => String(r[h] ?? "").toLowerCase().includes(L))
      );
    }

    if (sortBy) {
      out = [...out].sort((a, b) => {
        const A = a[sortBy] ?? "";
        const B = b[sortBy] ?? "";
        const nA = parseFloat(A);
        const nB = parseFloat(B);

        if (!Number.isNaN(nA) && !Number.isNaN(nB)) {
          return sortDir === "asc" ? nA - nB : nB - nA;
        }

        return sortDir === "asc"
          ? String(A).localeCompare(String(B))
          : String(B).localeCompare(String(A));
      });
    }

    return out;
  }, [rows, headers, q, sortBy, sortDir]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  if (!csvText)
    return (
      <div className="card">
        <div className="no-data">No data loaded.</div>
      </div>
    );

  if (headers.length === 0)
    return (
      <div className="card">
        <div className="no-data">No table columns.</div>
      </div>
    );

  return (
    <div className="card">
      {/* Header */}
      <div className="table-header">
        <input
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="table-search"
        />

        <button
          className="btn"
          onClick={() =>
            saveAs(new Blob([csvText], { type: "text/csv" }), "export.csv")
          }
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  onClick={() => {
                    if (sortBy === h)
                      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                    else {
                      setSortBy(h);
                      setSortDir("asc");
                    }
                  }}
                >
                  {h}
                  {sortBy === h ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {pageRows.map((r, idx) => (
              <tr key={idx}>
                {headers.map((h, i) => (
                  <td key={i}>{r[h]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="table-footer">
        <div className="table-count">
          Showing {(page - 1) * perPage + 1} -{" "}
          {Math.min(page * perPage, total)} of {total}
        </div>

        <div className="table-pager">
          <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Prev
          </button>
          <span>{page} / {pageCount}</span>
          <button className="btn" onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
