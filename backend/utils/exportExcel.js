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

  workbook.creator = "Sistem Rekap";
  workbook.created = new Date();
  
  let currentRow = 1;

  // ======================================================================
  // TITLE
  // ======================================================================
  const lastColLetter = String.fromCharCode(64 + headers.length);
  worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = filterInfo.title || filename;
  titleCell.font = { size: 18, bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" }
  };
  worksheet.getRow(currentRow).height = 40;
  currentRow++;

  // Export info
  worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
  const exportInfoCell = worksheet.getCell(`A${currentRow}`);
  exportInfoCell.value = `Diekspor pada: ${new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
  exportInfoCell.font = { size: 10, italic: true };
  exportInfoCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 22;
  currentRow++;

  // ======================================================================
  // FILTER INFO
  // ======================================================================
  if (filterInfo.filters && Object.keys(filterInfo.filters).length > 0) {
    currentRow++;
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const filterTitleCell = worksheet.getCell(`A${currentRow}`);
    filterTitleCell.value = "FILTER YANG DITERAPKAN";
    filterTitleCell.font = { size: 12, bold: true };
    filterTitleCell.alignment = { vertical: "middle", horizontal: "center" };
    filterTitleCell.border = {
      top: { style: "medium" },
      left: { style: "medium" },
      bottom: { style: "thin" },
      right: { style: "medium" }
    };
    worksheet.getRow(currentRow).height = 28;
    currentRow++;

    Object.entries(filterInfo.filters).forEach(([key, value]) => {
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      const labelCell = worksheet.getCell(`A${currentRow}`);
      labelCell.value = key;
      labelCell.font = { bold: true, size: 10 };
      labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      labelCell.border = {
        top: { style: "thin" },
        left: { style: "medium" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      worksheet.mergeCells(`C${currentRow}:${lastColLetter}${currentRow}`);
      const valueCell = worksheet.getCell(`C${currentRow}`);
      valueCell.value = value;
      valueCell.font = { size: 10 };
      valueCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      valueCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "medium" }
      };

      worksheet.getRow(currentRow).height = 22;
      currentRow++;
    });

    // Bottom border for filter section
    const lastFilterRow = currentRow - 1;
    for (let i = 1; i <= headers.length; i++) {
      const cell = worksheet.getCell(lastFilterRow, i);
      cell.border = {
        ...cell.border,
        bottom: { style: "medium" }
      };
    }
  }

  currentRow++;

  // ======================================================================
  // TOTAL COUNT
  // ======================================================================
  worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
  const summaryCell = worksheet.getCell(`A${currentRow}`);
  summaryCell.value = `Total Data: ${rows.length} record${rows.length !== 1 ? 's' : ''}`;
  summaryCell.font = { size: 11, bold: true };
  summaryCell.alignment = { horizontal: "center", vertical: "middle" };
  summaryCell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  worksheet.getRow(currentRow).height = 25;
  currentRow++;

  currentRow++;

// ======================================================================
// SUMMARY STATS (untuk Gabungan)
// ======================================================================
if (filterInfo.title && filterInfo.title.includes('GABUNGAN') && filterInfo.stats) {
  currentRow++;
  
  worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
  const statsTitleCell = worksheet.getCell(`A${currentRow}`);
  statsTitleCell.value = "STATISTIK DATA";
  statsTitleCell.font = { size: 12, bold: true };
  statsTitleCell.alignment = { vertical: "middle", horizontal: "center" };
  statsTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EAF6' }
  };
  statsTitleCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "thin" },
    right: { style: "medium" }
  };
  worksheet.getRow(currentRow).height = 28;
  currentRow++;

  // Stats grid - 4 columns (tanpa icon)
  const statsData = [
    { label: 'Total Data', value: filterInfo.stats.total || 0, color: null },
    { label: 'Complete', value: filterInfo.stats.complete || 0, color: 'FF28a745' },
    { label: 'On Process', value: filterInfo.stats.process || 0, color: 'FFffc107' },
    { label: 'Batal', value: filterInfo.stats.batal || 0, color: 'FFdc3545' }
  ];

  const colsPerStat = Math.max(1, Math.floor(headers.length / statsData.length));
  
  statsData.forEach((stat, index) => {
    const startCol = (index * colsPerStat) + 1;
    const endCol = Math.min(startCol + colsPerStat - 1, headers.length);
    
    if (startCol <= headers.length) {
      const startLetter = String.fromCharCode(64 + startCol);
      const endLetter = String.fromCharCode(64 + endCol);
      
      worksheet.mergeCells(`${startLetter}${currentRow}:${endLetter}${currentRow}`);
      const statCell = worksheet.getCell(`${startLetter}${currentRow}`);
      statCell.value = `${stat.label}: ${stat.value}`;
      statCell.font = { 
        size: 10, 
        bold: true,
        color: stat.color ? { argb: stat.color } : undefined
      };
      statCell.alignment = { vertical: "middle", horizontal: "center" };
      statCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' }
      };
      statCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "medium" },
        right: { style: "thin" }
      };
    }
  });
  
  worksheet.getRow(currentRow).height = 25;
  currentRow++;
}

  currentRow++;

  // ======================================================================
  // TABLE HEADERS
  // ======================================================================
  const headerRow = worksheet.getRow(currentRow);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header.label;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" }
    };
  });
  headerRow.height = 30;
  currentRow++;

  // Set column widths
  headers.forEach((header, index) => {
    const w = header.width || 20;
    worksheet.getColumn(index + 1).width = Math.max(8, Math.round(w * 0.18 * 10) / 10);
  });

  // ======================================================================
  // DATA ROWS
  // ======================================================================
  rows.forEach((row, rowIndex) => {
    const dataRow = worksheet.getRow(currentRow);
    headers.forEach((header, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      let value = row[header.key];

      // Add row number
      if (header.key === "row_number") {
        value = rowIndex + 1;
      }

      // Fallback mapping
      if ((header.key === "keterangan_buangan" || header.key === "keterangan") && row.keterangan_buangan) {
        value = row.keterangan_buangan;
      }
      if ((header.key === "supir" || header.key === "supir_nama") && row.supir_nama) {
        value = row.supir_nama;
      }
      if ((header.key === "kendaraan" || header.key === "kendaraan_nama") && row.kendaraan_nama) {
        value = row.kendaraan_nama;
      }
      if ((header.key === "proyek" || header.key === "proyek_input") && row.proyek_input) {
        value = row.proyek_input;
      }
      if ((header.key === "galian" || header.key === "galian_nama") && row.galian_nama) {
        value = row.galian_nama;
      }
      if ((header.key === "galian_alihan" || header.key === "galian_alihan_nama") && row.galian_alihan_nama) {
        value = row.galian_alihan_nama;
      }

      // Formatting
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
        // FIX: Tambahkan pengecualian untuk "buangan" dan "lokasi_bongkar"
        (header.key === "uang_jalan" || 
         header.key === "uang_alihan" || 
         header.key.includes("hasil") || 
         header.key.includes("potongan") ||
         header.key === "total") && 
        value !== null && 
        value !== undefined && 
        value !== ""
      ) {
        cell.value = Number(value) || 0;
        cell.numFmt = '"Rp "#,##0';
      } else if (header.key === "alihan") {
        value = value ? "Ya" : "Tidak";
      } else if (header.key === "status") {
        value = (value || "").toUpperCase();
      }

      if (cell.numFmt !== '"Rp "#,##0') {
        cell.value = value !== undefined && value !== null && value !== "" ? value : "-";
      }

      cell.font = { size: 9 };
      
      // FIX: Alignment - tambahkan pengecualian untuk "buangan" dan "lokasi_bongkar"
      const isMoneyColumn = header.key === "uang_jalan" || 
                           header.key === "uang_alihan" || 
                           header.key.includes("hasil") || 
                           header.key.includes("potongan") ||
                           header.key === "total";
      
      const isCenterColumn = header.key.includes("km") || 
                            header.key.includes("jarak") || 
                            header.key === "row_number" || 
                            header.key === "no_urut" || 
                            header.key === "alihan" || 
                            header.key === "no" || 
                            header.key === "id";
      
      cell.alignment = { 
        vertical: "middle", 
        horizontal: isMoneyColumn ? "right" : (isCenterColumn ? "center" : "left"),
        indent: (isMoneyColumn || isCenterColumn) ? 0 : 1,
        wrapText: true
      };

      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      if (header.key === "status" && cell.value) {
        const raw = String(cell.value).toUpperCase();
        if (raw === "COMPLETE") {
          cell.font = { bold: true, size: 9, color: { argb: "FF008000" } };
        } else if (raw === "ON PROCESS" || raw === "ON_PROCESS") {
          cell.font = { bold: true, size: 9, color: { argb: "FFFF8C00" } };
        } else if (raw === "BATAL") {
          cell.font = { bold: true, size: 9, color: { argb: "FFDC3545" } };
        }
      }
    });

    dataRow.height = 22;
    currentRow++;
  });

  // ======================================================================
  // SUMMARY (financial)
  // ======================================================================
  const summary = calculateSummary(rows, filterInfo.title || filename);

  if (summary && Object.keys(summary).length > 0) {
    currentRow += 2;

    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const summaryTitleCell = worksheet.getCell(`A${currentRow}`);
    summaryTitleCell.value = "RINGKASAN KEUANGAN";
    summaryTitleCell.font = { size: 12, bold: true };
    summaryTitleCell.alignment = { vertical: "middle", horizontal: "center" };
    summaryTitleCell.border = {
      top: { style: "medium" },
      left: { style: "medium" },
      bottom: { style: "medium" },
      right: { style: "medium" }
    };
    worksheet.getRow(currentRow).height = 28;
    currentRow++;

    Object.entries(summary).forEach(([key, value]) => {
      const isGrandTotal = key.includes("Grand Total");
      const midCol = Math.floor(headers.length / 2);
      const startCol = Math.max(1, midCol - 2);
      const endCol = Math.min(headers.length, midCol + 3);

      const startLetter = String.fromCharCode(64 + startCol);
      const midLetter = String.fromCharCode(64 + midCol);
      const endLetter = String.fromCharCode(64 + endCol);

      worksheet.mergeCells(`${startLetter}${currentRow}:${midLetter}${currentRow}`);
      const labelCell = worksheet.getCell(`${startLetter}${currentRow}`);
      labelCell.value = key;
      labelCell.font = { bold: true, size: isGrandTotal ? 11 : 10 };
      labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
      labelCell.border = {
        top: { style: isGrandTotal ? "medium" : "thin" },
        left: { style: "medium" },
        bottom: { style: isGrandTotal ? "medium" : "thin" },
        right: { style: "thin" }
      };

      worksheet.mergeCells(`${String.fromCharCode(64 + midCol + 1)}${currentRow}:${endLetter}${currentRow}`);
      const valueCell = worksheet.getCell(`${String.fromCharCode(64 + midCol + 1)}${currentRow}`);
      
      // Set numeric value with currency format
      valueCell.value = Number(value) || 0;
      valueCell.numFmt = '"Rp "#,##0';
      
      valueCell.font = { size: isGrandTotal ? 11 : 10, bold: isGrandTotal };
      valueCell.alignment = { vertical: "middle", horizontal: "right", indent: 2 };
      valueCell.border = {
        top: { style: isGrandTotal ? "medium" : "thin" },
        left: { style: "thin" },
        bottom: { style: isGrandTotal ? "medium" : "thin" },
        right: { style: "medium" }
      };

      worksheet.getRow(currentRow).height = isGrandTotal ? 30 : 24;
      currentRow++;
    });
  }

  // SEND
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  // Expose Content-Disposition so frontend JS can read it
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  const { generateFilename } = await import('./filename.js');
  const { filename: exportFilename, encoded: exportFilenameEncoded } = generateFilename(filterInfo.filename || filename, filterInfo);
  res.setHeader("Content-Disposition", `attachment; filename="${exportFilename}.xlsx"; filename*=UTF-8''${exportFilenameEncoded}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}

/**
 * Calculate summary based on report type
 * @param {Array} rows - Data rows
 * @param {string} title - Report title
 * @returns {Object} Summary object with numeric values
 */
function calculateSummary(rows, title) {
  if (!rows || rows.length === 0) return {};

  const summary = {};
  const titleLower = (title || "").toLowerCase();

  // Rekap Order
  if (titleLower.includes("order") && !titleLower.includes("gabungan")) {
    let totalUangJalan = 0;
    let totalPotongan = 0;
    let totalHasilAkhir = 0;

    rows.forEach(row => {
      totalUangJalan += Number(row.uang_jalan || 0);
      totalPotongan += Number(row.potongan || 0);
      totalHasilAkhir += Number(row.hasil_akhir || 0);
    });

    summary["Total Uang Jalan"] = totalUangJalan;
    summary["Total Potongan"] = totalPotongan;
    summary["Grand Total"] = totalHasilAkhir;
  }
  // Rekap Buangan
  else if (titleLower.includes("buangan")) {
    let totalUangAlihan = 0;
    rows.forEach(row => {
      totalUangAlihan += Number(row.uang_alihan || 0);
    });
    summary["Total Uang Alihan"] = totalUangAlihan;
  }
  // Rekap Gabungan
  else if (titleLower.includes("gabungan")) {
    let totalUangJalan = 0;
    let totalPotongan = 0;
    let totalUangAlihan = 0;

    rows.forEach(row => {
      totalUangJalan += Number(row.uang_jalan || 0);
      totalPotongan += Number(row.potongan || 0);
      totalUangAlihan += Number(row.uang_alihan || 0);
    });

    const grandTotal = totalUangJalan - totalPotongan;

    summary["Total Uang Jalan"] = totalUangJalan;
    summary["Total Potongan"] = totalPotongan;
    summary["Grand Total (UJ - Potongan)"] = grandTotal;
    summary["Total Uang Alihan"] = totalUangAlihan;
  }

  return summary;
}