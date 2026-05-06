// 1) Create a Supabase project.
// 2) Run the SQL from README_SETUP.txt in Supabase SQL Editor.
// 3) Paste your Supabase project URL + anon key below.
const SUPABASE_URL = "https://hgntgevsdqvqkaqbxibj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dsZFK4kiITST3VS00kqTsw_YwVnZaI0";

const STATUS = {
  TODO: "todo",
  IN_PROGRESS: "in-progress",
  IN_REVIEW: "in-review",
  BLOCKED: "blocked",
  DONE: "done"
};

function createTaskId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const demoTasks = [
  {
    id: createTaskId(),
    title: "Design onboarding workflow",
    assignee: "Aarav Singh",
    targetDate: "2026-05-05",
    latestUpdate: "Wireframes approved by product team.",
    priority: "high",
    storyPoints: 8,
    hoursLogged: 10,
    type: "feature",
    status: STATUS.TODO
  },
  {
    id: createTaskId(),
    title: "Fix login token refresh bug",
    assignee: "Mia Patel",
    targetDate: "2026-05-02",
    latestUpdate: "Reproduced issue in staging.",
    priority: "high",
    storyPoints: 5,
    hoursLogged: 6.5,
    type: "bug",
    status: STATUS.IN_PROGRESS
  },
  {
    id: createTaskId(),
    title: "QA test payment retries",
    assignee: "Noah Shah",
    targetDate: "2026-05-04",
    latestUpdate: "Pending final regression pass.",
    priority: "medium",
    storyPoints: 3,
    hoursLogged: 4,
    type: "task",
    status: STATUS.IN_REVIEW
  },
  {
    id: createTaskId(),
    title: "Deploy analytics dashboard",
    assignee: "Aarav Singh",
    targetDate: "2026-04-28",
    latestUpdate: "Live on production.",
    priority: "low",
    storyPoints: 2,
    hoursLogged: 7,
    type: "feature",
    status: STATUS.DONE
  }
];

const state = {
  tasks: [],
  filters: {
    assignee: "all",
    priority: "all",
    type: "all"
  },
  draggingTaskId: null
};

let supabase = null;
let realtimeChannel = null;

const dom = {
  authShell: document.getElementById("authShell"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  authError: document.getElementById("authError"),
  boardColumns: {
    [STATUS.TODO]: document.getElementById("todoColumn"),
    [STATUS.IN_PROGRESS]: document.getElementById("in-progressColumn"),
    [STATUS.IN_REVIEW]: document.getElementById("in-reviewColumn"),
    [STATUS.BLOCKED]: document.getElementById("blockedColumn"),
    [STATUS.DONE]: document.getElementById("doneColumn")
  },
  counts: {
    [STATUS.TODO]: document.getElementById("count-todo"),
    [STATUS.IN_PROGRESS]: document.getElementById("count-in-progress"),
    [STATUS.IN_REVIEW]: document.getElementById("count-in-review"),
    [STATUS.BLOCKED]: document.getElementById("count-blocked"),
    [STATUS.DONE]: document.getElementById("count-done")
  },
  totalIssues: document.getElementById("totalIssues"),
  openIssues: document.getElementById("openIssues"),
  storyPoints: document.getElementById("storyPoints"),
  hoursLogged: document.getElementById("hoursLogged"),
  assigneeFilter: document.getElementById("assigneeFilter"),
  priorityFilter: document.getElementById("priorityFilter"),
  typeFilter: document.getElementById("typeFilter"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  openCreateTaskBtn: document.getElementById("openCreateTaskBtn"),
  taskDialog: document.getElementById("taskDialog"),
  taskDialogTitle: document.getElementById("taskDialogTitle"),
  closeDialogBtn: document.getElementById("closeDialogBtn"),
  cancelTaskBtn: document.getElementById("cancelTaskBtn"),
  taskForm: document.getElementById("taskForm"),
  taskId: document.getElementById("taskId"),
  titleInput: document.getElementById("titleInput"),
  assigneeInput: document.getElementById("assigneeInput"),
  dateInput: document.getElementById("dateInput"),
  updateInput: document.getElementById("updateInput"),
  priorityInput: document.getElementById("priorityInput"),
  storyPointsInput: document.getElementById("storyPointsInput"),
  hoursLoggedInput: document.getElementById("hoursLoggedInput"),
  typeInput: document.getElementById("typeInput"),
  statusInput: document.getElementById("statusInput")
};

initialize();

async function initialize() {
  supabase = createSupabaseClient();
  wireEvents();
  if (!supabase) return;
  await bootstrapAuth();
}

function createSupabaseClient() {
  if (
    !window.supabase ||
    SUPABASE_URL.includes("PASTE_YOUR") ||
    SUPABASE_ANON_KEY.includes("PASTE_YOUR")
  ) {
    alert("Set SUPABASE_URL and SUPABASE_ANON_KEY in script.js first.");
    return null;
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function loadTasksFromSupabase() {
  if (!supabase) return;

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load tasks error:", error);
    // If it's a 403 Forbidden, user is not authenticated
    if (error.code === "403") {
      console.warn("Not authenticated. Please login.");
      return;
    }
    state.tasks = [];
    render();
    return;
  }

  if (!data || data.length === 0) {
    await seedDemoData();
    return;
  }

  state.tasks = data.map(mapDbTaskToUiTask);
  render();
}

async function seedDemoData() {
  if (!supabase) return;

  const rows = demoTasks.map((task) => ({
    id: task.id,
    title: task.title,
    assignee: task.assignee,
    target_date: task.targetDate,
    latest_update: task.latestUpdate,
    priority: task.priority,
    story_points: task.storyPoints,
    hours_logged: task.hoursLogged || 0,
    type: task.type,
    status: task.status
  }));

  const { error } = await supabase.from("tasks").insert(rows);
  if (error) {
    console.error("Seed demo data error:", error);
    return;
  }

  await loadTasksFromSupabase();
}

function setupRealtimeSubscription() {
  if (!supabase) return;
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabase
    .channel("shared-board-tasks")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, async () => {
      await loadTasksFromSupabase();
    })
    .subscribe();
}

function wireEvents() {
  dom.loginForm.addEventListener("submit", onLoginSubmit);
  dom.logoutBtn.addEventListener("click", onLogoutClick);
  dom.openCreateTaskBtn.addEventListener("click", () => openCreateDialog());
  dom.exportCsvBtn.addEventListener("click", () => exportAsCsv());
  dom.exportJsonBtn.addEventListener("click", () => exportAsJson());
  dom.closeDialogBtn.addEventListener("click", closeDialog);
  dom.cancelTaskBtn.addEventListener("click", closeDialog);

  dom.taskForm.addEventListener("submit", onTaskFormSubmit);

  dom.assigneeFilter.addEventListener("change", (event) => {
    state.filters.assignee = event.target.value;
    renderBoard();
  });
  dom.priorityFilter.addEventListener("change", (event) => {
    state.filters.priority = event.target.value;
    renderBoard();
  });
  dom.typeFilter.addEventListener("change", (event) => {
    state.filters.type = event.target.value;
    renderBoard();
  });

  dom.clearFiltersBtn.addEventListener("click", () => {
    state.filters = { assignee: "all", priority: "all", type: "all" };
    dom.assigneeFilter.value = "all";
    dom.priorityFilter.value = "all";
    dom.typeFilter.value = "all";
    renderBoard();
  });

  Object.entries(dom.boardColumns).forEach(([status, column]) => {
    column.dataset.status = status;
    column.addEventListener("dragover", onColumnDragOver);
    column.addEventListener("dragleave", onColumnDragLeave);
    column.addEventListener("drop", onColumnDrop);
  });
}

async function bootstrapAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Auth error:", error);
    showAuthMessage("Could not verify login session.");
    setAppVisibility(false);
    return;
  }

  if (data?.session) {
    await handleSignedInState();
  } else {
    setAppVisibility(false);
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session) {
      await handleSignedInState();
      return;
    }

    if (event === "SIGNED_OUT") {
      state.tasks = [];
      render();
      setAppVisibility(false);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    }
  });
}

async function onLoginSubmit(event) {
  event.preventDefault();
  showAuthMessage("");

  const username = dom.usernameInput.value.trim();
  const password = dom.passwordInput.value;

  if (!username || !password) {
    showAuthMessage("Username and password are required.");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: username,
    password
  });

  if (error) {
    console.error("Login error:", error);
    showAuthMessage("Invalid credentials. Please retry.");
    return;
  }

  dom.passwordInput.value = "";
}

async function onLogoutClick() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Logout error:", error);
    alert("Failed to logout.");
  }
}

async function handleSignedInState() {
  setAppVisibility(true);
  showAuthMessage("");
  await loadTasksFromSupabase();
  setupRealtimeSubscription();
}

function setAppVisibility(isLoggedIn) {
  dom.authShell.classList.toggle("hidden", isLoggedIn);
  dom.appShell.classList.toggle("hidden", !isLoggedIn);
}

function showAuthMessage(message) {
  dom.authError.textContent = message;
}

async function onTaskFormSubmit(event) {
  event.preventDefault();

  const taskData = {
    id: dom.taskId.value || createTaskId(),
    title: dom.titleInput.value.trim(),
    assignee: dom.assigneeInput.value.trim(),
    targetDate: dom.dateInput.value,
    latestUpdate: dom.updateInput.value.trim(),
    priority: dom.priorityInput.value,
    storyPoints: Number(dom.storyPointsInput.value) || 0,
    hoursLogged: Number(dom.hoursLoggedInput.value) || 0,
    type: dom.typeInput.value,
    status: dom.statusInput.value
  };

  if (!taskData.title || !taskData.assignee || !taskData.latestUpdate || !taskData.targetDate) {
    return;
  }

  const existingTask = state.tasks.find((task) => task.id === taskData.id);

  if (existingTask) {
    const { error } = await supabase
      .from("tasks")
      .update({
        title: taskData.title,
        assignee: taskData.assignee,
        target_date: taskData.targetDate,
        latest_update: taskData.latestUpdate,
        priority: taskData.priority,
        story_points: taskData.storyPoints,
        hours_logged: taskData.hoursLogged,
        type: taskData.type,
        status: taskData.status
      })
      .eq("id", taskData.id);

    if (error) {
      console.error("Update task error:", error);
      alert("Failed to update task.");
      return;
    }
  } else {
    const { error } = await supabase.from("tasks").insert({
      id: taskData.id,
      title: taskData.title,
      assignee: taskData.assignee,
      target_date: taskData.targetDate,
      latest_update: taskData.latestUpdate,
      priority: taskData.priority,
      story_points: taskData.storyPoints,
      hours_logged: taskData.hoursLogged,
      type: taskData.type,
      status: taskData.status
    });

    if (error) {
      console.error("Create task error:", error);
      alert("Failed to create task.");
      return;
    }
  }

  closeDialog();
}

function openCreateDialog() {
  dom.taskDialogTitle.textContent = "Create Task";
  dom.taskForm.reset();
  dom.taskId.value = "";
  dom.storyPointsInput.value = 0;
  dom.hoursLoggedInput.value = 0;
  dom.statusInput.value = STATUS.TODO;
  showTaskDialog();
}

function openEditDialog(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  dom.taskDialogTitle.textContent = "Edit Task";
  dom.taskId.value = task.id;
  dom.titleInput.value = task.title;
  dom.assigneeInput.value = task.assignee;
  dom.dateInput.value = task.targetDate;
  dom.updateInput.value = task.latestUpdate;
  dom.priorityInput.value = task.priority;
  dom.storyPointsInput.value = task.storyPoints ?? 0;
  dom.hoursLoggedInput.value = task.hoursLogged ?? 0;
  dom.typeInput.value = task.type || "task";
  dom.statusInput.value = task.status;
  showTaskDialog();
}

function closeDialog() {
  hideTaskDialog();
}

async function deleteTask(taskId) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) {
    console.error("Delete task error:", error);
    alert("Failed to delete task.");
  }
}

function onColumnDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add("drag-over");
}

function onColumnDragLeave(event) {
  event.currentTarget.classList.remove("drag-over");
}

async function onColumnDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");
  const dropStatus = event.currentTarget.dataset.status;
  if (!dropStatus || !state.draggingTaskId) return;

  const task = state.tasks.find((item) => item.id === state.draggingTaskId);
  if (!task || task.status === dropStatus) return;

  const { error } = await supabase
    .from("tasks")
    .update({
      status: dropStatus,
      latest_update: `Moved to ${statusLabel(dropStatus)} on ${new Date().toLocaleDateString()}`
    })
    .eq("id", state.draggingTaskId);

  if (error) {
    console.error("Drop task error:", error);
    alert("Failed to move task.");
    return;
  }

  state.draggingTaskId = null;
}

function statusLabel(status) {
  switch (status) {
    case STATUS.TODO: return "TO DO";
    case STATUS.IN_PROGRESS: return "IN PROGRESS";
    case STATUS.IN_REVIEW: return "IN REVIEW";
    case STATUS.BLOCKED: return "BLOCKED";
    case STATUS.DONE: return "DONE";
    default: return status;
  }
}

function render() {
  renderFilterOptions();
  renderBoard();
  renderSummary();
}

function renderFilterOptions() {
  const selected = dom.assigneeFilter.value || "all";
  const assignees = [...new Set(state.tasks.map((task) => task.assignee))].sort();

  dom.assigneeFilter.innerHTML = `<option value="all">All</option>${
    assignees.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")
  }`;
  dom.assigneeFilter.value = assignees.includes(selected) ? selected : "all";
  state.filters.assignee = dom.assigneeFilter.value;
}

function passesFilters(task) {
  const byAssignee = state.filters.assignee === "all" || task.assignee === state.filters.assignee;
  const byPriority = state.filters.priority === "all" || task.priority === state.filters.priority;
  const byType = state.filters.type === "all" || task.type === state.filters.type;
  return byAssignee && byPriority && byType;
}

function renderBoard() {
  Object.values(dom.boardColumns).forEach((column) => {
    column.innerHTML = "";
  });

  const filteredTasks = getFilteredTasks();

  Object.keys(dom.boardColumns).forEach((status) => {
    const tasksForStatus = filteredTasks.filter((task) => task.status === status);
    dom.counts[status].textContent = String(tasksForStatus.length);

    if (tasksForStatus.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "No tasks";
      dom.boardColumns[status].appendChild(empty);
      return;
    }

    tasksForStatus.forEach((task) => dom.boardColumns[status].appendChild(createTaskCard(task)));
  });
}

function getFilteredTasks() {
  return state.tasks.filter(passesFilters);
}

function renderSummary() {
  const total = state.tasks.length;
  const open = state.tasks.filter((task) => task.status !== STATUS.DONE).length;
  const storyPoints = state.tasks.reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);
  const hoursLogged = state.tasks.reduce((sum, task) => sum + (Number(task.hoursLogged) || 0), 0);

  dom.totalIssues.textContent = String(total);
  dom.openIssues.textContent = String(open);
  dom.storyPoints.textContent = String(storyPoints);
  dom.hoursLogged.textContent = `${formatHours(hoursLogged)}h`;
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";
  card.draggable = true;
  card.dataset.taskId = task.id;

  card.addEventListener("dragstart", () => {
    state.draggingTaskId = task.id;
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });

  const initials = task.assignee
    .split(" ")
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .slice(0, 2)
    .join("");

  card.innerHTML = `
    <div class="task-head">
      <h4 class="task-title">${escapeHtml(task.title)}</h4>
      <div class="task-actions">
        <button class="mini-btn edit">Edit</button>
        <button class="mini-btn delete">Delete</button>
      </div>
    </div>
    <div class="task-meta">
      <div class="assignee">
        <span class="avatar">${escapeHtml(initials)}</span>
        <span>${escapeHtml(task.assignee)}</span>
      </div>
      <div>Target: <strong>${formatDate(task.targetDate)}</strong></div>
      <div>Update: ${escapeHtml(task.latestUpdate)}</div>
      <div>
        <span class="badge ${escapeHtml(task.priority)}">${escapeHtml(capitalize(task.priority))}</span>
        <span class="chip">${escapeHtml(task.type.toUpperCase())}</span>
        <span class="chip">SP: ${Number(task.storyPoints) || 0}</span>
        <span class="chip">Hrs: ${formatHours(task.hoursLogged || 0)}</span>
      </div>
    </div>
  `;

  card.querySelector(".edit").addEventListener("click", () => openEditDialog(task.id));
  card.querySelector(".delete").addEventListener("click", () => deleteTask(task.id));

  return card;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(dateValue) {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return parsed.toLocaleDateString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function exportAsJson() {
  const filteredTasks = getFilteredTasks();
  const payload = {
    exportedAt: new Date().toISOString(),
    summary: {
      totalIssues: state.tasks.length,
      openIssues: state.tasks.filter((task) => task.status !== STATUS.DONE).length,
      storyPoints: state.tasks.reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0),
      hoursLogged: `${formatHours(state.tasks.reduce((sum, task) => sum + (Number(task.hoursLogged) || 0), 0))}h`
    },
    activeFilters: { ...state.filters },
    exportedTaskCount: filteredTasks.length,
    tasks: filteredTasks
  };

  const fileName = `task-board-export-${new Date().toISOString().slice(0, 10)}.json`;
  downloadFile(fileName, JSON.stringify(payload, null, 2), "application/json");
}

function exportAsCsv() {
  const filteredTasks = getFilteredTasks();
  const header = [
    "Title",
    "Assignee",
    "Target Date",
    "Latest Update",
    "Priority",
    "Story Points",
    "Hours Logged",
    "Type",
    "Status"
  ];

  const rows = filteredTasks.map((task) => [
    task.title,
    task.assignee,
    task.targetDate,
    task.latestUpdate,
    task.priority,
    String(task.storyPoints ?? 0),
    String(task.hoursLogged ?? 0),
    task.type,
    statusLabel(task.status)
  ]);

  const csv = [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const fileName = `task-board-export-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(fileName, csv, "text/csv;charset=utf-8;");
}

function escapeCsvCell(value) {
  const cell = String(value ?? "");
  const escaped = cell.replaceAll('"', '""');
  return `"${escaped}"`;
}

function downloadFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function mapDbTaskToUiTask(row) {
  return {
    id: row.id,
    title: row.title,
    assignee: row.assignee,
    targetDate: row.target_date,
    latestUpdate: row.latest_update,
    priority: row.priority,
    storyPoints: row.story_points || 0,
    hoursLogged: row.hours_logged || 0,
    type: row.type || "task",
    status: row.status
  };
}

function formatHours(value) {
  const num = Number(value) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function showTaskDialog() {
  if (!dom.taskDialog) return;
  if (typeof dom.taskDialog.showModal === "function") {
    try {
      dom.taskDialog.showModal();
      return;
    } catch (error) {
      console.warn("showModal failed, using fallback open attribute.", error);
    }
  }
  dom.taskDialog.setAttribute("open", "true");
}

function hideTaskDialog() {
  if (!dom.taskDialog) return;
  if (typeof dom.taskDialog.close === "function") {
    try {
      dom.taskDialog.close();
      return;
    } catch (error) {
      console.warn("dialog.close failed, using fallback remove open.", error);
    }
  }
  dom.taskDialog.removeAttribute("open");
}
