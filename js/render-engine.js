/**
 * Render today's tasks with API data
 * Maintains exact CSS structure from original HTML
 * @param {Array} tasksData Array of task objects from API
 */
function renderDailyTasks(tasksData) {
    const container = document.getElementById('daily-task-list');
    if (!container) return;
    if (tasksData === null) {
        return;
    }
    if (!Array.isArray(tasksData) || tasksData.length === 0) {
        container.innerHTML = '<div class="empty-task-state">' + (window.i18n ? window.i18n('all-caught-up-today') : '🎉 All caught up for today!') + '</div>';
        return;
    }

    container.innerHTML = tasksData.map(task => {
        const timeText = task.startTime && task.endTime
            ? `${task.startTime} - ${task.endTime}`
            : (task.startTime || task.time || 'No time set');
        
        const isCompleted = task.status === 'completed' || task.completed === true;

        return `
        <div class="task-item-entry ${isCompleted ? 'task-completed-style' : ''}" data-id="${task.id || task._id}" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div class="task-info" style="display: flex; align-items: center; gap: 10px; flex: 1;">
                <span class="dot-indicator" style="background: ${task.color || '#007AFF'}; flex-shrink: 0;"></span>
                <div class="text-group">
                    <p class="t-name" style="${isCompleted ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${escapeHtml(task.title)}</p>
                    <p class="t-time">${escapeHtml(timeText)}</p>
                </div>
            </div>
            <button class="task-complete-toggle action-toggle-btn" 
                    data-id="${task.id || task._id}"
                    style="background: ${isCompleted ? 'rgba(255,255,255,0.1)' : 'var(--apple-blue)'}; border: none; padding: 6px 12px; border-radius: 12px; color: #fff; cursor: pointer; font-size: 12px; z-index: 10; flex-shrink: 0;">
                ${isCompleted ? '↩️ Redo' : '✅ Done'}
            </button>
        </div>
    `;
    }).join('');

    container.querySelectorAll('.task-item-entry').forEach(item => {
        item.addEventListener('click', function(e) {
            if (e.target.classList.contains('task-complete-toggle') || e.target.closest('.task-complete-toggle')) {
                e.stopPropagation();
                e.preventDefault();
                const btn = e.target.classList.contains('task-complete-toggle') ? e.target : e.target.closest('.task-complete-toggle');
                const taskId = btn.getAttribute('data-id');
                
                if (typeof handleToggleTask === 'function') {
                    handleToggleTask(taskId);
                } else if (typeof toggleTaskStatus === 'function') {
                    toggleTaskStatus(taskId);
                }
                return;
            }
            
            const taskId = this.getAttribute('data-id');
            const currentDateKey = selectedDate || new Date().toISOString().split('T')[0];
            if (tasks && tasks[currentDateKey]) {
                const task = tasks[currentDateKey].find(t => (t.id == taskId || t._id == taskId));
                if (task && task.description) {
                    alert(`Description: ${task.description}`);
                }
            }
        });
    });
}

/**
 * Update user rank display
 * @param {Object} rankData { rank, percentile, totalUsers }
 */
function updateUserRank(rankData) {
    const rankElement = document.getElementById('userRank');
    if (rankElement && rankData) {
        rankElement.textContent = rankData.rank ? `#${rankData.rank}` : '--';
    }
}

/**
 * Update user info display (name and avatar)
 * @param {Object} userData { name, email, avatar }
 */
function updateUserInfo(userData) {
    if (!userData) return;

    const nameElement = document.getElementById('leaderboardUserName');
    const avatarElement = document.getElementById('leaderboardAvatar');

    if (nameElement) {
        nameElement.textContent = userData.name || 'User';
    }

    if (avatarElement) {
        const initial = (userData.name || userData.email || 'U').charAt(0).toUpperCase();
        avatarElement.textContent = initial;
    }
}

/**
 * Update account modal user info
 * @param {Object} userData { name, email, avatar, fullname }
 */
function updateAccountModal(userData) {
    if (!userData) return;

    const accountName = document.getElementById('accountName');
    const accountEmail = document.getElementById('accountEmail');
    const accountAvatar = document.getElementById('accountAvatar');
    const displayName = userData.name || userData.fullname || 'User';
    const displayEmail = userData.email || '';

    if (accountName) accountName.textContent = displayName;
    if (accountEmail) accountEmail.textContent = displayEmail;
    if (accountAvatar) {
        const avatarChar = (displayName || displayEmail || 'U').charAt(0).toUpperCase();
        accountAvatar.textContent = avatarChar;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Handle task completion toggle from UI
 * @param {Event} event Click event
 * @param {Number} taskId Task ID
 */
async function handleTaskToggle(event, taskId) {
    event.stopPropagation();
    try {
        let currentTask = null;
        for (const dayTasks of Object.values(tasks)) {
            const found = dayTasks.find(t => t.id === taskId);
            if (found) {
                currentTask = found;
                break;
            }
        }

        if (!currentTask) return;

        const updated = await toggleTaskCompletion(taskId, !currentTask.completed);
        if (updated) {
            currentTask.completed = !currentTask.completed;
            updateTaskList();
            refreshStats();
        }
    } catch (error) {
        console.error('Error toggling task:', error);
        showNotification('error', 'Error', 'Failed to update task');
    }
}

async function loadLeaderboardData() {
    try {
        const leaderboardList = document.getElementById('leaderboardList');
        if (!leaderboardList) return;

        const leaderboardData = await fetchLeaderboard(20);
        
        if (!leaderboardData || leaderboardData.length === 0) {
            leaderboardList.innerHTML = '<div class="empty-state">' + (window.i18n ? window.i18n('leaderboard-no-data') : 'No leaderboard data available') + '</div>';
            return;
        }

        leaderboardList.innerHTML = leaderboardData.map((entry, index) => `
            <div class="leaderboard-item" data-rank="${index + 1}">
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-user">
                    <div class="leaderboard-avatar">${(entry.name || 'U').charAt(0).toUpperCase()}</div>
                    <div class="leaderboard-name">${escapeHtml(entry.name || 'Unknown User')}</div>
                </div>
                <div class="leaderboard-score">${entry.totalHours || 0}h</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}
