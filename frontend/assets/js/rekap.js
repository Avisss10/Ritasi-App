// API Base URL
const API_URL = 'http://localhost:3000/api';

// Storage untuk data master
let masterKendaraan = [];
let masterSupir = [];
let masterGalian = [];

// ============================================================================
// DEBUG UTILITIES
// ============================================================================
function debugLog(title, data) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 ${title}`);
    console.log('='.repeat(60));
    console.log(data);
    console.log('='.repeat(60) + '\n');
}

// ============================================================================
// DATE FILTER FUNCTIONS
// ============================================================================
function getToday() {
    const today = new Date();
    return formatDateForInput(today);
}

function get7DaysAgo() {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    return formatDateForInput(sevenDaysAgo);
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toggleDateRangeOrder() {
    const filterType = document.getElementById('filter-tanggal-type-order').value;
    const dateRangeDiv = document.getElementById('date-range-order');
    const dariInput = document.getElementById('filter-tanggal-dari-order');
    const sampaiInput = document.getElementById('filter-tanggal-sampai-order');
    
    if (filterType === 'manual') {
        dateRangeDiv.classList.add('show');
        dariInput.value = '';
        sampaiInput.value = '';
    } else {
        dateRangeDiv.classList.remove('show');
        
        if (filterType === 'hari-ini') {
            const today = getToday();
            dariInput.value = today;
            sampaiInput.value = today;
        } else if (filterType === '7-hari') {
            dariInput.value = get7DaysAgo();
            sampaiInput.value = getToday();
        } else if (filterType === 'semua') {
            dariInput.value = '';
            sampaiInput.value = '';
        }
    }
}

function toggleDateRangeBuangan() {
    const filterType = document.getElementById('filter-tanggal-type-buangan').value;
    const dateRangeDiv = document.getElementById('date-range-buangan');
    const dariInput = document.getElementById('filter-tanggal-dari-buangan');
    const sampaiInput = document.getElementById('filter-tanggal-sampai-buangan');
    
    if (filterType === 'manual') {
        dateRangeDiv.classList.add('show');
        dariInput.value = '';
        sampaiInput.value = '';
    } else {
        dateRangeDiv.classList.remove('show');
        
        if (filterType === 'hari-ini') {
            const today = getToday();
            dariInput.value = today;
            sampaiInput.value = today;
        } else if (filterType === '7-hari') {
            dariInput.value = get7DaysAgo();
            sampaiInput.value = getToday();
        } else if (filterType === 'semua') {
            dariInput.value = '';
            sampaiInput.value = '';
        }
    }
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Load data for buangan tab when switching to it
            if (tabName === 'buangan') {
                loadRekapBuangan();
            }
        });
    });
    
    // Real-time search untuk proyek input
    const proyekInput = document.getElementById('filter-proyek-order');
    if (proyekInput) {
        let typingTimer;
        const typingDelay = 500;
        
        proyekInput.addEventListener('input', () => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                loadRekapOrder();
            }, typingDelay);
        });
    }
    
    // Setup autocomplete event listeners
    setupAutocompleteListeners();
});

// ============================================================================
// AUTOCOMPLETE SETUP
// ============================================================================
function setupAutocompleteListeners() {
    // Kendaraan autocomplete
    const kendaraanInput = document.getElementById('filter-kendaraan-order');
    if (kendaraanInput) {
        kendaraanInput.addEventListener('input', function() {
            filterDatalist(this.value, masterKendaraan, 'datalist-kendaraan', 'no_pintu');
        });
        
        kendaraanInput.addEventListener('change', function() {
            const selectedItem = masterKendaraan.find(k => k.no_pintu === this.value);
            if (selectedItem) {
                document.getElementById('filter-kendaraan-order-id').value = selectedItem.id;
                console.log('Kendaraan terpilih:', selectedItem);
            } else {
                document.getElementById('filter-kendaraan-order-id').value = '';
            }
        });
    }
    
    // Supir autocomplete
    const supirInput = document.getElementById('filter-supir-order');
    if (supirInput) {
        supirInput.addEventListener('input', function() {
            filterDatalist(this.value, masterSupir, 'datalist-supir', 'nama');
        });
        
        supirInput.addEventListener('change', function() {
            const selectedItem = masterSupir.find(s => s.nama === this.value);
            if (selectedItem) {
                document.getElementById('filter-supir-order-id').value = selectedItem.id;
                console.log('Supir terpilih:', selectedItem);
            } else {
                document.getElementById('filter-supir-order-id').value = '';
            }
        });
    }
    
    // Galian autocomplete
    const galianInput = document.getElementById('filter-galian-order');
    if (galianInput) {
        galianInput.addEventListener('input', function() {
            filterDatalist(this.value, masterGalian, 'datalist-galian', 'nama_galian');
        });
        
        galianInput.addEventListener('change', function() {
            const selectedItem = masterGalian.find(g => g.nama_galian === this.value);
            if (selectedItem) {
                document.getElementById('filter-galian-order-id').value = selectedItem.id;
                console.log('Galian terpilih:', selectedItem);
            } else {
                document.getElementById('filter-galian-order-id').value = '';
            }
        });
    }
}

// ============================================================================
// FILTER DATALIST FUNCTION
// ============================================================================
function filterDatalist(searchTerm, dataArray, datalistId, displayKey) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;
    
    datalist.innerHTML = '';
    
    if (!searchTerm || searchTerm.length < 1) {
        // Tampilkan semua jika input kosong atau kurang dari 1 karakter
        dataArray.slice(0, 50).forEach(item => {
            const option = document.createElement('option');
            option.value = item[displayKey];
            datalist.appendChild(option);
        });
        return;
    }
    
    // Filter berdasarkan search term
    const filtered = dataArray.filter(item => 
        item[displayKey] && 
        item[displayKey].toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Tampilkan maksimal 50 hasil
    filtered.slice(0, 50).forEach(item => {
        const option = document.createElement('option');
        option.value = item[displayKey];
        datalist.appendChild(option);
    });
}

// ============================================================================
// LOAD MASTER DATA FOR AUTOCOMPLETE
// ============================================================================
async function loadMasterData() {
    debugLog('Loading Master Data', 'Starting...');
    
    await loadKendaraan();
    await loadSupir();
    await loadGalian();
    
    console.log('✅ Master data loading completed\n');
}

async function loadKendaraan() {
    try {
        const url = `${API_URL}/master/kendaraan`;
        console.log('📡 Fetching Kendaraan:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        debugLog('Kendaraan Response', result);
        
        let data = null;
        if (result && result.success && Array.isArray(result.data)) {
            data = result.data;
        } else if (Array.isArray(result)) {
            data = result;
        } else if (result && Array.isArray(result.rows)) {
            data = result.rows;
        } else if (result && Array.isArray(result.data)) {
            data = result.data;
        }
        
        if (data && Array.isArray(data)) {
            masterKendaraan = data;
            console.log(`✅ Loaded ${data.length} kendaraan records`);
            populateDatalist('datalist-kendaraan', data, 'no_pintu');
        } else {
            console.error('❌ Kendaraan: Invalid data structure');
        }
    } catch (err) {
        console.error('❌ Error loading kendaraan:', err.message);
    }
}

async function loadSupir() {
    try {
        const url = `${API_URL}/master/supir`;
        console.log('📡 Fetching Supir:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        debugLog('Supir Response', result);
        
        let data = null;
        if (result && result.success && Array.isArray(result.data)) {
            data = result.data;
        } else if (Array.isArray(result)) {
            data = result;
        } else if (result && Array.isArray(result.rows)) {
            data = result.rows;
        } else if (result && Array.isArray(result.data)) {
            data = result.data;
        }
        
        if (data && Array.isArray(data)) {
            masterSupir = data;
            console.log(`✅ Loaded ${data.length} supir records`);
            populateDatalist('datalist-supir', data, 'nama');
        } else {
            console.error('❌ Supir: Invalid data structure');
        }
    } catch (err) {
        console.error('❌ Error loading supir:', err.message);
    }
}

async function loadGalian() {
    try {
        const url = `${API_URL}/master/galian`;
        console.log('📡 Fetching Galian:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        debugLog('Galian Response', result);
        
        let data = null;
        if (result && result.success && Array.isArray(result.data)) {
            data = result.data;
        } else if (Array.isArray(result)) {
            data = result;
        } else if (result && Array.isArray(result.rows)) {
            data = result.rows;
        } else if (result && Array.isArray(result.data)) {
            data = result.data;
        }
        
        if (data && Array.isArray(data)) {
            masterGalian = data;
            console.log(`✅ Loaded ${data.length} galian records`);
            populateDatalist('datalist-galian', data, 'nama_galian');
        } else {
            console.error('❌ Galian: Invalid data structure');
        }
    } catch (err) {
        console.error('❌ Error loading galian:', err.message);
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
// REKAP ORDER
// ============================================================================
async function loadRekapOrder() {
    const tbody = document.getElementById('tbody-order');
    tbody.innerHTML = '<tr><td colspan="15" class="text-center loading">Memuat data...</td></tr>';

    try {
        const params = new URLSearchParams();
        
        const filters = {
            tanggal_dari: document.getElementById('filter-tanggal-dari-order').value,
            tanggal_sampai: document.getElementById('filter-tanggal-sampai-order').value,
            proyek_input: document.getElementById('filter-proyek-order').value.trim(),
            status: document.getElementById('filter-status-order').value,
            kendaraan_id: document.getElementById('filter-kendaraan-order-id').value,
            supir_id: document.getElementById('filter-supir-order-id').value,
            galian_id: document.getElementById('filter-galian-order-id').value
        };

        Object.keys(filters).forEach(key => {
            const value = filters[key];
            if (value && value !== '' && value !== '0') {
                params.append(key, value);
            }
        });

        const url = `${API_URL}/rekap/order${params.toString() ? '?' + params.toString() : ''}`;
        debugLog('Loading Rekap Order', {
            url: url,
            filters: filters
        });
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        debugLog('Rekap Order Response', result);

        let data = null;
        
        if (result && result.success === true && result.data) {
            console.log('✓ Using result.data structure');
            data = result.data;
        } else if (Array.isArray(result)) {
            console.log('✓ Result is directly an array');
            data = result;
        } else if (result && Array.isArray(result.rows)) {
            console.log('✓ Using result.rows structure');
            data = result.rows;
        } else if (result && Array.isArray(result.data)) {
            console.log('✓ Using result.data (no success check)');
            data = result.data;
        }

        console.log('Extracted data:', data);
        console.log('Data is array?', Array.isArray(data));
        console.log('Data length:', data ? data.length : 0);

        if (data && Array.isArray(data) && data.length > 0) {
            console.log(`✅ Displaying ${data.length} order records`);
            tbody.innerHTML = data.map((row, index) => {
                let statusStyle = '';
                const status = (row.status || '').toUpperCase();
                if (status === 'COMPLETE') {
                    statusStyle = 'background: #28a745; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                } else if (status === 'ON PROCESS' || status === 'ON_PROCESS') {
                    statusStyle = 'background: #ffc107; color: #000; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                } else {
                    statusStyle = 'background: #6c757d; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                }
                
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${formatDate(row.tanggal_order)}</td>
                        <td>${row.no_order || '-'}</td>
                        <td>${row.petugas_order || '-'}</td>
                        <td>${row.kendaraan_nama || row.no_pintu || '-'}</td>
                        <td>${row.supir_nama || '-'}</td>
                        <td>${row.galian_nama || '-'}</td>
                        <td>${row.no_do || '-'}</td>
                        <td>${row.jam_order || '-'}</td>
                        <td>${formatKilometer(row.km_awal)}</td>
                        <td>${formatCurrency(row.uang_jalan)}</td>
                        <td>${formatCurrency(row.potongan)}</td>
                        <td>${formatCurrency(row.hasil_akhir)}</td>
                        <td>${row.proyek_input || '-'}</td>
                        <td><span style="${statusStyle}">${row.status || '-'}</span></td>
                    </tr>
                `;
            }).join('');
        } else {
            console.log('ℹ️ No order data found');
            tbody.innerHTML = '<tr><td colspan="15" class="text-center">Tidak ada data order</td></tr>';
        }
    } catch (err) {
        console.error('❌ Error loading rekap order:', err);
        tbody.innerHTML = `<tr><td colspan="15" class="text-center" style="color: red;">Error: ${err.message}</td></tr>`;
    }
}

function resetFilterOrder() {
    console.log('🔄 Resetting Order filters...');
    document.getElementById('filter-tanggal-type-order').value = 'semua';
    document.getElementById('filter-tanggal-dari-order').value = '';
    document.getElementById('filter-tanggal-sampai-order').value = '';
    document.getElementById('filter-proyek-order').value = '';
    document.getElementById('filter-status-order').value = '';
    document.getElementById('filter-kendaraan-order').value = '';
    document.getElementById('filter-kendaraan-order-id').value = '';
    document.getElementById('filter-supir-order').value = '';
    document.getElementById('filter-supir-order-id').value = '';
    document.getElementById('filter-galian-order').value = '';
    document.getElementById('filter-galian-order-id').value = '';
    document.getElementById('date-range-order').classList.remove('show');
    loadRekapOrder();
}

// ============================================================================
// REKAP BUANGAN
// ============================================================================
async function loadRekapBuangan() {
    const tbody = document.getElementById('tbody-buangan');
    tbody.innerHTML = '<tr><td colspan="12" class="text-center loading">Memuat data...</td></tr>';

    try {
        const params = new URLSearchParams();
        
        const filters = {
            tanggal_dari: document.getElementById('filter-tanggal-dari-buangan').value,
            tanggal_sampai: document.getElementById('filter-tanggal-sampai-buangan').value,
            no_order: document.getElementById('filter-no-order').value.trim(),
            alihan: document.getElementById('filter-alihan').value
        };

        Object.keys(filters).forEach(key => {
            const value = filters[key];
            if (value && value !== '') {
                params.append(key, value);
            }
        });

        const url = `${API_URL}/rekap/buangan${params.toString() ? '?' + params.toString() : ''}`;
        debugLog('Loading Rekap Buangan', {
            url: url,
            filters: filters
        });
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        debugLog('Rekap Buangan Response', result);

        let data = null;
        
        if (result && result.success === true && result.data) {
            console.log('✓ Using result.data structure');
            data = result.data;
        } else if (Array.isArray(result)) {
            console.log('✓ Result is directly an array');
            data = result;
        } else if (result && Array.isArray(result.rows)) {
            console.log('✓ Using result.rows structure');
            data = result.rows;
        } else if (result && Array.isArray(result.data)) {
            console.log('✓ Using result.data (no success check)');
            data = result.data;
        }

        console.log('Extracted buangan data:', data);
        console.log('Data is array?', Array.isArray(data));
        console.log('Data length:', data ? data.length : 0);

        if (data && Array.isArray(data) && data.length > 0) {
            console.log(`✅ Displaying ${data.length} buangan records`);
            tbody.innerHTML = data.map((row, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${formatDate(row.tanggal_order)}</td>
                    <td>${row.no_order || '-'}</td>
                    <td>${formatDate(row.tanggal_bongkar)}</td>
                    <td>${row.jam_bongkar || '-'}</td>
                    <td>${formatKilometer(row.km_akhir)}</td>
                    <td>${formatKilometer(row.jarak_km)}</td>
                    <td>${row.alihan ? 'Ya' : 'Tidak'}</td>
                    <td>${row.galian_alihan_nama || '-'}</td>
                    <td>${row.keterangan || '-'}</td>
                    <td>${formatCurrency(row.uang_alihan)}</td>
                    <td>${row.no_urut || '-'}</td>
                </tr>
            `).join('');
        } else {
            console.log('ℹ️ No buangan data found');
            tbody.innerHTML = '<tr><td colspan="12" class="text-center">Tidak ada data buangan</td></tr>';
        }
    } catch (err) {
        console.error('❌ Error loading rekap buangan:', err);
        tbody.innerHTML = `<tr><td colspan="12" class="text-center" style="color: red;">Error: ${err.message}</td></tr>`;
    }
}

function resetFilterBuangan() {
    console.log('🔄 Resetting Buangan filters...');
    document.getElementById('filter-tanggal-type-buangan').value = 'semua';
    document.getElementById('filter-tanggal-dari-buangan').value = '';
    document.getElementById('filter-tanggal-sampai-buangan').value = '';
    document.getElementById('filter-no-order').value = '';
    document.getElementById('filter-alihan').value = '';
    document.getElementById('date-range-buangan').classList.remove('show');
    loadRekapBuangan();
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================
async function exportToExcel(type) {
    try {
        let endpoint = '';
        let params = new URLSearchParams();

        if (type === 'order') {
            endpoint = '/rekap/order/export/excel';
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-order').value,
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-order').value,
                proyek_input: document.getElementById('filter-proyek-order').value,
                status: document.getElementById('filter-status-order').value,
                kendaraan_id: document.getElementById('filter-kendaraan-order-id').value,
                supir_id: document.getElementById('filter-supir-order-id').value,
                galian_id: document.getElementById('filter-galian-order-id').value
            };
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
        } else if (type === 'buangan') {
            endpoint = '/rekap/buangan/export/excel';
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-buangan').value,
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-buangan').value,
                no_order: document.getElementById('filter-no-order').value
            };
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
        }

        const url = `${API_URL}${endpoint}?${params}`;
        console.log('📥 Exporting to Excel:', url);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `rekap_${type}_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        alert('✅ Export Excel berhasil!');
    } catch (err) {
        console.error('❌ Error exporting to Excel:', err);
        alert('❌ Gagal export Excel: ' + err.message);
    }
}

async function exportToPDF(type) {
    try {
        let endpoint = '';
        let params = new URLSearchParams();

        if (type === 'order') {
            endpoint = '/rekap/order/export/pdf';
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-order').value,
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-order').value,
                proyek_input: document.getElementById('filter-proyek-order').value,
                status: document.getElementById('filter-status-order').value,
                kendaraan_id: document.getElementById('filter-kendaraan-order-id').value,
                supir_id: document.getElementById('filter-supir-order-id').value,
                galian_id: document.getElementById('filter-galian-order-id').value
            };
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
        } else if (type === 'buangan') {
            endpoint = '/rekap/buangan/export/pdf';
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-buangan').value,
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-buangan').value,
                no_order: document.getElementById('filter-no-order').value
            };
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
        }

        const url = `${API_URL}${endpoint}?${params}`;
        console.log('📄 Exporting to PDF:', url);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `rekap_${type}_${new Date().getTime()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        alert('✅ Export PDF berhasil!');
    } catch (err) {
        console.error('❌ Error exporting to PDF:', err);
        alert('❌ Gagal export PDF: ' + err.message);
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function formatCurrency(value) {
    if (!value || value === 0) return 'Rp 0';
    return 'Rp ' + parseInt(value).toLocaleString('id-ID');
}

function formatKilometer(value) {
    if (!value || value === 0) return '0';
    return parseInt(value).toLocaleString('id-ID');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (err) {
        return '-';
    }
}

// ============================================================================
// INITIALIZE ON PAGE LOAD
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    debugLog('Page Initialization', 'Starting...');
    
    console.log('1️⃣ Loading master data...');
    await loadMasterData();
    
    console.log('\n2️⃣ Loading initial order data...');
    await loadRekapOrder();
    
    console.log('\n✅ Initialization complete!\n');
});