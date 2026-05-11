// ============================================================================
// MASTER PROYEK - JAVASCRIPT
// ============================================================================

const API_BASE_URL = 'http://localhost:3000/api/master';
const ENDPOINT = `${API_BASE_URL}/proyek`;

// State
let allData = [];
let filteredData = [];
let currentEditId = null;
let deleteConfirmId = null;

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const modal = document.getElementById('modalForm');
const modalConfirm = document.getElementById('modalConfirm');
const modalTitle = document.getElementById('modalTitle');
const form = document.querySelector('#modalForm form');
const namaProyekInput = document.getElementById('namaProyek');
const hargaProyekInput = document.getElementById('hargaProyek');
const btnSubmit = document.getElementById('btnSubmit');
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const alertContainer = document.getElementById('alertContainer');
const deleteProyekName = document.getElementById('deleteProyekName');

// ============================================================================
// EVENT LISTENERS
// ============================================================================
window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal('modalForm');
    if (e.target === modalConfirm) closeModal('modalConfirm');
});

// Format rupiah saat input harga
hargaProyekInput.addEventListener('blur', () => {
    const raw = parseHarga(hargaProyekInput.value);
    hargaProyekInput.value = raw > 0 ? formatRupiah(raw) : '';
});

hargaProyekInput.addEventListener('focus', () => {
    const raw = parseHarga(hargaProyekInput.value);
    hargaProyekInput.value = raw > 0 ? String(raw) : '';
});

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================
function openAddModal() {
    currentEditId = null;
    modalTitle.textContent = 'Tambah Proyek';
    namaProyekInput.value = '';
    hargaProyekInput.value = '';
    btnSubmit.textContent = 'Simpan';
    openModal('modalForm');
    namaProyekInput.focus();
}

function openEditModal(id) {
    currentEditId = id;
    const data = allData.find(item => item.id === id);
    if (data) {
        modalTitle.textContent = 'Edit Proyek';
        namaProyekInput.value = data.nama_proyek;
        hargaProyekInput.value = data.harga > 0 ? formatRupiah(data.harga) : '';
        btnSubmit.textContent = 'Update';
        openModal('modalForm');
        namaProyekInput.focus();
    }
}

function openDeleteModal(id) {
    deleteConfirmId = id;
    const data = allData.find(item => item.id === id);
    if (data) {
        deleteProyekName.textContent = data.nama_proyek;
        openModal('modalConfirm');
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'modalForm') {
        form.reset();
        currentEditId = null;
    }
    if (modalId === 'modalConfirm') {
        deleteConfirmId = null;
    }
}

// ============================================================================
// FORM HANDLING
// ============================================================================
async function handleSubmit(e) {
    e.preventDefault();

    const namaProyek = namaProyekInput.value.trim();
    if (!namaProyek) {
        showAlert('Nama proyek tidak boleh kosong', 'error');
        return;
    }

    const harga = parseHarga(hargaProyekInput.value) || 0;

    try {
        let response;
        if (currentEditId) {
            response = await fetch(`${ENDPOINT}/${currentEditId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama_proyek: namaProyek, harga })
            });
        } else {
            response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama_proyek: namaProyek, harga })
            });
        }

        const result = await response.json();

        if (response.ok) {
            showAlert(result.message || 'Data berhasil disimpan', 'success');
            closeModal('modalForm');
            loadData();
        } else {
            showAlert(result.message || 'Gagal menyimpan data', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        showAlert('Terjadi kesalahan saat menyimpan data', 'error');
    }
}

// ============================================================================
// DATA FUNCTIONS
// ============================================================================
async function loadData() {
    try {
        showLoadingState();
        const response = await fetch(ENDPOINT);
        const text = await response.text();

        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            showAlert('Backend error. Cek console untuk detail.', 'error');
            renderTable();
            return;
        }

        if (response.ok) {
            allData = result.data || result || [];
            filteredData = [...allData];
            renderTable();
        } else {
            showAlert(result.message || 'Gagal memuat data', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        showAlert('Gagal terhubung ke: ' + ENDPOINT, 'error');
    }
}

async function deleteData(id) {
    try {
        const response = await fetch(`${ENDPOINT}/${id}`, { method: 'DELETE' });
        const result = await response.json();

        if (response.ok) {
            showAlert(result.message || 'Data berhasil dihapus', 'success');
            closeModal('modalConfirm');
            loadData();
        } else {
            showAlert(result.message || 'Gagal menghapus data', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        showAlert('Terjadi kesalahan saat menghapus data', 'error');
    }
}

async function handleDelete(e) {
    e.preventDefault();
    if (deleteConfirmId) await deleteData(deleteConfirmId);
}

// ============================================================================
// RENDER TABLE
// ============================================================================
function renderTable() {
    if (filteredData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <p>📋 Belum ada data proyek</p>
                    <button class="btn btn-primary" onclick="openAddModal()">+ Tambah Proyek Pertama</button>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filteredData.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.nama_proyek)}</td>
            <td>${formatRupiah(item.harga || 0)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-success btn-sm btn-edit" onclick="openEditModal(${item.id})">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="openDeleteModal(${item.id})">
                        🗑️ Hapus
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================================================
// SEARCH & FILTER
// ============================================================================
function filterTable() {
    const query = searchInput.value.toLowerCase().trim();
    filteredData = query
        ? allData.filter(item => item.nama_proyek.toLowerCase().includes(query))
        : [...allData];
    renderTable();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function formatRupiah(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

function parseHarga(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/Rp\s?/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertContainer.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}

function showLoadingState() {
    tableBody.innerHTML = `<tr><td colspan="4" class="loading-row">Memuat data...</td></tr>`;
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});
