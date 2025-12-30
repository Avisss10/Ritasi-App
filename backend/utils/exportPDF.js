import PDFDocument from "pdfkit";

/**
 * Generate descriptive filename based on filter info
 * @param {string} baseName - Base filename
 * @param {Object} filterInfo - Filter information
 * @returns {string} Formatted filename
 */
function generateFilename(baseName, filterInfo) {
  let filename = baseName;
  const filterParts = [];
  
  if (filterInfo.filters) {
    // Prioritize date range filters first
    if (filterInfo.filters["Periode"]) {
      const period = filterInfo.filters["Periode"];
      const cleanPeriod = period
        .replace(/s\/d/g, '_sd_')
        .replace(/\//g, '-')
        .replace(/\s+/g, '_');
      filterParts.push(`Periode_${cleanPeriod}`);
    }
    
    if (filterInfo.filters["Periode Order"]) {
      const period = filterInfo.filters["Periode Order"];
      const cleanPeriod = period
        .replace(/s\/d/g, '_sd_')
        .replace(/\//g, '-')
        .replace(/\s+/g, '_');
      filterParts.push(`Order_${cleanPeriod}`);
    }
    
    if (filterInfo.filters["Periode Bongkar"]) {
      const period = filterInfo.filters["Periode Bongkar"];
      const cleanPeriod = period
        .replace(/s\/d/g, '_sd_')
        .replace(/\//g, '-')
        .replace(/\s+/g, '_');
      filterParts.push(`Bongkar_${cleanPeriod}`);
    }
    
    // Add other important filters (limit to 3 most relevant)
    const priorityFilters = ["Proyek", "Lokasi Bongkar", "Kendaraan", "Supir", "Galian", "Status", "Galian Alihan"];
    let addedCount = 0;
    
    priorityFilters.forEach(filterKey => {
      if (addedCount < 3 && filterInfo.filters[filterKey]) {
        const value = filterInfo.filters[filterKey];
        const cleanValue = value
          .replace(/[<>:"/\\|?*]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 20);
        filterParts.push(`${filterKey.replace(/\s+/g, '_')}_${cleanValue}`);
        addedCount++;
      }
    });
  }
  
  // Combine all parts
  if (filterParts.length > 0) {
    const filterString = filterParts.join('_').substring(0, 80);
    filename = `${baseName}_${filterString}`;
  }
  
  // Add timestamp for uniqueness
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  filename = `${filename}_${timestamp}`;
  
  return filename.replace(/\s+/g, '_');
}

// Helper: Format nilai KM - dengan format biasa, 0 tetap 0
function formatKM(value) {
  if (value === null || value === undefined || value === "") {
    return "0";
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return value;
  }
  return numValue.toLocaleString("id-ID");
}

// Helper: Format teks agar tidak ada titik-titik jika tidak muat
function formatText(value, maxLength) {
  if (!value) return "";
  const strValue = String(value);
  if (strValue.length <= maxLength) return strValue;
  return strValue.substring(0, maxLength);
}

/**
 * Generate PDF file with professional formatting and summary
 * @param {string} title - Document title
 * @param {Array} rows - Data rows
 * @param {Object} filterInfo - Active filter information
 * @param {Object} res - Express response object
 */
export function generatePDF(title, rows, filterInfo, res) {
  const isGabungan = title.includes("GABUNGAN");
  const isOrder = title.includes("ORDER") && !isGabungan;
  const isBuangan = title.includes("BUANGAN");
  
  const doc = new PDFDocument({
    margin: 20,
    size: "A4",
    layout: isGabungan ? "landscape" : "portrait",
    info: {
      Title: title,
      Author: "Sistem Rekap",
      Subject: "Laporan Data",
      Keywords: "rekap, laporan, export"
    }
  });

  res.setHeader("Content-Type", "application/pdf");
  
  // Generate descriptive filename
  const exportFilename = generateFilename(filterInfo.filename || title, filterInfo);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${exportFilename}.pdf"`
  );

  doc.pipe(res);

  const pageWidth = doc.page.width - 40;
  const leftMargin = 20;

  // ======================================================================
  // HEADER
  // ======================================================================
  let yPosition = 20;

  doc
    .fontSize(16)
    .fillColor("#000000")
    .font("Helvetica-Bold")
    .text(title, leftMargin, yPosition, {
      width: pageWidth,
      align: "center"
    });

  yPosition += 25;

  doc
    .fontSize(9)
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

  yPosition += 15;

  doc
    .moveTo(leftMargin, yPosition)
    .lineTo(leftMargin + pageWidth, yPosition)
    .lineWidth(1.5)
    .strokeColor("#000000")
    .stroke();

  yPosition += 15;

  // ======================================================================
  // FILTER INFO
  // ======================================================================
  if (filterInfo && filterInfo.filters && Object.keys(filterInfo.filters).length > 0) {
    doc
      .fontSize(10)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text("FILTER YANG DITERAPKAN:", leftMargin, yPosition);

    yPosition += 15;

    const filters = Object.entries(filterInfo.filters);
    const colWidth = pageWidth / 2 - 10;
    
    filters.forEach(([key, value], index) => {
      if (value !== undefined && value !== null && value !== '') {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const xPos = leftMargin + 10 + (col * colWidth);
        const yPos = yPosition + (row * 14);
        
        doc
          .fontSize(9)
          .fillColor("#000000")
          .font("Helvetica-Bold")
          .text(`${key}:`, xPos, yPos, { continued: true })
          .font("Helvetica")
          .text(` ${value}`);
      }
    });

    const filterRows = Math.ceil(filters.length / 2);
    yPosition += (filterRows * 14) + 10;

    doc
      .moveTo(leftMargin, yPosition)
      .lineTo(leftMargin + pageWidth, yPosition)
      .lineWidth(0.8)
      .strokeColor("#CCCCCC")
      .stroke();

    yPosition += 10;
  }

  // ======================================================================
  // SUMMARY COUNT
  // ======================================================================
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

  yPosition += 20;

// ======================================================================
// SUMMARY STATS (untuk Gabungan)
// ======================================================================
if (filterInfo && filterInfo.stats && title.includes('GABUNGAN')) {
  // Check if we need space
  if (yPosition + 80 > doc.page.height - 60) {
    doc.addPage({
      margin: 20,
      size: "A4",
      layout: isGabungan ? "landscape" : "portrait"
    });
    yPosition = 20;
  }

  doc
    .fontSize(11)
    .fillColor("#000000")
    .font("Helvetica-Bold")
    .text("STATISTIK DATA", leftMargin, yPosition, {
      width: pageWidth,
      align: "center"
    });

  yPosition += 18;

  const statsData = [
    { label: 'Total Data', value: filterInfo.stats.total || 0, color: '#000000' },
    { label: 'Complete', value: filterInfo.stats.complete || 0, color: '#28a745' },
    { label: 'On Process', value: filterInfo.stats.process || 0, color: '#ffc107' },
    { label: 'Batal', value: filterInfo.stats.batal || 0, color: '#dc3545' }
  ];

  const boxWidth = (pageWidth - 30) / 4;
  const boxHeight = 40;
  let xPos = leftMargin;

  statsData.forEach((stat, index) => {
    // Box background
    doc
      .rect(xPos, yPosition, boxWidth, boxHeight)
      .fillColor("#F8F9FA")
      .fill();
    
    // Box border
    doc
      .rect(xPos, yPosition, boxWidth, boxHeight)
      .strokeColor("#CCCCCC")
      .lineWidth(1)
      .stroke();

    // Label (tanpa icon)
    doc
      .fontSize(8)
      .fillColor("#666666")
      .font("Helvetica")
      .text(stat.label, xPos + 5, yPosition + 10, {
        width: boxWidth - 10,
        align: "center"
      });

    // Value with color
    doc
      .fontSize(12)
      .fillColor(stat.color)
      .font("Helvetica-Bold")
      .text(String(stat.value), xPos + 5, yPosition + 22, {
        width: boxWidth - 10,
        align: "center"
      });

    xPos += boxWidth + 7.5;
  });

  yPosition += boxHeight + 15;

  // Bottom line separator
  doc
    .moveTo(leftMargin, yPosition)
    .lineTo(leftMargin + pageWidth, yPosition)
    .lineWidth(0.8)
    .strokeColor("#CCCCCC")
    .stroke();

  yPosition += 15;
}

  // ======================================================================
  // DATA TABLE - SEMUA DATA CENTER
  // ======================================================================
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
    let columns = [];
    let columnConfig = {};

    if (isGabungan) {
      columns = [
        "row_number", "no_order", "tanggal_order", "petugas", "galian",
        "galian_alihan", "no_do", "kendaraan", "supir", "jam_order",
        "km_awal", "tanggal_bongkar", "jam_bongkar", "km_akhir", 
        "jarak_km", "uang_jalan", "potongan", "total", "proyek",
        "buangan", "uang_alihan", "keterangan", "status"
      ];
      
      columnConfig = {
        "row_number": { width: 25, label: "No" },
        "no_order": { width: 40, label: "No Order" },
        "tanggal_order": { width: 45, label: "Tgl Order" },
        "petugas": { width: 40, label: "Petugas" },
        "galian": { width: 40, label: "Galian" },
        "galian_alihan": { width: 45, label: "Galian Alihan" },
        "no_do": { width: 35, label: "No DO" },
        "kendaraan": { width: 40, label: "Kendaraan" },
        "supir": { width: 40, label: "Supir" },
        "jam_order": { width: 35, label: "Jam Order" },
        "km_awal": { width: 35, label: "KM Awal" },
        "tanggal_bongkar": { width: 45, label: "Tgl Bongkar" },
        "jam_bongkar": { width: 35, label: "Jam Bongkar" },
        "km_akhir": { width: 35, label: "KM Akhir" },
        "jarak_km": { width: 35, label: "Jarak KM" },
        "uang_jalan": { width: 45, label: "Uang Jalan" },
        "potongan": { width: 40, label: "Potongan" },
        "total": { width: 45, label: "Total" },
        "proyek": { width: 50, label: "Proyek" },
        "buangan": { width: 50, label: "Buangan (Lokasi)" },
        "uang_alihan": { width: 45, label: "Uang Alihan" },
        "keterangan": { width: 60, label: "Keterangan" },
        "status": { width: 35, label: "Status" }
      };
      
    } else if (isOrder) {
      columns = Object.keys(rows[0]).filter(key => !key.toLowerCase().includes('id'));
      
      if (!columns.includes("no") && !columns.includes("no_urut")) {
        columns.unshift("row_number");
      }
      
      columnConfig = {
        "row_number": { width: 30, label: "No" },
        "no": { width: 35, label: "No" },
        "no_urut": { width: 35, label: "No" },
        "tanggal_order": { width: 55, label: "Tgl Order" },
        "no_order": { width: 60, label: "No Order" },
        "petugas_order": { width: 55, label: "Petugas" },
        "kendaraan_nama": { width: 55, label: "Kendaraan" },
        "kendaraan": { width: 55, label: "Kendaraan" },
        "supir_nama": { width: 55, label: "Supir" },
        "supir": { width: 55, label: "Supir" },
        "galian_nama": { width: 60, label: "Galian" },
        "galian": { width: 60, label: "Galian" },
        "no_do": { width: 45, label: "No DO" },
        "jam_order": { width: 40, label: "Jam Order" },
        "km_awal": { width: 40, label: "KM Awal" },
        "uang_jalan": { width: 50, label: "Uang Jalan" },
        "potongan": { width: 45, label: "Potongan" },
        "hasil_akhir": { width: 50, label: "Hasil Akhir" },
        "proyek_input": { width: 55, label: "Proyek" },
        "proyek": { width: 55, label: "Proyek" },
        "status": { width: 45, label: "Status" },
        "keterangan_buangan": { width: 60, label: "Keterangan" }
      };
      
    } else if (isBuangan) {
      columns = Object.keys(rows[0]).filter(key => !key.toLowerCase().includes('id'));
      
      if (!columns.includes("no") && !columns.includes("no_urut")) {
        columns.unshift("row_number");
      }
      
      columnConfig = {
        "row_number": { width: 30, label: "No" },
        "no": { width: 35, label: "No" },
        "no_urut": { width: 35, label: "No" },
        "tanggal_order": { width: 55, label: "Tgl Order" },
        "no_order": { width: 60, label: "No Order" },
        "tanggal_bongkar": { width: 55, label: "Tgl Bongkar" },
        "jam_bongkar": { width: 40, label: "Jam Bongkar" },
        "km_akhir": { width: 40, label: "KM Akhir" },
        "jarak_km": { width: 35, label: "Jarak" },
        "lokasi_bongkar": { width: 65, label: "Buangan (Lokasi)" },
        "alihan": { width: 35, label: "Alihan" },
        "galian_alihan_nama": { width: 65, label: "Galian Alihan" },
        "galian_alihan": { width: 65, label: "Galian Alihan" },
        "keterangan": { width: 60, label: "Keterangan" },
        "uang_alihan": { width: 50, label: "Uang Alihan" },
        "urut_buangan": { width: 35, label: "No Urut" }
      };
    }

    // Compute total width and scaling
    const totalWidth = columns.reduce((sum, col) => {
      return sum + (columnConfig[col]?.width || 60);
    }, 0);

    const scale = totalWidth > pageWidth ? pageWidth / totalWidth : 1;

    const drawTableHeader = (y) => {
      let xPos = leftMargin;
      doc
        .fontSize(7)
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold");

      doc
        .rect(leftMargin, y, pageWidth, 22)
        .fillColor("#1F4788")
        .fill();

      doc.fillColor("#FFFFFF");

      columns.forEach((col) => {
        const config = columnConfig[col] || { width: 60, label: col };
        const width = config.width * scale;
        const label = config.label || col;

        // Wrap text untuk label panjang - CENTER
        const maxCharsPerLine = Math.floor(width / 3.5);
        let lines = [];
        let currentLine = '';
        
        const words = label.split(' ');
        for (const word of words) {
          if ((currentLine + word).length <= maxCharsPerLine || !currentLine) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
        
        // Jika terlalu banyak baris, potong
        if (lines.length > 2) {
          lines = [lines[0], lines[1] + '...'];
        }
        
        const lineHeight = 6;
        const startY = y + 5;
        
        lines.forEach((line, index) => {
          doc.text(line, xPos + 2, startY + (index * lineHeight), {
            width: width - 4,
            align: "center",
            lineBreak: false
          });
        });

        xPos += width;
      });

      const headerBottom = y + 22;
      doc
        .moveTo(leftMargin, headerBottom)
        .lineTo(leftMargin + pageWidth, headerBottom)
        .lineWidth(1)
        .strokeColor("#000000")
        .stroke();

      return headerBottom + 2;
    };

    yPosition = drawTableHeader(yPosition);
    doc.fontSize(6).font("Helvetica");

    const rowHeight = isGabungan ? 24 : 22;

    rows.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (yPosition + rowHeight > doc.page.height - 60) {
        doc.addPage({
          margin: 20,
          size: "A4",
          layout: isGabungan ? "landscape" : "portrait"
        });
        yPosition = 20;
        yPosition = drawTableHeader(yPosition);
        doc.fontSize(6).font("Helvetica");
      }

      let xPos = leftMargin;

      // Alternating row colors
      if (rowIndex % 2 === 1) {
        doc
          .rect(leftMargin, yPosition, pageWidth, rowHeight)
          .fillColor("#F8F9FA")
          .fill();
      }

      columns.forEach((col) => {
        const config = columnConfig[col] || { width: 60 };
        const width = config.width * scale;
        let value = row[col];

        // Special handling untuk row_number
        if (col === "row_number") {
          value = rowIndex + 1;
        }
        
        // Special handling untuk kolom total di Gabungan
        if (col === "total" && isGabungan) {
          const uangJalan = Number(row.uang_jalan || 0);
          const potongan = Number(row.potongan || 0);
          value = uangJalan - potongan;
        }

        // Special formatting
        if ((col.includes("tanggal") || col === "tanggal_order" || col === "tanggal_bongkar") && value) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              value = date.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
              });
            }
          } catch (e) {
            value = value;
          }
        } else if ((col.includes("jam") || col === "jam_order" || col === "jam_bongkar") && value) {
          if (typeof value === 'string') {
            const timeParts = value.split(':');
            if (timeParts.length >= 2) {
              value = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
            }
          }
        } else if (
          (col === "uang_jalan" || 
           col === "uang_alihan" || 
           col.includes("hasil") || 
           col.includes("potongan") || 
           col === "total") &&
          value !== null &&
          value !== undefined &&
          value !== ""
        ) {
          const numValue = Number(value) || 0;
          if (numValue === 0) {
            value = "Rp 0";
          } else {
            value = "Rp " + numValue.toLocaleString("id-ID");
          }
        } else if (
          (col.includes("km_awal") || col.includes("km_akhir") || col.includes("jarak_km")) &&
          value !== null &&
          value !== undefined
        ) {
          value = formatKM(value);
        } else if (col === "alihan") {
          value = value == 1 || value === true || value === '1' ? "Ya" : "Tidak";
        } else if (col === "status") {
          value = (value || "").toUpperCase();
          if (value === "COMPLET E") value = "COMPLETE";
        }

        // Styling by status
        let textColor = "#000000";
        let fontStyle = "Helvetica";
        if (col === "status" && value) {
          const statusValue = value.toUpperCase();
          if (statusValue === "COMPLETE") {
            textColor = "#008000";
            fontStyle = "Helvetica-Bold";
          } else if (statusValue === "ON PROCESS" || statusValue === "ON_PROCESS") {
            textColor = "#FF8C00";
            fontStyle = "Helvetica-Bold";
          } else if (statusValue === "BATAL") {
            textColor = "#DC3545";
            fontStyle = "Helvetica-Bold";
          }
        }

        // Format value untuk ditampilkan
        let displayValue = value !== undefined && value !== null && value !== "" ? String(value) : "-";
        
        // Potong teks jika terlalu panjang (tanpa titik-titik)
        const maxChars = Math.floor(width / 3);
        if (displayValue.length > maxChars) {
          displayValue = formatText(displayValue, maxChars);
        }

        doc
          .fillColor(textColor)
          .font(fontStyle)
          .text(
            displayValue, 
            xPos + 2, 
            yPosition + 5, 
            {
              width: width - 4,
              height: rowHeight - 8,
              align: "center",
              lineBreak: false
            }
          );

        xPos += width;
      });

      yPosition += rowHeight;

      // Gambar garis horizontal antar baris
      doc
        .moveTo(leftMargin, yPosition)
        .lineTo(leftMargin + pageWidth, yPosition)
        .lineWidth(0.2)
        .strokeColor("#DDDDDD")
        .stroke();
    });

    // ======================================================================
    // SUMMARY (financial)
    // ======================================================================
    const summary = calculateSummary(rows, title);

    if (summary && Object.keys(summary).length > 0) {
      yPosition += 15;

      if (yPosition + 120 > doc.page.height - 40) {
        doc.addPage({
          margin: 20,
          size: "A4",
          layout: isGabungan ? "landscape" : "portrait"
        });
        yPosition = 20;
      }

      doc
        .fontSize(10)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text("RINGKASAN KEUANGAN", leftMargin, yPosition, {
          width: pageWidth,
          align: "center"
        });

      yPosition += 15;

      const summaryBoxWidth = 350;
      const summaryBoxX = leftMargin + (pageWidth - summaryBoxWidth) / 2;

      Object.entries(summary).forEach(([key, value], index) => {
        const isGrandTotal = key.includes("Grand Total");

        if (isGrandTotal) {
          yPosition += 3;
        }

        doc
          .rect(summaryBoxX, yPosition, summaryBoxWidth, 22)
          .fillColor("#FFFFFF")
          .fill();

        doc
          .rect(summaryBoxX, yPosition, summaryBoxWidth, 22)
          .strokeColor(isGrandTotal ? "#000000" : "#CCCCCC")
          .lineWidth(isGrandTotal ? 1 : 0.5)
          .stroke();

        const combinedText = `${key}: ${value}`;
        
        doc
          .fontSize(isGrandTotal ? 9 : 8.5)
          .fillColor("#000000")
          .font(isGrandTotal ? "Helvetica-Bold" : "Helvetica-Bold")
          .text(combinedText, summaryBoxX + 10, yPosition + 7, { 
            width: summaryBoxWidth - 20,
            align: "center"
          });

        yPosition += isGrandTotal ? 24 : 22;
      });
    }
  }

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
  const titleUpper = (title || "").toUpperCase();

  if (titleUpper.includes("ORDER") && !titleUpper.includes("GABUNGAN")) {
    let totalUangJalan = 0;
    let totalPotongan = 0;
    let totalHasilAkhir = 0;

    rows.forEach(row => {
      totalUangJalan += Number(row.uang_jalan || row.uang_jalan || 0);
      totalPotongan += Number(row.potongan || 0);
      totalHasilAkhir += Number(row.hasil_akhir || row.total || 0);
    });

    summary["Total Uang Jalan"] = `Rp ${totalUangJalan.toLocaleString("id-ID")}`;
    summary["Total Potongan"] = `Rp ${totalPotongan.toLocaleString("id-ID")}`;
    summary["Grand Total"] = `Rp ${totalHasilAkhir.toLocaleString("id-ID")}`;
  } else if (titleUpper.includes("BUANGAN")) {
    let totalUangAlihan = 0;
    rows.forEach(row => {
      totalUangAlihan += Number(row.uang_alihan || 0);
    });
    summary["Total Uang Alihan"] = `Rp ${totalUangAlihan.toLocaleString("id-ID")}`;
  } else if (titleUpper.includes("GABUNGAN")) {
    let totalUangJalan = 0;
    let totalPotongan = 0;
    let totalUangAlihan = 0;

    rows.forEach(row => {
      totalUangJalan += Number(row.uang_jalan || 0);
      totalPotongan += Number(row.potongan || 0);
      totalUangAlihan += Number(row.uang_alihan || 0);
    });

    const grandTotal = totalUangJalan - totalPotongan;

    summary["Total Uang Jalan"] = `Rp ${totalUangJalan.toLocaleString("id-ID")}`;
    summary["Total Potongan"] = `Rp ${totalPotongan.toLocaleString("id-ID")}`;
    summary["Grand Total (UJ - Potongan)"] = `Rp ${grandTotal.toLocaleString("id-ID")}`;
    summary["Total Uang Alihan"] = `Rp ${totalUangAlihan.toLocaleString("id-ID")}`;
  }

  return summary;
}