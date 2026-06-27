if (!window.api) {
    window.api = {};
}

window.api.getCurrentUser = function() {
    try {
        return JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch (error) {
        console.warn('Invalid currentUser in localStorage', error);
        return null;
    }
};

async function safeApiFetch(endpoint, options = {}) {
    const API_BASE_URL = 'https://GOH.pythonanywhere.com';
    const API_TIMEOUT = 10000;
    
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    
    const token = localStorage.getItem('authToken');
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    try {
        const url = `${API_BASE_URL}${endpoint}`;
        const response = await fetch(url, {
            headers: defaultHeaders,
            signal: controller.signal,
            ...options,
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`[API Fetch Error] Endpoint: ${endpoint}`, error);
        throw error;
    }
}

window.api.getTasksByDate = async function(dateKey) {
    const response = await safeApiFetch(`/api/tasks?date=${encodeURIComponent(dateKey)}`, {
        method: 'GET',
    });
    if (Array.isArray(response)) {
        return response;
    }
    return response.tasks || [];
};

window.api.toggleTaskStatus = async function(taskId) {
    const response = await safeApiFetch(`/api/tasks/${encodeURIComponent(taskId)}/toggle`, {
        method: 'POST',
    });
    return response;
};

window.api.getUserRank = async function() {
    try {
        const primary = await safeApiFetch('/api/leaderboard/me', {
            method: 'GET',
        });
        return {
            rank: primary.rank || primary.position || '--',
            percentile: primary.percentile || 0,
            totalUsers: primary.total_users || primary.totalUsers || 0,
            username: primary.username || primary.name || window.api.getCurrentUser()?.fullname || ''
        };
    } catch (primaryError) {
        console.warn('[API] /api/leaderboard/me failed, falling back to /api/user/rank', primaryError);
        try {
            const fallback = await safeApiFetch('/api/user/rank', {
                method: 'GET',
            });
            return {
                rank: fallback.rank || fallback.position || '--',
                percentile: fallback.percentile || 0,
                totalUsers: fallback.totalUsers || fallback.total_users || 0,
                username: fallback.username || fallback.name || window.api.getCurrentUser()?.fullname || ''
            };
        } catch (fallbackError) {
            console.error('[API] User rank fallback failed:', fallbackError);
            return { rank: '--', percentile: 0, totalUsers: 0, username: window.api.getCurrentUser()?.fullname || '' };
        }
    }
};

window.api.fetchStatsSummary = async function(year, month) {
    try {
        const route = `/api/stats/summary?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month + 1)}`;
        const response = await safeApiFetch(route, { method: 'GET' });
        return response.stats || response;
    } catch (error) {
        console.warn('[API] /api/stats/summary failed, falling back to /api/stats/month', error);
        try {
            const response = await safeApiFetch(`/api/stats/month/${year}/${month + 1}`, {
                method: 'GET',
            });
            return response.stats || response;
        } catch (fallbackError) {
            console.error('[API] fetchStatsSummary fallback failed:', fallbackError);
            return { total: 0, completed: 0, pending: 0, pomodoroMinutes: 0, completionPercentage: 0 };
        }
    }
};

window.api.fetchDailyMood = async function(dateKey) {
    try {
        const response = await safeApiFetch(`/api/mood?date=${encodeURIComponent(dateKey)}`, {
            method: 'GET',
        });
        if (response && typeof response.mood === 'string') {
            return response.mood;
        }
        return '';
    } catch (error) {
        console.warn('[API] fetchDailyMood failed, using local fallback:', error);
        return localStorage.getItem(`${dateKey}-dailyMood`) || '';
    }
};

window.api.submitDailyMood = async function(mood, dateKey) {
    const response = await safeApiFetch('/api/mood', {
        method: 'POST',
        body: JSON.stringify({ mood, date: dateKey }),
    });
    return response;
};

window.api.createTask = async function(taskData) {
    const response = await safeApiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
    });
    return response.task || response;
};

window.api.fetchLeaderboard = async function(limit = 10) {
    const response = await safeApiFetch(`/api/leaderboard?limit=${encodeURIComponent(limit)}`, {
        method: 'GET',
    });
    return response.leaderboard || response.data || [];
};
