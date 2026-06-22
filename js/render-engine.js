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
        return `
        <div class="task-item-entry" data-id="${task.id}">
            <div class="task-info">
                <span class="dot-indicator" style="background: ${task.color || '#007AFF'};"></span>
                <div class="text-group">
                    <p class="t-name">${escapeHtml(task.title)}</p>
                    <p class="t-time">${escapeHtml(timeText)}</p>
                </div>
            </div>
        </div>
    `;
    }).join('');

    container.querySelectorAll('.task-item-entry').forEach(item => {
        item.addEventListener('click', function(e) {
            if (e.target.classList.contains('task-complete-toggle')) return;
            const taskId = this.getAttribute('data-id');
            if (tasks[selectedDate]) {
                const task = tasks[selectedDate].find(t => t.id == taskId);
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
