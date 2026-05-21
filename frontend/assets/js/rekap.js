// API Base URL
const API_URL = 'http://localhost:3000/api';

// Storage untuk data master
let masterKendaraan = [];
let masterSupir = [];
let masterGalian = [];
let masterProyek = [];

// Storage untuk current table data used by datalist filters
let currentOrderData = [];
let currentBuanganData = [];
let currentGabunganData = [];

function getUniqueFieldValues(rows, fields) {
    if (!Array.isArray(rows)) return [];
    const fieldList = Array.isArray(fields) ? fields : [fields];
    const values = rows.map(row => {
        if (!row || typeof row !== 'object') return '';
        for (const field of fieldList) {
            const value = row[field];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return String(value).trim();
            }
        }
        return '';
    }).filter(v => v !== '' && v !== '-' && v.toLowerCase() !== 'null');
    return Array.from(new Set(values));
}

function populateDatalistFromRows(datalistId, rows, fields) {
    const values = getUniqueFieldValues(rows, fields);
    populateDatalistFromArray(datalistId, values);
}

// ============================================================================
// MULTI-SELECT COMPONENT
// ============================================================================
const multiSelects = {};

function initMultiSelect(containerId, data, labelKey, hiddenInputId) {
    multiSelects[containerId] = {
        data: data,
        labelKey: labelKey,
        hiddenInputId: hiddenInputId,
        selected: new Map()
    };

    const container = document.getElementById(containerId);
    if (!container) return;

    const input = container.querySelector('.ms-input');
    const dropdown = container.querySelector('.ms-dropdown');
    const clearBtn = container.querySelector('.ms-clear');

    if (input) {
        input.addEventListener('focus', () => {
            renderMsDropdown(containerId, input.value);
            if (dropdown) dropdown.classList.add('open');
        });
        input.addEventListener('input', () => {
            renderMsDropdown(containerId, input.value);
            if (dropdown && !dropdown.classList.contains('open')) dropdown.classList.add('open');
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearMultiSelect(containerId);
        });
    }

    document.addEventListener('click', (e) => {
        const el = document.getElementById(containerId);
        if (el && !el.contains(e.target)) {
            const dd = el.querySelector('.ms-dropdown');
            if (dd) dd.classList.remove('open');
        }
    });
}


function renderMsDropdown(containerId, search = '') {
    const state = multiSelects[containerId];
    if (!state) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    const dropdown = container.querySelector('.ms-dropdown');
    if (!dropdown) return;

    const filtered = state.data.filter(item => {
        const label = (item[state.labelKey] || '').toLowerCase();
        return label.includes((search || '').toLowerCase());
    });

    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="ms-empty">Tidak ada data</div>';
        return;
    }

    dropdown.innerHTML = filtered.slice(0, 60).map(item => {
        const id = String(item.id);
        const label = (item[state.labelKey] || '').replace(/"/g, '&quot;');
        const isSelected = state.selected.has(id);
        return `<label class="ms-option${isSelected ? ' selected' : ''}">
            <input type="checkbox" value="${id}" data-label="${label}"${isSelected ? ' checked' : ''}>
            <span>${item[state.labelKey] || ''}</span>
        </label>`;
    }).join('');

    dropdown.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleMsItem(containerId, e.target.value, e.target.dataset.label, e.target.checked);
        });
    });
}

function toggleMsItem(containerId, id, label, checked) {
    const state = multiSelects[containerId];
    if (!state) return;
    if (checked) {
        state.selected.set(String(id), label);
    } else {
        state.selected.delete(String(id));
    }
    renderMsTags(containerId);
    updateMsHiddenInput(containerId);
    const container = document.getElementById(containerId);
    if (container) {
        const input = container.querySelector('.ms-input');
        renderMsDropdown(containerId, input ? input.value : '');
    }
}

function renderMsTags(containerId) {
    const state = multiSelects[containerId];
    if (!state) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    const tags = container.querySelector('.ms-tags');
    if (!tags) return;

    tags.innerHTML = Array.from(state.selected.entries()).map(([id, label]) =>
        `<span class="ms-tag"><span title="${label}">${label}</span><button type="button" class="ms-tag-remove" data-id="${id}">×</button></span>`
    ).join('');

    tags.querySelectorAll('.ms-tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.selected.delete(btn.dataset.id);
            renderMsTags(containerId);
            updateMsHiddenInput(containerId);
            const container = document.getElementById(containerId);
            if (container) {
                const dd = container.querySelector('.ms-dropdown');
                if (dd && dd.classList.contains('open')) {
                    const input = container.querySelector('.ms-input');
                    renderMsDropdown(containerId, input ? input.value : '');
                }
            }
        });
    });
}

function updateMsHiddenInput(containerId) {
    const state = multiSelects[containerId];
    if (!state) return;
    const el = document.getElementById(state.hiddenInputId);
    if (el) el.value = Array.from(state.selected.keys()).join(',');
}

function clearMultiSelect(containerId) {
    const state = multiSelects[containerId];
    if (!state) return;
    state.selected.clear();
    renderMsTags(containerId);
    updateMsHiddenInput(containerId);
    const container = document.getElementById(containerId);
    if (container) {
        const input = container.querySelector('.ms-input');
        if (input) input.value = '';
        const dd = container.querySelector('.ms-dropdown');
        if (dd) dd.classList.remove('open');
    }
}

function getMsIds(containerId) {
    const state = multiSelects[containerId];
    if (!state) return '';
    return Array.from(state.selected.keys()).join(',');
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

function get2DaysAgo() {
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    return formatDateForInput(twoDaysAgo);
}

function togglePeriodeSection(header) {
    header.classList.toggle('collapsed');
}

function toggleFilterSection(header) {
    const filterSection = header.parentElement;
    filterSection.classList.toggle('collapsed');
}

function updateFilterStats(data, type = 'order') {
    if (!Array.isArray(data)) return;

    const totalData = data.length;
    const complete = data.filter(item => item.status === 'COMPLETE' || item.status === 'COMPLETED').length;
    const process = data.filter(item => item.status === 'ON_PROCESS' || item.status === 'ON PROCESS').length;
    const batal = data.filter(item => item.status === 'BATAL').length;

    if (type === 'gabungan') {
        const statTotal = document.getElementById('stat-total-gabungan');
        const statComplete = document.getElementById('stat-complete-gabungan');
        const statProcess = document.getElementById('stat-process-gabungan');
        const statBatal = document.getElementById('stat-batal-gabungan');
        if (statTotal) statTotal.textContent = totalData;
        if (statComplete) statComplete.textContent = complete;
        if (statProcess) statProcess.textContent = process;
        if (statBatal) statBatal.textContent = batal;
    }
}

function getSelectedMultiLabels(containerId) {
    const state = multiSelects[containerId];
    if (!state) return [];
    return Array.from(state.selected.values());
}

function renderActiveFilters(containerId, filterItems) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const valuesElement = container.querySelector('.summary-values');
    if (!valuesElement) return;

    if (!filterItems || filterItems.length === 0) {
        valuesElement.textContent = 'Semua data';
        return;
    }

    valuesElement.innerHTML = filterItems.map(item => `<span class="filter-chip">${item}</span>`).join('');
}

function getPeriodLabel(type, from, to) {
    if (type === 'manual') {
        if (from && to) return `Periode: ${from} - ${to}`;
        if (from) return `Dari: ${from}`;
        if (to) return `Sampai: ${to}`;
        return null;
    }

    switch (type) {
        case 'hari-ini': return 'Periode: Hari Ini';
        case '7-hari': return 'Periode: 7 Hari Terakhir';
        case '2-hari': return 'Periode: 2 Hari Terakhir';
        case 'semua': return null;
        default: return null;
    }
}

function formatFilterValue(field, value) {
    if (value === undefined || value === null || value === '') return null;
    if (field === 'aliihan' || field === 'filter-alihan' || field === 'filter-alihan-gabungan') {
        if (value === '1' || value === 1 || value.toString() === 'Ya') return 'Ya';
        if (value === '0' || value === 0 || value.toString() === 'Tidak') return 'Tidak';
    }
    if (field === 'status' && value === 'ON_PROCESS') return 'On Process';
    if (field === 'status' && value === 'COMPLETE') return 'Complete';
    if (field === 'status' && value === 'BATAL') return 'Batal';
    return value;
}

function updateActiveFilters(type, data = []) {
    const filters = [];

    if (type === 'order') {
        const periode = getPeriodLabel(
            document.getElementById('filter-tanggal-type-order').value,
            document.getElementById('filter-tanggal-dari-order').value,
            document.getElementById('filter-tanggal-sampai-order').value
        );
        if (periode) filters.push(periode);
        const values = [
            { label: 'No DO', value: document.getElementById('filter-no-do-order').value.trim(), field: 'no_do' },
            { label: 'Petugas', value: document.getElementById('filter-petugas-order-order').value.trim(), field: 'petugas' },
            { label: 'Status', value: document.getElementById('filter-status-order').value, field: 'status' },
            { label: 'Kendaraan', value: document.getElementById('filter-kendaraan-order').value.trim(), field: 'kendaraan' },
            { label: 'Supir', value: document.getElementById('filter-supir-order').value.trim(), field: 'supir' }
        ];
        values.forEach(item => {
            const formatted = formatFilterValue(item.field, item.value);
            if (formatted) filters.push(`${item.label}: ${formatted}`);
        });
        const proyekLabels = getSelectedMultiLabels('ms-proyek-order');
        if (proyekLabels.length) filters.push(`Proyek: ${proyekLabels.join(', ')}`);
        const galianLabels = getSelectedMultiLabels('ms-galian-order');
        if (galianLabels.length) filters.push(`Galian: ${galianLabels.join(', ')}`);

        renderActiveFilters('active-filters-order', filters);
    }

    if (type === 'buangan') {
        const periode = getPeriodLabel(
            document.getElementById('filter-tanggal-type-buangan').value,
            document.getElementById('filter-tanggal-dari-buangan').value,
            document.getElementById('filter-tanggal-sampai-buangan').value
        );
        if (periode) filters.push(periode);
        const values = [
            { label: 'No Order', value: document.getElementById('filter-no-order').value.trim(), field: 'no_order' },
            { label: 'No DO', value: document.getElementById('filter-no-do-buangan').value.trim(), field: 'no_do' },
            { label: 'Lokasi Buangan', value: document.getElementById('filter-buangan-lokasi').value.trim(), field: 'lokasi_bongkar' },
            { label: 'Alihan', value: document.getElementById('filter-alihan').value, field: 'aliihan' }
        ];
        values.forEach(item => {
            const formatted = formatFilterValue(item.field, item.value);
            if (formatted !== undefined && formatted !== null && formatted !== '') filters.push(`${item.label}: ${formatted}`);
        });
        const proyekLabels = getSelectedMultiLabels('ms-proyek-buangan');
        if (proyekLabels.length) filters.push(`Proyek: ${proyekLabels.join(', ')}`);
        const galianLabels = getSelectedMultiLabels('ms-galian-buangan');
        if (galianLabels.length) filters.push(`Galian: ${galianLabels.join(', ')}`);

        renderActiveFilters('active-filters-buangan', filters);
    }

    if (type === 'gabungan') {
        const periodeOrder = getPeriodLabel(
            document.getElementById('filter-tanggal-type-gabungan').value,
            document.getElementById('filter-tanggal-order-dari-gabungan').value,
            document.getElementById('filter-tanggal-order-sampai-gabungan').value
        );
        const periodeBongkar = getPeriodLabel(
            document.getElementById('filter-tanggal-bongkar-type-gabungan').value,
            document.getElementById('filter-tanggal-bongkar-dari-gabungan').value,
            document.getElementById('filter-tanggal-bongkar-sampai-gabungan').value
        );
        if (periodeOrder) filters.push(`Order: ${periodeOrder.replace('Periode: ', '')}`);
        if (periodeBongkar) filters.push(`Bongkar: ${periodeBongkar.replace('Periode: ', '')}`);
        const values = [
            { label: 'No DO', value: document.getElementById('filter-no-do-gabungan').value.trim(), field: 'no_do' },
            { label: 'Petugas Order', value: document.getElementById('filter-petugas-order-gabungan').value.trim(), field: 'petugas_order' },
            { label: 'Lokasi Bongkar', value: document.getElementById('filter-lokasi-bongkar-gabungan').value.trim(), field: 'lokasi_bongkar' },
            { label: 'Status', value: document.getElementById('filter-status-gabungan').value, field: 'status' },
            { label: 'Kendaraan', value: document.getElementById('filter-kendaraan-gabungan').value.trim(), field: 'kendaraan' },
            { label: 'Supir', value: document.getElementById('filter-supir-gabungan').value.trim(), field: 'supir' },
            { label: 'Alihan', value: document.getElementById('filter-alihan-gabungan').value, field: 'aliihan' }
        ];
        values.forEach(item => {
            const formatted = formatFilterValue(item.field, item.value);
            if (formatted !== undefined && formatted !== null && formatted !== '') filters.push(`${item.label}: ${formatted}`);
        });
        const proyekLabels = getSelectedMultiLabels('ms-proyek-gabungan');
        if (proyekLabels.length) filters.push(`Proyek: ${proyekLabels.join(', ')}`);
        const galianLabels = getSelectedMultiLabels('ms-galian-gabungan');
        if (galianLabels.length) filters.push(`Galian: ${galianLabels.join(', ')}`);
        const galianAlihanValue = document.getElementById('filter-galian-alihan-gabungan').value.trim();
        if (galianAlihanValue) filters.push(`Galian Alihan: ${galianAlihanValue}`);

        renderActiveFilters('active-filters-gabungan', filters);
    }
}


function setupFilterSubmitOnEnter() {
    const filterControls = document.querySelectorAll('.filter-section input, .filter-section select');
    filterControls.forEach(control => {
        control.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                const tab = this.closest('.tab-content');
                if (!tab) return;
                if (tab.id === 'order-tab') loadRekapOrder();
                if (tab.id === 'buangan-tab') loadRekapBuangan();
                if (tab.id === 'gabungan-tab') loadRekapGabungan();
            }
        });
    });
}

function initCollapsibleSections() {
    const collapsibleHeaders = document.querySelectorAll('.filter-section-subtitle h4');
    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', function() {
            this.parentElement.classList.toggle('collapsed');
        });
    });
}

function handleResponsiveFilters() {
    const filterSections = document.querySelectorAll('.filter-section');
    if (window.innerWidth <= 768) {
        filterSections.forEach(section => section.classList.add('collapsed'));
    }
}

function initFilterImprovements() {
    initCollapsibleSections();
    handleResponsiveFilters();
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(handleResponsiveFilters, 250);
    });
}

function initInputFocusEffects() {
    const inputs = document.querySelectorAll('.filter-item input, .filter-item select');
    inputs.forEach(input => {
        input.addEventListener('focus', function() { this.parentElement.classList.add('focused'); });
        input.addEventListener('blur', function() { this.parentElement.classList.remove('focused'); });
    });
}

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
    return formatDateForInput(new Date());
}

function get7DaysAgo() {
    const today = new Date();
    const d = new Date(today);
    d.setDate(today.getDate() - 7);
    return formatDateForInput(d);
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
        if (filterType === 'hari-ini') { dariInput.value = getToday(); sampaiInput.value = getToday(); }
        else if (filterType === '7-hari') { dariInput.value = get7DaysAgo(); sampaiInput.value = getToday(); }
        else if (filterType === '2-hari') { dariInput.value = get2DaysAgo(); sampaiInput.value = getToday(); }
        else if (filterType === 'semua') { dariInput.value = ''; sampaiInput.value = ''; }
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
        if (filterType === 'hari-ini') { dariInput.value = getToday(); sampaiInput.value = getToday(); }
        else if (filterType === '7-hari') { dariInput.value = get7DaysAgo(); sampaiInput.value = getToday(); }
        else if (filterType === '2-hari') { dariInput.value = get2DaysAgo(); sampaiInput.value = getToday(); }
        else if (filterType === 'semua') { dariInput.value = ''; sampaiInput.value = ''; }
    }
}

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
        if (filterType === 'hari-ini') { dariInput.value = getToday(); sampaiInput.value = getToday(); }
        else if (filterType === '7-hari') { dariInput.value = get7DaysAgo(); sampaiInput.value = getToday(); }
        else if (filterType === '2-hari') { dariInput.value = get2DaysAgo(); sampaiInput.value = getToday(); }
        else if (filterType === 'semua') { dariInput.value = ''; sampaiInput.value = ''; }
    }
}

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
        if (filterType === 'hari-ini') { dariInput.value = getToday(); sampaiInput.value = getToday(); }
        else if (filterType === '7-hari') { dariInput.value = get7DaysAgo(); sampaiInput.value = getToday(); }
        else if (filterType === '2-hari') { dariInput.value = get2DaysAgo(); sampaiInput.value = getToday(); }
        else if (filterType === 'semua') { dariInput.value = ''; sampaiInput.value = ''; }
    }
}

function toggleGalianAlihanFilter() {
    const alihanSelect = document.getElementById('filter-alihan-gabungan');
    const galianAlihanDiv = document.getElementById('galian-alihan-filter-gabungan');
    const galianAlihanInput = document.getElementById('filter-galian-alihan-gabungan');
    const galianAlihanIdInput = document.getElementById('filter-galian-alihan-gabungan-id');

    if (alihanSelect.value === '1') {
        galianAlihanDiv.classList.add('show');
        // immediately populate from displayed table for instant UX
        try { populateTableDatalists(); } catch (e) { /* ignore */ }
        // also refresh server-side used list in background
        loadUsedGalianAlihan();
    } else {
        galianAlihanDiv.classList.remove('show');
        galianAlihanInput.value = '';
        galianAlihanIdInput.value = '';
        const datalist = document.getElementById('datalist-galian-alihan-gabungan');
        if (datalist) datalist.innerHTML = '';
    }
}

async function loadUsedGalianAlihan() {
    try {
        const url = `${API_URL}/rekap/galian-alihan-used`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();

        let data = null;
        if (result && result.success && Array.isArray(result.data)) data = result.data;
        else if (Array.isArray(result)) data = result;
        else if (result && Array.isArray(result.rows)) data = result.rows;

        if (data && data.length > 0) {
            populateDatalist('datalist-galian-alihan-gabungan', data, 'nama_galian');
        }
    } catch (err) {
        console.error('❌ Error loading used galian alihan:', err.message);
    }
}

// ============================================================================
// TAB NAVIGATION & COLLAPSIBLE FILTERS
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');

            if (tabName === 'order') loadRekapOrder();
            if (tabName === 'buangan') loadRekapBuangan();
            if (tabName === 'gabungan') loadRekapGabungan();
        });
    });

    document.getElementById('filter-tanggal-dari-order').value = get2DaysAgo();
    document.getElementById('filter-tanggal-sampai-order').value = getToday();
    document.getElementById('filter-tanggal-dari-buangan').value = get2DaysAgo();
    document.getElementById('filter-tanggal-sampai-buangan').value = getToday();
    document.getElementById('filter-tanggal-order-dari-gabungan').value = get2DaysAgo();
    document.getElementById('filter-tanggal-order-sampai-gabungan').value = getToday();
    document.getElementById('filter-tanggal-bongkar-dari-gabungan').value = '';
    document.getElementById('filter-tanggal-bongkar-sampai-gabungan').value = '';
    document.getElementById('filter-tanggal-bongkar-type-gabungan').value = 'semua';
    toggleDateRangeBongkarGabungan();

    document.querySelectorAll('.filter-section-subtitle h4').forEach(header => {
        header.addEventListener('click', () => {
            const subtitle = header.parentElement;
            const nextElement = subtitle.nextElementSibling;
            subtitle.classList.toggle('collapsed');
            if (nextElement && (nextElement.classList.contains('filter-grid') ||
                               nextElement.classList.contains('date-range-inputs') ||
                               (nextElement.id && nextElement.id.includes('date-range')))) {
                nextElement.classList.toggle('filter-collapsible');
                nextElement.classList.toggle('show');
            }
        });
    });

    setupAutocompleteListeners();
    setupFilterSubmitOnEnter();
});

// ============================================================================
// AUTOCOMPLETE SETUP (kendaraan, supir, galian-alihan only - proyek/galian use multiselect)
// ============================================================================
function extractUniqueValuesFromTable(columnIndex, tableBodyId) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return [];
    const rows = tbody.querySelectorAll('tr');
    const values = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[columnIndex]) {
            const value = cells[columnIndex].textContent.trim();
            if (value && value !== '-' && value !== 'Memuat data...' && value !== 'Tidak ada data order' && !values.includes(value)) {
                values.push(value);
            }
        }
    });
    return values;
}


function populateTableDatalists() {
    populateDatalistFromRows('datalist-petugas-order-order', currentOrderData, 'petugas_order');
    populateDatalistFromRows('datalist-no-do-order', currentOrderData, 'no_do');
    populateDatalistFromRows('datalist-no-do-buangan', currentBuanganData, 'no_do');
    populateDatalistFromRows('datalist-buangan-lokasi', currentBuanganData, ['lokasi_bongkar', 'buangan']);
    populateDatalistFromRows('datalist-petugas-order-gabungan', currentGabunganData, 'petugas');
    populateDatalistFromRows('datalist-no-do-gabungan', currentGabunganData, 'no_do');
    populateDatalistFromRows('datalist-lokasi-bongkar-gabungan', currentGabunganData, ['lokasi_bongkar', 'buangan']);
    const galianAlihanVals = getUniqueFieldValues(currentGabunganData, 'galian_alihan');
    populateDatalistFromArray('datalist-galian-alihan-gabungan', galianAlihanVals);
}

function setupAutocompleteListeners() {
    // ---- Kendaraan Order ----
    const kendaraanInput = document.getElementById('filter-kendaraan-order');
    if (kendaraanInput) {
        kendaraanInput.addEventListener('input', function() {
            filterDatalist(this.value, masterKendaraan, 'datalist-kendaraan', 'no_pintu');
            if (!this.value.trim()) document.getElementById('filter-kendaraan-order-id').value = '';
        });
        kendaraanInput.addEventListener('change', function() {
            const selectedItem = masterKendaraan.find(k => k.no_pintu === this.value);
            document.getElementById('filter-kendaraan-order-id').value = selectedItem ? selectedItem.id : '';
        });
    }

    // ---- Supir Order ----
    const supirInput = document.getElementById('filter-supir-order');
    if (supirInput) {
        supirInput.addEventListener('input', function() {
            filterDatalist(this.value, masterSupir, 'datalist-supir', 'nama');
            if (!this.value.trim()) document.getElementById('filter-supir-order-id').value = '';
        });
        supirInput.addEventListener('change', function() {
            const selectedItem = masterSupir.find(s => s.nama === this.value);
            document.getElementById('filter-supir-order-id').value = selectedItem ? selectedItem.id : '';
        });
    }

    // ---- Kendaraan Gabungan ----
    const kendaraanGabunganInput = document.getElementById('filter-kendaraan-gabungan');
    if (kendaraanGabunganInput) {
        kendaraanGabunganInput.addEventListener('input', function() {
            filterDatalist(this.value, masterKendaraan, 'datalist-kendaraan-gabungan', 'no_pintu');
            if (!this.value.trim()) document.getElementById('filter-kendaraan-gabungan-id').value = '';
        });
        kendaraanGabunganInput.addEventListener('change', function() {
            const selectedItem = masterKendaraan.find(k => k.no_pintu === this.value);
            document.getElementById('filter-kendaraan-gabungan-id').value = selectedItem ? selectedItem.id : '';
        });
    }

    // ---- Supir Gabungan ----
    const supirGabunganInput = document.getElementById('filter-supir-gabungan');
    if (supirGabunganInput) {
        supirGabunganInput.addEventListener('input', function() {
            filterDatalist(this.value, masterSupir, 'datalist-supir-gabungan', 'nama');
            if (!this.value.trim()) document.getElementById('filter-supir-gabungan-id').value = '';
        });
        supirGabunganInput.addEventListener('change', function() {
            const selectedItem = masterSupir.find(s => s.nama === this.value);
            document.getElementById('filter-supir-gabungan-id').value = selectedItem ? selectedItem.id : '';
        });
    }

    // ---- Galian Alihan Gabungan ----
    const galianAlihanGabunganInput = document.getElementById('filter-galian-alihan-gabungan');
    if (galianAlihanGabunganInput) {
        galianAlihanGabunganInput.addEventListener('focus', function() {
            const vals = extractUniqueValuesFromTable(5, 'tbody-gabungan');
            populateDatalistFromArray('datalist-galian-alihan-gabungan', vals);
        });
        galianAlihanGabunganInput.addEventListener('input', function() {
            if (!this.value.trim()) document.getElementById('filter-galian-alihan-gabungan-id').value = '';
            const tableVals = extractUniqueValuesFromTable(5, 'tbody-gabungan');
            if (tableVals && tableVals.length > 0) {
                const filtered = tableVals.filter(v => v.toLowerCase().includes(this.value.toLowerCase()));
                populateDatalistFromArray('datalist-galian-alihan-gabungan', filtered);
            } else {
                filterDatalist(this.value, masterGalian, 'datalist-galian-alihan-gabungan', 'nama_galian');
            }
        });
        galianAlihanGabunganInput.addEventListener('change', function() {
            const selectedItem = masterGalian.find(g => g.nama_galian === this.value);
            document.getElementById('filter-galian-alihan-gabungan-id').value = selectedItem ? selectedItem.id : '';
        });
    }

    // ---- Petugas Order (semua tab) ----
    const petugasOrderInput = document.getElementById('filter-petugas-order-order');
    if (petugasOrderInput) {
        petugasOrderInput.addEventListener('focus', function() {
            populateDatalistFromRows('datalist-petugas-order-order', currentOrderData, 'petugas_order');
        });
    }

    // ---- Petugas Order Gabungan (dengan focus event untuk update dari tabel) ----
    const petugasGabunganInput = document.getElementById('filter-petugas-order-gabungan');
    if (petugasGabunganInput) {
        petugasGabunganInput.addEventListener('focus', function() {
            const petugasGabVals = extractUniqueValuesFromTable(3, 'tbody-gabungan');
            populateDatalistFromArray('datalist-petugas-order-gabungan', petugasGabVals);
        });
        petugasGabunganInput.addEventListener('input', function() {
            const petugasGabVals = extractUniqueValuesFromTable(3, 'tbody-gabungan');
            const filtered = petugasGabVals.filter(v => v.toLowerCase().includes(this.value.toLowerCase()));
            populateDatalistFromArray('datalist-petugas-order-gabungan', filtered);
        });
    }

    // ---- Lokasi Bongkar Gabungan (Buangan - dengan focus event untuk update dari tabel) ----
    const lokasiBongkarGabunganInput = document.getElementById('filter-lokasi-bongkar-gabungan');
    if (lokasiBongkarGabunganInput) {
        lokasiBongkarGabunganInput.addEventListener('focus', function() {
            const lokasiGabVals = extractUniqueValuesFromTable(19, 'tbody-gabungan');
            populateDatalistFromArray('datalist-lokasi-bongkar-gabungan', lokasiGabVals);
        });
        lokasiBongkarGabunganInput.addEventListener('input', function() {
            const lokasiGabVals = extractUniqueValuesFromTable(19, 'tbody-gabungan');
            const filtered = lokasiGabVals.filter(v => v.toLowerCase().includes(this.value.toLowerCase()));
            populateDatalistFromArray('datalist-lokasi-bongkar-gabungan', filtered);
        });
    }

    const noDoOrderInput = document.getElementById('filter-no-do-order');
    if (noDoOrderInput) {
        noDoOrderInput.addEventListener('focus', function() {
            populateDatalistFromRows('datalist-no-do-order', currentOrderData, 'no_do');
        });
        noDoOrderInput.addEventListener('input', function() {
            const allVals = getUniqueFieldValues(currentOrderData, 'no_do');
            const filtered = allVals.filter(v => v.toLowerCase().includes(this.value.toLowerCase()));
            populateDatalistFromArray('datalist-no-do-order', filtered);
        });
    }

    const noDoGabunganInput = document.getElementById('filter-no-do-gabungan');
    if (noDoGabunganInput) {
        noDoGabunganInput.addEventListener('focus', function() {
            populateDatalistFromRows('datalist-no-do-gabungan', currentGabunganData, 'no_do');
        });
        noDoGabunganInput.addEventListener('input', function() {
            const allVals = getUniqueFieldValues(currentGabunganData, 'no_do');
            const filtered = allVals.filter(v => v.toLowerCase().includes(this.value.toLowerCase()));
            populateDatalistFromArray('datalist-no-do-gabungan', filtered);
        });
    }

    const noDoBuanganInput = document.getElementById('filter-no-do-buangan');
    if (noDoBuanganInput) {
        noDoBuanganInput.addEventListener('focus', function() {
            populateDatalistFromRows('datalist-no-do-buangan', currentBuanganData, 'no_do');
        });
        noDoBuanganInput.addEventListener('input', function() {
            const allVals = getUniqueFieldValues(currentBuanganData, 'no_do');
            const filtered = allVals.filter(v => v.toLowerCase().includes(this.value.toLowerCase()));
            populateDatalistFromArray('datalist-no-do-buangan', filtered);
        });
    }

    const lokasiBuanganInput = document.getElementById('filter-buangan-lokasi');
    if (lokasiBuanganInput) {
        lokasiBuanganInput.addEventListener('focus', function() {
            populateDatalistFromRows('datalist-buangan-lokasi', currentBuanganData, ['lokasi_bongkar', 'buangan']);
        });
        lokasiBuanganInput.addEventListener('input', function() {
            const allVals = getUniqueFieldValues(currentBuanganData, ['lokasi_bongkar', 'buangan']);
            const filtered = allVals.filter(v => v.toLowerCase().includes(this.value.toLowerCase()));
            populateDatalistFromArray('datalist-buangan-lokasi', filtered);
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

    const items = (!searchTerm || searchTerm.length < 1)
        ? dataArray.slice(0, 50)
        : dataArray.filter(item => item[displayKey] && item[displayKey].toString().toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 50);

    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[displayKey];
        datalist.appendChild(option);
    });
}

// ============================================================================
// LOAD MASTER DATA FOR AUTOCOMPLETE & MULTISELECTS
// ============================================================================
async function loadMasterData() {
    debugLog('Loading Master Data', 'Starting...');

    await loadKendaraan();
    await loadSupir();
    await loadGalian();
    await loadProyek();
    await loadFilterOptions();

    if (masterKendaraan.length > 0) {
        populateDatalist('datalist-kendaraan-gabungan', masterKendaraan, 'no_pintu');
    }
    if (masterSupir.length > 0) {
        populateDatalist('datalist-supir-gabungan', masterSupir, 'nama');
    }
    if (masterGalian.length > 0) {
        populateDatalist('datalist-galian-alihan-gabungan', masterGalian, 'nama_galian');
    }

    // Init multiselects for proyek
    initMultiSelect('ms-proyek-order', masterProyek, 'nama_proyek', 'filter-proyek-order-ids');
    initMultiSelect('ms-proyek-buangan', masterProyek, 'nama_proyek', 'filter-proyek-buangan-ids');
    initMultiSelect('ms-proyek-gabungan', masterProyek, 'nama_proyek', 'filter-proyek-gabungan-ids');

    // Init multiselects for galian
    initMultiSelect('ms-galian-order', masterGalian, 'nama_galian', 'filter-galian-order-ids');
    initMultiSelect('ms-galian-buangan', masterGalian, 'nama_galian', 'filter-galian-buangan-ids');
    initMultiSelect('ms-galian-gabungan', masterGalian, 'nama_galian', 'filter-galian-gabungan-ids');

    console.log('✅ Master data loading completed\n');
}

async function loadKendaraan() {
    try {
        const response = await fetch(`${API_URL}/master/kendaraan`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();

        let data = null;
        if (result && result.success && Array.isArray(result.data)) data = result.data;
        else if (Array.isArray(result)) data = result;
        else if (result && Array.isArray(result.rows)) data = result.rows;
        else if (result && Array.isArray(result.data)) data = result.data;

        if (data && Array.isArray(data)) {
            masterKendaraan = data;
            populateDatalist('datalist-kendaraan', data, 'no_pintu');
        }
    } catch (err) {
        console.error('❌ Error loading kendaraan:', err.message);
    }
}

async function loadSupir() {
    try {
        const response = await fetch(`${API_URL}/master/supir`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();

        let data = null;
        if (result && result.success && Array.isArray(result.data)) data = result.data;
        else if (Array.isArray(result)) data = result;
        else if (result && Array.isArray(result.rows)) data = result.rows;
        else if (result && Array.isArray(result.data)) data = result.data;

        if (data && Array.isArray(data)) {
            masterSupir = data;
            populateDatalist('datalist-supir', data, 'nama');
        }
    } catch (err) {
        console.error('❌ Error loading supir:', err.message);
    }
}

async function loadGalian() {
    try {
        const response = await fetch(`${API_URL}/master/galian`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();

        let data = null;
        if (result && result.success && Array.isArray(result.data)) data = result.data;
        else if (Array.isArray(result)) data = result;
        else if (result && Array.isArray(result.rows)) data = result.rows;
        else if (result && Array.isArray(result.data)) data = result.data;

        if (data && Array.isArray(data)) {
            masterGalian = data;
        }
    } catch (err) {
        console.error('❌ Error loading galian:', err.message);
    }
}

async function loadProyek() {
    try {
        const response = await fetch(`${API_URL}/master/proyek`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        let data = null;
        if (result && Array.isArray(result.data)) data = result.data;
        else if (Array.isArray(result)) data = result;
        if (data && Array.isArray(data)) {
            masterProyek = data;
        }
    } catch (err) {
        console.error('❌ Error loading proyek:', err.message);
    }
}


async function loadFilterOptions() {
    try {
        const response = await fetch(`${API_URL}/rekap/filter-options`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        let data = null;
        if (result && result.success && result.data) data = result.data;
        else if (result && typeof result === 'object') data = result;
        if (!data) return;

        if (Array.isArray(data.no_do)) {
            populateDatalistFromArray('datalist-no-do-order', data.no_do);
            populateDatalistFromArray('datalist-no-do-buangan', data.no_do);
            populateDatalistFromArray('datalist-no-do-gabungan', data.no_do);
        }
        if (Array.isArray(data.petugas_order)) {
            populateDatalistFromArray('datalist-petugas-order-gabungan', data.petugas_order);
        }
        if (Array.isArray(data.lokasi_bongkar)) {
            populateDatalistFromArray('datalist-lokasi-bongkar-gabungan', data.lokasi_bongkar);
        }
    } catch (err) {
        console.error('❌ Error loading filter options:', err.message);
    }
}

function populateDatalistFromArray(datalistId, data) {
    const datalist = document.getElementById(datalistId);
    if (!datalist || !Array.isArray(data)) return;
    datalist.innerHTML = '';
    data.slice(0, 200).forEach(item => {
        if (item !== null && item !== undefined && String(item).trim() !== '') {
            const option = document.createElement('option');
            option.value = String(item);
            datalist.appendChild(option);
        }
    });
}

function populateDatalist(datalistId, data, textKey) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;
    datalist.innerHTML = '';
    if (!Array.isArray(data) || data.length === 0) return;
    data.slice(0, 50).forEach(item => {
        if (item[textKey] !== undefined) {
            const option = document.createElement('option');
            option.value = item[textKey];
            datalist.appendChild(option);
        }
    });
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
            proyek_id: getMsIds('ms-proyek-order'),
            galian_id: getMsIds('ms-galian-order'),
            no_do: document.getElementById('filter-no-do-order').value.trim(),
            petugas_order: document.getElementById('filter-petugas-order-order').value.trim(),
            status: document.getElementById('filter-status-order').value,
            kendaraan_id: document.getElementById('filter-kendaraan-order-id').value,
            supir_id: document.getElementById('filter-supir-order-id').value
        };

        Object.keys(filters).forEach(key => {
            const value = filters[key];
            if (value !== undefined && value !== null && value !== '') params.append(key, value);
        });

        const url = `${API_URL}/rekap/order${params.toString() ? '?' + params.toString() : ''}`;
        debugLog('Loading Rekap Order', { url, filters });

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const result = await response.json();
        debugLog('Rekap Order Response', result);

        let data = null;
        if (result && result.success === true && result.data) data = result.data;
        else if (Array.isArray(result)) data = result;
        else if (result && Array.isArray(result.rows)) data = result.rows;
        else if (result && Array.isArray(result.data)) data = result.data;

        currentOrderData = Array.isArray(data) ? data : [];

        if (data && Array.isArray(data) && data.length > 0) {
            let totalUangJalan = 0, totalPotongan = 0, totalHasilAkhir = 0, totalHargaRitasi = 0;
            const totalRitasi = data.length;

            data.forEach(row => {
                totalUangJalan += parseFloat(row.uang_jalan || 0);
                totalPotongan += parseFloat(row.potongan || 0);
                totalHasilAkhir += parseFloat(row.hasil_akhir || 0);
                totalHargaRitasi += parseFloat(row.proyek_harga || 0);
            });

            tbody.innerHTML = data.map((row, index) => {
                let statusStyle = '';
                const status = (row.status || '').toUpperCase();
                if (status === 'COMPLETE') statusStyle = 'background: #28a745; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                else if (status === 'ON PROCESS' || status === 'ON_PROCESS') statusStyle = 'background: #ffc107; color: #000; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                else if (status === 'BATAL') statusStyle = 'background: #dc3545; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                else statusStyle = 'background: #6c757d; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';

                const isComplete = (row.status || '').toUpperCase() === 'COMPLETE';
                const actionButton = (isComplete && row.id) ?
                    `<button class="btn btn-info btn-sm" onclick="showOrderDetail('${row.id}')">Detail</button>` : '-';

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
                        <td>${row.proyek_display || '-'}</td>
                        <td>${row.keterangan_buangan || '-'}</td>
                        <td><span style="${statusStyle}">${row.status || '-'}</span></td>
                        <td>${actionButton}</td>
                    </tr>
                `;
            }).join('');

            populateTableDatalists();
            displayOrderSummary(totalUangJalan, totalPotongan, totalHasilAkhir, totalRitasi, totalHargaRitasi);
            updateActiveFilters('order', data);
        } else {
            tbody.innerHTML = '<tr><td colspan="17" class="text-center">Tidak ada data order</td></tr>';
            const summaryDiv = document.getElementById('summary-order');
            if (summaryDiv) summaryDiv.innerHTML = '';
            updateActiveFilters('order', []);
        }
    } catch (err) {
        console.error('❌ Error loading rekap order:', err);
        tbody.innerHTML = `<tr><td colspan="17" class="text-center" style="color: red;">Error: ${err.message}</td></tr>`;
    }
}

function resetFilterOrder() {
    document.getElementById('filter-tanggal-type-order').value = '2-hari';
    document.getElementById('filter-tanggal-dari-order').value = get2DaysAgo();
    document.getElementById('filter-tanggal-sampai-order').value = getToday();
    document.getElementById('filter-no-do-order').value = '';
    document.getElementById('filter-petugas-order-order').value = '';
    document.getElementById('filter-status-order').value = '';
    document.getElementById('filter-kendaraan-order').value = '';
    document.getElementById('filter-kendaraan-order-id').value = '';
    document.getElementById('filter-supir-order').value = '';
    document.getElementById('filter-supir-order-id').value = '';
    clearMultiSelect('ms-proyek-order');
    clearMultiSelect('ms-galian-order');
    document.getElementById('date-range-order').classList.remove('show');
    loadRekapOrder();
}

// ============================================================================
// REKAP BUANGAN
// ============================================================================
async function loadRekapBuangan() {
    const tbody = document.getElementById('tbody-buangan');
    tbody.innerHTML = '<tr><td colspan="13" class="text-center loading">Memuat data...</td></tr>';

    try {
        const params = new URLSearchParams();

        const filters = {
            tanggal_dari: document.getElementById('filter-tanggal-dari-buangan').value,
            tanggal_sampai: document.getElementById('filter-tanggal-sampai-buangan').value,
            no_order: document.getElementById('filter-no-order').value.trim(),
            no_do: document.getElementById('filter-no-do-buangan').value.trim(),
            lokasi_bongkar: document.getElementById('filter-buangan-lokasi').value.trim(),
            alihan: document.getElementById('filter-alihan').value,
            proyek_id: getMsIds('ms-proyek-buangan'),
            galian_id: getMsIds('ms-galian-buangan')
        };

        Object.keys(filters).forEach(key => {
            const value = filters[key];
            if (value !== undefined && value !== null && value !== '') params.append(key, value);
        });

        const url = `${API_URL}/rekap/buangan${params.toString() ? '?' + params.toString() : ''}`;
        debugLog('Loading Rekap Buangan', { url, filters });

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const result = await response.json();
        debugLog('Rekap Buangan Response', result);

        let data = null;
        if (result && result.success === true && result.data) data = result.data;
        else if (Array.isArray(result)) data = result;
        else if (result && Array.isArray(result.rows)) data = result.rows;
        else if (result && Array.isArray(result.data)) data = result.data;

        currentBuanganData = Array.isArray(data) ? data : [];

        if (data && Array.isArray(data) && data.length > 0) {
            let totalUangAlihan = 0;

            tbody.innerHTML = data.map((row, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${formatDate(row.tanggal_order)}</td>
                    <td>${row.no_order || '-'}</td>
                    <td>${formatDate(row.tanggal_bongkar)}</td>
                    <td>${row.jam_bongkar || '-'}</td>
                    <td>${formatKilometer(row.km_akhir)}</td>
                    <td>${formatKilometer(row.jarak_km)}</td>
                    <td>${row.lokasi_bongkar || '-'}</td>
                    <td>${row.alihan ? 'Ya' : 'Tidak'}</td>
                    <td>${row.galian_alihan_nama || '-'}</td>
                    <td>${row.keterangan || '-'}</td>
                    <td>${formatCurrency(row.uang_alihan)}</td>
                    <td>${row.no_urut || '-'}</td>
                </tr>
            `).join('');

            data.forEach(row => { totalUangAlihan += parseFloat(row.uang_alihan || 0); });
            populateTableDatalists();
            displayBuanganSummary(totalUangAlihan);
            updateActiveFilters('buangan', data);
        } else {
            tbody.innerHTML = '<tr><td colspan="13" class="text-center">Tidak ada data buangan</td></tr>';
            const summaryDiv = document.getElementById('summary-buangan');
            if (summaryDiv) summaryDiv.innerHTML = '';
            updateActiveFilters('buangan', []);
        }
    } catch (err) {
        console.error('❌ Error loading rekap buangan:', err);
        tbody.innerHTML = `<tr><td colspan="13" class="text-center" style="color: red;">Error: ${err.message}</td></tr>`;
    }
}

function resetFilterBuangan() {
    document.getElementById('filter-tanggal-type-buangan').value = '2-hari';
    document.getElementById('filter-tanggal-dari-buangan').value = get2DaysAgo();
    document.getElementById('filter-tanggal-sampai-buangan').value = getToday();
    document.getElementById('filter-no-order').value = '';
    document.getElementById('filter-no-do-buangan').value = '';
    document.getElementById('filter-buangan-lokasi').value = '';
    document.getElementById('filter-alihan').value = '';
    clearMultiSelect('ms-proyek-buangan');
    clearMultiSelect('ms-galian-buangan');
    document.getElementById('date-range-buangan').classList.remove('show');
    loadRekapBuangan();
}

// ============================================================================
// REKAP GABUNGAN
// ============================================================================
async function loadRekapGabungan() {
    const tbody = document.getElementById('tbody-gabungan');
    tbody.innerHTML = '<tr><td colspan="24" class="text-center loading">Memuat data...</td></tr>';

    try {
        const params = new URLSearchParams();

        const filters = {
            tanggal_order_dari: document.getElementById('filter-tanggal-order-dari-gabungan').value,
            tanggal_order_sampai: document.getElementById('filter-tanggal-order-sampai-gabungan').value,
            tanggal_bongkar_dari: document.getElementById('filter-tanggal-bongkar-dari-gabungan').value,
            tanggal_bongkar_sampai: document.getElementById('filter-tanggal-bongkar-sampai-gabungan').value,
            proyek_id: getMsIds('ms-proyek-gabungan'),
            galian_id: getMsIds('ms-galian-gabungan'),
            no_do: document.getElementById('filter-no-do-gabungan').value.trim(),
            lokasi_bongkar: document.getElementById('filter-lokasi-bongkar-gabungan').value.trim(),
            status: document.getElementById('filter-status-gabungan').value,
            kendaraan_id: document.getElementById('filter-kendaraan-gabungan-id').value,
            supir_id: document.getElementById('filter-supir-gabungan-id').value,
            petugas_order: document.getElementById('filter-petugas-order-gabungan').value.trim(),
            alihan: document.getElementById('filter-alihan-gabungan').value,
            galian_alihan_id: document.getElementById('filter-galian-alihan-gabungan-id').value
        };

        Object.keys(filters).forEach(key => {
            const value = filters[key];
            if (value !== undefined && value !== null && value !== '') params.append(key, value);
        });

        const url = `${API_URL}/rekap/gabungan${params.toString() ? '?' + params.toString() : ''}`;
        debugLog('Loading Rekap Gabungan', { url, filters });

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const result = await response.json();
        debugLog('Rekap Gabungan Response', result);

        let data = null;
        if (result && result.success === true && result.data) data = result.data;
        else if (Array.isArray(result)) data = result;
        else if (result && Array.isArray(result.rows)) data = result.rows;
        else if (result && Array.isArray(result.data)) data = result.data;

        currentGabunganData = Array.isArray(data) ? data : [];

        if (data && Array.isArray(data) && data.length > 0) {
            let totalUangJalan = 0, totalPotongan = 0, totalUangAlihan = 0, totalAlihan = 0;
            const totalRitasi = data.length;

            data.forEach(row => {
                totalUangJalan += parseFloat(row.uang_jalan || 0);
                totalPotongan += parseFloat(row.potongan || 0);
                totalUangAlihan += parseFloat(row.uang_alihan || 0);
                if (row.alihan == 1) totalAlihan++;
            });

            tbody.innerHTML = data.map((row, index) => {
                let statusStyle = '';
                const status = (row.status || '').toUpperCase();
                if (status === 'COMPLETE') statusStyle = 'background: #28a745; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                else if (status === 'ON PROCESS' || status === 'ON_PROCESS') statusStyle = 'background: #ffc107; color: #000; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                else if (status === 'BATAL') statusStyle = 'background: #dc3545; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';
                else statusStyle = 'background: #6c757d; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 600; display: inline-block;';

                const total = (parseFloat(row.uang_jalan || 0) - parseFloat(row.potongan || 0));

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${row.no_order || '-'}</td>
                        <td>${formatDate(row.tanggal_order)}</td>
                        <td>${row.petugas || '-'}</td>
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
                        <td>${row.buangan || '-'}</td>
                        <td>${row.alihan == 1 ? 'Ya' : (row.alihan == 0 ? 'Tidak' : '-')}</td>
                        <td>${formatCurrency(row.uang_alihan)}</td>
                        <td>${row.keterangan || '-'}</td>
                        <td><span style="${statusStyle}">${row.status || '-'}</span></td>
                    </tr>
                `;
            }).join('');

            populateTableDatalists();
            updateFilterStats(data, 'gabungan');
            displayGabunganSummary(totalUangJalan, totalPotongan, totalUangAlihan, totalRitasi, totalAlihan, data);
            updateActiveFilters('gabungan', data);
        } else {
            tbody.innerHTML = '<tr><td colspan="24" class="text-center">Tidak ada data gabungan</td></tr>';
            updateFilterStats([], 'gabungan');
            const summaryDiv = document.getElementById('summary-gabungan');
            if (summaryDiv) summaryDiv.innerHTML = '';
            updateActiveFilters('gabungan', []);
        }
    } catch (err) {
        console.error('❌ Error loading rekap gabungan:', err);
        tbody.innerHTML = `<tr><td colspan="24" class="text-center" style="color: red;">Error: ${err.message}</td></tr>`;
    }
}

function resetFilterGabungan() {
    document.getElementById('filter-tanggal-type-gabungan').value = '2-hari';
    document.getElementById('filter-tanggal-order-dari-gabungan').value = get2DaysAgo();
    document.getElementById('filter-tanggal-order-sampai-gabungan').value = getToday();
    document.getElementById('filter-tanggal-bongkar-type-gabungan').value = 'semua';
    document.getElementById('filter-tanggal-bongkar-dari-gabungan').value = '';
    document.getElementById('filter-tanggal-bongkar-sampai-gabungan').value = '';
    toggleDateRangeBongkarGabungan();
    document.getElementById('filter-no-do-gabungan').value = '';
    document.getElementById('filter-petugas-order-gabungan').value = '';
    document.getElementById('filter-lokasi-bongkar-gabungan').value = '';
    document.getElementById('filter-status-gabungan').value = '';
    document.getElementById('filter-kendaraan-gabungan').value = '';
    document.getElementById('filter-kendaraan-gabungan-id').value = '';
    document.getElementById('filter-supir-gabungan').value = '';
    document.getElementById('filter-supir-gabungan-id').value = '';
    document.getElementById('filter-alihan-gabungan').value = '';
    document.getElementById('filter-galian-alihan-gabungan').value = '';
    document.getElementById('filter-galian-alihan-gabungan-id').value = '';
    clearMultiSelect('ms-proyek-gabungan');
    clearMultiSelect('ms-galian-gabungan');
    document.getElementById('date-range-order-gabungan').classList.remove('show');
    document.getElementById('date-range-bongkar-gabungan').classList.remove('show');
    document.getElementById('galian-alihan-filter-gabungan').classList.remove('show');
    loadRekapGabungan();
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================
function sanitizeFilename(name) {
    if (!name) return name;
    name = name.replace(/^"(.*)"$/, '$1');
    name = name.replace(/[<>:"\/\\|?* -]/g, '_');
    name = name.replace(/_+/g, '_');
    return name.trim().substring(0, 120);
}

async function exportToExcel(type) {
    try {
        let endpoint = '';
        let params = new URLSearchParams();

        if (type === 'order') {
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-order')?.value || "",
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-order')?.value || "",
                proyek_id: getMsIds('ms-proyek-order'),
                galian_id: getMsIds('ms-galian-order'),
                no_do: document.getElementById('filter-no-do-order')?.value.trim() || "",
                petugas_order: document.getElementById('filter-petugas-order-order')?.value.trim() || "",
                status: document.getElementById('filter-status-order')?.value || "",
                kendaraan_id: document.getElementById('filter-kendaraan-order-id')?.value || "",
                supir_id: document.getElementById('filter-supir-order-id')?.value || ""
            };
            Object.keys(filters).forEach(key => { if (filters[key]) params.append(key, filters[key]); });
            endpoint = '/rekap/order/export/excel';

        } else if (type === 'buangan') {
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-buangan')?.value || "",
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-buangan')?.value || "",
                no_order: document.getElementById('filter-no-order')?.value.trim() || "",
                no_do: document.getElementById('filter-no-do-buangan')?.value.trim() || "",
                lokasi_bongkar: document.getElementById('filter-buangan-lokasi')?.value.trim() || "",
                alihan: document.getElementById('filter-alihan')?.value || "",
                proyek_id: getMsIds('ms-proyek-buangan'),
                galian_id: getMsIds('ms-galian-buangan')
            };
            Object.keys(filters).forEach(key => { if (filters[key]) params.append(key, filters[key]); });
            endpoint = '/rekap/buangan/export/excel';

        } else if (type === 'gabungan') {
            const filters = {
                tanggal_order_dari: document.getElementById('filter-tanggal-order-dari-gabungan')?.value || "",
                tanggal_order_sampai: document.getElementById('filter-tanggal-order-sampai-gabungan')?.value || "",
                tanggal_bongkar_dari: document.getElementById('filter-tanggal-bongkar-dari-gabungan')?.value || "",
                tanggal_bongkar_sampai: document.getElementById('filter-tanggal-bongkar-sampai-gabungan')?.value || "",
                proyek_id: getMsIds('ms-proyek-gabungan'),
                galian_id: getMsIds('ms-galian-gabungan'),
                no_do: document.getElementById('filter-no-do-gabungan')?.value.trim() || "",
                lokasi_bongkar: document.getElementById('filter-lokasi-bongkar-gabungan')?.value.trim() || "",
                status: document.getElementById('filter-status-gabungan')?.value || "",
                kendaraan_id: document.getElementById('filter-kendaraan-gabungan-id')?.value || "",
                supir_id: document.getElementById('filter-supir-gabungan-id')?.value || "",
                petugas_order: document.getElementById('filter-petugas-order-gabungan')?.value.trim() || "",
                alihan: document.getElementById('filter-alihan-gabungan')?.value || "",
                galian_alihan_id: document.getElementById('filter-galian-alihan-gabungan-id')?.value || ""
            };
            Object.keys(filters).forEach(key => { if (filters[key]) params.append(key, filters[key]); });

            params.append('stats_total', document.getElementById('stat-total-gabungan')?.textContent || '0');
            params.append('stats_complete', document.getElementById('stat-complete-gabungan')?.textContent || '0');
            params.append('stats_process', document.getElementById('stat-process-gabungan')?.textContent || '0');
            params.append('stats_batal', document.getElementById('stat-batal-gabungan')?.textContent || '0');
            endpoint = '/rekap/gabungan/export/excel';
        }

        const url = `${API_URL}${endpoint}?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition') || '';
        let filename = `rekap_${type}_${Date.now()}.xlsx`;
        const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i);
        if (filenameMatch) filename = decodeURIComponent(filenameMatch[1] || filenameMatch[2] || filename);
        filename = sanitizeFilename(filename) || `rekap_${type}_${Date.now()}.xlsx`;

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
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
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-order')?.value || "",
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-order')?.value || "",
                proyek_id: getMsIds('ms-proyek-order'),
                galian_id: getMsIds('ms-galian-order'),
                no_do: document.getElementById('filter-no-do-order')?.value.trim() || "",
                petugas_order: document.getElementById('filter-petugas-order-order')?.value.trim() || "",
                status: document.getElementById('filter-status-order')?.value || "",
                kendaraan_id: document.getElementById('filter-kendaraan-order-id')?.value || "",
                supir_id: document.getElementById('filter-supir-order-id')?.value || ""
            };
            Object.keys(filters).forEach(key => { if (filters[key]) params.append(key, filters[key]); });
            endpoint = '/rekap/order/export/pdf';

        } else if (type === 'buangan') {
            const filters = {
                tanggal_dari: document.getElementById('filter-tanggal-dari-buangan')?.value || "",
                tanggal_sampai: document.getElementById('filter-tanggal-sampai-buangan')?.value || "",
                no_order: document.getElementById('filter-no-order')?.value.trim() || "",
                no_do: document.getElementById('filter-no-do-buangan')?.value.trim() || "",
                lokasi_bongkar: document.getElementById('filter-buangan-lokasi')?.value.trim() || "",
                alihan: document.getElementById('filter-alihan')?.value || "",
                proyek_id: getMsIds('ms-proyek-buangan'),
                galian_id: getMsIds('ms-galian-buangan')
            };
            Object.keys(filters).forEach(key => { if (filters[key]) params.append(key, filters[key]); });
            endpoint = '/rekap/buangan/export/pdf';

        } else if (type === 'gabungan') {
            const filters = {
                tanggal_order_dari: document.getElementById('filter-tanggal-order-dari-gabungan')?.value || "",
                tanggal_order_sampai: document.getElementById('filter-tanggal-order-sampai-gabungan')?.value || "",
                tanggal_bongkar_dari: document.getElementById('filter-tanggal-bongkar-dari-gabungan')?.value || "",
                tanggal_bongkar_sampai: document.getElementById('filter-tanggal-bongkar-sampai-gabungan')?.value || "",
                proyek_id: getMsIds('ms-proyek-gabungan'),
                galian_id: getMsIds('ms-galian-gabungan'),
                no_do: document.getElementById('filter-no-do-gabungan')?.value.trim() || "",
                lokasi_bongkar: document.getElementById('filter-lokasi-bongkar-gabungan')?.value.trim() || "",
                status: document.getElementById('filter-status-gabungan')?.value || "",
                kendaraan_id: document.getElementById('filter-kendaraan-gabungan-id')?.value || "",
                supir_id: document.getElementById('filter-supir-gabungan-id')?.value || "",
                petugas_order: document.getElementById('filter-petugas-order-gabungan')?.value.trim() || "",
                alihan: document.getElementById('filter-alihan-gabungan')?.value || "",
                galian_alihan_id: document.getElementById('filter-galian-alihan-gabungan-id')?.value || ""
            };
            Object.keys(filters).forEach(key => { if (filters[key]) params.append(key, filters[key]); });

            params.append('stats_total', document.getElementById('stat-total-gabungan')?.textContent || '0');
            params.append('stats_complete', document.getElementById('stat-complete-gabungan')?.textContent || '0');
            params.append('stats_process', document.getElementById('stat-process-gabungan')?.textContent || '0');
            params.append('stats_batal', document.getElementById('stat-batal-gabungan')?.textContent || '0');
            endpoint = '/rekap/gabungan/export/pdf';
        }

        const url = `${API_URL}${endpoint}?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition') || '';
        let filename = `rekap_${type}_${Date.now()}.pdf`;
        const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i);
        if (filenameMatch) filename = decodeURIComponent(filenameMatch[1] || filenameMatch[2] || filename);
        filename = sanitizeFilename(filename) || `rekap_${type}_${Date.now()}.pdf`;

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
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
        const modal = document.getElementById('order-detail-modal');
        modal.style.display = 'block';

        const orderResponse = await fetch(`${API_URL}/rekap/order/${orderId}`);
        if (!orderResponse.ok) throw new Error(`Failed to fetch order: ${orderResponse.status}`);
        const orderResult = await orderResponse.json();

        let orderData = null;
        if (orderResult.data) {
            orderData = Array.isArray(orderResult.data) ? orderResult.data[0] : orderResult.data;
        } else if (orderResult.success && orderResult.order) {
            orderData = orderResult.order;
        } else if (Array.isArray(orderResult)) {
            orderData = orderResult[0];
        }
        if (!orderData) throw new Error('Order data not found');

        const buanganResponse = await fetch(`${API_URL}/rekap/buangan/by-order/${orderId}`);
        if (!buanganResponse.ok) throw new Error(`Failed to fetch buangan: ${buanganResponse.status}`);
        const buanganResult = await buanganResponse.json();

        let buanganData = [];
        if (buanganResult.data) {
            buanganData = Array.isArray(buanganResult.data) ? buanganResult.data : [buanganResult.data];
        } else if (Array.isArray(buanganResult)) {
            buanganData = buanganResult;
        }

        populateOrderInfo(orderData);

        const container = document.getElementById('buangan-cards');
        if (buanganData.length > 0) {
            container.innerHTML = '';
            buanganData.forEach(buangan => populateBuanganCard(buangan, orderData, container));
        } else {
            container.innerHTML = '<p class="no-data">Tidak ada data buangan untuk order ini</p>';
        }

        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.onclick = () => { modal.style.display = 'none'; };
        window.onclick = (event) => { if (event.target === modal) modal.style.display = 'none'; };
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
            <span class="card-proyek">${orderData.proyek_display || orderData.proyek_input || '-'}</span>
            <span class="card-date">${formatDate(buangan.tanggal_bongkar)}</span>
        </div>
        <div class="card-body">
            <div class="card-row"><span class="label">Tanggal Bongkar:</span><span class="value">${formatDate(buangan.tanggal_bongkar)}</span></div>
            <div class="card-row"><span class="label">Jam Bongkar:</span><span class="value">${buangan.jam_bongkar || '-'}</span></div>
            <div class="card-row"><span class="label">Buangan (Lokasi):</span><span class="value">${buangan.lokasi_bongkar || '-'}</span></div>
            <div class="card-row"><span class="label">KM Akhir:</span><span class="value">${formatKilometer(buangan.km_akhir)}</span></div>
            <div class="card-row"><span class="label">Jarak KM:</span><span class="value">${formatKilometer(buangan.jarak_km)}</span></div>
            <div class="card-row"><span class="label">Alihan:</span><span class="value">${buangan.alihan ? 'Ya' : 'Tidak'}</span></div>
            ${buangan.alihan ? `
                <div class="card-row"><span class="label">Galian Alihan:</span><span class="value">${buangan.galian_alihan_nama || '-'}</span></div>
                <div class="card-row"><span class="label">Uang Alihan:</span><span class="value">${formatCurrency(buangan.uang_alihan)}</span></div>
            ` : ''}
            ${buangan.keterangan ? `<div class="card-row"><span class="label">Keterangan:</span><span class="value">${buangan.keterangan}</span></div>` : ''}
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
        { label: 'Proyek', value: orderData.proyek_display || orderData.proyek_input || '-' },
        { label: 'Status', value: orderData.status || '-' }
    ];

    infoItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'info-item';
        div.innerHTML = `<strong>${item.label}:</strong> ${item.value}`;
        grid.appendChild(div);
    });
}

// ============================================================================
// SUMMARY DISPLAY FUNCTIONS
// ============================================================================
function displayOrderSummary(totalUangJalan, totalPotongan, totalHasilAkhir, totalRitasi, totalHargaRitasi) {
    const summaryDiv = document.getElementById('summary-order');
    if (!summaryDiv) return;

    summaryDiv.innerHTML = `
        <div class="summary-section">
            <div class="summary-title">📊 Ringkasan Order</div>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Total Ritasi:</span>
                    <span class="value">${totalRitasi}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Uang Jalan:</span>
                    <span class="value">${formatCurrency(totalUangJalan)}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Potongan:</span>
                    <span class="value">${formatCurrency(totalPotongan)}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Harga Ritasi:</span>
                    <span class="value">${formatCurrency(totalHargaRitasi)}</span>
                </div>
                <div class="summary-item grand-total">
                    <span class="label">Grand Total:</span>
                    <span class="value">${formatCurrency(totalHasilAkhir)}</span>
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

function buildGabunganSummaryByProject(data) {
    const grouped = {};
    data.forEach(row => {
        const proyek = row.proyek || '-';
        const galian = (row.alihan === 1 || row.alihan === '1' || row.alihan === true || row.alihan === 'true')
            ? (row.galian_alihan || row.galian || '-')
            : (row.galian || '-');
        if (!grouped[proyek]) grouped[proyek] = {};
        grouped[proyek][galian] = (grouped[proyek][galian] || 0) + 1;
    });
    return grouped;
}

function buildGabunganSummaryByGalian(data) {
    const grouped = {};
    data.forEach(row => {
        const galian = (row.alihan === 1 || row.alihan === '1' || row.alihan === true || row.alihan === 'true')
            ? (row.galian_alihan || row.galian || '-')
            : (row.galian || '-');
        const proyek = row.proyek || '-';
        if (!grouped[galian]) grouped[galian] = {};
        grouped[galian][proyek] = (grouped[galian][proyek] || 0) + 1;
    });
    return grouped;
}

function buildAlihanRouteSummary(data) {
    const grouped = {};
    data.forEach(row => {
        const alihan = row.alihan === 1 || row.alihan === '1' || row.alihan === true || row.alihan === 'true';
        if (!alihan) return;
        const from = row.galian || '-';
        const to = row.galian_alihan || '-';
        const route = `${from} → ${to}`;
        grouped[route] = (grouped[route] || 0) + 1;
    });
    return grouped;
}

function renderGabunganSummaryList(title, groupedData) {
    if (!groupedData || Object.keys(groupedData).length === 0) {
        return `<div class="summary-detail-empty">Tidak ada ringkasan.</div>`;
    }

    return Object.entries(groupedData).map(([mainLabel, subItems]) => {
        const totalRitasi = Object.values(subItems).reduce((sum, count) => sum + count, 0);
        const rows = Object.entries(subItems).map(([subLabel, count]) => {
            return `<div class="summary-detail-row">
                        <span>${subLabel}</span>
                        <span>${count} ritasi</span>
                    </div>`;
        }).join('');

        return `
            <div class="summary-detail-group">
                <div class="summary-detail-group-title">
                    <span>${mainLabel}</span>
                    <span>${totalRitasi} ritasi</span>
                </div>
                <div class="summary-detail-list">${rows}</div>
            </div>
        `;
    }).join('');
}

function renderAlihanRouteSummary(groupedData) {
    if (!groupedData || Object.keys(groupedData).length === 0) {
        return `<div class="summary-detail-empty">Tidak ada data alihan.</div>`;
    }

    return Object.entries(groupedData).map(([route, count]) => `
        <div class="summary-detail-row">
            <span>${route}</span>
            <span>${count} ritasi</span>
        </div>
    `).join('');
}

function displayGabunganSummary(totalUangJalan, totalPotongan, totalUangAlihan, totalRitasi, totalAlihan, dataRows) {
    const summaryDiv = document.getElementById('summary-gabungan');
    if (!summaryDiv) return;

    const totalUJplusUA = totalUangJalan + totalUangAlihan;
    const grandTotal = totalUJplusUA - totalPotongan;
    const byProject = buildGabunganSummaryByProject(dataRows);
    const byGalian = buildGabunganSummaryByGalian(dataRows);
    const routeAlihan = buildAlihanRouteSummary(dataRows);

    summaryDiv.innerHTML = `
        <div class="summary-section">
            <div class="summary-title">📊 Ringkasan Gabungan</div>
            <div class="summary-grid-custom">
                <div class="summary-row-top">
                    <div class="summary-item">
                        <span class="label">Total Ritasi:</span>
                        <span class="value">${totalRitasi}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Alihan:</span>
                        <span class="value">${totalAlihan}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Uang Alihan:</span>
                        <span class="value">${formatCurrency(totalUangAlihan)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Uang Jalan:</span>
                        <span class="value">${formatCurrency(totalUangJalan)}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total Potongan:</span>
                        <span class="value">${formatCurrency(totalPotongan)}</span>
                    </div>
                </div>
                <div class="summary-item">
                    <span class="label">Total UJ + Total UA:</span>
                    <span class="value">${formatCurrency(totalUJplusUA)}</span>
                </div>
                <div class="summary-item grand-total">
                    <span class="label">GRAND TOTAL (UJ + UA - Potongan):</span>
                    <span class="value">${formatCurrency(grandTotal)}</span>
                </div>
            </div>
            <div class="summary-detail-grid">
                <div class="summary-detail-card">
                    <div class="summary-detail-title">Per Proyek → Galian</div>
                    <div class="summary-detail-body">
                        ${renderGabunganSummaryList('Per Proyek', byProject)}
                    </div>
                </div>
                <div class="summary-detail-card">
                    <div class="summary-detail-title">Per Galian → Proyek</div>
                    <div class="summary-detail-body">
                        ${renderGabunganSummaryList('Per Galian', byGalian)}
                    </div>
                </div>
                <div class="summary-detail-card">
                    <div class="summary-detail-title">Alihan: Dari Galian → Galian Alihan</div>
                    <div class="summary-detail-body">
                        ${renderAlihanRouteSummary(routeAlihan)}
                    </div>
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
    if (typeof value === 'string' &&
        (value.toUpperCase() === 'ODO ERROR' ||
         value.toUpperCase() === 'ODOERROR' ||
         value.toUpperCase() === 'ODO ERR' ||
         value.toUpperCase() === 'ODOERR')) {
        return 'ODO ERROR';
    }

    if (value === null || value === undefined || value === '') return '0';
    if (value === 0) return '0';

    if (typeof value === 'string' && (value.includes('.') || value.includes(','))) {
        const sep = value.includes('.') ? '.' : ',';
        const parts = value.split(sep);
        const intPart = parts[0] || '0';
        const decPart = parts[1] || '';
        const intNum = Number(intPart.replace(/\s+/g, ''));
        const formattedInt = isNaN(intNum) ? intPart : intNum.toLocaleString('id-ID');
        return decPart ? `${formattedInt},${decPart}` : formattedInt;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) return String(value);
    if (Number.isInteger(numValue)) return numValue.toLocaleString('id-ID');

    const numParts = numValue.toString().split('.');
    const formattedInt = Number(numParts[0]).toLocaleString('id-ID');
    const decPart = numParts[1] || '';
    return decPart ? `${formattedInt},${decPart}` : formattedInt;
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

    initFilterImprovements();
    initInputFocusEffects();

    console.log('1️⃣ Loading master data...');
    await loadMasterData();

    console.log('\n2️⃣ Loading initial data...');
    await loadRekapGabungan();

    console.log('\n✅ Initialization complete!\n');
});
