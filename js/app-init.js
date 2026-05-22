
/**
 * ================================================================
 * APP INITIALIZATION & LIFECYCLE MANAGEMENT
 * ================================================================
 * Initialize app data after user authentication
 * This module loads all user data from the backend
 */

let currentUserId = null; // Store current user ID

/**
 * Initialize all app data after successful login
 * Call this after user authenticates (sign-in, OTP verification)
 * @param {Number|String} userId User ID from backend
 */
async function initAppData(userId, showWelcome = false) {
    currentUserId = userId;
    console.log('[App] Initializing app data for user:', userId);

    try {
        // 1. Load user information
        console.log('[App] Loading user information...');
        const userInfo = await fetchUserInfo();
        if (userInfo) {
            updateUserInfo(userInfo);
            updateAccountModal(userInfo);
        }

        // 2. Load user ranking
        console.log('[App] Loading user ranking...');
        const rankData = await fetchUserRank();
        updateUserRank(rankData);

        // 3. Load today's tasks
        console.log('[App] Loading today\'s tasks...');
        const todaysTasks = typeof fetchDailyTasks === 'function' ? await fetchDailyTasks() : await fetchTodaysTasks();
        if (todaysTasks === null) {
            // Keep the loading placeholder up until a later refresh or retry
            console.warn('[App] Today\'s tasks could not be loaded yet. Keeping loading state.');
        } else if (Array.isArray(todaysTasks) && todaysTasks.length > 0) {
            const todayKey = getDateKey(new Date());
            selectedDate = todayKey;
            tasks[todayKey] = todaysTasks;
            renderDailyTasks(todaysTasks);
        } else {
            renderDailyTasks([]);
        }

        // 4. Load monthly statistics
        console.log('[App] Loading statistics...');
        const monthStats = await fetchMonthlyStats(statsMonth.year, statsMonth.month);
        if (monthStats) {
            const totalEl = document.getElementById('statTotalTask');
            const completedEl = document.getElementById('statCompletedTask');
            const pendingEl = document.getElementById('statPendingTask');
            const minutesEl = document.getElementById('statStudyMinutes');
            const fillEl = document.getElementById('completionFill');
            const textEl = document.getElementById('completionText');
            
            if (totalEl) totalEl.textContent = monthStats.total || 0;
            if (completedEl) completedEl.textContent = monthStats.completed || 0;
            if (pendingEl) pendingEl.textContent = monthStats.pending || 0;
            if (minutesEl) minutesEl.textContent = monthStats.pomodoroMinutes || 0;
            
            const percentage = monthStats.completionPercentage || 0;
            if (fillEl) fillEl.style.width = `${percentage}%`;
            if (textEl) {
                textEl.textContent = percentage === 0 
                    ? 'No tasks completed yet' 
                    : `${percentage}% completed this month`;
            }
        }

        // 5. Load pomodoro trend
        console.log('[App] Loading pomodoro trend...');
        await renderTrendChart();

        // 6. Load leaderboard
        console.log('[App] Loading leaderboard...');
        await loadLeaderboardData();

        // 7. Update pomodoro usage display
        updatePomodoroUsage();
        refreshEmotionButtons();

        console.log('[App] Initialization complete');
        if (showWelcome) {
            showNotification('success', 'Welcome!', `Welcome back, ${userInfo?.name || 'User'}!`);
        }
    } catch (error) {
        console.error('[App] Initialization error:', error);
        showNotification('error', 'Load Error', 'Some data failed to load. Please refresh if needed.');
    }
}

/**
 * Hook initAppData into sign-in flow
 * Update the handleSignIn function to call initAppData
 * This assumes sign-in stores userId in localStorage
 */
function integrateInitAppData() {
    // Listen for successful login (check localStorage for userId)
    const checkLoginInterval = setInterval(() => {
        const userId = localStorage.getItem('userId');
        if (userId && currentUserId !== userId) {
            clearInterval(checkLoginInterval);
            initAppData(userId, false);
        }
    }, 500);
    
    // Clear after 30 seconds
    setTimeout(() => clearInterval(checkLoginInterval), 30000);
}

/**
 * Load data when switching to different date/view
 * @param {String} dateKey Date in format "YYYY-M-D"
 */
async function loadTasksForDate(dateKey) {
    try {
        // Check if already loaded
        if (tasks[dateKey]) {
            renderDailyTasks(tasks[dateKey]);
            return;
        }

        // Fetch from API
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

/**
 * ================================================================
 * Display user profile from localStorage on page load
 * This function runs when page is first loaded/refreshed
 * ================================================================
 */
function displayUserProfileFromLocalStorage() {
    try {
        const currentUserJson = localStorage.getItem('currentUser');
        if (currentUserJson) {
            const currentUser = JSON.parse(currentUserJson);
            console.log('[App] Found stored user profile:', currentUser.email);
            
            // Update both account modal and leaderboard identity immediately
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

/**
 * Auto-initialize when user is already logged in (session restoration)
 * Place this at app startup to check for existing session
 */
function checkAndRestoreSession() {
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    
    if (userId && userEmail) {
        console.log('[App] Restoring session for user:', userEmail);
        
        // First, restore visual profile (Account Modal display)
        displayUserProfileFromLocalStorage();
        
        // Make sure nav is visible after restore
        const navPills = document.getElementById('nav-pills');
        const navActions = document.getElementById('nav-actions');
        if (navPills) navPills.style.display = 'flex';
        if (navActions) navActions.style.display = 'flex';

        // Restore the last known dashboard state
        showView('dashboard');
        
        // Then, refresh all data from backend without showing login toast
        initAppData(userId, false);
        return true;
    }
    return false;
}
