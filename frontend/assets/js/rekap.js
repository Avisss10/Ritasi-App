// API Base URL
const API_URL = 'http://localhost:3000/api';

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

// Test connection dengan error details
async function testConnection() {
    debugLog('Testing API Connection', `URL: ${API_URL}/rekap/order`);
    
    try {
        const response = await fetch(`${API_URL}/rekap/order`);
        debugLog('Response Status', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        const text = await response.text();
        debugLog('Raw Response Text', text);
        
        try {
            const json = JSON.parse(text);
            debugLog('Parsed JSON', json);
            return json;
        } catch (e) {
            console.error('❌ JSON Parse Error:', e.message);
            return null;
        }
    } catch (err) {
        console.error('❌ Connection Error:', err.message);
        return null;
    }
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// ============================================================================
// LOAD MASTER DATA FOR DROPDOWNS
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
        
        // Extract data array from various response structures
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
            console.log(`✅ Found ${data.length} kendaraan records`);
            populateDropdown('filter-kendaraan-order', data, 'id', 'no_pintu');
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
            console.log(`✅ Found ${data.length} supir records`);
            populateDropdown('filter-supir-order', data, 'id', 'nama');
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
            console.log(`✅ Found ${data.length} galian records`);
            populateDropdown('filter-galian-order', data, 'id', 'nama_galian');
        } else {
            console.error('❌ Galian: Invalid data structure');
        }
    } catch (err) {
        console.error('❌ Error loading galian:', err.message);
    }
}

function populateDropdown(elementId, data, valueKey, textKey) {
    const select = document.getElementById(elementId);
    if (!select) {
        console.error(`❌ Element #${elementId} not found`);
        return;
    }
    
    const placeholderText = select.options[0]?.text || '-- Pilih --';
    select.innerHTML = `<option value="">${placeholderText}</option>`;
    
    if (!Array.isArray(data) || data.length === 0) {
        console.warn(`⚠️ No data to populate for #${elementId}`);
        return;
    }
    
    let successCount = 0;
    data.forEach((item, index) => {
        if (item[valueKey] !== undefined && item[textKey] !== undefined) {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = item[textKey];
            select.appendChild(option);
            successCount++;
        } else {
            console.warn(`⚠️ Item ${index} missing keys:`, item);
        }
    });
    
    console.log(`✅ Populated #${elementId}: ${successCount}/${data.length} items`);
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
            petugas_order: document.getElementById('filter-petugas-order').value.trim(),
            kendaraan_id: document.getElementById('filter-kendaraan-order').value,
            supir_id: document.getElementById('filter-supir-order').value,
            galian_id: document.getElementById('filter-galian-order').value
        };

        // Only add non-empty filters
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

        // Extract data from response
        let data = null;
        
        // Check if result has success field with data array
        if (result && result.success === true && result.data) {
            console.log('✓ Using result.data structure');
            data = result.data;
        }
        // Check if result itself is an array
        else if (Array.isArray(result)) {
            console.log('✓ Result is directly an array');
            data = result;
        }
        // Check if result has rows property
        else if (result && Array.isArray(result.rows)) {
            console.log('✓ Using result.rows structure');
            data = result.rows;
        }
        // Check if result.data exists but success is not checked
        else if (result && Array.isArray(result.data)) {
            console.log('✓ Using result.data (no success check)');
            data = result.data;
        }

        console.log('Extracted data:', data);
        console.log('Data is array?', Array.isArray(data));
        console.log('Data length:', data ? data.length : 0);

        if (data && Array.isArray(data) && data.length > 0) {
            console.log(`✅ Displaying ${data.length} order records`);
            tbody.innerHTML = data.map((row, index) => {
                // Determine status color
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
                        <td>${row.km_awal || 0}</td>
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
    document.getElementById('filter-tanggal-dari-order').value = '';
    document.getElementById('filter-tanggal-sampai-order').value = '';
    document.getElementById('filter-proyek-order').value = '';
    document.getElementById('filter-petugas-order').value = '';
    document.getElementById('filter-kendaraan-order').value = '';
    document.getElementById('filter-supir-order').value = '';
    document.getElementById('filter-galian-order').value = '';
    loadRekapOrder();
}

// ============================================================================
// REKAP BUANGAN
// ============================================================================
async function loadRekapBuangan() {
    const tbody = document.getElementById('tbody-buangan');
    tbody.innerHTML = '<tr><td colspan="11" class="text-center loading">Memuat data...</td></tr>';

    try {
        const params = new URLSearchParams();
        
        const filters = {
            tanggal_dari: document.getElementById('filter-tanggal-dari-buangan').value,
            tanggal_sampai: document.getElementById('filter-tanggal-sampai-buangan').value,
            order_id: document.getElementById('filter-order-id').value.trim()
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

        // Extract data from response
        let data = null;
        
        // Check if result has success field with data array
        if (result && result.success === true && result.data) {
            console.log('✓ Using result.data structure');
            data = result.data;
        }
        // Check if result itself is an array
        else if (Array.isArray(result)) {
            console.log('✓ Result is directly an array');
            data = result;
        }
        // Check if result has rows property
        else if (result && Array.isArray(result.rows)) {
            console.log('✓ Using result.rows structure');
            data = result.rows;
        }
        // Check if result.data exists but success is not checked
        else if (result && Array.isArray(result.data)) {
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
                    <td>${row.order_id || '-'}</td>
                    <td>${formatDate(row.tanggal_bongkar)}</td>
                    <td>${row.jam_bongkar || '-'}</td>
                    <td>${row.km_akhir || 0}</td>
                    <td>${row.jarak_km || 0}</td>
                    <td>${row.alihan ? 'Ya' : 'Tidak'}</td>
                    <td>${row.galian_alihan_nama || '-'}</td>
                    <td>${row.keterangan || '-'}</td>
                    <td>${formatCurrency(row.uang_alihan)}</td>
                    <td>${row.no_urut || '-'}</td>
                </tr>
            `).join('');
        } else {
            console.log('ℹ️ No buangan data found');
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">Tidak ada data buangan</td></tr>';
        }
    } catch (err) {
        console.error('❌ Error loading rekap buangan:', err);
        tbody.innerHTML = `<tr><td colspan="11" class="text-center" style="color: red;">Error: ${err.message}</td></tr>`;
    }
}

function resetFilterBuangan() {
    console.log('🔄 Resetting Buangan filters...');
    document.getElementById('filter-tanggal-dari-buangan').value = '';
    document.getElementById('filter-tanggal-sampai-buangan').value = '';
    document.getElementById('filter-order-id').value = '';
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
                petugas_order: document.getElementById('filter-petugas-order').value,
                kendaraan_id: document.getElementById('filter-kendaraan-order').value,
                supir_id: document.getElementById('filter-supir-order').value,
                galian_id: document.getElementById('filter-galian-order').value
            };
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
        } else if (type === 'buangan') {
            endpoint = '/rekap/buangan/export/excel';
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-buangan').value,
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-buangan').value,
                order_id: document.getElementById('filter-order-id').value
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
                petugas_order: document.getElementById('filter-petugas-order').value,
                kendaraan_id: document.getElementById('filter-kendaraan-order').value,
                supir_id: document.getElementById('filter-supir-order').value,
                galian_id: document.getElementById('filter-galian-order').value
            };
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
        } else if (type === 'buangan') {
            endpoint = '/rekap/buangan/export/pdf';
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-buangan').value,
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-buangan').value,
                order_id: document.getElementById('filter-order-id').value
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
    
    // Test connection
    console.log('1️⃣ Testing API connection...');
    await testConnection();
    
    // Load master data
    console.log('\n2️⃣ Loading master data...');
    await loadMasterData();
    
    // Load initial order data
    console.log('\n3️⃣ Loading initial order data...');
    await loadRekapOrder();
    
    console.log('\n✅ Initialization complete!\n');
});