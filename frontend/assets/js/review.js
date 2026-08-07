// ============================================================================
// REVIEW DATA (BULK EDIT RITASI)
// ============================================================================

const API_BASE_URL = '/api';

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------
let originalData = [];         // data mentah terakhir dari server, keyed by rowKey
let dirtyChanges = {};         // { rowKey: { order_id, buangan_id, order:{}, buangan:{} } }
let selectedRows = new Set();  // Set<rowKey>
let hasLoadedOnce = false;     // true setelah loadReviewData() pernah sukses
let activeFetchController = null; // AbortController request /review/data yang sedang berjalan
let bannerLargeDismissed = false; // status dismiss banner kuning (501-1000 baris)

let masterKendaraan = [];
let masterSupir = [];
let masterGalian = [];
let masterProyek = [];

const REVIEW_FILTER_STORAGE_KEY = 'reviewLastFilters';

function rowKey(row) {
    return `o${row.order_id}_b${row.buangan_id ?? 'null'}`;
}

// ----------------------------------------------------------------------------
// FIELD DEFINITIONS
// group: 'order' | 'buangan'
// type: 'text' | 'date' | 'time' | 'number' | 'select' | 'checkbox' | 'readonly'
// ----------------------------------------------------------------------------
const FIELDS = [
    { key: 'tanggal_order', label: 'Tgl Order', group: 'order', type: 'date' },
    { key: 'no_order', label: 'No Order', group: 'order', type: 'text', sticky: true },
    { key: 'petugas_order', label: 'Petugas', group: 'order', type: 'text' },
    { key: 'kendaraan_id', label: 'Kendaraan', group: 'order', type: 'select', options: () => masterKendaraan, optionValue: 'id', optionLabel: 'no_pintu', displayKey: 'no_pintu' },
    { key: 'supir_id', label: 'Supir', group: 'order', type: 'select', options: () => masterSupir, optionValue: 'id', optionLabel: 'nama', displayKey: 'supir_nama' },
    { key: 'galian_id', label: 'Galian', group: 'order', type: 'select', options: () => masterGalian, optionValue: 'id', optionLabel: 'nama_galian', displayKey: 'nama_galian' },
    { key: 'no_do', label: 'No DO', group: 'order', type: 'text' },
    { key: 'jam_order', label: 'Jam Order', group: 'order', type: 'time' },
    { key: 'km_awal', label: 'KM Awal', group: 'order', type: 'text' },
    { key: 'uang_jalan', label: 'Uang Jalan', group: 'order', type: 'number' },
    { key: 'potongan', label: 'Potongan', group: 'order', type: 'number' },
    { key: 'hasil_akhir', label: 'Hasil Akhir', group: 'order', type: 'readonly' },
    { key: 'proyek_id', label: 'Proyek', group: 'order', type: 'select', options: () => masterProyek, optionValue: 'id', optionLabel: 'nama_proyek', displayKey: 'nama_proyek' },
    { key: 'status', label: 'Status', group: 'order', type: 'select', options: () => [{ id: 'ON PROCESS', nama: 'ON PROCESS' }, { id: 'COMPLETE', nama: 'COMPLETE' }, { id: 'BATAL', nama: 'BATAL' }], optionValue: 'id', optionLabel: 'nama', displayKey: 'status' },
    { key: 'tanggal_bongkar', label: 'Tgl Bongkar', group: 'buangan', type: 'date' },
    { key: 'jam_bongkar', label: 'Jam Bongkar', group: 'buangan', type: 'time' },
    { key: 'km_akhir', label: 'KM Akhir', group: 'buangan', type: 'text' },
    { key: 'jarak_km', label: 'Jarak KM', group: 'buangan', type: 'readonly' },
    { key: 'lokasi_bongkar', label: 'Lokasi Bongkar', group: 'buangan', type: 'text', datalist: 'dlLokasi' },
    { key: 'alihan', label: 'Alihan', group: 'buangan', type: 'checkbox' },
    { key: 'galian_alihan_id', label: 'Galian Alihan', group: 'buangan', type: 'select', options: () => masterGalian, optionValue: 'id', optionLabel: 'nama_galian', displayKey: 'galian_alihan_nama' },
    { key: 'keterangan', label: 'Keterangan', group: 'buangan', type: 'text' },
    { key: 'uang_alihan', label: 'Uang Alihan', group: 'buangan', type: 'number' },
    { key: 'no_urut', label: 'No Urut', group: 'buangan', type: 'number' },
];

// ----------------------------------------------------------------------------
// INIT
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    await loadMasterData();
    loadFilterOptions();
    populateIsiMassalFieldOptions();
    restoreLastFilters();

    ['filterTglOrderDari', 'filterTglOrderSampai', 'filterTglBongkarDari', 'filterTglBongkarSampai'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => { updateApplyButtonState(); clearActiveChip(); });
            el.addEventListener('change', () => { updateApplyButtonState(); clearActiveChip(); });
        }
    });
    updateApplyButtonState();
    // Data TIDAK di-fetch otomatis - user harus klik "Terapkan Filter" atau quick chip.
});

window.addEventListener('beforeunload', (e) => {
    if (Object.keys(dirtyChanges).length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// ----------------------------------------------------------------------------
// TOAST (pola disalin dari buangan.js, disesuaikan class prefix rv-)
// ----------------------------------------------------------------------------
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `rv-toast ${type} show`;
    setTimeout(() => { toast.className = 'rv-toast'; }, 3500);
}

// ----------------------------------------------------------------------------
// FETCH HELPER (tolerant unwrap, mengikuti pola rekap.js)
// ----------------------------------------------------------------------------
async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: options.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || result.status !== true) {
        const msg = (result && result.message) || `HTTP ${response.status}`;
        throw new Error(msg);
    }
    return result.data;
}

// ----------------------------------------------------------------------------
// MASTER DATA + FILTER OPTIONS
// ----------------------------------------------------------------------------
async function loadMasterData() {
    try {
        const [kendaraan, supir, galian, proyek] = await Promise.all([
            apiFetch('/master/kendaraan'),
            apiFetch('/master/supir'),
            apiFetch('/master/galian'),
            apiFetch('/master/proyek'),
        ]);
        masterKendaraan = kendaraan || [];
        masterSupir = supir || [];
        masterGalian = galian || [];
        masterProyek = proyek || [];

        populateSelect('filterProyek', masterProyek, 'id', 'nama_proyek');
        populateSelect('filterGalian', masterGalian, 'id', 'nama_galian');
        populateSelect('filterGalianAlihan', masterGalian, 'id', 'nama_galian', true);
        populateDatalist('dlKendaraan', masterKendaraan.map(k => k.no_pintu));
        populateDatalist('dlSupir', masterSupir.map(s => s.nama));
        populateIsiMassalFieldOptions();
    } catch (err) {
        console.error('Gagal memuat master data:', err);
        showToast('Gagal memuat master data: ' + err.message, 'error');
    }
}

function populateSelect(id, data, valueKey, labelKey, keepFirstOption = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const existingFirst = keepFirstOption ? el.querySelector('option') : null;
    el.innerHTML = '';
    if (existingFirst) el.appendChild(existingFirst);
    data.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item[valueKey];
        opt.textContent = item[labelKey];
        el.appendChild(opt);
    });
}

async function loadFilterOptions() {
    try {
        const data = await apiFetch('/rekap/filter-options');
        populateDatalist('dlNoDo', data.no_do || []);
        populateDatalist('dlPetugas', data.petugas_order || []);
        populateDatalist('dlLokasi', data.lokasi_bongkar || []);
    } catch (err) {
        console.error('Gagal memuat filter options:', err);
    }
}

function populateDatalist(id, values) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = values.map(v => `<option value="${String(v).replace(/"/g, '&quot;')}"></option>`).join('');
}

// ----------------------------------------------------------------------------
// FILTER BAR TOGGLE
// ----------------------------------------------------------------------------
function toggleFilterBar() {
    document.getElementById('filterSection').classList.toggle('collapsed');
}

function resetFilters() {
    if (Object.keys(dirtyChanges).length > 0) {
        if (!confirm('Ada perubahan yang belum disimpan. Reset filter akan membuang perubahan tersebut. Lanjutkan?')) {
            return;
        }
        dirtyChanges = {};
        updateDirtyIndicator();
    }

    document.querySelectorAll('.rv-filter-bar input').forEach(i => i.value = '');
    document.querySelectorAll('.rv-filter-bar select').forEach(s => {
        Array.from(s.options).forEach(o => o.selected = false);
        if (s.options.length && !s.multiple) s.selectedIndex = 0;
    });
    clearActiveChip();
    updateApplyButtonState();

    // Tanggal wajib sudah kosong setelah reset -> kembali ke empty-state,
    // bukan fetch ulang (fetch tanpa filter tanggal akan ditolak backend).
    hasLoadedOnce = false;
    originalData = [];
    selectedRows.clear();
    renderGrid();
    updateBulkBar();
    updateSummaryBar();
    document.getElementById('bannerTruncated').style.display = 'none';
    document.getElementById('bannerLarge').style.display = 'none';
    bannerLargeDismissed = false;
    localStorage.removeItem(REVIEW_FILTER_STORAGE_KEY);
}

function getSelectedValues(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    return Array.from(el.selectedOptions).map(o => o.value);
}

function buildFilterQuery() {
    const params = new URLSearchParams();

    const proyekIds = getSelectedValues('filterProyek');
    if (proyekIds.length) params.set('proyek_id', proyekIds.join(','));

    const galianIds = getSelectedValues('filterGalian');
    if (galianIds.length) params.set('galian_id', galianIds.join(','));

    const galianAlihan = document.getElementById('filterGalianAlihan').value;
    if (galianAlihan) params.set('galian_alihan_id', galianAlihan);

    const kendaraanText = document.getElementById('filterKendaraan').value.trim();
    if (kendaraanText) {
        const match = masterKendaraan.find(k => k.no_pintu === kendaraanText);
        if (match) params.set('kendaraan_id', match.id);
    }

    const supirText = document.getElementById('filterSupir').value.trim();
    if (supirText) {
        const match = masterSupir.find(s => s.nama === supirText);
        if (match) params.set('supir_id', match.id);
    }

    const petugas = document.getElementById('filterPetugas').value.trim();
    if (petugas) params.set('petugas_order', petugas);

    const noDo = document.getElementById('filterNoDo').value.trim();
    if (noDo) params.set('no_do', noDo);

    const lokasi = document.getElementById('filterLokasi').value.trim();
    if (lokasi) params.set('lokasi_bongkar', lokasi);

    const status = document.getElementById('filterStatus').value;
    if (status) params.set('status', status);

    const alihan = document.getElementById('filterAlihan').value;
    if (alihan !== '') params.set('alihan', alihan);

    const tglOrderDari = document.getElementById('filterTglOrderDari').value;
    if (tglOrderDari) params.set('tanggal_order_dari', tglOrderDari);
    const tglOrderSampai = document.getElementById('filterTglOrderSampai').value;
    if (tglOrderSampai) params.set('tanggal_order_sampai', tglOrderSampai);

    const tglBongkarDari = document.getElementById('filterTglBongkarDari').value;
    if (tglBongkarDari) params.set('tanggal_bongkar_dari', tglBongkarDari);
    const tglBongkarSampai = document.getElementById('filterTglBongkarSampai').value;
    if (tglBongkarSampai) params.set('tanggal_bongkar_sampai', tglBongkarSampai);

    return params.toString();
}

// ----------------------------------------------------------------------------
// VALIDASI FILTER TANGGAL WAJIB (poin B.4)
// ----------------------------------------------------------------------------
function hasDateFilter() {
    return !!(
        document.getElementById('filterTglOrderDari').value ||
        document.getElementById('filterTglOrderSampai').value ||
        document.getElementById('filterTglBongkarDari').value ||
        document.getElementById('filterTglBongkarSampai').value
    );
}

function updateApplyButtonState() {
    const btn = document.getElementById('btnApplyFilter');
    const hint = document.getElementById('filterDateHint');
    const ok = hasDateFilter();
    if (btn) btn.disabled = !ok;
    if (hint) hint.style.display = ok ? 'none' : 'inline';
}

// ----------------------------------------------------------------------------
// QUICK FILTER CHIPS (poin B.5)
// ----------------------------------------------------------------------------
function formatLocalDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function clearActiveChip() {
    document.querySelectorAll('.rv-chip').forEach(c => c.classList.remove('active'));
}

function applyQuickFilter(type) {
    const today = new Date();
    let dari, sampai;

    if (type === 'hari_ini') {
        dari = sampai = formatLocalDate(today);
    } else if (type === '2_hari') {
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        dari = formatLocalDate(twoDaysAgo);
        sampai = formatLocalDate(today);
    } else if (type === 'bulan_ini') {
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        dari = formatLocalDate(firstOfMonth);
        sampai = formatLocalDate(today);
    } else {
        return;
    }

    document.getElementById('filterTglOrderDari').value = dari;
    document.getElementById('filterTglOrderSampai').value = sampai;
    document.getElementById('filterTglBongkarDari').value = '';
    document.getElementById('filterTglBongkarSampai').value = '';

    clearActiveChip();
    const chipIdMap = { hari_ini: 'chipHariIni', '2_hari': 'chip2Hari', bulan_ini: 'chipBulanIni' };
    const chipEl = document.getElementById(chipIdMap[type]);
    if (chipEl) chipEl.classList.add('active');

    updateApplyButtonState();
    applyFilters();
}

// ----------------------------------------------------------------------------
// INGAT FILTER TERAKHIR (poin E.1)
// ----------------------------------------------------------------------------
function snapshotFilterValues() {
    return {
        filterProyek: getSelectedValues('filterProyek'),
        filterGalian: getSelectedValues('filterGalian'),
        filterGalianAlihan: document.getElementById('filterGalianAlihan').value,
        filterKendaraan: document.getElementById('filterKendaraan').value,
        filterSupir: document.getElementById('filterSupir').value,
        filterPetugas: document.getElementById('filterPetugas').value,
        filterNoDo: document.getElementById('filterNoDo').value,
        filterLokasi: document.getElementById('filterLokasi').value,
        filterStatus: document.getElementById('filterStatus').value,
        filterAlihan: document.getElementById('filterAlihan').value,
        filterTglOrderDari: document.getElementById('filterTglOrderDari').value,
        filterTglOrderSampai: document.getElementById('filterTglOrderSampai').value,
        filterTglBongkarDari: document.getElementById('filterTglBongkarDari').value,
        filterTglBongkarSampai: document.getElementById('filterTglBongkarSampai').value,
    };
}

function saveFiltersToLocalStorage() {
    try {
        localStorage.setItem(REVIEW_FILTER_STORAGE_KEY, JSON.stringify(snapshotFilterValues()));
    } catch (err) {
        console.warn('Gagal menyimpan filter ke localStorage:', err);
    }
}

function restoreLastFilters() {
    let saved;
    try {
        const raw = localStorage.getItem(REVIEW_FILTER_STORAGE_KEY);
        if (!raw) return;
        saved = JSON.parse(raw);
    } catch (err) {
        console.warn('Gagal membaca filter tersimpan:', err);
        return;
    }
    if (!saved || typeof saved !== 'object') return;

    const setMultiSelect = (id, values) => {
        const el = document.getElementById(id);
        if (!el || !Array.isArray(values)) return;
        Array.from(el.options).forEach(o => { o.selected = values.includes(o.value); });
    };

    setMultiSelect('filterProyek', saved.filterProyek);
    setMultiSelect('filterGalian', saved.filterGalian);

    const simpleFields = [
        'filterGalianAlihan', 'filterKendaraan', 'filterSupir', 'filterPetugas',
        'filterNoDo', 'filterLokasi', 'filterStatus', 'filterAlihan',
        'filterTglOrderDari', 'filterTglOrderSampai', 'filterTglBongkarDari', 'filterTglBongkarSampai',
    ];
    simpleFields.forEach(id => {
        const el = document.getElementById(id);
        if (el && saved[id] !== undefined) el.value = saved[id];
    });

    updateApplyButtonState();
}

function applyFilters() {
    if (!hasDateFilter()) {
        showToast('Pilih rentang tanggal terlebih dahulu (Tanggal Order atau Tanggal Bongkar).', 'warning');
        return;
    }
    if (Object.keys(dirtyChanges).length > 0) {
        if (!confirm('Ada perubahan yang belum disimpan. Menerapkan filter akan membuang perubahan tersebut. Lanjutkan?')) {
            return;
        }
        dirtyChanges = {};
        updateDirtyIndicator();
    }
    saveFiltersToLocalStorage();
    loadReviewData();
}

// ----------------------------------------------------------------------------
// LOADING STATE HELPERS (poin C.2)
// ----------------------------------------------------------------------------
function setFilterControlsBusy(busy) {
    const btn = document.getElementById('btnApplyFilter');
    if (btn) {
        btn.disabled = busy || !hasDateFilter();
        btn.innerHTML = busy ? '<span class="rv-spinner"></span> Memuat...' : 'Terapkan Filter';
    }
    ['chipHariIni', 'chip2Hari', 'chipBulanIni'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = busy;
    });
}

function renderSkeletonRows() {
    const cols = 24;
    const row = `<tr>${Array.from({ length: cols }).map(() => `<td><div class="rv-skeleton-bar"></div></td>`).join('')}</tr>`;
    return Array.from({ length: 8 }).map(() => row).join('');
}

// ----------------------------------------------------------------------------
// DATA SIZE BANNER (poin C.2)
// ----------------------------------------------------------------------------
function updateDataSizeBanner({ total, shown, truncated }) {
    const bannerTruncated = document.getElementById('bannerTruncated');
    const bannerLarge = document.getElementById('bannerLarge');
    const bannerLargeText = document.getElementById('bannerLargeText');

    if (truncated) {
        bannerTruncated.style.display = 'flex';
        bannerTruncated.textContent = `Menampilkan ${shown} dari ${total} data yang cocok. Data dibatasi karena terlalu banyak — persempit filter (tanggal/proyek/dll) untuk melihat sisanya.`;
        bannerLarge.style.display = 'none';
        return;
    }

    bannerTruncated.style.display = 'none';

    if (total > 500) {
        if (!bannerLargeDismissed) {
            bannerLarge.style.display = 'flex';
            bannerLargeText.textContent = `Menampilkan ${total} baris. Untuk performa lebih baik, pertimbangkan mempersempit filter.`;
        }
    } else {
        bannerLarge.style.display = 'none';
        bannerLargeDismissed = false;
    }
}

function dismissBannerLarge() {
    bannerLargeDismissed = true;
    document.getElementById('bannerLarge').style.display = 'none';
}

// ----------------------------------------------------------------------------
// LOAD DATA
// ----------------------------------------------------------------------------
async function loadReviewData() {
    if (activeFetchController) {
        activeFetchController.abort();
    }
    activeFetchController = new AbortController();
    const { signal } = activeFetchController;

    const tbody = document.getElementById('gridBody');
    tbody.innerHTML = renderSkeletonRows();
    setFilterControlsBusy(true);

    try {
        const query = buildFilterQuery();
        const result = await apiFetch(`/review/data${query ? '?' + query : ''}`, { signal });
        const { rows, total, limit, truncated } = result;
        originalData = rows || [];
        selectedRows.clear();
        hasLoadedOnce = true;
        renderGrid();
        updateBulkBar();
        updateSummaryBar();
        updateDataSizeBanner({ total, shown: originalData.length, truncated });
    } catch (err) {
        if (err.name === 'AbortError') {
            return;
        }
        console.error('Gagal memuat data review:', err);
        tbody.innerHTML = `<tr><td colspan="24" class="rv-loading">Gagal memuat data: ${escapeHtml(err.message)}</td></tr>`;
        showToast('Gagal memuat data review: ' + err.message, 'error');
    } finally {
        setFilterControlsBusy(false);
    }
}

function updateSummaryBar() {
    const total = originalData.length;
    const complete = originalData.filter(r => r.status === 'COMPLETE').length;
    const process = originalData.filter(r => r.status === 'ON PROCESS').length;
    const batal = originalData.filter(r => r.status === 'BATAL').length;

    document.getElementById('summaryTotal').textContent = total;
    document.getElementById('summaryComplete').textContent = complete;
    document.getElementById('summaryProcess').textContent = process;
    document.getElementById('summaryBatal').textContent = batal;
}

// ----------------------------------------------------------------------------
// RENDER GRID
// ----------------------------------------------------------------------------
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isOdoError(value) {
    if (value === null || value === undefined) return false;
    const u = String(value).toUpperCase().replace(/\s/g, '');
    return u === 'ODOERROR' || u === 'ODOERR';
}

function isRowBermasalah(row) {
    if (!row.buangan_id) return false;
    if (row.km_akhir === null || row.km_akhir === '' || isOdoError(row.km_akhir)) return true;
    if (row.jarak_km === null || isOdoError(row.jarak_km)) return true;
    const jarakNum = parseFloat(row.jarak_km);
    if (!isNaN(jarakNum) && jarakNum < 0) return true;
    return false;
}

function getEffectiveValue(row, field) {
    const key = rowKey(row);
    const change = dirtyChanges[key];
    if (change) {
        const group = change[field.group];
        if (group && group[field.key] !== undefined) {
            return { value: group[field.key], dirty: true };
        }
    }
    return { value: row[field.key], dirty: false };
}

function displayValue(row, field, value) {
    if (field.type === 'select' && field.displayKey) {
        const change = dirtyChanges[rowKey(row)];
        const isDirty = change && change[field.group] && change[field.group][field.key] !== undefined;
        if (isDirty) {
            const opts = field.options();
            const found = opts.find(o => String(o[field.optionValue]) === String(value));
            return found ? found[field.optionLabel] : '';
        }
        return row[field.displayKey] ?? '';
    }
    if (field.type === 'checkbox') {
        return value ? 'Ya' : 'Tidak';
    }
    if (value === null || value === undefined) return '';
    return value;
}

function statusBadgeHtml(status) {
    const s = (status || '').toUpperCase();
    let cls = 'rv-status-cancel';
    if (s === 'COMPLETE') cls = 'rv-status-complete';
    else if (s === 'ON PROCESS') cls = 'rv-status-process';
    return `<span class="rv-status-badge ${cls}">${escapeHtml(status || '-')}</span>`;
}

function renderGrid() {
    const tbody = document.getElementById('gridBody');

    if (!hasLoadedOnce) {
        tbody.innerHTML = `<tr><td colspan="24" class="rv-empty-state">
            <span class="rv-empty-state-icon">🗂️</span>
            <div class="rv-empty-state-text">
                Belum ada data ditampilkan. Atur filter di atas, lalu klik <strong>Terapkan Filter</strong> untuk memuat data.
            </div>
        </td></tr>`;
        return;
    }

    if (originalData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="24" class="rv-empty">Tidak ada data untuk filter ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = originalData.map(row => {
        const key = rowKey(row);
        const problem = isRowBermasalah(row);
        const isBatal = row.status === 'BATAL';
        const checked = selectedRows.has(key) ? 'checked' : '';

        const cells = FIELDS.map(field => {
            const { value, dirty } = getEffectiveValue(row, field);
            const display = displayValue(row, field, value);
            const classes = [];
            if (field.type === 'readonly') {
                classes.push('rv-cell-readonly');
            } else {
                classes.push('rv-cell-editable');
            }
            if (dirty) classes.push('rv-cell-dirty');

            const undoIcon = dirty
                ? `<span class="rv-undo-icon" title="Batalkan perubahan sel ini" onclick="undoCellChange(event, '${key}', '${field.group}', '${field.key}')">↺</span>`
                : '';

            if (field.type === 'checkbox') {
                const isChecked = value ? 'checked' : '';
                return `<td class="${classes.join(' ')}" data-key="${key}" data-field="${field.key}" data-group="${field.group}">
                    <input type="checkbox" class="rv-checkbox-toggle" ${isChecked} ${field.type === 'readonly' ? 'disabled' : ''} onchange="onCellCheckboxChange('${key}', '${field.group}', '${field.key}', this.checked)">${undoIcon}
                </td>`;
            }

            if (field.type === 'readonly') {
                return `<td class="${classes.join(' ')}">${escapeHtml(display)}</td>`;
            }

            if (field.key === 'status') {
                return `<td class="${classes.join(' ')}" data-key="${key}" data-field="${field.key}" data-group="${field.group}" onclick="startCellEdit(this, '${key}', '${field.group}', '${field.key}')">${statusBadgeHtml(display)}${undoIcon}</td>`;
            }

            return `<td class="${classes.join(' ')}" data-key="${key}" data-field="${field.key}" data-group="${field.group}" onclick="startCellEdit(this, '${key}', '${field.group}', '${field.key}')">${escapeHtml(display)}${undoIcon}</td>`;
        }).join('');

        return `<tr class="${problem ? 'rv-row-problem' : ''} ${isBatal ? 'rv-row-batal' : ''}" data-key="${key}">
            <td class="rv-sticky-col rv-col-check"><input type="checkbox" ${checked} onchange="toggleRowSelect('${key}', this.checked)"></td>
            <td class="rv-sticky-col rv-col-noorder">${escapeHtml(row.no_order || '')}</td>
            ${cells}
        </tr>`;
    }).join('');
}

// ----------------------------------------------------------------------------
// CELL EDITING
// ----------------------------------------------------------------------------
function findRowByKey(key) {
    return originalData.find(r => rowKey(r) === key);
}

function findField(fieldKey) {
    return FIELDS.find(f => f.key === fieldKey);
}

function ensureDirtyEntry(key, row) {
    if (!dirtyChanges[key]) {
        dirtyChanges[key] = { order_id: row.order_id, buangan_id: row.buangan_id, order: {}, buangan: {} };
    }
    return dirtyChanges[key];
}

function setCellValue(key, group, fieldKey, value) {
    const row = findRowByKey(key);
    if (!row) return;
    const entry = ensureDirtyEntry(key, row);
    entry[group][fieldKey] = value;
    updateDirtyIndicator();
    renderGrid();
}

function onCellCheckboxChange(key, group, fieldKey, checked) {
    setCellValue(key, group, fieldKey, checked);
}

// Undo perubahan satu field saja (poin E.2) - tidak mempengaruhi field lain
// di baris yang sama atau baris lainnya.
function undoCellChange(event, key, group, fieldKey) {
    if (event) event.stopPropagation();
    const entry = dirtyChanges[key];
    if (!entry) return;
    delete entry[group][fieldKey];
    if (Object.keys(entry.order).length === 0 && Object.keys(entry.buangan).length === 0) {
        delete dirtyChanges[key];
    }
    updateDirtyIndicator();
    renderGrid();
}

// Urutan field yang dibuka lewat startCellEdit (skip readonly & checkbox,
// karena checkbox punya mode edit sendiri via onchange langsung). Dipakai
// untuk navigasi keyboard Tab/Shift+Tab (poin E.3).
function getEditableFieldSequence() {
    return FIELDS.filter(f => f.type !== 'readonly' && f.type !== 'checkbox');
}

function getCellElement(key, fieldKey) {
    return document.querySelector(`td[data-key="${key}"][data-field="${fieldKey}"]`);
}

function startCellEdit(td, key, group, fieldKey) {
    if (td.querySelector('input,select')) return; // sudah dalam mode edit
    const row = findRowByKey(key);
    if (!row) return;
    const field = findField(fieldKey);
    if (!field) return;

    const { value } = getEffectiveValue(row, field);
    let inputHtml = '';

    if (field.type === 'select') {
        const opts = field.options();
        inputHtml = `<select class="rv-cell-input" onchange="onCellInputCommit('${key}','${group}','${fieldKey}', this.value)" onblur="renderGrid()">
            <option value="">-</option>
            ${opts.map(o => `<option value="${o[field.optionValue]}" ${String(o[field.optionValue]) === String(value) ? 'selected' : ''}>${escapeHtml(o[field.optionLabel])}</option>`).join('')}
        </select>`;
    } else if (field.type === 'date') {
        inputHtml = `<input type="date" class="rv-cell-input" value="${value || ''}" onchange="onCellInputCommit('${key}','${group}','${fieldKey}', this.value)" onblur="renderGrid()">`;
    } else if (field.type === 'time') {
        const timeVal = value ? String(value).substring(0, 5) : '';
        inputHtml = `<input type="time" class="rv-cell-input" value="${timeVal}" onchange="onCellInputCommit('${key}','${group}','${fieldKey}', this.value)" onblur="renderGrid()">`;
    } else if (field.type === 'number') {
        inputHtml = `<input type="number" class="rv-cell-input" value="${value ?? ''}" onchange="onCellInputCommit('${key}','${group}','${fieldKey}', this.value)" onblur="renderGrid()">`;
    } else {
        const datalistAttr = field.datalist ? `list="${field.datalist}"` : '';
        inputHtml = `<input type="text" class="rv-cell-input" ${datalistAttr} value="${escapeHtml(value ?? '')}" onchange="onCellInputCommit('${key}','${group}','${fieldKey}', this.value)" onblur="renderGrid()">`;
    }

    td.innerHTML = inputHtml;
    const inputEl = td.querySelector('input,select');
    if (inputEl) {
        inputEl.focus();
        if (inputEl.select) inputEl.select();
        inputEl.addEventListener('keydown', (e) => handleCellKeydown(e, inputEl, key, group, fieldKey));
    }
}

function onCellInputCommit(key, group, fieldKey, rawValue) {
    const field = findField(fieldKey);
    let value = rawValue;
    if (field.type === 'number') {
        value = rawValue === '' ? null : parseFloat(rawValue);
    }
    setCellValue(key, group, fieldKey, value);
}

// Navigasi keyboard ala spreadsheet (poin E.3): Tab/Shift+Tab pindah kolom,
// Enter pindah baris (kolom sama), Escape batalkan tanpa commit.
function handleCellKeydown(e, inputEl, key, group, fieldKey) {
    if (e.key === 'Escape') {
        e.preventDefault();
        renderGrid();
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        onCellInputCommit(key, group, fieldKey, inputEl.value);
        moveToNextRowSameField(key, fieldKey);
        return;
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        onCellInputCommit(key, group, fieldKey, inputEl.value);
        moveToAdjacentField(key, fieldKey, e.shiftKey ? -1 : 1);
    }
}

function moveToNextRowSameField(key, fieldKey) {
    const idx = originalData.findIndex(r => rowKey(r) === key);
    if (idx === -1 || idx + 1 >= originalData.length) return;
    const nextRow = originalData[idx + 1];
    const nextKey = rowKey(nextRow);
    const field = findField(fieldKey);
    if (!field) return;
    const td = getCellElement(nextKey, fieldKey);
    if (td) startCellEdit(td, nextKey, field.group, fieldKey);
}

function moveToAdjacentField(key, fieldKey, direction) {
    const sequence = getEditableFieldSequence();
    const fieldIdx = sequence.findIndex(f => f.key === fieldKey);
    if (fieldIdx === -1) return;

    const rowIdx = originalData.findIndex(r => rowKey(r) === key);
    if (rowIdx === -1) return;

    let nextFieldIdx = fieldIdx + direction;
    let nextRowIdx = rowIdx;

    if (nextFieldIdx >= sequence.length) {
        nextFieldIdx = 0;
        nextRowIdx = rowIdx + 1;
    } else if (nextFieldIdx < 0) {
        nextFieldIdx = sequence.length - 1;
        nextRowIdx = rowIdx - 1;
    }

    if (nextRowIdx < 0 || nextRowIdx >= originalData.length) return; // sudah di batas grid

    const nextField = sequence[nextFieldIdx];
    const nextRow = originalData[nextRowIdx];
    const nextKey = rowKey(nextRow);
    const td = getCellElement(nextKey, nextField.key);
    if (td) startCellEdit(td, nextKey, nextField.group, nextField.key);
}

function updateDirtyIndicator() {
    const hasChanges = Object.keys(dirtyChanges).length > 0;
    document.getElementById('dirtyIndicator').style.display = hasChanges ? 'inline-block' : 'none';
}

// ----------------------------------------------------------------------------
// ROW SELECTION
// ----------------------------------------------------------------------------
function toggleRowSelect(key, checked) {
    if (checked) selectedRows.add(key);
    else selectedRows.delete(key);
    updateBulkBar();
}

function toggleSelectAll() {
    const checkAll = document.getElementById('checkAll').checked;
    selectedRows.clear();
    if (checkAll) {
        originalData.forEach(row => selectedRows.add(rowKey(row)));
    }
    renderGrid();
    updateBulkBar();
}

function updateBulkBar() {
    const bar = document.getElementById('bulkBar');
    const count = selectedRows.size;
    if (count > 0) {
        bar.style.display = 'flex';
        document.getElementById('bulkCount').textContent = `${count} baris dipilih`;
    } else {
        bar.style.display = 'none';
    }
}

function getSelectedRowObjects() {
    return originalData.filter(row => selectedRows.has(rowKey(row)));
}

// ----------------------------------------------------------------------------
// ISI MASSAL
// ----------------------------------------------------------------------------
function populateIsiMassalFieldOptions() {
    const select = document.getElementById('isiMassalField');
    if (!select) return;
    select.innerHTML = FIELDS.filter(f => f.type !== 'readonly')
        .map(f => `<option value="${f.key}">${f.label}</option>`).join('');
    renderIsiMassalValueInput();
}

function renderIsiMassalValueInput() {
    const fieldKey = document.getElementById('isiMassalField').value;
    const field = findField(fieldKey);
    const wrap = document.getElementById('isiMassalValueWrap');
    if (!field) return;

    if (field.type === 'select') {
        const opts = field.options();
        wrap.innerHTML = `<label>Nilai Baru</label><select id="isiMassalValue"><option value="">-</option>${opts.map(o => `<option value="${o[field.optionValue]}">${escapeHtml(o[field.optionLabel])}</option>`).join('')}</select>`;
    } else if (field.type === 'checkbox') {
        wrap.innerHTML = `<label><input type="checkbox" id="isiMassalValue"> Aktif (Ya)</label>`;
    } else if (field.type === 'date') {
        wrap.innerHTML = `<label>Nilai Baru</label><input type="date" id="isiMassalValue">`;
    } else if (field.type === 'time') {
        wrap.innerHTML = `<label>Nilai Baru</label><input type="time" id="isiMassalValue">`;
    } else if (field.type === 'number') {
        wrap.innerHTML = `<label>Nilai Baru</label><input type="number" id="isiMassalValue">`;
    } else {
        wrap.innerHTML = `<label>Nilai Baru</label><input type="text" id="isiMassalValue">`;
    }
}

function openIsiMassalModal() {
    if (selectedRows.size === 0) return;
    populateIsiMassalFieldOptions();
    openModal('modalIsiMassal');
}

function terapkanIsiMassal() {
    const fieldKey = document.getElementById('isiMassalField').value;
    const field = findField(fieldKey);
    const valueEl = document.getElementById('isiMassalValue');
    let value;
    if (field.type === 'checkbox') {
        value = valueEl.checked;
    } else if (field.type === 'number') {
        value = valueEl.value === '' ? null : parseFloat(valueEl.value);
    } else {
        value = valueEl.value;
    }

    getSelectedRowObjects().forEach(row => {
        if (field.group === 'buangan' && !row.buangan_id) return; // skip baris tanpa buangan
        const key = rowKey(row);
        const entry = ensureDirtyEntry(key, row);
        entry[field.group][field.key] = value;
    });

    updateDirtyIndicator();
    renderGrid();
    closeModal('modalIsiMassal');
    showToast('Isi massal diterapkan ke baris terpilih (belum disimpan)', 'success');
}

// ----------------------------------------------------------------------------
// BATAL MASSAL
// ----------------------------------------------------------------------------
function openBatalModal() {
    if (selectedRows.size === 0) return;
    renderBatalKeteranganInputs();
    openModal('modalBatal');
}

function renderBatalKeteranganInputs() {
    const mode = document.querySelector('input[name="keteranganMode"]:checked').value;
    const area = document.getElementById('batalKeteranganArea');
    if (mode === 'shared') {
        area.innerHTML = `<div class="rv-form-field"><label>Keterangan</label><textarea id="keteranganShared" rows="3"></textarea></div>`;
    } else {
        const rows = getSelectedRowObjects();
        area.innerHTML = rows.map(row => `
            <div class="rv-per-row-item">
                <label>${escapeHtml(row.no_order || ('Order #' + row.order_id))}</label>
                <textarea rows="2" data-order-id="${row.order_id}" class="rv-per-row-keterangan"></textarea>
            </div>
        `).join('');
    }
}

async function submitBatalMassal() {
    const mode = document.querySelector('input[name="keteranganMode"]:checked').value;
    const orderIds = getSelectedRowObjects().map(row => row.order_id);
    const body = { order_ids: orderIds, keterangan_mode: mode };

    if (mode === 'shared') {
        body.keterangan_shared = document.getElementById('keteranganShared').value;
    } else {
        const perRow = {};
        document.querySelectorAll('.rv-per-row-keterangan').forEach(el => {
            perRow[el.dataset.orderId] = el.value;
        });
        body.keterangan_per_row = perRow;
    }

    try {
        const result = await apiFetch('/review/bulk-batal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        closeModal('modalBatal');
        showToast(`Berhasil membatalkan ${result.updated} order${result.failed.length ? `, ${result.failed.length} gagal` : ''}`, result.failed.length ? 'warning' : 'success');
        if (result.failed.length) console.warn('Bulk batal gagal:', result.failed);
        await loadReviewData();
    } catch (err) {
        console.error('Gagal bulk batal:', err);
        showToast('Gagal membatalkan order: ' + err.message, 'error');
    }
}

// ----------------------------------------------------------------------------
// UN-BATAL MASSAL
// ----------------------------------------------------------------------------
async function doUnBatal() {
    if (selectedRows.size === 0) return;
    if (!confirm(`Un-batal ${selectedRows.size} order terpilih?`)) return;

    const orderIds = getSelectedRowObjects().map(row => row.order_id);
    try {
        const result = await apiFetch('/review/bulk-unbatal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: orderIds }),
        });
        showToast(`Berhasil un-batal ${result.updated} order${result.failed.length ? `, ${result.failed.length} gagal` : ''}`, result.failed.length ? 'warning' : 'success');
        if (result.failed.length) console.warn('Bulk un-batal gagal:', result.failed);
        await loadReviewData();
    } catch (err) {
        console.error('Gagal bulk un-batal:', err);
        showToast('Gagal un-batal order: ' + err.message, 'error');
    }
}

// ----------------------------------------------------------------------------
// HITUNG ULANG JARAK KM
// ----------------------------------------------------------------------------
async function doRecalcJarak() {
    if (selectedRows.size === 0) return;
    const rows = getSelectedRowObjects();
    const buanganIds = rows.filter(r => r.buangan_id).map(r => r.buangan_id);
    const skipped = rows.length - buanganIds.length;

    if (buanganIds.length === 0) {
        showToast('Tidak ada baris terpilih yang punya data buangan', 'warning');
        return;
    }

    try {
        const result = await apiFetch('/review/recalc-jarak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buangan_ids: buanganIds }),
        });
        let msg = `Berhasil hitung ulang jarak untuk ${result.updated} baris`;
        if (result.failed.length) msg += `, ${result.failed.length} gagal`;
        if (skipped) msg += `, ${skipped} baris dilewati (tanpa data buangan)`;
        showToast(msg, result.failed.length ? 'warning' : 'success');
        if (result.failed.length) console.warn('Recalc jarak gagal:', result.failed);
        await loadReviewData();
    } catch (err) {
        console.error('Gagal recalc jarak:', err);
        showToast('Gagal menghitung ulang jarak KM: ' + err.message, 'error');
    }
}

// ----------------------------------------------------------------------------
// HAPUS RITASI MASSAL
// ----------------------------------------------------------------------------
function openDeleteModal() {
    if (selectedRows.size === 0) return;
    document.getElementById('deleteConfirmInput').value = '';
    document.getElementById('btnConfirmDelete').disabled = true;
    openModal('modalDelete');
}

function validateDeleteConfirm() {
    const val = document.getElementById('deleteConfirmInput').value.trim().toUpperCase();
    document.getElementById('btnConfirmDelete').disabled = val !== 'HAPUS';
}

async function submitDeleteMassal() {
    const rows = getSelectedRowObjects();
    const buanganIds = rows.filter(r => r.buangan_id).map(r => r.buangan_id);

    if (buanganIds.length === 0) {
        showToast('Tidak ada baris terpilih yang punya data buangan untuk dihapus', 'warning');
        closeModal('modalDelete');
        return;
    }

    try {
        const result = await apiFetch('/review/bulk-delete-ritasi', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buangan_ids: buanganIds, confirm: true }),
        });
        closeModal('modalDelete');
        showToast(`Berhasil menghapus ${result.deleted} ritasi${result.failed.length ? `, ${result.failed.length} gagal` : ''}`, result.failed.length ? 'warning' : 'success');
        if (result.failed.length) console.warn('Bulk delete gagal:', result.failed);
        await loadReviewData();
    } catch (err) {
        console.error('Gagal bulk delete ritasi:', err);
        showToast('Gagal menghapus ritasi: ' + err.message, 'error');
    }
}

// ----------------------------------------------------------------------------
// SIMPAN / BATALKAN SEMUA PERUBAHAN
// ----------------------------------------------------------------------------
async function saveAllChanges() {
    const keys = Object.keys(dirtyChanges);
    if (keys.length === 0) {
        showToast('Tidak ada perubahan untuk disimpan', 'warning');
        return;
    }

    const rows = keys.map(key => {
        const entry = dirtyChanges[key];
        const payload = { order_id: entry.order_id, buangan_id: entry.buangan_id };
        if (Object.keys(entry.order).length > 0) payload.order = entry.order;
        if (Object.keys(entry.buangan).length > 0) payload.buangan = entry.buangan;
        return payload;
    });

    try {
        const result = await apiFetch('/review/bulk-update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows }),
        });
        let msg = `Berhasil menyimpan ${result.updated} baris`;
        if (result.failed.length) msg += `, ${result.failed.length} gagal`;
        showToast(msg, result.failed.length ? 'warning' : 'success');
        if (result.failed.length) {
            console.warn('Bulk update gagal untuk sebagian baris:', result.failed);
        }
        dirtyChanges = {};
        updateDirtyIndicator();
        await loadReviewData();
    } catch (err) {
        console.error('Gagal menyimpan perubahan:', err);
        showToast('Gagal menyimpan perubahan: ' + err.message, 'error');
    }
}

function discardAllChanges() {
    if (Object.keys(dirtyChanges).length === 0) return;
    if (!confirm('Batalkan semua perubahan yang belum disimpan?')) return;
    dirtyChanges = {};
    updateDirtyIndicator();
    renderGrid();
    showToast('Semua perubahan dibatalkan', 'success');
}

// ----------------------------------------------------------------------------
// MODAL HELPERS
// ----------------------------------------------------------------------------
function openModal(id) {
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}
