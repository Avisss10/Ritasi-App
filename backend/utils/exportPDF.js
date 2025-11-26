import PDFDocument from "pdfkit";

export function generatePDF(title, rows, res) {
  const doc = new PDFDocument({ margin: 30 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${title}.pdf`);

  doc.fontSize(18).text(title, { align: "center" });
  doc.moveDown();

  rows.forEach((item, index) => {
    doc.fontSize(12).text(`${index + 1}. ${JSON.stringify(item)}`);
  });

  doc.end();
  doc.pipe(res);
}
