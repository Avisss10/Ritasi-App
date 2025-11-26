// Konfigurasi API
const API_BASE_URL = 'http://localhost:3000/api';

// State Management
let orderData = [];
let editingId = null;
let deleteId = null;

// DOM Elements
const orderForm = document.getElementById('orderForm');
const orderTableBody = document.getElementById('orderTableBody');
const searchInput = document.getElementById('searchInput');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const deleteModal = document.getElementById('deleteModal');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const cancelDeleteBtn = document.getElementById('cancelDelete');

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    loadKendaraan();
    loadSupir();
    loadGalian();
    initEventListeners();
    setDefaultDate();
});

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function initEventListeners() {
    orderForm.addEventListener('submit', handleSubmit);
    cancelBtn.addEventListener('click', resetForm);
    searchInput.addEventListener('input', handleSearch);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    
    // Auto calculate hasil akhir
    document.getElementById('uang_jalan').addEventListener('input', calculateHasilAkhir);
    document.getElementById('potongan').addEventListener('input', calculateHasilAkhir);
}

// ============================================================================
// LOAD DATA
// ============================================================================
async function loadOrders() {
    try {
        showLoading();
        const response = await fetch(`${API_BASE_URL}/order`);
        
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        
        const result = await response.json();

        if (result.status) {
            orderData = result.data;
            renderTable(orderData);
        } else {
            showError('Gagal memuat data order: ' + (result.message || 'Unknown error'));
            orderTableBody.innerHTML = `<tr><td colspan="15" class="no-data">Gagal memuat data</td></tr>`;
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showError('Terjadi kesalahan saat memuat data order: ' + error.message);
        orderTableBody.innerHTML = `<tr><td colspan="15" class="no-data">Gagal memuat data</td></tr>`;
    }
}

async function loadKendaraan() {
    try {
        const response = await fetch(`${API_BASE_URL}/master/kendaraan`);
        const result = await response.json();
        
        if (result.status) {
            const select = document.getElementById('kendaraan_id');
            select.innerHTML = '<option value="">-- Pilih Kendaraan --</option>';
            
            result.data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.no_pintu} - ${item.jenis_kendaraan || ''}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading kendaraan:', error);
    }
}

async function loadSupir() {
    try {
        const response = await fetch(`${API_BASE_URL}/master/supir`);
        const result = await response.json();
        
        if (result.status) {
            const select = document.getElementById('supir_id');
            select.innerHTML = '<option value="">-- Pilih Supir --</option>';
            
            result.data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.nama;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading supir:', error);
    }
}

async function loadGalian() {
    try {
        const response = await fetch(`${API_BASE_URL}/master/galian`);
        const result = await response.json();
        
        if (result.status) {
            const select = document.getElementById('galian_id');
            select.innerHTML = '<option value="">-- Pilih Galian --</option>';
            
            result.data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.nama_galian;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading galian:', error);
    }
}

// ============================================================================
// RENDER TABLE
// ============================================================================
function renderTable(data) {
    if (data.length === 0) {
        orderTableBody.innerHTML = `
            <tr><td colspan="16" class="no-data">Tidak ada data order</td></tr>
        `;
        return;
    }

    orderTableBody.innerHTML = data.map((order, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${formatDate(order.tanggal_order)}</td>
            <td><strong>${order.no_order}</strong></td>
            <td>${order.petugas_order}</td>
            <td>${order.no_pintu || '-'}</td>
            <td>${order.supir || '-'}</td>
            <td>${order.nama_galian || '-'}</td>
            <td>${order.no_do}</td>
            <td>${order.jam_order}</td>
            <td>${order.km_awal}</td>
            <td>${formatRupiah(order.uang_jalan)}</td>
            <td>${formatRupiah(order.potongan)}</td>
            <td><strong>${formatRupiah(order.hasil_akhir)}</strong></td>
            <td>${order.proyek_input || '-'}</td>
            <td>${getStatusBadge(order.status)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-warning" onclick="editOrder(${order.id})" title="Edit Order">✏️</button>
                    <button class="btn btn-danger" onclick="deleteOrder(${order.id})" title="Hapus Order">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getStatusBadge(status) {
    const statusLower = status.toLowerCase().replace(/\s+/g, '-');
    let badgeClass = '';
    let badgeText = status;

    if (status === 'COMPLETED' || statusLower.includes('complete')) {
        badgeClass = 'status-completed';
        badgeText = 'COMPLETED';
    } else if (status === 'ON PROCESS' || statusLower.includes('process')) {
        badgeClass = 'status-on-process';
        badgeText = 'ON PROCESS';
    } else {
        badgeClass = 'status-default';
    }

    return `<span class="status-badge ${badgeClass}">${badgeText}</span>`;
}

// ============================================================================
// FORM HANDLERS
// ============================================================================
async function handleSubmit(e) {
    e.preventDefault();

    // Validasi form
    const kendaraanId = document.getElementById('kendaraan_id').value;
    const supirId = document.getElementById('supir_id').value;
    const galianId = document.getElementById('galian_id').value;

    if (!kendaraanId || !supirId || !galianId) {
        showError('Harap pilih Kendaraan, Supir, dan Galian');
        return;
    }

    // FIX: Gunakan tanggal langsung tanpa konversi timezone
    const tanggalOrder = document.getElementById('tanggal_order').value;

    const formData = {
        tanggal_order: tanggalOrder,
        no_order: document.getElementById('no_order').value,
        petugas_order: document.getElementById('petugas_order').value,
        kendaraan_id: parseInt(kendaraanId),
        supir_id: parseInt(supirId),
        galian_id: parseInt(galianId),
        no_do: document.getElementById('no_do').value,
        jam_order: document.getElementById('jam_order').value,
        km_awal: parseInt(document.getElementById('km_awal').value),
        uang_jalan: parseInt(document.getElementById('uang_jalan').value),
        potongan: parseInt(document.getElementById('potongan').value) || 0,
        proyek_input: document.getElementById('proyek_input').value || null
    };

    try {
        // Disable button saat submit
        submitBtn.disabled = true;
        submitBtn.textContent = editingId ? '⏳ Mengupdate...' : '⏳ Menyimpan...';

        let response;
        
        if (editingId) {
            response = await fetch(`${API_BASE_URL}/order/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        } else {
            response = await fetch(`${API_BASE_URL}/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        }

        const result = await response.json();

        if (result.status) {
            showSuccess(editingId ? 'Order berhasil diupdate' : 'Order berhasil ditambahkan');
            resetForm();
            await loadOrders();
        } else {
            showError(result.message || 'Gagal menyimpan order');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Terjadi kesalahan saat menyimpan order: ' + error.message);
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.textContent = editingId ? '💾 Update Order' : '💾 Simpan Order';
    }
}

function resetForm() {
    orderForm.reset();
    editingId = null;
    formTitle.textContent = 'Tambah Order Baru';
    submitBtn.textContent = '💾 Simpan Order';
    cancelBtn.style.display = 'none';
    setDefaultDate();
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tanggal_order').value = today;
}

function calculateHasilAkhir() {
    const uangJalan = parseInt(document.getElementById('uang_jalan').value) || 0;
    const potongan = parseInt(document.getElementById('potongan').value) || 0;
    const hasilAkhir = uangJalan - potongan;
    
    // Optional: Tampilkan preview hasil akhir
    console.log('Hasil Akhir:', hasilAkhir);
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================
async function editOrder(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/order/${id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();

        if (result.status) {
            const order = result.data;
            
            // FIX: Populate form dengan data order (tanggal sudah format YYYY-MM-DD)
            document.getElementById('tanggal_order').value = order.tanggal_order;
            document.getElementById('no_order').value = order.no_order;
            document.getElementById('petugas_order').value = order.petugas_order;
            document.getElementById('kendaraan_id').value = order.kendaraan_id;
            document.getElementById('supir_id').value = order.supir_id;
            document.getElementById('galian_id').value = order.galian_id;
            document.getElementById('no_do').value = order.no_do;
            document.getElementById('jam_order').value = order.jam_order;
            document.getElementById('km_awal').value = order.km_awal;
            document.getElementById('uang_jalan').value = order.uang_jalan;
            document.getElementById('potongan').value = order.potongan || 0;
            document.getElementById('proyek_input').value = order.proyek_input || '';

            // Update state dan UI
            editingId = id;
            formTitle.textContent = `Edit Order - ${order.no_order}`;
            submitBtn.textContent = '💾 Update Order';
            cancelBtn.style.display = 'inline-block';

            // Scroll ke form
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Focus ke field pertama
            document.getElementById('tanggal_order').focus();
        } else {
            showError('Gagal memuat data order: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Gagal memuat data order: ' + error.message);
    }
}

function deleteOrder(id) {
    deleteId = id;
    deleteModal.classList.add('active');
}

async function confirmDelete() {
    if (!deleteId) return;

    try {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = '⏳ Menghapus...';

        const response = await fetch(`${API_BASE_URL}/order/${deleteId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.status) {
            showSuccess('Order berhasil dihapus');
            await loadOrders();
        } else {
            showError('Gagal menghapus order: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Terjadi kesalahan saat menghapus order: ' + error.message);
    } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Hapus';
        closeDeleteModal();
    }
}

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    deleteId = null;
}

// ============================================================================
// SEARCH
// ============================================================================
function handleSearch(e) {
    const keyword = e.target.value.toLowerCase();
    
    const filtered = orderData.filter(order => {
        return (
            order.no_order.toLowerCase().includes(keyword) ||
            order.petugas_order.toLowerCase().includes(keyword) ||
            (order.no_pintu && order.no_pintu.toLowerCase().includes(keyword)) ||
            (order.supir && order.supir.toLowerCase().includes(keyword)) ||
            order.no_do.toLowerCase().includes(keyword) ||
            (order.nama_galian && order.nama_galian.toLowerCase().includes(keyword)) ||
            (order.proyek_input && order.proyek_input.toLowerCase().includes(keyword))
        );
    });

    renderTable(filtered);
}

// ============================================================================
// UTILITIES
// ============================================================================
function showLoading() {
    orderTableBody.innerHTML = `
        <tr>
            <td colspan="15" class="loading">
                <div class="spinner"></div>
                Memuat data...
            </td>
        </tr>
    `;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    
    // FIX: Handle format YYYY-MM-DD dari backend
    const date = dateString.split('T')[0]; // Ambil bagian tanggal saja
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
}

function formatRupiah(amount) {
    if (amount === null || amount === undefined) return 'Rp 0';
    
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function showSuccess(message) {
    // Bisa diganti dengan library toast/notification yang lebih bagus
    alert('✅ ' + message);
}

function showError(message) {
    // Bisa diganti dengan library toast/notification yang lebih bagus
    alert('❌ ' + message);
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================
document.addEventListener('keydown', (e) => {
    // ESC key untuk cancel/close modal
    if (e.key === 'Escape') {
        if (deleteModal.classList.contains('active')) {
            closeDeleteModal();
        } else if (editingId) {
            resetForm();
        }
    }
});