const API_BASE_URL = 'https://GOH.pythonanywhere.com';
const API_TIMEOUT = 10000;

async function apiFetch(endpoint, options = {}) {
    try {
        const url = `${API_BASE_URL}${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json',
        };

        const token = localStorage.getItem('authToken');
        if (token) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }

        const response = await Promise.race([
            fetch(url, {
                headers: defaultHeaders,
                ...options,
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), API_TIMEOUT)
            )
        ]);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error.message);
        throw error;
    }
}

/**
 * Fetch today's tasks from backend
 * @returns {Promise<Array>} Array of task objects
 */
async function fetchTodaysTasks() {
    const todayKey = new Date().toISOString().split('T')[0];
    return fetchTasksByDate(todayKey);
}

/**
 * Fetch today's tasks from backend
 * Falls back to /api/tasks?date=YYYY-MM-DD if needed.
 * @returns {Promise<Array|null>} Array of task objects or null when request fails
 */
async function fetchDailyTasks() {
    const todayKey = new Date().toISOString().split('T')[0];
    try {
        return await fetchTasksByDate(todayKey);
    } catch (error) {
        console.warn('fetchDailyTasks failed:', error);
        return [];
    }
}

/**
 * Fetch tasks for a specific date
 * @param {String} dateKey Format: "YYYY-M-D"
 * @returns {Promise<Array>} Array of task objects
 */
async function fetchTasksByDate(dateKey) {
    try {
        const response = await apiFetch(`/api/tasks?date=${encodeURIComponent(dateKey)}`, {
            method: 'GET',
        });
        if (Array.isArray(response)) {
            return response;
        }
        return response.tasks || [];
    } catch (error) {
        console.error(`Failed to fetch tasks for ${dateKey}:`, error);
        return [];
    }
}

async function toggleTaskStatus(taskId) {
    try {
        const response = await apiFetch(`/api/tasks/${encodeURIComponent(taskId)}/toggle`, {
            method: 'POST',
        });
        return response;
    } catch (error) {
        console.error(`Failed to toggle status for task ${taskId}:`, error);
        return null;
    }
}

/**
 * Create a new task
 * @param {Object} taskData { title, description, time, color, dateKey }
 * @returns {Promise<Object>} Created task object
 */
async function createTask(taskData) {
    try {
        const data = await apiFetch('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData),
        });
        return data.task || null;
    } catch (error) {
        console.error('Failed to create task:', error);
        throw error;
    }
}

/**
 * Update an existing task
 * @param {Number} taskId Task ID
 * @param {Object} updates Partial task update object
 * @returns {Promise<Object>} Updated task object
 */
async function updateTask(taskId, updates) {
    try {
        const data = await apiFetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
        return data.task || null;
    } catch (error) {
        console.error(`Failed to update task ${taskId}:`, error);
        throw error;
    }
}

/**
 * Toggle task completion status
 * @param {Number} taskId Task ID
 * @param {Boolean} completed New completion status
 * @returns {Promise<Object>} Updated task object
 */
async function toggleTaskCompletion(taskId, completed) {
    return updateTask(taskId, { completed });
}

/**
 * Delete a task
 * @param {Number} taskId Task ID
 * @returns {Promise<Boolean>} Success status
 */
async function deleteTask(taskId) {
    try {
        await apiFetch(`/api/tasks/${taskId}`, {
            method: 'DELETE',
        });
        return true;
    } catch (error) {
        console.error(`Failed to delete task ${taskId}:`, error);
        return false;
    }
}

/**
 * Fetch current user information
 * @returns {Promise<Object>} User object { id, name, email, avatar, rank, totalHours }
 */
async function fetchUserInfo() {
    try {
        const data = await apiFetch('/api/user/info', {
            method: 'GET',
        });
        return data.user || null;
    } catch (error) {
        console.error('Failed to fetch user info:', error);
        return null;
    }
}

/**
 * Fetch user ranking
 * @returns {Promise<Object>} Ranking data { rank, percentile, totalUsers }
 */
async function fetchUserRank() {
    try {
        const data = await apiFetch('/api/leaderboard/me', {
            method: 'GET',
        });
        return {
            rank: Number(data.rank) || '--',
            percentile: data.percentile || 0,
            totalUsers: data.total_users || data.totalUsers || 0,
        };
    } catch (firstError) {
        console.warn('fetchUserRank /api/leaderboard/me failed, attempting /api/user/rank:', firstError);
        try {
            const fallback = await apiFetch('/api/user/rank', {
                method: 'GET',
            });
            return {
                rank: Number(fallback.rank) || '--',
                percentile: fallback.percentile || 0,
                totalUsers: fallback.totalUsers || 0,
            };
        } catch (fallbackError) {
            console.error('fetchUserRank fallback failed:', fallbackError);
            return { rank: '--', percentile: 0, totalUsers: 0 };
        }
    }
}

/**
 * Fetch monthly statistics
 * @param {Number} year
 * @param {Number} month 0-based (0 = January)
 * @returns {Promise<Object>} Stats { total, completed, pending, pomodoroMinutes, completionPercentage }
 */
async function fetchMonthlyStats(year, month) {
    try {
        const data = await apiFetch(`/api/stats/month/${year}/${month + 1}`, {
            method: 'GET',
        });
        return data.stats || {
            total: 0,
            completed: 0,
            pending: 0,
            pomodoroMinutes: 0,
            completionPercentage: 0,
        };
    } catch (error) {
        console.error(`Failed to fetch stats for ${year}-${month + 1}:`, error);
        return {
            total: 0,
            completed: 0,
            pending: 0,
            pomodoroMinutes: 0,
            completionPercentage: 0,
        };
    }
}

/**
 * Fetch daily pomodoro trend data
 * @param {Number} year
 * @param {Number} month 0-based
 * @returns {Promise<Object>} Trend data { days: [{ date, minutes }] }
 */
async function fetchPomodoroTrend(year, month) {
    try {
        const data = await apiFetch(`/api/stats/pomodoro-trend/${year}/${month + 1}`, {
            method: 'GET',
        });
        return data.trend || { days: [] };
    } catch (error) {
        console.error(`Failed to fetch pomodoro trend:`, error);
        return { days: [] };
    }
}

/**
 * Fetch leaderboard data
 * @param {Number} limit Number of top users to fetch (default: 10)
 * @returns {Promise<Array>} Array of leaderboard entries
 */
async function fetchLeaderboard(limit = 10) {
    try {
        const data = await apiFetch(`/api/leaderboard?limit=${limit}`, {
            method: 'GET',
        });
        return data.leaderboard || [];
    } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
        return [];
    }
}

/**
 * Submit today's mood status to the backend
 * @param {string} mood
 * @param {string} dateKey
 * @returns {Promise<Object>} Server response
 */
async function submitDailyMood(mood, dateKey) {
    try {
        return await apiFetch('/api/mood', {
            method: 'POST',
            body: JSON.stringify({ mood, date: dateKey }),
        });
    } catch (error) {
        console.error('Failed to submit daily mood:', error);
        return null;
    }
}
