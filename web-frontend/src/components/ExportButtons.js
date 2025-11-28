// src/components/ExportButtons.jsx
import React from "react";
import { saveAs } from "file-saver";

/**
 * targetSelector: CSS selector to find canvas elements (default: 'canvas')
 * Exports the FIRST matching canvas by default; you can adapt to export all.
 */
export default function ExportButtons({ targetSelector = "canvas" }) {
  function exportCanvas(format = "png") {
    const canvas = document.querySelector(targetSelector);
    if (!canvas) return alert("No chart canvas found to export.");
    try {
      if (format === "svg") {
        // basic fallback: export PNG when SVG not available
        const dataUrl = canvas.toDataURL("image/png");
        saveAs(dataUrlToBlob(dataUrl), "chart.png");
        return;
      }
      const dataUrl = canvas.toDataURL(`image/${format}`);
      saveAs(dataUrlToBlob(dataUrl), `chart.${format}`);
    } catch (e) {
      console.error(e);
      alert("Export failed");
    }
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const mime = parts[0].match(/:(.*?);/)[1];
    const bin = atob(parts[1]);
    const len = bin.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn btn-secondary" onClick={() => exportCanvas("png")}>Export PNG</button>
      <button className="btn" onClick={() => exportCanvas("jpeg")}>Export JPG</button>
      <button className="btn" onClick={() => exportCanvas("svg")}>Export SVG (png fallback)</button>
    </div>
  );
}
