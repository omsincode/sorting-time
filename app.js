// ========================================
// State Management
// ========================================
let allRecords = [];
let filteredRecords = [];
let employees = new Map();
let dates = new Set();

// Shift Presets (stored in localStorage)
let shiftPresets = [
    { id: 1, name: 'กะเช้า', icon: '🌅', startTime: '09:00', endTime: '19:00', workHours: 9, breakHours: 1, isNextDay: false, isDefault: true },
    { id: 2, name: 'กะกลางคืน', icon: '🌙', startTime: '16:00', endTime: '02:00', workHours: 9, breakHours: 1, isNextDay: true, isDefault: false }
];

// Current default shift config (calculated from default preset)
let shiftConfig = {
    workHours: 9,
    breakHours: 1,
    isNextDay: false
};

// Individual shift configs (stored per employee in sessionStorage)
let individualShiftConfigs = {};

// Current employee being viewed in modal
let currentModalEmployee = null;

// Current preset being edited
let editingPresetId = null;

// ========================================
// DOM Elements
// ========================================
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileInfo = document.getElementById('fileInfo');
const filterSection = document.getElementById('filterSection');
const statsSection = document.getElementById('statsSection');
const viewToggle = document.getElementById('viewToggle');
const tableView = document.getElementById('tableView');
const personalView = document.getElementById('personalView');
const timelineView = document.getElementById('timelineView');

const dateFilter = document.getElementById('dateFilter');
const employeeFilter = document.getElementById('employeeFilter');
const timeRangeFrom = document.getElementById('timeRangeFrom');
const timeRangeTo = document.getElementById('timeRangeTo');

const applyFilterBtn = document.getElementById('applyFilter');
const resetFilterBtn = document.getElementById('resetFilter');
const exportBtn = document.getElementById('exportBtn');

const tableViewBtn = document.getElementById('tableViewBtn');
const personalViewBtn = document.getElementById('personalViewBtn');
const timelineViewBtn = document.getElementById('timelineViewBtn');

// ========================================
// Event Listeners
// ========================================
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);

applyFilterBtn.addEventListener('click', applyFilters);
resetFilterBtn.addEventListener('click', resetFilters);
exportBtn.addEventListener('click', exportToCSV);

tableViewBtn.addEventListener('click', () => switchView('table'));
personalViewBtn.addEventListener('click', () => switchView('personal'));
timelineViewBtn.addEventListener('click', () => switchView('timeline'));

// ========================================
// File Handling Functions
// ========================================
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

function processFile(file) {
    if (!file.name.endsWith('.txt')) {
        alert('กรุณาเลือกไฟล์ .txt เท่านั้น');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;
        parseData(content);
        showFileInfo(file);
        showSections();
    };
    reader.readAsText(file);
}

function showFileInfo(file) {
    fileInfo.innerHTML = `
        <span>✅</span>
        <span>ไฟล์: <strong>${file.name}</strong> (${formatFileSize(file.size)}) - โหลดสำเร็จ!</span>
    `;
    fileInfo.classList.remove('hidden');
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// ========================================
// Data Parsing
// ========================================
function parseData(content) {
    allRecords = [];
    employees = new Map();
    dates = new Set();

    const lines = content.split('\n');

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse tab-separated values
        const parts = line.split(/\t+/);
        if (parts.length >= 6) {
            const no = parts[0].trim();
            const devId = parts[1].trim();
            const userId = parts[2].trim();
            const uName = parts[3].trim();
            const verify = parts[4].trim();
            const dateTime = parts[5].trim();

            // Parse date and time
            const [datePart, timePart] = dateTime.split(/\s+/);

            const record = {
                no,
                devId,
                userId,
                uName,
                verify,
                date: datePart,
                time: timePart,
                dateTime: new Date(datePart.replace(/\//g, '-') + 'T' + timePart)
            };

            allRecords.push(record);

            // Track unique employees
            if (!employees.has(userId)) {
                employees.set(userId, { name: uName, records: [] });
            }
            employees.get(userId).records.push(record);

            // Track unique dates
            dates.add(datePart);
        }
    }

    filteredRecords = [...allRecords];
    populateFilters();
    updateStats();
    renderCurrentView();
}

// ========================================
// Filter Functions
// ========================================
function populateFilters() {
    // Clear existing options
    dateFilter.innerHTML = '<option value="">ทุกวัน</option>';
    employeeFilter.innerHTML = '<option value="">ทุกคน</option>';

    // Populate date filter
    const sortedDates = Array.from(dates).sort();
    sortedDates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = formatThaiDate(date);
        dateFilter.appendChild(option);
    });

    // Populate employee filter
    const sortedEmployees = Array.from(employees.entries()).sort((a, b) =>
        a[1].name.localeCompare(b[1].name)
    );
    sortedEmployees.forEach(([id, emp]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${emp.name} (${id})`;
        employeeFilter.appendChild(option);
    });
}

function applyFilters() {
    const selectedDate = dateFilter.value;
    const selectedEmployee = employeeFilter.value;
    const timeFrom = timeRangeFrom.value;
    const timeTo = timeRangeTo.value;

    filteredRecords = allRecords.filter(record => {
        // Date filter
        if (selectedDate && record.date !== selectedDate) return false;

        // Employee filter
        if (selectedEmployee && record.userId !== selectedEmployee) return false;

        // Time range filter
        if (timeFrom && record.time < timeFrom) return false;
        if (timeTo && record.time > timeTo) return false;

        return true;
    });

    updateStats();
    renderCurrentView();
}

function resetFilters() {
    dateFilter.value = '';
    employeeFilter.value = '';
    timeRangeFrom.value = '';
    timeRangeTo.value = '';
    filteredRecords = [...allRecords];
    updateStats();
    renderCurrentView();
}

// ========================================
// Update Stats
// ========================================
function updateStats() {
    document.getElementById('totalEmployees').textContent = employees.size;
    document.getElementById('totalRecords').textContent = allRecords.length;
    document.getElementById('totalDays').textContent = dates.size;
    document.getElementById('filteredRecords').textContent = filteredRecords.length;
}

// ========================================
// View Switching
// ========================================
function showSections() {
    filterSection.style.display = 'block';
    statsSection.style.display = 'grid';
    viewToggle.style.display = 'flex';
    personalView.style.display = 'block';
    populateShiftFilter();
    renderPersonalView();
}

function switchView(view) {
    const shiftViewBtn = document.getElementById('shiftViewBtn');
    const shiftView = document.getElementById('shiftView');

    // Update button states
    tableViewBtn.classList.remove('active');
    personalViewBtn.classList.remove('active');
    timelineViewBtn.classList.remove('active');
    if (shiftViewBtn) shiftViewBtn.classList.remove('active');

    // Hide all views
    tableView.style.display = 'none';
    personalView.style.display = 'none';
    timelineView.style.display = 'none';
    if (shiftView) shiftView.style.display = 'none';

    switch (view) {
        case 'table':
            tableViewBtn.classList.add('active');
            tableView.style.display = 'block';
            renderTableView();
            break;
        case 'personal':
            personalViewBtn.classList.add('active');
            personalView.style.display = 'block';
            renderPersonalView();
            break;
        case 'timeline':
            timelineViewBtn.classList.add('active');
            timelineView.style.display = 'block';
            renderTimelineView();
            break;
        case 'shift':
            if (shiftViewBtn) shiftViewBtn.classList.add('active');
            if (shiftView) shiftView.style.display = 'block';
            renderShiftView();
            break;
    }
}

function renderCurrentView() {
    const shiftViewBtn = document.getElementById('shiftViewBtn');

    if (tableViewBtn.classList.contains('active')) {
        renderTableView();
    } else if (personalViewBtn.classList.contains('active')) {
        renderPersonalView();
    } else if (timelineViewBtn.classList.contains('active')) {
        renderTimelineView();
    } else if (shiftViewBtn && shiftViewBtn.classList.contains('active')) {
        renderShiftView();
    }
}

// ========================================
// Table View Rendering
// ========================================
function renderTableView() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    filteredRecords.forEach((record, index) => {
        const status = determineStatus(record);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${record.no}</td>
            <td>${record.devId}</td>
            <td>${record.userId}</td>
            <td style="text-transform: capitalize;">${record.uName}</td>
            <td>${formatThaiDate(record.date)}</td>
            <td><strong>${record.time}</strong></td>
            <td><span class="status-badge ${status.class}">${status.icon} ${status.text}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function determineStatus(record) {
    const hour = parseInt(record.time.split(':')[0]);

    if (hour >= 6 && hour < 12) {
        return { text: 'เข้างาน', class: 'status-in', icon: '🟢' };
    } else if (hour >= 12 && hour < 15) {
        return { text: 'พักกลางวัน', class: 'status-break', icon: '🟡' };
    } else if (hour >= 15 && hour < 24) {
        return { text: 'ออกงาน', class: 'status-out', icon: '🔴' };
    } else {
        return { text: 'ดึก', class: 'status-out', icon: '🌙' };
    }
}

// ========================================
// Personal View Rendering
// ========================================
function populateShiftFilter() {
    const select = document.getElementById('shiftFilter');
    if (!select) return;

    // Keep first option
    select.innerHTML = '<option value="">ทุกกะ</option>';
    select.innerHTML += '<option value="default">ใช้ค่าเริ่มต้น</option>';

    // Add presets
    shiftPresets.forEach(preset => {
        const opt = document.createElement('option');
        opt.value = preset.id.toString();
        opt.textContent = `${preset.icon} ${preset.name}`;
        select.appendChild(opt);
    });
}

function renderPersonalView() {
    const container = document.getElementById('personalCards');
    const searchInput = document.getElementById('employeeSearch');
    const shiftFilter = document.getElementById('shiftFilter');

    container.innerHTML = '';

    // Get filter values
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedShift = shiftFilter ? shiftFilter.value : '';

    // Group filtered records by employee
    const employeeRecords = new Map();
    filteredRecords.forEach(record => {
        if (!employeeRecords.has(record.userId)) {
            employeeRecords.set(record.userId, {
                name: record.uName,
                records: []
            });
        }
        employeeRecords.get(record.userId).records.push(record);
    });

    // Filter and create cards for each employee
    let visibleCount = 0;
    employeeRecords.forEach((emp, userId) => {
        // Apply search filter
        if (searchTerm && !emp.name.toLowerCase().includes(searchTerm) && !userId.includes(searchTerm)) {
            return;
        }

        // Apply shift filter
        if (selectedShift) {
            const empConfig = individualShiftConfigs[userId];
            if (selectedShift === 'default') {
                // Show only employees using default
                if (empConfig && empConfig.presetId) return;
            } else {
                // Show only employees using this specific preset
                const presetId = parseInt(selectedShift);
                if (!empConfig || empConfig.presetId !== presetId) return;
            }
        }

        visibleCount++;
        const card = document.createElement('div');
        card.className = 'person-card animate-slide-up clickable';
        card.setAttribute('data-user-id', userId);

        // Count unique days
        const uniqueDays = new Set(emp.records.map(r => r.date)).size;

        card.innerHTML = `
            <div class="person-header">
                <div class="person-avatar">${emp.name.charAt(0).toUpperCase()}</div>
                <div class="person-info">
                    <h3>${emp.name}</h3>
                    <span class="employee-id">รหัส: ${userId}</span>
                </div>
            </div>
            <div class="person-body">
                <div class="person-stats">
                    <div class="person-stat">
                        <span class="person-stat-value">${emp.records.length}</span>
                        <span class="person-stat-label">ครั้งที่สแกน</span>
                    </div>
                    <div class="person-stat">
                        <span class="person-stat-value">${uniqueDays}</span>
                        <span class="person-stat-label">วันทำงาน</span>
                    </div>
                </div>
            </div>
        `;

        // Add click event to open modal
        card.addEventListener('click', () => openEmployeeModal(userId, emp));
        container.appendChild(card);
    });
}

// ========================================
// Employee Modal Functions
// ========================================
function openEmployeeModal(userId, emp) {
    const modal = document.getElementById('employeeModal');
    const modalName = document.getElementById('modalEmployeeName');
    const modalId = document.getElementById('modalEmployeeId');
    const tbody = document.getElementById('employeeDetailBody');

    // Store current employee for individual shift settings
    currentModalEmployee = { userId, emp };

    modalName.textContent = emp.name;
    modalId.textContent = `ID: ${userId}`;

    // Load individual shift config or use global default
    const empShiftConfig = getEmployeeShiftConfig(userId);

    // Update modal shift settings UI (populate dropdown)
    updateModalShiftUI(userId);

    // Render the attendance table
    renderEmployeeAttendanceTable(userId, emp, empShiftConfig);

    // Show modal
    modal.classList.add('active');
}

function getEmployeeShiftConfig(userId) {
    // Check individual config first
    if (individualShiftConfigs[userId]) {
        return individualShiftConfigs[userId];
    }
    // Fall back to global config (default preset)
    return { ...shiftConfig };
}

function updateModalShiftUI(userId) {
    const select = document.getElementById('employeeShiftSelect');
    const indicator = document.getElementById('currentShiftIndicator');
    if (!select) return;

    // Clear and populate options
    select.innerHTML = '';

    // Add "ใช้ค่าเริ่มต้น" option
    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'default';
    const defaultPreset = shiftPresets.find(p => p.isDefault);
    defaultOpt.textContent = `ค่าเริ่มต้น (${defaultPreset ? defaultPreset.name : 'กะเช้า'})`;
    select.appendChild(defaultOpt);

    // Add preset options
    shiftPresets.forEach(preset => {
        const opt = document.createElement('option');
        opt.value = preset.id.toString();
        opt.textContent = `${preset.icon} ${preset.name} (${preset.startTime} - ${preset.endTime}${preset.isNextDay ? ' +1' : ''})`;
        select.appendChild(opt);
    });

    // Check if employee has individual config
    const individualConfig = individualShiftConfigs[userId];
    if (individualConfig && individualConfig.presetId) {
        select.value = individualConfig.presetId.toString();
        indicator.textContent = '✓ กำหนดเอง';
        indicator.className = 'current-shift-indicator custom';
    } else {
        select.value = 'default';
        indicator.textContent = '';
        indicator.className = 'current-shift-indicator';
    }

    // Add change handler
    select.onchange = function () {
        applyEmployeeShiftFromSelect(userId);
    };
}

function renderEmployeeAttendanceTable(userId, emp, empShiftConfig) {
    const tbody = document.getElementById('employeeDetailBody');

    // Group records by date
    const dateRecords = new Map();
    emp.records.forEach(r => {
        if (!dateRecords.has(r.date)) {
            dateRecords.set(r.date, []);
        }
        dateRecords.get(r.date).push(r.time);
    });

    // Sort times for each date
    dateRecords.forEach((times, date) => {
        times.sort();
    });

    // Generate table rows
    tbody.innerHTML = '';
    let totalOTMinutes = 0;
    const sortedDates = Array.from(dateRecords.keys()).sort();

    sortedDates.forEach(date => {
        const times = dateRecords.get(date);
        const processed = processTimesForDay(times, empShiftConfig);

        totalOTMinutes += processed.otMinutes;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatThaiDate(date)}</td>
            <td class="time-cell ${processed.clockIn ? '' : 'empty'}">${processed.clockIn || '-'}</td>
            <td class="time-cell ${processed.breakOut ? '' : 'empty'}">${processed.breakOut || '-'}</td>
            <td class="time-cell ${processed.breakIn ? '' : 'empty'}">${processed.breakIn || '-'}</td>
            <td class="time-cell ${processed.clockOut ? '' : 'empty'}">${processed.clockOut || '-'}</td>
            <td class="ot-cell ${processed.ot !== '-' ? 'has-ot' : ''}">${processed.ot}</td>
        `;
        tbody.appendChild(tr);
    });

    // Update totals
    document.getElementById('totalDaysWorked').textContent = `${sortedDates.length} วัน`;
    document.getElementById('totalOT').textContent = formatOT(totalOTMinutes);
}

function processTimesForDay(times, empShiftConfig) {
    // Sort times
    times.sort();

    let clockIn = null;
    let breakOut = null;
    let breakIn = null;
    let clockOut = null;
    let otMinutes = 0;

    if (times.length >= 1) {
        // First scan - clock in
        clockIn = times[0];
    }

    if (times.length >= 2) {
        // If 2 scans: clock in and clock out
        if (times.length === 2) {
            clockOut = times[1];
        }
        // If 3 scans: clock in, break out, clock out
        else if (times.length === 3) {
            breakOut = times[1];
            clockOut = times[2];
        }
        // If 4+ scans: clock in, break out, break in, clock out (plus extras)
        else if (times.length >= 4) {
            breakOut = times[1];
            breakIn = times[2];
            clockOut = times[times.length - 1];
        }
    }

    // Calculate OT based on shift configuration
    if (clockOut) {
        otMinutes = calculateOT(clockIn, clockOut, empShiftConfig);
    }

    return {
        clockIn,
        breakOut,
        breakIn,
        clockOut,
        ot: otMinutes > 0 ? formatOT(otMinutes) : '-',
        otMinutes
    };
}

// Calculate OT based on shift configuration
function calculateOT(clockIn, clockOut, empShiftConfig) {
    if (!clockIn || !clockOut) return 0;

    const config = empShiftConfig || shiftConfig;

    // Parse clock in time
    const [inHours, inMinutes] = clockIn.split(':').map(Number);
    let clockInMinutes = inHours * 60 + inMinutes;

    // Parse clock out time
    const [outHours, outMinutes] = clockOut.split(':').map(Number);
    let clockOutMinutes = outHours * 60 + outMinutes;

    // For next day shifts (e.g., night shift), adjust clock out time
    if (config.isNextDay && outHours < 12) {
        // Clock out is after midnight, add 24 hours
        clockOutMinutes += 24 * 60;
    }

    // Calculate total work time in minutes
    const totalWorkMinutes = clockOutMinutes - clockInMinutes;

    // Calculate expected work time (work hours + break hours) in minutes
    const expectedWorkMinutes = (config.workHours + config.breakHours) * 60;

    // OT = total work time - expected work time
    const otMinutes = totalWorkMinutes - expectedWorkMinutes;

    return otMinutes > 0 ? otMinutes : 0;
}

function formatOT(minutes) {
    if (minutes === 0) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
        return `${hours} ชม. ${mins} น.`;
    } else if (hours > 0) {
        return `${hours} ชม.`;
    } else {
        return `${mins} น.`;
    }
}

function closeEmployeeModal() {
    const modal = document.getElementById('employeeModal');
    modal.classList.remove('active');
}

// Modal event listeners
document.addEventListener('DOMContentLoaded', function () {
    const modalClose = document.getElementById('modalClose');
    const modal = document.getElementById('employeeModal');

    if (modalClose) {
        modalClose.addEventListener('click', closeEmployeeModal);
    }

    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeEmployeeModal();
            }
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeEmployeeModal();
        }
    });
});

// ========================================
// Timeline View Rendering
// ========================================
function renderTimelineView() {
    const container = document.getElementById('timelineContainer');
    container.innerHTML = '';

    // Group records by date
    const dateRecords = new Map();
    filteredRecords.forEach(record => {
        if (!dateRecords.has(record.date)) {
            dateRecords.set(record.date, []);
        }
        dateRecords.get(record.date).push(record);
    });

    // Sort dates descending (newest first)
    const sortedDates = Array.from(dateRecords.keys()).sort().reverse();

    sortedDates.forEach(date => {
        const records = dateRecords.get(date);

        // Group by employee for this date
        const empRecords = new Map();
        records.forEach(r => {
            if (!empRecords.has(r.userId)) {
                empRecords.set(r.userId, { name: r.uName, times: [] });
            }
            empRecords.get(r.userId).times.push(r.time);
        });

        const dayEl = document.createElement('div');
        dayEl.className = 'timeline-day animate-slide-up';

        dayEl.innerHTML = `
            <div class="timeline-header">
                <div class="timeline-date">
                    <span class="date-icon">📅</span>
                    <div>
                        <h3>${formatThaiDate(date)}</h3>
                        <span class="day-name">${getThaiDayName(date)}</span>
                    </div>
                </div>
                <div class="timeline-summary">
                    <div class="timeline-summary-item">
                        <span class="value">${empRecords.size}</span>
                        <span class="label">พนักงาน</span>
                    </div>
                    <div class="timeline-summary-item">
                        <span class="value">${records.length}</span>
                        <span class="label">การสแกน</span>
                    </div>
                </div>
            </div>
            <div class="timeline-body">
                <div class="timeline-employees">
                    ${Array.from(empRecords.entries()).map(([id, emp]) => `
                        <div class="timeline-employee-card">
                            <div class="employee-header">
                                <div class="employee-mini-avatar">${emp.name.charAt(0).toUpperCase()}</div>
                                <div class="employee-info-timeline">
                                    <span class="employee-name">${emp.name}</span>
                                    <span class="employee-id-badge">ID: ${id}</span>
                                </div>
                            </div>
                            <div class="employee-scans">
                                ${emp.times.map((time, idx) => `
                                    <span class="scan-chip ${idx === 0 ? 'first' : ''} ${idx === emp.times.length - 1 && emp.times.length > 1 ? 'last' : ''}">
                                        ${idx === 0 ? '🟢' : idx === emp.times.length - 1 && emp.times.length > 1 ? '🔴' : '⏱️'} ${time}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        container.appendChild(dayEl);
    });
}

// ========================================
// Export to CSV
// ========================================
function exportToCSV() {
    if (filteredRecords.length === 0) {
        alert('ไม่มีข้อมูลสำหรับส่งออก');
        return;
    }

    const headers = ['ลำดับ', 'รหัสเครื่อง', 'รหัสพนักงาน', 'ชื่อพนักงาน', 'Verify', 'วันที่', 'เวลา'];
    const rows = filteredRecords.map(r => [r.no, r.devId, r.userId, r.uName, r.verify, r.date, r.time]);

    let csvContent = '\ufeff'; // BOM for UTF-8
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ========================================
// Utility Functions
// ========================================
function formatThaiDate(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;

    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    const year = parts[0];
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);

    return `${day} ${months[month]} ${year}`;
}

function getThaiDayName(dateStr) {
    const parts = dateStr.split('/');
    const date = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);

    const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ',
        'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

    return days[date.getDay()];
}

// ========================================
// Auto-load file if available (for demo)
// ========================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('ระบบพร้อมใช้งาน - กรุณาอัปโหลดไฟล์ข้อมูล');
    initShiftSettings();
});

// ========================================
// Shift Configuration Functions
// ========================================
function initShiftSettings() {
    const shiftSelect = document.getElementById('shiftSelect');
    const shiftStart = document.getElementById('shiftStart');
    const shiftEnd = document.getElementById('shiftEnd');
    const nextDayCheckbox = document.getElementById('nextDayCheckbox');
    const workHours = document.getElementById('workHours');
    const breakHours = document.getElementById('breakHours');
    const saveShiftBtn = document.getElementById('saveShiftBtn');
    const presetBtns = document.querySelectorAll('.preset-btn');

    // Load saved config from localStorage
    const savedConfig = localStorage.getItem('shiftConfig');
    if (savedConfig) {
        shiftConfig = JSON.parse(savedConfig);
        applyShiftToUI();
    }

    // Shift select change handler
    if (shiftSelect) {
        shiftSelect.addEventListener('change', function () {
            const preset = presetShifts[this.value];
            if (preset && this.value !== 'custom') {
                applyPreset(preset);
            }
        });
    }

    // Time input change handlers - update OT display
    if (shiftStart) shiftStart.addEventListener('change', updateOTDisplay);
    if (shiftEnd) shiftEnd.addEventListener('change', updateOTDisplay);
    if (workHours) workHours.addEventListener('change', updateOTDisplay);
    if (breakHours) breakHours.addEventListener('change', updateOTDisplay);

    // Save button handler
    if (saveShiftBtn) {
        saveShiftBtn.addEventListener('click', saveShiftSettings);
    }

    // Preset button handlers
    presetBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const shiftType = this.dataset.shift;
            const preset = presetShifts[shiftType];
            if (preset) {
                applyPreset(preset);
                saveShiftSettings(); ใ

                // Update active state
                presetBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });

    // Initial OT display update
    updateOTDisplay();
}

function applyPreset(preset) {
    const shiftSelect = document.getElementById('shiftSelect');
    const shiftStart = document.getElementById('shiftStart');
    const shiftEnd = document.getElementById('shiftEnd');
    const nextDayCheckbox = document.getElementById('nextDayCheckbox');
    const workHours = document.getElementById('workHours');
    const breakHours = document.getElementById('breakHours');

    if (shiftSelect) shiftSelect.value = preset.name;
    if (shiftStart) shiftStart.value = preset.startTime;
    if (shiftEnd) shiftEnd.value = preset.endTime;
    if (nextDayCheckbox) nextDayCheckbox.checked = preset.isNextDay;
    if (workHours) workHours.value = preset.workHours;
    if (breakHours) breakHours.value = preset.breakHours;

    updateOTDisplay();
}

function applyShiftToUI() {
    const shiftSelect = document.getElementById('shiftSelect');
    const shiftStart = document.getElementById('shiftStart');
    const shiftEnd = document.getElementById('shiftEnd');
    const nextDayCheckbox = document.getElementById('nextDayCheckbox');
    const workHours = document.getElementById('workHours');
    const breakHours = document.getElementById('breakHours');

    if (shiftSelect) shiftSelect.value = shiftConfig.name;
    if (shiftStart) shiftStart.value = shiftConfig.startTime;
    if (shiftEnd) shiftEnd.value = shiftConfig.endTime;
    if (nextDayCheckbox) nextDayCheckbox.checked = shiftConfig.isNextDay;
    if (workHours) workHours.value = shiftConfig.workHours;
    if (breakHours) breakHours.value = shiftConfig.breakHours;
    if (nextDayCheckbox) nextDayCheckbox.checked = shiftConfig.isNextDay;

    updateCurrentShiftLabel();
}

function updateCurrentShiftLabel() {
    const label = document.getElementById('currentShiftLabel');
    if (label) {
        label.textContent = `${shiftConfig.workHours} ชม. + พัก ${shiftConfig.breakHours} ชม.${shiftConfig.isNextDay ? ' (ข้ามวัน)' : ''}`;
    }
}

function saveGlobalShiftSettings() {
    const workHours = document.getElementById('globalWorkHours');
    const breakHours = document.getElementById('globalBreakHours');
    const nextDayCheckbox = document.getElementById('globalNextDay');

    shiftConfig = {
        workHours: workHours ? parseFloat(workHours.value) : 9,
        breakHours: breakHours ? parseFloat(breakHours.value) : 1,
        isNextDay: nextDayCheckbox ? nextDayCheckbox.checked : false
    };

    // Save to localStorage
    localStorage.setItem('shiftConfig', JSON.stringify(shiftConfig));

    // Update label
    updateCurrentShiftLabel();

    // Close modal
    closeShiftSettingsModal();

    // Show toast notification
    showToast('✅ บันทึกการตั้งค่ากะสำเร็จ!');

    // Re-render views to apply new OT calculation
    renderCurrentView();
}

function openShiftSettingsModal() {
    const modal = document.getElementById('shiftSettingsModal');
    const workHours = document.getElementById('globalWorkHours');
    const breakHours = document.getElementById('globalBreakHours');
    const nextDayCheckbox = document.getElementById('globalNextDay');

    // Load current values
    if (workHours) workHours.value = shiftConfig.workHours;
    if (breakHours) breakHours.value = shiftConfig.breakHours;
    if (nextDayCheckbox) nextDayCheckbox.checked = shiftConfig.isNextDay;

    modal.classList.add('active');
}

function closeShiftSettingsModal() {
    const modal = document.getElementById('shiftSettingsModal');
    modal.classList.remove('active');
}

// ========================================
// Individual Shift Settings Functions
// ========================================
function applyEmployeeShiftFromSelect(userId) {
    if (!currentModalEmployee) return;

    const select = document.getElementById('employeeShiftSelect');
    const indicator = document.getElementById('currentShiftIndicator');
    if (!select) return;

    const { emp } = currentModalEmployee;
    const selectedValue = select.value;

    if (selectedValue === 'default') {
        // Remove individual config, use default
        delete individualShiftConfigs[userId];
        indicator.textContent = '';
        indicator.className = 'current-shift-indicator';
    } else {
        // Find the preset
        const presetId = parseInt(selectedValue);
        const preset = shiftPresets.find(p => p.id === presetId);

        if (preset) {
            individualShiftConfigs[userId] = {
                presetId: preset.id,
                workHours: preset.workHours,
                breakHours: preset.breakHours,
                isNextDay: preset.isNextDay
            };
            indicator.textContent = '✓ กำหนดเอง';
            indicator.className = 'current-shift-indicator custom';
        }
    }

    // Save to sessionStorage
    sessionStorage.setItem('individualShiftConfigs', JSON.stringify(individualShiftConfigs));

    // Re-render the table with new config
    const empShiftConfig = getEmployeeShiftConfig(userId);
    renderEmployeeAttendanceTable(userId, emp, empShiftConfig);

    // Show toast
    if (selectedValue === 'default') {
        showToast(`🔄 ${emp.name} ใช้กะเริ่มต้น`);
    } else {
        const preset = shiftPresets.find(p => p.id === parseInt(selectedValue));
        showToast(`✅ ${emp.name} → ${preset ? preset.name : 'กะใหม่'}`);
    }
}

function showToast(message) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.shift-saved-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'shift-saved-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Remove after animation
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ========================================
// Additional Event Listeners Setup
// ========================================
document.addEventListener('DOMContentLoaded', function () {
    // Open shift settings modal button
    const openShiftBtn = document.getElementById('openShiftModal');
    if (openShiftBtn) {
        openShiftBtn.addEventListener('click', openShiftSettingsModal);
    }

    // Close shift settings modal button
    const shiftModalClose = document.getElementById('shiftModalClose');
    if (shiftModalClose) {
        shiftModalClose.addEventListener('click', closeShiftSettingsModal);
    }

    // Close shift settings modal on backdrop click
    const shiftSettingsModal = document.getElementById('shiftSettingsModal');
    if (shiftSettingsModal) {
        shiftSettingsModal.addEventListener('click', function (e) {
            if (e.target === shiftSettingsModal) {
                closeShiftSettingsModal();
            }
        });
    }

    // Save global shift button
    const saveGlobalBtn = document.getElementById('saveGlobalShift');
    if (saveGlobalBtn) {
        saveGlobalBtn.addEventListener('click', saveGlobalShiftSettings);
    }

    // Global preset buttons in settings modal
    const globalPresetBtns = document.querySelectorAll('#shiftSettingsModal .preset-btn');
    globalPresetBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const workHours = this.dataset.work;
            const breakHours = this.dataset.break;
            const nextDay = this.dataset.nextday === 'true';

            document.getElementById('globalWorkHours').value = workHours;
            document.getElementById('globalBreakHours').value = breakHours;
            document.getElementById('globalNextDay').checked = nextDay;


            // Update active state
            globalPresetBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Personal View search and filter
    const employeeSearch = document.getElementById('employeeSearch');
    if (employeeSearch) {
        employeeSearch.addEventListener('input', function () {
            renderPersonalView();
        });
    }

    const shiftFilterSelect = document.getElementById('shiftFilter');
    if (shiftFilterSelect) {
        shiftFilterSelect.addEventListener('change', function () {
            renderPersonalView();
        });
    }

    // Load individual configs from sessionStorage
    const savedIndividualConfigs = sessionStorage.getItem('individualShiftConfigs');
    if (savedIndividualConfigs) {
        individualShiftConfigs = JSON.parse(savedIndividualConfigs);
    }

    // Load shift presets from localStorage
    const savedPresets = localStorage.getItem('shiftPresets');
    if (savedPresets) {
        shiftPresets = JSON.parse(savedPresets);
    }

    // Update global shiftConfig from default preset
    updateShiftConfigFromDefault();

    // Shift View button
    const shiftViewBtn = document.getElementById('shiftViewBtn');
    if (shiftViewBtn) {
        shiftViewBtn.addEventListener('click', () => switchView('shift'));
    }

    // Add New Shift button
    const addNewShiftBtn = document.getElementById('addNewShiftBtn');
    if (addNewShiftBtn) {
        addNewShiftBtn.addEventListener('click', addNewShiftPreset);
    }

    // Edit Shift Modal close button
    const editShiftModalClose = document.getElementById('editShiftModalClose');
    if (editShiftModalClose) {
        editShiftModalClose.addEventListener('click', closeEditShiftModal);
    }

    // Edit Shift Modal backdrop click
    const editShiftModal = document.getElementById('editShiftModal');
    if (editShiftModal) {
        editShiftModal.addEventListener('click', function (e) {
            if (e.target === editShiftModal) {
                closeEditShiftModal();
            }
        });
    }

    // Save Shift Preset button
    const saveShiftPresetBtn = document.getElementById('saveShiftPreset');
    if (saveShiftPresetBtn) {
        saveShiftPresetBtn.addEventListener('click', saveShiftPreset);
    }

    // Delete Shift Preset button
    const deleteShiftPresetBtn = document.getElementById('deleteShiftPreset');
    if (deleteShiftPresetBtn) {
        deleteShiftPresetBtn.addEventListener('click', deleteShiftPreset);
    }
});

// ========================================
// Shift View Functions
// ========================================
function renderShiftView() {
    const grid = document.getElementById('shiftPresetsGrid');
    if (!grid) return;

    grid.innerHTML = '';

    // Render preset cards
    shiftPresets.forEach(preset => {
        const card = document.createElement('div');
        card.className = `shift-preset-card${preset.isDefault ? ' default' : ''}`;
        card.onclick = () => openEditShiftModal(preset.id);

        card.innerHTML = `
            ${preset.isDefault ? '<span class="default-badge">ค่าเริ่มต้น</span>' : ''}
            <div class="shift-preset-icon">${preset.icon}</div>
            <div class="shift-preset-name">${preset.name}</div>
            <div class="shift-preset-times">
                <div class="shift-time-info">
                    <span class="label">เข้างาน</span>
                    <span class="value">${preset.startTime}</span>
                </div>
                <div class="shift-time-info">
                    <span class="label">เลิกงาน</span>
                    <span class="value">${preset.endTime}${preset.isNextDay ? ' (+1)' : ''}</span>
                </div>
            </div>
            <div class="shift-preset-details">
                <div class="shift-detail-item">
                    ⏱️ ทำงาน <span class="value">${preset.workHours} ชม.</span>
                </div>
                <div class="shift-detail-item">
                    ☕ พัก <span class="value">${preset.breakHours} ชม.</span>
                </div>
            </div>
            <span class="edit-hint">คลิกเพื่อแก้ไข ✏️</span>
        `;
        grid.appendChild(card);
    });

    // Add "Add New" card
    const addCard = document.createElement('div');
    addCard.className = 'shift-preset-card add-new';
    addCard.onclick = addNewShiftPreset;
    addCard.innerHTML = `
        <div class="add-icon">➕</div>
        <div class="add-text">เพิ่มกะใหม่</div>
    `;
    grid.appendChild(addCard);
}

function openEditShiftModal(presetId) {
    const preset = shiftPresets.find(p => p.id === presetId);
    if (!preset) return;

    editingPresetId = presetId;

    // Populate form
    document.getElementById('shiftPresetName').value = preset.name;
    document.getElementById('shiftPresetIcon').value = preset.icon;
    document.getElementById('shiftPresetIsDefault').checked = preset.isDefault;

    // Convert time to select value (handle next day)
    document.getElementById('shiftPresetStart').value = preset.startTime;
    document.getElementById('shiftPresetEnd').value = timeToSelectValue(preset.endTime, preset.isNextDay);

    document.getElementById('shiftPresetWorkHours').value = preset.workHours;
    document.getElementById('shiftPresetBreakHours').value = preset.breakHours;

    // Update modal title
    document.getElementById('editShiftModalTitle').textContent = '✏️ แก้ไข: ' + preset.name;

    // Show/hide delete button (can't delete if only one preset)
    const deleteBtn = document.getElementById('deleteShiftPreset');
    if (deleteBtn) {
        deleteBtn.style.display = shiftPresets.length > 1 ? 'inline-flex' : 'none';
    }

    // Show modal
    document.getElementById('editShiftModal').classList.add('active');
}

function closeEditShiftModal() {
    document.getElementById('editShiftModal').classList.remove('active');
    editingPresetId = null;
}

function addNewShiftPreset() {
    const newId = Math.max(...shiftPresets.map(p => p.id), 0) + 1;
    const newPreset = {
        id: newId,
        name: 'กะใหม่',
        icon: '⏰',
        startTime: '09:00',
        endTime: '18:00',
        workHours: 8,
        breakHours: 1,
        isNextDay: false,
        isDefault: false
    };

    shiftPresets.push(newPreset);
    saveShiftPresetsToStorage();
    renderShiftView();
    openEditShiftModal(newId);
}

function saveShiftPreset() {
    if (!editingPresetId) return;

    const preset = shiftPresets.find(p => p.id === editingPresetId);
    if (!preset) return;

    // Get form values
    preset.name = document.getElementById('shiftPresetName').value || 'กะไม่มีชื่อ';
    preset.icon = document.getElementById('shiftPresetIcon').value;
    preset.startTime = document.getElementById('shiftPresetStart').value;

    // Parse end time and determine isNextDay
    const endTimeRaw = document.getElementById('shiftPresetEnd').value;
    const endTimeData = normalizeTimeForStorage(endTimeRaw);
    preset.endTime = endTimeData.time;
    preset.isNextDay = endTimeData.isNextDay;

    preset.workHours = parseFloat(document.getElementById('shiftPresetWorkHours').value) || 8;
    preset.breakHours = parseFloat(document.getElementById('shiftPresetBreakHours').value) || 1;

    // Handle default setting
    const isDefault = document.getElementById('shiftPresetIsDefault').checked;
    if (isDefault) {
        // Remove default from all others
        shiftPresets.forEach(p => p.isDefault = false);
        preset.isDefault = true;
    } else if (preset.isDefault) {
        // If this was default but unchecked, keep it as default (can't have no default)
        preset.isDefault = true;
    }

    saveShiftPresetsToStorage();
    updateShiftConfigFromDefault();
    closeEditShiftModal();
    renderShiftView();
    showToast('✅ บันทึกกะ "' + preset.name + '" สำเร็จ!');
}

function deleteShiftPreset() {
    if (!editingPresetId || shiftPresets.length <= 1) return;

    const preset = shiftPresets.find(p => p.id === editingPresetId);
    const presetName = preset ? preset.name : '';

    shiftPresets = shiftPresets.filter(p => p.id !== editingPresetId);

    // If deleted preset was default, make first one default
    if (preset && preset.isDefault && shiftPresets.length > 0) {
        shiftPresets[0].isDefault = true;
    }

    saveShiftPresetsToStorage();
    updateShiftConfigFromDefault();
    closeEditShiftModal();
    renderShiftView();
    showToast('🗑️ ลบกะ "' + presetName + '" แล้ว');
}

function saveShiftPresetsToStorage() {
    localStorage.setItem('shiftPresets', JSON.stringify(shiftPresets));
}

function updateShiftConfigFromDefault() {
    const defaultPreset = shiftPresets.find(p => p.isDefault);
    if (defaultPreset) {
        shiftConfig = {
            workHours: defaultPreset.workHours,
            breakHours: defaultPreset.breakHours,
            isNextDay: defaultPreset.isNextDay
        };
    }
}

// ========================================
// Time Dropdown Functions
// ========================================
function generateTimeOptions(selectId, includeNextDay = true) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '';

    // Generate times from 00:00 to 23:30 (current day)
    for (let hour = 0; hour < 24; hour++) {
        for (let min = 0; min < 60; min += 30) {
            const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            const displayStr = formatTimeDisplay(hour, min);
            const option = document.createElement('option');
            option.value = timeStr;
            option.textContent = displayStr;
            select.appendChild(option);
        }
    }

    // Add next day times (00:00 to 08:00 next day) if enabled
    if (includeNextDay) {
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '── วันถัดไป ──';
        select.appendChild(separator);

        for (let hour = 0; hour <= 8; hour++) {
            for (let min = 0; min < 60; min += 30) {
                if (hour === 8 && min > 0) break; // Stop at 08:00
                const timeStr = `${(hour + 24).toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                const displayStr = formatTimeDisplay(hour, min) + ' (วันถัดไป)';
                const option = document.createElement('option');
                option.value = timeStr;
                option.textContent = displayStr;
                option.className = 'next-day';
                select.appendChild(option);
            }
        }
    }
}

function formatTimeDisplay(hour, min) {
    const hourStr = hour.toString().padStart(2, '0');
    const minStr = min.toString().padStart(2, '0');
    return `${hourStr}:${minStr}`;
}

function parseTimeValue(timeStr) {
    // Handle next day format (24:00+)
    const [hours, mins] = timeStr.split(':').map(Number);
    return { hours, mins, isNextDay: hours >= 24 };
}

function normalizeTimeForStorage(timeStr) {
    // Convert 24+ hour format to normal format + isNextDay flag
    const { hours, mins, isNextDay } = parseTimeValue(timeStr);
    const normalHours = hours >= 24 ? hours - 24 : hours;
    return {
        time: `${normalHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
        isNextDay
    };
}

function timeToSelectValue(time, isNextDay) {
    // Convert stored time + isNextDay to select value
    if (isNextDay) {
        const [hours, mins] = time.split(':').map(Number);
        return `${(hours + 24).toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    return time;
}

// Generate filter time options (simpler version without "ไม่ระบุ" removal)
function generateFilterTimeOptions(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Keep the first option (ไม่ระบุ)
    const firstOption = select.querySelector('option');
    select.innerHTML = '';
    if (firstOption) {
        select.appendChild(firstOption);
    }

    // Generate times from 00:00 to 23:30
    for (let hour = 0; hour < 24; hour++) {
        for (let min = 0; min < 60; min += 30) {
            const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            const option = document.createElement('option');
            option.value = timeStr;
            option.textContent = timeStr;
            select.appendChild(option);
        }
    }
}

// Initialize time selects on page load
document.addEventListener('DOMContentLoaded', function () {
    generateTimeOptions('shiftPresetStart', false);
    generateTimeOptions('shiftPresetEnd', true);

    // Filter time dropdowns
    generateFilterTimeOptions('timeRangeFrom');
    generateFilterTimeOptions('timeRangeTo');
});
