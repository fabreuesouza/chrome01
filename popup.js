const STORAGE_KEY = "tasks";

const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const counter = document.getElementById("counter");
const emptyState = document.getElementById("empty-state");
const clearDoneBtn = document.getElementById("clear-done");

let tasks = [];

async function loadTasks() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  tasks = data[STORAGE_KEY] || [];
  render();
}

async function saveTasks() {
  await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
}

function render() {
  list.innerHTML = "";
  const pending = tasks.filter((t) => !t.done).length;
  counter.textContent = String(pending);
  emptyState.style.display = tasks.length === 0 ? "block" : "none";

  for (const task of tasks) {
    const li = document.createElement("li");
    li.className = "task-item" + (task.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.type = "button";
    deleteBtn.textContent = "✕";
    deleteBtn.setAttribute("aria-label", "Excluir tarefa");
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    li.append(checkbox, text, deleteBtn);
    list.appendChild(li);
  }
}

function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  tasks.unshift({ id: crypto.randomUUID(), text: trimmed, done: false });
  saveTasks();
  render();
}

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (task) task.done = !task.done;
  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  render();
}

function clearDone() {
  tasks = tasks.filter((t) => !t.done);
  saveTasks();
  render();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTask(input.value);
  input.value = "";
  input.focus();
});

clearDoneBtn.addEventListener("click", clearDone);

loadTasks();
