document.addEventListener('DOMContentLoaded', () => {
    // Modal elements
    const modal = document.getElementById('task-modal');
    const modalTitle = document.getElementById('modal-title');
    const taskTextInput = document.getElementById('task-text');
    const taskTypeSelect = document.getElementById('task-type');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const saveTaskBtn = document.getElementById('save-task-btn');
    const closeModal = document.querySelector('.close-modal');
    const addTaskBtn = document.querySelector('.add-task-button');
    const themeSelect = document.getElementById('theme-select');
    const calendarView = document.getElementById('calendar-view');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const prevYearBtn = document.getElementById('prev-year-btn');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const nextYearBtn = document.getElementById('next-year-btn');
    const currentMonthYearSpan = document.getElementById('current-month-year');
    const dailyViewModal = document.getElementById('daily-view-modal');
    const dailyViewDate = document.getElementById('daily-view-date');
    const dailyTimeline = document.getElementById('daily-timeline');
    const closeDailyViewBtn = document.getElementById('close-daily-view');
    const taskList = document.getElementById('task-list');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let notificationTimeouts = {}; // Renamed from reminderTimeouts
    let currentFilter = 'all'; // Initial filter state
    let displayDate = new Date(); // Date object to track displayed month/year
    let editingTaskId = null; // Track the ID of the task being edited

    // --- Notification Permission ---
    function requestNotificationPermission() {
        if ('Notification' in window) {
            console.log('Requesting notification permission...');
            Notification.requestPermission().then(permission => {
                console.log(`Notification permission status: ${permission}`);
                if (permission === 'granted') {
                    console.log('Notification permission granted successfully.');
                } else {
                    console.warn('Notification permission was denied.');
                    // Avoid alert here, as it can be annoying if denied intentionally
                }
            }).catch(err => {
                 console.error('Error requesting notification permission:', err);
            });
        } else {
            console.warn('Desktop notifications not supported by this browser.');
        }
    }
    requestNotificationPermission(); // Request permission on load

    // Modal Functions
    function openTaskModal(task = null) {
        if (task) {
            modalTitle.textContent = 'Edit Task';
            taskTextInput.value = task.text;
            taskTypeSelect.value = task.type;
            startTimeInput.value = task.startTime || '';
            endTimeInput.value = task.endTime || '';
            editingTaskId = task.id; // Store the ID of the task being edited
        } else {
            modalTitle.textContent = 'Add New Task';
            taskTextInput.value = '';
            taskTypeSelect.value = 'task';
            startTimeInput.value = '';
            endTimeInput.value = '';
            editingTaskId = null; // Ensure we are not in edit mode
        }
        modal.style.display = 'block';
    }

    function closeTaskModal() {
        modal.style.display = 'none';
        editingTaskId = null; // Reset edit mode on close
    }

    // Event Listeners for Modal
    addTaskBtn.addEventListener('click', () => openTaskModal());
    closeModal.addEventListener('click', closeTaskModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeTaskModal();
    });

    // --- Task Functions ---
    function saveTask() {
        const taskText = taskTextInput.value.trim();
        const itemType = taskTypeSelect.value;
        const startTime = startTimeInput.value || null;
        const endTime = endTimeInput.value || null;

        if (taskText === '') {
            alert('Please enter task text.');
            return;
        }

        if (startTime && endTime && new Date(endTime) < new Date(startTime)) {
            alert('End time cannot be before start time.');
            return;
        }

        // Note: Removed the check that required startTime for reminders,
        // allowing reminders without a specific time (they just won't notify).
        // if (itemType === 'reminder' && !startTime) {
        //     alert('Please select a start time for reminders.');
        //     return;
        // }

        let taskData;

        if (editingTaskId !== null) {
            // --- Editing existing task ---
            taskData = tasks.find(task => task.id === editingTaskId);
            if (taskData) {
                // Clear previous notification before updating details
                clearNotification(taskData.id); // Use renamed function

                // Update task properties
                taskData.text = taskText;
                taskData.type = itemType;
                taskData.startTime = startTime;
                taskData.endTime = endTime;
                // Keep original completed status and addedDate
            }
            editingTaskId = null; // Reset edit mode
        } else {
            // --- Adding new task ---
            taskData = {
                id: Date.now(),
                text: taskText,
                type: itemType,
                startTime: startTime,
                endTime: endTime,
                completed: false,
                addedDate: new Date().toISOString().split('T')[0]
            };
            tasks.push(taskData);
        }
        saveTasks();
        renderTasks(currentFilter);
        renderCalendar(displayDate.getFullYear(), displayDate.getMonth());
        updateProgressDisplay(); // Update progress on save

        // Schedule notification if applicable (works for both task and reminder with startTime)
        if (taskData && taskData.startTime &&
            'Notification' in window && Notification.permission === 'granted') {
            scheduleNotification(taskData); // Use renamed function
        }

        closeTaskModal();
    }

    saveTaskBtn.addEventListener('click', saveTask);

    // Update renderTasks to use edit functionality
    function renderTasks(filter = 'all') {
        taskList.innerHTML = '';

        const todayStr = new Date().toISOString().split('T')[0];

        const filteredTasks = tasks.filter(task => {
            if (filter === 'today') {
                // Task startTime exists and the date part matches today's date
                return task.startTime && task.startTime.startsWith(todayStr);
            }
            if (filter === 'upcoming') {
                // Task startTime exists and is after today (compare date part only)
                return task.startTime && task.startTime.split('T')[0] > todayStr;
            }
            // 'all' or any other filter shows everything (default)
            return true;
        });

        if (filteredTasks.length === 0) {
            taskList.innerHTML = '<li class="no-tasks-message">No tasks found for this filter.</li>';
            return;
        }

        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.dataset.id = task.id;
            li.classList.add('task-item');
            if (task.completed) li.classList.add('completed');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => toggleTaskCompletion(task.id));

            const taskSpan = document.createElement('span');
            taskSpan.textContent = task.text;
            taskSpan.classList.add('task-text');

            const typeSpan = document.createElement('span');
            typeSpan.classList.add('item-type-info');
            let typeText = `Type: ${task.type.charAt(0).toUpperCase() + task.type.slice(1)}`;
            if (task.startTime) {
                const startDate = new Date(task.startTime);
                typeText += ` (Starts: ${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
                if (task.endTime) {
                    const endDate = new Date(task.endTime);
                    if (startDate.toDateString() !== endDate.toDateString()) {
                        typeText += ` on ${startDate.toLocaleDateString()}`;
                        typeText += ` - Ends: ${endDate.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
                    } else {
                        typeText += ` - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
                    }
                }
                typeText += ')';
            }

            typeSpan.textContent = typeText;

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.classList.add('edit-btn');
            editBtn.addEventListener('click', () => openTaskModal(task));

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTask(task.id);
            });

            li.appendChild(checkbox);
            li.appendChild(taskSpan);
            li.appendChild(typeSpan);
            li.appendChild(editBtn);
            li.appendChild(deleteBtn);
            taskList.appendChild(li);
        });
    }

    function deleteTask(id) {
        tasks = tasks.filter(task => task.id !== id);
        clearNotification(id); // Use renamed function
        saveTasks();
        renderTasks(currentFilter);
        renderCalendar(displayDate.getFullYear(), displayDate.getMonth());
        updateProgressDisplay(); // Update progress on delete
    }

    function toggleTaskCompletion(id) {
        tasks = tasks.map(task =>
            task.id === id ? { ...task, completed: !task.completed } : task
        );
        saveTasks();
        renderTasks(currentFilter);
        updateProgressDisplay(); // Update progress on completion toggle
        // No need to update calendar for completion status change
    }

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    // --- Notification Functions ---
    function scheduleNotification(task) { // Renamed function
        // Schedule for both tasks and reminders if they have a start time
        console.log(`Attempting to schedule notification for "${task.text}" (ID: ${task.id}, Type: ${task.type})`);

        // Use startTime for scheduling
        if (!task.startTime) {
             console.log(`-> Skipping schedule: No start time set.`);
             return;
        }
        if (!('Notification' in window)) {
             console.warn(`-> Skipping schedule: Notifications not supported by browser.`);
             return;
        }

        // Explicitly check permission status *now*
        const currentPermission = Notification.permission;
        console.log(`-> Current notification permission state: ${currentPermission}`);
        if (currentPermission !== 'granted') {
            console.warn(`-> Skipping schedule: Notification permission is "${currentPermission}", not "granted".`);
            // Attempting to re-request here is generally ineffective if already denied.
            return;
        }

        // --- Debugging Time Comparison ---
        const reminderString = task.startTime; // Use startTime
        const reminderDateTime = new Date(reminderString); // Parsed date from input
        const now = new Date(); // Current date/time
        const delay = reminderDateTime.getTime() - now.getTime(); // Difference in milliseconds

        console.log(`-> Time Comparison Details for Task ID ${task.id}:`);
        console.log(`   Input String (task.startTime): "${reminderString}"`);
        console.log(`   Parsed Reminder Date Object: ${reminderDateTime.toString()} (Timestamp: ${reminderDateTime.getTime()})`);
        console.log(`   Current Date Object (now):   ${now.toString()} (Timestamp: ${now.getTime()})`);
        console.log(`   Calculated Delay (ms): ${delay}`);
        // --- End Debugging ---
        if (delay > 0) {
            // Clear existing timeout for this task ID if rescheduling
            clearNotification(task.id); // Use renamed function

            const notificationTitle = task.type === 'reminder' ? 'Todo Reminder!' : 'Task Due!';
            const timeoutId = setTimeout(() => {
                new Notification(notificationTitle, {
                    body: task.text,
                    icon: 'icon.png' // Optional: Add an icon file named icon.png
                });
                delete notificationTimeouts[task.id]; // Use renamed object
                // Optionally mark task as notified or remove reminder time
            }, delay);
            notificationTimeouts[task.id] = timeoutId; // Use renamed object
            console.log(`-> Notification successfully scheduled for task "${task.text}" (ID: ${task.id}) at ${reminderDateTime} with timeout ID ${timeoutId}`);
        } else {
             // Time is in the past or now (delay <= 0)
             console.log(`-> Notification time for task "${task.text}" (ID: ${task.id}) is in the past or now (Delay: ${delay}ms). Not scheduling timeout.`);
        }
    } // Correct closing brace for scheduleNotification

    function clearNotification(taskId) { // Renamed function
        if (notificationTimeouts[taskId]) { // Use renamed object
            clearTimeout(notificationTimeouts[taskId]); // Use renamed object
            delete notificationTimeouts[taskId]; // Use renamed object
            console.log(`Cleared notification for task ID ${taskId}`);
        }
    }

    // --- Calendar Rendering ---

    function renderCalendar(year, month) {
        calendarView.innerHTML = ''; // Clear previous calendar
        const today = new Date(); // For highlighting today's actual date

        // Update display span
        const monthNames = ["January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"];
        currentMonthYearSpan.textContent = `${monthNames[month]} ${year}`;


        // --- Calendar Structure for the given month/year ---
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon,...
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Removed duplicate declarations
        // Add day headers (Sun, Mon, ...)
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const dayHeader = document.createElement('div'); // Day headers (Sun-Sat)
            dayHeader.classList.add('calendar-day-header'); // Add class for styling if needed
            dayHeader.textContent = day;
            calendarView.appendChild(dayHeader);
        });


        // Add empty cells for days before the 1st of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('calendar-day', 'empty');
            calendarView.appendChild(emptyCell);
        }

        // Get tasks grouped by date for efficient lookup
        // Group tasks by START date for calendar view
        const tasksByDate = tasks.reduce((acc, task) => {
            // Use startTime if available, otherwise use addedDate for grouping
            const dateToSortBy = task.startTime ? new Date(task.startTime).toISOString().split('T')[0] : task.addedDate;
            if (dateToSortBy) { // Ensure there is a date to group by
                 if (!acc[dateToSortBy]) {
                     acc[dateToSortBy] = [];
                 }
                 acc[dateToSortBy].push(task);
            }
            return acc;
        }, {});

        // Add day cells for the current month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            // Add day number inside a span for better styling control
            const dayNumberSpan = document.createElement('span');
            dayNumberSpan.textContent = day;
            dayCell.appendChild(dayNumberSpan);

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            if (tasksByDate[dateStr]) {
                dayCell.classList.add('has-task');
                const tasksForDay = tasksByDate[dateStr];
                const taskInfoDiv = document.createElement('div');
                taskInfoDiv.classList.add('calendar-task-list');
                tasksForDay.slice(0, 2).forEach(t => { // Show max 2 tasks directly
                    const taskP = document.createElement('p');
                    taskP.textContent = t.text.length > 15 ? t.text.substring(0, 12) + '...' : t.text; // Truncate long text
                    taskP.title = t.text; // Full text on hover
                    if (t.completed) taskP.style.textDecoration = 'line-through';
                    taskInfoDiv.appendChild(taskP);
                });
                if (tasksForDay.length > 2) {
                     const moreP = document.createElement('p');
                     moreP.textContent = `+${tasksForDay.length - 2} more`;
                     moreP.style.fontSize = '0.8em';
                     moreP.style.color = '#555'; // Consider theming this color
                     taskInfoDiv.appendChild(moreP);
                }
                dayCell.appendChild(taskInfoDiv);
                // Keep the title for a full list on hover
                 dayCell.title = tasksForDay.map(t => t.text).join('\n');
            }

            // Highlight today's actual date
            if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                 dayCell.classList.add('today'); // Add class for styling today
            }


            // Add click listener to open daily view only if it's not empty
            if (!dayCell.classList.contains('empty')) {
                 dayCell.style.cursor = 'pointer'; // Indicate clickable
                 dayCell.addEventListener('click', () => openDailyView(year, month, day));
            }
            calendarView.appendChild(dayCell);
        }
    }

    // --- Event Listeners ---
    // Removed redundant listeners for addTaskBtn and taskInput keypress, modal handles saving.

    // Filter button listeners
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            renderTasks(currentFilter);
        });
    });

    // Calendar navigation listeners
    prevMonthBtn.addEventListener('click', () => {
        displayDate.setMonth(displayDate.getMonth() - 1);
        renderCalendar(displayDate.getFullYear(), displayDate.getMonth());
    });

    nextMonthBtn.addEventListener('click', () => {
        displayDate.setMonth(displayDate.getMonth() + 1);
        renderCalendar(displayDate.getFullYear(), displayDate.getMonth());
    });

    prevYearBtn.addEventListener('click', () => {
        displayDate.setFullYear(displayDate.getFullYear() - 1);
        renderCalendar(displayDate.getFullYear(), displayDate.getMonth());
    });

    nextYearBtn.addEventListener('click', () => {
        displayDate.setFullYear(displayDate.getFullYear() + 1);
        renderCalendar(displayDate.getFullYear(), displayDate.getMonth());
    });

    // --- Theme Switcher ---
    function applyTheme(theme) {
        // Define the theme class names used in the CSS
        const themeClasses = ['dark-mode', 'ocean-theme', 'forest-theme'];
        // Remove any existing theme classes
        document.body.classList.remove(...themeClasses);

        // Add the appropriate class based on the selected theme value
        if (theme === 'dark') {
            document.body.classList.add('dark-mode'); // Use 'dark-mode' as defined in CSS
        } else if (theme !== 'light') {
            // For other themes (ocean, forest), append '-theme' as before
            document.body.classList.add(theme + '-theme');
        }

        // Store preference and force UI refresh
        localStorage.setItem('theme', theme);
        // renderCalendar(displayDate.getFullYear(), displayDate.getMonth()); // Removed: Theme change should ideally only require CSS update
        // Update dropdown to match current theme
        themeSelect.value = theme;
    }

    // Initialize theme from storage or default
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Theme change handler
    themeSelect.addEventListener('change', () => {
        applyTheme(themeSelect.value);
    });

    // --- Daily View Functions ---
    function openDailyView(year, month, day) {
        const selectedDate = new Date(year, month, day);
        dailyViewDate.textContent = selectedDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        renderDailyTimeline(selectedDate);
        dailyViewModal.classList.add('visible');
        dailyViewModal.style.display = 'flex'; // Use flex to enable centering
    }

    function closeDailyView() {
        dailyViewModal.classList.remove('visible');
        // Use setTimeout to allow fade-out transition before setting display: none
        setTimeout(() => {
             if (!dailyViewModal.classList.contains('visible')) { // Check if still hidden
                  dailyViewModal.style.display = 'none';
             }
        }, 300); // Match CSS transition duration
    }


    function renderDailyTimeline(date) {
        dailyTimeline.innerHTML = ''; // Clear previous timeline
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        // Filter tasks for the selected day that have a start time
        const tasksForDay = tasks.filter(task => {
            if (!task.startTime) return false;
            const taskStart = new Date(task.startTime);
            // Basic check: task starts before the end of the day AND (ends after start of day OR has no end time)
            const taskEnd = task.endTime ? new Date(task.endTime) : taskStart; // Use start time if no end time
            return taskStart <= dayEnd && taskEnd >= dayStart;
        });

        // Sort tasks by start time
        tasksForDay.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        // Generate 24 hour slots
        for (let hour = 0; hour < 24; hour++) {
            const slot = document.createElement('div');
            slot.classList.add('timeline-slot');

            const timeLabel = document.createElement('span');
            timeLabel.classList.add('timeline-time');
            timeLabel.textContent = `${hour}:00`;
            slot.appendChild(timeLabel);

            dailyTimeline.appendChild(slot);
        }

         // Position tasks on the timeline
         tasksForDay.forEach(task => {
             const taskStart = new Date(task.startTime);
             // Default end time is 1 hour after start if not provided
             const taskEnd = task.endTime ? new Date(task.endTime) : new Date(taskStart.getTime() + 60 * 60 * 1000);

             // Ensure we only consider the portion within the current day
             const effectiveStart = Math.max(taskStart.getTime(), dayStart.getTime());
             const effectiveEnd = Math.min(taskEnd.getTime(), dayEnd.getTime());

             // Skip if the effective range is invalid (e.g., task entirely outside the day after clamping)
             if (effectiveEnd <= effectiveStart) return;

             const startHour = new Date(effectiveStart).getHours();
             const startMinute = new Date(effectiveStart).getMinutes();
             const endHour = new Date(effectiveEnd).getHours();
             const endMinute = new Date(effectiveEnd).getMinutes();

             // Calculate top position (percentage of the day)
             const startMinutesTotal = startHour * 60 + startMinute;
             const topPercent = (startMinutesTotal / (24 * 60)) * 100;

             // Calculate height (percentage of the day)
             const endMinutesTotal = endHour * 60 + endMinute;
             // Ensure duration is at least a minimum value (e.g., 15 minutes) for visibility
             const durationMinutes = Math.max(30, endMinutesTotal - startMinutesTotal); // Keep min duration for visibility
             const heightPercent = (durationMinutes / (24 * 60)) * 100;

             const taskElement = document.createElement('div');
             taskElement.classList.add('timeline-task');
             if (task.type === 'reminder') {
                 taskElement.classList.add('reminder');
             }
             taskElement.textContent = task.text;
             // Improved tooltip showing full date/time range
             const startLocaleString = new Date(task.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
             const endLocaleString = task.endTime ? new Date(task.endTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '(1 hr default)';
             taskElement.title = `${task.text}\n${startLocaleString} - ${endLocaleString}`;
             console.log(`-> Positioning Task ID ${task.id}: Top=${topPercent.toFixed(2)}%, Height=${heightPercent.toFixed(2)}%`); // Debug log
             taskElement.style.top = `${topPercent}%`;
             // Use the calculated height directly; CSS min-height handles the minimum visual size
             taskElement.style.height = `${heightPercent}%`;

             // Append directly to the timeline container for absolute positioning relative to the whole timeline
             dailyTimeline.appendChild(taskElement);
         });
    }

    // --- Daily View Event Listeners ---
    closeDailyViewBtn.addEventListener('click', closeDailyView);
    dailyViewModal.addEventListener('click', (e) => {
        // Close if clicked on the overlay itself, not the content
        if (e.target === dailyViewModal) {
             closeDailyView();
        }
    });

    // --- ESC Key Listener for Modals ---
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Check if Task Modal is open
            if (modal.style.display === 'block') {
                closeTaskModal();
            }
            // Check if Daily View Modal is open
            if (dailyViewModal.classList.contains('visible')) {
                closeDailyView();
            }
        }
    });

    // --- Progress Display Function ---
    function updateProgressDisplay() {
        const todayStr = new Date().toISOString().split('T')[0];
        // Filter tasks that have a start time today
        const todaysTasks = tasks.filter(task => task.startTime && task.startTime.startsWith(todayStr));
        const totalTasksToday = todaysTasks.length;
        const completedTasksToday = todaysTasks.filter(task => task.completed).length;

        if (totalTasksToday === 0) {
            progressText.textContent = "No tasks for today";
            progressBar.style.width = '0%';
        } else {
            const percentage = Math.round((completedTasksToday / totalTasksToday) * 100);
            progressText.textContent = `${completedTasksToday}/${totalTasksToday} completed`;
            progressBar.style.width = `${percentage}%`;
        }
    }

    // --- Initial Load ---
    applyTheme(localStorage.getItem('theme') || 'light');
    renderTasks(currentFilter); // Initial render with default filter
    renderCalendar(displayDate.getFullYear(), displayDate.getMonth()); // Initial render for current month/year
    updateProgressDisplay(); // Initial progress display

    // Schedule notifications for existing tasks on load
    console.log("Scheduling notifications for existing tasks on load...");
    tasks.forEach(scheduleNotification); // Use renamed function
    console.log("Finished scheduling initial notifications.");
});
