let currentUserId = null; 

/**
 * Initialize all app data after successful login
 * Call this after user authenticates (sign-in, OTP verification)
 * @param {Number|String} userId User ID from backend
 * @param {Boolean} showWelcome Whether to show the welcome notification
 */
async function initAppData(userId, showWelcome = false) {
    currentUserId = userId;
    console.log('[App] Initializing app data for user:', userId);

    try {
        console.log('[App] Loading user information...');
        const userInfo = await fetchUserInfo();
        if (userInfo) {
            updateUserInfo(userInfo);
            updateAccountModal(userInfo);
        }

        console.log('[App] Loading user ranking...');
        const rankData = await fetchUserRank();
        updateUserRank(rankData);

        console.log('[App] Loading today\'s tasks...');
        const todaysTasks = typeof fetchDailyTasks === 'function' ? await fetchDailyTasks() : await fetchTodaysTasks();
        if (todaysTasks === null) {
            console.warn('[App] Today\'s tasks could not be loaded yet. Keeping loading state.');
        } else if (Array.isArray(todaysTasks) && todaysTasks.length > 0) {
            const todayKey = getDateKey(new Date());
            selectedDate = todayKey;
            tasks[todayKey] = todaysTasks;
            renderDailyTasks(todaysTasks);
        } else {
            renderDailyTasks([]);
        }

        console.log('[App] Loading statistics...');
        const monthStats = await fetchMonthlyStats(statsMonth.year, statsMonth.month);
        if (monthStats) {
            const totalEl = document.getElementById('statTotalTask') || document.getElementById('ov-stat-total');
            const completedEl = document.getElementById('statCompletedTask') || document.getElementById('ov-stat-completed');
            const pendingEl = document.getElementById('statPendingTask') || document.getElementById('ov-stat-pending');
            const minutesEl = document.getElementById('statMinutes') || document.getElementById('statStudyMinutes') || document.getElementById('ov-stat-minutes');
            const textEl = document.getElementById('ov-completion-text') || document.getElementById('completionText');
            const ringEl = document.getElementById('ov-completion-ring');
            const percentEl = document.getElementById('ov-completion-percent');
            
            if (totalEl) totalEl.textContent = monthStats.total || 0;
            if (completedEl) completedEl.textContent = monthStats.completed || 0;
            if (pendingEl) pendingEl.textContent = monthStats.pending || 0;
            if (minutesEl) minutesEl.textContent = monthStats.pomodoroMinutes || 0;
            
            const percentage = monthStats.completionPercentage || 0;
            if (percentEl) percentEl.textContent = `${percentage}%`;
            
            if (ringEl) {
                ringEl.style.setProperty('--progress', `${percentage}%`);
                const ringLabel = document.getElementById('ov-completion-ring-label');
                if (ringLabel) ringLabel.textContent = `${percentage}%`;
            }
            
            if (textEl) {
                textEl.textContent = percentage === 0 
                    ? 'No tasks completed yet' 
                    : `${percentage}% completed this month`;
            }
        }

        console.log('[App] Loading pomodoro trend...');
        await renderTrendChart();

        console.log('[App] Loading leaderboard...');
        await loadLeaderboardData();

        updatePomodoroUsage();
        refreshEmotionButtons();

        console.log('[App] Initialization complete');
        if (showWelcome) {
            const welcomeMsg = `Welcome back, ${userInfo?.name || 'User'}!`;
            showNotification('success', translate('welcome-title'), welcomeMsg);
        }
    } catch (error) {
        console.error('[App] Initialization error:', error);
        showNotification('error', translate('load-error-title'), translate('load-error-message'));
    }
}

function integrateInitAppData() {
    const checkLoginInterval = setInterval(() => {
        const userId = localStorage.getItem('userId');
        if (userId && currentUserId !== userId) {
            clearInterval(checkLoginInterval);
            initAppData(userId, false);
        }
    }, 500);
    
    setTimeout(() => clearInterval(checkLoginInterval), 30000);
}

/**
 * Load data when switching to different date/view
 * @param {String} dateKey Date in format "YYYY-M-D"
 */
async function loadTasksForDate(dateKey) {
    try {
        if (tasks[dateKey]) {
            renderDailyTasks(tasks[dateKey]);
            return;
        }

        console.log(`[App] Loading tasks for date: ${dateKey}`);
        const tasksData = await fetchTasksByDate(dateKey);
        if (tasksData) {
            tasks[dateKey] = tasksData;
            renderDailyTasks(tasksData);
        }
    } catch (error) {
        console.error(`Failed to load tasks for ${dateKey}:`, error);
    }
}

function displayUserProfileFromLocalStorage() {
    try {
        const currentUserJson = localStorage.getItem('currentUser');
        if (currentUserJson) {
            const currentUser = JSON.parse(currentUserJson);
            console.log('[App] Found stored user profile:', currentUser.email);
            
            if (typeof updateAccountModal === 'function') {
                updateAccountModal({
                    name: currentUser.fullname || currentUser.name,
                    email: currentUser.email
                });
            }
            if (typeof updateUserInfo === 'function') {
                updateUserInfo({
                    name: currentUser.fullname || currentUser.name,
                    email: currentUser.email
                });
            }
            
            return currentUser;
        }
    } catch (error) {
        console.error('[App] Error reading user profile from localStorage:', error);
    }
    return null;
}

function checkAndRestoreSession() {
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    
    if (userId && userEmail) {
        console.log('[App] Restoring session for user:', userEmail);
        
        displayUserProfileFromLocalStorage();
        
        const navPills = document.getElementById('nav-pills');
        const navActions = document.getElementById('nav-actions');
        if (navPills) navPills.style.display = 'flex';
        if (navActions) navActions.style.display = 'flex';

        showView('dashboard');
        
        initAppData(userId, false);
        return true;
    }
    return false;
}