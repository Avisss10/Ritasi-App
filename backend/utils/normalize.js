// ============================================================================
// NORMALIZE UTILS (tanggal, jam, angka, km/ODO ERROR)
// Diekstrak dari order.js & buangan.js agar bisa dipakai bersama oleh
// modul import CSV. Perilaku fungsi yang sudah ada TIDAK diubah.
// ============================================================================

// ----------------------------------------------------------------------------
// Fix tanggal untuk MySQL (format YYYY-MM-DD), dipakai form manual order
// ----------------------------------------------------------------------------
export function fixTanggalForMySQL(tanggalInput) {
  // Input format: "2025-11-25" (dari input type="date")
  // Output: "2025-11-25" (tanpa timezone conversion)

  if (!tanggalInput) return null;

  // Ambil hanya bagian tanggal (YYYY-MM-DD), abaikan timezone
  const tanggal = tanggalInput.split('T')[0];
  return tanggal;
}

// ----------------------------------------------------------------------------
// Normalize km_awal untuk storage: exact ODO ERROR check, lalu strip
// pemisah ribuan dan simpan sebagai integer
// ----------------------------------------------------------------------------
export function normalizeKmForStorage(kmValue) {
  if (kmValue === undefined || kmValue === null) return kmValue;
  const s = String(kmValue).trim();
  if (!s) return s;

  // Exact ODO ERROR check (case-insensitive, ignore spaces)
  const upper = s.toUpperCase().replace(/\s/g, '');
  if (upper === 'ODOERROR' || upper === 'ODOERR') return 'ODO ERROR';

  // Strip Indonesian thousand separators (dots) and store as integer
  const numeric = parseInt(s.replace(/\./g, '').replace(/,/g, ''), 10);
  if (!isNaN(numeric)) return numeric;

  return s;
}

// ----------------------------------------------------------------------------
// Helper ODO ERROR (exact, tanpa fuzzy matching) - dipakai buangan.js
// ----------------------------------------------------------------------------
export function isExactOdoVariant(s) {
  if (!s) return false;
  const u = s.toString().toUpperCase().replace(/\s/g, '').trim();
  return u === 'ODOERROR' || u === 'ODOERR';
}

// ----------------------------------------------------------------------------
// Parse km value dari DB - strip pemisah ribuan sebelum parse
// ----------------------------------------------------------------------------
export function parseKmFromDb(km) {
  if (km === null || km === undefined || km === '') return NaN;
  if (isExactOdoVariant(km)) return NaN;
  return parseInt(String(km).replace(/\./g, '').replace(/,/g, ''), 10);
}

// ----------------------------------------------------------------------------
// Normalize angka/uang generik (uang_jalan, potongan, harga_galian, harga,
// uang_alihan): strip pemisah ribuan '.' dan ',', hasilkan number.
// Extend dari normalizeKmForStorage tapi tanpa penanganan ODO ERROR dan
// mendukung desimal (parseFloat, bukan parseInt).
// ----------------------------------------------------------------------------
export function normalizeNumberForStorage(value) {
  if (value === undefined || value === null) return value;
  const s = String(value).trim();
  if (!s) return s;

  const numeric = parseFloat(s.replace(/\./g, '').replace(/,/g, ''));
  if (!isNaN(numeric)) return numeric;

  return s;
}

// ----------------------------------------------------------------------------
// Parse tanggal dari CSV: terima 'YYYY-MM-DD' atau 'DD/MM/YYYY'.
// Return string ternormalisasi 'YYYY-MM-DD', atau null jika format tidak valid.
// ----------------------------------------------------------------------------
function isValidCalendarDate(y, mo, d) {
  const year = parseInt(y, 10);
  const month = parseInt(mo, 10);
  const day = parseInt(d, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseTanggalCSV(input) {
  if (input === undefined || input === null) return null;
  const s = String(input).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return isValidCalendarDate(y, mo, d) ? `${y}-${mo}-${d}` : null;
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const dd = d.padStart(2, '0');
    const mm = mo.padStart(2, '0');
    return isValidCalendarDate(y, mm, dd) ? `${y}-${mm}-${dd}` : null;
  }

  return null;
}

// ----------------------------------------------------------------------------
// Parse jam dari CSV: terima 'HH:MM' atau 'HH:MM:SS'.
// Return string ternormalisasi 'HH:MM:SS', atau null jika tidak valid.
// ----------------------------------------------------------------------------
export function parseJamCSV(input) {
  if (input === undefined || input === null) return null;
  const s = String(input).trim();
  if (!s) return null;

  let m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
    }
    return null;
  }

  m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) {
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ss = parseInt(m[3], 10);
    if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60 && ss >= 0 && ss < 60) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    return null;
  }

  return null;
}

// ----------------------------------------------------------------------------
// Parse boolean dari CSV: terima ya/tidak, 1/0, true/false (case-insensitive).
// Kosong -> false. Return null jika nilai tidak dikenali (invalid).
// ----------------------------------------------------------------------------
export function parseBooleanCSV(input) {
  if (input === undefined || input === null) return false;
  const s = String(input).trim().toLowerCase();
  if (!s) return false;
  if (['ya', '1', 'true'].includes(s)) return true;
  if (['tidak', '0', 'false'].includes(s)) return false;
  return null;
}
