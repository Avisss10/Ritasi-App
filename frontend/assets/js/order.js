// Konfigurasi API
const API_BASE_URL = 'http://localhost:3000/api';

// State Management
let orderData = [];
let filteredData = []; // Untuk menyimpan hasil filter/search
let editingId = null;
let deleteId = null;

// Pagination State
let currentPage = 1;
const itemsPerPage = 10;

// Storage untuk data master
let masterKendaraan = [];
let masterSupir = [];
let masterGalian = [];

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
    loadOrdersTodayYesterday();
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

    // Format inputs on input
    document.getElementById('km_awal').addEventListener('input', formatKmInput);
    document.getElementById('uang_jalan').addEventListener('input', formatRupiahInput);
    document.getElementById('potongan').addEventListener('input', formatPotonganInput);

    // Setup autocomplete event listeners
    setupAutocompleteListeners();
}

// ============================================================================
// LOAD DATA
// ============================================================================
async function loadOrdersTodayYesterday() {
    try {
        showLoading();
        const response = await fetch(`${API_BASE_URL}/order/today-yesterday`);
        
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        
        const result = await response.json();

        if (result.status) {
            orderData = result.data.orders;
            filteredData = orderData; // Set filtered data awal
            currentPage = 1; // Reset ke halaman pertama
            
            // Tampilkan info tanggal hari ini dan kemarin di console
            console.log(`📅 Menampilkan data:
            - Hari Ini: ${formatDate(result.data.today)}
            - Kemarin: ${formatDate(result.data.yesterday)}
            - Total Order: ${orderData.length}`);
            
            renderTable();
            renderPagination();
        } else {
            showError('Gagal memuat data order: ' + (result.message || 'Unknown error'));
            orderTableBody.innerHTML = `<tr><td colspan="16" class="no-data">Gagal memuat data</td></tr>`;
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showError('Terjadi kesalahan saat memuat data order: ' + error.message);
        orderTableBody.innerHTML = `<tr><td colspan="16" class="no-data">Gagal memuat data</td></tr>`;
    }
}

async function loadKendaraan() {
    try {
        const response = await fetch(`${API_BASE_URL}/master/kendaraan`);
        const result = await response.json();

        if (result.status) {
            masterKendaraan = result.data;
            populateDatalist('datalist-kendaraan', result.data, 'no_pintu');
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
            masterSupir = result.data;
            populateDatalist('datalist-supir', result.data, 'nama');
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
            masterGalian = result.data;
            populateDatalist('datalist-galian', result.data, 'nama_galian');
        }
    } catch (error) {
        console.error('Error loading galian:', error);
    }
}

function populateDatalist(datalistId, data, textKey) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) {
        console.error(`❌ Datalist #${datalistId} not found`);
        return;
    }

    datalist.innerHTML = '';

    if (!Array.isArray(data) || data.length === 0) {
        console.warn(`⚠️ No data to populate for #${datalistId}`);
        return;
    }

    // Populate dengan maksimal 50 item pertama
    data.slice(0, 50).forEach(item => {
        if (item[textKey] !== undefined) {
            const option = document.createElement('option');
            option.value = item[textKey];
            datalist.appendChild(option);
        }
    });

    console.log(`✅ Populated #${datalistId}: ${Math.min(50, data.length)}/${data.length} items`);
}

// ============================================================================
// PAGINATION FUNCTIONS
// ============================================================================
function getPaginatedData() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
}

function getTotalPages() {
    return Math.ceil(filteredData.length / itemsPerPage);
}

function goToPage(page) {
    const totalPages = getTotalPages();
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderTable();
    renderPagination();
}

function renderPagination() {
    const totalPages = getTotalPages();
    const totalItems = filteredData.length;
    
    // Cari atau buat pagination container
    let paginationContainer = document.querySelector('.pagination-container');
    
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        
        // Insert setelah table-wrapper
        const tableWrapper = document.querySelector('.table-wrapper');
        tableWrapper.parentNode.insertBefore(paginationContainer, tableWrapper.nextSibling);
    }
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    // Hitung range data yang ditampilkan
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    
    let paginationHTML = `
        <div class="pagination-info">
            Menampilkan ${startItem}-${endItem} dari ${totalItems} order
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>
                «
            </button>
            <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                ‹
            </button>
    `;
    
    // Generate page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust startPage if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Add first page and ellipsis if needed
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">
                ${i}
            </button>
        `;
    }
    
    // Add last page and ellipsis if needed
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    paginationHTML += `
            <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                ›
            </button>
            <button class="pagination-btn" onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>
                »
            </button>
        </div>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
}

// ============================================================================
// RENDER TABLE
// ============================================================================
function renderTable() {
    const paginatedData = getPaginatedData();
    
    if (paginatedData.length === 0) {
        orderTableBody.innerHTML = `
            <tr><td colspan="16" class="no-data">Tidak ada data order untuk hari ini dan kemarin</td></tr>
        `;
        return;
    }

    // Hitung nomor urut berdasarkan halaman
    const startNumber = (currentPage - 1) * itemsPerPage;

    orderTableBody.innerHTML = paginatedData.map((order, index) => `
        <tr>
            <td>${startNumber + index + 1}</td>
            <td>
                ${formatDate(order.tanggal_order)}
                ${order.kategori_waktu ? `<br><span class="badge-waktu badge-${order.kategori_waktu.toLowerCase().replace(' ', '-')}">${order.kategori_waktu}</span>` : ''}
            </td>
            <td><strong>${order.no_order}</strong></td>
            <td>${order.petugas_order}</td>
            <td>${order.no_pintu || '-'}</td>
            <td>${order.supir || '-'}</td>
            <td>${order.nama_galian || '-'}</td>
            <td>${order.no_do}</td>
            <td>${order.jam_order}</td>
            <td>${formatKm(order.km_awal)}</td>
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

    // Validasi form - use hidden input values
    const kendaraanId = document.getElementById('kendaraan_id_hidden').value;
    const supirId = document.getElementById('supir_id_hidden').value;
    const galianId = document.getElementById('galian_id_hidden').value;

    if (!kendaraanId || !supirId || !galianId) {
        showError('Harap pilih Kendaraan, Supir, dan Galian');
        return;
    }

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
        km_awal: parseKm(document.getElementById('km_awal').value),
        uang_jalan: parseRupiah(document.getElementById('uang_jalan').value),
        potongan: parseRupiah(document.getElementById('potongan').value) || 0,
        proyek_input: document.getElementById('proyek_input').value || null
    };

    try {
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
            await loadOrdersTodayYesterday();
        } else {
            showError(result.message || 'Gagal menyimpan order');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Terjadi kesalahan saat menyimpan order: ' + error.message);
    } finally {
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
    document.getElementById('hasil_akhir').value = 'Rp 0';
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tanggal_order').value = today;
}

function calculateHasilAkhir() {
    const uangJalan = parseRupiah(document.getElementById('uang_jalan').value) || 0;
    const potongan = parseRupiah(document.getElementById('potongan').value) || 0;
    const hasilAkhir = uangJalan - potongan;

    document.getElementById('hasil_akhir').value = formatRupiah(hasilAkhir);
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

            document.getElementById('tanggal_order').value = order.tanggal_order;
            document.getElementById('no_order').value = order.no_order;
            document.getElementById('petugas_order').value = order.petugas_order;

            // Set kendaraan
            const kendaraanInput = document.getElementById('kendaraan_id');
            const kendaraanHidden = document.getElementById('kendaraan_id_hidden');
            const kendaraanData = masterKendaraan.find(k => k.id === order.kendaraan_id);
            if (kendaraanData) {
                kendaraanInput.value = kendaraanData.no_pintu;
                kendaraanHidden.value = kendaraanData.id;
            }

            // Set supir
            const supirInput = document.getElementById('supir_id');
            const supirHidden = document.getElementById('supir_id_hidden');
            const supirData = masterSupir.find(s => s.id === order.supir_id);
            if (supirData) {
                supirInput.value = supirData.nama;
                supirHidden.value = supirData.id;
            }

            // Set galian
            const galianInput = document.getElementById('galian_id');
            const galianHidden = document.getElementById('galian_id_hidden');
            const galianData = masterGalian.find(g => g.id === order.galian_id);
            if (galianData) {
                galianInput.value = galianData.nama_galian;
                galianHidden.value = galianData.id;
            }

            document.getElementById('no_do').value = order.no_do;
            document.getElementById('jam_order').value = order.jam_order;
            document.getElementById('km_awal').value = formatKm(order.km_awal);
            document.getElementById('uang_jalan').value = formatRupiah(order.uang_jalan);
            document.getElementById('potongan').value = formatRupiah(order.potongan || 0);
            document.getElementById('proyek_input').value = order.proyek_input || '';

            editingId = id;
            formTitle.textContent = `Edit Order - ${order.no_order}`;
            submitBtn.textContent = '💾 Update Order';
            cancelBtn.style.display = 'inline-block';

            window.scrollTo({ top: 0, behavior: 'smooth' });
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
            await loadOrdersTodayYesterday();
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
    
    filteredData = orderData.filter(order => {
        return (
            order.no_order.toLowerCase().includes(keyword) ||
            order.petugas_order.toLowerCase().includes(keyword) ||
            (order.no_pintu && order.no_pintu.toLowerCase().includes(keyword)) ||
            (order.supir && order.supir.toLowerCase().includes(keyword)) ||
            order.no_do.toLowerCase().includes(keyword) ||
            (order.nama_galian && order.nama_galian.toLowerCase().includes(keyword)) ||
            (order.proyek_input && order.proyek_input.toLowerCase().includes(keyword)) ||
            (order.kategori_waktu && order.kategori_waktu.toLowerCase().includes(keyword))
        );
    });

    currentPage = 1; // Reset ke halaman pertama saat search
    renderTable();
    renderPagination();
}

// ============================================================================
// UTILITIES
// ============================================================================
function showLoading() {
    orderTableBody.innerHTML = `
        <tr>
            <td colspan="16" class="loading">
                <div class="spinner"></div>
                Memuat data...
            </td>
        </tr>
    `;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = dateString.split('T')[0];
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

function formatNumber(amount) {
    if (amount === null || amount === undefined) return '0';

    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatKm(km) {
    if (km === null || km === undefined) return '0';
    return formatNumber(km);
}

function parseRupiah(rupiahString) {
    if (!rupiahString) return 0;
    const cleaned = rupiahString.replace(/Rp\s?/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

function parseKm(kmString) {
    if (!kmString) return 0;
    const cleaned = kmString.replace(/km\s?/g, '').replace(/\./g, '').trim();
    return parseInt(cleaned) || 0;
}

function formatKmInput() {
    const input = document.getElementById('km_awal');
    const value = parseKm(input.value);
    input.value = formatNumber(value);
}

function formatRupiahInput() {
    const input = document.getElementById('uang_jalan');
    const value = parseRupiah(input.value);
    input.value = formatNumber(value);
}

function formatPotonganInput() {
    const input = document.getElementById('potongan');
    const value = parseRupiah(input.value);
    input.value = formatNumber(value);
}

function showSuccess(message) {
    alert('✅ ' + message);
}

function showError(message) {
    alert('❌ ' + message);
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (deleteModal.classList.contains('active')) {
            closeDeleteModal();
        } else if (editingId) {
            resetForm();
        }
    }
});

// ============================================================================
// AUTOCOMPLETE FUNCTIONS
// ============================================================================
function setupAutocompleteListeners() {
    // Setup untuk kendaraan
    const kendaraanInput = document.getElementById('kendaraan_id');
    const kendaraanHidden = document.getElementById('kendaraan_id_hidden');
    const kendaraanDatalist = document.getElementById('datalist-kendaraan');

    if (kendaraanInput && kendaraanHidden && kendaraanDatalist) {
        kendaraanInput.addEventListener('input', (e) => {
            filterDatalist(e.target.value, kendaraanDatalist, masterKendaraan, 'no_pintu', kendaraanHidden);
        });

        kendaraanInput.addEventListener('change', (e) => {
            const selectedItem = masterKendaraan.find(item => item.no_pintu === e.target.value);
            kendaraanHidden.value = selectedItem ? selectedItem.id : '';
        });
    }

    // Setup untuk supir
    const supirInput = document.getElementById('supir_id');
    const supirHidden = document.getElementById('supir_id_hidden');
    const supirDatalist = document.getElementById('datalist-supir');

    if (supirInput && supirHidden && supirDatalist) {
        supirInput.addEventListener('input', (e) => {
            filterDatalist(e.target.value, supirDatalist, masterSupir, 'nama', supirHidden);
        });

        supirInput.addEventListener('change', (e) => {
            const selectedItem = masterSupir.find(item => item.nama === e.target.value);
            supirHidden.value = selectedItem ? selectedItem.id : '';
        });
    }

    // Setup untuk galian
    const galianInput = document.getElementById('galian_id');
    const galianHidden = document.getElementById('galian_id_hidden');
    const galianDatalist = document.getElementById('datalist-galian');

    if (galianInput && galianHidden && galianDatalist) {
        galianInput.addEventListener('input', (e) => {
            filterDatalist(e.target.value, galianDatalist, masterGalian, 'nama_galian', galianHidden);
        });

        galianInput.addEventListener('change', (e) => {
            const selectedItem = masterGalian.find(item => item.nama_galian === e.target.value);
            galianHidden.value = selectedItem ? selectedItem.id : '';
        });
    }
}

function filterDatalist(inputValue, datalist, dataArray, textKey, hiddenInput) {
    if (!datalist || !Array.isArray(dataArray)) return;

    datalist.innerHTML = '';

    if (!inputValue.trim()) {
        dataArray.slice(0, 50).forEach(item => {
            if (item[textKey] !== undefined) {
                const option = document.createElement('option');
                option.value = item[textKey];
                datalist.appendChild(option);
            }
        });
        hiddenInput.value = '';
        return;
    }

    const filtered = dataArray.filter(item =>
        item[textKey] && item[textKey].toLowerCase().includes(inputValue.toLowerCase())
    );

    filtered.slice(0, 50).forEach(item => {
        const option = document.createElement('option');
        option.value = item[textKey];
        datalist.appendChild(option);
    });

    const exactMatch = filtered.find(item => item[textKey].toLowerCase() === inputValue.toLowerCase());
    hiddenInput.value = exactMatch ? exactMatch.id : '';

    console.log(`🔍 Filtered ${textKey}: ${filtered.length} matches for "${inputValue}"`);
}