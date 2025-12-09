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

// Toggle untuk date range order gabungan
function toggleDateRangeOrderGabungan() {
    const filterType = document.getElementById('filter-tanggal-type-gabungan').value;
    const dateRangeDiv = document.getElementById('date-range-order-gabungan');
    const dariInput = document.getElementById('filter-tanggal-order-dari-gabungan');
    const sampaiInput = document.getElementById('filter-tanggal-order-sampai-gabungan');
    
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

// Toggle untuk date range bongkar gabungan
function toggleDateRangeBongkarGabungan() {
    const filterType = document.getElementById('filter-tanggal-bongkar-type-gabungan').value;
    const dateRangeDiv = document.getElementById('date-range-bongkar-gabungan');
    const dariInput = document.getElementById('filter-tanggal-bongkar-dari-gabungan');
    const sampaiInput = document.getElementById('filter-tanggal-bongkar-sampai-gabungan');
    
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

function toggleDateRangeGabungan() {
    const filterType = document.getElementById('filter-tanggal-type-gabungan').value;
    const dateRangeDiv = document.getElementById('date-range-gabungan');
    const dariInput = document.getElementById('filter-tanggal-dari-gabungan');
    const sampaiInput = document.getElementById('filter-tanggal-sampai-gabungan');
    
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

function toggleGalianAlihanFilter() {
    const alihanSelect = document.getElementById('filter-alihan-gabungan');
    const galianAlihanDiv = document.getElementById('galian-alihan-filter-gabungan');
    const galianAlihanInput = document.getElementById('filter-galian-alihan-gabungan');
    const galianAlihanIdInput = document.getElementById('filter-galian-alihan-gabungan-id');
    
    if (alihanSelect.value === '1') {
        // Show galian alihan filter and load used galian only
        galianAlihanDiv.classList.add('show');
        loadUsedGalianAlihan();
    } else {
        // Hide and clear
        galianAlihanDiv.classList.remove('show');
        galianAlihanInput.value = '';
        galianAlihanIdInput.value = '';
        // Clear the datalist
        const datalist = document.getElementById('datalist-galian-alihan-gabungan');
        if (datalist) datalist.innerHTML = '';
    }
}

async function loadUsedGalianAlihan() {
    try {
        const url = `${API_URL}/rekap/galian-alihan-used`;
        console.log('📡 Fetching Used Galian Alihan:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        debugLog('Used Galian Alihan Response', result);
        
        let data = null;
        if (result && result.success && Array.isArray(result.data)) {
            data = result.data;
        } else if (Array.isArray(result)) {
            data = result;
        } else if (result && Array.isArray(result.rows)) {
            data = result.rows;
        }
        
        if (data && Array.isArray(data) && data.length > 0) {
            console.log(`✅ Loaded ${data.length} used galian alihan records`);
            populateDatalist('datalist-galian-alihan-gabungan', data, 'nama_galian');
        } else {
            console.warn('⚠️ No used galian alihan found');
            const datalist = document.getElementById('datalist-galian-alihan-gabungan');
            if (datalist) datalist.innerHTML = '<option value="">Tidak ada galian alihan yang digunakan</option>';
        }
    } catch (err) {
        console.error('❌ Error loading used galian alihan:', err.message);
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
            // TAMBAHKAN INI - Load data for gabungan tab
            if (tabName === 'gabungan') {
                loadRekapGabungan();
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

    // === GABUNGAN AUTOCOMPLETE ===
    const kendaraanGabunganInput = document.getElementById('filter-kendaraan-gabungan');
    if (kendaraanGabunganInput) {
        kendaraanGabunganInput.addEventListener('input', function() {
            filterDatalist(this.value, masterKendaraan, 'datalist-kendaraan-gabungan', 'no_pintu');
        });

        kendaraanGabunganInput.addEventListener('change', function() {
            const selectedItem = masterKendaraan.find(k => k.no_pintu === this.value);
            if (selectedItem) {
                document.getElementById('filter-kendaraan-gabungan-id').value = selectedItem.id;
                console.log('Kendaraan (Gabungan) terpilih:', selectedItem);
            } else {
                document.getElementById('filter-kendaraan-gabungan-id').value = '';
            }
        });
    }

    const galianGabunganInput = document.getElementById('filter-galian-gabungan');
    if (galianGabunganInput) {
        galianGabunganInput.addEventListener('input', function() {
            filterDatalist(this.value, masterGalian, 'datalist-galian-gabungan', 'nama_galian');
        });

        galianGabunganInput.addEventListener('change', function() {
            const selectedItem = masterGalian.find(g => g.nama_galian === this.value);
            if (selectedItem) {
                document.getElementById('filter-galian-gabungan-id').value = selectedItem.id;
                console.log('Galian (Gabungan) terpilih:', selectedItem);
            } else {
                document.getElementById('filter-galian-gabungan-id').value = '';
            }
        });
    }

    // Real-time search untuk proyek gabungan
    const proyekGabunganInput = document.getElementById('filter-proyek-gabungan');
    if (proyekGabunganInput) {
        let typingTimer;
        const typingDelay = 500;

        proyekGabunganInput.addEventListener('input', () => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                loadRekapGabungan();
            }, typingDelay);
        });
    }

    // Galian Alihan autocomplete untuk gabungan
    const galianAlihanGabunganInput = document.getElementById('filter-galian-alihan-gabungan');
    if (galianAlihanGabunganInput) {
        galianAlihanGabunganInput.addEventListener('input', function() {
            filterDatalist(this.value, masterGalian, 'datalist-galian-alihan-gabungan', 'nama_galian');
        });

        galianAlihanGabunganInput.addEventListener('change', function() {
            const selectedItem = masterGalian.find(g => g.nama_galian === this.value);
            if (selectedItem) {
                document.getElementById('filter-galian-alihan-gabungan-id').value = selectedItem.id;
                console.log('Galian Alihan (Gabungan) terpilih:', selectedItem);
            } else {
                document.getElementById('filter-galian-alihan-gabungan-id').value = '';
            }
        });
    }

    // Real-time search untuk lokasi bongkar gabungan
    const lokasiBongkarGabunganInput = document.getElementById('filter-lokasi-bongkar-gabungan');
    if (lokasiBongkarGabunganInput) {
        let typingTimer;
        const typingDelay = 500;

        lokasiBongkarGabunganInput.addEventListener('input', () => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                loadRekapGabungan();
            }, typingDelay);
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

    // TAMBAHKAN INI:
    // Populate datalist untuk gabungan
    if (masterKendaraan.length > 0) {
        populateDatalist('datalist-kendaraan-gabungan', masterKendaraan, 'no_pintu');
    }
    if (masterGalian.length > 0) {
        populateDatalist('datalist-galian-gabungan', masterGalian, 'nama_galian');
    }
    // Populate datalist untuk gabungan
    if (masterKendaraan.length > 0) {
        populateDatalist('datalist-kendaraan-gabungan', masterKendaraan, 'no_pintu');
    }
    if (masterGalian.length > 0) {
        populateDatalist('datalist-galian-gabungan', masterGalian, 'nama_galian');
        populateDatalist('datalist-galian-alihan-gabungan', masterGalian, 'nama_galian'); // TAMBAHKAN BARIS INI
    }

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
    tbody.innerHTML = '<tr><td colspan="17" class="text-center loading">Memuat data...</td></tr>';

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

            // Calculate totals
            let totalUangJalan = 0;
            let totalPotongan = 0;
            let totalHasilAkhir = 0;

            data.forEach(row => {
                totalUangJalan += parseFloat(row.uang_jalan || 0);
                totalPotongan += parseFloat(row.potongan || 0);
                totalHasilAkhir += parseFloat(row.hasil_akhir || 0);
            });

            tbody.innerHTML = data.map((row, index) => {
                let statusStyle = '';
                const status = (row.status || '').toUpperCase();
                if (status === 'COMPLETE') {
                    statusStyle = 'background: #28a745; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                } else if (status === 'ON PROCESS' || status === 'ON_PROCESS') {
                    statusStyle = 'background: #ffc107; color: #000; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                } else if (status === 'BATAL') {
                    statusStyle = 'background: #dc3545; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                } else {
                    statusStyle = 'background: #6c757d; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                }

                const isComplete = (row.status || '').toUpperCase() === 'COMPLETE';
                const actionButton = isComplete ?
                    `<button class="btn btn-info btn-sm" onclick="showOrderDetail(${row.id})">Detail</button>` :
                    '-';

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
                        <td>${row.keterangan_buangan || '-'}</td>
                        <td><span style="${statusStyle}">${row.status || '-'}</span></td>
                        <td>${actionButton}</td>
                    </tr>
                `;
            }).join('');

            // Display summary for Order
            displayOrderSummary(totalUangJalan, totalPotongan, totalHasilAkhir);
        } else {
            console.log('ℹ️ No order data found');
            tbody.innerHTML = '<tr><td colspan="17" class="text-center">Tidak ada data order</td></tr>';
            // Clear summary when no data
            const summaryDiv = document.getElementById('summary-order');
            if (summaryDiv) summaryDiv.innerHTML = '';
        }
    } catch (err) {
        console.error('❌ Error loading rekap order:', err);
        tbody.innerHTML = `<tr><td colspan="17" class="text-center" style="color: red;">Error: ${err.message}</td></tr>`;
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

            // Calculate totals
            let totalUangAlihan = 0;

            data.forEach(row => {
                totalUangAlihan += parseFloat(row.uang_alihan || 0);
            });

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

            // Display summary for Buangan
            displayBuanganSummary(totalUangAlihan);
        } else {
            console.log('ℹ️ No buangan data found');
            tbody.innerHTML = '<tr><td colspan="12" class="text-center">Tidak ada data buangan</td></tr>';
            // Clear summary when no data
            const summaryDiv = document.getElementById('summary-buangan');
            if (summaryDiv) summaryDiv.innerHTML = '';
        }
    } catch (err) {
        console.error('❌ Error loading rekap buangan:', err);
        tbody.innerHTML = `<tr><td colspan="12" class="text-center" style="color: red;">Error: ${err.message}</td></tr>`;
    }
}

// ============================================================================
// REKAP GABUNGAN
// ============================================================================
async function loadRekapGabungan() {
    const tbody = document.getElementById('tbody-gabungan');
    tbody.innerHTML = '<tr><td colspan="22" class="text-center loading">Memuat data...</td></tr>';

    try {
        const params = new URLSearchParams();

        const filters = {
            tanggal_order_dari: document.getElementById('filter-tanggal-order-dari-gabungan').value,
            tanggal_order_sampai: document.getElementById('filter-tanggal-order-sampai-gabungan').value,
            tanggal_bongkar_dari: document.getElementById('filter-tanggal-bongkar-dari-gabungan').value,
            tanggal_bongkar_sampai: document.getElementById('filter-tanggal-bongkar-sampai-gabungan').value,
            proyek_input: document.getElementById('filter-proyek-gabungan').value.trim(),
            lokasi_bongkar: document.getElementById('filter-lokasi-bongkar-gabungan').value.trim(),
            status: document.getElementById('filter-status-gabungan').value,
            kendaraan_id: document.getElementById('filter-kendaraan-gabungan-id').value,
            galian_id: document.getElementById('filter-galian-gabungan-id').value,
            alihan: document.getElementById('filter-alihan-gabungan').value,
            galian_alihan_id: document.getElementById('filter-galian-alihan-gabungan-id').value
        };

        Object.keys(filters).forEach(key => {
            const value = filters[key];
            if (value && value !== '' && value !== '0') {
                params.append(key, value);
            }
        });

        const url = `${API_URL}/rekap/gabungan${params.toString() ? '?' + params.toString() : ''}`;
        debugLog('Loading Rekap Gabungan', {
            url: url,
            filters: filters
        });

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        debugLog('Rekap Gabungan Response', result);

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

        console.log('Extracted gabungan data:', data);
        console.log('Data is array?', Array.isArray(data));
        console.log('Data length:', data ? data.length : 0);

        if (data && Array.isArray(data) && data.length > 0) {
            console.log(`✅ Displaying ${data.length} gabungan records`);

            // Calculate totals
            let totalUangJalan = 0;
            let totalPotongan = 0;
            let totalUangAlihan = 0;

            data.forEach(row => {
                totalUangJalan += parseFloat(row.uang_jalan || 0);
                totalPotongan += parseFloat(row.potongan || 0);
                totalUangAlihan += parseFloat(row.uang_alihan || 0);
            });

            const grandTotal = totalUangJalan - totalPotongan;

            tbody.innerHTML = data.map((row, index) => {
                let statusStyle = '';
                const status = (row.status || '').toUpperCase();
                if (status === 'COMPLETE') {
                    statusStyle = 'background: #28a745; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                } else if (status === 'ON PROCESS' || status === 'ON_PROCESS') {
                    statusStyle = 'background: #ffc107; color: #000; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                } else if (status === 'BATAL') {
                    statusStyle = 'background: #dc3545; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                } else {
                    statusStyle = 'background: #6c757d; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                }

                const total = (parseFloat(row.uang_jalan || 0) - parseFloat(row.potongan || 0));

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${formatDate(row.tanggal_order)}</td>
                        <td>${row.petugas_order || '-'}</td>
                        <td>${row.galian || '-'}</td>
                        <td>${row.galian_alihan || '-'}</td>
                        <td>${row.no_do || '-'}</td>
                        <td>${row.kendaraan || '-'}</td>
                        <td>${row.supir || '-'}</td>
                        <td>${row.jam_order || '-'}</td>
                        <td>${formatKilometer(row.km_awal)}</td>
                        <td>${formatDate(row.tanggal_bongkar)}</td>
                        <td>${row.jam_bongkar || '-'}</td>
                        <td>${formatKilometer(row.km_akhir)}</td>
                        <td>${formatKilometer(row.jarak_km)}</td>
                        <td>${formatCurrency(row.uang_jalan)}</td>
                        <td>${formatCurrency(row.potongan)}</td>
                        <td>${formatCurrency(total)}</td>
                        <td>${row.proyek || '-'}</td>
                        <td>${row.lokasi_bongkar || '-'}</td>
                        <td>${formatCurrency(row.uang_alihan)}</td>
                        <td>${row.keterangan || '-'}</td>
                        <td><span style="${statusStyle}">${row.status || '-'}</span></td>
                    </tr>
                `;
            }).join('');

            // Display summary for Gabungan
            displayGabunganSummary(totalUangJalan, totalPotongan, grandTotal, totalUangAlihan);
        } else {
            console.log('ℹ️ No gabungan data found');
            tbody.innerHTML = '<tr><td colspan="22" class="text-center">Tidak ada data gabungan</td></tr>';
            // Clear summary when no data
            const summaryDiv = document.getElementById('summary-gabungan');
            if (summaryDiv) summaryDiv.innerHTML = '';
        }
    } catch (err) {
        console.error('❌ Error loading rekap gabungan:', err);
        tbody.innerHTML = `<tr><td colspan="22" class="text-center" style="color: red;">Error: ${err.message}</td></tr>`;
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

function resetFilterGabungan() {
    console.log('🔄 Resetting Gabungan filters...');
    document.getElementById('filter-tanggal-type-gabungan').value = 'semua';
    document.getElementById('filter-tanggal-order-dari-gabungan').value = '';
    document.getElementById('filter-tanggal-order-sampai-gabungan').value = '';
    document.getElementById('filter-tanggal-bongkar-type-gabungan').value = 'semua';
    document.getElementById('filter-tanggal-bongkar-dari-gabungan').value = '';
    document.getElementById('filter-tanggal-bongkar-sampai-gabungan').value = '';
    document.getElementById('filter-proyek-gabungan').value = '';
    document.getElementById('filter-lokasi-bongkar-gabungan').value = '';
    document.getElementById('filter-status-gabungan').value = '';
    document.getElementById('filter-kendaraan-gabungan').value = '';
    document.getElementById('filter-kendaraan-gabungan-id').value = '';
    document.getElementById('filter-galian-gabungan').value = '';
    document.getElementById('filter-galian-gabungan-id').value = '';
    document.getElementById('filter-alihan-gabungan').value = '';
    document.getElementById('filter-galian-alihan-gabungan').value = '';
    document.getElementById('filter-galian-alihan-gabungan-id').value = '';
    document.getElementById('date-range-order-gabungan').classList.remove('show');
    document.getElementById('date-range-bongkar-gabungan').classList.remove('show');
    document.getElementById('galian-alihan-filter-gabungan').classList.remove('show');
    loadRekapGabungan();
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
        } else if (type === 'gabungan') {
            endpoint = '/rekap/gabungan/export/excel';
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-gabungan').value,
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-gabungan').value,
                proyek_input: document.getElementById('filter-proyek-gabungan').value,
                status: document.getElementById('filter-status-gabungan').value,
                kendaraan_id: document.getElementById('filter-kendaraan-gabungan-id').value,
                galian_id: document.getElementById('filter-galian-gabungan-id').value
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
        } else if (type === 'gabungan') {
            endpoint = '/rekap/gabungan/export/pdf';
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-gabungan').value,
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-gabungan').value,
                proyek_input: document.getElementById('filter-proyek-gabungan').value,
                status: document.getElementById('filter-status-gabungan').value,
                kendaraan_id: document.getElementById('filter-kendaraan-gabungan-id').value,
                galian_id: document.getElementById('filter-galian-gabungan-id').value
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
// ORDER DETAIL MODAL FUNCTIONS
// ============================================================================
async function showOrderDetail(orderId) {
    try {
        console.log('📋 Showing order detail for ID:', orderId);

        // Show modal
        const modal = document.getElementById('order-detail-modal');
        modal.style.display = 'block';

        // Load order data
        const orderResponse = await fetch(`${API_URL}/rekap/order/${orderId}`);
        if (!orderResponse.ok) {
            throw new Error(`Failed to fetch order: ${orderResponse.status}`);
        }
        const orderResult = await orderResponse.json();
        
        console.log('Order API Response:', orderResult);
        
        // Handle different response structures
        let orderData = null;
        if (orderResult.data) {
            orderData = Array.isArray(orderResult.data) 
                ? orderResult.data[0]
                : orderResult.data;
        } else if (orderResult.success && orderResult.order) {
            orderData = orderResult.order;
        } else if (Array.isArray(orderResult)) {
            orderData = orderResult[0];
        }
        
        if (!orderData) {
            throw new Error('Order data not found');
        }

        console.log('Extracted order data:', orderData);

        // Load buangan data untuk order ini
        const buanganResponse = await fetch(`${API_URL}/rekap/buangan/by-order/${orderId}`);
        if (!buanganResponse.ok) {
            throw new Error(`Failed to fetch buangan: ${buanganResponse.status}`);
        }
        const buanganResult = await buanganResponse.json();
        
        console.log('Buangan API Response:', buanganResult);
        
        // Normalize buangan array
        let buanganData = [];
        if (buanganResult.data) {
            buanganData = Array.isArray(buanganResult.data) ? buanganResult.data : [buanganResult.data];
        } else if (Array.isArray(buanganResult)) {
            buanganData = buanganResult;
        }

        console.log('Extracted buangan data:', buanganData);
        console.log('Buangan count:', buanganData.length);

        // Populate order info
        populateOrderInfo(orderData);

        // Populate buangan cards
        const container = document.getElementById('buangan-cards');
        if (buanganData.length > 0) {
            container.innerHTML = '';
            buanganData.forEach(buangan => {
                populateBuanganCard(buangan, orderData, container);
            });
        } else {
            container.innerHTML = '<p class="no-data">Tidak ada data buangan untuk order ini</p>';
        }

        // Setup modal close event
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };

        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

    } catch (err) {
        console.error('❌ Error showing order detail:', err);
        alert('❌ Gagal memuat detail order: ' + err.message);
    }
}

function populateBuanganCard(buangan, orderData, container) {
    if (!buangan) return;

    const card = document.createElement('div');
    card.className = 'buangan-card';
    card.innerHTML = `
        <div class="card-header">
            <h4>No. Urut ${buangan.no_urut || '1'}</h4>
            <span class="card-proyek">${orderData.proyek_input || '-'}</span>
            <span class="card-date">${formatDate(buangan.tanggal_bongkar)}</span>
        </div>
        <div class="card-body">
            <div class="card-row">
                <span class="label">Tanggal Bongkar:</span>
                <span class="value">${formatDate(buangan.tanggal_bongkar)}</span>
            </div>
            <div class="card-row">
                <span class="label">Jam Bongkar:</span>
                <span class="value">${buangan.jam_bongkar || '-'}</span>
            </div>
            <div class="card-row">
                <span class="label">Lokasi Bongkar:</span>
                <span class="value">${buangan.lokasi_bongkar || '-'}</span>
            </div>
            <div class="card-row">
                <span class="label">KM Akhir:</span>
                <span class="value">${formatKilometer(buangan.km_akhir)}</span>
            </div>
            <div class="card-row">
                <span class="label">Jarak KM:</span>
                <span class="value">${formatKilometer(buangan.jarak_km)}</span>
            </div>
            <div class="card-row">
                <span class="label">Alihan:</span>
                <span class="value">${buangan.alihan ? 'Ya' : 'Tidak'}</span>
            </div>
            ${buangan.alihan ? `
                <div class="card-row">
                    <span class="label">Galian Alihan:</span>
                    <span class="value">${buangan.galian_alihan_nama || '-'}</span>
                </div>
                <div class="card-row">
                    <span class="label">Uang Alihan:</span>
                    <span class="value">${formatCurrency(buangan.uang_alihan)}</span>
                </div>
            ` : ''}
            ${buangan.keterangan ? `
                <div class="card-row">
                    <span class="label">Keterangan:</span>
                    <span class="value">${buangan.keterangan}</span>
                </div>
            ` : ''}
        </div>
    `;
    container.appendChild(card);
}

function populateOrderInfo(orderData) {
    const grid = document.getElementById('order-info-grid');
    grid.innerHTML = '';

    const infoItems = [
        { label: 'No Order', value: orderData.no_order || '-' },
        { label: 'Tanggal Order', value: formatDate(orderData.tanggal_order) },
        { label: 'Petugas', value: orderData.petugas_order || '-' },
        { label: 'Kendaraan', value: orderData.kendaraan_nama || orderData.no_pintu || '-' },
        { label: 'Supir', value: orderData.supir_nama || '-' },
        { label: 'Galian', value: orderData.galian_nama || '-' },
        { label: 'No DO', value: orderData.no_do || '-' },
        { label: 'Jam Order', value: orderData.jam_order || '-' },
        { label: 'KM Awal', value: formatKilometer(orderData.km_awal) },
        { label: 'Uang Jalan', value: formatCurrency(orderData.uang_jalan) },
        { label: 'Potongan', value: formatCurrency(orderData.potongan) },
        { label: 'Hasil Akhir', value: formatCurrency(orderData.hasil_akhir) },
        { label: 'Proyek', value: orderData.proyek_input || '-' },
        { label: 'Status', value: orderData.status || '-' }
    ];

    infoItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'info-item';
        div.innerHTML = `
            <strong>${item.label}:</strong> ${item.value}
        `;
        grid.appendChild(div);
    });
}
function populateOrderInfo(orderData) {
    const grid = document.getElementById('order-info-grid');
    grid.innerHTML = '';

    const infoItems = [
        { label: 'No Order', value: orderData.no_order || '-' },
        { label: 'Tanggal Order', value: formatDate(orderData.tanggal_order) },
        { label: 'Petugas', value: orderData.petugas_order || '-' },
        { label: 'Kendaraan', value: orderData.kendaraan_nama || orderData.no_pintu || '-' },
        { label: 'Supir', value: orderData.supir_nama || '-' },
        { label: 'Galian', value: orderData.galian_nama || '-' },
        { label: 'No DO', value: orderData.no_do || '-' },
        { label: 'Jam Order', value: orderData.jam_order || '-' },
        { label: 'KM Awal', value: formatKilometer(orderData.km_awal) },
        { label: 'Uang Jalan', value: formatCurrency(orderData.uang_jalan) },
        { label: 'Potongan', value: formatCurrency(orderData.potongan) },
        { label: 'Hasil Akhir', value: formatCurrency(orderData.hasil_akhir) },
        { label: 'Proyek', value: orderData.proyek_input || '-' },
        { label: 'Status', value: orderData.status || '-' }
    ];

    infoItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'info-item';
        div.innerHTML = `
            <strong>${item.label}:</strong> ${item.value}
        `;
        grid.appendChild(div);
    });
}


// ============================================================================
// SUMMARY DISPLAY FUNCTIONS
// ============================================================================
function displayOrderSummary(totalUangJalan, totalPotongan, totalHasilAkhir) {
    const summaryDiv = document.getElementById('summary-order');
    if (!summaryDiv) return;

    const grandTotal = totalHasilAkhir;

    summaryDiv.innerHTML = `
        <div class="summary-section">
            <div class="summary-title">📊 Ringkasan Order</div>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Total Uang Jalan:</span>
                    <span class="value">${formatCurrency(totalUangJalan)}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Potongan:</span>
                    <span class="value">${formatCurrency(totalPotongan)}</span>
                </div>
                <div class="summary-item grand-total">
                    <span class="label">Grand Total:</span>
                    <span class="value">${formatCurrency(grandTotal)}</span>
                </div>
            </div>
        </div>
    `;
}

function displayBuanganSummary(totalUangAlihan) {
    const summaryDiv = document.getElementById('summary-buangan');
    if (!summaryDiv) return;

    summaryDiv.innerHTML = `
        <div class="summary-section">
            <div class="summary-title">📊 Ringkasan Buangan</div>
            <div class="summary-grid">
                <div class="summary-item grand-total">
                    <span class="label">Total Uang Alihan:</span>
                    <span class="value">${formatCurrency(totalUangAlihan)}</span>
                </div>
            </div>
        </div>
    `;
}

function displayGabunganSummary(totalUangJalan, totalPotongan, grandTotal, totalUangAlihan) {
    const summaryDiv = document.getElementById('summary-gabungan');
    if (!summaryDiv) return;

    summaryDiv.innerHTML = `
        <div class="summary-section">
            <div class="summary-title">📊 Ringkasan Gabungan</div>
            <div class="summary-grid-custom">
                <div class="summary-row-top">
                    <div class="summary-item">
                        <span class="label">Total Uang Jalan:</span>
                        <span class="value">${formatCurrency(totalUangJalan)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Potongan:</span>
                        <span class="value">${formatCurrency(totalPotongan)}</span>
                    </div>
                </div>
                <div class="summary-item grand-total">
                    <span class="label">Grand Total (Uang Jalan - Potongan):</span>
                    <span class="value">${formatCurrency(grandTotal)}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Uang Alihan:</span>
                    <span class="value">${formatCurrency(totalUangAlihan)}</span>
                </div>
            </div>
        </div>
    `;
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function formatCurrency(value) {
    if (!value || value === 0) return 'Rp 0';
    return 'Rp ' + parseInt(value).toLocaleString('id-ID');
}

function formatKilometer(value) {
    // Handle ODO ERROR
    if (typeof value === 'string' && 
        (value.toUpperCase() === 'ODO ERROR' || 
         value.toUpperCase() === 'ODOERROR' ||
         value.toUpperCase() === 'ODO ERR' ||
         value.toUpperCase() === 'ODOERR')) {
        return 'ODO ERROR';
    }
    
    if (!value || value === 0) return '0';
    
    // Handle numeric values
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '0';
    
    return numValue.toLocaleString('id-ID');
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