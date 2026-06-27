let selectedDate = null;
let currentYear = 2026;
let currentMonth = 4; 
let tasks = {}; 
let pomodoroHistory = {};
let emotionHistory = {};
let statsMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };
let pendingEmail = '';

const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

const moodThemeMap = {
    focus: 'theme-focused',
    rational: 'theme-rational',
    neutral: 'theme-relief',
    energetic: 'theme-energy',
    sad: 'theme-warmth',
    happy: 'theme-recovery',
    good: 'theme-recovery',
    bad: 'theme-warmth'
};

function normalizeMoodKey(moodKey) {
    return String(moodKey || '').toLowerCase().trim();
}

function applyMoodTheme(moodKey) {
    const normalized = normalizeMoodKey(moodKey);
    document.body.classList.remove(
        'theme-focused', 'theme-rational', 'theme-relief',
        'theme-energy', 'theme-warmth', 'theme-recovery'
    );

    const targetTheme = moodThemeMap[normalized] || 'theme-focused';
    document.body.classList.add(targetTheme);
    document.body.dataset.moodTheme = targetTheme;
    console.log(`[Theme] Applied mood theme: ${targetTheme} (from ${normalized || 'default'})`);
}

async function initializeMoodTheme() {
    const storageKey = `${getDateKey(new Date())}-dailyMood`;
    const storedMood = localStorage.getItem(storageKey);

    if (storedMood) {
        applyMoodTheme(storedMood);
        return;
    }

    try {
        const response = await fetch('/api/mood/today', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const apiMood = data?.mood || data?.theme || '';
        if (apiMood) {
            localStorage.setItem(storageKey, apiMood);
            applyMoodTheme(apiMood);
            return;
        }
    } catch (error) {
        console.warn('[Theme] /api/mood/today unavailable, using local mood fallback:', error);
    }

    applyMoodTheme('focus');
}

document.addEventListener('DOMContentLoaded', () => {
    renderCalendar(currentYear, currentMonth);
    setupColorPicker();
    initializeStats();
    if (document.getElementById('view-dashboard')?.classList.contains('active')) {
        renderOverviewDashboard();
    }

    if (typeof renderUserIdentity === 'function') {
        renderUserIdentity();
    }
    if (typeof displayUserProfileFromLocalStorage === 'function') {
        displayUserProfileFromLocalStorage();
    }
    if (typeof checkAndRestoreSession === 'function') {
        checkAndRestoreSession();
    }
    initializeMoodTheme();

    const hash = window.location.hash.slice(1);
    if (hash === 'pomodoro') {
        showView('pomodoro');
    } else if (hash === 'otp') {
        showView('otp');
    } else if (hash === 'zen') {
        showView('pomodoro');
        enableZenMode(true);
    } else if (location.pathname.endsWith('index.html') && !hash) {
        showView('intro');
    }
});

function renderUserIdentity() {
    const currentUserJson = localStorage.getItem('currentUser');
    if (!currentUserJson) return;

    try {
        const currentUser = JSON.parse(currentUserJson);
        const displayName = currentUser.fullname || currentUser.name || 'User';
        const displayEmail = currentUser.email || '';
        const avatarChar = (displayName || displayEmail || 'U').charAt(0).toUpperCase();

        const accountNameEl = document.getElementById('accountName');
        const accountEmailEl = document.getElementById('accountEmail');
        const accountAvatarEl = document.getElementById('accountAvatar');
        const leaderboardNameEl = document.getElementById('leaderboardUserName');
        const leaderboardAvatarEl = document.getElementById('leaderboardAvatar');

        if (accountNameEl) accountNameEl.textContent = displayName;
        if (accountEmailEl) accountEmailEl.textContent = displayEmail;
        if (accountAvatarEl) accountAvatarEl.textContent = avatarChar;
        if (leaderboardNameEl) leaderboardNameEl.textContent = displayName;
        if (leaderboardAvatarEl) leaderboardAvatarEl.textContent = avatarChar;
    } catch (error) {
        console.error('[App] renderUserIdentity failed:', error);
    }
}

function renderCalendar(year, month) {
    const grid = document.getElementById('calendar-days-grid');
    const monthDisplay = document.getElementById('current-month-display');
    if (!grid || !monthDisplay) return;

    const realToday = new Date();
    const realDate = realToday.getDate();
    const realMonth = realToday.getMonth();
    const realYear = realToday.getFullYear();
    const todayKey = `${realYear}-${String(realMonth + 1).padStart(2, '0')}-${String(realDate).padStart(2, '0')}`;
    const selectedKey = selectedDate;
    const shouldAutoSelectToday = !selectedDate && year === realYear && month === realMonth;

    grid.innerHTML = '';
    const monthNames = [
        i18n('month-1'),
        i18n('month-2'),
        i18n('month-3'),
        i18n('month-4'),
        i18n('month-5'),
        i18n('month-6'),
        i18n('month-7'),
        i18n('month-8'),
        i18n('month-9'),
        i18n('month-10'),
        i18n('month-11'),
        i18n('month-12')
    ];
    
    monthDisplay.innerText = `${monthNames[month]} ${year}`;

    let firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    let daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        dayCell.innerText = day;

        const isToday = day === realDate && month === realMonth && year === realYear;
        const isPreviouslySelected = selectedKey === dateKey;
        const shouldSelect = isPreviouslySelected || (shouldAutoSelectToday && isToday);

        if (isToday) {
            dayCell.classList.add('is-today');
        }
        if (shouldSelect) {
            dayCell.classList.add('active-date');
            selectedDate = dateKey;
        }

        dayCell.onclick = function() {
            document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('active-date'));
            this.classList.add('active-date');
            selectedDate = dateKey;
            updateTaskList();
            if (typeof loadTasksForDate === 'function') {
                loadTasksForDate(selectedDate);
            }
        };
        grid.appendChild(dayCell);
    }

    if (shouldAutoSelectToday && selectedDate === todayKey) {
        if (typeof loadTasksForDate === 'function') {
            loadTasksForDate(todayKey);
        } else {
            updateTaskList();
        }
    }
}

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

let selectedColor = '#007AFF'; 
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

async function refreshStats() {
    let summary = null;
    
    if (window.api?.fetchStatsSummary) {
        try {
            summary = await window.api.fetchStatsSummary(statsMonth.year, statsMonth.month);
        } catch (error) {
            console.warn('[Stats] fetchStatsSummary failed, using local fallback:', error);
        }
    }

    let data = summary;
    if (summary && summary.stats) {
        data = summary.stats;
    }

    const total = data?.total ?? 0;
    const completed = data?.completed ?? 0;
    const pending = data?.pending ?? 0;
    const minutes = data?.minutes ?? data?.pomodoroMinutes ?? 0; 

    if (document.getElementById('statTotalTask')) document.getElementById('statTotalTask').textContent = total;
    if (document.getElementById('statCompletedTask')) document.getElementById('statCompletedTask').textContent = completed;
    if (document.getElementById('statPendingTask')) document.getElementById('statPendingTask').textContent = pending;
    if (document.getElementById('statMinutes')) document.getElementById('statMinutes').textContent = minutes;

    if (document.getElementById('month-statTotalTask')) document.getElementById('month-statTotalTask').textContent = total;
    if (document.getElementById('month-statCompletedTask')) document.getElementById('month-statCompletedTask').textContent = completed;
    if (document.getElementById('month-statPendingTask')) document.getElementById('month-statPendingTask').textContent = pending;
    if (document.getElementById('month-statMinutes')) document.getElementById('month-statMinutes').textContent = minutes;

    if (typeof updateStatsSummary === 'function') {
        try { updateStatsSummary(summary); } catch(e) { console.warn(e); }
    }
    if (typeof renderTrendChart === 'function') {
        renderTrendChart();
    }
    if (typeof renderEmotionTrend === 'function') {
        renderEmotionTrend();
    }
    if (typeof updatePomodoroUsage === 'function') {
        updatePomodoroUsage();
    }
    if (typeof refreshEmotionButtons === 'function') {
        refreshEmotionButtons();
    }
}

function updateStatsSummary(remoteSummary) {
    const computed = computeMonthlyTaskSummary(statsMonth.year, statsMonth.month);
    
    const totalEl = document.getElementById('statTotalTask') || document.getElementById('ov-stat-total');
    const completedEl = document.getElementById('statCompletedTask') || document.getElementById('ov-stat-completed');
    const pendingEl = document.getElementById('statPendingTask') || document.getElementById('ov-stat-pending');
    const studyMinutesEl = document.getElementById('statMinutes') || document.getElementById('statStudyMinutes') || document.getElementById('ov-stat-minutes');
    const completionFillEl = document.getElementById('completionFill');
    const completionTextEl = document.getElementById('ov-completion-text') || document.getElementById('completionText');
    
    const overviewRingEl = document.getElementById('ov-completion-ring');
    const overviewRingLabelEl = document.getElementById('ov-completion-ring-label');
    const overviewPercentEl = document.getElementById('ov-completion-percent');

    if (!totalEl || !completedEl || !pendingEl) {
        console.warn('[Stats] Core elements missing, skipping rendering.');
        return;
    }

    const total = Number(remoteSummary?.total ?? computed.total);
    const completed = Number(remoteSummary?.completed ?? computed.completed ?? 0);
    const pending = Number(remoteSummary?.pending ?? computed.pending ?? 0);
    const minutes = Number(remoteSummary?.pomodoroMinutes ?? remoteSummary?.minutes ?? computed.minutes ?? 0);
    const percentage = Number(remoteSummary?.completionPercentage ?? remoteSummary?.percentage ?? (total === 0 ? 0 : Math.round((completed / total) * 100)));

    totalEl.textContent = total;
    completedEl.textContent = completed;
    pendingEl.textContent = pending;
    if (studyMinutesEl) studyMinutesEl.textContent = minutes;
    
    if (completionFillEl) {
        completionFillEl.style.transition = 'width 0.45s ease';
        completionFillEl.style.width = `${percentage}%`;
    }
    
    if (completionTextEl) {
        completionTextEl.textContent = percentage === 0 
            ? (window.i18n ? window.i18n('no-tasks-completed') : 'No tasks completed yet') 
            : `${percentage}% ${window.i18n ? window.i18n('completed-this-month') : 'completed this month'}`;
    }
    
    if (overviewRingEl) overviewRingEl.style.setProperty('--progress', `${percentage}%`);
    if (overviewRingLabelEl) overviewRingLabelEl.textContent = `${percentage}%`;
    if (overviewPercentEl) overviewPercentEl.textContent = `${percentage}%`;
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
    const dailyMinutesEl = document.getElementById('dailyPomodoroMinutes');
    const sessionsEl = document.getElementById('todayPomodoroSessions');
    if (dailyMinutesEl) dailyMinutesEl.textContent = todayMinutes;
    if (sessionsEl) sessionsEl.textContent = sessions;
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
        const moodText = mood === 'good' ? window.i18n ? window.i18n('good') : 'Good' : mood === 'bad' ? window.i18n ? window.i18n('bad') : 'Bad' : window.i18n ? window.i18n('no-mood') : 'No mood';
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

const track = document.getElementById('pillTrack');
        const btnLeft = document.querySelector('.pill-arrow-btn.left'); 
        const btnRight = document.querySelector('.pill-arrow-btn.right');

        function updateScrollButtons() {
            if (!track || !btnLeft || !btnRight) return;

            const scrollLeft = track.scrollLeft;
            const maxScroll = track.scrollWidth - track.clientWidth;

            btnLeft.style.display = scrollLeft > 1 ? 'flex' : 'none';
            btnRight.style.display = scrollLeft < (maxScroll - 2) ? 'flex' : 'none';
        }

        function scrollPills(direction) {
            if (!track) return;
            const distance = 160;
            if (direction === 'left') {
                track.scrollBy({ left: -distance, behavior: 'smooth' });
            } else {
                track.scrollBy({ left: distance, behavior: 'smooth' });
            }
        }

        if (track) {
            track.addEventListener('scroll', updateScrollButtons);
            setTimeout(updateScrollButtons, 100);
        }
        window.addEventListener('resize', () => {
            updateScrollButtons();
            updateMobileNavVisibility();
        });

        function updateMobileNavVisibility() {
            const hamburger = document.getElementById('mobileMenuButton');
            const menu = document.getElementById('mobileMenu');
            const mainContainer = document.getElementById('main-container');
            const isMobile = window.innerWidth <= 900;
            const isDashboardPage = mainContainer && mainContainer.classList.contains('dashboard-mode');

            if (hamburger) {
                if (isMobile && isDashboardPage) {
                    hamburger.style.display = 'flex';
                } else {
                    hamburger.style.display = 'none';
                }
            }

            if (menu) {
                if (!isMobile || !isDashboardPage) {
                    menu.classList.remove('open');
                    menu.setAttribute('aria-hidden', 'true');
                }
            }
        }

        let overviewLastRank = null;

        async function renderOverviewDashboard() {
            syncOverviewUserProfile();
            await Promise.all([
                loadOverviewTasks(),
                loadOverviewUserRank(),
                loadOverviewStatsSummary(),
                refreshOverviewMoodSelection(),
            ]);
            updateOverviewTimerButton();
        }

        async function initOverviewIsolatedDashboard() {
            await renderOverviewDashboard();
        }

        function getCurrentLocalUser() {
            try {
                return JSON.parse(localStorage.getItem('currentUser') || 'null');
            } catch (error) {
                return null;
            }
        }

        function syncOverviewUserProfile() {
            const user = getCurrentLocalUser();
            const greeting = document.getElementById('user-greeting');
            const rankElement = document.getElementById('ov-live-rank-value') || document.getElementById('overviewUserRank');

            if (greeting) {
                const displayName = user?.fullname || user?.name || 'Welcome back';
                greeting.textContent = `Hi, ${displayName}`;
            }

            if (rankElement) {
                if (user?.rank) {
                    rankElement.textContent = `#${user.rank}`;
                } else {
                    rankElement.textContent = '';
                }
            }
        }

        async function loadOverviewUserRank() {
            const rankElement = document.getElementById('ov-live-rank-value') || document.getElementById('overviewUserRank');
            if (!rankElement) return;

            try {
                const rankData = await window.api.getUserRank?.();
                if (rankData && rankData.rank && rankData.rank !== '--') {
                    rankElement.textContent = `#${rankData.rank}`;
                    const currentUser = getCurrentLocalUser() || {};
                    if (rankData.rank !== currentUser.rank) {
                        currentUser.rank = rankData.rank;
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    }
                } else {
                    rankElement.textContent = rankElement.textContent || '--';
                }
            } catch (error) {
                console.warn('[Overview] loadOverviewUserRank failed:', error);
                rankElement.textContent = rankElement.textContent || '--';
            }
        }

        async function loadOverviewStatsSummary() {
            try {
                const summary = await window.api.fetchStatsSummary?.(statsMonth.year, statsMonth.month);
                if (summary) {
                    updateStatsSummary(summary);
                } else {
                    updateStatsSummary();
                }
            } catch (error) {
                console.warn('[Overview] loadOverviewStatsSummary failed:', error);
                updateStatsSummary();
            }
        }

        async function loadOverviewTasks() {
            const todayStr = new Date().toISOString().split('T')[0];
            const container = document.getElementById('ov-tasks-stream-container') || document.getElementById('overview-tasks-container');
            if (!container) return;

            let taskItems = [];
            try {
                taskItems = await window.api.getTasksByDate(todayStr);
                const todayKey = getDateKey(new Date());
                tasks[todayKey] = taskItems;
            } catch (error) {
                console.warn('[Overview] loadOverviewTasks failed:', error);
                taskItems = [];
            }

            renderOverviewTasks(taskItems);
        }

        function renderOverviewTasks(tasks) {
            const container = document.getElementById('ov-tasks-stream-container') || document.getElementById('overview-tasks-container');
            if (!container) return;

            if (!Array.isArray(tasks) || tasks.length === 0) {
                container.innerHTML = `
                    <div class="ov-tasks-empty-state">
                        <p>${window.i18n ? window.i18n('overview-no-overdue') : '🎉 Great job — no overdue items in the mini view.'}</p>
                    </div>
                `;
                return;
            }

            const sortedTasks = tasks.slice().sort((a, b) => {
                const aValue = a.startTime || a.endTime || '';
                const bValue = b.startTime || b.endTime || '';
                return aValue.localeCompare(bValue);
            });
            const topTasks = sortedTasks.slice(0, 3);

            container.innerHTML = topTasks.map(task => {
                const completed = task.status === 'completed';
                const timeLabel = `${task.startTime || ''}${task.startTime && task.endTime ? ' - ' : ''}${task.endTime || ''}`.trim() || '未设时间';
                return `
                    <div class="task-item-entry ${completed ? 'completed' : ''}">
                        <button class="task-checkbox-btn" onclick="toggleOverviewTask(${JSON.stringify(task.id)}, ${JSON.stringify(task.status)})">
                            <i class="${completed ? 'fas fa-check-circle' : 'far fa-circle'}"></i>
                        </button>
                        <div class="task-info">
                            <p class="t-name">${escapeHtml(task.title || 'Untitled task')}</p>
                            <p class="t-time">${escapeHtml(timeLabel)}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }

        async function toggleOverviewTask(taskId, currentStatus) {
            if (!window.api?.toggleTaskStatus) return;
            try {
                await window.api.toggleTaskStatus(taskId);
                await Promise.all([loadOverviewTasks(), loadOverviewStatsSummary()]);
                if (typeof refreshStats === 'function') {
                    refreshStats();
                }
            } catch (error) {
                console.error('[Overview] toggleOverviewTask failed:', error);
            }
        }

        function updateOverviewTimerButton() {
            const startBtn = document.getElementById('ov-start-btn') || document.getElementById('overviewStartBtn');
            if (!startBtn) return;
            startBtn.innerHTML = pomodoroRunning && !pomodoroPaused ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        }

        function toggleOverviewPomodoro() {
            if (pomodoroRunning) {
                togglePomodoroPause();
            } else {
                startPomodoro();
            }
            updateOverviewTimerButton();
        }

        function resetOverviewPomodoro() {
            resetPomodoro();
            updateOverviewTimerButton();
        }

        function openQuickAddTaskModal() {
            openQuickAddTask();
        }

        function toggleOverviewQuickAddRow() {
            const row = document.getElementById('overviewQuickAddRow');
            if (!row) return;
            const isHidden = row.style.display === 'none' || !row.style.display;
            row.style.display = isHidden ? 'flex' : 'none';
            if (isHidden) {
                const input = document.getElementById('overviewQuickTaskTitle');
                if (input) {
                    input.focus();
                }
            }
        }

        async function submitMood(mood) {
            const todayKey = getDateKey(new Date());
            const normalized = normalizeMoodKey(mood);
            localStorage.setItem(`${todayKey}-dailyMood`, normalized);
            applyMoodTheme(normalized);
            refreshOverviewMoodSelection();
            if (window.api?.submitDailyMood) {
                try {
                    await window.api.submitDailyMood(mood, todayKey);
                } catch (error) {
                    console.warn('[Overview] submitMood failed:', error);
                }
            }
            showNotification('success', 'Mood Sync success', `Mood recorded: ${mood}`);
        }

        async function submitOverviewMood(mood, element) {
            if (element && element.closest) {
                document.querySelectorAll('.ov-mood-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                element.classList.add('active');
            }
            await submitMood(mood);
        }

        async function refreshOverviewMoodSelection() {
            const todayKey = getDateKey(new Date());
            let selectedMood = localStorage.getItem(`${todayKey}-dailyMood`) || '';
            if (window.api?.fetchDailyMood) {
                try {
                    const apiMood = await window.api.fetchDailyMood(todayKey);
                    if (apiMood) {
                        selectedMood = apiMood;
                        localStorage.setItem(`${todayKey}-dailyMood`, apiMood);
                    }
                } catch (error) {
                    console.warn('[Overview] refreshOverviewMoodSelection API fallback failed:', error);
                }
            }
            document.querySelectorAll('.ov-mood-btn').forEach(button => {
                button.classList.toggle('active', button.dataset.mood === selectedMood);
            });
            if (selectedMood) {
                applyMoodTheme(selectedMood);
            }
        }

        function toggleMobileMenu() {
            const menu = document.getElementById('mobileMenu');
            const hamburger = document.getElementById('mobileMenuButton');
            if (!menu) return;
            menu.classList.toggle('open');
            if (hamburger) {
                hamburger.classList.toggle('open', menu.classList.contains('open'));
            }
            menu.setAttribute('aria-hidden', String(!menu.classList.contains('open')));
        }

        function closeMobileMenu() {
            const menu = document.getElementById('mobileMenu');
            const hamburger = document.getElementById('mobileMenuButton');
            if (!menu) return;
            menu.classList.remove('open');
            menu.setAttribute('aria-hidden', 'true');
            if (hamburger) hamburger.classList.remove('open');
        }

        let pomodoroWidgetsInitialized = false;
        let pomodoroTotalSeconds = 25 * 60;
        let pomodoroRemainingSeconds = pomodoroTotalSeconds;
        let pomodoroIntervalId = null;
        let pomodoroRunning = false;
        let pomodoroPaused = false;
        let pomodoroEndSoundSrc = '';
        let zenMusicEnabled = true;
        let zenMusicSources = [
            'assets/audio/pomodoro/audio_01.mpeg',
            'assets/audio/pomodoro/audio_02.mpeg',
            'assets/audio/pomodoro/audio_03.mpeg',
            'assets/audio/pomodoro/audio_04.mpeg',
            'assets/audio/pomodoro/audio_05.mpeg',
            'assets/audio/pomodoro/audio_06.mpeg'
        ];
        let currentZenTrackIndex = 0;
        let zenTrackTransitioning = false;
        let zenAudioContext = null;
        let zenAnalyser = null;
        let zenAudioSource = null;
        let zenAudioDataArray = null;
        let zenAudioAnimationId = null;
        let isZenModeActive = false;
        let pomodoroRingAnimationId = null;
        let pomodoroCurrentVisualProgress = 1;
        const pomodoroRingCircumference = 2 * Math.PI * 104;

        function syncPomodoroState() {
            const state = {
                totalSeconds: pomodoroTotalSeconds,
                remainingSeconds: pomodoroRemainingSeconds,
                running: pomodoroRunning,
                paused: pomodoroPaused,
                lastUpdate: Date.now()
            };
            localStorage.setItem('pomodoroState', JSON.stringify(state));
        }

        function restorePomodoroState() {
            const stored = localStorage.getItem('pomodoroState');
            if (stored) {
                try {
                    const state = JSON.parse(stored);
                    pomodoroTotalSeconds = state.totalSeconds || 25 * 60;
                    pomodoroRemainingSeconds = state.remainingSeconds || pomodoroTotalSeconds;
                } catch (e) {
                    console.warn('Failed to restore pomodoro state:', e);
                }
            }
        }

        setInterval(() => {
            syncPomodoroState();
            const stored = localStorage.getItem('pomodoroState');
            if (stored) {
                try {
                    const state = JSON.parse(stored);
                    if (state.totalSeconds !== pomodoroTotalSeconds || state.remainingSeconds !== pomodoroRemainingSeconds) {
                        pomodoroTotalSeconds = state.totalSeconds;
                        pomodoroRemainingSeconds = state.remainingSeconds;
                        updatePomodoroDisplay();
                        updateZenTimerDisplay();
                    }
                } catch (e) {}
            }
        }, 100);

        function initPomodoroWidgets() {
            if (pomodoroWidgetsInitialized) return;
            const wheels = [
                { id: 'hourWheel', max: 23, defaultValue: 0 },
                { id: 'minuteWheel', max: 59, defaultValue: 25 },
                { id: 'secondWheel', max: 59, defaultValue: 0 }
            ];

            wheels.forEach(({ id, max, defaultValue }) => {
                const wheel = document.getElementById(id);
                if (!wheel) return;
                const values = Array.from({ length: max + 1 }, (_, index) => String(index).padStart(2, '0'));

                const defaultKey = String(defaultValue).padStart(2, '0');
                const topSpacer = document.createElement('div');
                topSpacer.className = 'wheel-spacer';
                wheel.appendChild(topSpacer);

                values.forEach(value => {
                    const item = document.createElement('div');
                    item.className = 'wheel-item';
                    item.dataset.value = value;
                    item.innerText = value;
                    if (value === defaultKey) {
                        item.classList.add('active');
                        wheel.lastActiveValue = defaultKey;
                    }
                    item.addEventListener('click', () => {
                        if (!pomodoroRunning) {
                            scrollToWheelValue(wheel, value);
                        }
                    });
                    wheel.appendChild(item);
                });

                const bottomSpacer = document.createElement('div');
                bottomSpacer.className = 'wheel-spacer';
                wheel.appendChild(bottomSpacer);

                wheel.dataset.defaultValue = defaultKey;
                wheel.addEventListener('scroll', () => debounceWheelSelection(wheel));
                wheel.addEventListener('pointerup', () => selectNearestWheelValue(wheel));
                wheel.addEventListener('touchend', () => selectNearestWheelValue(wheel));

                setTimeout(() => {
                    scrollToWheelValue(wheel, wheel.dataset.defaultValue, false);
                    selectNearestWheelValue(wheel);
                }, 0);
            });

            setPomodoroFromWheels();
            setWheelLockState();
            pomodoroWidgetsInitialized = true;
        }

        function setWheelLockState() {
            document.querySelectorAll('.time-wheel').forEach(wheel => {
                const locked = pomodoroRunning;
                wheel.classList.toggle('wheel-locked', locked);
                wheel.style.pointerEvents = locked ? 'none' : '';
                wheel.style.opacity = locked ? '0.55' : '';
            });
        }

        function debounceWheelSelection(wheel) {
            clearTimeout(wheel.selectionTimeout);
            wheel.selectionTimeout = setTimeout(() => selectNearestWheelValue(wheel), 120);
        }

        function selectNearestWheelValue(wheel) {
            const items = Array.from(wheel.querySelectorAll('.wheel-item'));
            if (!items.length) return;
            const wheelRect = wheel.getBoundingClientRect();
            const centerY = wheelRect.top + wheelRect.height / 2;
            let closest = null;
            let closestDistance = Infinity;

            items.forEach(item => {
                const itemRect = item.getBoundingClientRect();
                const itemCenter = itemRect.top + itemRect.height / 2;
                const distance = Math.abs(itemCenter - centerY);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closest = item;
                }
            });

            if (!closest) return;
            const value = closest.dataset.value;
            wheel.querySelectorAll('.wheel-item.active').forEach(item => item.classList.remove('active'));
            closest.classList.add('active');
            scrollToWheelValue(wheel, value);
            setPomodoroFromWheels();
            if (wheel.lastActiveValue !== value && navigator.vibrate) {
                navigator.vibrate(10);
            }
            wheel.lastActiveValue = value;
        }

        function scrollToWheelValue(wheel, value, smooth = true) {
            const item = Array.from(wheel.querySelectorAll('.wheel-item')).find(i => i.dataset.value === value);
            if (!item) return;
            item.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
        }

        function setPomodoroFromWheels() {
            const hours = Number(document.querySelector('#hourWheel .wheel-item.active')?.dataset.value || 0);
            const minutes = Number(document.querySelector('#minuteWheel .wheel-item.active')?.dataset.value || 0);
            const seconds = Number(document.querySelector('#secondWheel .wheel-item.active')?.dataset.value || 0);
            pomodoroTotalSeconds = hours * 3600 + minutes * 60 + seconds;
            if (!pomodoroRunning) {
                pomodoroRemainingSeconds = pomodoroTotalSeconds;
            }
            updatePomodoroDisplay();
            updateZenTimerDisplay();
            syncPomodoroState();
        }

        function formatTime(seconds) {
            const safeSeconds = Math.max(0, seconds);
            const hours = Math.floor(safeSeconds / 3600);
            const minutes = Math.floor((safeSeconds % 3600) / 60);
            const secs = safeSeconds % 60;
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        function applyPomodoroRingProgress(progress) {
            const ring = document.getElementById('pomodoroRingProgress');
            const dot = document.getElementById('pomodoroRingDot');
            const safeProgress = Math.max(0, Math.min(1, progress));
            const offset = pomodoroRingCircumference - pomodoroRingCircumference * safeProgress;
            if (ring) {
                ring.style.strokeDashoffset = `${offset}`;
            }
            if (dot) {
                dot.style.transform = `rotate(${360 * (1 - safeProgress)}deg)`;
            }
        }

        function animatePomodoroRingTo(targetProgress) {
            if (pomodoroRingAnimationId) {
                cancelAnimationFrame(pomodoroRingAnimationId);
            }
            const startProgress = pomodoroCurrentVisualProgress;
            const target = Math.max(0, Math.min(1, targetProgress));
            const startTime = performance.now();
            const duration = 420;
            const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

            function tick(now) {
                const elapsed = Math.min(1, (now - startTime) / duration);
                const eased = easeOutCubic(elapsed);
                pomodoroCurrentVisualProgress = startProgress + (target - startProgress) * eased;
                applyPomodoroRingProgress(pomodoroCurrentVisualProgress);
                if (elapsed < 1) {
                    pomodoroRingAnimationId = requestAnimationFrame(tick);
                }
            }

            pomodoroRingAnimationId = requestAnimationFrame(tick);
        }

        function updatePomodoroDisplay() {
            const display = document.getElementById('pomodoroTimerDisplay');
            const total = pomodoroTotalSeconds > 0 ? pomodoroTotalSeconds : 1;
            const progress = pomodoroTotalSeconds > 0 ? Math.max(0, Math.min(1, pomodoroRemainingSeconds / total)) : 0;
            animatePomodoroRingTo(progress);
            if (display) {
                display.innerText = formatTime(pomodoroRemainingSeconds);
            }
            const overviewDisplay = document.getElementById('ov-timer-display') || document.getElementById('overviewPomodoroDisplay') || document.getElementById('overviewTimerDisplay');
            if (overviewDisplay) {
                overviewDisplay.innerText = formatTime(pomodoroRemainingSeconds);
            }
            updateZenTimerDisplay();
            updateZenControls();
        }

        function updateZenTimerDisplay() {
            const zenDisplay = document.getElementById('zenTimerDisplay');
            if (zenDisplay) {
                zenDisplay.innerText = formatTime(pomodoroRemainingSeconds);
            }
        }

        function updateZenControls() {
            const startBtn = document.getElementById('zenStartBtn');
            const pauseBtn = document.getElementById('zenPauseBtn');
            const resetBtn = document.getElementById('zenResetBtn');

            if (pomodoroRunning) {
                if (startBtn) startBtn.style.display = 'none';
                if (pauseBtn) {
                    pauseBtn.style.display = 'inline-flex';
                    pauseBtn.innerText = pomodoroPaused ? (window.i18n ? window.i18n('continue') : 'Continue') : (window.i18n ? window.i18n('pause') : 'Pause');
                }
                if (resetBtn) resetBtn.style.display = 'inline-flex';
            } else {
                if (startBtn) startBtn.style.display = 'inline-flex';
                if (pauseBtn) pauseBtn.style.display = 'none';
                if (resetBtn) resetBtn.style.display = 'none';
            }
        }

        function renderPomodoroView() {
            restorePomodoroState();
            initPomodoroWidgets();
            setWheelLockState();
            updatePomodoroDisplay();
            updateZenTimerDisplay();
            updateZenControls();
            const startBtn = document.getElementById('startPomodoroBtn');
            const pauseBtn = document.getElementById('pausePomodoroBtn');
            const resetBtn = document.getElementById('resetPomodoroBtn');
            if (pomodoroRunning) {
                if (startBtn) startBtn.style.display = 'none';
                if (pauseBtn) {
                    pauseBtn.style.display = 'inline-flex';
                    pauseBtn.innerText = pomodoroPaused ? (window.i18n ? window.i18n('continue') : 'Continue') : (window.i18n ? window.i18n('pause') : 'Pause');
                }
                if (resetBtn) resetBtn.style.display = 'inline-flex';
            } else {
                if (startBtn) startBtn.style.display = 'inline-flex';
                if (pauseBtn) pauseBtn.style.display = 'none';
                if (resetBtn) resetBtn.style.display = 'none';
            }
        }

        function startPomodoro() {
            if (pomodoroRunning) return;
            stopPomodoroAlarm();
            pomodoroRunning = true;
            pomodoroPaused = false;
            syncPomodoroState();
            setWheelLockState();
            
            document.querySelectorAll('#startPomodoroBtn').forEach(btn => {
                btn.style.display = 'none';
            });
            
            document.querySelectorAll('#pausePomodoroBtn').forEach(btn => {
                btn.style.display = 'inline-flex';
                btn.dataset.i18n = 'pause';
                btn.innerText = window.i18n ? window.i18n('pause') : 'Pause';
            });
            
            document.querySelectorAll('#resetPomodoroBtn').forEach(btn => {
                btn.style.display = 'inline-flex';
            });
            updateZenControls();

            if (pomodoroTotalSeconds === 0) {
                pomodoroRemainingSeconds = 0;
                updatePomodoroDisplay();
                updateZenTimerDisplay();
                playPomodoroEndSound();
                showNotification('success', 'Pomodoro Complete', 'Zero-second session completed.');
                pomodoroRunning = false;
                setWheelLockState();
                document.querySelectorAll('#startPomodoroBtn').forEach(btn => {
                    btn.style.display = 'inline-flex';
                });
                document.querySelectorAll('#pausePomodoroBtn').forEach(btn => {
                    btn.style.display = 'none';
                });
                document.querySelectorAll('#resetPomodoroBtn').forEach(btn => {
                    btn.style.display = 'none';
                });
                return;
            }

            pomodoroIntervalId = setInterval(() => {
                if (!pomodoroPaused) {
                    pomodoroRemainingSeconds -= 1;
                    syncPomodoroState();
                    if (pomodoroRemainingSeconds <= 0) {
                        pomodoroRemainingSeconds = 0;
                        updatePomodoroDisplay();
                        updateZenTimerDisplay();
                        clearInterval(pomodoroIntervalId);
                        pomodoroRunning = false;
                        setWheelLockState();
                        syncPomodoroState();
                        playPomodoroEndSound();
                        if (typeof recordPomodoro === 'function') {
                            recordPomodoro(Math.max(1, Math.round(pomodoroTotalSeconds / 60)));
                        }
                        showNotification('success', 'Pomodoro Completed', 'Great work! Focus session finished.');
                        document.querySelectorAll('#startPomodoroBtn').forEach(btn => {
                            btn.style.display = 'inline-flex';
                        });
                        document.querySelectorAll('#pausePomodoroBtn').forEach(btn => {
                            btn.style.display = 'none';
                        });
                        document.querySelectorAll('#resetPomodoroBtn').forEach(btn => {
                            btn.style.display = 'none';
                        });
                        return;
                    }
                    updatePomodoroDisplay();
                    updateZenTimerDisplay();
                }
            }, 1000);
        }

        function togglePomodoroPause() {
            if (!pomodoroRunning) {
                return;
            }
            pomodoroPaused = !pomodoroPaused;
            syncPomodoroState();
            document.querySelectorAll('#pausePomodoroBtn').forEach(btn => {
                btn.dataset.i18n = pomodoroPaused ? 'continue' : 'pause';
                btn.innerText = pomodoroPaused ? (window.i18n ? window.i18n('continue') : 'Continue') : (window.i18n ? window.i18n('pause') : 'Pause');
            });
            const zenPlayPauseBtn = document.getElementById('zenPlayPauseBtn');
            if (zenPlayPauseBtn) {
                zenPlayPauseBtn.innerHTML = pomodoroPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
            }
            updateZenControls();
            showNotification('success', pomodoroPaused ? (window.i18n ? window.i18n('paused') : 'Paused') : (window.i18n ? window.i18n('resumed') : 'Resumed'), pomodoroPaused ? (window.i18n ? window.i18n('timer-paused') : 'Timer paused.') : (window.i18n ? window.i18n('timer-resumed') : 'Timer resumed.'));
        }

        function toggleTimer() {
            togglePomodoroPause();
        }

        function resetPomodoro() {
            if (pomodoroIntervalId) {
                clearInterval(pomodoroIntervalId);
            }
            stopPomodoroAlarm();
            pomodoroRunning = false;
            pomodoroPaused = false;
            setWheelLockState();
            pomodoroRemainingSeconds = pomodoroTotalSeconds;
            updatePomodoroDisplay();
            updateZenTimerDisplay();
            syncPomodoroState();
            
            document.querySelectorAll('#startPomodoroBtn').forEach(btn => {
                btn.style.display = 'inline-flex';
            });
            document.querySelectorAll('#pausePomodoroBtn').forEach(btn => {
                btn.style.display = 'none';
            });
            document.querySelectorAll('#resetPomodoroBtn').forEach(btn => {
                btn.style.display = 'none';
            });
            
            const zenPlayPauseBtn = document.getElementById('zenPlayPauseBtn');
            if (zenPlayPauseBtn) zenPlayPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            updateZenControls();
        }

        function enterZenMode() {
            showView('pomodoro');
            enableZenMode(true);
        }

        function exitZenMode() {
            enableZenMode(false);
        }

        function enableZenMode(active) {
            isZenModeActive = active;
            document.body.classList.toggle('zen-mode-active', active);
            if (typeof setParticleTheme === 'function') {
                setParticleTheme(active ? 'zen' : 'default');
            }
            if (active) {
                if (zenMusicEnabled) {
                    playZenMusic();
                }
                startZenAudioAnalysis();
                updateZenControls();
            } else {
                pauseZenMusic();
                stopZenAudioAnalysis();
            }
        }

        function setPomodoroEndSoundSource(url) {
            pomodoroEndSoundSrc = url;
            const endAudio = document.getElementById('pomodoroEndAudio');
            if (endAudio) {
                endAudio.src = url;
            }
        }

        function openPomodoroAlarmModal() {
            const backdrop = document.getElementById('pomodoroAlarmBackdrop');
            const modal = document.getElementById('pomodoroAlarmModal');
            if (!backdrop || !modal) return;
            backdrop.classList.add('open');
            modal.classList.add('open');
            backdrop.onclick = null;
        }

        function closePomodoroAlarmModal() {
            const backdrop = document.getElementById('pomodoroAlarmBackdrop');
            const modal = document.getElementById('pomodoroAlarmModal');
            if (!backdrop || !modal) return;
            backdrop.classList.remove('open');
            modal.classList.remove('open');
        }

        function stopPomodoroAlarm() {
            const endAudio = document.getElementById('pomodoroEndAudio');
            if (endAudio) {
                endAudio.pause();
                endAudio.loop = false;
                endAudio.currentTime = 0;
            }
            closePomodoroAlarmModal();
        }

        function playPomodoroEndSound() {
            const endAudio = document.getElementById('pomodoroEndAudio');
            const alarmUrl = '/assets/audio/alarm/alarm.mpeg';
            if (!endAudio) return;

            pomodoroEndSoundSrc = alarmUrl;
            if (endAudio.src !== alarmUrl) {
                endAudio.src = alarmUrl;
            }
            endAudio.loop = true;
            endAudio.volume = 0.9;
            endAudio.currentTime = 0;
            endAudio.play().catch(() => {
                console.warn('Pomodoro alarm playback blocked.');
            });
            openPomodoroAlarmModal();
        }

        function setZenMusicSources(sources) {
            zenMusicSources = Array.isArray(sources) ? sources : [];
        }

        function initializeZenAudioPlayer() {
            const audio = document.getElementById('zenAudio');
            if (!audio) return;
            audio.onended = null;
            audio.onended = () => {
                console.log('🎵 当前音乐播放完毕，正在平滑切换至下一首...');
                if (zenMusicEnabled && isZenModeActive) {
                    playNextZenTrack();
                }
            };
        }

        function playZenMusic() {
            const audio = document.getElementById('zenAudio');
            if (!audio || !zenMusicSources.length || !zenMusicEnabled) return;
            initializeZenAudioPlayer();

            const targetSource = zenMusicSources[currentZenTrackIndex];
            if (!audio.src || !audio.src.includes(targetSource)) {
                audio.pause();
                audio.src = targetSource;
                audio.load();
            }

            audio.volume = 0.38;
            resumeAudioContext();
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch((error) => {
                    console.warn('Zen music playback blocked.', error);
                });
            }
            startZenAudioAnalysis();
        }

        function playNextZenTrack() {
            if (!zenMusicSources.length || zenTrackTransitioning) return;
            const audio = document.getElementById('zenAudio');
            if (!audio) return;

            zenTrackTransitioning = true;
            currentZenTrackIndex = (currentZenTrackIndex + 1) % zenMusicSources.length;
            audio.pause();
            audio.src = zenMusicSources[currentZenTrackIndex];
            audio.load();
            initializeZenAudioPlayer();
            audio.volume = 0.38;

            const playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise
                    .catch((error) => {
                        console.warn('Zen next track playback blocked.', error);
                    })
                    .finally(() => {
                        zenTrackTransitioning = false;
                    });
            } else {
                zenTrackTransitioning = false;
            }
        }

        function pauseZenMusic() {
            const audio = document.getElementById('zenAudio');
            if (!audio) return;
            audio.pause();
        }

        async function resumeAudioContext() {
            if (!zenAudioContext) {
                initZenAudioAnalyzer();
            }
            try {
                if (zenAudioContext && zenAudioContext.state === 'suspended') {
                    await zenAudioContext.resume();
                }
            } catch (error) {
                console.warn('Unable to resume audio context:', error);
            }
        }

        function initZenAudioAnalyzer() {
            const audio = document.getElementById('zenAudio');
            if (!audio || zenAudioContext) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                zenAudioContext = new AudioContext();
                zenAudioSource = zenAudioContext.createMediaElementSource(audio);
                zenAnalyser = zenAudioContext.createAnalyser();
                zenAnalyser.fftSize = 128;
                zenAudioSource.connect(zenAnalyser);
                zenAudioSource.connect(zenAudioContext.destination);
                zenAudioDataArray = new Uint8Array(zenAnalyser.frequencyBinCount);
            } catch (error) {
                console.warn('Unable to initialize zen audio analyzer:', error);
                zenAudioContext = null;
                zenAnalyser = null;
                zenAudioSource = null;
            }
        }

        function startZenAudioAnalysis() {
            if (!isZenModeActive || !zenMusicEnabled) return;
            if (!zenAnalyser) {
                initZenAudioAnalyzer();
            }
            if (!zenAnalyser) return;
            cancelAnimationFrame(zenAudioAnimationId);

            function computeAverage(range) {
                if (!range.length) return 0;
                return range.reduce((sum, value) => sum + value, 0) / range.length;
            }

            function updateAudioLevel() {
                zenAnalyser.getByteFrequencyData(zenAudioDataArray);
                const bassBins = zenAudioDataArray.slice(0, Math.min(12, zenAudioDataArray.length));
                const trebleStart = Math.max(zenAudioDataArray.length - 20, 0);
                const trebleBins = zenAudioDataArray.slice(trebleStart);

                const bassAverage = Math.min(1, computeAverage(bassBins) / 255);
                const trebleAverage = Math.min(1, computeAverage(trebleBins) / 255);
                const overallAverage = Math.min(1, zenAudioDataArray.reduce((sum, value) => sum + value, 0) / (zenAudioDataArray.length * 255));

                if (typeof setParticleAudioState === 'function') {
                    setParticleAudioState({
                        bass: bassAverage,
                        treble: trebleAverage,
                        intensity: overallAverage,
                    });
                } else if (typeof setParticleAudioIntensity === 'function') {
                    setParticleAudioIntensity(overallAverage);
                }
                zenAudioAnimationId = requestAnimationFrame(updateAudioLevel);
            }

            updateAudioLevel();
        }

        function stopZenAudioAnalysis() {
            cancelAnimationFrame(zenAudioAnimationId);
            if (typeof setParticleAudioState === 'function') {
                setParticleAudioState({ bass: 0, treble: 0, intensity: 0 });
            } else if (typeof setParticleAudioIntensity === 'function') {
                setParticleAudioIntensity(0);
            }
        }

        function toggleZenMusic() {
            zenMusicEnabled = !zenMusicEnabled;
            const btn = document.getElementById('zenMusicBtn');
            if (btn) {
                btn.textContent = zenMusicEnabled ? '♫ On' : '♫ Off';
            }
            if (zenMusicEnabled) {
                playZenMusic();
            } else {
                pauseZenMusic();
            }
        }

        function showView(viewId) {
            const currentView = document.querySelector('.auth-view.active');
            const nextView = document.getElementById('view-' + viewId);
            const container = document.getElementById('main-container');
            const features = document.getElementById('features-section');
            const navPills = document.getElementById('nav-pills');
            const navActions = document.getElementById('nav-actions');
            const videoPlaceholder = document.getElementById('video-placeholder');

            if (!nextView || currentView === nextView) return;

            if (videoPlaceholder) {
                if (viewId === 'intro' || viewId === 'signin' || viewId === 'signup') {
                    videoPlaceholder.style.display = 'flex';
                } else {
                    videoPlaceholder.style.display = 'none';
                }
            }

            if (viewId === 'dashboard' || viewId === 'task' || viewId === 'leaderboard' || viewId === 'stats' || viewId === 'pomodoro') { 
                container.classList.add('dashboard-mode');
                if (features) features.style.display = 'flex';
                if (navPills) navPills.style.display = 'flex';
                if (navActions) navActions.style.display = 'flex';
                setTimeout(updateScrollButtons, 100);
            } else if (viewId === 'zen') {
                container.classList.remove('dashboard-mode');
                if (features) features.style.display = 'none';
                if (navPills) navPills.style.display = 'none';
                if (navActions) navActions.style.display = 'none';
                setTimeout(updateScrollButtons, 300);
            } else {
                container.classList.remove('dashboard-mode');
                if (features) features.style.display = 'none';
                if (navPills) navPills.style.display = 'none';
                if (navActions) navActions.style.display = 'none';
                setTimeout(updateScrollButtons, 300);
            }

            if (viewId === 'task') {
                const freshDate = new Date();
                currentYear = freshDate.getFullYear();
                currentMonth = freshDate.getMonth();
                renderCalendar(currentYear, currentMonth);
            }

            if (viewId === 'pomodoro') {
                renderPomodoroView();
            }

            if (viewId === 'zen') {
                enableZenMode(true);
                updateZenTimerDisplay();
            } else {
                enableZenMode(false);
            }

            if (viewId === 'leaderboard' && currentUserId) {
                loadLeaderboard();
                loadUserStats();
            }

            if (currentView) {
                currentView.classList.remove('active');
                currentView.classList.add('exiting');
                setTimeout(() => currentView.classList.remove('exiting'), 400);
            }
            if (nextView) nextView.classList.add('active');

            if (viewId === 'task') {
                renderCalendar(currentYear, currentMonth);
            }

            if (viewId === 'dashboard') {
                renderOverviewDashboard();
            }
            if (viewId === 'stats') {
                refreshStats();
            }

            updateMobileNavVisibility();
        }

        function selectPill(element, viewName) {
            document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            element.classList.add('active');
            showView(viewName);
            closeMobileMenu();
        }


async function handleSignIn(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    
    try {
        const response = await fetch('https://GOH.pythonanywhere.com/api/signin',{
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        
        if (response.ok) {
            const currentUser = {
                id: data.user.id,
                fullname: data.user.fullname || data.user.name || 'User',
                email: data.user.email || ''
            };

            localStorage.setItem('userId', currentUser.id);
            localStorage.setItem('userEmail', currentUser.email);
            localStorage.setItem('userName', currentUser.fullname);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            if (data.token) {
                localStorage.setItem('authToken', data.token);
            }
            
            document.getElementById('nav-pills').style.display = 'flex';
            document.getElementById('nav-actions').style.display = 'flex';
            
            const blueCircle = document.getElementById('video-placeholder');
            if (blueCircle) blueCircle.style.display = 'none';

            document.getElementById('user-greeting').innerText = `Hello, ${currentUser.fullname}`;

            if (typeof updateAccountModal === 'function') updateAccountModal({ name: currentUser.fullname, email: currentUser.email });
            if (typeof renderUserIdentity === 'function') renderUserIdentity();
            if (typeof initAppData === 'function') await initAppData(currentUser.id, false);

            showNotification('success', window.i18n ? window.i18n('welcome-back') : 'Welcome Back!', `Hello ${currentUser.fullname}`);
            setTimeout(() => { showView('dashboard'); }, 1200);

        } else if (response.status === 403) {
            const pendingEmailAddress = data.email || email;
            localStorage.setItem('pendingEmail', pendingEmailAddress);
            
            showNotification('error', 'Verification Required', '您的邮箱尚未验证，正在前往激活页面...');
            setTimeout(() => {
                window.location.href = 'otp.html';
            }, 1200);

        } else {
            showNotification('error', 'Login Failed', data.message);
        }
    } catch (err) { 
        showNotification('error', 'Connection Error', 'Backend server not running!'); 
    }
}

async function handleSignUp(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const fullname = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const confirmError = document.getElementById('confirm-error');

    if (password !== confirmPassword) {
        confirmError.textContent = "Passwords do not match!";
        confirmError.classList.add('show');
        return;
    }

    const strength = getPasswordStrength(password);
    if (strength < 3) {
        confirmError.textContent = "Password is too weak! Please use a stronger password.";
        confirmError.classList.add('show');
        return;
    }

    confirmError.classList.remove('show');

    try {
        const response = await fetch('https://GOH.pythonanywhere.com/api/signup',{
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullname, email, password })
        });
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('pendingEmail', email);
            showNotification('success', 'OTP Sent', 'OTP 已发送到您的邮箱，正在跳转验证...');
            setTimeout(() => {
                window.location.href = 'otp.html';
            }, 1200);
            return;
        } else {
            showNotification('error', 'Registration Failed', data.message);
        }
    } catch (err) { 
        showNotification('error', 'Connection Error', 'Backend server not running!'); 
    }
}


        function handleOtpInput(current, nextId) {
            const value = current.value;
            current.value = value.replace(/[^0-9]/g, '');
            if (current.value.length === 1) {
                current.classList.add('filled');
                if (nextId) {
                    const nextInput = document.getElementById(nextId);
                    if (nextInput) nextInput.focus();
                }
            } else {
                current.classList.remove('filled');
            }
        }

        function handleOtpKeydown(event, current, prevId) {
            if (event.key === 'Backspace') {
                if (!current.value && prevId) {
                    const prevInput = document.getElementById(prevId);
                    if (prevInput) prevInput.focus();
                }
            }
        }

        function goBackToSignUp() {
            localStorage.removeItem('pendingEmail');
            if (typeof showView === 'function') {
                showView('signup');
            } else {
                window.location.href = 'index.html';
            }
        }

        function showNotification(type, title, message) {
            const backdrop = document.getElementById('notificationBackdrop');
            const modal = document.getElementById('notificationModal');
            const window = document.getElementById('notificationWindow');
            const icon = document.getElementById('notificationIcon');
            const titleEl = document.getElementById('notificationTitle');
            const messageEl = document.getElementById('notificationMessage');
            const closeBtn = document.getElementById('notificationCloseBtn');

            titleEl.textContent = title;
            messageEl.textContent = message;
            
            window.className = 'notification-window ' + type;
            modal.className = 'notification-modal ' + type;
            
            if (type === 'success') {
                icon.textContent = '✓';
            } else {
                icon.textContent = '✕';
            }

            closeBtn.style.display = type === 'error' ? 'flex' : 'none';

            backdrop.classList.add('show');
            modal.classList.add('show');

            if (type === 'success') {
                setTimeout(() => {
                    closeNotification();
                }, 1000);
            }
        }

        function closeNotification() {
            const backdrop = document.getElementById('notificationBackdrop');
            const modal = document.getElementById('notificationModal');
            
            backdrop.classList.remove('show');
            modal.classList.remove('show');
        }

        document.addEventListener('DOMContentLoaded', function() {
            const backdrop = document.getElementById('notificationBackdrop');
            if (backdrop) {
                backdrop.addEventListener('click', function() {
                    const modal = document.getElementById('notificationModal');
                    if (modal.classList.contains('show')) {
                        // Only allow closing if it's an error notification
                        const window = document.getElementById('notificationWindow');
                        if (window.classList.contains('error')) {
                            closeNotification();
                        }
                    }
                });
            }
        });

        function getPasswordStrength(password) {
            let score = 0;
            if (password.length >= 8) score++;
            if (password.length >= 12) score++;
            if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
            if (/\d/.test(password)) score++;
            if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
            return score;
        }

        function checkPasswordStrength() {
            const password = document.getElementById('signup-password').value;
            const fill = document.getElementById('strength-fill');
            const label = document.getElementById('strength-label');
            const check = document.getElementById('strength-check');
            const confirmInput = document.getElementById('signup-confirm-password');
            const confirmError = document.getElementById('confirm-error');

            if (!password) {
                fill.className = 'password-strength-fill';
                fill.style.width = '0%';
                label.textContent = '';
                check.classList.remove('show');
                return;
            }

            const strength = getPasswordStrength(password);
            let strengthClass = '';
            let strengthText = '';

            if (strength <= 1) {
                strengthClass = 'weak';
                strengthText = 'Weak';
            } else if (strength === 2) {
                strengthClass = 'medium-low';
                strengthText = 'Medium-Low';
            } else if (strength === 3) {
                strengthClass = 'medium';
                strengthText = 'Medium';
            } else if (strength === 4) {
                strengthClass = 'medium-high';
                strengthText = 'Medium-High';
            } else {
                strengthClass = 'strong';
                strengthText = 'Strong';
            }

            fill.className = 'password-strength-fill ' + strengthClass;
            label.textContent = strengthText;

            if (strength >= 4) {
                check.classList.add('show');
            } else {
                check.classList.remove('show');
            }

            if (confirmInput.value) {
                if (password === confirmInput.value) {
                    confirmError.classList.remove('show');
                }
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            const confirmInput = document.getElementById('signup-confirm-password');
            if (confirmInput) {
                confirmInput.addEventListener('input', function() {
                    const password = document.getElementById('signup-password').value;
                    const confirmError = document.getElementById('confirm-error');
                    
                    if (this.value && password !== this.value) {
                        confirmError.textContent = "Passwords do not match!";
                        confirmError.classList.add('show');
                    } else {
                        confirmError.classList.remove('show');
                    }
                });
            }
        });

        async function saveTask(source, event) {
            if (event && typeof event.preventDefault === 'function') {
                event.preventDefault();
            }

            const actualDateKey = selectedDate || (source === 'overview' ? getDateKey(new Date()) : null);
            if (!actualDateKey) {
                alert("Please select a date first!");
                return;
            }

            const titleEl = document.getElementById(source === 'overview' ? 'overviewQuickTaskTitle' : 'task-title');
            const descEl = source === 'overview' ? { value: '' } : document.getElementById('task-desc');
            const timeEl = source === 'overview' ? null : document.getElementById('task-time');

            if (!titleEl || !titleEl.value.trim()) {
                alert("Please enter a title");
                return;
            }

            let finalTime;
            if (timeEl && timeEl.value) {
                const [hours, minutes] = timeEl.value.split(':');
                const suffix = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours % 12 || 12;
                finalTime = `${displayHours}:${minutes} ${suffix}`;
            } else {
                const now = new Date();
                finalTime = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }

            let userEmail = '';
            if (typeof window.api?.getCurrentUser === 'function') {
                const currentUser = window.api.getCurrentUser();
                if (currentUser && currentUser.email) {
                    userEmail = currentUser.email;
                }
            }

            const taskPayload = {
                title: titleEl.value.trim(),
                description: descEl?.value.trim() || '',
                color: selectedColor || '#007AFF',
                time: finalTime,
                date: actualDateKey,     
                user_email: userEmail,   
                status: 'pending'
            };

            let savedTask = null;

            if (window.api?.createTask) {
                try {
                    const created = await window.api.createTask(taskPayload);
                    savedTask = {
                        ...taskPayload,
                        ...created,
                        status: created.status || 'pending',
                        id: created.id || created._id || created.taskId || null
                    };
                } catch (error) {
                    console.error('[Task] Database write failed Safely Catched:', error);
                    alert("Server error when saving task. Keeping current view.");
                    return; 
                }
            } else {
                savedTask = { ...taskPayload, id: 'local_' + Date.now() };
            }

            if (savedTask) {
                if (!tasks[actualDateKey]) tasks[actualDateKey] = [];
                tasks[actualDateKey].push(savedTask);
            }

            titleEl.value = '';
            if (timeEl) timeEl.value = '';
            if (source !== 'overview' && descEl) descEl.value = '';
            if (source === 'overview') {
                const quickAddRow = document.getElementById('overviewQuickAddRow');
                if (quickAddRow) quickAddRow.style.display = 'none';
            }

            updateTaskList();
            if (typeof loadOverviewTasks === 'function') {
                await loadOverviewTasks();
            }
            if (typeof refreshStats === 'function') {
                refreshStats();
            }
            if (typeof showNotification === 'function') {
                showNotification('success', 'Success', 'Task saved to database.');
            }
        }

        function openModal(type) {
            const backdrop = document.getElementById(type + 'Backdrop');
            const modal = document.getElementById(type + 'Modal');
            
            if (backdrop && modal) {
                backdrop.classList.add('open');
                modal.classList.add('open');
                backdrop.onclick = () => closeModal(type);
            }

            if (type === 'settings' && typeof syncNotificationToggleUI === 'function') {
                syncNotificationToggleUI();
            }
        }

        function closeModal(type) {
            const backdrop = document.getElementById(type + 'Backdrop');
            const modal = document.getElementById(type + 'Modal');
            
            if (backdrop && modal) {
                backdrop.classList.remove('open');
                modal.classList.remove('open');
            }
        }

        function handleSearch(query) {
            const searchResults = document.getElementById('searchResults');
            const pages = ['Dashboard', 'Task', 'Leaderboard', 'Stats', 'Pomodoro'];
            
            if (!query.trim()) {
                searchResults.innerHTML = '';
                return;
            }

            const lowerQuery = query.toLowerCase();
            const results = [];

            pages.forEach(page => {
                if (page.toLowerCase().includes(lowerQuery)) {
                    results.push({ type: 'page', name: page, icon: '📄' });
                }
            });

            Object.keys(tasks).forEach(date => {
                tasks[date].forEach((task, index) => {
                    if (task.title.toLowerCase().includes(lowerQuery)) {
                        results.push({ type: 'task', name: task.title, date: date, icon: '✓' });
                    }
                });
            });

            if (results.length === 0) {
                searchResults.innerHTML = '<div class="search-result-item" style="padding: 12px; opacity: 0.6;">No results found</div>';
                return;
            }

            searchResults.innerHTML = results.map((result, idx) => {
                if (result.type === 'page') {
                    return `<div class="search-result-item" onclick="selectPill(this, '${result.name.toLowerCase()}'); closeModal('search')">
                        <span>${result.icon}</span>
                        <span>${result.name}</span>
                    </div>`;
                } else {
                    return `<div class="search-result-item" onclick="selectDate('${result.date}'); closeModal('search')">
                        <span>${result.icon}</span>
                        <span>${result.name}</span>
                        <span style="opacity: 0.6; font-size: 12px;">${result.date}</span>
                    </div>`;
                }
            }).join('');
        }

        function createNotificationRipple(button, event) {
            const ripple = document.createElement('span');
            ripple.className = 'notification-ripple-wave';
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 1.4;
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${event.clientX - rect.left}px`;
            ripple.style.top = `${event.clientY - rect.top}px`;
            button.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
        }

        function syncNotificationToggleUI() {
            const toggle = document.getElementById('notificationsSwitch');
            if (!toggle) return;

            const supported = 'Notification' in window;
            const permissionGranted = supported && Notification.permission === 'granted';
            const userEnabled = localStorage.getItem('nmlmNotificationsEnabled') === 'true';
            const enabled = permissionGranted && userEnabled;

            toggle.classList.toggle('enabled', enabled);
            toggle.classList.toggle('disabled', !supported);
            toggle.setAttribute('aria-pressed', String(enabled));
            toggle.disabled = !supported;
            toggle.classList.remove('is-pending');
        }

        function toggleNotificationPermission(event, button) {
            event.preventDefault();
            event.stopPropagation();

            createNotificationRipple(button, event);

            if (!('Notification' in window)) {
                showNotification('error', 'Notifications not supported', 'This browser does not support website notifications.');
                return;
            }

            const currentlyEnabled = localStorage.getItem('nmlmNotificationsEnabled') === 'true';
            if (currentlyEnabled) {
                localStorage.setItem('nmlmNotificationsEnabled', 'false');
                syncNotificationToggleUI();
                showNotification('success', 'Notifications off', 'Website notifications are now turned off for this app.');
                return;
            }

            button.classList.add('is-pending');
            Notification.requestPermission().then((permission) => {
                const enabled = permission === 'granted';
                localStorage.setItem('nmlmNotificationsEnabled', String(enabled));
                syncNotificationToggleUI();

                if (enabled) {
                    showNotification('success', 'Notifications enabled', 'Website notifications are now enabled.');
                } else {
                    showNotification('error', 'Permission denied', 'Please allow notifications in your browser settings if you want reminders.');
                }
            }).catch(() => {
                syncNotificationToggleUI();
                showNotification('error', 'Permission request failed', 'Unable to request notification permission right now.');
            });
        }

        document.addEventListener('DOMContentLoaded', function() {
            const toggle = document.getElementById('notificationsSwitch');
            if (!toggle) return;

            ['pointerdown', 'mousedown'].forEach(type => {
                toggle.addEventListener(type, () => toggle.classList.add('is-pressed'));
            });
            ['pointerup', 'pointerleave', 'pointercancel', 'mouseup'].forEach(type => {
                toggle.addEventListener(type, () => toggle.classList.remove('is-pressed'));
            });

            syncNotificationToggleUI();
        });

        function switchSettingsTab(event, tabName) {
            document.querySelectorAll('.settings-menu-item').forEach(item => {
                item.classList.remove('active');
            });
            event.target.classList.add('active');

            document.querySelectorAll('.settings-section').forEach(section => {
                section.classList.remove('active');
            });
            const section = document.getElementById('settings-' + tabName);
            if (section) section.classList.add('active');
        }

        function openEditProfileModal() {
            const currentName = document.getElementById('accountName')?.textContent || localStorage.getItem('userName') || 'User';
            const currentEmail = document.getElementById('accountEmail')?.textContent || localStorage.getItem('userEmail') || '';
            const nameInput = document.getElementById('editProfileName');
            const emailInput = document.getElementById('editProfileEmail');

            if (nameInput) nameInput.value = currentName;
            if (emailInput) emailInput.value = currentEmail;

            openModal('editProfile');
        }

        function saveProfileChanges() {
            const nameInput = document.getElementById('editProfileName');
            const emailInput = document.getElementById('editProfileEmail');
            const newName = nameInput?.value?.trim() || '';
            const newEmail = emailInput?.value?.trim() || '';

            if (!newName) {
                showNotification('error', 'Name required', 'Please enter a display name.');
                return;
            }

            if (!newEmail) {
                showNotification('error', 'Email required', 'Please enter your email address.');
                return;
            }

            const nameEl = document.getElementById('accountName');
            const emailEl = document.getElementById('accountEmail');
            if (nameEl) nameEl.textContent = newName;
            if (emailEl) emailEl.textContent = newEmail;

            localStorage.setItem('userName', newName);
            localStorage.setItem('userEmail', newEmail);
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            localStorage.setItem('currentUser', JSON.stringify({
                ...currentUser,
                name: newName,
                fullname: newName,
                email: newEmail
            }));

            if (typeof updateAccountModal === 'function') {
                updateAccountModal({ name: newName, email: newEmail });
            }

            closeModal('editProfile');
            showNotification('success', 'Profile updated', 'Your account details have been saved.');
        }

        function openSwitchAccountModal() {
            openModal('switchAccount');
        }

        function confirmSwitchAccount() {
            showView('signin');
            closeModal('account');
            closeModal('switchAccount');
            closeMobileMenu();
        }

        function openLogoutModal() {
            openModal('logout');
        }

        function confirmLogout() {
            localStorage.removeItem('userId');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
            currentUserId = null;

            showView('intro');
            closeModal('account');
            closeModal('logout');
            closeMobileMenu();

            const navPills = document.getElementById('nav-pills');
            const navActions = document.getElementById('nav-actions');
            if (navPills) navPills.style.display = 'none';
            if (navActions) navActions.style.display = 'none';
        }

        function changeAvatar() {
            const initials = prompt('Enter your initials (1-2 characters):', 'U');
            if (initials && initials.trim()) {
                document.getElementById('accountAvatar').innerText = initials.toUpperCase().substring(0, 2);
            }
        }

        function openMailClient(email) {
            window.location.href = 'mailto:' + email;
        }

        // Helper function to select date from search
        function selectDate(dateStr) {
            const [year, month, day] = dateStr.split('-').map(Number);
            currentYear = year;
            currentMonth = month - 1;
            selectedDate = dateStr;
            renderCalendar(year, month - 1);
            updateTaskList();
            showView('task');
        }

        async function loadLeaderboard() {
            try {
                const response = await fetch('/api/leaderboard');
                const data = await response.json();
                
                if (data.leaderboard && data.leaderboard.length > 0) {
                    populateLeaderboard(data.leaderboard);
                } else {
                    // Show empty state
                    const listContainer = document.getElementById('leaderboardList');
                    if (listContainer) {
                        listContainer.innerHTML = '<div class="leaderboard-empty">No data yet. Complete pomodoros to appear on the leaderboard!</div>';
                    }
                }
            } catch (error) {
                console.error('Error loading leaderboard:', error);
            }
        }

        async function loadUserStats() {
            if (!currentUserId) return;
            
            try {
                const response = await fetch(`/api/user/${currentUserId}/stats`);
                const data = await response.json();
                
                if (data.name) {
                    updateLeaderboard(data);
                }
            } catch (error) {
                console.error('Error loading user stats:', error);
            }
        }

        function updateLeaderboard(userData) {
            if (userData.rank) {
                document.getElementById('userRank').textContent = '#' + userData.rank;
            }
            
            if (userData.name) {
                document.getElementById('leaderboardUserName').textContent = userData.name;
                document.getElementById('leaderboardAvatar').textContent = userData.name.charAt(0).toUpperCase();
            }
            
            if (userData.total_hours !== undefined) {
                document.getElementById('totalPomodoroHours').textContent = userData.total_hours;
            }
        }

        function populateLeaderboard(leaderboardData) {
            const listContainer = document.getElementById('leaderboardList');
            if (!listContainer) return;

            listContainer.innerHTML = '';

            let currentUserEmail = localStorage.getItem('currentUserEmail') || "";
            const displayedTopName = document.getElementById('leaderboardUserName')?.textContent || "Goh";

            let listHtml = '';
            let currentUserRank = '--';
            let currentUserHours = '0';

            if (!leaderboardData || leaderboardData.length === 0) {
                listContainer.innerHTML = '<div class="leaderboard-empty">No data yet.</div>';
                return;
            }

            leaderboardData.forEach((user, index) => {
                const rank = index + 1;
                let nameToDisplay = user.fullname;
                if (!nameToDisplay || nameToDisplay.trim() === "" || nameToDisplay === "Unknown User") {
                    if (user.email === currentUserEmail && currentUserEmail) {
                        nameToDisplay = displayedTopName;
                    } else if (user.email) {
                        nameToDisplay = user.email.split('@')[0];
                    }
                }
                const isSelf = (user.email === currentUserEmail && currentUserEmail !== "");

                listHtml += `
                    <div class="leaderboard-item ${isSelf ? 'is-current-user' : ''}" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <span class="rank-num" style="width: 30px; font-weight: bold; color: ${rank <= 3 ? '#3b82f6' : '#888'};">${rank}</span>
                            <div class="user-avatar-small" style="width: 36px; height: 36px; background: rgba(59, 130, 246, 0.2); color: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                ${nameToDisplay.charAt(0).toUpperCase()}
                            </div>
                            <span class="user-name" style="font-weight: ${isSelf ? 'bold' : 'normal'}; color: #fff;">${nameToDisplay}</span>
                        </div>
                        <span class="user-time" style="font-weight: bold; color: #aaa;">${user.totalHours}h</span>
                    </div>
                `;

                if (isSelf) {
                    currentUserRank = `#${rank}`;
                    currentUserHours = user.totalHours;
                }
            });

            listContainer.innerHTML = listHtml;

            const rankNumEl = document.getElementById('userRank');
            const totalHoursEl = document.getElementById('totalPomodoroHours');
            
            if (rankNumEl && currentUserRank !== '--') rankNumEl.textContent = currentUserRank;
            if (totalHoursEl) totalHoursEl.textContent = currentUserHours;
        }
        

        async function recordPomodoro(duration = 25) {
            if (!currentUserId) return;
            
            try {
                const response = await fetch('/api/pomodoro/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: currentUserId,
                        duration: duration
                    })
                });
                const data = await response.json();
                
                if (data.total_minutes) {
                    const totalHours = (data.total_minutes / 60).toFixed(1);
                    document.getElementById('totalPomodoroHours').textContent = totalHours;
                    
                    loadLeaderboard();
                    loadUserStats();
                }
            } catch (error) {
                console.error('Error recording pomodoro:', error);
            }
        }

        function openShareModal() {
            const backdrop = document.getElementById('shareBackdrop');
            const modal = document.getElementById('shareModal');
            
            if (backdrop && modal) {
                const rank = document.getElementById('userRank').textContent.replace('#', '');
                const name = document.getElementById('leaderboardUserName').textContent;
                const totalHours = document.getElementById('totalPomodoroHours').textContent;
                const avgHours = (parseFloat(totalHours) / 30).toFixed(1); 
                
                document.getElementById('shareRankNumber').textContent = rank;
                document.getElementById('shareUserName').textContent = name;
                document.getElementById('shareTotalHours').textContent = totalHours;
                document.getElementById('shareAvgHours').textContent = avgHours;
                
                backdrop.classList.add('open');
                modal.classList.add('open');
                backdrop.onclick = () => closeShareModal();
            }
        }

        function closeShareModal() {
            const backdrop = document.getElementById('shareBackdrop');
            const modal = document.getElementById('shareModal');
            
            if (backdrop && modal) {
                backdrop.classList.remove('open');
                modal.classList.remove('open');
                
                setTimeout(() => {
                    console.log('Share modal closed, cache cleared');
                }, 300);
            }
        }

        function shareToFacebook() {
            const rank = document.getElementById('shareRankNumber').textContent;
            const name = document.getElementById('shareUserName').textContent;
            const text = `I'm ranked #${rank} on the NMLM productivity leaderboard! My name: ${name}. Join me and track your productivity!`;
            const url = encodeURIComponent('https://nmlm.app');
            const quote = encodeURIComponent(text);
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank');
        }

        function shareToInstagram() {
            alert('To share on Instagram, please download the image and upload it manually from the Instagram app.');
        }

        function shareToX() {
            const rank = document.getElementById('shareRankNumber').textContent;
            const name = document.getElementById('shareUserName').textContent;
            const text = `I'm ranked #${rank} on the NMLM productivity leaderboard! My name: ${name}. Join me and track your productivity! 🏆`;
            const url = encodeURIComponent('https://nmlm.app');
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`, '_blank');
        }

        function downloadShareCard() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 600;
            canvas.height = 400;
            
            const gradient = ctx.createLinearGradient(0, 0, 600, 400);
            gradient.addColorStop(0, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 600, 400);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🏆 My Ranking', 300, 60);
            
            const rank = document.getElementById('shareRankNumber').textContent;
            ctx.font = 'bold 120px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#007AFF';
            ctx.fillText('#' + rank, 300, 180);
            
            const name = document.getElementById('shareUserName').textContent;
            ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(name, 300, 220);
            
            const totalHours = document.getElementById('shareTotalHours').textContent;
            const avgHours = document.getElementById('shareAvgHours').textContent;
            ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(`Total: ${totalHours}h | Daily Avg: ${avgHours}h`, 300, 280);
            
            ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText('NMLM - No More Last Minute', 300, 360);
            
            const link = document.createElement('a');
            link.download = 'nmlm-ranking.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }

        async function handleToggleTask(taskId) {
            if (!taskId) {
                console.warn('[Task Toggle] Missing taskId');
                return;
            }
            
            try {
                const response = await safeApiFetch(`/api/tasks/${taskId}/toggle`, {
                    method: 'POST'
                });
                
                if (response) {
                    if (typeof showNotification === 'function') {
                        showNotification('success', 'Updated', 'Task status updated');
                    }
                    
                    if (typeof fetchDailyTasks === 'function') {
                        await fetchDailyTasks();
                    } else if (typeof initAppData === 'function' && localStorage.getItem('userId')) {
                        await initAppData(localStorage.getItem('userId'), false);
                    } else {
                        window.location.reload();
                    }
                    
                    if (typeof refreshStats === 'function') {
                        await refreshStats();
                    }
                }
            } catch (error) {
                console.error('[Task Toggle Error]', error);
                if (typeof showNotification === 'function') {
                    showNotification('error', 'Error', 'Failed to update task status.');
                }
            }
        }

        updateMobileNavVisibility();
