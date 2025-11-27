import ExcelJS from "exceljs";

/**
 * Generate Excel file with professional formatting
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
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4788" }
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(currentRow).height = 35;
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
  exportInfoCell.font = { size: 10, italic: true, color: { argb: "FF7F7F7F" } };
  exportInfoCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 20;
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
    filterTitleCell.font = { size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    filterTitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" }
    };
    filterTitleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(currentRow).height = 25;
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

      worksheet.getRow(currentRow).height = 22;
      currentRow++;
    });
  }

  currentRow++; // Empty row before summary

  // ============================================================================
  // SUMMARY SECTION
  // ============================================================================
  worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + headers.length)}${currentRow}`);
  const summaryCell = worksheet.getCell(`A${currentRow}`);
  summaryCell.value = `Total Data: ${rows.length} record${rows.length !== 1 ? 's' : ''}`;
  summaryCell.font = { size: 11, bold: true, color: { argb: "FF000000" } };
  summaryCell.alignment = { horizontal: "center", vertical: "middle" };
  summaryCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFCE4D6" }
  };
  worksheet.getRow(currentRow).height = 22;
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
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } }
    };
  });
  headerRow.height = 30;
  currentRow++;

  // Set column widths
  headers.forEach((header, index) => {
    worksheet.getColumn(index + 1).width = header.width || 20;
  });

  // Data Rows
  rows.forEach((row, rowIndex) => {
    const dataRow = worksheet.getRow(currentRow);
    
    headers.forEach((header, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      let value = row[header.key];

      // Format values based on type
      if (header.key.includes("tanggal") && value) {
        // Format date
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
         header.key.includes("potongan") ||
         header.key.includes("nilai") ||
         header.key.includes("bayaran")) && 
        value !== null && 
        value !== undefined
      ) {
        // Format currency
        cell.value = parseFloat(value) || 0;
        cell.numFmt = '"Rp "#,##0';
      } else if (header.key === "alihan") {
        // Format boolean
        value = value ? "Ya" : "Tidak";
      } else if (header.key === "status") {
        // Format status
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
                    header.key.includes("potongan") ||
                    header.key.includes("nilai") ||
                    header.key.includes("bayaran") ? "right" :
                    (header.key.includes("km") ||
                     header.key.includes("jarak") ||
                     header.key.includes("ritasi") ||
                     header.key.includes("tonase")) ? "center" : "left",
        indent: (header.key.includes("uang") || 
                 header.key.includes("hasil") || 
                 header.key.includes("potongan") ||
                 header.key.includes("nilai") ||
                 header.key.includes("bayaran") ||
                 header.key.includes("km") ||
                 header.key.includes("jarak") ||
                 header.key.includes("ritasi") ||
                 header.key.includes("tonase")) ? 0 : 1
      };

      // Alternating row colors
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowIndex % 2 === 0 ? "FFFFFFFF" : "FFF2F2F2" }
      };

      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } }
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

    dataRow.height = 22;
    currentRow++;
  });

  // ============================================================================
  // FOOTER SECTION
  // ============================================================================
  currentRow++; // Empty row

  worksheet.mergeCells(`A${currentRow}:${String.fromCharCode(64 + headers.length)}${currentRow}`);
  const footerCell = worksheet.getCell(`A${currentRow}`);
  footerCell.value = `Generated by Sistem Rekap - ${new Date().getFullYear()}`;
  footerCell.font = { size: 9, italic: true, color: { argb: "FF7F7F7F" } };
  footerCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 18;

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