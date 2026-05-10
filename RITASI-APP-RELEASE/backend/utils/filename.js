// Shared filename generator used by PDF and Excel exports
// Returns a sanitized filename and an RFC5987-encoded version for safe headers
export function generateFilename(baseName, filterInfo) {
  let filename = (baseName || "Export").toString();
  const filterParts = [];

  if (filterInfo && filterInfo.filters) {
    // Prioritize period filters
    const makePeriodPart = (label, value) => {
      if (!value) return null;
      const clean = value
        .replace(/s\/d/gi, '_sd_')
        .replace(/\//g, '-')
        .replace(/\s+/g, '_');
      return `${label}_${clean}`;
    };

    const p1 = makePeriodPart('Periode', filterInfo.filters['Periode']);
    const p2 = makePeriodPart('Order', filterInfo.filters['Periode Order']);
    const p3 = makePeriodPart('Bongkar', filterInfo.filters['Periode Bongkar']);
    [p1, p2, p3].forEach(p => { if (p) filterParts.push(p); });

    // Add other important filters (limit to 3)
    const priorityFilters = ["Proyek", "Petugas", "Lokasi Bongkar", "Kendaraan", "Supir", "Galian", "Status", "Galian Alihan", "No Order", "Alihan"];
    let addedCount = 0;

    for (const filterKey of priorityFilters) {
      if (addedCount >= 3) break;
      const val = filterInfo.filters[filterKey];
      if (val !== undefined && val !== null && String(val).toString().trim() !== '') {
        // Remove redundant label words from the value (e.g., "Proyek Proyek ABC" -> "Proyek ABC")
        let tmp = String(val).trim();
        try {
          const labelRe = new RegExp(filterKey.replace(/\s+/g, '\\s+'), 'i');
          tmp = tmp.replace(labelRe, '').trim();
        } catch (e) {
          // ignore regex issues
        }

        const cleanValue = tmp
          .replace(/[<>:\"/\\|?*]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 15);
        filterParts.push(`${filterKey.replace(/\s+/g, '_')}_${cleanValue}`);
        addedCount++;
      }
    }
  }

  if (filterParts.length > 0) {
    const filterString = filterParts.join('_').substring(0, 100);
    filename = `${filename}_${filterString}`;
  }

  // Add timestamp for uniqueness (YYYY-MM-DD)
  const timestamp = new Date().toISOString().slice(0, 10); // e.g., 2026-01-06
  filename = `${filename}_${timestamp}`;

  // Final sanitization: replace invalid chars, collapse underscores, trim, limit length
  filename = filename
    .replace(/[^\w\d\-_.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim()
    .substring(0, 120);

  // Prepare RFC5987 encoded version (for filename*=)
  const encoded = encodeURIComponent(filename);

  return { filename, encoded };
}
