import PDFDocument from "pdfkit";

/**
 * Generate PDF file with professional formatting and summary
 * @param {string} title - Document title
 * @param {Array} rows - Data rows
 * @param {Object} filterInfo - Active filter information
 * @param {Object} res - Express response object
 */
export function generatePDF(title, rows, filterInfo, res) {
  const doc = new PDFDocument({
    margin: 20,
    size: "A4",
    layout: "landscape",
    info: {
      Title: title,
      Author: "Sistem Rekap",
      Subject: "Laporan Data",
      Keywords: "rekap, laporan, export"
    }
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filterInfo.filename || title}.pdf"`
  );

  doc.pipe(res);

  const pageWidth = doc.page.width - 40;
  const leftMargin = 20;

  // ============================================================================
  // HEADER SECTION
  // ============================================================================
  
  let yPosition = 20;

  // Main Title
  doc
    .fontSize(18)
    .fillColor("#000000")
    .font("Helvetica-Bold")
    .text(filterInfo.title || title, leftMargin, yPosition, {
      width: pageWidth,
      align: "center"
    });

  yPosition += 28;

  // Export timestamp
  doc
    .fontSize(10)
    .fillColor("#666666")
    .font("Helvetica")
    .text(
      `Diekspor pada: ${new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).replace(',', ' pukul')}`,
      leftMargin,
      yPosition,
      {
        width: pageWidth,
        align: "center"
      }
    );

  yPosition += 20;

  // Line separator
  doc
    .moveTo(leftMargin, yPosition)
    .lineTo(leftMargin + pageWidth, yPosition)
    .lineWidth(1.5)
    .strokeColor("#000000")
    .stroke();

  yPosition += 15;

  // ============================================================================
  // FILTER INFORMATION SECTION
  // ============================================================================
  if (filterInfo.filters && Object.keys(filterInfo.filters).length > 0) {
    doc
      .fontSize(11)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text("FILTER YANG DITERAPKAN", leftMargin, yPosition);

    yPosition += 18;

    Object.entries(filterInfo.filters).forEach(([key, value]) => {
      doc
        .fontSize(10)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text(`${key}:`, leftMargin + 10, yPosition, { continued: true })
        .font("Helvetica")
        .text(` ${value}`);
      
      yPosition += 16;
    });

    yPosition += 8;

    // Line separator
    doc
      .moveTo(leftMargin, yPosition)
      .lineTo(leftMargin + pageWidth, yPosition)
      .lineWidth(1)
      .strokeColor("#CCCCCC")
      .stroke();

    yPosition += 15;
  }

  // ============================================================================
  // DATA SUMMARY (RECORD COUNT)
  // ============================================================================
  doc
    .fontSize(10)
    .fillColor("#000000")
    .font("Helvetica-Bold")
    .text(
      `Total Data: ${rows.length} record${rows.length !== 1 ? "s" : ""}`,
      leftMargin,
      yPosition,
      {
        width: pageWidth,
        align: "center"
      }
    );

  yPosition += 20;

  // ============================================================================
  // DATA TABLE SECTION
  // ============================================================================
  
  if (rows.length === 0) {
    doc
      .fontSize(12)
      .fillColor("#666666")
      .font("Helvetica")
      .text("Tidak ada data untuk ditampilkan", leftMargin, yPosition, {
        width: pageWidth,
        align: "center"
      });
  } else {
    // Determine columns
    const allColumns = Object.keys(rows[0]);
    
    // Define column configurations - REMOVED unused columns
    const columnConfig = {
      // Order columns
      "no_order": { width: 250, label: "No Order" },
      "tanggal_order": { width: 250, label: "Tanggal Order" },
      "petugas_order": { width: 280, label: "Petugas" },
      "petugas": { width: 280, label: "Petugas" },
      "kendaraan": { width: 270, label: "Kendaraan" },
      "kendaraan_nama": { width: 270, label: "Kendaraan" },
      "supir": { width: 270, label: "Supir" },
      "supir_nama": { width: 270, label: "Supir" },
      "galian": { width: 280, label: "Galian" },
      "galian_nama": { width: 280, label: "Galian" },
      "no_do": { width: 245, label: "No DO" },
      "jam_order": { width: 250, label: "Jam Order" },
      "km_awal": { width: 300, label: "KM Awal" },
      "uang_jalan": { width: 350, label: "Uang Jalan" },
      "potongan": { width: 350, label: "Potongan" },
      "hasil_akhir": { width: 350, label: "Hasil Akhir" },
      "proyek_input": { width: 300, label: "Proyek" },
      "proyek": { width: 300, label: "Proyek" },
      "status": { width: 300, label: "Status" },

      // Buangan columns
      "tanggal_bongkar": { width: 250, label: "Tgl Bongkar" },
      "jam_bongkar": { width: 250, label: "Jam Bongkar" },
      "km_akhir": { width: 300, label: "KM Akhir" },
      "jarak_km": { width: 300, label: "Jarak KM" },
      "alihan": { width: 300, label: "Alihan" },
      "galian_alihan": { width: 280, label: "Galian Alihan" },
      "galian_alihan_nama": { width: 280, label: "Galian Alihan" },
      "keterangan": { width: 400, label: "Keterangan" },
      "uang_alihan": { width: 350, label: "Uang Alihan" },
      "no_urut": { width: 220, label: "No Urut" }
    };

    // Get columns to display (exclude internal IDs)
    const columns = allColumns.filter(key => {
      // Exclude ID columns
      if (key.endsWith("_id") || key === "id" || key === "no") return false;
      // Exclude unused columns
      if (key === "total_ritasi" || key === "total_tonase" || 
          key === "nilai_bayaran" || key === "order_id" ||
          key === "jam_buang") return false;
      return true;
    });

    // Calculate total width and adjust if needed
    const totalWidth = columns.reduce((sum, col) => {
      return sum + (columnConfig[col]?.width || 70);
    }, 0);

    // Scale widths if total exceeds page width
    const scale = totalWidth > pageWidth ? pageWidth / totalWidth : 1;

    // Function to draw table header
    const drawTableHeader = (y) => {
      let xPos = leftMargin;
      
      doc
        .fontSize(9)
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold");

      // Draw header background
      doc
        .rect(leftMargin, y, pageWidth, 30)
        .fillColor("#1F4788")
        .fill();

      doc.fillColor("#FFFFFF");

      columns.forEach((col) => {
        const config = columnConfig[col] || { width: 70, label: col };
        const width = config.width * scale;
        const label = config.label;
        
        doc.text(label, xPos + 4, y + 8, {
          width: width - 8,
          align: "center",
          lineBreak: false,
          ellipsis: true
        });
        
        xPos += width;
      });

      const headerBottom = y + 30;
      doc
        .moveTo(leftMargin, headerBottom)
        .lineTo(leftMargin + pageWidth, headerBottom)
        .lineWidth(1.5)
        .strokeColor("#000000")
        .stroke();

      return headerBottom + 4;
    };

    // Draw initial header
    yPosition = drawTableHeader(yPosition);

    // Table rows
    doc.fontSize(8.5).font("Helvetica");

    rows.forEach((row, rowIndex) => {
      const rowHeight = 35; // Increased to allow text wrapping

      // Check if need new page
      if (yPosition + rowHeight > doc.page.height - 80) {
        doc.addPage();
        yPosition = 20;
        yPosition = drawTableHeader(yPosition);
        doc.fontSize(8.5).font("Helvetica");
      }

      let xPos = leftMargin;

      // Alternating row background
      if (rowIndex % 2 === 1) {
        doc
          .rect(leftMargin, yPosition, pageWidth, rowHeight)
          .fillColor("#F5F5F5")
          .fill();
      }

      // Row data
      columns.forEach((col) => {
        const config = columnConfig[col] || { width: 70 };
        const width = config.width * scale;
        let value = row[col];

        // Format values
        if (col.includes("tanggal") && value) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            value = date.toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            });
          }
        } else if (
          (col.includes("uang") ||
           col.includes("hasil") ||
           col.includes("potongan")) &&
          value !== null &&
          value !== undefined
        ) {
          const numValue = parseInt(value);
          value = "Rp " + numValue.toLocaleString("id-ID");
        } else if (
          (col.includes("km") || col.includes("jarak")) &&
          value !== null &&
          value !== undefined &&
          value !== 0
        ) {
          const numValue = parseInt(value);
          value = numValue.toLocaleString("id-ID");
        } else if (col === "alihan") {
          value = value ? "Ya" : "Tidak";
        } else if (col === "status") {
          value = (value || "").toUpperCase();
        }

        // Text color and font based on status
        let textColor = "#000000";
        let fontStyle = "Helvetica";
        if (col === "status" && value) {
          if (value === "COMPLETE") {
            textColor = "#008000";
            fontStyle = "Helvetica-Bold";
          } else if (value === "ON PROCESS" || value === "ON_PROCESS") {
            textColor = "#FF8C00";
            fontStyle = "Helvetica-Bold";
          }
        }

        // Determine alignment
        const align = (col.includes("uang") ||
                       col.includes("hasil") ||
                       col.includes("potongan") ||
                       col.includes("km") ||
                       col.includes("jarak")) ? "right" :
                      (col === "no_urut" || col === "alihan") ? "center" : "left";

        doc
          .fillColor(textColor)
          .font(fontStyle)
          .text(value || "-", xPos + 4, yPosition + 6, {
            width: width - 8,
            height: rowHeight - 6,
            align: align,
            lineBreak: true,
            ellipsis: false
          });

        xPos += width;
      });

      yPosition += rowHeight;
    });

    // ============================================================================
    // FINANCIAL SUMMARY SECTION (AT THE END)
    // ============================================================================
    const summary = calculateSummary(rows, title);

    if (summary && Object.keys(summary).length > 0) {
      yPosition += 25;

      // Check if need new page for summary
      if (yPosition + 120 > doc.page.height - 40) {
        doc.addPage();
        yPosition = 20;
      }

      // Line separator before summary
      doc
        .moveTo(leftMargin, yPosition)
        .lineTo(leftMargin + pageWidth, yPosition)
        .lineWidth(1.5)
        .strokeColor("#000000")
        .stroke();

      yPosition += 15;

      // Summary Title
      doc
        .fontSize(12)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text("RINGKASAN KEUANGAN", leftMargin, yPosition);

      yPosition += 20;

      // Summary box
      const summaryBoxWidth = 350;
      const summaryBoxX = leftMargin + (pageWidth - summaryBoxWidth) / 2;

      Object.entries(summary).forEach(([key, value]) => {
        const isGrandTotal = key === "Grand Total";
        
        if (isGrandTotal) {
          // Draw line before grand total
          doc
            .moveTo(summaryBoxX, yPosition)
            .lineTo(summaryBoxX + summaryBoxWidth, yPosition)
            .lineWidth(1.5)
            .strokeColor("#000000")
            .stroke();
          yPosition += 12;

          // Draw grand total background
          doc
            .rect(summaryBoxX, yPosition - 2, summaryBoxWidth, 28)
            .fillColor("#1F4788")
            .fill();
        } else {
          // Draw normal item background
          doc
            .rect(summaryBoxX, yPosition - 2, summaryBoxWidth, 24)
            .fillColor("#F0F0F0")
            .fill();
        }

        doc
          .fontSize(isGrandTotal ? 11 : 10)
          .fillColor(isGrandTotal ? "#FFFFFF" : "#000000")
          .font("Helvetica-Bold")
          .text(key, summaryBoxX + 10, yPosition + 4, { 
            continued: true,
            width: summaryBoxWidth / 2 - 20
          })
          .font(isGrandTotal ? "Helvetica-Bold" : "Helvetica")
          .text(value, {
            width: summaryBoxWidth / 2 - 20,
            align: "right"
          });
        
        yPosition += isGrandTotal ? 30 : 26;
      });
    }
  }

  // ============================================================================
  // FOOTER SECTION
  // ============================================================================
  
  const footerY = doc.page.height - 35;
  
  doc
    .moveTo(leftMargin, footerY)
    .lineTo(leftMargin + pageWidth, footerY)
    .lineWidth(1)
    .strokeColor("#CCCCCC")
    .stroke();

  doc
    .fontSize(8)
    .fillColor("#666666")
    .font("Helvetica-Oblique")
    .text(
      `Generated by Sistem Rekap - ${new Date().getFullYear()}`,
      leftMargin,
      footerY + 5,
      {
        width: pageWidth,
        align: "center"
      }
    );
  
  doc.end();
}

/**
 * Calculate summary based on report type
 * @param {Array} rows - Data rows
 * @param {string} title - Report title
 * @returns {Object} Summary object
 */
function calculateSummary(rows, title) {
  if (!rows || rows.length === 0) return {};

  const summary = {};
  const titleLower = title.toLowerCase();

  // Rekap Order
  if (titleLower.includes("order") && !titleLower.includes("gabungan")) {
    let totalUangJalan = 0;
    let totalPotongan = 0;
    let totalHasilAkhir = 0;

    rows.forEach(row => {
      totalUangJalan += parseFloat(row.uang_jalan || 0);
      totalPotongan += parseFloat(row.potongan || 0);
      totalHasilAkhir += parseFloat(row.hasil_akhir || 0);
    });

    summary["Total Uang Jalan"] = `Rp ${totalUangJalan.toLocaleString("id-ID")}`;
    summary["Total Potongan"] = `Rp ${totalPotongan.toLocaleString("id-ID")}`;
    summary["Grand Total"] = `Rp ${totalHasilAkhir.toLocaleString("id-ID")}`;
  }
  // Rekap Buangan
  else if (titleLower.includes("buangan")) {
    let totalUangAlihan = 0;

    rows.forEach(row => {
      totalUangAlihan += parseFloat(row.uang_alihan || 0);
    });

    summary["Grand Total"] = `Rp ${totalUangAlihan.toLocaleString("id-ID")}`;
  }
  // Rekap Gabungan
  else if (titleLower.includes("gabungan")) {
    let totalUangJalan = 0;
    let totalPotongan = 0;
    let totalHasilAkhir = 0;
    let totalUangAlihan = 0;

    rows.forEach(row => {
      totalUangJalan += parseFloat(row.uang_jalan || 0);
      totalPotongan += parseFloat(row.potongan || 0);
      totalHasilAkhir += parseFloat(row.hasil_akhir || 0);
      totalUangAlihan += parseFloat(row.uang_alihan || 0);
    });

    summary["Total Uang Jalan"] = `Rp ${totalUangJalan.toLocaleString("id-ID")}`;
    summary["Total Potongan"] = `Rp ${totalPotongan.toLocaleString("id-ID")}`;
    summary["Total Uang Alihan"] = `Rp ${totalUangAlihan.toLocaleString("id-ID")}`;
    summary["Grand Total"] = `Rp ${(totalHasilAkhir + totalUangAlihan).toLocaleString("id-ID")}`;
  }

  return summary;
}