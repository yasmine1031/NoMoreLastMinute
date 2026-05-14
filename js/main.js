// 全局变量
let selectedDate = null;
let currentYear = 2026;
let currentMonth = 4; // JS月份从0开始，4代表5月
let tasks = {}; // 存储任务的对象，键为日期字符串
let pomodoroHistory = {};
let emotionHistory = {};
let statsMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };
let pendingEmail = '';

const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    renderCalendar(currentYear, currentMonth);
    setupColorPicker();
    initializeStats();

    const hash = window.location.hash.slice(1);
    if (hash === 'pomodoro') {
        showView('pomodoro');
    } else if (hash === 'otp') {
        showView('otp');
    } else if (hash === 'zen') {
        showView('pomodoro');
        enableZenMode(true);
    } else if (location.pathname.endsWith('index.html') && !hash) {
        // Default to intro page (nav bar will be hidden by showView)
        showView('intro');
    }
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
// saveTask moved to appended Pomodoro module

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
    const totalEl = document.getElementById('statTotalTask');
    const completedEl = document.getElementById('statCompletedTask');
    const pendingEl = document.getElementById('statPendingTask');
    const studyMinutesEl = document.getElementById('statStudyMinutes');
    const completionFillEl = document.getElementById('completionFill');
    const completionTextEl = document.getElementById('completionText');
    if (!totalEl || !completedEl || !pendingEl || !studyMinutesEl || !completionFillEl || !completionTextEl) return;
    totalEl.textContent = summary.total;
    completedEl.textContent = summary.completed;
    pendingEl.textContent = summary.pending;
    studyMinutesEl.textContent = summary.minutes;
    completionFillEl.style.width = `${summary.percentage}%`;
    completionTextEl.textContent = summary.percentage === 0 ? 'No tasks completed yet' : `${summary.percentage}% completed this month`;
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
            'https://assets.mixkit.co/music/preview/mixkit-relaxing-meditation-291.mp3',
            'https://assets.mixkit.co/music/preview/mixkit-romantic-piano-1481.mp3'
        ];
        const pomodoroRingCircumference = 2 * Math.PI * 104;

        // 番茄钟同步函数
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

        // 每 500ms 同步一次状态
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
        }, 500);

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

        function updatePomodoroDisplay() {
            const display = document.getElementById('pomodoroTimerDisplay');
            const ring = document.getElementById('pomodoroRingProgress');
            const dot = document.getElementById('pomodoroRingDot');
            const total = pomodoroTotalSeconds > 0 ? pomodoroTotalSeconds : 1;
            const progress = pomodoroTotalSeconds > 0 ? Math.max(0, Math.min(1, pomodoroRemainingSeconds / total)) : 0;
            const offset = pomodoroRingCircumference - pomodoroRingCircumference * progress;
            if (ring) {
                ring.style.strokeDashoffset = offset;
            }
            if (dot) {
                dot.style.transform = `rotate(${360 * (1 - progress)}deg)`;
            }
            if (display) {
                display.innerText = formatTime(pomodoroRemainingSeconds);
            }
            updateZenTimerDisplay();
        }

        function updateZenTimerDisplay() {
            const zenDisplay = document.getElementById('zenTimerDisplay');
            if (zenDisplay) {
                zenDisplay.innerText = formatTime(pomodoroRemainingSeconds);
            }
        }

        function renderPomodoroView() {
            restorePomodoroState();
            initPomodoroWidgets();
            setWheelLockState();
            updatePomodoroDisplay();
            updateZenTimerDisplay();
            const startBtn = document.getElementById('startPomodoroBtn');
            const pauseBtn = document.getElementById('pausePomodoroBtn');
            const resetBtn = document.getElementById('resetPomodoroBtn');
            if (pomodoroRunning) {
                if (startBtn) startBtn.style.display = 'none';
                if (pauseBtn) {
                    pauseBtn.style.display = 'inline-flex';
                    pauseBtn.innerText = pomodoroPaused ? 'Continue' : 'Pause';
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
            pomodoroRunning = true;
            pomodoroPaused = false;
            syncPomodoroState();
            setWheelLockState();
            const startBtn = document.getElementById('startPomodoroBtn');
            const pauseBtn = document.getElementById('pausePomodoroBtn');
            const resetBtn = document.getElementById('resetPomodoroBtn');
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) {
                pauseBtn.style.display = 'inline-flex';
                pauseBtn.innerText = 'Pause';
            }
            if (resetBtn) resetBtn.style.display = 'inline-flex';

            if (pomodoroTotalSeconds === 0) {
                pomodoroRemainingSeconds = 0;
                updatePomodoroDisplay();
                updateZenTimerDisplay();
                playPomodoroEndSound();
                showNotification('success', 'Pomodoro Complete', 'Zero-second session completed.');
                pomodoroRunning = false;
                setWheelLockState();
                if (startBtn) startBtn.style.display = 'inline-flex';
                if (pauseBtn) pauseBtn.style.display = 'none';
                if (resetBtn) resetBtn.style.display = 'none';
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
                        if (startBtn) startBtn.style.display = 'inline-flex';
                        if (pauseBtn) pauseBtn.style.display = 'none';
                        if (resetBtn) resetBtn.style.display = 'none';
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
            const pauseBtn = document.getElementById('pausePomodoroBtn');
            const zenPlayPauseBtn = document.getElementById('zenPlayPauseBtn');
            if (pauseBtn) {
                pauseBtn.innerText = pomodoroPaused ? 'Continue' : 'Pause';
            }
            if (zenPlayPauseBtn) {
                zenPlayPauseBtn.innerHTML = pomodoroPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
            }
            showNotification('success', pomodoroPaused ? 'Paused' : 'Resumed', pomodoroPaused ? 'Timer paused.' : 'Timer resumed.');
        }

        function toggleTimer() {
            togglePomodoroPause();
        }

        function resetPomodoro() {
            if (pomodoroIntervalId) {
                clearInterval(pomodoroIntervalId);
            }
            pomodoroRunning = false;
            pomodoroPaused = false;
            setWheelLockState();
            pomodoroRemainingSeconds = pomodoroTotalSeconds;
            updatePomodoroDisplay();
            updateZenTimerDisplay();
            syncPomodoroState();
            const startBtn = document.getElementById('startPomodoroBtn');
            const pauseBtn = document.getElementById('pausePomodoroBtn');
            const resetBtn = document.getElementById('resetPomodoroBtn');
            const zenPlayPauseBtn = document.getElementById('zenPlayPauseBtn');
            if (startBtn) startBtn.style.display = 'inline-flex';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resetBtn) resetBtn.style.display = 'none';
            if (zenPlayPauseBtn) zenPlayPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }

        function enterZenMode() {
            showView('pomodoro');
            enableZenMode(true);
        }

        function exitZenMode() {
            enableZenMode(false);
        }

        function enableZenMode(active) {
            document.body.classList.toggle('zen-mode-active', active);
            if (typeof setParticleTheme === 'function') {
                setParticleTheme(active ? 'zen' : 'default');
            }
            if (active) {
                if (zenMusicEnabled) {
                    playZenMusic();
                }
            } else {
                pauseZenMusic();
            }
        }

        function setPomodoroEndSoundSource(url) {
            pomodoroEndSoundSrc = url;
            const endAudio = document.getElementById('pomodoroEndAudio');
            if (endAudio) {
                endAudio.src = url;
            }
        }

        function playPomodoroEndSound() {
            const endAudio = document.getElementById('pomodoroEndAudio');
            if (!endAudio || !pomodoroEndSoundSrc) return;
            if (endAudio.src !== pomodoroEndSoundSrc) {
                endAudio.src = pomodoroEndSoundSrc;
            }
            endAudio.volume = 0.75;
            endAudio.play().catch(() => {
                console.warn('Pomodoro end sound blocked.');
            });
        }

        function setZenMusicSources(sources) {
            zenMusicSources = Array.isArray(sources) ? sources : [];
        }

        function playZenMusic() {
            const audio = document.getElementById('zenAudio');
            if (!audio || !zenMusicSources.length) return;
            const nextTrack = zenMusicSources[Math.floor(Math.random() * zenMusicSources.length)];
            if (audio.src !== nextTrack) {
                audio.src = nextTrack;
            }
            audio.volume = 0.38;
            audio.play().catch(() => {
                console.warn('Zen music playback blocked.');
            });
            audio.onended = () => {
                if (zenMusicEnabled) {
                    playZenMusic();
                }
            };
        }

        function pauseZenMusic() {
            const audio = document.getElementById('zenAudio');
            if (!audio) return;
            audio.pause();
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

            // Control pulse-ring visibility: only show on intro, signin, signup pages
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
                // Hide nav bar elements on auth pages (intro, signin, signup)
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

        async function handleSignIn() {
            const email = document.getElementById('signin-email').value;
            const password = document.getElementById('signin-password').value;
            try {
                const response = await fetch('http://127.0.0.1:5000/api/signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (response.ok) {
                    document.getElementById('nav-pills').style.display = 'flex';
                    document.getElementById('nav-actions').style.display = 'flex';
                    
                    const blueCircle = document.getElementById('video-placeholder');
                    if (blueCircle) blueCircle.style.display = 'none';

                    document.getElementById('user-greeting').innerText = `Hello, ${data.user.fullname}`;
                    
                    // Set current user ID and load leaderboard
                    currentUserId = data.user.id;
                    // 设置 main.js 中的用户ID
                    if (typeof setCurrentUser === 'function') {
                        setCurrentUser(currentUserId);
                    }
                    loadLeaderboard();
                    loadUserStats();
                    
                    showNotification('success', 'Welcome Back!', `Hello ${data.user.fullname}, you're now signed in.`);
                    setTimeout(() => {
                        showView('dashboard');
                    }, 1200);
                } else {
                    showNotification('error', 'Login Failed', data.message);
                }
            } catch (err) { 
                showNotification('error', 'Connection Error', 'Backend server not running!'); 
            }
        }

        async function handleSignUp() {
            const fullname = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;
            const confirmError = document.getElementById('confirm-error');

            // Check if passwords match
            if (password !== confirmPassword) {
                confirmError.textContent = "Passwords do not match!";
                confirmError.classList.add('show');
                return;
            }

            // Check password strength (minimum medium required)
            const strength = getPasswordStrength(password);
            if (strength < 3) {
                confirmError.textContent = "Password is too weak! Please use a stronger password.";
                confirmError.classList.add('show');
                return;
            }

            confirmError.classList.remove('show');

            try {
                const response = await fetch('http://127.0.0.1:5000/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullname, email, password })
                });
                const data = await response.json();
                if (response.ok) {
                    pendingEmail = email;
                    localStorage.setItem('pendingEmail', email);
                    // Show the embedded OTP verification view
                    showView('otp');
                    setTimeout(() => {
                        const firstOtp = document.getElementById('otp-1');
                        if (firstOtp) firstOtp.focus();
                    }, 100);
                    showNotification('success', 'OTP Sent', 'OTP 已发送到您的邮箱，请继续验证。');
                    return;
                } else {
                    showNotification('error', 'Registration Failed', data.message);
                }
            } catch (err) { 
                showNotification('error', 'Connection Error', 'Backend server not running!'); 
            }
        }

        // OTP Functions
        function handleOtpInput(current, nextId) {
            const value = current.value;
            current.value = value.replace(/[^0-9]/g, '');
            if (current.value.length === 1) {
                current.classList.add('filled');
                if (nextId) {
                    const nextInput = document.getElementById(nextId);
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            } else {
                current.classList.remove('filled');
            }
        }

        function handleOtpKeydown(event, current, prevId) {
            if (event.key === 'Backspace') {
                if (!current.value && prevId) {
                    const prevInput = document.getElementById(prevId);
                    if (prevInput) {
                        prevInput.focus();
                    }
                }
            }
        }

        function getOtpCode() {
            let code = '';
            for (let i = 1; i <= 6; i++) {
                const input = document.getElementById('otp-' + i);
                if (input) code += input.value;
            }
            return code;
        }

        function clearOtpInputs() {
            for (let i = 1; i <= 6; i++) {
                const input = document.getElementById('otp-' + i);
                if (input) {
                    input.value = '';
                    input.classList.remove('filled', 'error', 'success');
                }
            }
        }

        function showAllOtpInputs(state) {
            for (let i = 1; i <= 6; i++) {
                const input = document.getElementById('otp-' + i);
                if (input) {
                    input.classList.remove('filled', 'error', 'success');
                    if (state) input.classList.add(state);
                }
            }
        }

        async function handleOtpVerify() {
            const code = getOtpCode();
            if (code.length !== 6) {
                showAllOtpInputs('error');
                showNotification('error', 'Invalid Code', 'Please enter all 6 digits of the verification code.');
                return;
            }

            try {
                const response = await fetch('http://127.0.0.1:5000/api/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                const data = await response.json();
                if (response.ok) {
                    showAllOtpInputs('success');
                    showNotification('success', 'Email Verified!', 'Your account has been verified successfully.');
                    setTimeout(() => {
                        localStorage.removeItem('pendingEmail');
                        clearOtpInputs();
                        showView('signin');
                    }, 1500);
                } else {
                    showAllOtpInputs('error');
                    showNotification('error', 'Verification Failed', data.message || 'Invalid or expired verification code.');
                }
            } catch (err) {
                showNotification('error', 'Connection Error', 'Backend server not running!');
            }
        }

        async function resendOtp() {
            const email = pendingEmail || localStorage.getItem('pendingEmail');
            if (!email) {
                showNotification('error', 'Email Missing', 'Please return to sign up and re-enter your email.');
                return;
            }

            try {
                const response = await fetch('http://127.0.0.1:5000/api/resend-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();
                if (response.ok) {
                    showNotification('success', 'Code Sent!', data.message || 'A new verification code has been sent to your email.');
                } else {
                    showNotification('error', 'Resend Failed', data.message || 'Unable to resend code.');
                }
            } catch (err) {
                showNotification('error', 'Connection Error', 'Backend server not running!');
            }
        }

        function goBackToSignUp() {
            localStorage.removeItem('pendingEmail');
            pendingEmail = '';
            showView('signup');
        }

        // Notification System
        function showNotification(type, title, message) {
            const backdrop = document.getElementById('notificationBackdrop');
            const modal = document.getElementById('notificationModal');
            const window = document.getElementById('notificationWindow');
            const icon = document.getElementById('notificationIcon');
            const titleEl = document.getElementById('notificationTitle');
            const messageEl = document.getElementById('notificationMessage');
            const closeBtn = document.getElementById('notificationCloseBtn');

            // Set content
            titleEl.textContent = title;
            messageEl.textContent = message;
            
            // Set type
            window.className = 'notification-window ' + type;
            modal.className = 'notification-modal ' + type;
            
            // Set icon
            if (type === 'success') {
                icon.textContent = '✓';
            } else {
                icon.textContent = '✕';
            }

            // Show close button only for error
            closeBtn.style.display = type === 'error' ? 'flex' : 'none';

            // Show modal
            backdrop.classList.add('show');
            modal.classList.add('show');

            // Auto hide for success after 1 second
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

        // Close notification when clicking backdrop
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

        // Password Strength Checker
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

            // Show checkmark for strong passwords (score >= 4)
            if (strength >= 4) {
                check.classList.add('show');
            } else {
                check.classList.remove('show');
            }

            // Clear confirm error when password changes
            if (confirmInput.value) {
                if (password === confirmInput.value) {
                    confirmError.classList.remove('show');
                }
            }
        }

        // Confirm password validation on input
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

        function saveTask() {
            if (!selectedDate) {
                alert("Please select a date first!");
                return;
            }

            const titleEl = document.getElementById('task-title');
            const descEl = document.getElementById('task-desc');
            const timeEl = document.getElementById('task-time'); // 获取新元素

            if (!titleEl.value.trim()) {
                alert("Please enter a title");
                return;
            }

            // 处理时间：优先使用用户选择的时间，否则使用当前系统时间
            let finalTime;
            if (timeEl && timeEl.value) {
                // 将 24小时制的 input 值转换为 12小时制 (例如 14:00 -> 02:00 PM)
                const [hours, minutes] = timeEl.value.split(':');
                const suffix = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours % 12 || 12;
                finalTime = `${displayHours}:${minutes} ${suffix}`;
            } else {
                const now = new Date();
                finalTime = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }

            const newTask = {
                title: titleEl.value.trim(),
                description: descEl.value.trim(),
                color: selectedColor,
                time: finalTime // 使用处理后的时间
            };

            if (!tasks[selectedDate]) tasks[selectedDate] = [];
            tasks[selectedDate].push(newTask);

            // 重置输入框
            titleEl.value = '';
            descEl.value = '';
            timeEl.value = ''; // 清空时间选择
            
            updateTaskList();
        }

        // ==================== Modal Functions ====================
        
        // Open Modal
        function openModal(type) {
            const backdrop = document.getElementById(type + 'Backdrop');
            const modal = document.getElementById(type + 'Modal');
            
            if (backdrop && modal) {
                backdrop.classList.add('open');
                modal.classList.add('open');
                backdrop.onclick = () => closeModal(type);
            }
        }

        // Close Modal
        function closeModal(type) {
            const backdrop = document.getElementById(type + 'Backdrop');
            const modal = document.getElementById(type + 'Modal');
            
            if (backdrop && modal) {
                backdrop.classList.remove('open');
                modal.classList.remove('open');
            }
        }

        // Search Function
        function handleSearch(query) {
            const searchResults = document.getElementById('searchResults');
            const pages = ['Dashboard', 'Task', 'Leaderboard', 'Stats', 'Pomodoro'];
            
            if (!query.trim()) {
                searchResults.innerHTML = '';
                return;
            }

            const lowerQuery = query.toLowerCase();
            const results = [];

            // Search pages
            pages.forEach(page => {
                if (page.toLowerCase().includes(lowerQuery)) {
                    results.push({ type: 'page', name: page, icon: '📄' });
                }
            });

            // Search tasks
            Object.keys(tasks).forEach(date => {
                tasks[date].forEach((task, index) => {
                    if (task.title.toLowerCase().includes(lowerQuery)) {
                        results.push({ type: 'task', name: task.title, date: date, icon: '✓' });
                    }
                });
            });

            // Display results
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

        // Switch Settings Tab
        function switchSettingsTab(event, tabName) {
            // Update active menu item
            document.querySelectorAll('.settings-menu-item').forEach(item => {
                item.classList.remove('active');
            });
            event.target.classList.add('active');

            // Update active section
            document.querySelectorAll('.settings-section').forEach(section => {
                section.classList.remove('active');
            });
            const section = document.getElementById('settings-' + tabName);
            if (section) section.classList.add('active');
        }

        // Edit Profile
        function editProfile() {
            const newName = prompt('Enter your new name:', document.getElementById('accountName').innerText);
            if (newName && newName.trim()) {
                document.getElementById('accountName').innerText = newName;
            }
        }

        // Switch Account
        function switchAccount() {
            if (confirm('Are you sure you want to switch accounts?')) {
                showView('signin');
                closeModal('account');
                closeMobileMenu();
            }
        }

        // Logout
        function confirmLogout() {
            if (confirm('Are you sure you want to logout?')) {
                showView('intro');
                closeModal('account');
                closeMobileMenu();
                document.getElementById('nav-pills').style.display = 'none';
                document.getElementById('nav-actions').style.display = 'none';
            }
        }

        // Change Avatar
        function changeAvatar() {
            const initials = prompt('Enter your initials (1-2 characters):', 'U');
            if (initials && initials.trim()) {
                document.getElementById('accountAvatar').innerText = initials.toUpperCase().substring(0, 2);
            }
        }

        // Open Mail Client
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

        // ==================== Leaderboard Functions ====================
        
        // Current user ID (set after login)
        let currentUserId = null;

        // Fetch and display leaderboard data
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

        // Fetch current user stats
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

        // Update leaderboard with user data
        function updateLeaderboard(userData) {
            // Update user rank
            if (userData.rank) {
                document.getElementById('userRank').textContent = '#' + userData.rank;
            }
            
            // Update user name and avatar
            if (userData.name) {
                document.getElementById('leaderboardUserName').textContent = userData.name;
                document.getElementById('leaderboardAvatar').textContent = userData.name.charAt(0).toUpperCase();
            }
            
            // Update total pomodoro time
            if (userData.total_hours !== undefined) {
                document.getElementById('totalPomodoroHours').textContent = userData.total_hours;
            }
        }

        // Populate leaderboard list from database
        function populateLeaderboard(leaderboardData) {
            const listContainer = document.getElementById('leaderboardList');
            if (!listContainer) return;
            
            listContainer.innerHTML = leaderboardData.map((user) => `
                <div class="leaderboard-item ${user.id === currentUserId ? 'current-user' : ''}">
                    <span class="lb-rank">#${user.rank}</span>
                    <div class="lb-avatar">${user.name.charAt(0).toUpperCase()}</div>
                    <span class="lb-name">${user.name}</span>
                    <span class="lb-avg">${user.avg_daily_hours}h/day</span>
                    <span class="lb-total">${user.total_hours}h</span>
                </div>
            `).join('');
        }

        // Record completed pomodoro
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
                    // Update total time display
                    const totalHours = (data.total_minutes / 60).toFixed(1);
                    document.getElementById('totalPomodoroHours').textContent = totalHours;
                    
                    // Refresh leaderboard
                    loadLeaderboard();
                    loadUserStats();
                }
            } catch (error) {
                console.error('Error recording pomodoro:', error);
            }
        }

        // ==================== Share Modal Functions ====================
        
        // Open share modal with user data
        function openShareModal() {
            const backdrop = document.getElementById('shareBackdrop');
            const modal = document.getElementById('shareModal');
            
            if (backdrop && modal) {
                // Update share card with current user data
                const rank = document.getElementById('userRank').textContent.replace('#', '');
                const name = document.getElementById('leaderboardUserName').textContent;
                const totalHours = document.getElementById('totalPomodoroHours').textContent;
                const avgHours = (parseFloat(totalHours) / 30).toFixed(1); // Approximate daily average
                
                document.getElementById('shareRankNumber').textContent = rank;
                document.getElementById('shareUserName').textContent = name;
                document.getElementById('shareTotalHours').textContent = totalHours;
                document.getElementById('shareAvgHours').textContent = avgHours;
                
                backdrop.classList.add('open');
                modal.classList.add('open');
                backdrop.onclick = () => closeShareModal();
            }
        }

        // Close share modal and clear cache
        function closeShareModal() {
            const backdrop = document.getElementById('shareBackdrop');
            const modal = document.getElementById('shareModal');
            
            if (backdrop && modal) {
                backdrop.classList.remove('open');
                modal.classList.remove('open');
                
                // Clear any temporary cache
                setTimeout(() => {
                    // Clean up any generated images or data
                    console.log('Share modal closed, cache cleared');
                }, 300);
            }
        }

        // Share to Facebook
        function shareToFacebook() {
            const rank = document.getElementById('shareRankNumber').textContent;
            const name = document.getElementById('shareUserName').textContent;
            const text = `I'm ranked #${rank} on the NMLM productivity leaderboard! My name: ${name}. Join me and track your productivity!`;
            const url = encodeURIComponent('https://nmlm.app');
            const quote = encodeURIComponent(text);
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank');
        }

        // Share to Instagram (opens Instagram app/page)
        function shareToInstagram() {
            alert('To share on Instagram, please download the image and upload it manually from the Instagram app.');
        }

        // Share to X (Twitter)
        function shareToX() {
            const rank = document.getElementById('shareRankNumber').textContent;
            const name = document.getElementById('shareUserName').textContent;
            const text = `I'm ranked #${rank} on the NMLM productivity leaderboard! My name: ${name}. Join me and track your productivity! 🏆`;
            const url = encodeURIComponent('https://nmlm.app');
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`, '_blank');
        }

        // Download share card as image
        function downloadShareCard() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 600;
            canvas.height = 400;
            
            // Background
            const gradient = ctx.createLinearGradient(0, 0, 600, 400);
            gradient.addColorStop(0, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 600, 400);
            
            // Card content
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🏆 My Ranking', 300, 60);
            
            // Rank
            const rank = document.getElementById('shareRankNumber').textContent;
            ctx.font = 'bold 120px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#007AFF';
            ctx.fillText('#' + rank, 300, 180);
            
            // Name
            const name = document.getElementById('shareUserName').textContent;
            ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(name, 300, 220);
            
            // Stats
            const totalHours = document.getElementById('shareTotalHours').textContent;
            const avgHours = document.getElementById('shareAvgHours').textContent;
            ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(`Total: ${totalHours}h | Daily Avg: ${avgHours}h`, 300, 280);
            
            // Footer
            ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText('NMLM - No More Last Minute', 300, 360);
            
            // Download
            const link = document.createElement('a');
            link.download = 'nmlm-ranking.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }

        updateMobileNavVisibility();