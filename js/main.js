// 全局变量
let selectedDate = null;
let currentYear = 2026;
let currentMonth = 4; // JS月份从0开始，4代表5月
let tasks = {}; // 存储任务的对象，键为日期字符串

const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    renderCalendar(currentYear, currentMonth);
    setupColorPicker();
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
        time: timeString
    };

    if (!tasks[selectedDate]) tasks[selectedDate] = [];
    tasks[selectedDate].push(newTask);

    // 清空输入框
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    
    updateTaskList();
}

// 5. 更新任务列表展示
function updateTaskList() {
    const container = document.getElementById('daily-task-list');
    container.innerHTML = '';

    const dayTasks = tasks[selectedDate] || [];
    
    dayTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'task-item-entry';
        item.innerHTML = `
            <div class="task-info">
                <span class="dot-indicator" style="background: ${task.color};"></span>
                <div class="text-group">
                    <p class="t-name">${task.title}</p>
                    <p class="t-time">${task.time}</p>
                </div>
            </div>
        `;
        // 实现点击title弹出描述的逻辑 (简单alert演示)
        item.onclick = () => {
            if(task.description) alert(`Description: ${task.description}`);
        };
        container.appendChild(item);
    });
}