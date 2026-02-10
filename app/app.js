import {
  getAllTodos,
  getTodosByDate,
  addTodo,
  updateTodo,
  getSummariesByDate,
  addSummary,
  updateSummary,
  deleteSummary,
  getMeta,
  setMeta,
  getAllRecurrenceRules,
  addRecurrenceRule,
  deleteRecurrenceRule,
  getTodosByRuleId
} from './db.js';
import * as bgm from './bgm.js';
import { initSync, syncNow, getUserId } from './sync.js';

const input = document.getElementById('todo-input');
const dueInput = document.getElementById('todo-due');
const addBtn = document.getElementById('add-btn');
const list = document.getElementById('todo-list');
const status = document.getElementById('status');

const summaryInput = document.getElementById('summary-input');
const summaryStatus = document.getElementById('summary-status');
const summaryRating = document.getElementById('summary-rating');

const datePrevBtn = document.getElementById('date-prev');
const dateNextBtn = document.getElementById('date-next');
const dateResetBtn = document.getElementById('date-reset');
const datePicker = document.getElementById('date-picker');
const dateWeekday = document.getElementById('date-weekday');
const syncBtn = document.getElementById('sync-btn');
const syncStatus = document.getElementById('sync-status');

const recurrenceOpenBtn = document.getElementById('recurrence-open');
const recurrenceModal = document.getElementById('recurrence-modal');
const recurrenceCloseBtn = document.getElementById('recurrence-close');
const recurrenceList = document.getElementById('recurrence-list');
const recurrenceText = document.getElementById('recurrence-text');
const recurrenceType = document.getElementById('recurrence-type');
const recurrenceCustom = document.getElementById('recurrence-custom');
const recurrenceWeekly = document.getElementById('recurrence-weekly');
const recurrenceMonthly = document.getElementById('recurrence-monthly');
const recurrenceDay = document.getElementById('recurrence-day');
const recurrenceYearly = document.getElementById('recurrence-yearly');
const recurrenceMonth = document.getElementById('recurrence-month');
const recurrenceYearDay = document.getElementById('recurrence-year-day');
const recurrenceInterval = document.getElementById('recurrence-interval');
const recurrenceUnit = document.getElementById('recurrence-unit');
const recurrenceAddBtn = document.getElementById('recurrence-add');
const themeToggleBtn = document.getElementById('theme-toggle');

const timerRemainingEl = document.getElementById('timer-remaining');
const timerRingEl = document.getElementById('timer-ring');
const timerMinutesInput = document.getElementById('timer-minutes');
const timerStatusEl = document.getElementById('timer-status');
const timerToggleBtn = document.getElementById('timer-toggle');
const timerStopBtn = document.getElementById('timer-stop');
const bgmFileInput = document.getElementById('bgm-file');
const bgmToggleBtn = document.getElementById('bgm-toggle');
const bgmModal = document.getElementById('bgm-modal');
const bgmCloseBtn = document.getElementById('bgm-close');
const bgmCurrentName = document.getElementById('bgm-current-name');
const bgmVolume = document.getElementById('bgm-volume');

let todos = [];
let summaries = [];
let selectedDate = formatDateLocal(new Date());
let migrationDone = false;
let recurrenceRules = [];

// -------- Date helpers --------
function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function setSelectedDate(dateStr) {
  const previousDate = selectedDate;
  selectedDate = dateStr;
  if (datePicker) datePicker.value = dateStr;
  if (dateWeekday) {
    const date = parseDateLocal(dateStr);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    dateWeekday.textContent = weekdays[date.getDay()];
  }
  ensureRecurrenceForDate(dateStr);
  if (previousDate) {
    const today = formatDateLocal(new Date());
    const yesterday = formatDateLocal(new Date(Date.now() - 86400000));
    if (previousDate === yesterday && dateStr === today) {
      carryOverIncomplete(previousDate, dateStr).then(loadForDate);
      return;
    }
    loadForDate();
  } else {
    loadForDate();
  }
}

function generateUUID() {
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ensureUserId() {
  if (currentUserId) return currentUserId;
  const fromSync = getUserId();
  if (fromSync) {
    currentUserId = fromSync;
    return currentUserId;
  }
  currentUserId = generateUUID();
  return currentUserId;
}

// -------- Todo logic --------
async function migrateMissingTodoDates() {
  if (migrationDone) return;
  migrationDone = true;
  const all = await getAllTodos();
  const now = new Date().toISOString();
  const today = formatDateLocal(new Date());
  await Promise.all(
    all
      .filter(todo => !todo.date)
      .map(todo =>
        updateTodo({
          ...todo,
          date: today,
          updatedAt: todo.updatedAt || todo.createdAt || now
        })
      )
  );
}

async function loadTodos() {
  await migrateMissingTodoDates();
  todos = await getTodosByDate(selectedDate);
  renderTodos();
}

async function carryOverIncomplete(fromDate, toDate) {
  const fromTodos = await getTodosByDate(fromDate);
  const toTodos = await getTodosByDate(toDate);
  const carried = new Set(
    toTodos
      .filter(todo => todo.carriedFrom)
      .map(todo => todo.carriedFrom)
  );
  const now = new Date().toISOString();

  for (const todo of fromTodos) {
    if (todo.deletedAt) continue;
    if (todo.completed) continue;
    if (!todo.uuid) {
      todo.uuid = generateUUID();
      await updateTodo({ ...todo, updatedAt: now });
    }
    if (carried.has(todo.uuid)) continue;
    const userId = currentUserId ||
      (syncInitPromise ? (await syncInitPromise).userId : ensureUserId());
    await addTodo({
      date: toDate,
      text: todo.text,
      completed: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      dueMinutes: todo.dueMinutes ?? null,
      recurrenceRuleId: null,
      carriedFrom: todo.uuid,
      uuid: generateUUID(),
      userId
    });
  }
}

function renderTodos() {
  list.innerHTML = '';
  const visibleTodos = todos
    .filter(todo => !todo.deletedAt)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aTime = Date.parse(a.updatedAt || a.createdAt || 0);
      const bTime = Date.parse(b.updatedAt || b.createdAt || 0);
      return bTime - aTime;
    });

  visibleTodos.forEach(todo => {
    const li = document.createElement('li');
    li.className = todo.completed ? 'completed' : '';
    li.dataset.id = String(todo.id);

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;
    text.ondblclick = event => {
      event.stopPropagation();
      beginTodoEdit(todo, li, text);
    };

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.type = 'button';
    del.textContent = '删除';
    del.onclick = async event => {
      event.stopPropagation();
      const now = new Date().toISOString();
      await updateTodo({
        ...todo,
        deletedAt: now,
        updatedAt: now
      });
      loadTodos();
    };

    li.appendChild(text);
    if (Number.isFinite(todo.dueMinutes)) {
      const due = document.createElement('span');
      due.className = 'todo-due';
      due.textContent = `预计 ${todo.dueMinutes} min`;
      li.appendChild(due);
    }
    li.appendChild(del);
    li.onclick = async event => {
      if (event.detail > 1) return;
      if (li.classList.contains('editing')) return;
      await updateTodo({
        ...todo,
        completed: !todo.completed,
        updatedAt: new Date().toISOString()
      });
      loadTodos();
    };
    list.appendChild(li);
  });
}

function beginTodoEdit(todo, li, textNode) {
  if (li.classList.contains('editing')) return;
  li.classList.add('editing');
  const inputEdit = document.createElement('input');
  inputEdit.className = 'edit-input';
  inputEdit.type = 'text';
  inputEdit.value = todo.text;
  li.replaceChild(inputEdit, textNode);
  inputEdit.focus();
  inputEdit.setSelectionRange(inputEdit.value.length, inputEdit.value.length);

  const finish = async save => {
    if (!li.classList.contains('editing')) return;
    li.classList.remove('editing');
    const nextText = inputEdit.value.trim();
    if (save && !nextText) {
      setStatus('内容不能为空');
      loadTodos();
      return;
    }
    if (save && nextText !== todo.text) {
      await updateTodo({
        ...todo,
        text: nextText,
        updatedAt: new Date().toISOString()
      });
    }
    loadTodos();
  };

  inputEdit.onkeydown = event => {
    if (event.key === 'Enter') finish(true);
    if (event.key === 'Escape') finish(false);
  };
  inputEdit.onblur = () => finish(true);
  inputEdit.onclick = event => event.stopPropagation();
}

function setStatus(message) {
  if (!status) return;
  status.textContent = message;
  if (message) {
    setTimeout(() => {
      if (status.textContent === message) status.textContent = '';
    }, 1500);
  }
}

addBtn.onclick = async () => {
  const text = input.value.trim();
  if (!text) {
    setStatus('请输入待办事项');
    return;
  }
  let dueMinutes = null;
  if (dueInput && dueInput.value.trim()) {
    const parsed = Number(dueInput.value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setStatus('预计时长需为非负数字');
      return;
    }
    dueMinutes = Math.floor(parsed);
  }
  const now = new Date().toISOString();
  const initResult = syncInitPromise ? await syncInitPromise : null;
  const userId = currentUserId ||
    (initResult && initResult.userId ? initResult.userId : ensureUserId());
  await addTodo({
    date: selectedDate,
    text,
    completed: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dueMinutes,
    uuid: generateUUID(),
    userId
  });
  input.value = '';
  if (dueInput) dueInput.value = '';
  setStatus('');
  loadTodos();
};

input.addEventListener('keydown', event => {
  if (event.key === 'Enter') addBtn.click();
});

if (dueInput) {
  dueInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') addBtn.click();
  });
}

// -------- Summary logic --------
async function loadSummaries() {
  summaries = await getSummariesByDate(selectedDate);
  const latest = summaries
    .filter(summary => !summary.deletedAt)
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || 0);
      const bTime = Date.parse(b.updatedAt || b.createdAt || 0);
      return bTime - aTime;
    })[0];
  summaryInput.value = latest ? latest.text : '';
  summaryRatingValue = latest && typeof latest.rating === 'number' ? latest.rating : 0;
  renderSummaryRating();
  autoResizeSummary();
}

// -------- Recurrence rules --------
async function loadRecurrenceRules() {
  recurrenceRules = await getAllRecurrenceRules();
  renderRecurrenceRules();
}

function renderRecurrenceRules() {
  if (!recurrenceList) return;
  recurrenceList.innerHTML = '';
  const ordered = [...recurrenceRules].sort((a, b) => a.id - b.id);
  ordered.forEach(rule => {
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.className = 'recurrence-text';
    text.textContent = `${rule.text} · ${formatRecurrence(rule)}`;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.type = 'button';
    del.textContent = '删除';
    del.onclick = async event => {
      event.stopPropagation();
      await deleteRecurrenceRule(rule.id);
      const today = getTodayDateStr();
      const related = await getTodosByRuleId(rule.id);
      const future = related.filter(todo => todo.date > today && !todo.deletedAt);
      await Promise.all(
        future.map(todo =>
          updateTodo({
            ...todo,
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        )
      );
      loadRecurrenceRules();
    };

    li.appendChild(text);
    li.appendChild(del);
    recurrenceList.appendChild(li);
  });
}

function formatRecurrence(rule) {
  if (rule.type === 'daily') return '每天重复';
  if (rule.type === 'weekly') {
    const map = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const days = (rule.weekdays || []).map(d => map[d]).join('、');
    return `每周重复（${days || '未选'}）`;
  }
  if (rule.type === 'monthly') {
    return `每月重复（${rule.day || '-'}号）`;
  }
  if (rule.type === 'yearly') {
    const month = rule.month ? `${rule.month}月` : '-月';
    const day = rule.day ? `${rule.day}号` : '-号';
    return `每年重复（${month}${day}）`;
  }
  if (rule.type === 'workday') return '每个工作日重复';
  if (rule.type === 'custom') {
    const unitMap = { day: '天', week: '周', month: '月', year: '年' };
    return `每 ${rule.interval} ${unitMap[rule.unit] || ''}`;
  }
  return '';
}

function getTodayDateStr() {
  return formatDateLocal(new Date());
}

function isDateOnOrAfter(dateStr, compareStr) {
  return dateStr >= compareStr;
}

function dateMatchesRule(dateStr, rule) {
  const date = parseDateLocal(dateStr);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const weekday = date.getDay();

  if (rule.type === 'daily') return true;
  if (rule.type === 'weekly') {
    return Array.isArray(rule.weekdays) && rule.weekdays.includes(weekday);
  }
  if (rule.type === 'monthly') {
    return Number(rule.day) === day;
  }
  if (rule.type === 'yearly') {
    return Number(rule.month) === month && Number(rule.day) === day;
  }
  if (rule.type === 'workday') {
    return weekday >= 1 && weekday <= 5;
  }
  if (rule.type === 'custom') {
    const start = rule.createdAt ? parseDateLocal(rule.createdAt.slice(0, 10)) : null;
    if (!start || !rule.interval || !rule.unit) return false;
    const interval = Number(rule.interval);
    if (!interval || interval < 1) return false;
    if (rule.unit === 'day') {
      const diffDays = Math.floor((date - start) / 86400000);
      return diffDays >= 0 && diffDays % interval === 0;
    }
    if (rule.unit === 'week') {
      const diffDays = Math.floor((date - start) / 86400000);
      return diffDays >= 0 && diffDays % (interval * 7) === 0;
    }
    if (rule.unit === 'month') {
      const diffMonths = (date.getFullYear() - start.getFullYear()) * 12 +
        (date.getMonth() - start.getMonth());
      return diffMonths >= 0 && diffMonths % interval === 0 && day === start.getDate();
    }
    if (rule.unit === 'year') {
      const diffYears = date.getFullYear() - start.getFullYear();
      return diffYears >= 0 && diffYears % interval === 0 &&
        month === start.getMonth() + 1 && day === start.getDate();
    }
  }
  return false;
}

async function ensureRecurrenceForDate(dateStr) {
  const today = getTodayDateStr();
  if (!isDateOnOrAfter(dateStr, today)) return;
  const rules = await getAllRecurrenceRules();
  if (!rules.length) return;
  const todosForDate = await getTodosByDate(dateStr);
  const existingRuleIds = new Set(
    todosForDate
      .filter(todo => todo.recurrenceRuleId != null)
      .map(todo => todo.recurrenceRuleId)
  );
  const now = new Date().toISOString();
  for (const rule of rules) {
    if (!dateMatchesRule(dateStr, rule)) continue;
    if (existingRuleIds.has(rule.id)) continue;
    const initResult = syncInitPromise ? await syncInitPromise : null;
    const userId = currentUserId ||
      (initResult && initResult.userId ? initResult.userId : ensureUserId());
    await addTodo({
      date: dateStr,
      text: rule.text,
      completed: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      dueMinutes: null,
      recurrenceRuleId: rule.id,
      uuid: generateUUID(),
      userId
    });
  }
}

function toggleRecurrenceCustom() {
  const type = recurrenceType ? recurrenceType.value : '';
  if (recurrenceCustom) {
    recurrenceCustom.classList.toggle('hidden', type !== 'custom');
  }
  if (recurrenceWeekly) {
    recurrenceWeekly.classList.toggle('hidden', type !== 'weekly');
  }
  if (recurrenceMonthly) {
    recurrenceMonthly.classList.toggle('hidden', type !== 'monthly');
  }
  if (recurrenceYearly) {
    recurrenceYearly.classList.toggle('hidden', type !== 'yearly');
  }
}

if (recurrenceType) recurrenceType.addEventListener('change', toggleRecurrenceCustom);

if (recurrenceAddBtn) {
  recurrenceAddBtn.addEventListener('click', async () => {
    const text = recurrenceText.value.trim();
    if (!text) return;
    const now = new Date().toISOString();
    const type = recurrenceType.value;
    let weekdays = null;
    let day = null;
    let month = null;
    if (type === 'weekly' && recurrenceWeekly) {
      const selected = Array.from(
        recurrenceWeekly.querySelectorAll('input[type=\"checkbox\"]:checked')
      ).map(el => Number(el.value));
      if (!selected.length) return;
      weekdays = selected;
    }
    if (type === 'yearly' && recurrenceMonth && recurrenceYearDay) {
      month = Number(recurrenceMonth.value);
      day = Number(recurrenceYearDay.value);
    } else if (type === 'monthly' && recurrenceDay) {
      day = Number(recurrenceDay.value);
    }
    const rule = {
      text,
      type,
      weekdays,
      day,
      month,
      interval: type === 'custom' ? Number(recurrenceInterval.value) : null,
      unit: type === 'custom' ? recurrenceUnit.value : null,
      createdAt: now,
      updatedAt: now
    };
    await addRecurrenceRule(rule);
    recurrenceText.value = '';
    if (recurrenceWeekly) {
      recurrenceWeekly.querySelectorAll('input[type=\"checkbox\"]').forEach(el => {
        el.checked = false;
      });
    }
    loadRecurrenceRules();
  });
}

if (recurrenceOpenBtn) {
  recurrenceOpenBtn.addEventListener('click', () => {
    if (!recurrenceModal) return;
    recurrenceModal.classList.remove('hidden');
    toggleRecurrenceCustom();
    loadRecurrenceRules();
  });
}

if (recurrenceCloseBtn) {
  recurrenceCloseBtn.addEventListener('click', () => {
    if (recurrenceModal) recurrenceModal.classList.add('hidden');
  });
}

if (recurrenceModal) {
  recurrenceModal.addEventListener('click', event => {
    if (event.target === recurrenceModal) recurrenceModal.classList.add('hidden');
  });
}

function setSummaryStatus(message) {
  if (!summaryStatus) return;
  summaryStatus.textContent = message;
  if (message) {
    setTimeout(() => {
      if (summaryStatus.textContent === message) summaryStatus.textContent = '';
    }, 1500);
  }
}

if (recurrenceCustom) toggleRecurrenceCustom();

function renderSummaryRating() {
  if (!summaryRating) return;
  const stars = summaryRating.querySelectorAll('.star');
  stars.forEach(star => {
    const index = Number(star.dataset.star);
    star.classList.remove('half', 'full');
    if (summaryRatingValue >= index) {
      star.classList.add('full');
    } else if (summaryRatingValue >= index - 0.5) {
      star.classList.add('half');
    }
  });
}

if (summaryRating) {
  summaryRating.addEventListener('click', event => {
    const target = event.target.closest('.star');
    if (!target) return;
    const index = Number(target.dataset.star);
    summaryRatingValue = index - 0.5;
    renderSummaryRating();
    scheduleSummarySave();
  });
  summaryRating.addEventListener('dblclick', event => {
    const target = event.target.closest('.star');
    if (!target) return;
    const index = Number(target.dataset.star);
    summaryRatingValue = index;
    renderSummaryRating();
    scheduleSummarySave();
  });
}

function buildRecurrenceDateOptions() {
  if (recurrenceDay) {
    recurrenceDay.innerHTML = '';
    for (let i = 1; i <= 31; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = String(i);
      recurrenceDay.appendChild(option);
    }
  }
  if (recurrenceMonth) {
    recurrenceMonth.innerHTML = '';
    for (let i = 1; i <= 12; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = String(i);
      recurrenceMonth.appendChild(option);
    }
  }
  if (recurrenceYearDay) {
    recurrenceYearDay.innerHTML = '';
    for (let i = 1; i <= 31; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = String(i);
      recurrenceYearDay.appendChild(option);
    }
  }
}

buildRecurrenceDateOptions();

let summarySaveTimer = null;
let themeDark = false;
let summaryRatingValue = 0;
let bgmName = '默认 BGM';
let syncReady = false;
let currentUserId = null;
let syncInitPromise = null;

function applyTheme() {
  document.body.classList.toggle('dark', themeDark);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = themeDark ? '☀' : '☾';
  }
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    themeDark = !themeDark;
    applyTheme();
    setMeta('theme', themeDark ? 'dark' : 'light');
  });
}

async function restoreTheme() {
  const record = await getMeta('theme');
  if (record && record.value) {
    themeDark = record.value === 'dark';
  }
  applyTheme();
}

restoreTheme();

function autoResizeSummary() {
  if (!summaryInput) return;
  summaryInput.style.height = 'auto';
  summaryInput.style.height = `${summaryInput.scrollHeight}px`;
}

function scheduleSummarySave() {
  if (summarySaveTimer) clearTimeout(summarySaveTimer);
  summarySaveTimer = setTimeout(saveSummaryNow, 600);
}

async function saveSummaryNow() {
  const text = summaryInput.value.trim();
  const now = new Date().toISOString();
  const existing = summaries
    .filter(summary => !summary.deletedAt)
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || 0);
      const bTime = Date.parse(b.updatedAt || b.createdAt || 0);
      return bTime - aTime;
    })[0];

  if (!text && summaryRatingValue === 0) {
    if (existing) {
      await updateSummary({
        ...existing,
        deletedAt: now,
        updatedAt: now
      });
      setSummaryStatus('已清空');
      loadSummaries();
    }
    return;
  }

  if (existing) {
    await updateSummary({
      ...existing,
      text,
      rating: summaryRatingValue,
      updatedAt: now,
      deletedAt: null
    });
  } else {
    const initResult = syncInitPromise ? await syncInitPromise : null;
    const userId = currentUserId ||
      (initResult && initResult.userId ? initResult.userId : ensureUserId());
    await addSummary({
      date: selectedDate,
      text,
      rating: summaryRatingValue,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      uuid: generateUUID(),
      userId
    });
  }
  setSummaryStatus('已保存');
  loadSummaries();
}


summaryInput.addEventListener('input', () => {
  autoResizeSummary();
  scheduleSummarySave();
});

// -------- Date module --------
function loadForDate() {
  loadTodos();
  loadSummaries();
}

if (datePrevBtn) {
  datePrevBtn.onclick = () => {
    const date = parseDateLocal(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(formatDateLocal(date));
  };
}

if (dateNextBtn) {
  dateNextBtn.onclick = () => {
    const date = parseDateLocal(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(formatDateLocal(date));
  };
}

if (dateResetBtn) {
  dateResetBtn.onclick = () => {
    setSelectedDate(formatDateLocal(new Date()));
  };
}

if (datePicker) {
  datePicker.addEventListener('change', () => {
    if (datePicker.value) setSelectedDate(datePicker.value);
  });
}

setSelectedDate(selectedDate);

// -------- Timer module --------
const DEFAULT_MINUTES = 90;
let timerDurationMs = DEFAULT_MINUTES * 60 * 1000;
let timerInterval = null;
let timerRunning = false;
let timerRemainingMs = timerDurationMs;
let timerStartAt = Date.now();
let bellPhase = {
  state: 'work',
  restEndsAt: 0,
  nextBellAt: 0
};

let audioContext = null;
let lastPersistAt = 0;

function randomBellSeconds() {
  return 180 + Math.floor(Math.random() * 121);
}

function playTone(freq, durationMs) {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(audioContext.destination);
    const now = audioContext.currentTime;
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  } catch (err) {
    // 静默降级
  }
}

function updateTimerUI(remainingMs) {
  const totalSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = String(totalSec % 60).padStart(2, '0');
  if (timerRemainingEl) timerRemainingEl.textContent = `${minutes}:${seconds}`;
  if (timerRingEl) {
    const percent = Math.max(0, Math.min(1, remainingMs / timerDurationMs));
    timerRingEl.style.setProperty('--percent', `${Math.round(percent * 100)}%`);
  }
}

function setTimerStatus(text) {
  if (timerStatusEl) timerStatusEl.textContent = text;
}

function resetBellSchedule(now) {
  bellPhase = {
    state: 'work',
    restEndsAt: 0,
    nextBellAt: now + randomBellSeconds() * 1000
  };
}

function tickTimer() {
  if (!timerRunning) return;
  const now = Date.now();
  const remainingMs = Math.max(0, timerRemainingMs - (now - timerStartAt));
  updateTimerUI(remainingMs);

  if (remainingMs <= 0) {
    timerRunning = false;
    timerDurationMs = DEFAULT_MINUTES * 60 * 1000;
    timerRemainingMs = timerDurationMs;
    if (timerMinutesInput) timerMinutesInput.value = DEFAULT_MINUTES;
    updateTimerUI(timerRemainingMs);
    setTimerStatus('倒计时结束');
    playTone(600, 800);
    updateToggleLabel();
    persistTimerState();
    bgm.stop();
    return;
  }

  if (bellPhase.state === 'rest') {
    const restLeft = Math.max(0, Math.ceil((bellPhase.restEndsAt - now) / 1000));
    setTimerStatus(`休息中（${restLeft}s）`);
    if (restLeft <= 0) {
      bellPhase.state = 'work';
      bellPhase.nextBellAt = now + randomBellSeconds() * 1000;
      playTone(900, 180);
    }
    return;
  }

  const nextBellIn = Math.max(0, Math.ceil((bellPhase.nextBellAt - now) / 1000));
  setTimerStatus(`距离下次休息还有 ${nextBellIn} 秒`);
  if (nextBellIn <= 0) {
    bellPhase.state = 'rest';
    bellPhase.restEndsAt = now + 10000;
    playTone(420, 180);
  }

  if (now - lastPersistAt > 5000) {
    lastPersistAt = now;
    persistTimerState();
  }
}

function startTimer() {
  if (timerRunning) return;
  if (timerRemainingMs <= 0 || timerRemainingMs > timerDurationMs) {
    timerRemainingMs = timerDurationMs;
  }
  timerRunning = true;
  timerStartAt = Date.now();
  resetBellSchedule(Date.now());
  updateToggleLabel();
  persistTimerState();
  bgm.play();
  if (!timerInterval) {
    timerInterval = setInterval(tickTimer, 500);
  }
  tickTimer();
}

function pauseTimer() {
  if (!timerRunning) return;
  const now = Date.now();
  const remainingMs = Math.max(0, timerRemainingMs - (now - timerStartAt));
  timerRemainingMs = remainingMs;
  timerRunning = false;
  setTimerStatus('已暂停');
  updateToggleLabel();
  persistTimerState();
  bgm.pause();
}

function stopTimer() {
  timerRunning = false;
  timerRemainingMs = timerDurationMs;
  updateTimerUI(timerRemainingMs);
  setTimerStatus('已结束');
  updateToggleLabel();
  persistTimerState();
  bgm.stop();
}

function applyTimerMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    setTimerStatus('时长需为正整数');
    return;
  }
  timerDurationMs = Math.floor(parsed) * 60 * 1000;
  timerRemainingMs = timerDurationMs;
  timerRunning = false;
  updateTimerUI(timerRemainingMs);
  setTimerStatus('未开始');
  updateToggleLabel();
  persistTimerState();
  bgm.stop();
}

if (timerMinutesInput) {
  timerMinutesInput.addEventListener('change', () => applyTimerMinutes(timerMinutesInput.value));
  timerMinutesInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') applyTimerMinutes(timerMinutesInput.value);
  });
}

if (timerToggleBtn) {
  timerToggleBtn.addEventListener('click', () => {
    if (timerRunning) pauseTimer();
    else startTimer();
  });
}
if (timerStopBtn) timerStopBtn.addEventListener('click', stopTimer);

updateTimerUI(timerRemainingMs);
setTimerStatus('未开始');
updateToggleLabel();
bgm.init();
if (bgmCurrentName) bgmCurrentName.textContent = bgmName;
if (bgmVolume) {
  bgm.setVolume(bgmVolume.value / 100);
  bgmVolume.addEventListener('input', () => {
    bgm.setVolume(bgmVolume.value / 100);
  });
}

if (bgmFileInput) {
  bgmFileInput.addEventListener('change', () => {
    const file = bgmFileInput.files && bgmFileInput.files[0];
    if (file) bgm.setSource(file);
    if (file) {
      bgmName = file.name;
      if (bgmCurrentName) bgmCurrentName.textContent = bgmName;
    }
  });
}

function setSyncStatus(text) {
  if (!syncStatus) return;
  if (text.startsWith('Idle · last ')) {
    const iso = text.replace('Idle · last ', '');
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
      const y = local.getUTCFullYear();
      const m = String(local.getUTCMonth() + 1).padStart(2, '0');
      const d = String(local.getUTCDate()).padStart(2, '0');
      const hh = String(local.getUTCHours()).padStart(2, '0');
      const mm = String(local.getUTCMinutes()).padStart(2, '0');
      const ss = String(local.getUTCSeconds()).padStart(2, '0');
      syncStatus.textContent = `上次同步 ${y}-${m}-${d} ${hh}:${mm}:${ss} (UTC+8)`;
      return;
    }
  }
  syncStatus.textContent = text;
}

const initPromise = initSync({
  onStatus: setSyncStatus,
  onUpdate: updatedDates => {
    if (updatedDates.has(selectedDate)) {
      loadForDate();
    }
  }
});
syncInitPromise = initPromise;

initPromise.then(result => {
  syncReady = true;
  currentUserId = result && result.userId ? result.userId : null;
  setTimeout(() => {
    syncNow();
  }, 1200);
  setInterval(() => {
    if (syncReady) syncNow();
  }, 5 * 60 * 1000);
});

if (syncBtn) {
  syncBtn.addEventListener('click', () => {
    if (syncReady) syncNow();
  });
}

window.addEventListener('online', () => {
  if (syncReady) syncNow();
});

if (bgmToggleBtn) {
  bgmToggleBtn.addEventListener('click', () => {
    if (bgmModal) bgmModal.classList.remove('hidden');
  });
}

if (bgmCloseBtn) {
  bgmCloseBtn.addEventListener('click', () => {
    if (bgmModal) bgmModal.classList.add('hidden');
  });
}

if (bgmModal) {
  bgmModal.addEventListener('click', event => {
    if (event.target === bgmModal) bgmModal.classList.add('hidden');
  });
}

function updateToggleLabel() {
  if (!timerToggleBtn) return;
  timerToggleBtn.textContent = timerRunning ? '暂停' : '开始';
}

async function persistTimerState() {
  const value = {
    durationMs: timerDurationMs,
    remainingMs: timerRunning
      ? Math.max(0, timerRemainingMs - (Date.now() - timerStartAt))
      : timerRemainingMs,
    running: timerRunning,
    startAt: timerRunning ? Date.now() : null,
    bellPhase,
    savedAt: Date.now()
  };
  await setMeta('timer', value);
}

async function restoreTimerState() {
  const record = await getMeta('timer');
  if (!record || !record.value) return;
  const value = record.value;
  if (!value.durationMs || !value.remainingMs) return;
  timerDurationMs = value.durationMs;
  timerRemainingMs = value.remainingMs;
  if (timerMinutesInput) timerMinutesInput.value = Math.floor(timerDurationMs / 60000);

  if (value.running && value.startAt) {
    const elapsed = Date.now() - value.startAt;
    timerRemainingMs = Math.max(0, timerRemainingMs - elapsed);
    if (timerRemainingMs <= 0) {
      timerRunning = false;
      setTimerStatus('倒计时结束');
    } else {
      timerRunning = true;
      timerStartAt = Date.now();
      resetBellSchedule(Date.now());
    }
  } else {
    timerRunning = false;
  }

  updateTimerUI(timerRemainingMs);
  updateToggleLabel();
  if (timerRunning && !timerInterval) {
    timerInterval = setInterval(tickTimer, 500);
  }
}

restoreTimerState();

// -------- Service Worker --------
if ('serviceWorker' in navigator) {
  let swRegistration = null;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    swRegistration = reg;
  });

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'SW_UPDATE_READY') {
      const confirmUpdate = window.confirm('发现新版本，是否刷新？');
      if (confirmUpdate) {
        if (swRegistration && swRegistration.waiting) {
          swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          location.reload();
        }
      }
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}
