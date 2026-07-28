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
let commitContext = null;
let unBatalContext = null;

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

    const extraHtml = state.extraColumns.length
        ? `<div class="import-extra-columns">⚠️ Kolom tidak dikenal diabaikan: ${escapeHtml(state.extraColumns.join(', '))}</div>`
        : '';

    // Khusus ritasi: kolom "Status Akhir" menampilkan apa yang akan terjadi
    // per baris saat commit (ON PROCESS / COMPLETE / BATAL / APPEND RITASI)
    const isRitasi = entitas === 'ritasi';
    const finalStatusTh = isRitasi ? '<th>Status Akhir</th>' : '';

    const rowsHtml = state.rows.map((row) => {
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

    resultEl.innerHTML = `
        ${extraHtml}
        <div class="import-summary">
            <span class="summary-chip total">Total: ${s.total}</span>
            <span class="summary-chip valid">Valid: ${s.valid}</span>
            <span class="summary-chip warning">Warning: ${s.warning}</span>
            <span class="summary-chip error">Error: ${s.error}</span>
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
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
        <div class="import-panel-footer">
            <div>${state.filename ? `📄 ${escapeHtml(state.filename)}` : ''}</div>
            <button class="btn btn-primary" id="btnCommit-${entitas}" ${insertable === 0 ? 'disabled' : ''} onclick="confirmCommit('${entitas}')">
                💾 Commit Import (${insertable} baris)
            </button>
        </div>
        <div id="commitReport-${entitas}"></div>
    `;
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
                    <button class="btn-suggestion-use" onclick="resolveField('${entitas}', ${row.row_index}, '${col.resolvable}', 'use_existing', ${resolved.suggestion.master_id}, document.getElementById('${applyId}').checked)">
                        Gunakan "${escapeHtml(resolved.suggestion.nama)}"
                    </button>
                    <button class="btn-suggestion-deny" onclick="resolveField('${entitas}', ${row.row_index}, '${col.resolvable}', 'mark_new', null, false)">
                        Bukan, ini beda
                    </button>
                    <label class="row-apply-all"><input type="checkbox" id="${applyId}"> terapkan ke semua baris sama</label>
                </div>
            `;
        } else if (resolved.status === 'notfound' && row.can_add_master && row.can_add_master[col.resolvable]) {
            html += `
                <div class="row-actions">
                    <button class="btn-add-master" onclick="openAddMasterModal('${entitas}', ${row.row_index}, '${col.resolvable}')">+ Tambah ke master</button>
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
async function resolveField(entitas, rowIndex, field, action, masterId, applyToAll) {
    const state = panelState[entitas];
    if (!state) return;

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
            return;
        }

        state.rows = json.data.rows;
        state.summary = json.data.summary;
        renderPanelResult(entitas);
    } catch (err) {
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

    try {
        const res = await fetch(`${API_BASE_URL}/import/${entitas}/commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_id: state.batch_id }),
        });
        const json = await res.json();

        if (!json.status) {
            showToast(json.message, 'error');
            return;
        }

        showToast(`Import selesai: ${json.data.berhasil} berhasil, ${json.data.dilewati} dilewati`, 'success');

        const reportEl = document.getElementById(`commitReport-${entitas}`);
        if (reportEl) {
            reportEl.innerHTML = `<div class="import-commit-report">✅ ${json.data.berhasil} baris berhasil diimport, ${json.data.dilewati} baris dilewati dari total ${json.data.total}.</div>`;
        }
        const btn = document.getElementById(`btnCommit-${entitas}`);
        if (btn) btn.disabled = true;
        const fileInput = document.getElementById(`fileInput-${entitas}`);
        if (fileInput) fileInput.value = '';

        panelState[entitas] = null;
        checkGating();
    } catch (err) {
        showToast('Gagal commit import: ' + err.message, 'error');
    } finally {
        commitContext = null;
    }
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
}

// ============================================================================
// TEMPLATE & RIWAYAT
// ============================================================================
function downloadTemplate(entitas) {
    window.open(`${API_BASE_URL}/import/${entitas}/template`, '_blank');
}

async function loadRiwayat() {
    const tbody = document.getElementById('riwayatTableBody');
    tbody.innerHTML = `<tr><td colspan="6" class="loading">Memuat data...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE_URL}/import/log`);
        const json = await res.json();

        if (!json.status || !json.data || json.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="no-data">Belum ada riwayat import</td></tr>`;
            return;
        }

        tbody.innerHTML = json.data.map((r) => `
            <tr>
                <td>${formatDateTime(r.created_at)}</td>
                <td>${escapeHtml(r.entitas)}</td>
                <td>${escapeHtml(r.filename || '-')}</td>
                <td>${r.total_baris}</td>
                <td>${r.berhasil}</td>
                <td>${r.dilewati}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="no-data">Gagal memuat riwayat</td></tr>`;
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
