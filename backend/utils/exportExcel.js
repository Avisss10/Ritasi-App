import ExcelJS from "exceljs";

/**
 * Generate Excel file with professional formatting and summary
 * @param {string} filename - Base filename
 * @param {Array} headers - Column headers with label, key, width
 * @param {Array} rows - Data rows
 * @param {Object} filterInfo - Active filter information
 * @param {Object} res - Express response object
 */
export async function generateExcel(filename, headers, rows, filterInfo, res) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data");

  // Set workbook properties
  workbook.creator = "Sistem Rekap";
  workbook.created = new Date();
  
  let currentRow = 1;

  // ============================================================================
  // HEADER SECTION - Title and Export Info
  // ============================================================================
  
  // Main Title
  worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + headers.length)}${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = filterInfo.title || filename;
  titleCell.font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4788" }
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(currentRow).height = 40;
  currentRow++;

  // Export Information
  worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + headers.length)}${currentRow}`);
  const exportInfoCell = worksheet.getCell(`A${currentRow}`);
  exportInfoCell.value = `Diekspor pada: ${new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
  exportInfoCell.font = { size: 11, italic: true, color: { argb: "FF666666" } };
  exportInfoCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 22;
  currentRow++;

  // ============================================================================
  // FILTER INFORMATION SECTION
  // ============================================================================
  if (filterInfo.filters && Object.keys(filterInfo.filters).length > 0) {
    currentRow++; // Empty row

    // Filter Section Title
    worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + headers.length)}${currentRow}`);
    const filterTitleCell = worksheet.getCell(`A${currentRow}`);
    filterTitleCell.value = "FILTER YANG DITERAPKAN";
    filterTitleCell.font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
    filterTitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" }
    };
    filterTitleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(currentRow).height = 28;
    currentRow++;

    // Filter Details
    Object.entries(filterInfo.filters).forEach(([key, value]) => {
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      const labelCell = worksheet.getCell(`A${currentRow}`);
      labelCell.value = key;
      labelCell.font = { bold: true, size: 11, color: { argb: "FF000000" } };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" }
      };
      labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      labelCell.border = {
        top: { style: "thin", color: { argb: "FF8EA9DB" } },
        left: { style: "thin", color: { argb: "FF8EA9DB" } },
        bottom: { style: "thin", color: { argb: "FF8EA9DB" } },
        right: { style: "thin", color: { argb: "FF8EA9DB" } }
      };

      worksheet.mergeCells(`C${currentRow}:${String.fromCharCode(64 + headers.length)}${currentRow}`);
      const valueCell = worksheet.getCell(`C${currentRow}`);
      valueCell.value = value;
      valueCell.font = { size: 11, color: { argb: "FF000000" } };
      valueCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      valueCell.border = {
        top: { style: "thin", color: { argb: "FF8EA9DB" } },
        left: { style: "thin", color: { argb: "FF8EA9DB" } },
        bottom: { style: "thin", color: { argb: "FF8EA9DB" } },
        right: { style: "thin", color: { argb: "FF8EA9DB" } }
      };

      worksheet.getRow(currentRow).height = 24;
      currentRow++;
    });
  }

  currentRow++; // Empty row before summary

  // ============================================================================
  // DATA SUMMARY (RECORD COUNT)
  // ============================================================================
  worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + headers.length)}${currentRow}`);
  const summaryCell = worksheet.getCell(`A${currentRow}`);
  summaryCell.value = `Total Data: ${rows.length} record${rows.length !== 1 ? 's' : ''}`;
  summaryCell.font = { size: 12, bold: true, color: { argb: "FF000000" } };
  summaryCell.alignment = { horizontal: "center", vertical: "middle" };
  summaryCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFCE4D6" }
  };
  worksheet.getRow(currentRow).height = 25;
  currentRow++;

  currentRow++; // Empty row before data

  // ============================================================================
  // DATA TABLE SECTION
  // ============================================================================

  // Table Headers
  const headerRow = worksheet.getRow(currentRow);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header.label;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4788" }
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } }
    };
  });
  headerRow.height = 35;
  currentRow++;

  // Set column widths - Larger for better visibility
  headers.forEach((header, index) => {
    worksheet.getColumn(index + 1).width = (header.width || 20) * 0.15; // Convert to Excel width units
  });

  // Data Rows
  rows.forEach((row, rowIndex) => {
    const dataRow = worksheet.getRow(currentRow);
    
    headers.forEach((header, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      let value = row[header.key];

      // Format values based on type
      if (header.key.includes("tanggal") && value) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          value = date.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          });
        }
      } else if (
        (header.key.includes("uang") || 
         header.key.includes("hasil") || 
         header.key.includes("potongan")) && 
        value !== null && 
        value !== undefined
      ) {
        cell.value = parseFloat(value) || 0;
        cell.numFmt = '"Rp "#,##0';
      } else if (header.key === "alihan") {
        value = value ? "Ya" : "Tidak";
      } else if (header.key === "status") {
        value = (value || "").toUpperCase();
      }

      if (cell.numFmt !== '"Rp "#,##0') {
        cell.value = value || "-";
      }

      // Styling
      cell.font = { size: 10, color: { argb: "FF000000" } };
      cell.alignment = { 
        vertical: "middle", 
        horizontal: header.key.includes("uang") || 
                    header.key.includes("hasil") || 
                    header.key.includes("potongan") ? "right" :
                    (header.key.includes("km") ||
                     header.key.includes("jarak") ||
                     header.key === "no_urut" ||
                     header.key === "alihan") ? "center" : "left",
        indent: (header.key.includes("uang") || 
                 header.key.includes("hasil") || 
                 header.key.includes("potongan")) ? 0 : 1,
        wrapText: false
      };

      // Alternating row colors
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowIndex % 2 === 0 ? "FFFFFFFF" : "FFF8F8F8" }
      };

      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } }
      };

      // Status color coding
      if (header.key === "status" && value) {
        if (value === "COMPLETE") {
          cell.font = { bold: true, size: 10, color: { argb: "FF008000" } };
        } else if (value === "ON PROCESS" || value === "ON_PROCESS") {
          cell.font = { bold: true, size: 10, color: { argb: "FFFF8C00" } };
        }
      }
    });

    dataRow.height = 24;
    currentRow++;
  });

  // ============================================================================
  // FINANCIAL SUMMARY SECTION (AT THE END)
  // ============================================================================
  const summary = calculateSummary(rows, filterInfo.title || filename);

  if (summary && Object.keys(summary).length > 0) {
    currentRow += 2; // Empty rows before summary

    // Summary Title
    worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + headers.length)}${currentRow}`);
    const summaryTitleCell = worksheet.getCell(`A${currentRow}`);
    summaryTitleCell.value = "RINGKASAN KEUANGAN";
    summaryTitleCell.font = { size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    summaryTitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4788" }
    };
    summaryTitleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(currentRow).height = 30;
    currentRow++;

    // Summary Details
    Object.entries(summary).forEach(([key, value]) => {
      const isGrandTotal = key === "Grand Total";

      // Calculate column span for centering
      const midCol = Math.floor(headers.length / 2);
      const startCol = midCol - 2;
      const endCol = midCol + 3;

      worksheet.mergeCells(`${String.fromCharCode(64 + startCol)}${currentRow}:${String.fromCharCode(64 + midCol)}${currentRow}`);
      const labelCell = worksheet.getCell(`${String.fromCharCode(64 + startCol)}${currentRow}`);
      labelCell.value = key;
      labelCell.font = { 
        bold: true, 
        size: isGrandTotal ? 13 : 11, 
        color: { argb: isGrandTotal ? "FFFFFFFF" : "FF000000" } 
      };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isGrandTotal ? "FF1F4788" : "FFE7E6E6" }
      };
      labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
      labelCell.border = {
        top: { style: isGrandTotal ? "medium" : "thin", color: { argb: "FF000000" } },
        left: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: isGrandTotal ? "medium" : "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } }
      };

      worksheet.mergeCells(`${String.fromCharCode(64 + midCol + 1)}${currentRow}:${String.fromCharCode(64 + endCol)}${currentRow}`);
      const valueCell = worksheet.getCell(`${String.fromCharCode(64 + midCol + 1)}${currentRow}`);
      valueCell.value = value;
      valueCell.font = { 
        size: isGrandTotal ? 13 : 11, 
        bold: isGrandTotal,
        color: { argb: isGrandTotal ? "FFFFFFFF" : "FF000000" } 
      };
      valueCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isGrandTotal ? "FF1F4788" : "FFFFFFFF" }
      };
      valueCell.alignment = { vertical: "middle", horizontal: "right", indent: 2 };
      valueCell.border = {
        top: { style: isGrandTotal ? "medium" : "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: isGrandTotal ? "medium" : "thin", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } }
      };

      worksheet.getRow(currentRow).height = isGrandTotal ? 32 : 26;
      currentRow++;
    });
  }

  // ============================================================================
  // FOOTER SECTION
  // ============================================================================
  currentRow += 2; // Empty rows

  worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + headers.length)}${currentRow}`);
  const footerCell = worksheet.getCell(`A${currentRow}`);
  footerCell.value = `Generated by Sistem Rekap - ${new Date().getFullYear()}`;
  footerCell.font = { size: 9, italic: true, color: { argb: "FF999999" } };
  footerCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 20;

  // ============================================================================
  // SEND RESPONSE
  // ============================================================================
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filterInfo.filename || filename}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
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