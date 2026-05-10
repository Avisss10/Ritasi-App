import { generateFilename } from './filename.js';

const tests = [
  { base: 'Rekap_Order', filters: { Periode: '01/01/2026 s/d 03/01/2026', Proyek: 'Proyek ABC' } },
  { base: 'Rekap_Buangan', filters: { Periode: 'Hari Ini', "Lokasi Bongkar": 'TPS Selatan', Alihan: '1' } },
  { base: 'Rekap_Gabungan', filters: { 'Periode Order': '02/01/2026 s/d 02/01/2026', "Galian": 'Galian X Nama Yang Sangat Panjang', 'Petugas': 'Budi' } },
  { base: 'Rekap_Order', filters: {} },
  { base: 'Rekap_Order', filters: { 'No Order': 'ORD/1234', Status: 'ON PROCESS' } }
];

for (const t of tests) {
  const { filename, encoded } = generateFilename(t.base, { filters: t.filters });
  console.log('Base:', t.base, '\nFilters:', t.filters, '\n=> filename:', filename, '\n=> encoded:', encoded, '\n');
}