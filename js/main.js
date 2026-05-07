// 全局变量
let selectedDate = null;
let currentYear = 2026;
let currentMonth = 4; // JS月份从0开始，4代表5月
let tasks = {}; // 存储任务的对象，键为日期字符串
let pomodoroHistory = {};
let emotionHistory = {};
let statsMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };

const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    renderCalendar(currentYear, currentMonth);
    setupColorPicker();
    initializeStats();
});

// 1. 渲染日历逻辑
function renderCalendar(year, month) {
    const grid = document.getElementById('calendar-days-grid');
    const monthDisplay = document.getElementById('current-month-display');
    if (!grid || !monthDisplay) return;

    // 获取当前真实时间用于对比
    const realToday = new Date();
    const realDate = realToday.getDate();
    const realMonth = realToday.getMonth();
    const realYear = realToday.getFullYear();

    grid.innerHTML = '';
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    
    monthDisplay.innerText = `${monthNames[month]} ${year}`;

    let firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    let daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        dayCell.innerText = day;

        // 核心：确定是否是“今天”并添加蓝色悬浮类名
        if (day === realDate && month === realMonth && year === realYear) {
            dayCell.classList.add('is-today');
        }

        dayCell.onclick = function() {
            document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('active-date'));
            this.classList.add('active-date');
            selectedDate = `${year}-${month + 1}-${day}`;
            updateTaskList();
            // 这里可以触发加载当天任务的逻辑
        };
        grid.appendChild(dayCell);
    }
}

// 2. 月份切换逻辑
function changeMonth(step) {
    currentMonth += step;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar(currentYear, currentMonth);
}

// 3. 颜色选择器逻辑
let selectedColor = '#007AFF'; // 默认蓝色
function setupColorPicker() {
    const dots = document.querySelectorAll('.color-dot');
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            dots.forEach(d => d.classList.remove('selected'));
            dot.classList.add('selected');
            selectedColor = dot.style.backgroundColor;
        });
    });
}

// 4. 保存任务逻辑 (手稿中的Confirm按钮)
function saveTask() {
    if (!selectedDate) {
        alert("Please select a date first!");
        return;
    }

    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;

    if (!title) return;

    // 获取当前12小时制时间
    const now = new Date();
    const timeString = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const newTask = {
        title: title,
        description: desc,
        color: selectedColor,
        time: timeString,
        completed: false,
        dateKey: selectedDate
    };

    if (!tasks[selectedDate]) tasks[selectedDate] = [];
    tasks[selectedDate].push(newTask);

    // 清空输入框
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    
    updateTaskList();
    refreshStats();
}

// 5. 更新任务列表展示
function updateTaskList() {
    const container = document.getElementById('daily-task-list');
    container.innerHTML = '';

    const dayTasks = tasks[selectedDate] || [];
    
    dayTasks.forEach((task, index) => {
        const completedClass = task.completed ? 'task-completed' : '';
        const item = document.createElement('div');
        item.className = `task-item-entry ${completedClass}`;
        item.innerHTML = `
            <div class="task-info">
                <span class="dot-indicator" style="background: ${task.color};"></span>
                <div class="text-group">
                    <p class="t-name">${task.title}</p>
                    <p class="t-time">${task.time}</p>
                </div>
            </div>
            <button class="task-complete-toggle">${task.completed ? 'Undo' : 'Done'}</button>
        `;
        const toggleButton = item.querySelector('.task-complete-toggle');
        if (toggleButton) {
            toggleButton.onclick = (event) => {
                event.stopPropagation();
                toggleTaskCompletion(selectedDate, index);
            };
        }

        item.onclick = () => {
            if (task.description) alert(`Description: ${task.description}`);
        };
        container.appendChild(item);
    });
}

function toggleTaskCompletion(dateKey, index) {
    if (!tasks[dateKey] || !tasks[dateKey][index]) return;
    tasks[dateKey][index].completed = !tasks[dateKey][index].completed;
    updateTaskList();
    refreshStats();
}

function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getHourlyKey(date) {
    return `${getDateKey(date)}-${String(date.getHours()).padStart(2, '0')}`;
}

function calculateMonthPomodoroMinutes(year, month) {
    return Object.entries(pomodoroHistory).reduce((sum, [dateKey, minutes]) => {
        const [y, m] = dateKey.split('-').map(Number);
        if (y === year && m === month + 1) return sum + minutes;
        return sum;
    }, 0);
}

function computeMonthlyTaskSummary(year, month) {
    let total = 0;
    let completed = 0;
    let pending = 0;

    Object.values(tasks).forEach(dayTasks => {
        dayTasks.forEach(task => {
            const taskDate = task.dateKey || selectedDate || '';
            const [y, m] = taskDate.split('-').map(Number);
            if (y === year && m === month + 1) {
                total++;
                if (task.completed) {
                    completed++;
                } else {
                    pending++;
                }
            }
        });
    });

    const minutes = calculateMonthPomodoroMinutes(year, month);
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pending, minutes, percentage };
}

function refreshStats() {
    updateStatsSummary();
    renderTrendChart();
    renderEmotionTrend();
    updatePomodoroUsage();
    refreshEmotionButtons();
}

function updateStatsSummary() {
    const summary = computeMonthlyTaskSummary(statsMonth.year, statsMonth.month);
    document.getElementById('statTotalTask').textContent = summary.total;
    document.getElementById('statCompletedTask').textContent = summary.completed;
    document.getElementById('statPendingTask').textContent = summary.pending;
    document.getElementById('statStudyMinutes').textContent = summary.minutes;
    document.getElementById('completionFill').style.width = `${summary.percentage}%`;
    document.getElementById('completionText').textContent = summary.percentage === 0 ? 'No tasks completed yet' : `${summary.percentage}% completed this month`;
}

function renderTrendChart() {
    const container = document.getElementById('trendScroll');
    if (!container) return;

    const daysInMonth = new Date(statsMonth.year, statsMonth.month + 1, 0).getDate();
    let maxValue = 30;
    const values = [];

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${statsMonth.year}-${String(statsMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const minutes = pomodoroHistory[dateKey] || 0;
        values.push({ day, minutes });
        if (minutes > maxValue) maxValue = minutes;
    }

    container.innerHTML = values.map(dayInfo => {
        const fillHeight = maxValue === 0 ? 8 : Math.max(8, Math.round((dayInfo.minutes / maxValue) * 100));
        return `
            <div class="trend-day">
                <div class="trend-day-label">${dayInfo.day}</div>
                <div class="trend-bar">
                    <div class="trend-bar-fill" style="height:${fillHeight}%"></div>
                </div>
                <div class="trend-day-value">${dayInfo.minutes}m</div>
            </div>
        `;
    }).join('');
}

function updatePomodoroUsage() {
    const todayKey = getDateKey(new Date());
    const todayMinutes = pomodoroHistory[todayKey] || 0;
    const sessions = todayMinutes === 0 ? 0 : Math.ceil(todayMinutes / 25);
    document.getElementById('dailyPomodoroMinutes').textContent = todayMinutes;
    document.getElementById('todayPomodoroSessions').textContent = sessions;
    const fillPct = Math.min(100, Math.round((todayMinutes / 120) * 100));
    const fill = document.getElementById('pomodoroMeterFill');
    if (fill) fill.style.width = `${fillPct}%`;
}

function recordPomodoroSession(duration = 25) {
    const todayKey = getDateKey(new Date());
    pomodoroHistory[todayKey] = (pomodoroHistory[todayKey] || 0) + duration;
    updatePomodoroUsage();
    renderTrendChart();
    refreshStats();
    showNotification('success', 'Pomodoro recorded', `Added ${duration} minutes to today’s study trend.`);
}

function refreshEmotionButtons() {
    const currentKey = getHourlyKey(new Date());
    const selected = emotionHistory[currentKey];
    const goodBtn = document.getElementById('moodGoodBtn');
    const badBtn = document.getElementById('moodBadBtn');
    if (goodBtn && badBtn) {
        goodBtn.classList.toggle('active', selected === 'good');
        badBtn.classList.toggle('active', selected === 'bad');
    }
}

function renderEmotionTrend() {
    const container = document.getElementById('emotionTrendRow');
    if (!container) return;

    const now = new Date();
    const items = [];
    for (let offset = 4; offset >= 0; offset--) {
        const hourDate = new Date(now.getTime() - offset * 60 * 60 * 1000);
        const hourKey = getHourlyKey(hourDate);
        const mood = emotionHistory[hourKey] || '';
        const label = `${hourDate.getHours()}:00`;
        const icon = mood === 'good' ? '😊' : mood === 'bad' ? '😟' : '–';
        const moodText = mood === 'good' ? 'Good' : mood === 'bad' ? 'Bad' : 'No mood';
        items.push(`
            <div class="emotion-hour-card ${mood}">
                <div class="hour-label">${label}</div>
                <div class="hour-icon">${icon}</div>
                <div class="hour-status">${moodText}</div>
            </div>
        `);
    }

    container.innerHTML = items.join('');
}

function handleMoodClick(mood) {
    const currentKey = getHourlyKey(new Date());
    if (emotionHistory[currentKey] === mood) {
        delete emotionHistory[currentKey];
        showNotification('success', 'Mood removed', 'You can reselect your current hour mood.');
    } else {
        emotionHistory[currentKey] = mood;
        showNotification('success', 'Mood saved', `Recorded a ${mood} mood for this hour.`);
    }
    refreshEmotionButtons();
    renderEmotionTrend();
}

function initializeStats() {
    refreshStats();
    setInterval(() => {
        refreshEmotionButtons();
        renderEmotionTrend();
    }, 60 * 1000);
}
