document.addEventListener('DOMContentLoaded', () => {
    const taskInput = document.getElementById('task-input');
    const itemTypeSelect = document.getElementById('item-type-select'); // New select element
    // const reminderTimeContainer = document.getElementById('reminder-time-container'); // No longer needed
    // const themeToggle = document.getElementById('theme-checkbox'); // Replaced with select
    const themeSelect = document.getElementById('theme-select'); // Theme select dropdown
    const startTimeInput = document.getElementById('start-time'); // Renamed from reminderTimeInput
    const endTimeInput = document.getElementById('end-time'); // New end time input
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');
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
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let reminderTimeouts = {}; // Store timeout IDs for reminders
    let currentFilter = 'all'; // Initial filter state
    let displayDate = new Date(); // Date object to track displayed month/year

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

    // --- Task Functions ---
    function addTask() {
        const taskText = taskInput.value.trim();
        const itemType = itemTypeSelect.value; // Get selected type ('task' or 'reminder')
        let startTime = null; // Renamed from reminderTime
        let endTime = null;

        if (taskText === '') {
            alert('Please enter item text.');
            return;
        }

        // Always get reminder time, but it's optional unless type is 'reminder'
        startTime = startTimeInput.value || null;
        endTime = endTimeInput.value || null;

        // Validation: End time cannot be before start time if both are set
        if (startTime && endTime && new Date(endTime) < new Date(startTime)) {
            alert('End time cannot be before start time.');
            return;
        }

        // Validation: Reminders still require a start time
        if (itemType === 'reminder' && !startTime) {
             alert('Please select a start date and time when adding a reminder.');
             return;
        }

        // We will check permission more reliably within scheduleReminder

        const newTask = {
            id: Date.now(), // Simple unique ID
            text: taskText,
            type: itemType, // Store the type
            startTime: startTime, // Renamed from reminder
            endTime: endTime, // Add end time
            completed: false,
            addedDate: new Date().toISOString().split('T')[0] // Store YYYY-MM-DD
        };

        tasks.push(newTask);
        saveTasks();
        renderTasks(currentFilter); // Render tasks based on current filter
        renderCalendar(displayDate.getFullYear(), displayDate.getMonth()); // Update calendar for current view

        // Schedule reminder only if it's a reminder, has time, and permission is granted
        // Schedule reminder only if it's a reminder, has START time, and permission is granted
        if (newTask.type === 'reminder' && newTask.startTime && 'Notification' in window && Notification.permission === 'granted') {
             scheduleReminder(newTask); // Pass the whole task object
        }


        taskInput.value = '';
        startTimeInput.value = ''; // Clear start time
        endTimeInput.value = ''; // Clear end time
        itemTypeSelect.value = 'task'; // Reset dropdown to 'Task'
        // Line removed as reminderTimeContainer is no longer used
    }

    function deleteTask(id) {
        tasks = tasks.filter(task => task.id !== id);
        clearReminder(id); // Clear any scheduled reminder for this task
        saveTasks();
        renderTasks(currentFilter);
        renderCalendar(displayDate.getFullYear(), displayDate.getMonth());
    }

    function toggleTaskCompletion(id) {
        tasks = tasks.map(task =>
            task.id === id ? { ...task, completed: !task.completed } : task
        );
        saveTasks();
        renderTasks(currentFilter);
        // No need to update calendar for completion status change, but might affect 'active' filter
    }

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    // --- Reminder Functions ---
    function scheduleReminder(task) {
        // Check prerequisites right before scheduling - ensure it's a reminder type
        console.log(`Attempting to schedule reminder for "${task.text}" (ID: ${task.id}, Type: ${task.type})`);
        if (task.type !== 'reminder') {
             console.log(`-> Skipping schedule: Item type is "${task.type}", not "reminder".`);
             return;
        }
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
            clearReminder(task.id);

            const timeoutId = setTimeout(() => {
                new Notification('Todo Reminder!', {
                    body: task.text,
                    icon: 'icon.png' // Optional: Add an icon file named icon.png
                });
                delete reminderTimeouts[task.id]; // Remove from tracking after firing
                // Optionally mark task as notified or remove reminder time
            }, delay);
            reminderTimeouts[task.id] = timeoutId; // Store the timeout ID
            console.log(`-> Reminder successfully scheduled for task "${task.text}" (ID: ${task.id}) at ${reminderDateTime} with timeout ID ${timeoutId}`);
        } else {
             // Time is in the past or now (delay <= 0)
             console.log(`-> Reminder time for task "${task.text}" (ID: ${task.id}) is in the past or now (Delay: ${delay}ms). Not scheduling timeout.`);
             // Note: We are not triggering immediate past-due notifications here anymore
             // to simplify debugging the core scheduling issue.
        }
    }

    function clearReminder(taskId) {
        if (reminderTimeouts[taskId]) {
            clearTimeout(reminderTimeouts[taskId]);
            delete reminderTimeouts[taskId];
            console.log(`Cleared reminder for task ID ${taskId}`);
        }
    }

    // --- Rendering Functions ---
    function renderTasks(filter = 'all') {
        taskList.innerHTML = ''; // Clear existing list

        const filteredTasks = tasks.filter(task => {
            if (filter === 'tasks') { // Changed from 'active'
                return task.type === 'task';
            } else if (filter === 'reminders') {
                return task.type === 'reminder'; // Check the explicit type
            }
            return true; // 'all' filter shows everything
        });


        if (filteredTasks.length === 0) {
             taskList.innerHTML = '<li class="no-tasks-message">No tasks found for this filter.</li>';
             return;
        }


        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.dataset.id = task.id;
            li.classList.add('task-item'); // Add class for styling
            if (task.completed) {
                li.classList.add('completed');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.classList.add('task-checkbox');
            checkbox.addEventListener('change', () => toggleTaskCompletion(task.id));

            const taskDetailsDiv = document.createElement('div');
            taskDetailsDiv.classList.add('task-details');

            const taskSpan = document.createElement('span');
            taskSpan.textContent = task.text;
            taskSpan.classList.add('task-text');

            taskDetailsDiv.appendChild(taskSpan); // Add text first

            // Display type and reminder time if applicable
            const typeSpan = document.createElement('span');
            typeSpan.classList.add('item-type-info');
            let typeText = `Type: ${task.type.charAt(0).toUpperCase() + task.type.slice(1)}`;
            if (task.startTime) {
                 const startDate = new Date(task.startTime);
                 typeText += ` (Starts: ${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`; // Show time only initially
                 if (task.endTime) {
                      const endDate = new Date(task.endTime);
                      // Check if end date is different from start date
                      if (startDate.toDateString() !== endDate.toDateString()) {
                           typeText += ` on ${startDate.toLocaleDateString()}`; // Add start date if end date is different
                           typeText += ` - Ends: ${endDate.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
                      } else {
                           typeText += ` - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`; // Only show end time if same day
                      }
                 }
                 typeText += ')';
            }
            typeSpan.textContent = typeText;
            taskDetailsDiv.appendChild(typeSpan);


            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.add('delete-btn'); // Add class for styling
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent li click event
                deleteTask(task.id);
            });

            li.appendChild(checkbox);
            li.appendChild(taskDetailsDiv); // Add the div containing text and reminder
            li.appendChild(deleteBtn);
            taskList.appendChild(li);
        });
    }

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
        // Get tasks grouped by date (using reminder date if available, otherwise addedDate)
        // Group tasks by START date for calendar view
        const tasksByDate = tasks.reduce((acc, task) => {
            const dateToSortBy = task.startTime ? new Date(task.startTime).toISOString().split('T')[0] : task.addedDate;
            if (!acc[dateToSortBy]) {
                acc[dateToSortBy] = [];
            }
            acc[dateToSortBy].push(task);
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
                     moreP.style.color = '#555';
                     taskInfoDiv.appendChild(moreP);
                }
                dayCell.appendChild(taskInfoDiv);
                // Keep the title for a full list on hover
                 dayCell.title = tasksForDay.map(t => t.text).join('\n');
            }

            // Highlight today's date
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
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });
    // Listener for item type dropdown change (No longer needed to hide/show time)
    // itemTypeSelect.addEventListener('change', (e) => { ... });

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
        // Remove existing theme classes first
        document.body.classList.remove('dark-mode', 'ocean-theme', 'forest-theme'); // Add future theme classes here

        // Add the selected theme class
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (theme === 'ocean') {
            document.body.classList.add('ocean-theme');
        } else if (theme === 'forest') {
             document.body.classList.add('forest-theme');
        }
        // 'light' theme doesn't need a specific class, it's the default

        // Update the dropdown to reflect the current theme
        themeSelect.value = theme;
    }

    themeSelect.addEventListener('change', () => {
        const newTheme = themeSelect.value;
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
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


    // --- Initial Load --- (This block was duplicated and is now removed)
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
             const taskEnd = task.endTime ? new Date(task.endTime) : new Date(taskStart.getTime() + 60 * 60 * 1000); // Default to 1 hour if no end time

             // Ensure we only consider the portion within the current day
             const effectiveStart = Math.max(taskStart.getTime(), dayStart.getTime());
             const effectiveEnd = Math.min(taskEnd.getTime(), dayEnd.getTime());

             const startHour = new Date(effectiveStart).getHours();
             const startMinute = new Date(effectiveStart).getMinutes();
             const endHour = new Date(effectiveEnd).getHours();
             const endMinute = new Date(effectiveEnd).getMinutes();

             // Calculate top position (percentage of the day)
             const startMinutesTotal = startHour * 60 + startMinute;
             const topPercent = (startMinutesTotal / (24 * 60)) * 100;

             // Calculate height (percentage of the day)
             const endMinutesTotal = endHour * 60 + endMinute;
             const durationMinutes = Math.max(15, endMinutesTotal - startMinutesTotal); // Min duration of 15 mins visually
             const heightPercent = (durationMinutes / (24 * 60)) * 100;

             const taskElement = document.createElement('div');
             taskElement.classList.add('timeline-task');
             if (task.type === 'reminder') {
                 taskElement.classList.add('reminder');
             }
             taskElement.textContent = task.text;
             taskElement.title = `${task.text}\n${new Date(task.startTime).toLocaleTimeString()} - ${task.endTime ? new Date(task.endTime).toLocaleTimeString() : '?'}`; // Tooltip with times
             taskElement.style.top = `${topPercent}%`;
             taskElement.style.height = `${heightPercent}%`;

             // Find the correct slot to append to (optional, could just append to timeline)
             // This helps with potential overlap styling later if needed
             const targetSlot = dailyTimeline.children[startHour];
             if (targetSlot) {
                 targetSlot.appendChild(taskElement);
             } else {
                 dailyTimeline.appendChild(taskElement); // Fallback
             }
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


    // --- Initial Load --- (ApplyTheme moved here)
    const savedTheme = localStorage.getItem('theme') || 'light'; // Default to light
    applyTheme(savedTheme);

    renderTasks(currentFilter); // Initial render with default filter
    renderCalendar(displayDate.getFullYear(), displayDate.getMonth()); // Initial render for current month/year

    // Schedule reminders for existing tasks on load
    console.log("Scheduling reminders for existing tasks on load...");
    tasks.forEach(scheduleReminder);
    console.log("Finished scheduling initial reminders.");
});