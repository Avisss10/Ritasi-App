// Konfigurasi API
const API_BASE_URL = 'http://localhost:3000/api';

// ============================================================================
// KONFIGURASI PANEL PER ENTITAS
// ============================================================================
const PANEL_DEFS = {
    kendaraan: { label: 'Kendaraan', columns: [{ key: 'no_pintu', label: 'No. Pintu' }] },
    supir: { label: 'Supir', columns: [{ key: 'nama', label: 'Nama' }] },
    galian: { label: 'Galian', columns: [{ key: 'nama_galian', label: 'Nama Galian' }, { key: 'harga_galian', label: 'Harga' }] },
    proyek: { label: 'Proyek', columns: [{ key: 'nama_proyek', label: 'Nama Proyek' }, { key: 'harga', label: 'Harga' }] },
    ritasi: {
        label: 'Ritasi',
        columns: [
            { key: 'tanggal_order', label: 'Tgl Order' },
            { key: 'no_order', label: 'No Order' },
            { key: 'petugas_order', label: 'Petugas' },
            { key: 'no_pintu', label: 'Kendaraan', resolvable: 'no_pintu' },
            { key: 'nama_supir', label: 'Supir', resolvable: 'nama_supir' },
            { key: 'nama_galian', label: 'Galian', resolvable: 'nama_galian' },
            { key: 'nama_proyek', label: 'Proyek', resolvable: 'nama_proyek' },
            { key: 'no_do', label: 'No DO' },
            { key: 'jam_order', label: 'Jam Order' },
            { key: 'km_awal', label: 'KM Awal' },
            { key: 'uang_jalan', label: 'Uang Jalan' },
            { key: 'potongan', label: 'Potongan' },
            { key: 'batal', label: 'Batal' },
            { key: 'keterangan', label: 'Keterangan' },
            { key: 'tanggal_bongkar', label: 'Tgl Bongkar' },
            { key: 'jam_bongkar', label: 'Jam Bongkar' },
            { key: 'km_akhir', label: 'KM Akhir' },
            { key: 'jarak_km', label: 'Jarak KM' },
            { key: 'lokasi_bongkar', label: 'Lokasi' },
            { key: 'alihan', label: 'Alihan' },
            { key: 'nama_galian_alihan', label: 'Galian Alihan', resolvable: 'nama_galian_alihan' },
            { key: 'uang_alihan', label: 'Uang Alihan' },
            { key: 'no_urut', label: 'No Urut' },
        ],
    },
    'mobil-luar': {
        label: 'Mobil Luar',
        columns: [
            { key: 'no_urut', label: 'No Urut' },
            { key: 'pengirim', label: 'Pengirim' },
            { key: 'galian', label: 'Galian' },
            { key: 'no_plat', label: 'No Plat' },
            { key: 'supir', label: 'Supir' },
            { key: 'tanggal_bongkar', label: 'Tgl Bongkar' },
            { key: 'jam_bongkar', label: 'Jam Bongkar' },
            { key: 'proyek', label: 'Proyek' },
            { key: 'lokasi_buang', label: 'Lokasi Buang' },
        ],
    },
};

const RESOLVABLE_FIELDS = {
    no_pintu: { label: 'Kendaraan (No. Pintu)', hasHarga: false },
    nama_supir: { label: 'Supir', hasHarga: false },
    nama_galian: { label: 'Galian', hasHarga: true },
    nama_galian_alihan: { label: 'Galian Alihan', hasHarga: true },
    nama_proyek: { label: 'Proyek', hasHarga: true },
};

// ============================================================================
// DAFTAR KOLOM HEADER CSV PER ENTITAS
// Dipakai pre-check header di browser & kotak persyaratan.
// PENTING: samakan dengan ENTITY_SCHEMAS di backend/utils/csvImport.js
// ============================================================================
const CSV_HEADER_COLUMNS = {
    kendaraan: ['no_pintu'],
    supir: ['nama'],
    galian: ['nama_galian', 'harga_galian'],
    proyek: ['nama_proyek', 'harga'],
    ritasi: [
        'tanggal_order', 'no_order', 'petugas_order', 'no_pintu', 'nama_supir',
        'nama_galian', 'nama_proyek', 'no_do', 'jam_order', 'km_awal',
        'uang_jalan', 'potongan', 'batal', 'keterangan',
        'tanggal_bongkar', 'jam_bongkar', 'km_akhir', 'jarak_km', 'lokasi_bongkar',
        'alihan', 'nama_galian_alihan', 'uang_alihan', 'no_urut',
    ],
    'mobil-luar': [
        'no_urut', 'pengirim', 'galian', 'no_plat', 'supir',
        'tanggal_bongkar', 'jam_bongkar', 'proyek', 'lokasi_buang',
    ],
};

// Kolom yang NILAI-nya wajib diisi per baris (untuk kotak persyaratan)
const CSV_REQUIRED_VALUES = {
    kendaraan: ['no_pintu'],
    supir: ['nama'],
    galian: ['nama_galian'],
    proyek: ['nama_proyek'],
    ritasi: [
        'tanggal_order', 'no_order', 'petugas_order', 'no_pintu', 'nama_supir',
        'nama_galian', 'no_do', 'jam_order', 'km_awal', 'uang_jalan',
    ],
    'mobil-luar': [],
};

// State per panel: { batch_id, rows, summary, extraColumns, filename }
const panelState = {};

// Context sementara untuk modal
let addMasterContext = null;
let editFieldContext = null;
let commitContext = null;
let unBatalContext = null;
let undoLastContext = null;
let commitProgressTimer = null;

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    Object.keys(PANEL_DEFS).forEach((entitas) => {
        const container = document.getElementById(`panel-${entitas}`);
        if (!container) return;
        container.innerHTML = renderPanelShell(entitas);
        wireUpload(entitas);
    });

    initTabs();
    initModals();
    checkGating();
});

// ============================================================================
// TABS
// ============================================================================
function initTabs() {
    document.querySelectorAll('.import-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('locked')) {
                showToast(btn.dataset.lockReason || 'Tab ini masih terkunci', 'warning');
                return;
            }
            switchTab(btn.dataset.tab);
        });
    });

    document.querySelectorAll('.master-subtab').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.master-subtab').forEach((b) => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.master-subpanel').forEach((p) =>
                p.classList.toggle('active', p.id === `panel-${btn.dataset.sub}`)
            );
        });
    });
}

function switchTab(tab) {
    document.querySelectorAll('.import-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.import-tab-content').forEach((c) => c.classList.toggle('active', c.id === `tab-${tab}`));
    if (tab === 'riwayat') loadRiwayat();
}

function setTabLock(tab, locked, reason) {
    const btn = document.querySelector(`.import-tab[data-tab="${tab}"]`);
    if (!btn) return;
    btn.classList.toggle('locked', locked);
    btn.title = locked ? reason : '';
    btn.dataset.lockReason = reason;
}

async function fetchJsonSafe(url) {
    try {
        const res = await fetch(url);
        return await res.json();
    } catch {
        return null;
    }
}

async function checkGating() {
    const [kendaraan, supir, galian, proyek] = await Promise.all([
        fetchJsonSafe(`${API_BASE_URL}/master/kendaraan`),
        fetchJsonSafe(`${API_BASE_URL}/master/supir`),
        fetchJsonSafe(`${API_BASE_URL}/master/galian`),
        fetchJsonSafe(`${API_BASE_URL}/master/proyek`),
    ]);

    const hasData = (r) => !!(r && r.status && Array.isArray(r.data) && r.data.length > 0);
    const masterReady = hasData(kendaraan) && hasData(supir) && hasData(galian) && hasData(proyek);

    setTabLock('ritasi', !masterReady, 'Isi minimal 1 data di setiap Master (Kendaraan, Supir, Galian, Proyek) terlebih dahulu');
}

// ============================================================================
// RENDER PANEL SHELL (kotak persyaratan + upload area)
// ============================================================================
function renderRequirementsBox(entitas) {
    const wajib = CSV_REQUIRED_VALUES[entitas] || [];
    const semua = CSV_HEADER_COLUMNS[entitas] || [];
    const opsional = semua.filter((c) => !wajib.includes(c));

    const wajibHtml = wajib.length
        ? `<li><strong>Kolom wajib diisi:</strong> ${wajib.map(escapeHtml).join(', ')}</li>`
        : `<li><strong>Kolom wajib diisi:</strong> tidak ada (semua opsional), tetapi seluruh kolom header harus ada</li>`;
    const opsionalHtml = opsional.length
        ? `<li><strong>Kolom opsional:</strong> ${opsional.map(escapeHtml).join(', ')}</li>`
        : '';

    const ritasiHtml = entitas === 'ritasi' ? `
        <div class="req-status-guide">
            <strong>Cara mengisi per status (satu baris = satu kejadian utuh):</strong>
            <ul>
                <li><strong>ON PROCESS</strong>: isi bagian order saja, kolom batal kosong/<code>tidak</code>, seluruh kolom buangan kosong.</li>
                <li><strong>COMPLETE</strong>: isi bagian order + tanggal_bongkar, jam_bongkar, km_akhir, lokasi_bongkar, no_urut (jarak_km boleh kosong = dihitung otomatis).</li>
                <li><strong>BATAL</strong>: isi bagian order, kolom batal = <code>ya</code>, keterangan wajib diisi alasan pembatalan, seluruh kolom buangan kosong.</li>
                <li><strong>Ritasi ke-2/ke-3 untuk order yang sama</strong>: baris baru, bagian order ditulis identik, no_urut berbeda.</li>
            </ul>
        </div>
    ` : '';

    return `
        <details class="import-requirements">
            <summary>Persyaratan File CSV ▾</summary>
            <ul>
                <li>File harus <strong>.csv</strong> — disarankan hasil "Save As → CSV UTF-8" dari template Excel; maksimal 2000 baris / 5 MB.</li>
                ${wajibHtml}
                ${opsionalHtml}
                <li><strong>Format:</strong> tanggal <code>YYYY-MM-DD</code> atau <code>DD/MM/YYYY</code>; jam <code>HH:MM</code>; angka boleh dengan/tanpa titik ribuan; batal/alihan: <code>ya</code>/<code>tidak</code>.</li>
            </ul>
            ${ritasiHtml}
        </details>
    `;
}

function renderPanelShell(entitas) {
    const def = PANEL_DEFS[entitas];
    return `
        <div class="import-panel" data-entitas="${entitas}">
            <div class="import-panel-header">
                <h2>${def.label}</h2>
                <button class="btn btn-outline" onclick="downloadTemplate('${entitas}')">⬇️ Download Template Excel</button>
            </div>
            ${renderRequirementsBox(entitas)}
            <div class="import-upload-row">
                <label class="import-dropzone" id="dropzone-${entitas}">
                    📄 Klik atau tarik file CSV ke sini untuk upload &amp; preview
                    <input type="file" accept=".csv" id="fileInput-${entitas}">
                </label>
            </div>
            <div id="result-${entitas}"></div>
        </div>
    `;
}

function wireUpload(entitas) {
    const dropzone = document.getElementById(`dropzone-${entitas}`);
    const fileInput = document.getElementById(`fileInput-${entitas}`);

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) handleUpload(entitas, fileInput.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) handleUpload(entitas, e.dataTransfer.files[0]);
    });
}

// ============================================================================
// PRE-CHECK HEADER DI BROWSER (lapisan tambahan — validasi server tetap penuh)
// Return string pesan error, atau null jika lolos.
// ============================================================================
async function precheckCsvFile(entitas, file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        return 'File Excel tidak bisa diupload langsung — simpan dulu sebagai CSV UTF-8 (lihat sheet Petunjuk di template).';
    }

    const requiredCols = CSV_HEADER_COLUMNS[entitas];
    if (!requiredCols) return null;

    let text;
    try {
        // Cukup beberapa KB pertama untuk membaca baris header
        text = await file.slice(0, 8192).text();
    } catch {
        return null; // gagal dibaca di browser -> biarkan server yang memvalidasi
    }

    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
    const firstLine = (text.split(/\r?\n/)[0] || '');
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';
    const headers = firstLine.split(delimiter).map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());

    const missing = requiredCols.filter((c) => !headers.includes(c));
    if (missing.length > 0) {
        return `Kolom wajib hilang di header CSV: ${missing.join(', ')}. Gunakan template Excel lalu Save As "CSV UTF-8 (Comma delimited)".`;
    }
    return null;
}

// ============================================================================
// UPLOAD & PREVIEW
// ============================================================================
async function handleUpload(entitas, file) {
    const resultEl = document.getElementById(`result-${entitas}`);

    const precheckError = await precheckCsvFile(entitas, file);
    if (precheckError) {
        resultEl.innerHTML = `<div class="import-lock-message">❌ ${escapeHtml(precheckError)}</div>`;
        const fileInput = document.getElementById(`fileInput-${entitas}`);
        if (fileInput) fileInput.value = '';
        return;
    }

    resultEl.innerHTML = `<div class="loading">⏳ Memproses file...</div>`;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_BASE_URL}/import/${entitas}/preview`, { method: 'POST', body: formData });
        const json = await res.json();

        if (!json.status) {
            resultEl.innerHTML = `<div class="import-lock-message">❌ ${escapeHtml(json.message)}</div>`;
            return;
        }

        panelState[entitas] = {
            batch_id: json.data.batch_id,
            rows: json.data.rows,
            summary: json.data.summary,
            extraColumns: json.data.extra_columns || [],
            filename: json.data.filename,
            filterStatus: 'all',
        };
        renderPanelResult(entitas);
    } catch (err) {
        resultEl.innerHTML = `<div class="import-lock-message">❌ Gagal upload: ${escapeHtml(err.message)}</div>`;
    }
}

// ============================================================================
// RENDER HASIL PREVIEW (tabel semua baris + status + aksi)
// ============================================================================
function renderPanelResult(entitas) {
    const state = panelState[entitas];
    const resultEl = document.getElementById(`result-${entitas}`);
    if (!resultEl) return;
    if (!state) {
        resultEl.innerHTML = '';
        return;
    }

    const def = PANEL_DEFS[entitas];
    const s = state.summary;
    const insertable = state.rows.filter((r) => r.status !== 'error' && !r.skip_insert).length;
    const filterStatus = state.filterStatus || 'all';

    const extraHtml = state.extraColumns.length
        ? `<div class="import-extra-columns">⚠️ Kolom tidak dikenal diabaikan: ${escapeHtml(state.extraColumns.join(', '))}</div>`
        : '';

    // Khusus ritasi: kolom "Status Akhir" menampilkan apa yang akan terjadi
    // per baris saat commit (ON PROCESS / COMPLETE / BATAL / APPEND RITASI)
    const isRitasi = entitas === 'ritasi';
    const finalStatusTh = isRitasi ? '<th>Status Akhir</th>' : '';

    const visibleRows = filterStatus === 'all' ? state.rows : state.rows.filter((r) => r.status === filterStatus);

    const rowsHtml = visibleRows.map((row) => {
        const cells = def.columns.map((col) => `<td>${escapeHtml(row.data[col.key])}</td>`).join('');
        const messagesHtml = row.messages.length
            ? `<div class="row-messages">${row.messages.map(escapeHtml).join('<br>')}</div>`
            : '';
        const actionsHtml = renderRowActions(entitas, row);

        let finalStatusTd = '';
        if (isRitasi) {
            const finalStatus = (row.computed && row.computed.final_status) || '-';
            const cls = finalStatus.toLowerCase().replace(/\s+/g, '-');
            finalStatusTd = `<td><span class="final-status-badge ${cls}">${escapeHtml(finalStatus)}</span></td>`;
        }

        return `
            <tr class="row-${row.status}">
                <td>${row.row_index + 1}</td>
                ${finalStatusTd}
                ${cells}
                <td>
                    <span class="row-status-badge ${row.status}">${row.status}</span>
                    ${messagesHtml}
                    ${actionsHtml}
                </td>
            </tr>
        `;
    }).join('');

    const tableBodyHtml = visibleRows.length
        ? rowsHtml
        : `<tr><td colspan="99" class="import-table-empty">Tidak ada baris dengan status ini</td></tr>`;

    resultEl.innerHTML = `
        ${extraHtml}
        <div class="import-panel-toolbar">
            <div class="import-panel-toolbar-top">
                <div class="import-panel-toolbar-filename">${state.filename ? `📄 ${escapeHtml(state.filename)}` : ''}</div>
                <button class="btn btn-primary" id="btnCommit-${entitas}" ${insertable === 0 ? 'disabled' : ''} onclick="confirmCommit('${entitas}')">
                    💾 Commit Import (${insertable} baris)
                </button>
            </div>
            <div class="import-summary">
                <button class="summary-chip total ${filterStatus === 'all' ? 'active' : ''}" onclick="setPanelFilter('${entitas}', 'all')">Total: ${s.total}</button>
                <button class="summary-chip valid ${filterStatus === 'ok' ? 'active' : ''}" onclick="setPanelFilter('${entitas}', 'ok')">Valid: ${s.valid}</button>
                <button class="summary-chip warning ${filterStatus === 'warning' ? 'active' : ''}" onclick="setPanelFilter('${entitas}', 'warning')">Warning: ${s.warning}</button>
                <button class="summary-chip error ${filterStatus === 'error' ? 'active' : ''}" onclick="setPanelFilter('${entitas}', 'error')">Error: ${s.error}</button>
            </div>
        </div>
        <div class="import-table-wrapper">
            <table class="import-table">
                <thead>
                    <tr>
                        <th>No</th>
                        ${finalStatusTh}
                        ${def.columns.map((c) => `<th>${c.label}</th>`).join('')}
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${tableBodyHtml}</tbody>
            </table>
        </div>
        <div id="commitReport-${entitas}"></div>
    `;
}

function setPanelFilter(entitas, status) {
    const state = panelState[entitas];
    if (!state) return;
    state.filterStatus = status === 'all' ? 'all' : (state.filterStatus === status ? 'all' : status);
    renderPanelResult(entitas);
}

function renderRowActions(entitas, row) {
    const def = PANEL_DEFS[entitas];
    let html = '';

    (def.columns || []).forEach((col) => {
        if (!col.resolvable) return;
        const resolved = row.resolved && row.resolved[col.resolvable];
        if (!resolved) return;

        if (resolved.status === 'fuzzy') {
            const applyId = `applyall-${entitas}-${row.row_index}-${col.resolvable}`;
            html += `
                <div class="row-actions">
                    <button class="btn-suggestion-use" onclick="resolveField('${entitas}', ${row.row_index}, '${col.resolvable}', 'use_existing', ${resolved.suggestion.master_id}, document.getElementById('${applyId}').checked, event)">
                        Gunakan "${escapeHtml(resolved.suggestion.nama)}"
                    </button>
                    <button class="btn-suggestion-deny" onclick="resolveField('${entitas}', ${row.row_index}, '${col.resolvable}', 'mark_new', null, false, event)">
                        Bukan, ini beda
                    </button>
                    <button class="btn-edit-field" onclick="openEditFieldModal('${entitas}', ${row.row_index}, '${col.resolvable}')">✏️ Edit nilai</button>
                    <label class="row-apply-all"><input type="checkbox" id="${applyId}"> terapkan ke semua baris sama</label>
                </div>
            `;
        } else if (resolved.status === 'notfound' && row.can_add_master && row.can_add_master[col.resolvable]) {
            html += `
                <div class="row-actions">
                    <button class="btn-add-master" onclick="openAddMasterModal('${entitas}', ${row.row_index}, '${col.resolvable}')">+ Tambah ke master</button>
                    <button class="btn-edit-field" onclick="openEditFieldModal('${entitas}', ${row.row_index}, '${col.resolvable}')">✏️ Edit nilai</button>
                </div>
            `;
        }
    });

    if (row.can_unbatal) {
        html += `
            <div class="row-actions">
                <button class="btn-unbatal" onclick="openUnBatalModal('${entitas}', ${row.row_index}, ${row.can_unbatal})">Un-batal order ini</button>
            </div>
        `;
    }

    return html;
}

// ============================================================================
// RESOLVE REFERENSI (gunakan existing / tandai baru)
// ============================================================================
async function resolveField(entitas, rowIndex, field, action, masterId, applyToAll, evt) {
    const state = panelState[entitas];
    if (!state) return;

    const actionsEl = evt && evt.currentTarget ? evt.currentTarget.closest('.row-actions') : null;
    if (actionsEl) actionsEl.querySelectorAll('button').forEach((b) => { b.disabled = true; });

    try {
        const res = await fetch(`${API_BASE_URL}/import/${entitas}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                batch_id: state.batch_id,
                row_index: rowIndex,
                field,
                action,
                master_id: masterId,
                apply_to_all: applyToAll,
            }),
        });
        const json = await res.json();

        if (!json.status) {
            showToast(json.message, 'error');
            if (res.status === 410) panelState[entitas] = null;
            if (actionsEl) actionsEl.querySelectorAll('button').forEach((b) => { b.disabled = false; });
            return;
        }

        state.rows = json.data.rows;
        state.summary = json.data.summary;
        renderPanelResult(entitas);
    } catch (err) {
        if (actionsEl) actionsEl.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        showToast('Gagal resolve baris: ' + err.message, 'error');
    }
}

// ============================================================================
// MODAL: TAMBAH KE MASTER
// ============================================================================
function openAddMasterModal(entitas, rowIndex, field) {
    const state = panelState[entitas];
    const row = state.rows.find((r) => r.row_index === rowIndex);
    const rf = RESOLVABLE_FIELDS[field];

    addMasterContext = { entitas, rowIndex, field };
    document.getElementById('addMasterFieldLabel').textContent = `Nama (${rf.label})`;
    document.getElementById('addMasterNama').value = row.data[field] || '';
    document.getElementById('addMasterHargaGroup').style.display = rf.hasHarga ? 'block' : 'none';
    document.getElementById('addMasterHarga').value = '';
    document.getElementById('modalAddMaster').style.display = 'flex';
}

async function confirmAddMaster() {
    if (!addMasterContext) return;
    const { entitas, rowIndex, field } = addMasterContext;
    const nama = document.getElementById('addMasterNama').value.trim();
    const harga = document.getElementById('addMasterHarga').value.trim();

    if (!nama) {
        showToast('Nama wajib diisi', 'warning');
        return;
    }

    const btn = document.getElementById('btnConfirmAddMaster');
    btn.disabled = true;
    const state = panelState[entitas];
    try {
        const res = await fetch(`${API_BASE_URL}/import/${entitas}/add-master`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                batch_id: state.batch_id,
                row_index: rowIndex,
                field,
                data: { nama, harga: harga || undefined },
            }),
        });
        const json = await res.json();

        if (!json.status) {
            showToast(json.message, 'error');
            return;
        }

        state.rows = json.data.rows;
        state.summary = json.data.summary;
        document.getElementById('modalAddMaster').style.display = 'none';
        addMasterContext = null;
        renderPanelResult(entitas);

        showToast(
            json.data.harga_default_used
                ? 'Berhasil ditambahkan ke master (harga masih 0, sesuaikan di halaman Master)'
                : 'Berhasil ditambahkan ke master',
            'success'
        );
        checkGating();
    } catch (err) {
        showToast('Gagal menambah master: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ============================================================================
// MODAL: EDIT NILAI FIELD (koreksi salah ketik sebelum commit)
// ============================================================================
function openEditFieldModal(entitas, rowIndex, field) {
    const state = panelState[entitas];
    const row = state.rows.find((r) => r.row_index === rowIndex);
    const rf = RESOLVABLE_FIELDS[field];

    editFieldContext = { entitas, rowIndex, field };
    document.getElementById('editFieldLabel').textContent = `Nilai (${rf.label})`;
    document.getElementById('editFieldValue').value = row.data[field] || '';
    document.getElementById('modalEditField').style.display = 'flex';
}

async function confirmEditField() {
    if (!editFieldContext) return;
    const { entitas, rowIndex, field } = editFieldContext;
    const value = document.getElementById('editFieldValue').value.trim();

    if (!value) {
        showToast('Nilai wajib diisi', 'warning');
        return;
    }

    const state = panelState[entitas];
    const btn = document.getElementById('btnConfirmEditField');
    btn.disabled = true;
    try {
        const res = await fetch(`${API_BASE_URL}/import/${entitas}/edit-field`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                batch_id: state.batch_id,
                row_index: rowIndex,
                field,
                value,
            }),
        });
        const json = await res.json();

        if (!json.status) {
            showToast(json.message, 'error');
            if (res.status === 410) panelState[entitas] = null;
            return;
        }

        state.rows = json.data.rows;
        state.summary = json.data.summary;
        document.getElementById('modalEditField').style.display = 'none';
        editFieldContext = null;
        renderPanelResult(entitas);
        showToast('Nilai berhasil diperbarui', 'success');
    } catch (err) {
        showToast('Gagal menyimpan perubahan: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ============================================================================
// MODAL: KONFIRMASI COMMIT
// ============================================================================
function confirmCommit(entitas) {
    const state = panelState[entitas];
    if (!state) return;

    commitContext = entitas;
    const insertable = state.rows.filter((r) => r.status !== 'error' && !r.skip_insert).length;
    document.getElementById('modalCommitText').textContent =
        `Import ${insertable} baris valid untuk ${PANEL_DEFS[entitas].label}? Baris error (${state.summary.error}) akan dilewati.`;
    document.getElementById('modalCommit').style.display = 'flex';
}

async function runCommit() {
    if (!commitContext) return;
    const entitas = commitContext;
    const state = panelState[entitas];
    document.getElementById('modalCommit').style.display = 'none';

    const totalBaris = state.rows.length;
    showCommitProgress(totalBaris);
    pollCommitProgress(entitas, state.batch_id, totalBaris);

    try {
        const res = await fetch(`${API_BASE_URL}/import/${entitas}/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_id: state.batch_id }),
        });
        const json = await res.json();

        await finishCommitProgress();

        if (!json.status) {
            showToast(json.message, 'error');
            return;
        }

        showToast(`Import selesai: ${json.data.berhasil} berhasil, ${json.data.dilewati} dilewati`, 'success');

        const reportEl = document.getElementById(`commitReport-${entitas}`);
        if (reportEl) {
            const downloadLink = (entitas === 'ritasi' && json.data.log_id)
                ? ` <a href="${API_BASE_URL}/import/log/${json.data.log_id}/download">⬇️ Download hasil import ini</a>`
                : '';
            reportEl.innerHTML = `<div class="import-commit-report">✅ ${json.data.berhasil} baris berhasil diimport, ${json.data.dilewati} baris dilewati dari total ${json.data.total}.${downloadLink}</div>`;
        }
        const btn = document.getElementById(`btnCommit-${entitas}`);
        if (btn) btn.disabled = true;
        const fileInput = document.getElementById(`fileInput-${entitas}`);
        if (fileInput) fileInput.value = '';

        panelState[entitas] = null;
        checkGating();
    } catch (err) {
        hideCommitProgress();
        showToast('Gagal commit import: ' + err.message, 'error');
    } finally {
        commitContext = null;
    }
}

// ============================================================================
// POPUP PROGRESS COMMIT (persen real, dipoll dari GET /import/:entitas/progress
// yang membaca batch.progress yang diupdate live oleh commitBatch di backend)
// ============================================================================
function showCommitProgress(total) {
    clearInterval(commitProgressTimer);

    const modal = document.getElementById('modalCommitProgress');
    const fill = document.getElementById('commitProgressFill');
    const percentEl = document.getElementById('commitProgressPercent');
    const countEl = document.getElementById('commitProgressCount');

    fill.style.width = '0%';
    percentEl.textContent = '0%';
    countEl.textContent = `0 / ${total} baris`;
    modal.style.display = 'flex';
}

function renderCommitProgress(done, total) {
    const fill = document.getElementById('commitProgressFill');
    const percentEl = document.getElementById('commitProgressPercent');
    const countEl = document.getElementById('commitProgressCount');

    const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    fill.style.width = `${percent}%`;
    percentEl.textContent = `${percent}%`;
    countEl.textContent = `${Math.min(done, total)} / ${total} baris`;
}

function pollCommitProgress(entitas, batchId, total) {
    clearInterval(commitProgressTimer);

    commitProgressTimer = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/import/${entitas}/progress?batch_id=${encodeURIComponent(batchId)}`);
            const json = await res.json();
            if (json.status && json.data) {
                renderCommitProgress(json.data.done, json.data.total || total);
            }
        } catch (err) {
            // Polling gagal sesekali (mis. network blip) tidak fatal, request commit
            // utama tetap berjalan; biarkan interval berikutnya coba lagi.
        }
    }, 500);
}

function finishCommitProgress() {
    clearInterval(commitProgressTimer);
    commitProgressTimer = null;

    const modal = document.getElementById('modalCommitProgress');
    const fill = document.getElementById('commitProgressFill');
    const percentEl = document.getElementById('commitProgressPercent');
    const countEl = document.getElementById('commitProgressCount');
    const total = (countEl.textContent.match(/\/\s*(\d+)/) || [])[1] || '0';

    fill.style.width = '100%';
    percentEl.textContent = '100%';
    countEl.textContent = `${total} / ${total} baris`;

    return new Promise((resolve) => {
        setTimeout(() => {
            modal.style.display = 'none';
            resolve();
        }, 500);
    });
}

function hideCommitProgress() {
    clearInterval(commitProgressTimer);
    commitProgressTimer = null;
    document.getElementById('modalCommitProgress').style.display = 'none';
}

// ============================================================================
// MODAL: UN-BATAL ORDER (dari preview import buangan)
// ============================================================================
function openUnBatalModal(entitas, rowIndex, orderId) {
    const state = panelState[entitas];
    const row = state.rows.find((r) => r.row_index === rowIndex);
    unBatalContext = { entitas, rowIndex, orderId };

    const batalMessage = row.messages.find((m) => m.includes('BATAL')) || 'Order ini berstatus BATAL.';
    document.getElementById('modalUnBatalText').textContent = `${batalMessage} Lanjutkan un-batal order ini?`;
    document.getElementById('modalUnBatal').style.display = 'flex';
}

async function runUnBatal() {
    if (!unBatalContext) return;
    const { entitas, orderId } = unBatalContext;
    const state = panelState[entitas];
    document.getElementById('modalUnBatal').style.display = 'none';

    try {
        const res = await fetch(`${API_BASE_URL}/order/${orderId}/un-batal`, { method: 'POST' });
        const json = await res.json();

        if (!json.status) {
            showToast(json.message, 'error');
            return;
        }

        const ketDihapus = json.data.keterangan_dihapus;
        showToast(
            ketDihapus
                ? `Order di-un-batal (status: ${json.data.status}). Keterangan pembatalan yang dihapus: "${ketDihapus}"`
                : `Order berhasil di-un-batal (status: ${json.data.status})`,
            'success'
        );

        const revalRes = await fetch(`${API_BASE_URL}/import/${entitas}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_id: state.batch_id, action: 'revalidate' }),
        });
        const revalJson = await revalRes.json();

        if (revalJson.status) {
            state.rows = revalJson.data.rows;
            state.summary = revalJson.data.summary;
            renderPanelResult(entitas);
        }
    } catch (err) {
        showToast('Gagal un-batal order: ' + err.message, 'error');
    } finally {
        unBatalContext = null;
    }
}

// ============================================================================
// MODAL WIRING
// ============================================================================
function initModals() {
    document.getElementById('btnCancelAddMaster').addEventListener('click', () => {
        document.getElementById('modalAddMaster').style.display = 'none';
        addMasterContext = null;
    });
    document.getElementById('btnConfirmAddMaster').addEventListener('click', confirmAddMaster);

    document.getElementById('btnCancelEditField').addEventListener('click', () => {
        document.getElementById('modalEditField').style.display = 'none';
        editFieldContext = null;
    });
    document.getElementById('btnConfirmEditField').addEventListener('click', confirmEditField);

    document.getElementById('btnCancelCommit').addEventListener('click', () => {
        document.getElementById('modalCommit').style.display = 'none';
        commitContext = null;
    });
    document.getElementById('btnConfirmCommit').addEventListener('click', runCommit);

    document.getElementById('btnCancelUnBatal').addEventListener('click', () => {
        document.getElementById('modalUnBatal').style.display = 'none';
        unBatalContext = null;
    });
    document.getElementById('btnConfirmUnBatal').addEventListener('click', runUnBatal);

    document.getElementById('btnRefreshRiwayat').addEventListener('click', loadRiwayat);

    document.getElementById('btnCloseRiwayatDetail').addEventListener('click', () => {
        document.getElementById('modalRiwayatDetail').style.display = 'none';
    });

    document.getElementById('btnUndoLast').addEventListener('click', () => {
        if (!undoLastContext) return;
        const { filename, total_baris } = undoLastContext;
        document.getElementById('modalUndoLastText').textContent =
            `Hapus seluruh data ritasi hasil import terakhir (file "${filename || '-'}", ${total_baris} baris)? Tindakan ini tidak bisa dibatalkan.`;
        document.getElementById('modalUndoLast').style.display = 'flex';
    });
    document.getElementById('btnCancelUndoLast').addEventListener('click', () => {
        document.getElementById('modalUndoLast').style.display = 'none';
    });
    document.getElementById('btnConfirmUndoLast').addEventListener('click', runUndoLast);
}

// ============================================================================
// TEMPLATE & RIWAYAT
// ============================================================================
function downloadTemplate(entitas) {
    window.open(`${API_BASE_URL}/import/${entitas}/template`, '_blank');
}

async function loadRiwayat() {
    const tbody = document.getElementById('riwayatTableBody');
    const btnUndoLast = document.getElementById('btnUndoLast');
    tbody.innerHTML = `<tr><td colspan="7" class="loading">Memuat data...</td></tr>`;
    btnUndoLast.style.display = 'none';
    undoLastContext = null;

    try {
        const res = await fetch(`${API_BASE_URL}/import/log`);
        const json = await res.json();

        if (!json.status || !json.data || json.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="no-data">Belum ada riwayat import</td></tr>`;
            return;
        }

        tbody.innerHTML = json.data.map((r) => {
            const detailBtn = r.dilewati > 0
                ? `<button class="btn-icon-action" title="Lihat detail baris dilewati" onclick="openRiwayatDetail(${r.id})">📋</button>`
                : '';
            const downloadBtn = r.entitas === 'ritasi'
                ? `<a class="btn-icon-action" title="Download hasil import ini" href="${API_BASE_URL}/import/log/${r.id}/download">⬇️</a>`
                : '';
            return `
            <tr>
                <td>${formatDateTime(r.created_at)}</td>
                <td>${escapeHtml(r.entitas)}</td>
                <td>${escapeHtml(r.filename || '-')}</td>
                <td>${r.total_baris}</td>
                <td>${r.berhasil}</td>
                <td>${r.dilewati}</td>
                <td>${detailBtn} ${downloadBtn}</td>
            </tr>
        `;
        }).join('');

        const latest = json.data[0];
        if (latest.entitas === 'ritasi') {
            undoLastContext = { filename: latest.filename, total_baris: latest.total_baris };
            btnUndoLast.style.display = '';
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="no-data">Gagal memuat riwayat</td></tr>`;
    }
}

async function openRiwayatDetail(logId) {
    const body = document.getElementById('riwayatDetailBody');
    body.innerHTML = '<p class="loading">Memuat detail...</p>';
    document.getElementById('modalRiwayatDetail').style.display = 'flex';

    try {
        const res = await fetch(`${API_BASE_URL}/import/log/${logId}`);
        const json = await res.json();

        if (!json.status) {
            body.innerHTML = `<p class="no-data">${escapeHtml(json.message)}</p>`;
            return;
        }

        const log = json.data;
        const detail = Array.isArray(log.detail_error) ? log.detail_error : [];

        const summaryHtml = `
            <p><strong>File:</strong> ${escapeHtml(log.filename || '-')}<br>
            <strong>Waktu:</strong> ${formatDateTime(log.created_at)}<br>
            <strong>Total:</strong> ${log.total_baris} baris — <strong>Berhasil:</strong> ${log.berhasil} — <strong>Dilewati:</strong> ${log.dilewati}</p>
        `;

        const listHtml = detail.length
            ? `<div class="riwayat-detail-list">${detail.map((d) => `
                <div class="riwayat-detail-row">
                    <span class="row-status-badge ${escapeHtml(d.status)}">${escapeHtml(d.status)}</span>
                    Baris ${(d.row_index ?? 0) + 1}: ${(d.messages || []).map(escapeHtml).join('; ')}
                </div>
            `).join('')}</div>`
            : '<p class="no-data">Tidak ada baris yang dilewati/gagal.</p>';

        body.innerHTML = summaryHtml + listHtml;
    } catch (err) {
        body.innerHTML = `<p class="no-data">Gagal memuat detail: ${escapeHtml(err.message)}</p>`;
    }
}

async function runUndoLast() {
    document.getElementById('modalUndoLast').style.display = 'none';
    const btn = document.getElementById('btnConfirmUndoLast');
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/import/ritasi/undo-last`, { method: 'POST' });
        const json = await res.json();

        if (!json.status) {
            showToast(json.message, 'error');
            return;
        }

        showToast(
            `Undo berhasil: ${json.data.orders_dihapus} order & ${json.data.buangan_dihapus} ritasi dihapus`,
            'success'
        );
        await loadRiwayat();
    } catch (err) {
        showToast('Gagal melakukan undo: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ============================================================================
// UTILITIES
// ============================================================================
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

function formatDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
