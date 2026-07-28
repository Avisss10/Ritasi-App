// ============================================================================
// TEMPLATE EXCEL UNTUK BULK IMPORT
// Menghasilkan workbook .xlsx berisi sheet "Data" (header + baris contoh)
// dan sheet "Petunjuk" (panduan pengisian). User mengisi di Excel lalu
// Save As -> CSV UTF-8; upload tetap hanya menerima .csv.
// Konvensi styling mengikuti exportExcel.js.
// ============================================================================

import ExcelJS from "exceljs";
import { CSV_TEMPLATES } from "./csvImport.js";

// Kolom yang di-set number format '@' (text) di sheet Data supaya isian user
// (tanggal, jam, no_order) tidak dikonversi otomatis oleh Excel
function isTextFormatColumn(col) {
  return col.includes("tanggal") || col.startsWith("jam") || col === "no_order";
}

// ----------------------------------------------------------------------------
// Arti setiap kolom per entitas: [kolom, wajib/opsional, keterangan]
// ----------------------------------------------------------------------------
const KOLOM_PETUNJUK = {
  kendaraan: [
    ["no_pintu", "WAJIB", "Nomor pintu kendaraan, mis. B9999XYZ"],
  ],
  supir: [
    ["nama", "WAJIB", "Nama supir"],
  ],
  galian: [
    ["nama_galian", "WAJIB", "Nama galian"],
    ["harga_galian", "Opsional", "Angka; jika kosong tersimpan 0 (bisa disesuaikan di halaman Master)"],
  ],
  proyek: [
    ["nama_proyek", "WAJIB", "Nama proyek"],
    ["harga", "Opsional", "Angka; jika kosong tersimpan 0 (bisa disesuaikan di halaman Master)"],
  ],
  ritasi: [
    ["tanggal_order", "WAJIB", "Tanggal order (YYYY-MM-DD atau DD/MM/YYYY). Kunci order = tanggal_order + no_order"],
    ["no_order", "WAJIB", "Nomor order"],
    ["petugas_order", "WAJIB", "Nama petugas order"],
    ["no_pintu", "WAJIB", "Harus terdaftar di Master Kendaraan"],
    ["nama_supir", "WAJIB", "Harus terdaftar di Master Supir"],
    ["nama_galian", "WAJIB", "Harus terdaftar di Master Galian"],
    ["nama_proyek", "Opsional", "Jika diisi, harus terdaftar di Master Proyek"],
    ["no_do", "WAJIB", "Nomor DO"],
    ["jam_order", "WAJIB", "Format HH:MM"],
    ["km_awal", "WAJIB", "Angka (boleh dengan titik ribuan) atau teks ODO ERROR"],
    ["uang_jalan", "WAJIB", "Angka tanpa perlu pemisah ribuan"],
    ["potongan", "Opsional", "Angka; kosong = 0"],
    ["batal", "Opsional", "ya/tidak (juga 1/0, true/false); kosong = tidak"],
    ["keterangan", "Kondisional", "WAJIB diisi alasan pembatalan jika batal=ya; untuk baris COMPLETE masuk ke keterangan buangan"],
    ["tanggal_bongkar", "Kondisional", "WAJIB untuk baris COMPLETE; kosongkan untuk ON PROCESS/BATAL"],
    ["jam_bongkar", "Kondisional", "WAJIB untuk baris COMPLETE; format HH:MM"],
    ["km_akhir", "Kondisional", "WAJIB untuk baris COMPLETE; angka atau ODO ERROR"],
    ["jarak_km", "Opsional", "Kosong = dihitung otomatis dari km_akhir - km_awal"],
    ["lokasi_bongkar", "Kondisional", "WAJIB untuk baris COMPLETE"],
    ["alihan", "Opsional", "ya/tidak; kosong = tidak"],
    ["nama_galian_alihan", "Kondisional", "WAJIB jika alihan=ya; harus terdaftar di Master Galian"],
    ["uang_alihan", "Opsional", "Angka; hanya dipakai jika alihan=ya"],
    ["no_urut", "Kondisional", "WAJIB untuk baris COMPLETE; harus unik per order"],
  ],
  "mobil-luar": [
    ["no_urut", "Opsional", "Angka urut"],
    ["pengirim", "Opsional", "Nama pengirim"],
    ["galian", "Opsional", "Nama galian (teks bebas)"],
    ["no_plat", "Opsional", "Nomor plat kendaraan"],
    ["supir", "Opsional", "Nama supir (teks bebas)"],
    ["tanggal_bongkar", "Opsional", "YYYY-MM-DD atau DD/MM/YYYY"],
    ["jam_bongkar", "Opsional", "Format HH:MM"],
    ["proyek", "Opsional", "Nama proyek (teks bebas)"],
    ["lokasi_buang", "Opsional", "Lokasi pembuangan"],
  ],
};

// Panduan pengisian per status, khusus entitas ritasi
const PETUNJUK_STATUS_RITASI = [
  "CARA MENGISI PER STATUS (satu baris = satu kejadian utuh):",
  "",
  "1. ON PROCESS (order berjalan, belum bongkar):",
  "   - Isi bagian order saja (tanggal_order s/d potongan).",
  "   - Kolom batal dikosongkan atau isi 'tidak'.",
  "   - SELURUH kolom buangan (tanggal_bongkar s/d no_urut) dikosongkan.",
  "",
  "2. COMPLETE (order sudah bongkar):",
  "   - Isi bagian order + tanggal_bongkar, jam_bongkar, km_akhir, lokasi_bongkar, no_urut.",
  "   - jarak_km boleh kosong (dihitung otomatis dari km_akhir - km_awal).",
  "   - Jika alihan=ya: nama_galian_alihan wajib diisi, uang_alihan opsional.",
  "",
  "3. BATAL (order dibatalkan):",
  "   - Isi bagian order, kolom batal = 'ya', keterangan WAJIB diisi alasan pembatalan.",
  "   - SELURUH kolom buangan dikosongkan.",
  "",
  "MENAMBAH RITASI KE-2 / KE-3 UNTUK ORDER YANG SAMA:",
  "   - Tulis baris baru dengan bagian order IDENTIK (semua kolom order sama persis).",
  "   - Isi kolom buangan untuk ritasi tersebut dengan no_urut yang BERBEDA.",
  "   - Jika order-nya sudah ada di aplikasi, baris hanya akan menambahkan ritasi",
  "     (mobil & supir di baris harus sama dengan milik order tersebut).",
  "",
];

// ----------------------------------------------------------------------------
// Bangun workbook template untuk satu entitas
// ----------------------------------------------------------------------------
export function buildTemplateWorkbook(entitas) {
  const tpl = CSV_TEMPLATES[entitas];
  if (!tpl) throw new Error(`Entitas '${entitas}' tidak dikenal`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistem Rekap";
  workbook.created = new Date();

  // ======================================================================
  // SHEET "Data": header berwarna + freeze pane + baris contoh
  // ======================================================================
  const dataSheet = workbook.addWorksheet("Data", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headerRow = dataSheet.getRow(1);
  tpl.header.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF667EEA" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" }, left: { style: "thin" },
      bottom: { style: "medium" }, right: { style: "thin" },
    };
  });
  headerRow.height = 28;

  tpl.header.forEach((col, idx) => {
    const column = dataSheet.getColumn(idx + 1);
    column.width = Math.max(12, Math.min(24, col.length + 6));
    // Format text ('@') agar Excel tidak mengubah tanggal/jam/no_order otomatis
    if (isTextFormatColumn(col)) column.numFmt = "@";
  });

  tpl.examples.forEach((example, rowIdx) => {
    const row = dataSheet.getRow(rowIdx + 2);
    example.forEach((value, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = value;
      cell.font = { size: 10 };
      if (isTextFormatColumn(tpl.header[colIdx])) cell.numFmt = "@";
    });
  });

  // ======================================================================
  // SHEET "Petunjuk": panduan kolom, format, dan langkah simpan ke CSV
  // ======================================================================
  const petunjukSheet = workbook.addWorksheet("Petunjuk");
  petunjukSheet.getColumn(1).width = 110;

  const lines = [];
  const addTitle = (text) => lines.push({ text, bold: true });
  const addLine = (text = "") => lines.push({ text, bold: false });

  addTitle(`PETUNJUK PENGISIAN TEMPLATE IMPORT: ${entitas.toUpperCase()}`);
  addLine();
  addTitle("ARTI SETIAP KOLOM:");
  (KOLOM_PETUNJUK[entitas] || []).forEach(([kolom, wajib, ket]) => {
    addLine(`- ${kolom} (${wajib}): ${ket}`);
  });
  addLine();

  if (entitas === "ritasi") {
    PETUNJUK_STATUS_RITASI.forEach((t) => {
      if (t === t.toUpperCase() && t.trim() !== "" && !t.startsWith(" ")) addTitle(t);
      else addLine(t);
    });
  }

  addTitle("FORMAT DATA:");
  addLine("- Tanggal: YYYY-MM-DD atau DD/MM/YYYY.");
  addLine("  PENTING: kolom tanggal di sheet Data sudah di-set sebagai TEXT agar Excel");
  addLine("  tidak mengubah format tanggal secara otomatis — biarkan begitu.");
  addLine("- Jam: HH:MM (mis. 08:30).");
  addLine("- Angka: tanpa perlu pemisah ribuan (10000, bukan 10.000 — titik ribuan tetap diterima).");
  addLine("- Kolom batal / alihan: isi 'ya' atau 'tidak' (juga menerima 1/0, true/false); kosong = tidak.");
  addLine();
  addTitle("CARA MENYIMPAN & UPLOAD:");
  addLine("1. Isi data di sheet Data (baris contoh boleh dihapus/ditimpa).");
  addLine("2. File -> Save As -> pilih format \"CSV UTF-8 (Comma delimited) (*.csv)\".");
  addLine("3. Upload file .csv tersebut di halaman Import (file .xlsx TIDAK bisa diupload langsung).");

  lines.forEach((line, idx) => {
    const cell = petunjukSheet.getCell(idx + 1, 1);
    cell.value = line.text;
    cell.font = { size: 10, bold: line.bold };
    cell.alignment = { vertical: "middle", wrapText: false };
  });

  return workbook;
}
