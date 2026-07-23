// ============================================================================
// BUANGAN.JS - RITASI MANAGEMENT
// ============================================================================

const API_BASE_URL = '/api';
let currentOrderData = null;
let currentKmAwal = 0;
let isKmAwalOdoError = false;

// Helper: check exact ODO ERROR variants for display (case/space tolerant)
function isExactOdoVariantDisplay(val) {
    if (val === null || val === undefined) return false;
    const s = String(val).toUpperCase().replace(/\s/g, '').trim();
    return s === 'ODOERROR' || s === 'ODOERR';
} 

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Set tanggal hari ini sebagai default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tanggalOrder').value = today;
    document.getElementById('tanggalDari').value = today;
    document.getElementById('tanggalHingga').value = today;
    document.getElementById('tanggalBongkar').value = today;

    // Load master galian untuk dropdown
    loadGalianOptions();

    // Load daftar buangan (default view) lalu aktifkan tab Daftar Buangan
    loadBuanganList().then(() => switchTab('buangan'));

    // Setup form submit
    document.getElementById('buanganForm').addEventListener('submit', handleFormSubmit);

    // Setup edit form submit
    document.getElementById('editBuanganForm').addEventListener('submit', handleEditFormSubmit);

    // KM Akhir (Form Tambah) - Support ODO ERROR
    document.getElementById('kmAkhir').addEventListener('input', function(e) {
        handleKmAkhirInputWithODO(e.target, 'jarakKm');
    });

    // KM Akhir (Form Edit) - Support ODO ERROR
    document.getElementById('editKmAkhir').addEventListener('input', function(e) {
        handleKmAkhirInputWithODO(e.target, 'editJarakKm');
    });

    // Uang Alihan - Format saja (Form Tambah)
    document.getElementById('uangAlihan').addEventListener('input', function(e) {
        formatNumberInput(e.target);
    });

    // Uang Alihan - Format saja (Form Edit)
    document.getElementById('editUangAlihan').addEventListener('input', function(e) {
        formatNumberInput(e.target);
    });

    // KM Awal (Form Edit Order) - update currentKmAwalEdit dan recalculate jarak
    document.getElementById('editOrderKmAwal').addEventListener('input', function(e) {
        handleKmAwalEditInput(e.target.value);
    });

    // Uang Jalan / Potongan auto-calculate hasil akhir
    document.getElementById('editOrderUangJalan').addEventListener('input', function() {
        formatNumberInput(this);
        hitungHasilAkhirEdit();
    });
    document.getElementById('editOrderPotongan').addEventListener('input', function() {
        formatNumberInput(this);
        hitungHasilAkhirEdit();
    });

    // Load master data untuk form edit order
    loadMasterOptions();
});

// Global variable untuk menyimpan semua data
let allOrderData = [];
let allBuanganData = [];
let currentTipeAlihan = 'tambah';     // 'tambah' (+) atau 'kurang' (-)
let currentTipeAlihanEdit = 'tambah'; // 'tambah' (+) atau 'kurang' (-)
let currentViewMode = 'buangan'; // 'order' atau 'buangan'
let currentBuanganDetail = null;
let currentKmAwalEdit = 0;

// Search & tab state
let currentSearchDate = null;     // tanggal tunggal / tanggal awal rentang
let currentSearchDateEnd = null;  // tanggal akhir rentang (null = mode satu tanggal)
let currentDateMode = 'single';   // 'single' atau 'range'
let allSearchBuanganData = [];    // buangan untuk tanggal yang dicari
let currentTab = 'order';         // tab aktif: 'order' atau 'buangan'
let activeStatusFilter = 'all';   // filter status: 'all','on_process','complete','batal'

// Pagination variables
let currentOrderPage = 1;
let currentBuanganPage = 1;
let currentMobilLuarPage = 1;
let itemsPerPage = 10;
let filteredOrderData = [];
let filteredBuanganData = [];
let filteredMobilLuarData = [];

// ============================================================================
// PAGINATION - ORDER TABLE
// ============================================================================
function changeOrderPage(direction) {
    const totalPages = Math.ceil(filteredOrderData.length / itemsPerPage);
    
    if (direction === 'prev' && currentOrderPage > 1) {
        currentOrderPage--;
    } else if (direction === 'next' && currentOrderPage < totalPages) {
        currentOrderPage++;
    }
    
    displayOrderResults(filteredOrderData);
}

function updateOrderPagination(dataLength) {
    const totalPages = Math.ceil(dataLength / itemsPerPage);
    const paginationContainer = document.getElementById('orderPagination');
    const pageInfo = document.getElementById('orderPageInfo');
    const prevBtn = document.getElementById('orderPrevBtn');
    const nextBtn = document.getElementById('orderNextBtn');
    
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'flex';
    pageInfo.textContent = `Halaman ${currentOrderPage} dari ${totalPages}`;
    
    prevBtn.disabled = currentOrderPage === 1;
    nextBtn.disabled = currentOrderPage === totalPages;
    
    if (currentOrderPage === 1) {
        prevBtn.style.opacity = '0.5';
        prevBtn.style.cursor = 'not-allowed';
    } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'pointer';
    }
    
    if (currentOrderPage === totalPages) {
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
    } else {
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
    }
}

// ============================================================================
// PAGINATION - BUANGAN TABLE
// ============================================================================
function changeBuanganPage(direction) {
    const totalPages = Math.ceil(filteredBuanganData.length / itemsPerPage);
    
    if (direction === 'prev' && currentBuanganPage > 1) {
        currentBuanganPage--;
    } else if (direction === 'next' && currentBuanganPage < totalPages) {
        currentBuanganPage++;
    }
    
    displayBuanganList(filteredBuanganData);
}

// New pagination helpers (Order-style) for Buangan
function getBuanganTotalPages() {
    return Math.ceil(filteredBuanganData.length / itemsPerPage);
}

function goToBuanganPage(page) {
    const totalPages = getBuanganTotalPages();
    if (page < 1 || page > totalPages) return;
    currentBuanganPage = page;
    displayBuanganList(filteredBuanganData);
    renderBuanganPagination();
}

function renderBuanganPagination() {
    const totalPages = getBuanganTotalPages();
    const totalItems = filteredBuanganData.length;
    const paginationContainer = document.getElementById('buanganPagination');

    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';

    const startItem = (currentBuanganPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentBuanganPage * itemsPerPage, totalItems);

    let paginationHTML = `
        <div class="pagination-info">
            Menampilkan ${startItem}-${endItem} dari ${totalItems} buangan
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" onclick="goToBuanganPage(1)" ${currentBuanganPage === 1 ? 'disabled' : ''}>«</button>
            <button class="pagination-btn" onclick="goToBuanganPage(${currentBuanganPage - 1})" ${currentBuanganPage === 1 ? 'disabled' : ''}>‹</button>
    `;

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentBuanganPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="goToBuanganPage(1)">1</button>`;
        if (startPage > 2) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="pagination-btn ${i === currentBuanganPage ? 'active' : ''}" onclick="goToBuanganPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        paginationHTML += `<button class="pagination-btn" onclick="goToBuanganPage(${totalPages})">${totalPages}</button>`;
    }

    paginationHTML += `
            <button class="pagination-btn" onclick="goToBuanganPage(${currentBuanganPage + 1})" ${currentBuanganPage === totalPages ? 'disabled' : ''}>›</button>
            <button class="pagination-btn" onclick="goToBuanganPage(${totalPages})" ${currentBuanganPage === totalPages ? 'disabled' : ''}>»</button>
        </div>
    `;

    paginationContainer.innerHTML = paginationHTML;
}

// Backwards-compatible wrapper used by displayBuanganList
function updateBuanganPagination(dataLength) {
    renderBuanganPagination();
}

// ============================================================================
// PAGINATION - MOBIL LUAR TABLE
// ============================================================================
function getMobilLuarTotalPages() {
    return Math.ceil(filteredMobilLuarData.length / itemsPerPage);
}

function goToMobilLuarPage(page) {
    const totalPages = getMobilLuarTotalPages();
    if (page < 1 || page > totalPages) return;
    currentMobilLuarPage = page;
    _renderMobilLuarRows();
    renderMobilLuarPagination();
}

function renderMobilLuarPagination() {
    const totalPages = getMobilLuarTotalPages();
    const totalItems = filteredMobilLuarData.length;
    const paginationContainer = document.getElementById('mobilLuarPagination');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';

    const startItem = (currentMobilLuarPage - 1) * itemsPerPage + 1;
    const endItem   = Math.min(currentMobilLuarPage * itemsPerPage, totalItems);

    let html = `
        <div class="pagination-info">
            Menampilkan ${startItem}–${endItem} dari ${totalItems} data
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" onclick="goToMobilLuarPage(1)" ${currentMobilLuarPage === 1 ? 'disabled' : ''}>«</button>
            <button class="pagination-btn" onclick="goToMobilLuarPage(${currentMobilLuarPage - 1})" ${currentMobilLuarPage === 1 ? 'disabled' : ''}>‹</button>
    `;

    const maxVisible = 5;
    let startPage = Math.max(1, currentMobilLuarPage - Math.floor(maxVisible / 2));
    let endPage   = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="goToMobilLuarPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
    }
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === currentMobilLuarPage ? 'active' : ''}" onclick="goToMobilLuarPage(${i})">${i}</button>`;
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
        html += `<button class="pagination-btn" onclick="goToMobilLuarPage(${totalPages})">${totalPages}</button>`;
    }

    html += `
            <button class="pagination-btn" onclick="goToMobilLuarPage(${currentMobilLuarPage + 1})" ${currentMobilLuarPage === totalPages ? 'disabled' : ''}>›</button>
            <button class="pagination-btn" onclick="goToMobilLuarPage(${totalPages})" ${currentMobilLuarPage === totalPages ? 'disabled' : ''}>»</button>
        </div>
    `;

    paginationContainer.innerHTML = html;
}

// ============================================================================
// SWITCH TAB — selalu tampil: 'order' atau 'buangan'
// ============================================================================
function switchTab(tab) {
    currentTab = tab;
    const tabOrderBtn = document.getElementById('tabOrderBtn');
    const tabBuanganBtn = document.getElementById('tabBuanganBtn');

    if (tab === 'order') {
        tabOrderBtn.classList.add('active');
        tabBuanganBtn.classList.remove('active');
        document.getElementById('statusFilterBar').style.display = 'none';
        document.getElementById('orderTableContainer').style.display = 'block';
        document.getElementById('buanganTableContainer').style.display = 'none';

        if (allOrderData.length > 0) {
            displayOrderResults(allOrderData);
        } else {
            // Belum ada pencarian — tampilkan petunjuk
            document.getElementById('orderTableBody').innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <div class="empty-state-text">Gunakan form "Cari Order" di atas untuk menampilkan data order</div>
                    </td>
                </tr>
            `;
            document.getElementById('orderPagination').style.display = 'none';
        }
    } else {
        tabOrderBtn.classList.remove('active');
        tabBuanganBtn.classList.add('active');
        document.getElementById('statusFilterBar').style.display = 'flex';
        document.getElementById('orderTableContainer').style.display = 'none';
        document.getElementById('buanganTableContainer').style.display = 'block';
        currentBuanganPage = 1;
        // Jika sedang dalam mode pencarian, tampilkan buangan untuk tanggal itu saja
        if (currentSearchDate) {
            displayBuanganList(allSearchBuanganData);
        } else {
            applyBuanganFilter();
        }
    }
}

// Kembali ke hasil pencarian setelah simpan buangan
async function returnToSearchResults() {
    document.getElementById('formSection').style.display = 'none';
    document.getElementById('editSection').style.display = 'none';
    document.getElementById('detailSection').style.display = 'none';
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('mainTableSection').style.display = 'block';

    // Restore input tanggal sesuai mode
    if (currentDateMode === 'range' && currentSearchDate && currentSearchDateEnd) {
        document.getElementById('tanggalDari').value = currentSearchDate;
        document.getElementById('tanggalHingga').value = currentSearchDateEnd;
        setDateMode('range');
    } else if (currentSearchDate) {
        document.getElementById('tanggalOrder').value = currentSearchDate;
        setDateMode('single');
    }

    // Reload data agar buangan yang baru tersimpan ikut muncul
    await loadBuanganList();
    await cariOrder();
    // Pindah ke tab Daftar Buangan supaya user langsung lihat data baru
    switchTab('buangan');
}

// ============================================================================
// TOGGLE MODE TANGGAL
// ============================================================================
function setDateMode(mode) {
    currentDateMode = mode;
    if (mode === 'single') {
        document.getElementById('modeSingle').style.display = 'flex';
        document.getElementById('modeRange').style.display = 'none';
        document.getElementById('modeSingleBtn').classList.add('active');
        document.getElementById('modeRangeBtn').classList.remove('active');
    } else {
        document.getElementById('modeSingle').style.display = 'none';
        document.getElementById('modeRange').style.display = 'flex';
        document.getElementById('modeSingleBtn').classList.remove('active');
        document.getElementById('modeRangeBtn').classList.add('active');
    }
}

// Helper: konversi datetime string ke tanggal lokal (Jakarta UTC+7)
function toLocalDateStr(datetimeStr) {
    if (!datetimeStr) return null;
    const d = new Date(datetimeStr);
    return new Date(d.getTime() + (7 * 60 * 60 * 1000)).toISOString().substring(0, 10);
}

// Helper: apakah localDateStr masuk rentang [dari, hingga]
function isInDateRange(localDateStr, dari, hingga) {
    if (!localDateStr) return false;
    if (dari && hingga) return localDateStr >= dari && localDateStr <= hingga;
    if (dari) return localDateStr >= dari;
    if (hingga) return localDateStr <= hingga;
    return true;
}

// ============================================================================
// SEARCH ORDER
// ============================================================================
async function cariOrder() {
    // Ambil parameter sesuai mode
    let tanggalDari, tanggalHingga;
    if (currentDateMode === 'range') {
        tanggalDari = document.getElementById('tanggalDari').value;
        tanggalHingga = document.getElementById('tanggalHingga').value;
        if (!tanggalDari || !tanggalHingga) {
            showToast('Mohon isi kedua tanggal (dari dan hingga)', 'warning');
            return;
        }
        if (tanggalDari > tanggalHingga) {
            showToast('Tanggal "Dari" tidak boleh lebih besar dari tanggal "Hingga"', 'warning');
            return;
        }
    } else {
        tanggalDari = document.getElementById('tanggalOrder').value;
        tanggalHingga = tanggalDari;
        if (!tanggalDari) {
            showToast('Mohon pilih tanggal order', 'warning');
            return;
        }
    }

    try {
        // Cari order berdasarkan tanggal
        const response = await fetch(`${API_BASE_URL}/order`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Debug: tampilkan struktur response
        console.log('Response dari API:', result);

        // Handle berbagai format response
        let orderData = [];
        
        // Cek apakah result punya property success
        if (result.hasOwnProperty('success')) {
            if (result.success && Array.isArray(result.data)) {
                orderData = result.data;
            } else if (!result.success) {
                throw new Error(result.message || 'Request gagal');
            }
        } 
        // Cek apakah result langsung array
        else if (Array.isArray(result)) {
            orderData = result;
        }
        // Cek apakah result punya property data langsung
        else if (result.data && Array.isArray(result.data)) {
            orderData = result.data;
        }
        // Jika tidak ada yang cocok
        else {
            console.error('Format response tidak dikenali:', result);
            throw new Error('Format response tidak valid. Cek console untuk detail.');
        }

        console.log('Data order yang didapat:', orderData);

        // Filter berdasarkan tanggal / rentang (handle UTC→WIB)
        const filteredOrders = orderData.filter(order => {
            const localDateStr = toLocalDateStr(order.tanggal_order);
            return isInDateRange(localDateStr, tanggalDari, tanggalHingga);
        });

        // Simpan state pencarian
        currentSearchDate = tanggalDari;
        currentSearchDateEnd = (currentDateMode === 'range') ? tanggalHingga : null;
        currentViewMode = 'order';

        // Filter buangan untuk rentang yang dicari
        allSearchBuanganData = allBuanganData.filter(b => {
            const localStr = toLocalDateStr(b.tanggal_order);
            return isInDateRange(localStr, tanggalDari, tanggalHingga);
        });

        // Update badge tab
        const tabOrderCount = document.getElementById('tabOrderCount');
        const tabBuanganCount = document.getElementById('tabBuanganCount');
        tabOrderCount.textContent = filteredOrders.length;
        tabOrderCount.style.display = 'inline';
        tabBuanganCount.textContent = allSearchBuanganData.length;
        tabBuanganCount.style.display = 'inline';

        if (filteredOrders.length === 0) {
            const label = currentDateMode === 'range'
                ? `${tanggalDari} s/d ${tanggalHingga}`
                : tanggalDari;
            showToast(`Tidak ada order pada tanggal ${label}`, 'warning');
            allOrderData = [];
        } else {
            allOrderData = filteredOrders;
            const label = currentDateMode === 'range'
                ? `${tanggalDari} s/d ${tanggalHingga}`
                : tanggalDari;
            showToast(`Ditemukan ${filteredOrders.length} order`, 'success');
        }

        const filterInput = document.getElementById('filterNoPintu');
        if (filterInput) filterInput.value = '';

        switchTab('order');

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal mencari order: ' + error.message, 'error');
    }
}

// ============================================================================
// FILTER TABLE (UNIVERSAL)
// ============================================================================
function filterTable() {
    // Saat mode pencarian: gunakan tab aktif untuk menentukan filter
    if (currentSearchDate) {
        if (currentTab === 'order') {
            filterByNoPintu();
        } else {
            filterBuanganByNoPintu();
        }
    } else if (currentViewMode === 'order') {
        filterByNoPintu();
    } else {
        applyBuanganFilter();
    }
}

// ============================================================================
// FILTER ORDER BY NO PINTU
// ============================================================================
function filterByNoPintu() {
    currentOrderPage = 1; // Reset to first page
    const filterValue = document.getElementById('filterNoPintu').value.toLowerCase().trim();

    if (filterValue === '') {
        displayOrderResults(allOrderData);
    } else {
        const filtered = allOrderData.filter(order => {
            return order.no_pintu && order.no_pintu.toLowerCase().includes(filterValue);
        });
        displayOrderResults(filtered);
    }
}

// ============================================================================
// FILTER BUANGAN BY NO PINTU
// ============================================================================
function filterBuanganByNoPintu() {
    currentBuanganPage = 1;
    const filterValue = document.getElementById('filterNoPintu').value.toLowerCase().trim();
    // Gunakan data search jika sedang di tab buangan pencarian, atau allBuanganData di mode normal
    const sourceData = (currentSearchDate && currentTab === 'buangan') ? allSearchBuanganData : allBuanganData;

    if (filterValue === '') {
        displayBuanganList(sourceData);
    } else {
        const filtered = sourceData.filter(buangan =>
            buangan.no_pintu && buangan.no_pintu.toLowerCase().includes(filterValue)
        );
        displayBuanganList(filtered);
    }
}

// ============================================================================
// DISPLAY ORDER RESULTS
// ============================================================================
function displayOrderResults(orders) {
    filteredOrderData = orders;
    
    const tbody = document.getElementById('orderTableBody');
    tbody.innerHTML = '';
    
    // Calculate pagination
    const startIndex = (currentOrderPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = orders.slice(startIndex, endIndex);
    
    paginatedData.forEach((order, index) => {
        const tr = document.createElement('tr');
        
        // Calculate row number (global index)
        const rowNumber = startIndex + index + 1;
        
        let statusBadge = '';
        if (order.status === 'COMPLETE') {
            statusBadge = '<span class="badge badge-complete">COMPLETE</span>';
        } else if (order.status === 'BATAL') {
            statusBadge = '<span class="badge badge-batal">BATAL</span>';
        } else {
            statusBadge = '<span class="badge badge-pending">ON PROCESS</span>';
        }

        let actionButtons;
        if (order.status === 'BATAL') {
            actionButtons = `
                <button class="btn btn-success btn-small" onclick="bukaModalUnBatal(${order.id})">
                    <span class="icon">♻️</span> Un-batal
                </button>
            `;
        } else if (order.status === 'COMPLETE') {
            actionButtons = '-';
        } else {
            actionButtons = `
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-warning btn-small" onclick="bukaFormBuangan(${order.id})">
                        <span class="icon">📋</span> Buangan
                    </button>
                    <button class="btn btn-danger btn-small" onclick="bukaModalBatal(${order.id})">
                        <span class="icon">⚠️</span> Batal Order
                    </button>
                </div>
            `;
        }

        tr.innerHTML = `
            <td style="text-align: center; font-weight: 600;">${rowNumber}</td>
            <td>${order.no_order || '-'}</td>
            <td>${formatDate(order.tanggal_order)}</td>
            <td>${order.no_pintu || '-'}</td>
            <td>${order.supir || '-'}</td>
            <td>${order.nama_galian || order.galian || '-'}</td>
            <td>${formatKMAwal(order.km_awal)}</td>
            <td>${statusBadge}</td>
            <td>${actionButtons}</td>
        `;

        tbody.appendChild(tr);
    });
    
    updateOrderPagination(orders.length);
}

// ============================================================================
// BUKA FORM BUANGAN
// ============================================================================
async function bukaFormBuangan(orderId) {
    try {
        // Ambil detail order
        const response = await fetch(`${API_BASE_URL}/order/${orderId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Response order detail:', result);

        // Normalisasi format response
        let order = null;
        if (result.hasOwnProperty('success') && result.success && result.data) {
            order = result.data;
        } else if (result.data) {
            order = result.data;
        } else if (result.id) {
            order = result;
        } else if (Array.isArray(result) && result.length > 0) {
            order = result[0];
        }
        
        if (!order || !order.id) {
            console.error('Format response tidak valid:', result);
            throw new Error('Data order tidak ditemukan');
        }

        console.log('Order data:', order);

        currentOrderData = order;

        // Handle KM Awal - jika ODO ERROR, set ke 0 untuk perhitungan
        if (typeof order.km_awal === 'string' &&
            (order.km_awal.toUpperCase() === 'ODO ERROR' ||
            order.km_awal.toUpperCase() === 'ODOERROR' ||
            order.km_awal.toUpperCase() === 'ODO ERR' ||
            order.km_awal.toUpperCase() === 'ODOERR')) {
            currentKmAwal = 0; // Set ke 0 jika ODO ERROR
            isKmAwalOdoError = true;
        } else {
            currentKmAwal = parseInt(String(order.km_awal).replace(/\./g, '').replace(/,/g, ''), 10) || 0;
            isKmAwalOdoError = false;
        }

        // Isi form dengan data order
        document.getElementById('orderId').value = order.id;

        // Tampilkan info order
        displayOrderInfo(order);

        // Jangan lagi menghitung/men-set noUrut secara otomatis.
        // Biarkan kosong sehingga pengguna dapat mengisikan sendiri.
        document.getElementById('noUrut').value = '';

        // Reset field lain (tetap kosongkan default form fields)
        document.getElementById('noUrut').value = ''; 
        document.getElementById('tanggalBongkar').value = new Date().toISOString().split('T')[0];
        document.getElementById('jamBongkar').value = '';
        document.getElementById('kmAkhir').value = '';
        document.getElementById('jarakKm').value = '';
        document.getElementById('lokasiBongkar').value = '';
        document.getElementById('alihan').checked = false;
        document.getElementById('galianAlihan').value = '';
        document.getElementById('uangAlihan').value = '';
        document.getElementById('keterangan').value = '';
        document.getElementById('alihanFields').style.display = 'none';
        setTipeAlihan('tambah');

        // Show form
        document.getElementById('searchSection').style.display = 'none';
        document.getElementById('mainTableSection').style.display = 'none';
        document.getElementById('formSection').style.display = 'block';

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal membuka form: ' + error.message, 'error');
    }
}

// ============================================================================
// DISPLAY ORDER INFO
// ============================================================================
function displayOrderInfo(order) {
    const orderInfo = document.getElementById('orderInfo');
    
    orderInfo.innerHTML = `
        <h3 style="margin-bottom: 15px;">Informasi Order</h3>
        <div class="order-info-grid">
            <div class="order-info-item">
                <div class="order-info-label">No Order</div>
                <div class="order-info-value">${order.no_order || '-'}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">Tanggal Order</div>
                <div class="order-info-value">${formatDate(order.tanggal_order)}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">No Pintu</div>
                <div class="order-info-value">${order.no_pintu || '-'}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">Supir</div>
                <div class="order-info-value">${order.supir || '-'}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">Galian</div>
                <div class="order-info-value">${order.galian || order.nama_galian || '-'}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">Proyek</div>
                <div class="order-info-value">${order.proyek_input || '-'}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">KM Awal</div>
                <div class="order-info-value">${formatKMAwal(order.km_awal)}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">No DO</div>
                <div class="order-info-value">${order.no_do || '-'}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">Uang Jalan</div>
                <div class="order-info-value">${formatCurrency(order.uang_jalan)}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">Hasil Akhir</div>
                <div class="order-info-value">${formatCurrency(order.hasil_akhir)}</div>
            </div>
        </div>
    `;
}

// ============================================================================
// TOGGLE ALIHAN FIELDS
// ============================================================================
function toggleAlihan() {
    const alihan = document.getElementById('alihan').checked;
    document.getElementById('alihanFields').style.display = alihan ? 'block' : 'none';

    if (!alihan) {
        document.getElementById('galianAlihan').value = '';
        document.getElementById('uangAlihan').value = '';
        setTipeAlihan('tambah');
    }
}

// ============================================================================
// TOGGLE ALIHAN EDIT
// ============================================================================
function toggleAlihanEdit() {
    const alihan = document.getElementById('editAlihan').checked;
    document.getElementById('editAlihanFields').style.display = alihan ? 'block' : 'none';

    if (!alihan) {
        document.getElementById('editGalianAlihan').value = '';
        document.getElementById('editUangAlihan').value = '';
        setTipeAlihanEdit('tambah');
    }
}

// ============================================================================
// SET TIPE ALIHAN (+/-)
// ============================================================================
function setTipeAlihan(tipe) {
    currentTipeAlihan = tipe;
    const plusBtn = document.getElementById('tipeAlihanPlus');
    const minusBtn = document.getElementById('tipeAlihanMinus');
    if (plusBtn) plusBtn.classList.toggle('active', tipe === 'tambah');
    if (minusBtn) minusBtn.classList.toggle('active', tipe === 'kurang');
}

function setTipeAlihanEdit(tipe) {
    currentTipeAlihanEdit = tipe;
    const plusBtn = document.getElementById('editTipeAlihanPlus');
    const minusBtn = document.getElementById('editTipeAlihanMinus');
    if (plusBtn) plusBtn.classList.toggle('active', tipe === 'tambah');
    if (minusBtn) minusBtn.classList.toggle('active', tipe === 'kurang');
}

// ============================================================================
// HANDLE KM AKHIR INPUT (NO AUTO-CORRECT)
// ============================================================================
function handleKmAkhirInputWithODO(input, jarakInputId) {
    const raw = input.value;
    if (!raw || raw.trim() === '') {
        input.value = raw ? raw.trim() : '';
        document.getElementById(jarakInputId).value = '';
        return;
    }

    // If the input contains any digit, treat as numeric-ish and format/extract number
    const containsDigit = /\d/.test(raw);

    if (containsDigit) {
        // Extract digits (and keep dots) to allow users typing formatted numbers
        const cleanedDigits = raw.toString().replace(/[^0-9.\-]/g, '');
        if (!cleanedDigits) {
            // no usable numbers
            document.getElementById(jarakInputId).value = '';
            return;
        }

        // Limit length (digits only)
        const digitsOnly = cleanedDigits.replace(/\D/g, '').substring(0, 10);
        const number = parseInt(digitsOnly, 10);
        if (isNaN(number)) {
            document.getElementById(jarakInputId).value = '';
            return;
        }

        // Format display with thousand separators
        input.value = number.toLocaleString('id-ID');

        // Compute distance if KM Awal is numeric
        const kmAwal = jarakInputId.includes('edit') ? Number(currentKmAwalEdit) : parseFloat(currentKmAwal);
        const isKmAwalOdo = jarakInputId.includes('edit') 
            ? (typeof currentBuanganDetail?.order?.km_awal === 'string' && 
               (currentBuanganDetail.order.km_awal.toUpperCase().replace(/\s/g,'') === 'ODOERROR' || currentBuanganDetail.order.km_awal.toUpperCase() === 'ODO ERROR'))
            : isKmAwalOdoError;

        if (isKmAwalOdo) {
            document.getElementById(jarakInputId).value = 'ODO ERROR';
        } else if (!isNaN(number) && !isNaN(kmAwal)) {
            const jarak = number - kmAwal;
            if (jarak >= 0) {
                document.getElementById(jarakInputId).value = formatKM(jarak) + ' KM';
            } else {
                document.getElementById(jarakInputId).value = '';
            }
        } else {
            document.getElementById(jarakInputId).value = '';
        }

    } else {
        // Arbitrary text (no digits) — preserve as typed and clear distance
        input.value = raw;
        document.getElementById(jarakInputId).value = '';
    }
}

// ============================================================================
// HITUNG JARAK - REAL TIME
// ============================================================================
function hitungJarak() {
    const kmAkhirInput = document.getElementById('kmAkhir');
    const jarakKmInput = document.getElementById('jarakKm');
    
    const kmAkhir = parseKMInput(kmAkhirInput.value);
    const kmAwal = parseFloat(currentKmAwal);

    // Validasi input
    if (!kmAkhirInput.value || isNaN(kmAkhir) || isNaN(kmAwal)) {
        jarakKmInput.value = '';
        return;
    }

    // Hitung jarak
    const jarak = kmAkhir - kmAwal;

    // Tampilkan hasil real-time (boleh negatif untuk validasi visual)
    if (jarak >= 0) {
        jarakKmInput.value = formatKM(jarak) + ' KM';
    } else {
        jarakKmInput.value = formatKM(jarak) + ' KM';
    }
}

// ============================================================================
// HITUNG JARAK EDIT
// ============================================================================
function hitungJarakEdit() {
    const kmAkhir = parseKMInput(document.getElementById('editKmAkhir').value);
    const kmAwal = Number(currentKmAwalEdit);

    if (isNaN(kmAkhir) || isNaN(kmAwal)) {
        document.getElementById('editJarakKm').value = '';
        return;
    }

    const jarak = kmAkhir - kmAwal;

    if (jarak >= 0) {
        document.getElementById('editJarakKm').value = formatKM(jarak) + ' KM';
    } else {
        document.getElementById('editJarakKm').value = '';
    }
}

// ============================================================================
// HANDLE FORM SUBMIT 
// ============================================================================
async function handleFormSubmit(e) {
    e.preventDefault();

    const kmAkhirInput = document.getElementById('kmAkhir').value.trim();
    const lokasiBongkar = document.getElementById('lokasiBongkar').value.trim();
    
    // Validasi lokasi buangan wajib diisi
    if (!lokasiBongkar) {
        showToast('Lokasi buangan wajib diisi', 'warning');
        return;
    }
    
    let kmAkhir = null;
    let jarakKm = null;

    // Exact match for 'ODO ERROR' (no fuzzy autocorrect)
    function isExactOdoVariant(input){
        if(!input) return false;
        const s = input.toString().toUpperCase().replace(/\s/g,'').trim();
        return s === 'ODOERROR' || s === 'ODOERR';
    }

    // If numeric -> compute distance. If exact ODO -> set ODO ERROR. Otherwise keep text as-is.
    const maybeNumber = parseKMInput(kmAkhirInput);
    if (!isNaN(maybeNumber)) {
        kmAkhir = maybeNumber;
        const kmAwal = parseFloat(currentKmAwal);
        jarakKm = kmAkhir - kmAwal;

        if (!isKmAwalOdoError && !isNaN(jarakKm) && jarakKm < 0) {
            // Tampilkan warning tapi tetap simpan
            showToast(`⚠️ Peringatan: KM Akhir lebih kecil dari KM Awal! Data tetap disimpan.`, 'warning');
        }
    } else if (isExactOdoVariant(kmAkhirInput)) {
        kmAkhir = 'ODO ERROR';
        jarakKm = 'ODO ERROR';
    } else {
        // arbitrary text -> accept and send as-is, jarak null
        kmAkhir = kmAkhirInput;
        jarakKm = null;
    }
    
    // Get galian_alihan_id dari nama
    const galianAlihanName = document.getElementById('galianAlihan').value;
    const galianAlihanId = galianAlihanName ? getGalianIdByName(galianAlihanName) : null;

    const formData = {
        order_id: parseInt(document.getElementById('orderId').value),
        no_urut: parseInt(document.getElementById('noUrut').value),
        tanggal_bongkar: document.getElementById('tanggalBongkar').value,
        jam_bongkar: document.getElementById('jamBongkar').value,
        km_akhir: kmAkhir,
        jarak_km: jarakKm,
        lokasi_bongkar: lokasiBongkar,
        alihan: document.getElementById('alihan').checked,
        galian_alihan_id: galianAlihanId,
        uang_alihan: (() => {
            const raw = document.getElementById('uangAlihan').value;
            if (!raw) return null;
            const val = parseKMInput(raw);
            if (isNaN(val)) return null;
            return currentTipeAlihan === 'kurang' ? -Math.abs(val) : Math.abs(val);
        })(),
        keterangan: document.getElementById('keterangan').value || null
    };

    // Validasi
    if (formData.alihan && !formData.galian_alihan_id) {
        showToast('Pilih galian alihan jika galian alihan dicentang', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/buangan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        const successMsg = kmAkhir === 'ODO ERROR'
            ? 'Buangan berhasil disimpan! (ODO ERROR)'
            : (jarakKm === null ? 'Buangan berhasil disimpan!' : 'Buangan berhasil disimpan! Jarak: ' + formatKM(jarakKm) + ' KM');
        
        showToast(successMsg, 'success');
        await goToBuanganMain();

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal menyimpan buangan: ' + error.message, 'error');
    }
}

// ============================================================================
// HANDLE EDIT FORM SUBMIT
// ============================================================================
async function handleEditFormSubmit(e) {
    e.preventDefault();

    const buanganId = currentBuanganDetail.id;
    const orderId = currentBuanganDetail.order_id;

    function isExactOdoVariant(input) {
        if (!input) return false;
        const s = input.toString().toUpperCase().replace(/\s/g, '').trim();
        return s === 'ODOERROR' || s === 'ODOERR';
    }

    // ===== Validasi & kumpulkan DATA ORDER =====
    const orderNoPintu = document.getElementById('editOrderNoPintu').value.trim();
    const orderSupirNama = document.getElementById('editOrderSupir').value.trim();
    const orderGalianNama = document.getElementById('editOrderGalian').value.trim();
    const orderProyekNama = document.getElementById('editOrderProyek').value.trim();

    const kendaraanId = getKendaraanIdByNoPintu(orderNoPintu);
    const supirId = getSupirIdByName(orderSupirNama);
    const galianId = getGalianIdByName(orderGalianNama);

    if (!kendaraanId) {
        showToast('Kendaraan tidak valid, pilih dari daftar yang tersedia', 'warning');
        return;
    }
    if (!supirId) {
        showToast('Supir tidak valid, pilih dari daftar yang tersedia', 'warning');
        return;
    }
    if (!galianId) {
        showToast('Galian tidak valid, pilih dari daftar yang tersedia', 'warning');
        return;
    }

    const uangJalan = parseKMInput(document.getElementById('editOrderUangJalan').value);
    if (isNaN(uangJalan)) {
        showToast('Uang jalan harus diisi dengan angka', 'warning');
        return;
    }
    const potongan = parseKMInput(document.getElementById('editOrderPotongan').value) || 0;

    const kmAwalInput = document.getElementById('editOrderKmAwal').value.trim();
    const kmAwalUpper = kmAwalInput.toUpperCase().replace(/\s/g, '');

    // Update currentKmAwalEdit dari input (untuk validasi km_akhir)
    if (kmAwalUpper === 'ODOERROR' || kmAwalUpper === 'ODOERR') {
        currentKmAwalEdit = 0;
    } else {
        const n = parseInt(kmAwalInput.replace(/\./g, '').replace(/,/g, ''), 10);
        currentKmAwalEdit = isNaN(n) ? 0 : n;
    }

    const orderData = {
        tanggal_order: document.getElementById('editOrderTanggal').value,
        jam_order: document.getElementById('editOrderJamOrder').value,
        no_order: document.getElementById('editOrderNoOrder').value.trim(),
        petugas_order: document.getElementById('editOrderPetugasOrder').value.trim(),
        no_do: document.getElementById('editOrderNoDo').value.trim(),
        kendaraan_id: kendaraanId,
        supir_id: supirId,
        galian_id: galianId,
        km_awal: kmAwalInput,
        uang_jalan: uangJalan,
        potongan: potongan
    };

    // Tambahkan proyek_id hanya jika field diisi atau dikosongkan
    if (orderProyekNama === '') {
        orderData.proyek_id = null;
    } else {
        const proyekId = getProyekIdByName(orderProyekNama);
        if (proyekId !== null) {
            orderData.proyek_id = proyekId;
        }
        // Jika proyek diisi tapi tidak ditemukan di master, biarkan proyek_id tidak berubah
    }

    // ===== Validasi & kumpulkan DATA BUANGAN =====
    const kmAkhirInput = document.getElementById('editKmAkhir').value.trim();
    const lokasiBongkar = document.getElementById('editLokasiBongkar').value.trim();

    if (!lokasiBongkar) {
        showToast('Lokasi buangan wajib diisi', 'warning');
        return;
    }

    let kmAkhir = null;
    const maybeNumber = parseKMInput(kmAkhirInput);
    if (!isNaN(maybeNumber)) {
        kmAkhir = maybeNumber;
        // Validasi km_akhir > km_awal (hanya jika km_awal bukan ODO ERROR)
        if (kmAwalUpper !== 'ODOERROR' && kmAwalUpper !== 'ODOERR' && kmAkhir <= currentKmAwalEdit) {
            showToast('KM Akhir harus lebih besar dari KM Awal', 'warning');
            return;
        }
    } else if (isExactOdoVariant(kmAkhirInput)) {
        kmAkhir = 'ODO ERROR';
    } else {
        kmAkhir = kmAkhirInput;
    }

    const galianAlihanName = document.getElementById('editGalianAlihan').value;
    const galianAlihanId = galianAlihanName ? getGalianIdByName(galianAlihanName) : null;

    const buanganData = {
        no_urut: parseInt(document.getElementById('editNoUrut').value),
        tanggal_bongkar: document.getElementById('editTanggalBongkar').value,
        jam_bongkar: document.getElementById('editJamBongkar').value,
        km_akhir: kmAkhir,
        lokasi_bongkar: lokasiBongkar,
        alihan: document.getElementById('editAlihan').checked,
        galian_alihan_id: galianAlihanId,
        uang_alihan: (() => {
            const raw = document.getElementById('editUangAlihan').value;
            if (!raw) return null;
            const val = parseKMInput(raw);
            if (isNaN(val)) return null;
            return currentTipeAlihanEdit === 'kurang' ? -Math.abs(val) : Math.abs(val);
        })(),
        keterangan: document.getElementById('editKeterangan').value || null
    };

    if (buanganData.alihan && !galianAlihanId) {
        showToast('Pilih galian alihan jika galian alihan dicentang', 'warning');
        return;
    }

    try {
        // 1. Update order terlebih dahulu
        const orderResponse = await fetch(`${API_BASE_URL}/order/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (!orderResponse.ok) {
            const errorResult = await orderResponse.json();
            throw new Error('Gagal update order: ' + (errorResult.message || orderResponse.status));
        }

        // 2. Update buangan (backend akan recalculate jarak_km dari km_awal yang baru)
        const buanganResponse = await fetch(`${API_BASE_URL}/buangan/${buanganId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buanganData)
        });

        if (!buanganResponse.ok) {
            const errorResult = await buanganResponse.json();
            throw new Error('Gagal update buangan: ' + (errorResult.message || buanganResponse.status));
        }

        showToast('Ritasi berhasil diupdate!', 'success');
        await goToBuanganMain();

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal update ritasi: ' + error.message, 'error');
    }
}

// ============================================================================
// EDIT BUANGAN - Buka Form Edit
// ============================================================================
function editBuangan() {
    if (!currentBuanganDetail) {
        showToast('Data buangan tidak ditemukan', 'error');
        return;
    }

    const buangan = currentBuanganDetail;
    const order = buangan.order;

    // Simpan km_awal untuk perhitungan jarak
    // Handle KM Awal - jika ODO ERROR, set ke 0 untuk perhitungan
    if (typeof order.km_awal === 'string' && 
        (order.km_awal.toUpperCase() === 'ODO ERROR' || 
        order.km_awal.toUpperCase() === 'ODOERROR' ||
        order.km_awal.toUpperCase() === 'ODO ERR' ||
        order.km_awal.toUpperCase() === 'ODOERR')) {
        currentKmAwalEdit = 0; // Set ke 0 jika ODO ERROR
    } else {
        currentKmAwalEdit = parseInt(String(order.km_awal).replace(/\./g, '').replace(/,/g, ''), 10) || 0;
    }

    // ===== Isi field DATA ORDER =====
    document.getElementById('editOrderTanggal').value = order.tanggal_order ? order.tanggal_order.substring(0, 10) : '';
    document.getElementById('editOrderJamOrder').value = order.jam_order || '';
    document.getElementById('editOrderNoOrder').value = order.no_order || '';
    document.getElementById('editOrderPetugasOrder').value = order.petugas_order || '';
    document.getElementById('editOrderNoDo').value = order.no_do || '';
    document.getElementById('editOrderNoPintu').value = order.no_pintu || '';
    document.getElementById('editOrderSupir').value = order.supir || '';
    document.getElementById('editOrderGalian').value = order.nama_galian || '';

    // KM Awal - display sebagai angka terformat atau ODO ERROR
    const kmAwalStr = String(order.km_awal || '');
    const kmAwalUpper = kmAwalStr.toUpperCase().replace(/\s/g, '');
    if (kmAwalUpper === 'ODOERROR' || kmAwalUpper === 'ODOERR') {
        document.getElementById('editOrderKmAwal').value = 'ODO ERROR';
    } else {
        const kmAwalNum = parseInt(kmAwalStr.replace(/\./g, '').replace(/,/g, ''), 10);
        document.getElementById('editOrderKmAwal').value = isNaN(kmAwalNum) ? '' : kmAwalNum.toLocaleString('id-ID');
    }

    // Proyek - gunakan nama_proyek dari JOIN (lebih akurat untuk lookup)
    document.getElementById('editOrderProyek').value = order.nama_proyek || '';

    // Uang Jalan & Potongan
    const uangJalan = parseFloat(order.uang_jalan) || 0;
    const potongan = parseFloat(order.potongan) || 0;
    document.getElementById('editOrderUangJalan').value = uangJalan > 0 ? uangJalan.toLocaleString('id-ID') : '';
    document.getElementById('editOrderPotongan').value = potongan > 0 ? potongan.toLocaleString('id-ID') : '';
    hitungHasilAkhirEdit();

    // ===== Isi field DATA BUANGAN =====
    document.getElementById('editNoUrut').value = (buangan.no_urut === 0 || buangan.no_urut == null) ? '' : buangan.no_urut;
    document.getElementById('editTanggalBongkar').value = buangan.tanggal_bongkar ? buangan.tanggal_bongkar.substring(0, 10) : '';
    document.getElementById('editJamBongkar').value = buangan.jam_bongkar || '';

    // Handle KM Akhir (bisa angka atau ODO ERROR)
    const kmAkhirValue = (buangan.km_akhir === 0 || buangan.km_akhir == null) ? '' : buangan.km_akhir;
    document.getElementById('editKmAkhir').value = kmAkhirValue;

    document.getElementById('editLokasiBongkar').value = buangan.lokasi_bongkar || '';
    document.getElementById('editAlihan').checked = buangan.alihan;

    // Set galian alihan name (bukan ID)
    document.getElementById('editGalianAlihan').value = getGalianNameById(buangan.galian_alihan_id);

    // Set uang alihan: tampilkan nilai absolut, set toggle +/- dari tanda
    const storedUA = parseFloat(buangan.uang_alihan);
    if (!isNaN(storedUA) && storedUA !== 0) {
        if (storedUA < 0) {
            setTipeAlihanEdit('kurang');
            document.getElementById('editUangAlihan').value = Math.abs(storedUA).toLocaleString('id-ID');
        } else {
            setTipeAlihanEdit('tambah');
            document.getElementById('editUangAlihan').value = storedUA.toLocaleString('id-ID');
        }
    } else {
        setTipeAlihanEdit('tambah');
        document.getElementById('editUangAlihan').value = '';
    }
    document.getElementById('editKeterangan').value = buangan.keterangan || '';

    // Toggle alihan fields
    document.getElementById('editAlihanFields').style.display = buangan.alihan ? 'block' : 'none';

    // Hitung jarak
    hitungJarakEdit();

    // Hide detail, show edit form
    document.getElementById('detailSection').style.display = 'none';
    document.getElementById('editSection').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================
// DISPLAY ORDER INFO di Form Edit
// ============================================================================
function displayOrderInfoEdit(order) {
    const container = document.getElementById('editOrderInfo');
    
    if (!container) return;

    const namaGalian = order.nama_galian || order.galian || '-';
    
    container.innerHTML = `
        <h3 style="margin-bottom: 15px;">Informasi Order</h3>
        <div class="order-info-grid">
            <div class="order-info-item">
                <div class="order-info-label">No Order</div>
                <div class="order-info-value">${order.no_order || '-'}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">Tanggal Order</div>
                <div class="order-info-value">${formatDate(order.tanggal_order)}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">No Pintu</div>
                <div class="order-info-value">${order.no_pintu || '-'}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">Supir</div>
                <div class="order-info-value">${order.supir || '-'}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">Galian</div>
                <div class="order-info-value">${namaGalian}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">Proyek</div>
                <div class="order-info-value">${order.proyek_input || '-'}</div>
            </div>
            <div class="order-info-item">
                <div class="order-info-label">KM Awal</div>
                <div class="order-info-value">${formatKMAwal(order.km_awal)}</div>
            </div>
        </div>
    `;
}

// ============================================================================
// BATAL FORM
// ============================================================================
function batalForm() {
    document.getElementById('formSection').style.display = 'none';
    document.getElementById('buanganForm').reset();
    currentOrderData = null;
    currentKmAwal = 0;

    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('mainTableSection').style.display = 'block';
    document.getElementById('filterNoPintu').value = '';

    // Jika sedang dalam mode pencarian, kembali ke tab Daftar Order
    if (currentSearchDate) {
        switchTab('order');
        return;
    }

    // Mode normal: kembali ke tab Daftar Buangan
    currentViewMode = 'buangan';
    switchTab('buangan');
}

// Navigate to the Buangan main page and refresh list
window.goToBuanganMain = async function() {
    currentOrderData = null;
    currentKmAwal = 0;
    currentBuanganDetail = null;
    if (document.getElementById('buanganForm')) document.getElementById('buanganForm').reset();
    if (document.getElementById('editBuanganForm')) document.getElementById('editBuanganForm').reset();

    // Jika sedang dalam mode pencarian, kembali ke hasil pencarian yang sudah diupdate
    if (currentSearchDate) {
        await returnToSearchResults();
        return;
    }

    // Mode normal: tampilkan daftar buangan
    const formSection = document.getElementById('formSection');
    const editSection = document.getElementById('editSection');
    const detailSection = document.getElementById('detailSection');
    if (formSection) formSection.style.display = 'none';
    if (editSection) editSection.style.display = 'none';
    if (detailSection) detailSection.style.display = 'none';

    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('mainTableSection').style.display = 'block';
    document.getElementById('filterNoPintu').value = '';
    currentViewMode = 'buangan';
    currentSearchDate = null;
    currentSearchDateEnd = null;
    allOrderData = [];
    allSearchBuanganData = [];
    // Sembunyikan badge tab
    document.getElementById('tabOrderCount').style.display = 'none';
    document.getElementById('tabBuanganCount').style.display = 'none';

    await loadBuanganList();
    switchTab('buangan');
}

// ============================================================================
// LOAD GALIAN OPTIONS 
// ============================================================================
async function loadGalianOptions() {
    try {
        console.log('Loading galian options from API...');
        
        const response = await fetch(`${API_BASE_URL}/master/galian`);
        
        console.log('Galian API response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        console.log('Galian API result:', result);

        // Handle berbagai format response
        let galianData = [];
        
        if (result.hasOwnProperty('success') && result.success) {
            galianData = result.data || [];
        } else if (Array.isArray(result)) {
            galianData = result;
        } else if (result.data && Array.isArray(result.data)) {
            galianData = result.data;
        }

        console.log('Galian data to populate:', galianData);

        // Populate datalist untuk form tambah
        const datalistGalianAlihan = document.getElementById('galianDatalist');
        if (datalistGalianAlihan) {
            datalistGalianAlihan.innerHTML = '';

            if (Array.isArray(galianData) && galianData.length > 0) {
                galianData.forEach(galian => {
                    const option = document.createElement('option');
                    option.value = galian.nama_galian;
                    option.setAttribute('data-id', galian.id);
                    datalistGalianAlihan.appendChild(option);
                });
                console.log(`✅ Loaded ${galianData.length} galian options ke datalist tambah`);
            } else {
                console.warn('⚠️ Tidak ada data galian ditemukan');
            }
        }

        // Populate datalist untuk form edit (alihan)
        const datalistEditGalianAlihan = document.getElementById('editGalianDatalist');
        if (datalistEditGalianAlihan) {
            datalistEditGalianAlihan.innerHTML = '';

            if (Array.isArray(galianData) && galianData.length > 0) {
                galianData.forEach(galian => {
                    const option = document.createElement('option');
                    option.value = galian.nama_galian;
                    option.setAttribute('data-id', galian.id);
                    datalistEditGalianAlihan.appendChild(option);
                });
                console.log(`✅ Loaded ${galianData.length} galian options ke datalist edit`);
            }
        }

        // Populate datalist galian untuk form edit order
        const datalistEditOrderGalian = document.getElementById('editOrderGalianDatalist');
        if (datalistEditOrderGalian) {
            datalistEditOrderGalian.innerHTML = '';
            if (Array.isArray(galianData) && galianData.length > 0) {
                galianData.forEach(galian => {
                    const option = document.createElement('option');
                    option.value = galian.nama_galian;
                    option.setAttribute('data-id', galian.id);
                    datalistEditOrderGalian.appendChild(option);
                });
            }
        }

        // Simpan data galian ke global variable untuk lookup ID
        window.galianMasterData = galianData;

    } catch (error) {
        console.error('❌ Error loading galian options:', error);
    }
}

// ============================================================================
// LOAD MASTER OPTIONS (Kendaraan, Supir, Proyek) untuk Form Edit Order
// ============================================================================
async function loadMasterOptions() {
    try {
        const [kendaraanRes, supirRes, proyekRes] = await Promise.all([
            fetch(`${API_BASE_URL}/master/kendaraan`),
            fetch(`${API_BASE_URL}/master/supir`),
            fetch(`${API_BASE_URL}/master/proyek`)
        ]);

        if (kendaraanRes.ok) {
            const result = await kendaraanRes.json();
            const data = (result.data && Array.isArray(result.data)) ? result.data : (Array.isArray(result) ? result : []);
            window.kendaraanMasterData = data;
            const datalist = document.getElementById('editOrderKendaraanDatalist');
            if (datalist) {
                datalist.innerHTML = '';
                data.forEach(k => {
                    const option = document.createElement('option');
                    option.value = k.no_pintu;
                    option.setAttribute('data-id', k.id);
                    datalist.appendChild(option);
                });
            }
        }

        if (supirRes.ok) {
            const result = await supirRes.json();
            const data = (result.data && Array.isArray(result.data)) ? result.data : (Array.isArray(result) ? result : []);
            window.supirMasterData = data;
            const datalist = document.getElementById('editOrderSupirDatalist');
            if (datalist) {
                datalist.innerHTML = '';
                data.forEach(s => {
                    const option = document.createElement('option');
                    option.value = s.nama;
                    option.setAttribute('data-id', s.id);
                    datalist.appendChild(option);
                });
            }
        }

        if (proyekRes.ok) {
            const result = await proyekRes.json();
            const data = (result.data && Array.isArray(result.data)) ? result.data : (Array.isArray(result) ? result : []);
            window.proyekMasterData = data;
            const datalist = document.getElementById('editOrderProyekDatalist');
            if (datalist) {
                datalist.innerHTML = '';
                data.forEach(p => {
                    const option = document.createElement('option');
                    option.value = p.nama_proyek;
                    option.setAttribute('data-id', p.id);
                    datalist.appendChild(option);
                });
            }
        }
    } catch (err) {
        console.error('Error loading master options:', err);
    }
}

// ============================================================================
// GET KENDARAAN ID FROM NO PINTU
// ============================================================================
function getKendaraanIdByNoPintu(noPintu) {
    if (!window.kendaraanMasterData || !noPintu) return null;
    const k = window.kendaraanMasterData.find(item => item.no_pintu === noPintu);
    return k ? k.id : null;
}

// ============================================================================
// GET SUPIR ID FROM NAME
// ============================================================================
function getSupirIdByName(nama) {
    if (!window.supirMasterData || !nama) return null;
    const s = window.supirMasterData.find(item => item.nama === nama);
    return s ? s.id : null;
}

// ============================================================================
// GET PROYEK ID FROM NAME
// ============================================================================
function getProyekIdByName(namaProyek) {
    if (!window.proyekMasterData || !namaProyek) return null;
    const p = window.proyekMasterData.find(item => item.nama_proyek === namaProyek);
    return p ? p.id : null;
}

// ============================================================================
// HITUNG HASIL AKHIR (Form Edit Order)
// ============================================================================
function hitungHasilAkhirEdit() {
    const uangJalan = parseKMInput(document.getElementById('editOrderUangJalan').value) || 0;
    const potongan = parseKMInput(document.getElementById('editOrderPotongan').value) || 0;
    const hasil = uangJalan - potongan;
    document.getElementById('editOrderHasilAkhir').value = 'Rp ' + Math.max(0, hasil).toLocaleString('id-ID');
}

// ============================================================================
// HANDLE KM AWAL EDIT INPUT - update currentKmAwalEdit dan recalculate jarak
// ============================================================================
function handleKmAwalEditInput(value) {
    const trimmed = value.trim();
    const upper = trimmed.toUpperCase().replace(/\s/g, '');
    if (upper === 'ODOERROR' || upper === 'ODOERR') {
        currentKmAwalEdit = 0;
    } else {
        const n = parseInt(trimmed.replace(/\./g, '').replace(/,/g, ''), 10);
        currentKmAwalEdit = isNaN(n) ? 0 : n;
    }
    // Recalculate jarak dengan km_akhir yang sudah ada
    const kmAkhirEl = document.getElementById('editKmAkhir');
    if (kmAkhirEl && kmAkhirEl.value) {
        handleKmAkhirInputWithODO(kmAkhirEl, 'editJarakKm');
    }
}

// ============================================================================
// GET GALIAN ID FROM NAME (Helper function)
// ============================================================================
function getGalianIdByName(namaGalian) {
    if (!window.galianMasterData || !namaGalian) return null;
    
    const galian = window.galianMasterData.find(g => g.nama_galian === namaGalian);
    return galian ? galian.id : null;
}

// ============================================================================
// GET GALIAN NAME FROM ID (Helper function)
// ============================================================================
function getGalianNameById(galianId) {
    if (!window.galianMasterData || !galianId) return '';
    
    const galian = window.galianMasterData.find(g => g.id == galianId);
    return galian ? galian.nama_galian : '';
}

// ============================================================================
// LOAD BUANGAN LIST (includes ON PROCESS orders)
// ============================================================================
async function loadBuanganList() {
    try {
        const [buanganRes, orderRes] = await Promise.all([
            fetch(`${API_BASE_URL}/buangan`),
            fetch(`${API_BASE_URL}/order`)
        ]);

        // Normalize buangan
        const buanganResult = await buanganRes.json();
        let buanganData = [];
        if (buanganResult.hasOwnProperty('success') && buanganResult.success) {
            buanganData = buanganResult.data || [];
        } else if (Array.isArray(buanganResult)) {
            buanganData = buanganResult;
        } else if (buanganResult.data && Array.isArray(buanganResult.data)) {
            buanganData = buanganResult.data;
        }

        // Normalize orders
        let orderData = [];
        if (orderRes.ok) {
            const orderResult = await orderRes.json();
            if (orderResult.hasOwnProperty('success') && orderResult.success) {
                orderData = orderResult.data || [];
            } else if (Array.isArray(orderResult)) {
                orderData = orderResult;
            } else if (orderResult.data && Array.isArray(orderResult.data)) {
                orderData = orderResult.data;
            }
        }

        // Order IDs yang sudah ada buangannya
        const buanganOrderIds = new Set(buanganData.map(b => b.order_id));

        // ON PROCESS orders yang belum punya buangan
        const pendingOrders = orderData.filter(o =>
            (o.status === 'ON PROCESS' || !o.status || o.status === '') &&
            !buanganOrderIds.has(o.id)
        );

        // Konversi ke format seperti buangan
        const pendingAsBuangan = pendingOrders.map(o => ({
            _isOnProcess: true,
            _orderId: o.id,
            order_id: o.id,
            no_order: o.no_order,
            tanggal_order: o.tanggal_order,
            no_pintu: o.no_pintu,
            supir: o.supir,
            nama_galian: o.nama_galian || o.galian,
            status: 'ON PROCESS',
            tanggal_bongkar: null,
            jam_bongkar: null,
            km_akhir: null,
            jarak_km: null,
            lokasi_bongkar: null,
            alihan: false,
        }));

        // Gabungkan: ON PROCESS dulu, lalu buangan records
        allBuanganData = [...pendingAsBuangan, ...buanganData];

        applyBuanganFilter();

    } catch (error) {
        console.error('Error loading buangan:', error);
        allBuanganData = [];
        displayBuanganList([]);
    }
}

// ============================================================================
// APPLY BUANGAN FILTER BY STATUS
// ============================================================================
function applyBuanganFilter() {
    currentBuanganPage = 1;
    let filtered = allBuanganData;

    if (activeStatusFilter === 'on_process') {
        filtered = allBuanganData.filter(b => b._isOnProcess);
    } else if (activeStatusFilter === 'complete') {
        filtered = allBuanganData.filter(b => !b._isOnProcess && b.status === 'COMPLETE');
    } else if (activeStatusFilter === 'batal') {
        filtered = allBuanganData.filter(b => !b._isOnProcess && b.status === 'BATAL');
    }

    // Juga terapkan filter no pintu jika ada
    const pintuFilter = document.getElementById('filterNoPintu')?.value?.toLowerCase().trim();
    if (pintuFilter) {
        filtered = filtered.filter(b =>
            b.no_pintu && b.no_pintu.toLowerCase().includes(pintuFilter)
        );
    }

    displayBuanganList(filtered);
}

function filterByStatus(status) {
    activeStatusFilter = status;

    // Update active button
    ['filterBtnAll', 'filterBtnOnProcess', 'filterBtnComplete', 'filterBtnBatal'].forEach(id => {
        document.getElementById(id)?.classList.remove('active');
    });
    const btnMap = { all: 'filterBtnAll', on_process: 'filterBtnOnProcess', complete: 'filterBtnComplete', batal: 'filterBtnBatal' };
    document.getElementById(btnMap[status])?.classList.add('active');

    applyBuanganFilter();
}

// ============================================================================
// DISPLAY BUANGAN LIST
// ============================================================================
function displayBuanganList(buanganList) {
    filteredBuanganData = buanganList;
    
    const tbody = document.getElementById('buanganTableBody');
    tbody.innerHTML = '';

    if (!Array.isArray(buanganList) || buanganList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="14" class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">Belum ada data buangan</div>
                </td>
            </tr>
        `;
        document.getElementById('buanganPagination').style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const startIndex = (currentBuanganPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = buanganList.slice(startIndex, endIndex);

    paginatedData.forEach((buangan, index) => {
        const tr = document.createElement('tr');
        const rowNumber = startIndex + index + 1;

        // Baris ON PROCESS: order yang belum punya buangan
        if (buangan._isOnProcess) {
            tr.classList.add('row-on-process');
            tr.innerHTML = `
                <td style="text-align: center; font-weight: 600;">${rowNumber}</td>
                <td>${buangan.no_order || '-'}</td>
                <td>${formatDate(buangan.tanggal_order)}</td>
                <td>${buangan.no_pintu || '-'}</td>
                <td>${buangan.supir || '-'}</td>
                <td>${buangan.nama_galian || '-'}</td>
                <td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>
                <td><span class="badge badge-pending">ON PROCESS</span></td>
                <td>
                    <button class="btn btn-warning btn-small" onclick="bukaFormBuangan(${buangan._orderId})">
                        <span class="icon">📋</span> Buangan
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
            return;
        }

        const alihanBadge = buangan.alihan
            ? '<span class="badge badge-yes">Ya</span>'
            : '<span class="badge badge-no">Tidak</span>';

        let statusBadge = '';
        if (buangan.status === 'BATAL') {
            statusBadge = '<span class="badge badge-batal">BATAL</span>';
        } else {
            statusBadge = '<span class="badge badge-complete">COMPLETE</span>';
        }

        const noUrutDisplay = (buangan.no_urut === 0 || buangan.no_urut == null) ? '-' : `#${buangan.no_urut}`;
        const tanggalBongkarDisplay = buangan.tanggal_bongkar ? formatDate(buangan.tanggal_bongkar) : '-';
        const jamBongkarDisplay = buangan.jam_bongkar ? buangan.jam_bongkar : '-';

        let kmAkhirDisplay = '-';
        if (buangan.km_akhir === null || buangan.km_akhir === undefined || buangan.km_akhir === '') {
            kmAkhirDisplay = '-';
        } else if (isExactOdoVariantDisplay(buangan.km_akhir)) {
            kmAkhirDisplay = 'ODO ERROR';
        } else {
            const n = parseInt(String(buangan.km_akhir).replace(/\./g, ''), 10);
            kmAkhirDisplay = !isNaN(n) ? n.toLocaleString('id-ID') + ' KM' : String(buangan.km_akhir);
        }

        let jarakDisplay = '-';
        if (buangan.jarak_km === null || buangan.jarak_km === undefined || buangan.jarak_km === '') {
            jarakDisplay = '-';
        } else if (isExactOdoVariantDisplay(buangan.jarak_km)) {
            jarakDisplay = 'ODO ERROR';
        } else {
            const n = parseInt(String(buangan.jarak_km).replace(/\./g, ''), 10);
            jarakDisplay = !isNaN(n) ? n.toLocaleString('id-ID') + ' KM' : String(buangan.jarak_km);
        }
        const lokasiDisplay = buangan.lokasi_bongkar || '-';

        tr.innerHTML = `
            <td style="text-align: center; font-weight: 600;">${rowNumber}</td>
            <td>${buangan.no_order || '-'}</td>
            <td>${formatDate(buangan.tanggal_order)}</td>
            <td>${buangan.no_pintu || '-'}</td>
            <td>${buangan.supir || '-'}</td>
            <td>${buangan.nama_galian || '-'}</td>
            <td>${tanggalBongkarDisplay}</td>
            <td>${jamBongkarDisplay}</td>
            <td>${kmAkhirDisplay}</td>
            <td>${jarakDisplay}</td>
            <td>${lokasiDisplay}</td>
            <td>${alihanBadge}</td>
            <td>${statusBadge}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-primary btn-small" onclick="lihatDetailBuangan(${buangan.id})">
                        <span class="icon">👁️</span> Detail
                    </button>
                    ${buangan.status === 'BATAL' ? `
                        <button class="btn btn-success btn-small" onclick="bukaModalUnBatal(${buangan.order_id})">
                            <span class="icon">♻️</span> Un-batal
                        </button>
                    ` : ''}
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    updateBuanganPagination(buanganList.length);
}

// ============================================================================
// MODAL BATAL FOR DETAIL
// ============================================================================
function bukaModalBatalDariDetail() {
    if (!currentBuanganDetail || !currentBuanganDetail.order_id) {
        showToast('Data order tidak ditemukan', 'error');
        return;
    }
    
    bukaModalBatal(currentBuanganDetail.order_id);
}

// ============================================================================
// LIHAT DETAIL BUANGAN 
// ============================================================================
async function lihatDetailBuangan(buanganId) {
    try {
        // Ambil detail buangan
        const response = await fetch(`${API_BASE_URL}/buangan/${buanganId}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Detail buangan response:', result);

        // ✔ FIX: mendukung response {status: true} DAN {success: true}
        let buangan = null;
        if ((result.status || result.success) && result.data) {
            buangan = result.data;
        } else if (result.id) {
            buangan = result;
        }

        if (!buangan) {
            throw new Error('Data buangan tidak ditemukan');
        }

        // Ambil detail order berdasarkan order_id dari buangan
        const orderResponse = await fetch(`${API_BASE_URL}/order/${buangan.order_id}`);
        
        if (!orderResponse.ok) {
            throw new Error(`HTTP error! status: ${orderResponse.status}`);
        }

        const orderResult = await orderResponse.json();

        // ✔ FIX: mendukung response {status: true} DAN {success: true}
        let order = null;
        if ((orderResult.status || orderResult.success) && orderResult.data) {
            order = orderResult.data;
        } else if (orderResult.id) {
            order = orderResult;
        }

        if (!order) {
            throw new Error('Data order tidak ditemukan');
        }

        // Simpan ke variable global
        currentBuanganDetail = { ...buangan, order: order };

        // Tampilkan detail order
        displayDetailOrder(order);

        // Tampilkan detail buangan
        displayDetailBuangan(buangan);

        // Switch tampilan
        document.getElementById('searchSection').style.display = 'none';
        document.getElementById('mainTableSection').style.display = 'none';
        document.getElementById('detailSection').style.display = 'block';

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal memuat detail: ' + error.message, 'error');
    }
}

// ============================================================================
// BUKA FORM EDIT
// ============================================================================
async function bukaFormEdit() {
    if (!currentBuanganDetail) return;

    const buangan = currentBuanganDetail;
    const order = buangan.order;

    currentKmAwalEdit = parseInt(String(order.km_awal).replace(/\./g, '').replace(/,/g, ''), 10) || 0;

    // Isi form edit
    document.getElementById('editNoUrut').value = buangan.no_urut;
    document.getElementById('editTanggalBongkar').value = buangan.tanggal_bongkar.substring(0, 10);
    document.getElementById('editJamBongkar').value = buangan.jam_bongkar;
    document.getElementById('editKmAkhir').value = buangan.km_akhir;
    document.getElementById('editAlihan').checked = buangan.alihan;
    document.getElementById('editGalianAlihan').value = buangan.galian_alihan_id || '';
    document.getElementById('editUangAlihan').value = buangan.uang_alihan || '';
    document.getElementById('editKeterangan').value = buangan.keterangan || '';

    // Toggle alihan fields
    document.getElementById('editAlihanFields').style.display = buangan.alihan ? 'block' : 'none';

    // Hitung jarak
    hitungJarakEdit();

    // Show edit form
    document.getElementById('detailSection').style.display = 'none';
    document.getElementById('editSection').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================
// TUTUP & BATAL FORM EDIT
// ============================================================================
function tutupFormEdit() {
    document.getElementById('editSection').style.display = 'none';
    document.getElementById('detailSection').style.display = 'block';
    
    currentKmAwalEdit = 0;
    document.getElementById('editBuanganForm').reset();
}

function batalEdit() {
    document.getElementById('editSection').style.display = 'none';
    document.getElementById('detailSection').style.display = 'block';
    
    currentKmAwalEdit = 0;
    document.getElementById('editBuanganForm').reset();
}

// ============================================================================
// DISPLAY DETAIL ORDER
// ============================================================================
function displayDetailOrder(order) {
    const container = document.getElementById('detailOrderInfo');
    
    // Tampilkan Proyek dan hanya tampilkan badge untuk COMPLETE atau BATAL.
    const statusBadge = order.status === 'COMPLETE'
        ? '<span class="badge badge-complete">COMPLETE</span>'
        : (order.status === 'BATAL'
            ? '<span class="badge badge-batal">BATAL</span>'
            : '-');

    container.innerHTML = `
        <div class="detail-item">
            <div class="detail-label">No Order</div>
            <div class="detail-value">${order.no_order || '-'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Tanggal Order</div>
            <div class="detail-value">${formatDate(order.tanggal_order)}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Jam Order</div>
            <div class="detail-value">${order.jam_order || '-'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">No Pintu</div>
            <div class="detail-value">${order.no_pintu || '-'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Supir</div>
            <div class="detail-value">${order.supir || '-'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Galian</div>
            <div class="detail-value">${order.galian || order.nama_galian || '-'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Proyek</div>
            <div class="detail-value">${order.proyek_input || '-'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">No DO</div>
            <div class="detail-value">${order.no_do || '-'}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">KM Awal</div>
            <div class="detail-value">${formatKMAwal(order.km_awal)}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Uang Jalan</div>
            <div class="detail-value">${formatCurrency(order.uang_jalan)}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Potongan</div>
            <div class="detail-value">${formatCurrency(order.potongan)}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Hasil Akhir</div>
            <div class="detail-value">${formatCurrency(order.hasil_akhir)}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Status</div>
            <div class="detail-value">${statusBadge}</div>
        </div>
    `;
}

// ============================================================================
// DISPLAY DETAIL BUANGAN
// ============================================================================
function displayDetailBuangan(buangan) {
    const container = document.getElementById('detailBuanganInfo');

    const alihanBadge = buangan.alihan 
        ? '<span class="badge badge-yes">Ya</span>'
        : '<span class="badge badge-no">Tidak</span>';

    const noUrutDisplay = (buangan.no_urut === 0 || buangan.no_urut == null) ? '-' : `#${buangan.no_urut}`;
    const tanggalBongkarDisplay = buangan.tanggal_bongkar ? formatDate(buangan.tanggal_bongkar) : '-';
    const jamBongkarDisplay = buangan.jam_bongkar ? buangan.jam_bongkar : '-';
    
    // Handle KM Akhir (display exactly what's in DB)
    let kmAkhirDisplay = '-';
    if (buangan.km_akhir === null || buangan.km_akhir === undefined || buangan.km_akhir === '') {
        kmAkhirDisplay = '-';
    } else if (isExactOdoVariantDisplay(buangan.km_akhir)) {
        kmAkhirDisplay = 'ODO ERROR';
    } else {
        kmAkhirDisplay = String(buangan.km_akhir);
    }
    
    // Handle jarak_km display - display exactly what's in DB
    let jarakDisplay = '-';
    if (buangan.jarak_km === null || buangan.jarak_km === undefined || buangan.jarak_km === '') {
        jarakDisplay = '-';
    } else if (isExactOdoVariantDisplay(buangan.jarak_km)) {
        jarakDisplay = 'ODO ERROR';
    } else {
        jarakDisplay = String(buangan.jarak_km);
    }
    const lokasiDisplay = buangan.lokasi_bongkar || '-';

    let htmlContent = `
        <div class="detail-item">
            <div class="detail-label">No Urut</div>
            <div class="detail-value">${noUrutDisplay}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Tanggal Bongkar</div>
            <div class="detail-value">${tanggalBongkarDisplay}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Jam Bongkar</div>
            <div class="detail-value">${jamBongkarDisplay}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">KM Akhir</div>
            <div class="detail-value">${kmAkhirDisplay}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Jarak KM</div>
            <div class="detail-value">${jarakDisplay}</div>
        </div>
        <div class="detail-item" style="grid-column: 1 / -1;">
            <div class="detail-label">Lokasi Buangan</div>
            <div class="detail-value">${lokasiDisplay}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Galian Alihan</div>
            <div class="detail-value">${alihanBadge}</div>
        </div>
    `;

    if (buangan.alihan) {
        htmlContent += `
            <div class="detail-item">
                <div class="detail-label">Nama Galian Alihan</div>
                <div class="detail-value">${buangan.galian_alihan || '-'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Uang Alihan</div>
                <div class="detail-value">${formatCurrencyWithSign(buangan.uang_alihan)}</div>
            </div>
        `;
    }

    if (buangan.keterangan) {
        htmlContent += `
            <div class="detail-item" style="grid-column: 1 / -1;">
                <div class="detail-label">Keterangan</div>
                <div class="detail-value">${buangan.keterangan}</div>
            </div>
        `;
    }

    container.innerHTML = htmlContent;
}

// ============================================================================
// TUTUP DETAIL
// ============================================================================
function tutupDetail() {
    document.getElementById('detailSection').style.display = 'none';
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('mainTableSection').style.display = 'block';
    currentBuanganDetail = null;
    // Kembalikan ke tab yang sebelumnya aktif
    switchTab(currentTab);
}
async function hapusBuangan(id) {
    if (!confirm('Yakin ingin menghapus buangan ini?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/buangan/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            let errMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorResult = await response.json();
                errMsg = errorResult.message || JSON.stringify(errorResult);
            } catch (parseErr) {
                try {
                    const text = await response.text();
                    errMsg = text;
                } catch (e) {
                    // ignore
                }
            }
            throw new Error(errMsg);
        }

        showToast('Buangan berhasil dihapus', 'success');
        await goToBuanganMain();

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal menghapus buangan: ' + error.message, 'error');
    }
}

// ============================================================================
// HAPUS RITASI (hapus buangan + order)
// ============================================================================
async function hapusRitasi(id) {
    if (!confirm('Yakin ingin menghapus RITASI ini beserta ORDER terkait? Tindakan ini tidak dapat dibatalkan.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/buangan/${id}/ritasi`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            let errMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorResult = await response.json();
                errMsg = errorResult.message || JSON.stringify(errorResult);
            } catch (parseErr) {
                try {
                    const text = await response.text();
                    errMsg = text;
                } catch (e) {
                    // ignore
                }
            }
            throw new Error(errMsg);
        }

        showToast('Ritasi dan order berhasil dihapus', 'success');
        currentSearchDate = null; // Order sudah dihapus, reset ke mode normal
        await goToBuanganMain();

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal menghapus ritasi: ' + error.message, 'error');
    }
}

// ============================================================================
// MODAL BATAL ORDER
// ============================================================================
function bukaModalBatal(orderId) {
    document.getElementById('batalOrderId').value = orderId;
    document.getElementById('keteranganBatal').value = '';
    document.getElementById('modalBatalOrder').style.display = 'flex';
}

function tutupModalBatal() {
    document.getElementById('modalBatalOrder').style.display = 'none';
    document.getElementById('batalOrderId').value = '';
    document.getElementById('keteranganBatal').value = '';
}

async function konfirmasiBatalOrder() {
    const orderId = document.getElementById('batalOrderId').value;
    const keterangan = document.getElementById('keteranganBatal').value.trim();

    // Validasi keterangan wajib diisi
    if (!keterangan) {
        showToast('Keterangan pembatalan wajib diisi!', 'warning');
        document.getElementById('keteranganBatal').focus();
        return;
    }

    try {
        // ✅ LANGSUNG PANGGIL ENDPOINT DENGAN ORDER_ID
        // Backend akan handle baik buangan exist atau tidak
        const response = await fetch(`${API_BASE_URL}/buangan/${orderId}/batal`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                keterangan: keterangan
            })
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        showToast('Order berhasil dibatalkan', 'success');
        tutupModalBatal();
        await goToBuanganMain();

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal membatalkan order: ' + error.message, 'error');
    }
}

// ============================================================================
// MODAL UN-BATAL ORDER
// ============================================================================
function bukaModalUnBatal(orderId) {
    document.getElementById('unBatalOrderId').value = orderId;
    document.getElementById('unBatalOrderText').textContent =
        'Apakah Anda yakin ingin meng-un-batal order ini? Jika belum ada ritasi asli, status akan kembali ke ON PROCESS; jika sudah ada ritasi, status akan menjadi COMPLETE.';
    document.getElementById('modalUnBatalOrder').style.display = 'flex';
}

function tutupModalUnBatal() {
    document.getElementById('modalUnBatalOrder').style.display = 'none';
    document.getElementById('unBatalOrderId').value = '';
}

async function konfirmasiUnBatalOrder() {
    const orderId = document.getElementById('unBatalOrderId').value;
    if (!orderId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/order/${orderId}/un-batal`, {
            method: 'POST'
        });

        const result = await response.json();

        if (!response.ok || !result.status) {
            throw new Error(result.message || `HTTP error! status: ${response.status}`);
        }

        showToast(`Order berhasil di-un-batal (status: ${result.data.status})`, 'success');
        tutupModalUnBatal();
        await goToBuanganMain();
    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal un-batal order: ' + error.message, 'error');
    }
}

// ============================================================================
// UTILITIES
// ============================================================================
function formatDate(dateString) {
    if (!dateString) return '-';
    
    // Parse tanggal UTC dan convert ke timezone lokal (Jakarta = UTC+7)
    const date = new Date(dateString);
    const localDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const year = localDate.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
}

// Format input angka dengan titik ribuan
function formatNumberInput(input) {
    // Hapus semua karakter selain angka
    let value = input.value.replace(/\D/g, '');
    
    if (value === '') {
        input.value = '';
        return;
    }
    
    // Batasi 10 digit
    if (value.length > 10) {
        value = value.substring(0, 10);
    }
    
    // Format dengan titik ribuan
    const number = parseInt(value, 10);
    input.value = number.toLocaleString('id-ID');
}

function formatCurrency(amount) {
    if (!amount) return 'Rp 0';
    return 'Rp ' + parseFloat(amount).toLocaleString('id-ID');
}

function formatCurrencyWithSign(amount) {
    if (amount === null || amount === undefined || amount === '') return 'Rp 0';
    const num = parseFloat(amount);
    if (isNaN(num) || num === 0) return 'Rp 0';
    const abs = Math.abs(num);
    const sign = num >= 0 ? '+' : '−';
    return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Format KM dengan titik ribuan
function formatKM(km) {
    if (km === null || km === undefined || km === '') return '-';
    // Strip Indonesian thousand separators (dots) before parsing
    const kmValue = parseInt(String(km).replace(/\./g, '').replace(/,/g, ''), 10);
    if (isNaN(kmValue)) return '-';
    return kmValue.toLocaleString('id-ID');
}

// Format KM Awal - Handle ODO ERROR
function formatKMAwal(kmAwal) {
    if (kmAwal === null || kmAwal === undefined || kmAwal === '') return '-';

    // Cek apakah string "ODO ERROR"
    const upper = String(kmAwal).toUpperCase().replace(/\s/g, '');
    if (upper === 'ODOERROR' || upper === 'ODOERR') return 'ODO ERROR';

    // Strip Indonesian thousand separators (dots) and format
    const kmValue = parseInt(String(kmAwal).replace(/\./g, '').replace(/,/g, ''), 10);
    if (isNaN(kmValue)) return '-';

    return kmValue.toLocaleString('id-ID') + ' KM';
}

// ============================================================================
// FORMAT NO PLAT OTOMATIS  →  B 1234 XYZ
// ============================================================================
function formatNoPlatInput(input) {
    const cursorPos = input.selectionStart;
    const prevLen   = input.value.length;

    // Bersihkan: hanya huruf & angka, uppercase
    const raw = input.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (!raw) { input.value = ''; return; }

    let i = 0;
    let part1 = '', part2 = '', part3 = '';

    // Bagian 1: huruf area (maks 2)
    while (i < raw.length && /[A-Z]/.test(raw[i]) && part1.length < 2) {
        part1 += raw[i++];
    }
    // Bagian 2: angka (maks 4)
    while (i < raw.length && /[0-9]/.test(raw[i]) && part2.length < 4) {
        part2 += raw[i++];
    }
    // Bagian 3: huruf akhir (maks 3)
    while (i < raw.length && /[A-Z]/.test(raw[i]) && part3.length < 3) {
        part3 += raw[i++];
    }

    let formatted = part1;
    if (part2) formatted += ' ' + part2;
    if (part3) formatted += ' ' + part3;

    input.value = formatted;

    // Pertahankan posisi cursor
    const diff = formatted.length - prevLen;
    input.setSelectionRange(cursorPos + diff, cursorPos + diff);
}

// Parse input KM - hilangkan titik sebelum parsing
// Returns a Number or NaN when not numeric
function parseKMInput(value) {
    if (!value) return NaN;
    // Hapus semua titik dan spasi
    const cleaned = value.toString().replace(/\./g, '').replace(/\s/g, '');
    // If there are no digits, return NaN
    if (!/[0-9]/.test(cleaned)) return NaN;
    const n = parseFloat(cleaned);
    return isNaN(n) ? NaN : n;
}

// ============================================================================
// MAIN PAGE TAB SWITCH (NSI / MOBIL LUAR)
// ============================================================================
let currentMainTab = 'nsi';
let allMobilLuarData = [];
let currentEditMobilLuarId = null;

function switchMainTab(tab) {
    currentMainTab = tab;
    const nsiContent     = document.getElementById('nsiContent');
    const mobilLuarContent = document.getElementById('mobilLuarContent');
    const nsiBtn         = document.getElementById('pageTabNSIBtn');
    const mobilLuarBtn   = document.getElementById('pageTabMobilLuarBtn');

    if (tab === 'nsi') {
        nsiContent.style.display = 'block';
        mobilLuarContent.style.display = 'none';
        nsiBtn.classList.add('active');
        mobilLuarBtn.classList.remove('active');
    } else {
        nsiContent.style.display = 'none';
        mobilLuarContent.style.display = 'block';
        nsiBtn.classList.remove('active');
        mobilLuarBtn.classList.add('active');
        resetMobilLuarForm();
        loadMobilLuarList();
        loadMobilLuarSuggestions();
    }
}

// ============================================================================
// MOBIL LUAR - LOAD LIST
// ============================================================================
async function loadMobilLuarList() {
    try {
        const response = await fetch(`${API_BASE_URL}/buangan/mobil-luar`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        const data = (result.data && Array.isArray(result.data)) ? result.data
            : (Array.isArray(result) ? result : []);
        allMobilLuarData = data;
        renderMobilLuarTable(data);
    } catch (err) {
        console.error('Error loading mobil luar:', err);
        showToast('Gagal memuat data mobil luar', 'error');
    }
}

// ============================================================================
// MOBIL LUAR - LOAD SUGGESTIONS (datalist autocomplete, fetch DISTINCT saja)
// ============================================================================
async function loadMobilLuarSuggestions() {
    try {
        const response = await fetch(`${API_BASE_URL}/buangan/mobil-luar/suggestions`);
        if (!response.ok) return;
        const result = await response.json();
        if (!result.data) return;

        const fieldMap = {
            pengirim:     'dlMlPengirim',
            galian:       'dlMlGalian',
            no_plat:      'dlMlNoPlat',
            supir:        'dlMlSupir',
            proyek:       'dlMlProyek',
            lokasi_buang: 'dlMlLokasiBuang'
        };

        Object.entries(fieldMap).forEach(([field, dlId]) => {
            const dl = document.getElementById(dlId);
            if (!dl || !Array.isArray(result.data[field])) return;
            dl.innerHTML = result.data[field].map(v =>
                `<option value="${v.toString().replace(/"/g, '&quot;')}"></option>`
            ).join('');
        });
    } catch (err) {
        console.error('Error loading mobil luar suggestions:', err);
    }
}

// ============================================================================
// MOBIL LUAR - RENDER TABLE (dengan pagination)
// ============================================================================
function renderMobilLuarTable(data) {
    filteredMobilLuarData = Array.isArray(data) ? data : [];
    currentMobilLuarPage  = 1;
    _renderMobilLuarRows();
    renderMobilLuarPagination();
}

function _renderMobilLuarRows() {
    const tbody = document.getElementById('mobilLuarTableBody');
    if (!tbody) return;

    if (filteredMobilLuarData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">Belum ada data mobil luar</div>
                </td>
            </tr>
        `;
        return;
    }

    const start  = (currentMobilLuarPage - 1) * itemsPerPage;
    const pageData = filteredMobilLuarData.slice(start, start + itemsPerPage);
    const globalStart = start;

    tbody.innerHTML = pageData.map((row, idx) => `
        <tr>
            <td style="text-align:center; font-weight:600;">${globalStart + idx + 1}</td>
            <td>${row.no_urut || '-'}</td>
            <td>${row.pengirim || '-'}</td>
            <td>${row.galian || '-'}</td>
            <td>${row.no_plat || '-'}</td>
            <td>${row.supir || '-'}</td>
            <td>${formatDateOnly(row.tanggal_bongkar)}</td>
            <td>${row.jam_bongkar ? row.jam_bongkar.substring(0, 5) : '-'}</td>
            <td>${row.proyek || '-'}</td>
            <td>${row.lokasi_buang || '-'}</td>
            <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-warning btn-small" onclick="bukaEditMobilLuar(${row.id})">✏️ Edit</button>
                    <button class="btn btn-danger btn-small" onclick="hapusMobilLuar(${row.id})">🗑️ Hapus</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================================================
// MOBIL LUAR - FORMAT DATE (DD/MM/YYYY, handle UTC+7)
// ============================================================================
function formatDateOnly(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const local = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    const day = String(local.getUTCDate()).padStart(2, '0');
    const month = String(local.getUTCMonth() + 1).padStart(2, '0');
    const year = local.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

// ============================================================================
// MOBIL LUAR - FILTER TABLE
// ============================================================================
function filterMobilLuarTable() {
    const keyword = document.getElementById('filterMobilLuar').value.toLowerCase().trim();
    const filtered = !keyword ? allMobilLuarData : allMobilLuarData.filter(row =>
        (row.pengirim     && row.pengirim.toLowerCase().includes(keyword)) ||
        (row.supir        && row.supir.toLowerCase().includes(keyword))    ||
        (row.galian       && row.galian.toLowerCase().includes(keyword))   ||
        (row.no_plat      && row.no_plat.toLowerCase().includes(keyword))  ||
        (row.proyek       && row.proyek.toLowerCase().includes(keyword))   ||
        (row.lokasi_buang && row.lokasi_buang.toLowerCase().includes(keyword))
    );
    renderMobilLuarTable(filtered);
}

// ============================================================================
// MOBIL LUAR - RESET FORM KE MODE TAMBAH
// ============================================================================
function resetMobilLuarForm() {
    currentEditMobilLuarId = null;
    document.getElementById('mobilLuarForm').reset();
    document.getElementById('mlId').value = '';
    document.getElementById('mlTanggalBongkar').value = new Date().toISOString().split('T')[0];
    document.getElementById('mlFormTitle').textContent = 'Tambah Mobil Luar';
    document.getElementById('mlFormModeBadge').textContent = 'Baru';
    document.getElementById('mlFormModeBadge').className = 'ml-form-mode-badge badge-new';
    document.getElementById('mlBatalBtn').style.display = 'none';
    document.getElementById('mlSimpanBtn').textContent = '💾 Simpan';
}

// ============================================================================
// MOBIL LUAR - BUKA EDIT (isi form dari baris tabel)
// ============================================================================
function bukaEditMobilLuar(id) {
    const row = allMobilLuarData.find(r => r.id === id);
    if (!row) {
        showToast('Data tidak ditemukan', 'error');
        return;
    }

    currentEditMobilLuarId = id;
    document.getElementById('mlId').value = id;
    document.getElementById('mlNoUrut').value = row.no_urut || '';
    document.getElementById('mlPengirim').value = row.pengirim || '';
    document.getElementById('mlGalian').value = row.galian || '';
    document.getElementById('mlNoPlat').value = row.no_plat || '';
    document.getElementById('mlSupir').value = row.supir || '';
    document.getElementById('mlTanggalBongkar').value = row.tanggal_bongkar
        ? row.tanggal_bongkar.substring(0, 10) : '';
    document.getElementById('mlJamBongkar').value = row.jam_bongkar
        ? row.jam_bongkar.substring(0, 5) : '';
    document.getElementById('mlProyek').value = row.proyek || '';
    document.getElementById('mlLokasiBuang').value = row.lokasi_buang || '';

    document.getElementById('mlFormTitle').textContent = `Edit Mobil Luar`;
    document.getElementById('mlFormModeBadge').textContent = `Edit #${id}`;
    document.getElementById('mlFormModeBadge').className = 'ml-form-mode-badge badge-edit';
    document.getElementById('mlBatalBtn').style.display = 'inline-flex';
    document.getElementById('mlSimpanBtn').textContent = '✓ Update';

    // Scroll ke form
    document.getElementById('mobilLuarForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('mlNoUrut').focus();
}

// ============================================================================
// MOBIL LUAR - BATAL EDIT
// ============================================================================
function batalMobilLuar() {
    resetMobilLuarForm();
}

// ============================================================================
// MOBIL LUAR - SUBMIT FORM (ADD / EDIT)
// ============================================================================
let _pendingMobilLuarPayload = null;
let _pendingMobilLuarIsEdit  = false;

async function submitMobilLuarForm(e) {
    e.preventDefault();

    const noUrutRaw      = document.getElementById('mlNoUrut').value;
    const pengirimRaw    = document.getElementById('mlPengirim').value.trim();
    const galianRaw      = document.getElementById('mlGalian').value.trim();
    const noPlatRaw      = document.getElementById('mlNoPlat').value.trim();
    const supirRaw       = document.getElementById('mlSupir').value.trim();
    const tanggalRaw     = document.getElementById('mlTanggalBongkar').value;
    const jamRaw         = document.getElementById('mlJamBongkar').value;
    const proyekRaw      = document.getElementById('mlProyek').value.trim();
    const lokasiBuangRaw = document.getElementById('mlLokasiBuang').value.trim();

    const emptyFields = [];
    if (!noUrutRaw)      emptyFields.push('No Urut');
    if (!pengirimRaw)    emptyFields.push('Pengirim (PT)');
    if (!galianRaw)      emptyFields.push('Galian');
    if (!noPlatRaw)      emptyFields.push('No Plat');
    if (!supirRaw)       emptyFields.push('Supir');
    if (!tanggalRaw)     emptyFields.push('Tanggal Bongkar');
    if (!jamRaw)         emptyFields.push('Jam Bongkar');
    if (!proyekRaw)      emptyFields.push('Proyek');
    if (!lokasiBuangRaw) emptyFields.push('Lokasi Buang');

    _pendingMobilLuarPayload = {
        no_urut:         noUrutRaw ? parseInt(noUrutRaw) : null,
        pengirim:        pengirimRaw || null,
        galian:          galianRaw || null,
        no_plat:         noPlatRaw || null,
        supir:           supirRaw || null,
        tanggal_bongkar: tanggalRaw || null,
        jam_bongkar:     jamRaw || null,
        proyek:          proyekRaw || null,
        lokasi_buang:    lokasiBuangRaw || null
    };
    _pendingMobilLuarIsEdit = !!currentEditMobilLuarId;

    if (emptyFields.length > 0) {
        const listEl = document.getElementById('mlWarningFieldList');
        listEl.innerHTML = emptyFields.map(f =>
            `<span class="ml-warning-field-item">⚠ ${f}</span>`
        ).join('');
        document.getElementById('modalWarningMobilLuar').style.display = 'flex';
        return;
    }

    await _doSimpanMobilLuar();
}

function tutupModalWarningMobilLuar() {
    document.getElementById('modalWarningMobilLuar').style.display = 'none';
}

async function lanjutkanSimpanMobilLuar() {
    tutupModalWarningMobilLuar();
    await _doSimpanMobilLuar();
}

async function _doSimpanMobilLuar() {
    const payload = _pendingMobilLuarPayload;
    const isEdit  = _pendingMobilLuarIsEdit;
    const url     = isEdit
        ? `${API_BASE_URL}/buangan/mobil-luar/${currentEditMobilLuarId}`
        : `${API_BASE_URL}/buangan/mobil-luar`;
    const method  = isEdit ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || `HTTP error! status: ${response.status}`);
        }

        showToast(isEdit ? 'Data berhasil diupdate!' : 'Data berhasil ditambahkan!', 'success');
        resetMobilLuarForm();
        await loadMobilLuarList();
        loadMobilLuarSuggestions();

    } catch (err) {
        console.error('Error submit mobil luar:', err);
        showToast('Gagal menyimpan: ' + err.message, 'error');
    }
}

// ============================================================================
// MOBIL LUAR - HAPUS
// ============================================================================
async function hapusMobilLuar(id) {
    if (!confirm('Yakin ingin menghapus data ini?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/buangan/mobil-luar/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || `HTTP error! status: ${response.status}`);
        }

        showToast('Data berhasil dihapus', 'success');
        await loadMobilLuarList();
        loadMobilLuarSuggestions();

    } catch (err) {
        console.error('Error hapus mobil luar:', err);
        showToast('Gagal menghapus: ' + err.message, 'error');
    }
}