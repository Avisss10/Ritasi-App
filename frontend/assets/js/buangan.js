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
    document.getElementById('tanggalBongkar').value = today;

    // Load master galian untuk dropdown
    loadGalianOptions();

    // Load daftar buangan (default view)
    loadBuanganList();

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
});

// Global variable untuk menyimpan semua data
let allOrderData = [];
let allBuanganData = [];
let currentViewMode = 'buangan'; // 'order' atau 'buangan'
let currentBuanganDetail = null;
let currentKmAwalEdit = 0;

// Pagination variables
let currentOrderPage = 1;
let currentBuanganPage = 1;
let itemsPerPage = 10;
let filteredOrderData = [];
let filteredBuanganData = [];

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
// SEARCH ORDER
// ============================================================================
async function cariOrder() {
    const tanggal = document.getElementById('tanggalOrder').value;

    if (!tanggal) {
        showToast('Mohon pilih tanggal order', 'warning');
        return;
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

        // Filter berdasarkan tanggal - handle timezone dengan benar
        const filteredOrders = orderData.filter(order => {
            if (!order.tanggal_order) return false;
            
            // Ambil tanggal dari string (UTC di database)
            const dbDateStr = order.tanggal_order.substring(0, 10);
            
            // Convert tanggal UTC ke timezone lokal (Jakarta = UTC+7)
            const orderDate = new Date(order.tanggal_order);
            const localDateStr = new Date(orderDate.getTime() + (7 * 60 * 60 * 1000))
                .toISOString()
                .substring(0, 10);
            
            console.log(`Order ID ${order.id}: DB="${dbDateStr}", Local="${localDateStr}", Input="${tanggal}"`);
            
            // Match dengan tanggal lokal (yang ditampilkan di tabel)
            return localDateStr === tanggal;
        });

console.log('Filtered orders:', filteredOrders);

        if (filteredOrders.length === 0) {
            showToast('Tidak ada order pada tanggal ini', 'warning');
            
            // Tampilkan pesan "tidak ada data" di tabel order
            allOrderData = [];
            currentViewMode = 'order';
            
            document.getElementById('tableTitle').textContent = 'Data Order';
            document.getElementById('orderTableContainer').style.display = 'block';
            document.getElementById('buanganTableContainer').style.display = 'none';
            
            // Tampilkan tabel kosong dengan pesan
            const tbody = document.getElementById('orderTableBody');
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <div class="empty-state-text">Tidak ditemukan data order pada tanggal ini</div>
                    </td>
                </tr>
            `;
            
            // Reset filter
            const filterInput = document.getElementById('filterNoPintu');
            if (filterInput) {
                filterInput.value = '';
            }
            
            return;
        }

        // Simpan data untuk filtering
        allOrderData = filteredOrders;
        currentViewMode = 'order';

        // Update title dan tampilkan tabel order
        document.getElementById('tableTitle').textContent = 'Data Order';
        document.getElementById('orderTableContainer').style.display = 'block';
        document.getElementById('buanganTableContainer').style.display = 'none';

        // Reset filter
        const filterInput = document.getElementById('filterNoPintu');
        if (filterInput) {
            filterInput.value = '';
        }

        // Tampilkan hasil
        displayOrderResults(filteredOrders);

        showToast(`Ditemukan ${filteredOrders.length} order`, 'success');

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal mencari order: ' + error.message, 'error');
    }
}

// ============================================================================
// FILTER TABLE (UNIVERSAL)
// ============================================================================
function filterTable() {
    if (currentViewMode === 'order') {
        filterByNoPintu();
    } else {
        filterBuanganByNoPintu();
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
    currentBuanganPage = 1; // Reset to first page
    const filterValue = document.getElementById('filterNoPintu').value.toLowerCase().trim();

    if (filterValue === '') {
        displayBuanganList(allBuanganData);
    } else {
        const filtered = allBuanganData.filter(buangan => {
            return buangan.no_pintu && buangan.no_pintu.toLowerCase().includes(filterValue);
        });
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

        const actionButtons = (order.status === 'BATAL' || order.status === 'COMPLETE')
            ? '-'
            : `
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-warning btn-small" onclick="bukaFormBuangan(${order.id})">
                        <span class="icon">📋</span> Buangan
                    </button>
                    <button class="btn btn-danger btn-small" onclick="bukaModalBatal(${order.id})">
                        <span class="icon">⚠️</span> Batal Order
                    </button>
                </div>
            `;

        tr.innerHTML = `
            <td style="text-align: center; font-weight: 600;">${rowNumber}</td>
            <td>${order.no_order || '-'}</td>
            <td>${formatDate(order.tanggal_order)}</td>
            <td>${order.no_pintu || '-'}</td>
            <td>${order.supir || '-'}</td>
            <td>${order.galian || '-'}</td>
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
            currentKmAwal = parseFloat(order.km_awal) || 0;
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
                <div class="order-info-value">${order.nama_galian || '-'}</div>
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
// TOGGLE ALIHAN FIELDS
// ============================================================================
function toggleAlihan() {
    const alihan = document.getElementById('alihan').checked;
    document.getElementById('alihanFields').style.display = alihan ? 'block' : 'none';
    
    if (!alihan) {
        document.getElementById('galianAlihan').value = '';
        document.getElementById('uangAlihan').value = '';
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
    }
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

        if (isNaN(jarakKm) || jarakKm <= 0) {
            showToast('KM Akhir harus lebih besar dari KM Awal (' + kmAwal + ' KM)', 'warning');
            return;
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
        uang_alihan: document.getElementById('uangAlihan').value
            ? parseKMInput(document.getElementById('uangAlihan').value)
            : null,
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
            ? 'Ritasi berhasil disimpan! (ODO ERROR)'
            : (jarakKm === null ? 'Ritasi berhasil disimpan!' : 'Ritasi berhasil disimpan! Jarak: ' + formatKM(jarakKm) + ' KM');
        
        showToast(successMsg, 'success');
        
        // Reset form dan kembali ke halaman awal
        setTimeout(() => {
            batalForm();
        }, 1500);

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal menyimpan ritasi: ' + error.message, 'error');
    }
}

// ============================================================================
// HANDLE EDIT FORM SUBMIT
// ============================================================================
async function handleEditFormSubmit(e) {
    e.preventDefault();

    const buanganId = currentBuanganDetail.id;
    const kmAkhirInput = document.getElementById('editKmAkhir').value.trim();
    const lokasiBongkar = document.getElementById('editLokasiBongkar').value.trim();

    // Validasi lokasi buangan wajib diisi
    if (!lokasiBongkar) {
        showToast('Lokasi buangan wajib diisi', 'warning');
        return;
    }
    
    let kmAkhir = null;

    // Exact match for 'ODO ERROR' (no fuzzy autocorrect)
    function isExactOdoVariant(input){
        if(!input) return false;
        const s = input.toString().toUpperCase().replace(/\s/g,'').trim();
        return s === 'ODOERROR' || s === 'ODOERR';
    }

    const maybeNumber = parseKMInput(kmAkhirInput);
    if (!isNaN(maybeNumber)) {
        kmAkhir = maybeNumber;
        if (kmAkhir <= currentKmAwalEdit) {
            showToast('KM Akhir harus lebih besar dari KM Awal', 'warning');
            return;
        }
    } else if (isExactOdoVariant(kmAkhirInput)) {
        kmAkhir = 'ODO ERROR';
    } else {
        // arbitrary text -> accept and send as-is
        kmAkhir = kmAkhirInput;
    }
    
    // Get galian_alihan_id dari nama
    const galianAlihanName = document.getElementById('editGalianAlihan').value;
    const galianAlihanId = galianAlihanName ? getGalianIdByName(galianAlihanName) : null;
    
    const formData = {
        no_urut: parseInt(document.getElementById('editNoUrut').value),
        tanggal_bongkar: document.getElementById('editTanggalBongkar').value,
        jam_bongkar: document.getElementById('editJamBongkar').value,
        km_akhir: kmAkhir,
        lokasi_bongkar: lokasiBongkar,
        alihan: document.getElementById('editAlihan').checked,
        galian_alihan_id: galianAlihanId,
        uang_alihan: document.getElementById('editUangAlihan').value
            ? parseKMInput(document.getElementById('editUangAlihan').value)
            : null,
        keterangan: document.getElementById('editKeterangan').value || null
    };

    // Validasi
    if (formData.alihan && !formData.galian_alihan_id) {
        showToast('Pilih galian alihan jika galian alihan dicentang', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/buangan/${buanganId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || `HTTP error! status: ${response.status}`);
        }

        showToast('Ritasi berhasil diupdate!', 'success');
        
        setTimeout(() => {
            tutupFormEdit();
            lihatDetailBuangan(buanganId);
        }, 1500);

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
        currentKmAwalEdit = parseFloat(order.km_awal) || 0;
    }

    // Isi form edit dengan data buangan
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
    
    document.getElementById('editUangAlihan').value = buangan.uang_alihan || '';
    document.getElementById('editKeterangan').value = buangan.keterangan || '';

    // Toggle alihan fields
    document.getElementById('editAlihanFields').style.display = buangan.alihan ? 'block' : 'none';

    // Hitung jarak
    hitungJarakEdit();

    // Tampilkan info order di form edit
    displayOrderInfoEdit(order);

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
    // Show search & main table, hide form
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('mainTableSection').style.display = 'block';
    document.getElementById('formSection').style.display = 'none';

    // Reset ke view buangan
    currentViewMode = 'buangan';
    document.getElementById('tableTitle').textContent = 'Daftar Buangan';
    document.getElementById('orderTableContainer').style.display = 'none';
    document.getElementById('buanganTableContainer').style.display = 'block';
    document.getElementById('filterNoPintu').value = '';

    currentOrderData = null;
    currentKmAwal = 0;

    document.getElementById('buanganForm').reset();

    // Reload buangan list
    loadBuanganList();
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

        // Populate datalist untuk form edit
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

        // Simpan data galian ke global variable untuk lookup ID
        window.galianMasterData = galianData;

    } catch (error) {
        console.error('❌ Error loading galian options:', error);
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
// LOAD BUANGAN LIST
// ============================================================================
async function loadBuanganList() {
    try {
        console.log('Loading buangan list from API...');
        
        const response = await fetch(`${API_BASE_URL}/buangan`);
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        console.log('API Response:', result);

        // Cek apakah result memiliki property success
        let buanganData = [];
        
        if (result.hasOwnProperty('success') && result.success) {
            buanganData = result.data || [];
        } else if (Array.isArray(result)) {
            buanganData = result;
        } else if (result.data && Array.isArray(result.data)) {
            buanganData = result.data;
        }

        console.log('Buangan data to display:', buanganData);

        allBuanganData = buanganData;
        displayBuanganList(buanganData);

    } catch (error) {
        console.error('Error loading buangan:', error);
        // Tampilkan tabel kosong jika error
        allBuanganData = [];
        displayBuanganList([]);
    }
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
        
        // Calculate row number (global index)
        const rowNumber = startIndex + index + 1;

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
        // Show exactly what's in DB. Treat null/undefined/empty as '-'. If DB has 0, display '0'.
        if (buangan.km_akhir === null || buangan.km_akhir === undefined || buangan.km_akhir === '') {
            kmAkhirDisplay = '-';
        } else if (isExactOdoVariantDisplay(buangan.km_akhir)) {
            kmAkhirDisplay = 'ODO ERROR';
        } else {
            kmAkhirDisplay = String(buangan.km_akhir);
        }
        
        let jarakDisplay = '-';
        // Show exactly what's in DB. Treat null/undefined/empty as '-'. If DB has 0, display '0'.
        if (buangan.jarak_km === null || buangan.jarak_km === undefined || buangan.jarak_km === '') {
            jarakDisplay = '-';
        } else if (isExactOdoVariantDisplay(buangan.jarak_km)) {
            jarakDisplay = 'ODO ERROR';
        } else {
            jarakDisplay = String(buangan.jarak_km);
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
                <button class="btn btn-primary btn-small" onclick="lihatDetailBuangan(${buangan.id})">
                    <span class="icon">👁️</span> Detail
                </button>
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

    currentKmAwalEdit = parseFloat(order.km_awal) || 0;

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
                <div class="detail-value">${formatCurrency(buangan.uang_alihan)}</div>
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
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('mainTableSection').style.display = 'block';
    document.getElementById('detailSection').style.display = 'none';
    
    currentBuanganDetail = null;
}
async function hapusBuangan(id) {
    if (!confirm('Yakin ingin menghapus ritasi ini?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/buangan/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || `HTTP error! status: ${response.status}`);
        }

        showToast('Ritasi berhasil dihapus', 'success');
        
        // Jika dari detail, kembali ke list
        if (currentBuanganDetail) {
            setTimeout(() => {
                document.getElementById('searchSection').style.display = 'block';
                document.getElementById('mainTableSection').style.display = 'block';
                document.getElementById('detailSection').style.display = 'none';
                currentBuanganDetail = null;
                loadBuanganList();
            }, 1000);
        } else {
            loadBuanganList();
        }

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
        
        // Tutup modal
        tutupModalBatal();

        // Reload data order yang ditampilkan
        setTimeout(() => {
            cariOrder();
        }, 1000);

    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal membatalkan order: ' + error.message, 'error');
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
    if (!km && km !== 0) return '0';
    
    const kmValue = parseFloat(km);
    if (isNaN(kmValue)) return '0';
    
    return kmValue.toLocaleString('id-ID', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 2 
    });
}

// Format KM Awal - Handle ODO ERROR
function formatKMAwal(kmAwal) {
    // Jika null, undefined, atau kosong
    if (!kmAwal && kmAwal !== 0) return '-';
    
    // Cek apakah string "ODO ERROR"
    if (typeof kmAwal === 'string' && 
        (kmAwal.toUpperCase() === 'ODO ERROR' || 
         kmAwal.toUpperCase() === 'ODOERROR' ||
         kmAwal.toUpperCase() === 'ODO ERR' ||
         kmAwal.toUpperCase() === 'ODOERR')) {
        return 'ODO ERROR';
    }
    
    // Jika angka, format dengan titik ribuan + satuan KM
    const kmValue = parseFloat(kmAwal);
    if (isNaN(kmValue)) return '-';
    
    return kmValue.toLocaleString('id-ID', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 2 
    }) + ' KM';
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