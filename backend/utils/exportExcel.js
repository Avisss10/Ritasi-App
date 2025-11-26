import ExcelJS from "exceljs";

export async function generateExcel(filename, headers, rows, res) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data");

  worksheet.columns = headers.map(h => ({ header: h.label, key: h.key, width: h.width || 20 }));

  rows.forEach(row => worksheet.addRow(row));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}
