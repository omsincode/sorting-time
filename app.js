// ========================================
// State Management
// ========================================
let allRecords = [];
let filteredRecords = [];
let employees = new Map();
let dates = new Set();

// Shift Configuration
let shiftConfig = {
    name: 'morning',
    startTime: '09:00',
    endTime: '19:00',
    workHours: 9,
    breakHours: 1,
    isNextDay: false
};

// Preset shifts
const presetShifts = {
    morning: { name: 'morning', startTime: '09:00', endTime: '19:00', workHours: 9, breakHours: 1, isNextDay: false },
    night: { name: 'night', startTime: '16:00', endTime: '02:00', workHours: 9, breakHours: 1, isNextDay: true },
    day: { name: 'day', startTime: '08:00', endTime: '17:00', workHours: 9, breakHours: 1, isNextDay: false }
};

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
    document.getElementById('shiftSection').style.display = 'block';
    filterSection.style.display = 'block';
    statsSection.style.display = 'grid';
    viewToggle.style.display = 'flex';
    tableView.style.display = 'block';
}

function switchView(view) {
    // Update button states
    tableViewBtn.classList.remove('active');
    personalViewBtn.classList.remove('active');
    timelineViewBtn.classList.remove('active');

    // Hide all views
    tableView.style.display = 'none';
    personalView.style.display = 'none';
    timelineView.style.display = 'none';

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
    }
}

function renderCurrentView() {
    if (tableViewBtn.classList.contains('active')) {
        renderTableView();
    } else if (personalViewBtn.classList.contains('active')) {
        renderPersonalView();
    } else if (timelineViewBtn.classList.contains('active')) {
        renderTimelineView();
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
function renderPersonalView() {
    const container = document.getElementById('personalCards');
    container.innerHTML = '';

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

    // Create cards for each employee
    employeeRecords.forEach((emp, userId) => {
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

    modalName.textContent = emp.name;
    modalId.textContent = `ID: ${userId}`;

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
        const processed = processTimesForDay(times);

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

    // Show modal
    modal.classList.add('active');
}

function processTimesForDay(times) {
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
        otMinutes = calculateOT(clockIn, clockOut);
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
function calculateOT(clockIn, clockOut) {
    if (!clockIn || !clockOut) return 0;

    // Parse clock in time
    const [inHours, inMinutes] = clockIn.split(':').map(Number);
    let clockInMinutes = inHours * 60 + inMinutes;

    // Parse clock out time
    const [outHours, outMinutes] = clockOut.split(':').map(Number);
    let clockOutMinutes = outHours * 60 + outMinutes;

    // For next day shifts (e.g., night shift), adjust clock out time
    if (shiftConfig.isNextDay && outHours < 12) {
        // Clock out is after midnight, add 24 hours
        clockOutMinutes += 24 * 60;
    }

    // Calculate total work time in minutes
    const totalWorkMinutes = clockOutMinutes - clockInMinutes;

    // Calculate expected work time (work hours + break hours) in minutes
    const expectedWorkMinutes = (shiftConfig.workHours + shiftConfig.breakHours) * 60;

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
                saveShiftSettings();

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

    updateOTDisplay();

    // Update preset button active state
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
        if (btn.dataset.shift === shiftConfig.name) {
            btn.classList.add('active');
        }
    });
}

function updateOTDisplay() {
    const shiftEnd = document.getElementById('shiftEnd');
    const otStartDisplay = document.getElementById('otStartDisplay');

    if (shiftEnd && otStartDisplay) {
        otStartDisplay.textContent = shiftEnd.value || '19:00';
    }
}

function saveShiftSettings() {
    const shiftSelect = document.getElementById('shiftSelect');
    const shiftStart = document.getElementById('shiftStart');
    const shiftEnd = document.getElementById('shiftEnd');
    const nextDayCheckbox = document.getElementById('nextDayCheckbox');
    const workHours = document.getElementById('workHours');
    const breakHours = document.getElementById('breakHours');

    shiftConfig = {
        name: shiftSelect ? shiftSelect.value : 'morning',
        startTime: shiftStart ? shiftStart.value : '09:00',
        endTime: shiftEnd ? shiftEnd.value : '19:00',
        workHours: workHours ? parseFloat(workHours.value) : 9,
        breakHours: breakHours ? parseFloat(breakHours.value) : 1,
        isNextDay: nextDayCheckbox ? nextDayCheckbox.checked : false
    };

    // Save to localStorage
    localStorage.setItem('shiftConfig', JSON.stringify(shiftConfig));

    // Show toast notification
    showToast('✅ บันทึกการตั้งค่ากะสำเร็จ!');

    // Re-render views to apply new OT calculation
    renderCurrentView();
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
