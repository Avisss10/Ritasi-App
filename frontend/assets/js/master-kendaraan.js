// ============================================================================
// MASTER KENDARAAN - JAVASCRIPT
// ============================================================================

// Configuration
// Ubah sesuai URL backend Anda
const API_BASE_URL = 'http://localhost:3000/api/master';
const ENDPOINT = `${API_BASE_URL}/kendaraan`;

// Test koneksi ke API
async function testConnection() {
    try {
        const response = await fetch(ENDPOINT, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            console.warn('⚠️ API tidak merespons dengan baik');
        }
    } catch (err) {
        console.error('❌ Gagal terhubung ke API:', err.message);
        console.log('📝 Pastikan backend sudah berjalan di:', API_BASE_URL);
    }
}

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
const noPintuInput = document.getElementById('noPintu');
const btnTambah = document.querySelector('.header .btn-primary');
const btnSubmit = document.getElementById('btnSubmit');
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const alertContainer = document.getElementById('alertContainer');
const deleteKendaraanName = document.getElementById('deleteKendaraanName');

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal('modalForm');
    if (e.target === modalConfirm) closeModal('modalConfirm');
});

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function openAddModal() {
    currentEditId = null;
    modalTitle.textContent = 'Tambah Kendaraan';
    noPintuInput.value = '';
    btnSubmit.textContent = 'Simpan';
    openModal('modalForm');
    noPintuInput.focus();
}

function openEditModal(id) {
    currentEditId = id;
    const data = allData.find(item => item.id === id);
    
    if (data) {
        modalTitle.textContent = 'Edit Kendaraan';
        noPintuInput.value = data.no_pintu;
        btnSubmit.textContent = 'Update';
        openModal('modalForm');
        noPintuInput.focus();
    }
}

function openDeleteModal(id) {
    deleteConfirmId = id;
    const data = allData.find(item => item.id === id);
    
    if (data) {
        deleteKendaraanName.textContent = data.no_pintu;
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

    const noPintu = noPintuInput.value.trim();

    if (!noPintu) {
        showAlert('Nomor pintu tidak boleh kosong', 'error');
        return;
    }

    try {
        let response;

        if (currentEditId) {
            // UPDATE
            response = await fetch(`${ENDPOINT}/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ no_pintu: noPintu }),
            });
        } else {
            // CREATE
            response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ no_pintu: noPintu }),
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

        console.log('Response Status:', response.status);
        console.log('Response Text:', text.substring(0, 200));

        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error('❌ Backend mengembalikan HTML bukan JSON');
            console.error('Response:', text.substring(0, 500));
            showAlert('Endpoint tidak ditemukan atau backend error. Cek console untuk detail.', 'error');
            renderTable();
            return;
        }

        if (response.ok) {
            allData = result.data || result || [];
            filteredData = [...allData];
            renderTable();
            console.log('✅ Data berhasil dimuat:', allData);
        } else {
            showAlert(result.message || 'Gagal memuat data', 'error');
        }
    } catch (err) {
        console.error('❌ Error:', err);
        showAlert('Gagal terhubung ke: ' + ENDPOINT + '\n\nPastikan:\n1. Backend sudah running\n2. Port 3000 sudah benar\n3. Endpoint /api/master/kendaraan ada', 'error');
    }
}

async function deleteData(id) {
    try {
        const response = await fetch(`${ENDPOINT}/${id}`, {
            method: 'DELETE',
        });

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

// ============================================================================
// DELETE CONFIRMATION
// ============================================================================

async function handleDelete(e) {
    e.preventDefault();
    
    if (deleteConfirmId) {
        await deleteData(deleteConfirmId);
    }
}

// ============================================================================
// RENDER TABLE
// ============================================================================

function renderTable() {
    if (filteredData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-state">
                    <p>📋 Belum ada data kendaraan</p>
                    <button class="btn btn-primary" onclick="openAddModal()">+ Tambah Kendaraan Pertama</button>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filteredData
        .map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(item.no_pintu)}</td>
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
        `)
        .join('');
}

// ============================================================================
// SEARCH & FILTER
// ============================================================================

function filterTable() {
    const query = searchInput.value.toLowerCase().trim();

    if (!query) {
        filteredData = [...allData];
    } else {
        filteredData = allData.filter(item =>
            item.no_pintu.toLowerCase().includes(query)
        );
    }

    renderTable();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;

    alertContainer.appendChild(alertDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function showLoadingState() {
    tableBody.innerHTML = `
        <tr>
            <td colspan="3" class="loading-row">Memuat data...</td>
        </tr>
    `;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    testConnection();
    loadData();
});