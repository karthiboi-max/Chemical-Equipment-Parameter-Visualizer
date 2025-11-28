// src/components/ReportGenerator.jsx
import React from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * ReportGenerator
 * Props:
 *  - containerSelector (string): DOM selector for the dashboard area to snapshot (default: '#root' or '.App')
 *  - metadata (object): optional dataset metadata to include in PDF
 */
export default function ReportGenerator({ containerSelector = ".App", metadata = {} }) {
  async function buildPdf() {
    try {
      const el = document.querySelector(containerSelector);
      if (!el) return alert("Dashboard area not found for PDF export.");

      // Use html2canvas to capture the dashboard area
      const originalBg = el.style.backgroundColor;
      el.style.backgroundColor = "#ffffff"; // ensure white background for PDF

      // Increase resolution for better quality
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });

      el.style.backgroundColor = originalBg;

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // scale canvas to fit pdf page while preserving aspect ratio
      const imgProps = canvas;
      const imgW = pdfWidth - 40; // margin
      const imgH = (canvas.height * imgW) / canvas.width;

      pdf.setFontSize(14);
      pdf.text("Chemical Equipment Parameter Visualizer - Report", 20, 30);
      // Metadata
      pdf.setFontSize(10);
      let y = 48;
      if (metadata && Object.keys(metadata).length) {
        pdf.text(`Dataset: ${metadata.file_name || "N/A"}`, 20, y); y += 14;
        pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, y); y += 18;
      } else {
        pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, y); y += 18;
      }

      // Add image below header
      pdf.addImage(imgData, "PNG", 20, y + 4, imgW, imgH);

      // If content exceeds single page, add extra pages (very large canvas)
      const remainingHeight = imgH - (pdfHeight - (y + 30));
      if (remainingHeight > 0) {
        // split long image into pages
        let position = 0;
        let pageCount = Math.ceil(imgH / pdfHeight);
        let srcImg = imgData;

        // Fallback simple method: add the same image on multiple pages with shifted Y
        for (let i = 1; i <= pageCount; i++) {
          if (i === 1) continue;
          pdf.addPage();
          const yPos = - (pdfHeight - 80) * (i - 1);
          pdf.addImage(imgData, "PNG", 20, yPos + 20, imgW, imgH);
        }
      }

      pdf.save(`report_${(metadata.file_name || "dataset").replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      console.error("PDF generation error", e);
      alert("Failed to generate PDF. See console.");
    }
  }

  return (
    <button className="btn btn-primary" onClick={buildPdf}>
      Export PDF Report
    </button>
  );
}
