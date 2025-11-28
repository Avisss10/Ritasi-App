import PDFDocument from "pdfkit";

/**
 * Generate PDF file with professional formatting
 * @param {string} title - Document title
 * @param {Array} rows - Data rows
 * @param {Object} filterInfo - Active filter information
 * @param {Object} res - Express response object
 */
export function generatePDF(title, rows, filterInfo, res) {
  const doc = new PDFDocument({
    margin: 15,
    size: "A3", // Changed to A3 for more space
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

  const pageWidth = doc.page.width - 30;
  const leftMargin = 15;

  // ============================================================================
  // HEADER SECTION
  // ============================================================================
  
  let yPosition = 15;

  // Main Title
  doc
    .fontSize(16)
    .fillColor("#000000")
    .font("Helvetica-Bold")
    .text(filterInfo.title || title, leftMargin, yPosition, {
      width: pageWidth,
      align: "center"
    });

  yPosition += 24;

  // Export timestamp
  doc
    .fontSize(9)
    .fillColor("#000000")
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

  yPosition += 18;

  // Line separator
  doc
    .moveTo(leftMargin, yPosition)
    .lineTo(leftMargin + pageWidth, yPosition)
    .lineWidth(1)
    .strokeColor("#000000")
    .stroke();

  yPosition += 12;

  // ============================================================================
  // FILTER INFORMATION SECTION
  // ============================================================================
  if (filterInfo.filters && Object.keys(filterInfo.filters).length > 0) {
    doc
      .fontSize(10)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text("FILTER YANG DITERAPKAN", leftMargin, yPosition);

    yPosition += 15;

    Object.entries(filterInfo.filters).forEach(([key, value]) => {
      doc
        .fontSize(9)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text(`${key}:`, leftMargin + 5, yPosition, { continued: true })
        .font("Helvetica")
        .text(` ${value}`);
      
      yPosition += 14;
    });

    yPosition += 5;

    // Line separator
    doc
      .moveTo(leftMargin, yPosition)
      .lineTo(leftMargin + pageWidth, yPosition)
      .lineWidth(0.8)
      .strokeColor("#000000")
      .stroke();

    yPosition += 12;
  }

  // ============================================================================
  // SUMMARY SECTION
  // ============================================================================
  doc
    .fontSize(9)
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

  yPosition += 18;

  // ============================================================================
  // DATA TABLE SECTION
  // ============================================================================
  
  if (rows.length === 0) {
    doc
      .fontSize(11)
      .fillColor("#000000")
      .font("Helvetica")
      .text("Tidak ada data untuk ditampilkan", leftMargin, yPosition, {
        width: pageWidth,
        align: "center"
      });
  } else {
    // Determine columns - KEEP ALL COLUMNS, don't filter any
    const allColumns = Object.keys(rows[0]);
    
    // Define column configurations with optimized widths for A3 landscape
    const columnConfig = {
      // Order columns
      "id": { width: 30, label: "ID" },
      "tanggal_order": { width: 70, label: "Tanggal Order" },
      "no_order": { width: 65, label: "No Order" },
      "petugas_order": { width: 75, label: "Petugas Order" },
      "petugas": { width: 75, label: "Petugas" },
      "kendaraan": { width: 75, label: "Kendaraan" },
      "kendaraan_nama": { width: 75, label: "Kendaraan" },
      "supir": { width: 70, label: "Supir" },
      "supir_nama": { width: 70, label: "Supir" },
      "galian": { width: 75, label: "Galian" },
      "galian_nama": { width: 75, label: "Galian" },
      "no_do": { width: 65, label: "No DO" },
      "jam_order": { width: 60, label: "Jam Order" },
      "km_awal": { width: 55, label: "Km Awal" },
      "uang_jalan": { width: 75, label: "Uang Jalan" },
      "potongan": { width: 70, label: "Potongan" },
      "hasil_akhir": { width: 75, label: "Hasil Akhir" },
      "proyek_input": { width: 85, label: "Proyek Input" },
      "proyek": { width: 85, label: "Proyek" },
      "status": { width: 70, label: "Status" },
      
      // Buangan columns
      "tanggal_bongkar": { width: 70, label: "Tgl Bongkar" },
      "jam_bongkar": { width: 60, label: "Jam Bongkar" },
      "km_akhir": { width: 55, label: "Km Akhir" },
      "jarak_km": { width: 55, label: "Jarak Km" },
      "alihan": { width: 50, label: "Alihan" },
      "galian_alihan": { width: 75, label: "Galian Alihan" },
      "galian_alihan_nama": { width: 75, label: "Galian Alihan" },
      "keterangan": { width: 100, label: "Keterangan" },
      "uang_alihan": { width: 75, label: "Uang Alihan" },
      "no_urut": { width: 55, label: "No Urut" },
      
      // Gabungan columns
      "order_id": { width: 50, label: "Order ID" },
      "total_ritasi": { width: 65, label: "Total Ritasi" },
      "total_tonase": { width: 70, label: "Total Tonase" },
      "nilai_bayaran": { width: 75, label: "Nilai Bayaran" }
    };

    // Get columns to display (exclude internal IDs but keep order_id for gabungan)
    const columns = allColumns.filter(key => {
      if (key === "order_id") return true; // Keep order_id for rekap gabungan
      if (key.endsWith("_id") || key === "id") return false;
      return true;
    });

    // Calculate total width and adjust if needed
    const totalWidth = columns.reduce((sum, col) => {
      return sum + (columnConfig[col]?.width || 60);
    }, 0);

    // Scale widths if total exceeds page width
    const scale = totalWidth > pageWidth ? pageWidth / totalWidth : 1;

    // Function to draw table header
    const drawTableHeader = (y) => {
      let xPos = leftMargin;
      
      doc
        .fontSize(9) // Increased from 7 to 9
        .fillColor("#000000")
        .font("Helvetica-Bold");

      columns.forEach((col) => {
        const config = columnConfig[col] || { width: 60, label: col };
        const width = config.width * scale;
        const label = config.label;
        
        // Draw header text with proper wrapping
        doc.text(label, xPos + 3, y + 3, {
          width: width - 6,
          align: "center",
          lineBreak: true,
          height: 20
        });
        
        xPos += width;
      });

      // Draw line below header
      const headerBottom = y + 24;
      doc
        .moveTo(leftMargin, headerBottom)
        .lineTo(leftMargin + pageWidth, headerBottom)
        .lineWidth(1)
        .strokeColor("#000000")
        .stroke();

      return headerBottom + 3;
    };

    // Draw initial header
    yPosition = drawTableHeader(yPosition);

    // Table rows - INCREASED FONT SIZE
    doc.fontSize(8).font("Helvetica"); // Increased from 6.5 to 8

    rows.forEach((row, rowIndex) => {
      // Calculate row height based on content
      let maxLines = 1;
      columns.forEach((col) => {
        let value = row[col];
        if (value && typeof value === "string") {
          const config = columnConfig[col] || { width: 60 };
          const width = (config.width * scale) - 6;
          const textWidth = doc.widthOfString(value);
          const lines = Math.ceil(textWidth / width);
          if (lines > maxLines) maxLines = lines;
        }
      });
      
      const rowHeight = Math.max(16, maxLines * 9 + 6); // Increased minimum height

      // Check if need new page
      if (yPosition + rowHeight > doc.page.height - 40) {
        doc.addPage();
        yPosition = 15;
        yPosition = drawTableHeader(yPosition);
        doc.fontSize(8).font("Helvetica"); // Keep consistent font size
      }

      let xPos = leftMargin;

      // Row data
      columns.forEach((col) => {
        const config = columnConfig[col] || { width: 60 };
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
           col.includes("potongan") ||
           col.includes("nilai") ||
           col.includes("bayaran")) &&
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
            textColor = "#006600";
            fontStyle = "Helvetica-Bold";
          } else if (value === "ON PROCESS" || value === "ON_PROCESS") {
            textColor = "#CC6600";
            fontStyle = "Helvetica-Bold";
          }
        }

        // Determine alignment
        const align = (col.includes("uang") || 
                       col.includes("hasil") || 
                       col.includes("potongan") ||
                       col.includes("nilai") ||
                       col.includes("bayaran") ||
                       col.includes("km") ||
                       col.includes("jarak") ||
                       col.includes("ritasi") ||
                       col.includes("tonase")) ? "right" : 
                      (col === "id" || col === "order_id" || col === "no_urut") ? "center" : "left";

        doc
          .fillColor(textColor)
          .font(fontStyle)
          .text(value || "-", xPos + 3, yPosition + 3, {
            width: width - 6,
            height: rowHeight - 3,
            align: align,
            lineBreak: true,
            ellipsis: true
          });
        
        xPos += width;
      });

      yPosition += rowHeight;

      // Draw subtle line every 3 rows
      if ((rowIndex + 1) % 3 === 0 && rowIndex < rows.length - 1) {
        doc
          .moveTo(leftMargin, yPosition)
          .lineTo(leftMargin + pageWidth, yPosition)
          .lineWidth(0.3)
          .strokeColor("#CCCCCC")
          .stroke();
      }
    });
  }

  // ============================================================================
  // FOOTER SECTION
  // ============================================================================
  
  // Draw footer on bottom of last page
  const footerY = doc.page.height - 30;
  
  doc
    .moveTo(leftMargin, footerY)
    .lineTo(leftMargin + pageWidth, footerY)
    .lineWidth(0.8)
    .strokeColor("#000000")
    .stroke();
  doc.end();
}