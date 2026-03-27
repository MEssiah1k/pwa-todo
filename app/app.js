import {
  getAllTodos,
  getTodosByDate,
  addTodo,
  updateTodo,
  getAllSummaries,
  getSummariesByDate,
  addSummary,
  updateSummary,
  deleteSummary,
  getMeta,
  setMeta,
  getAllRecurrenceRules,
  addRecurrenceRule,
  updateRecurrenceRule,
  deleteRecurrenceRule,
  getTodosByRuleId
} from './db.js';
import * as bgm from './bgm.js';
import {
  createScopedStorageKey,
  migrateLegacyLocalStorageKeys
} from './storage-scope.js';
import {
  initSync,
  syncNow,
  pushNow,
  pullNow,
  syncAllLocalToCloud,
  getUserId,
  fetchRemoteKv,
  fetchRemoteKvsByPrefix,
  upsertRemoteKv,
  insertRemoteKvIfAbsent
} from './sync.js';

const input = document.getElementById('todo-input');
const todoCategory = document.getElementById('todo-category');
const dueInput = document.getElementById('todo-due');
const todoFilterCategory = document.getElementById('todo-filter-category');
const todoQueuePanel = document.getElementById('todo-queue-panel');
const todoQueueList = document.getElementById('todo-queue-list');
const addBtn = document.getElementById('add-btn');
const list = document.getElementById('todo-list');
const completedList = document.getElementById('completed-list');
const completedModule = document.getElementById('completed-module');
const status = document.getElementById('status');

const summaryInput = document.getElementById('summary-input');
const summaryStatus = document.getElementById('summary-status');
const summaryRating = document.getElementById('summary-rating');
const summaryModule = document.getElementById('summary-module');
const timerTimelineChart = document.getElementById('timer-timeline-chart');
const timerTimelineTitle = document.getElementById('timer-timeline-title');
const timerTimelineSummary = document.getElementById('timer-timeline-summary');
const contributionChart = document.getElementById('contribution-chart');
const contributionSummary = document.getElementById('contribution-summary');
const contributionTitle = document.getElementById('contribution-title');
const taskStatusChart = document.getElementById('task-status-chart');
const taskStatusSummary = document.getElementById('task-status-summary');
const taskStatusTitle = document.getElementById('task-status-title');
const workPunchBtns = Array.from(document.querySelectorAll('.work-punch-head-btn'));
const timelineEditModal = document.getElementById('timeline-edit-modal');
const timelineEditCloseBtn = document.getElementById('timeline-edit-close');
const timelineEditTitle = document.getElementById('timeline-edit-title');
const timelineEditList = document.getElementById('timeline-edit-list');
const timelineEditAddBtn = document.getElementById('timeline-edit-add');
const timelineEditSaveBtn = document.getElementById('timeline-edit-save');
const promptModal = document.getElementById('prompt-modal');
const promptMessage = document.getElementById('prompt-message');
const promptCancelBtn = document.getElementById('prompt-cancel');
const promptConfirmBtn = document.getElementById('prompt-confirm');
const assistCustomModal = document.getElementById('assist-custom-modal');
const assistCustomInput = document.getElementById('assist-custom-input');
const assistCustomCloseBtn = document.getElementById('assist-custom-close');
const assistCustomCancelBtn = document.getElementById('assist-custom-cancel');
const assistCustomConfirmBtn = document.getElementById('assist-custom-confirm');
const dailySettlementModal = document.getElementById('daily-settlement-modal');
const dailySettlementBody = document.getElementById('daily-settlement-body');
const dailySettlementCloseBtn = document.getElementById('daily-settlement-close');

const datePrevBtn = document.getElementById('date-prev');
const dateNextBtn = document.getElementById('date-next');
const dateResetBtn = document.getElementById('date-reset');
const datePicker = document.getElementById('date-picker');
const dateWeekday = document.getElementById('date-weekday');
const syncBtn = document.getElementById('sync-btn');
const syncPullBtn = document.getElementById('sync-pull-btn');
const syncFullBtn = document.getElementById('sync-full-btn');
const syncStatus = document.getElementById('sync-status');

const recurrenceOpenBtn = document.getElementById('recurrence-open');
const recurrenceModal = document.getElementById('recurrence-modal');
const recurrenceCloseBtn = document.getElementById('recurrence-close');
const recurrenceList = document.getElementById('recurrence-list');
const recurrenceCategory = document.getElementById('recurrence-category');
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
const recurrenceEditModal = document.getElementById('recurrence-edit-modal');
const recurrenceEditCloseBtn = document.getElementById('recurrence-edit-close');
const recurrenceEditCategory = document.getElementById('recurrence-edit-category');
const recurrenceEditText = document.getElementById('recurrence-edit-text');
const recurrenceEditType = document.getElementById('recurrence-edit-type');
const recurrenceEditCustom = document.getElementById('recurrence-edit-custom');
const recurrenceEditWeekly = document.getElementById('recurrence-edit-weekly');
const recurrenceEditMonthly = document.getElementById('recurrence-edit-monthly');
const recurrenceEditDay = document.getElementById('recurrence-edit-day');
const recurrenceEditYearly = document.getElementById('recurrence-edit-yearly');
const recurrenceEditMonth = document.getElementById('recurrence-edit-month');
const recurrenceEditYearDay = document.getElementById('recurrence-edit-year-day');
const recurrenceEditInterval = document.getElementById('recurrence-edit-interval');
const recurrenceEditUnit = document.getElementById('recurrence-edit-unit');
const recurrenceEditSaveBtn = document.getElementById('recurrence-edit-save');
const recurrenceEditCancelBtn = document.getElementById('recurrence-edit-cancel');
const themeToggleBtn = document.getElementById('theme-toggle');

const timerRemainingEl = document.getElementById('timer-remaining');
const timerRingEl = document.getElementById('timer-ring');
const timerMinutesInput = document.getElementById('timer-minutes');
const timerStatusEl = document.getElementById('timer-status');
const timerInlinePromptEl = document.getElementById('timer-inline-prompt');
const timerInlinePromptTextEl = document.getElementById('timer-inline-prompt-text');
const timerInlinePromptConfirmBtn = document.getElementById('timer-inline-prompt-confirm');
const timerInlinePromptCancelBtn = document.getElementById('timer-inline-prompt-cancel');
const bgmStatusEl = document.getElementById('bgm-status');
const timerVersionEl = document.getElementById('timer-version');
const timerToggleBtn = document.getElementById('timer-toggle');
const timerStopBtn = document.getElementById('timer-stop');
const assistTimerActiveEl = document.getElementById('assist-timer-active');
const assistTimerBarEl = document.getElementById('assist-timer-bar');
const assistTimerRemainingEl = document.getElementById('assist-timer-remaining');
const assistTimerToggleBtn = document.getElementById('assist-timer-toggle');
const assistTimerStopBtn = document.getElementById('assist-timer-stop');
const assistQuickBtns = Array.from(document.querySelectorAll('.assist-quick-btn'));
const bgmFileInput = document.getElementById('bgm-file');
const bgmToggleBtn = document.getElementById('bgm-toggle');
const bgmModal = document.getElementById('bgm-modal');
const bgmCloseBtn = document.getElementById('bgm-close');
const bgmCurrentName = document.getElementById('bgm-current-name');
const bgmVolume = document.getElementById('bgm-volume');
const bgmDebugEl = document.getElementById('bgm-debug');
const bgmDebugCopyBtn = document.getElementById('bgm-debug-copy');
const alarmVolume = document.getElementById('alarm-volume');
const regretCoinBalanceEl = document.getElementById('regret-coin-balance');
const regretCoinStatusEl = document.getElementById('regret-coin-status');
const regretCoinSpendInput = document.getElementById('regret-coin-spend-input');
const regretCoinSpendBtn = document.getElementById('regret-coin-spend-btn');
const APP_VERSION = 'v0.1.3';
const RECURRENCE_SKIP_META_KEY = 'recurrenceSkips';
const CONTRIBUTION_START_YEAR = 2026;
const TIMER_TIMELINE_META_KEY = 'timerTimelineByDate';
const TIMER_TIMELINE_ACTIVE_META_KEY = 'timerTimelineActive';
const TIMER_TIMELINE_UPDATED_AT_META_KEY = 'timerTimelineUpdatedAt';
const TIMER_TIMELINE_ACTIVE_UPDATED_AT_META_KEY = 'timerTimelineActiveUpdatedAt';
const TIMER_TIMELINE_MANUAL_OPS_KEY = 'timerTimelineManualOps';
const TIMER_STATE_LOCAL_KEY = createScopedStorageKey('pwaTodo.timerState');
const ASSIST_TIMER_STATE_LOCAL_KEY = createScopedStorageKey('pwaTodo.assistTimerState');
const ASSIST_TIMER_PRESETS_LOCAL_KEY = createScopedStorageKey('pwaTodo.assistTimerPresets');
const WORK_PUNCH_LOCAL_KEY = createScopedStorageKey('pwaTodo.workPunchRecords');
const TIMER_TIMELINE_LOCAL_KEY = createScopedStorageKey('pwaTodo.timerTimelineByDate');
const TIMER_TIMELINE_ACTIVE_LOCAL_KEY = createScopedStorageKey('pwaTodo.timerTimelineActive');
const TIMER_LEASE_KEY = createScopedStorageKey('pwaTodo.timerLease');
const TIMER_LEASE_TTL_MS = 4000;
const TIMER_LEASE_HEARTBEAT_MS = 2000;
const REGRET_COIN_LEDGER_META_KEY = 'regretCoinLedger';
const REGRET_COIN_LAST_SYNC_AT_META_KEY = 'regretCoinLedgerUpdatedAt';
const REGRET_COIN_LEDGER_REMOTE_KEY = 'regret_coin_ledger';
const DAILY_SETTLEMENT_REMOTE_PREFIX = 'daily_settlement:';
const NATURAL_DAY_META_KEY = 'lastKnownNaturalDate';

let todos = [];
let draggedTodoId = null;
let draggedTodoGroup = null;
let suppressTodoClickUntil = 0;
let summaries = [];
let selectedDate = formatDateLocal(new Date());
let migrationDone = false;
let recurrenceRules = [];
let editingRecurrenceRuleId = null;
const MAX_IN_PROGRESS_TODOS = 3;
const IN_PROGRESS_LOCAL_KEY = createScopedStorageKey('pwaTodo.todoInProgress');
let inProgressTodos = new Map();
let restoreInProgressPromise = null;
const runningTimeEls = new Map();
let runningTicker = null;
let contributionScores = new Map();
let taskSummaryStatusByDate = new Map();
let timerTimelineByDate = {};
let activeTimerSegment = null;
let regretCoinLedger = [];
let timelineEditingSegmentId = null;
let timelineEditingDate = '';
let timelineEditingDraft = [];
let timelineEditingInitialSnapshot = '';
let promptResolver = null;
let assistCustomResolver = null;
let regretCoinStatusTimer = null;
let daySettlementTimer = null;
let contributionResizeRaf = 0;
let contributionHalfKey = '';
let contributionFollowCurrentHalf = true;
let contributionLastCurrentHalfKey = '';
let taskStatusMonthKey = '';
let taskStatusFollowCurrentMonth = true;
let taskStatusLastCurrentMonthKey = '';
const timerInstanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

migrateLegacyLocalStorageKeys([
  'pwaTodo.timerState',
  'pwaTodo.timerTimelineByDate',
  'pwaTodo.timerTimelineActive',
  'pwaTodo.timerLease',
  'pwaTodo.todoInProgress'
]);

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

function shiftDate(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeekMonday(date) {
  const next = new Date(date);
  const weekday = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - weekday);
  return next;
}

function formatMonthShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function formatTooltipDate(dateStr) {
  return parseDateLocal(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function getDateStartMs(dateStr) {
  return parseDateLocal(dateStr).getTime();
}

function getDateEndMs(dateStr) {
  return getDateStartMs(dateStr) + 24 * 60 * 60 * 1000;
}

function formatClockTime(timestamp) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDurationText(durationMs) {
  const totalMinutes = Math.max(1, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}小时${minutes}分钟`;
  if (hours) return `${hours}小时`;
  return `${minutes}分钟`;
}

function padTimePart(value) {
  return String(value).padStart(2, '0');
}

function formatTimeInputValue(timestamp) {
  const date = new Date(timestamp);
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;
}

function parseTimeInputValue(dateStr, value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const date = parseDateLocal(dateStr);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

function readLocalJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writeLocalJson(key, value) {
  try {
    if (value == null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    // ignore local persistence failures
  }
}

function resolvePrompt(result) {
  if (!promptResolver) return;
  const resolver = promptResolver;
  promptResolver = null;
  if (promptModal) promptModal.classList.add('hidden');
  resolver(result);
}

function openPromptModal(message, options = {}) {
  if (!promptModal || !promptMessage || !promptConfirmBtn || !promptCancelBtn) {
    return Promise.resolve(window.confirm(message));
  }
  if (promptResolver) resolvePrompt(false);
  promptMessage.textContent = message;
  promptConfirmBtn.textContent = options.confirmText || '确定';
  promptCancelBtn.textContent = options.cancelText || '取消';
  promptCancelBtn.classList.toggle('hidden', options.showCancel === false);
  promptModal.classList.remove('hidden');
  return new Promise(resolve => {
    promptResolver = resolve;
  });
}

function resolveAssistCustomModal(result) {
  if (!assistCustomResolver) return;
  const resolver = assistCustomResolver;
  assistCustomResolver = null;
  if (assistCustomModal) assistCustomModal.classList.add('hidden');
  resolver(result);
}

function openAssistCustomModal(defaultValue = '') {
  if (!assistCustomModal || !assistCustomInput || !assistCustomConfirmBtn || !assistCustomCancelBtn) {
    return Promise.resolve(null);
  }
  if (assistCustomResolver) resolveAssistCustomModal(null);
  assistCustomInput.value = defaultValue;
  assistCustomModal.classList.remove('hidden');
  requestAnimationFrame(() => {
    assistCustomInput.focus();
    assistCustomInput.select();
  });
  return new Promise(resolve => {
    assistCustomResolver = resolve;
  });
}

function getYesterdayDateStr(baseDateStr = formatDateLocal(new Date())) {
  return formatDateLocal(shiftDate(parseDateLocal(baseDateStr), -1));
}

function getDailySettlementKey(dateStr) {
  return `${DAILY_SETTLEMENT_REMOTE_PREFIX}${dateStr}`;
}

function normalizeTodoPromptText(text) {
  return String(text || '')
    .trim()
    .replace(/^[^:：]+[:：]\s*/, '')
    .trim();
}

function shouldPromptMorningWakeup(todo) {
  return normalizeTodoPromptText(todo && todo.text) === '刷牙2';
}

function getTodayFocusCount(dateStr) {
  return getTimerTimelineSegmentsForDate(dateStr)
    .filter(segment => !segment._active)
    .length;
}

function getSettlementLevel(rating) {
  const normalized = Number.isFinite(rating) ? rating : 0;
  return Math.max(0, Math.min(10, Math.round(normalized * 2)));
}

function getSettlementAction(level) {
  if (level >= 10) {
    return {
      type: 'reward',
      coins: 4,
      text: '获得奖励：4 个后悔币'
    };
  }
  if (level >= 9) {
    return {
      type: 'reward',
      coins: 3,
      text: '获得奖励：3 个后悔币'
    };
  }
  if (level >= 8) {
    return {
      type: 'reward',
      coins: 2,
      text: '获得奖励：2 个后悔币'
    };
  }
  if (level < 2) {
    return {
      type: 'penalty',
      coins: 0,
      text: '需要惩罚：400r投资'
    };
  }
  if (level < 4) {
    return {
      type: 'penalty',
      coins: 0,
      text: '需要惩罚：200r投资'
    };
  }
  if (level < 6) {
    return {
      type: 'penalty',
      coins: 0,
      text: '需要惩罚：100r投资'
    };
  }
  return {
    type: 'neutral',
    coins: 0,
    text: '无奖励，无惩罚'
  };
}

function getSettlementEncouragement(level, actionType) {
  if (actionType === 'reward') return '今天做得很稳，继续把高质量专注延续下去。';
  if (actionType === 'penalty') return '今天没有达标，按规则执行惩罚，明天把节奏拉回来。';
  if (level >= 6) return '已经过线了，再多一点稳定输出就能拿到奖励。';
  return '先别找借口，明天至少把基础专注次数补回来。';
}

function normalizeRegretCoinLedger(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item.id === 'string')
    .map(item => ({
      id: item.id,
      type: item.type === 'spend' ? 'spend' : 'reward',
      amount: Math.max(0, Math.floor(Number(item.amount) || 0)),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      sourceDate: typeof item.sourceDate === 'string' ? item.sourceDate : '',
      note: typeof item.note === 'string' ? item.note : ''
    }))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

function mergeRegretCoinLedger(localLedger, remoteLedger) {
  const merged = new Map();
  for (const item of [...normalizeRegretCoinLedger(localLedger), ...normalizeRegretCoinLedger(remoteLedger)]) {
    const existing = merged.get(item.id);
    if (!existing || (item.createdAt || '') > (existing.createdAt || '')) {
      merged.set(item.id, item);
    }
  }
  return Array.from(merged.values()).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

function getRegretCoinBalance(ledger = regretCoinLedger) {
  return normalizeRegretCoinLedger(ledger).reduce((sum, item) => {
    if (item.type === 'reward') return sum + item.amount;
    if (item.type === 'spend') return sum - item.amount;
    return sum;
  }, 0);
}

async function persistRegretCoinLedger(updatedAt = new Date().toISOString()) {
  const normalized = normalizeRegretCoinLedger(regretCoinLedger);
  regretCoinLedger = normalized;
  await Promise.all([
    setMeta(REGRET_COIN_LEDGER_META_KEY, normalized),
    setMeta(REGRET_COIN_LAST_SYNC_AT_META_KEY, updatedAt)
  ]);
}

async function syncRegretCoinLedgerFromCloud() {
  const [localRecord, localUpdatedAtRecord, remoteRow] = await Promise.all([
    getMeta(REGRET_COIN_LEDGER_META_KEY),
    getMeta(REGRET_COIN_LAST_SYNC_AT_META_KEY),
    fetchRemoteKv(REGRET_COIN_LEDGER_REMOTE_KEY)
  ]);
  const localLedger = normalizeRegretCoinLedger(localRecord ? localRecord.value : []);
  const remoteLedger = normalizeRegretCoinLedger(remoteRow && remoteRow.value ? remoteRow.value.ops : []);
  const mergedLedger = mergeRegretCoinLedger(localLedger, remoteLedger);
  const remoteUpdatedAt = remoteRow && remoteRow.updated_at ? remoteRow.updated_at : '';
  const localUpdatedAt = localUpdatedAtRecord && typeof localUpdatedAtRecord.value === 'string'
    ? localUpdatedAtRecord.value
    : '';

  regretCoinLedger = mergedLedger;
  const remoteSnapshot = JSON.stringify(remoteLedger);
  const mergedSnapshot = JSON.stringify(mergedLedger);
  const mergedUpdatedAt = [remoteUpdatedAt, localUpdatedAt]
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || new Date().toISOString();
  await persistRegretCoinLedger(mergedUpdatedAt);

  if (syncReady && (remoteUpdatedAt < mergedUpdatedAt || remoteSnapshot !== mergedSnapshot)) {
    await upsertRemoteKv(REGRET_COIN_LEDGER_REMOTE_KEY, { ops: mergedLedger }, mergedUpdatedAt);
  }
  renderRegretCoinSection();
}

async function reconcileSettlementRewardsFromCloud() {
  if (!syncReady) return;
  const rows = await fetchRemoteKvsByPrefix(DAILY_SETTLEMENT_REMOTE_PREFIX);
  if (!rows.length) return;
  const existingIds = new Set(normalizeRegretCoinLedger(regretCoinLedger).map(item => item.id));
  const missingRewards = [];

  rows.forEach(row => {
    const value = row && row.value && typeof row.value === 'object' ? row.value : null;
    if (!value || value.actionType !== 'reward' || !value.date || !value.regretCoinReward) return;
    const rewardId = `reward:${value.date}`;
    if (existingIds.has(rewardId)) return;
    missingRewards.push({
      id: rewardId,
      type: 'reward',
      amount: Math.max(0, Math.floor(Number(value.regretCoinReward) || 0)),
      createdAt: value.settledAt || row.updated_at || new Date().toISOString(),
      sourceDate: value.date,
      note: '每日结算奖励'
    });
  });

  if (!missingRewards.length) return;
  regretCoinLedger = mergeRegretCoinLedger(regretCoinLedger, missingRewards);
  const updatedAt = new Date().toISOString();
  await persistRegretCoinLedger(updatedAt);
  await upsertRemoteKv(REGRET_COIN_LEDGER_REMOTE_KEY, { ops: regretCoinLedger }, updatedAt);
  renderRegretCoinSection();
}

function renderRegretCoinSection() {
  if (regretCoinBalanceEl) {
    regretCoinBalanceEl.textContent = String(Math.max(0, getRegretCoinBalance()));
  }
}

function setRegretCoinStatus(message) {
  if (!regretCoinStatusEl) return;
  regretCoinStatusEl.textContent = message;
  if (regretCoinStatusTimer) clearTimeout(regretCoinStatusTimer);
  if (!message) return;
  regretCoinStatusTimer = setTimeout(() => {
    if (regretCoinStatusEl.textContent === message) regretCoinStatusEl.textContent = '';
  }, 1800);
}

async function appendRegretCoinEntry(entry) {
  await syncRegretCoinLedgerFromCloud();
  regretCoinLedger = mergeRegretCoinLedger(regretCoinLedger, [entry]);
  const updatedAt = entry.createdAt || new Date().toISOString();
  await persistRegretCoinLedger(updatedAt);
  if (syncReady) {
    await upsertRemoteKv(REGRET_COIN_LEDGER_REMOTE_KEY, { ops: regretCoinLedger }, updatedAt);
  }
  renderRegretCoinSection();
}

async function consumeRegretCoins(amount) {
  await syncRegretCoinLedgerFromCloud();
  const balance = getRegretCoinBalance();
  if (amount > balance) return false;
  const createdAt = new Date().toISOString();
  await appendRegretCoinEntry({
    id: generateUUID(),
    type: 'spend',
    amount,
    createdAt,
    note: '手动消耗'
  });
  return true;
}

function buildDailySettlement(dateStr, rating, focusCount) {
  const level = getSettlementLevel(rating);
  const action = getSettlementAction(level);
  return {
    date: dateStr,
    rating: Number.isFinite(rating) ? rating : 0,
    level,
    focusCount,
    actionType: action.type,
    actionText: action.text,
    regretCoinReward: action.coins,
    encouragement: getSettlementEncouragement(level, action.type),
    settledAt: new Date().toISOString()
  };
}

function openDailySettlementModal(settlement, balance) {
  if (!dailySettlementModal || !dailySettlementBody) {
    window.alert([
      `日期：${settlement.date}`,
      `专注次数：${settlement.focusCount}`,
      settlement.actionText,
      `目前后悔币：${balance}`,
      `鼓励语：${settlement.encouragement}`
    ].join('\n'));
    return;
  }
  dailySettlementBody.innerHTML = '';
  const lines = [
    ['日期', settlement.date],
    ['专注次数', `${settlement.focusCount}`],
    ['星星等级', `${settlement.level}/10`],
    ['结算结果', settlement.actionText],
    ['目前后悔币个数', `${balance}`],
    ['鼓励语', settlement.encouragement]
  ];
  lines.forEach(([label, value], index) => {
    const row = document.createElement(index === 3 ? 'div' : 'p');
    if (index === 3) row.className = 'settlement-highlight';
    row.innerHTML = `<span class="settlement-label">${label}：</span>${value}`;
    dailySettlementBody.appendChild(row);
  });
  dailySettlementModal.classList.remove('hidden');
}

function closeDailySettlementModal() {
  if (dailySettlementModal) dailySettlementModal.classList.add('hidden');
}

async function settlePreviousDayIfNeeded(options = {}) {
  const today = formatDateLocal(new Date());
  const inProgressRecord = readLocalJson(IN_PROGRESS_LOCAL_KEY);
  if (inProgressRecord && inProgressRecord.date && inProgressRecord.date !== today) {
    const cleared = await clearInProgressTodosForNewDay();
    if (cleared) renderTodos();
  }

  if (!syncReady) return;
  const localDayRecord = await getMeta(NATURAL_DAY_META_KEY);
  const lastKnownDay = localDayRecord && typeof localDayRecord.value === 'string'
    ? localDayRecord.value
    : '';

  if (!options.force && lastKnownDay === today) return;
  await setMeta(NATURAL_DAY_META_KEY, today);

  const targetDate = getYesterdayDateStr(today);
  if (!targetDate) return;

  const existingRemoteSettlement = await fetchRemoteKv(getDailySettlementKey(targetDate));
  if (existingRemoteSettlement && existingRemoteSettlement.value) {
    await syncRegretCoinLedgerFromCloud();
    renderRegretCoinSection();
    return;
  }

  const targetSummaries = await getSummariesByDate(targetDate);
  const latestSummary = getLatestSummaryRecord(targetSummaries);
  const rating = latestSummary && typeof latestSummary.rating === 'number' ? latestSummary.rating : 0;
  const focusCount = getTodayFocusCount(targetDate);
  const settlement = buildDailySettlement(targetDate, rating, focusCount);
  await syncRegretCoinLedgerFromCloud();

  const inserted = await insertRemoteKvIfAbsent(
    getDailySettlementKey(targetDate),
    settlement,
    settlement.settledAt
  );

  if (!inserted) {
    const remoteSettlement = await fetchRemoteKv(getDailySettlementKey(targetDate));
    await syncRegretCoinLedgerFromCloud();
    return;
  }

  let finalSettlement = settlement;
  if (settlement.actionType === 'reward') {
    await appendRegretCoinEntry({
      id: `reward:${targetDate}`,
      type: 'reward',
      amount: settlement.regretCoinReward,
      createdAt: settlement.settledAt,
      sourceDate: targetDate,
      note: '每日结算奖励'
    });
  } else {
    renderRegretCoinSection();
  }
  const balance = Math.max(0, getRegretCoinBalance());
  openDailySettlementModal(finalSettlement, balance);
}

function getContributionHalfPeriod(date = new Date()) {
  const year = date.getFullYear();
  const half = date.getMonth() < 6 ? 1 : 2;
  return {
    year,
    half,
    key: `${year}-H${half}`
  };
}

function formatContributionHalfLabel(period) {
  return `${period.year}${period.half === 1 ? '上' : '下'}`;
}

function formatContributionHalfTitle(period) {
  return `${period.year}${period.half === 1 ? '上' : '下'}半年热力图`;
}

function getContributionMonthPeriod(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return {
    year,
    month,
    key: `${year}-${String(month).padStart(2, '0')}`
  };
}

function formatContributionMonthLabel(period) {
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

function formatContributionMonthTitle(period) {
  return `${period.year}年${period.month}月总结图`;
}

function getContributionHalfRange(period) {
  const startMonth = period.half === 1 ? 0 : 6;
  const endMonth = period.half === 1 ? 5 : 11;
  return {
    startDate: new Date(period.year, startMonth, 1),
    endDate: new Date(period.year, endMonth + 1, 0)
  };
}

function buildContributionHalfPeriods(today = new Date()) {
  const current = getContributionHalfPeriod(today);
  const periods = [];
  for (let year = CONTRIBUTION_START_YEAR; year <= current.year; year += 1) {
    periods.push({ year, half: 1, key: `${year}-H1` });
    if (year < current.year || current.half === 2) {
      periods.push({ year, half: 2, key: `${year}-H2` });
    }
  }
  return periods;
}

function getContributionMonthRange(period) {
  return {
    startDate: new Date(period.year, period.month - 1, 1),
    endDate: new Date(period.year, period.month, 0)
  };
}

function buildContributionMonthPeriods(today = new Date()) {
  const current = getContributionMonthPeriod(today);
  const periods = [];
  for (let year = CONTRIBUTION_START_YEAR; year <= current.year; year += 1) {
    const maxMonth = year === current.year ? current.month : 12;
    for (let month = 1; month <= maxMonth; month += 1) {
      periods.push({
        year,
        month,
        key: `${year}-${String(month).padStart(2, '0')}`
      });
    }
  }
  return periods;
}

function getActiveContributionPeriod(periods, currentPeriod) {
  if (!periods.length) return null;
  if (
    contributionFollowCurrentHalf &&
    contributionLastCurrentHalfKey &&
    contributionLastCurrentHalfKey !== currentPeriod.key
  ) {
    contributionHalfKey = currentPeriod.key;
  }
  contributionLastCurrentHalfKey = currentPeriod.key;
  if (!contributionHalfKey || !periods.some(period => period.key === contributionHalfKey)) {
    contributionHalfKey = currentPeriod.key;
  }
  return periods.find(period => period.key === contributionHalfKey) || currentPeriod;
}

function getActiveTaskStatusMonth(periods, currentPeriod) {
  if (!periods.length) return null;
  if (
    taskStatusFollowCurrentMonth &&
    taskStatusLastCurrentMonthKey &&
    taskStatusLastCurrentMonthKey !== currentPeriod.key
  ) {
    taskStatusMonthKey = currentPeriod.key;
  }
  taskStatusLastCurrentMonthKey = currentPeriod.key;
  if (!taskStatusMonthKey || !periods.some(period => period.key === taskStatusMonthKey)) {
    taskStatusMonthKey = currentPeriod.key;
  }
  return periods.find(period => period.key === taskStatusMonthKey) || currentPeriod;
}

function updateContributionCellSize(wrapper) {
  if (!wrapper) return;
  const columnCount = Number(
    wrapper.style.getPropertyValue('--contrib-columns') || wrapper.style.getPropertyValue('--weeks')
  );
  if (!Number.isFinite(columnCount) || columnCount <= 0) return;
  const styles = getComputedStyle(wrapper);
  const labelWidth = parseFloat(styles.getPropertyValue('--contrib-label-width')) || 24;
  const gap = parseFloat(styles.getPropertyValue('--contrib-gap')) || 2;
  const gridGap = parseFloat(styles.gap) || 6;
  const isTransposed = wrapper.classList.contains('is-transposed');
  let chartWidth = wrapper.clientWidth;
  if (isTransposed && wrapper.parentElement) {
    const layoutStyles = getComputedStyle(wrapper.parentElement);
    const layoutGap = parseFloat(layoutStyles.gap) || 0;
    const periods = wrapper.parentElement.querySelector('.contribution-periods');
    const periodsWidth = periods ? periods.clientWidth : 0;
    chartWidth = Math.max(chartWidth, wrapper.parentElement.clientWidth - periodsWidth - layoutGap);
  }
  const useLabelColumn = !isTransposed;
  const cellsWidth = Math.max(0, chartWidth - (useLabelColumn ? labelWidth + gridGap : 0));
  const minSize = window.innerWidth <= 520 ? 8 : 10;
  const autoSize = Math.floor((cellsWidth - gap * (columnCount - 1)) / columnCount);
  const maxSize = isTransposed
    ? (window.innerWidth <= 520 ? 24 : 30)
    : Number.POSITIVE_INFINITY;
  const size = Math.max(minSize, Math.min(maxSize, autoSize));
  wrapper.style.setProperty('--contrib-cell-size', `${size}px`);
}

function pinContributionToTop() {
  const target = contributionChart?.closest('.contribution-card') || summaryModule;
  if (!target) return;
  target.scrollIntoView({ block: 'start' });
}

function schedulePinContributionToTop() {
  requestAnimationFrame(() => {
    requestAnimationFrame(pinContributionToTop);
  });
}

async function setSelectedDate(dateStr, options = {}) {
  const previousDate = selectedDate;
  selectedDate = dateStr;
  if (datePicker) datePicker.value = dateStr;
  if (dateWeekday) {
    const date = parseDateLocal(dateStr);
    const weekdays = ['\u5468\u65e5', '\u5468\u4e00', '\u5468\u4e8c', '\u5468\u4e09', '\u5468\u56db', '\u5468\u4e94', '\u5468\u516d'];
    dateWeekday.textContent = weekdays[date.getDay()];
  }
  ensureRecurrenceForDate(dateStr);
  if (previousDate) {
    const today = formatDateLocal(new Date());
    const yesterday = formatDateLocal(new Date(Date.now() - 86400000));
    if (previousDate === yesterday && dateStr === today) {
      await carryOverIncomplete(previousDate, dateStr);
      await loadForDate();
    } else {
      await loadForDate();
    }
  } else {
    await loadForDate();
  }
  if (options.keepContributionVisible) {
    schedulePinContributionToTop();
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
  const missingDateTodos = all.filter(todo => !todo.date);
  await Promise.all(
    missingDateTodos
      .map(todo =>
        updateTodo({
          ...todo,
          date: today,
          updatedAt: todo.updatedAt || todo.createdAt || now
        })
      )
  );
  if (missingDateTodos.length) triggerChangeSync();
}

async function loadTodos() {
  if (restoreInProgressPromise) await restoreInProgressPromise;
  await migrateMissingTodoDates();
  await pruneInProgressTodos();
  todos = await getTodosByDate(selectedDate);
  todos = await ensurePendingTodoOrders(todos);
  renderTodos();
}

async function carryOverIncomplete(fromDate, toDate) {
  const fromTodos = await getTodosByDate(fromDate);
  const now = new Date().toISOString();
  let hasChanges = false;
  const normalizeTodoText = value => (typeof value === 'string' ? value.trim() : '');

  for (const todo of fromTodos) {
    if (todo.deletedAt) continue;
    if (todo.completed) continue;
    if (!todo.uuid) {
      todo.uuid = generateUUID();
      await updateTodo({ ...todo, updatedAt: now });
      hasChanges = true;
    }
    const latestToTodos = await getTodosByDate(toDate);
    const hasSameCarrySource = latestToTodos.some(target =>
      !target.deletedAt && target.carriedFrom === todo.uuid
    );
    if (hasSameCarrySource) continue;

    // 同一天已有同名任务（含日常自动生成）时，不再从昨日续延，避免先出现重复再靠同步清理
    const nextText = normalizeTodoText(todo.text);
    const hasSameNameTodo = latestToTodos.some(target =>
      !target.deletedAt && normalizeTodoText(target.text) === nextText
    );
    if (hasSameNameTodo) continue;

    // 兜底去重：兼容旧数据或跨端产生的无 carriedFrom 副本
    const hasSameFallbackCopy = latestToTodos.some(target =>
      !target.deletedAt &&
      !target.recurrenceRuleId &&
      !target.carriedFrom &&
      target.text === todo.text &&
      (target.dueMinutes ?? null) === (todo.dueMinutes ?? null)
    );
    if (hasSameFallbackCopy) continue;

    const userId = currentUserId ||
      (syncInitPromise ? (await syncInitPromise).userId : ensureUserId());
    await addTodo({
      date: toDate,
      text: todo.text,
      completed: false,
      queued: false,
      queueOrder: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      dueMinutes: todo.dueMinutes ?? null,
      recurrenceRuleId: null,
      carriedFrom: todo.uuid,
      uuid: generateUUID(),
      userId
    });
    hasChanges = true;
  }
  if (hasChanges) triggerChangeSync();
}

async function moveTodoToTomorrow(todo) {
  if (!todo || todo.deletedAt) return false;
  const sourceDate = todo.date || selectedDate;
  const tomorrowDate = formatDateLocal(shiftDate(parseDateLocal(sourceDate), 1));
  const now = new Date().toISOString();

  await updateTodo({
    ...todo,
    date: tomorrowDate,
    completed: false,
    queued: false,
    queueOrder: null,
    sortOrder: null,
    recurrenceRuleId: null,
    updatedAt: now
  });

  if (todo.recurrenceRuleId != null) {
    await addRecurrenceSkip(sourceDate, Number(todo.recurrenceRuleId));
  }

  await clearTodoInProgress(todo.uuid);
  triggerChangeSync();
  return true;
}

function renderTodos() {
  list.innerHTML = '';
  if (todoQueueList) todoQueueList.innerHTML = '';
  if (completedList) completedList.innerHTML = '';
  runningTimeEls.clear();
  const selectedCategoryFilter = todoFilterCategory ? todoFilterCategory.value : 'All';
  const activeTodos = todos.filter(todo => !todo.deletedAt);
  const pendingTodos = activeTodos
    .filter(todo => !todo.completed)
    .sort(comparePendingTodos);
  const queuedTodos = pendingTodos
    .filter(todo => isTodoQueued(todo))
    .sort(compareQueuedTodos);
  const listTodos = pendingTodos
    .filter(todo => !isTodoQueued(todo))
    .filter(todo => {
      if (selectedCategoryFilter === 'All') return true;
      return parseCategorizedText(todo.text).category === selectedCategoryFilter;
    })
    .sort(comparePendingTodos);
  const doneTodos = activeTodos
    .filter(todo => todo.completed)
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || 0);
      const bTime = Date.parse(b.updatedAt || b.createdAt || 0);
      return bTime - aTime;
    });

  if (todoQueuePanel) {
    todoQueuePanel.classList.toggle('has-items', queuedTodos.length > 0);
  }

  const renderTodoItem = (todo, targetList, group = 'list') => {
    const li = document.createElement('li');
    li.className = todo.completed ? 'completed' : '';
    if (isTodoInProgress(todo)) li.classList.add('in-progress');
    li.dataset.id = String(todo.id);
    li.dataset.group = group;
    li.draggable = targetList === list || targetList === todoQueueList;

    if (targetList === list || targetList === todoQueueList) {
      li.ondragstart = event => {
        if (li.classList.contains('editing')) {
          event.preventDefault();
          return;
        }
        draggedTodoId = todo.id;
        draggedTodoGroup = group;
        li.classList.add('todo-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(todo.id));
        }
      };
      li.ondragend = () => {
        draggedTodoId = null;
        draggedTodoGroup = null;
        li.classList.remove('todo-dragging');
        clearTodoDropIndicatorClasses();
      };
      li.ondragover = event => {
        if (draggedTodoId == null || draggedTodoId === todo.id || draggedTodoGroup !== group) return;
        event.preventDefault();
        const insertAfter = shouldInsertAfter(event, li);
        li.classList.toggle('todo-drop-before', !insertAfter);
        li.classList.toggle('todo-drop-after', insertAfter);
      };
      li.ondragleave = () => {
        li.classList.remove('todo-drop-before', 'todo-drop-after');
      };
      li.ondrop = async event => {
        if (draggedTodoId == null || draggedTodoId === todo.id || draggedTodoGroup !== group) return;
        event.preventDefault();
        const insertAfter = shouldInsertAfter(event, li);
        suppressTodoClickUntil = Date.now() + 300;
        clearTodoDropIndicatorClasses();
        await reorderPendingTodos(draggedTodoId, todo.id, insertAfter, group);
      };
    }

    const content = document.createElement('div');
    content.className = 'todo-content';
    const mainRow = document.createElement('div');
    mainRow.className = 'todo-main';
    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;
    text.ondblclick = event => {
      event.stopPropagation();
      beginTodoEdit(todo, li, mainRow, text);
    };
    mainRow.appendChild(text);

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
      if (todo.recurrenceRuleId != null) {
        await addRecurrenceSkip(todo.date, Number(todo.recurrenceRuleId));
      }
      await clearTodoInProgress(todo.uuid);
      triggerChangeSync();
      loadTodos();
    };

    if (Number.isFinite(todo.dueMinutes)) {
      const due = document.createElement('span');
      due.className = 'todo-due';
      due.textContent = `预计 ${todo.dueMinutes} min`;
      mainRow.appendChild(due);
    }
    content.appendChild(mainRow);

    if (isTodoInProgress(todo) && todo.uuid) {
      const runningTime = document.createElement('div');
      runningTime.className = 'todo-running-time';
      runningTimeEls.set(todo.uuid, runningTime);
      updateRunningTimeEl(todo.uuid, runningTime);
      content.appendChild(runningTime);
    }

    const progressBtn = document.createElement('button');
    progressBtn.className = 'progress-btn';
    progressBtn.type = 'button';
    progressBtn.textContent = isTodoInProgress(todo) ? '停止' : '进行';
    progressBtn.onclick = async event => {
      event.stopPropagation();
      const changed = await toggleTodoInProgress(todo);
      if (changed) loadTodos();
    };

    const moveBtn = document.createElement('button');
    moveBtn.className = 'move-btn';
    moveBtn.type = 'button';
    moveBtn.textContent = '移至明天';
    moveBtn.onclick = async event => {
      event.stopPropagation();
      const changed = await moveTodoToTomorrow(todo);
      if (changed) loadTodos();
    };

    const queueBtn = document.createElement('button');
    queueBtn.className = 'queue-btn';
    queueBtn.type = 'button';
    queueBtn.textContent = isTodoQueued(todo) ? '出列' : '入列';
    queueBtn.onclick = async event => {
      event.stopPropagation();
      const now = new Date().toISOString();
      if (isTodoQueued(todo)) {
        await updateTodo({
          ...todo,
          queued: false,
          queueOrder: null,
          sortOrder: getNextPendingSortOrder(),
          updatedAt: now
        });
      } else {
        await updateTodo({
          ...todo,
          queued: true,
          queueOrder: getNextQueuedSortOrder(),
          updatedAt: now
        });
      }
      triggerChangeSync();
      loadTodos();
    };

    const actions = document.createElement('div');
    actions.className = 'todo-actions';
    if (!todo.completed) actions.appendChild(queueBtn);
    actions.appendChild(moveBtn);
    actions.appendChild(progressBtn);
    actions.appendChild(del);
    li.appendChild(content);
    li.appendChild(actions);
    li.onclick = async event => {
      if (Date.now() < suppressTodoClickUntil) return;
      if (event.detail > 1) return;
      if (li.classList.contains('editing')) return;
      const nextCompleted = !todo.completed;
      const shouldAskMorningWakeup = nextCompleted && shouldPromptMorningWakeup(todo);
      await updateTodo({
        ...todo,
        completed: nextCompleted,
        queued: nextCompleted ? false : todo.queued,
        queueOrder: nextCompleted ? null : todo.queueOrder ?? null,
        updatedAt: new Date().toISOString()
      });
      if (nextCompleted) await clearTodoInProgress(todo.uuid);
      triggerChangeSync();
      loadTodos();
      if (shouldAskMorningWakeup) {
        void openPromptModal(
          '早安呀，今天也要元气满满。\n闹钟响了之后，你有马上起床，没有继续赖床吧？',
          {
            confirmText: '是',
            cancelText: '否'
          }
        );
      }
    };
    targetList.appendChild(li);
  };

  queuedTodos.forEach(todo => renderTodoItem(todo, todoQueueList, 'queue'));
  listTodos.forEach(todo => renderTodoItem(todo, list, 'list'));
  if (completedList) {
    doneTodos.forEach(todo => renderTodoItem(todo, completedList));
  }
  if (completedModule) {
    completedModule.classList.toggle('hidden', doneTodos.length === 0);
  }
}

function isTodoInProgress(todo) {
  return Boolean(todo && todo.uuid && inProgressTodos.has(todo.uuid));
}

function isTodoQueued(todo) {
  return Boolean(todo && !todo.deletedAt && !todo.completed && todo.queued);
}

function getTodoSortTime(todo) {
  return Date.parse(todo.updatedAt || todo.createdAt || 0);
}

function comparePendingTodos(a, b) {
  const aOrder = Number.isFinite(a.sortOrder) ? a.sortOrder : null;
  const bOrder = Number.isFinite(b.sortOrder) ? b.sortOrder : null;
  if (aOrder != null && bOrder != null && aOrder !== bOrder) {
    return aOrder - bOrder;
  }
  if (aOrder != null) return -1;
  if (bOrder != null) return 1;
  return getTodoSortTime(b) - getTodoSortTime(a);
}

function compareQueuedTodos(a, b) {
  const aOrder = Number.isFinite(a.queueOrder) ? a.queueOrder : null;
  const bOrder = Number.isFinite(b.queueOrder) ? b.queueOrder : null;
  if (aOrder != null && bOrder != null && aOrder !== bOrder) {
    return aOrder - bOrder;
  }
  if (aOrder != null) return -1;
  if (bOrder != null) return 1;
  return getTodoSortTime(b) - getTodoSortTime(a);
}

async function ensurePendingGroupOrders(items, group) {
  const isQueueGroup = group === 'queue';
  const orderKey = isQueueGroup ? 'queueOrder' : 'sortOrder';
  const compare = isQueueGroup ? compareQueuedTodos : comparePendingTodos;
  const pendingTodos = items.filter(todo =>
    todo &&
    !todo.deletedAt &&
    !todo.completed &&
    (isQueueGroup ? isTodoQueued(todo) : !isTodoQueued(todo))
  );
  if (!pendingTodos.some(todo => !Number.isFinite(todo[orderKey]))) {
    return new Map();
  }

  const orderedTodos = [...pendingTodos].sort(compare);
  const updatedById = new Map();
  await Promise.all(
    orderedTodos.map(async (todo, index) => {
      if (todo[orderKey] === index) {
        updatedById.set(todo.id, todo);
        return;
      }
      const nextTodo = {
        ...todo,
        [orderKey]: index
      };
      await updateTodo(nextTodo);
      updatedById.set(todo.id, nextTodo);
    })
  );
  return updatedById;
}

async function ensurePendingTodoOrders(items) {
  const [listUpdates, queueUpdates] = await Promise.all([
    ensurePendingGroupOrders(items, 'list'),
    ensurePendingGroupOrders(items, 'queue')
  ]);
  return items.map(todo => listUpdates.get(todo.id) || queueUpdates.get(todo.id) || todo);
}

function shouldInsertAfter(event, element) {
  const rect = element.getBoundingClientRect();
  return event.clientY >= rect.top + rect.height / 2;
}

function clearTodoDropIndicatorClasses() {
  document
    .querySelectorAll('.todo-drop-before, .todo-drop-after, .todo-dragging')
    .forEach(item => item.classList.remove('todo-drop-before', 'todo-drop-after', 'todo-dragging'));
}

async function reorderPendingTodos(draggedId, targetId, insertAfter, group = 'list') {
  const isQueueGroup = group === 'queue';
  const compare = isQueueGroup ? compareQueuedTodos : comparePendingTodos;
  const orderKey = isQueueGroup ? 'queueOrder' : 'sortOrder';
  const orderedPendingTodos = todos
    .filter(todo =>
      todo &&
      !todo.deletedAt &&
      !todo.completed &&
      (isQueueGroup ? isTodoQueued(todo) : !isTodoQueued(todo))
    )
    .sort(compare);
  const draggedIndex = orderedPendingTodos.findIndex(todo => todo.id === draggedId);
  const targetIndex = orderedPendingTodos.findIndex(todo => todo.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return;

  const reorderedTodos = [...orderedPendingTodos];
  const [draggedTodo] = reorderedTodos.splice(draggedIndex, 1);
  const adjustedTargetIndex = reorderedTodos.findIndex(todo => todo.id === targetId);
  const insertIndex = insertAfter ? adjustedTargetIndex + 1 : adjustedTargetIndex;
  reorderedTodos.splice(insertIndex, 0, draggedTodo);

  const updatedById = new Map();
  await Promise.all(
    reorderedTodos.map(async (todo, index) => {
      if (todo[orderKey] === index) {
        updatedById.set(todo.id, todo);
        return;
      }
      const nextTodo = {
        ...todo,
        [orderKey]: index
      };
      await updateTodo(nextTodo);
      updatedById.set(todo.id, nextTodo);
    })
  );

  todos = todos.map(todo => updatedById.get(todo.id) || todo);
  renderTodos();
}

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function updateRunningTimeEl(uuid, el) {
  const startAt = inProgressTodos.get(uuid);
  if (!startAt) {
    el.textContent = '进行中 00:00:00';
    return;
  }
  el.textContent = `进行中 ${formatElapsed(Date.now() - startAt)}`;
}

function tickRunningTimes() {
  for (const [uuid, el] of runningTimeEls.entries()) {
    if (!el.isConnected) {
      runningTimeEls.delete(uuid);
      continue;
    }
    updateRunningTimeEl(uuid, el);
  }
}

function ensureRunningTicker() {
  if (runningTicker) return;
  runningTicker = setInterval(tickRunningTimes, 1000);
}

async function persistInProgressTodos() {
  const payload = Array.from(inProgressTodos.entries())
    .slice(0, MAX_IN_PROGRESS_TODOS)
    .map(([uuid, startAt]) => ({ uuid, startAt }));
  writeLocalJson(IN_PROGRESS_LOCAL_KEY, {
    date: getTodayDateStr(),
    items: payload
  });
}

async function restoreInProgressTodos() {
  const localValue = readLocalJson(IN_PROGRESS_LOCAL_KEY);
  const today = getTodayDateStr();
  const value = localValue && localValue.date === today && Array.isArray(localValue.items)
    ? localValue.items
    : [];
  const next = new Map();
  const now = Date.now();
  for (const item of value) {
    if (!item || typeof item.uuid !== 'string') continue;
    if (next.size >= MAX_IN_PROGRESS_TODOS) break;
    const startAt = Number(item.startAt);
    next.set(item.uuid, Number.isFinite(startAt) && startAt > 0 ? startAt : now);
  }
  inProgressTodos = next;
  if (!localValue || localValue.date === today) return;
  writeLocalJson(IN_PROGRESS_LOCAL_KEY, null);
}

async function clearInProgressTodosForNewDay() {
  if (!inProgressTodos.size && !readLocalJson(IN_PROGRESS_LOCAL_KEY)) return false;
  inProgressTodos = new Map();
  writeLocalJson(IN_PROGRESS_LOCAL_KEY, null);
  return true;
}

async function pruneInProgressTodos() {
  if (!inProgressTodos.size) return;
  const today = getTodayDateStr();
  const all = await getAllTodos();
  const valid = new Set(
    all
      .filter(
        todo =>
          !todo.deletedAt &&
          !todo.completed &&
          todo.uuid &&
          todo.date === today
      )
      .map(todo => todo.uuid)
  );
  let changed = false;
  for (const uuid of Array.from(inProgressTodos.keys())) {
    if (valid.has(uuid)) continue;
    inProgressTodos.delete(uuid);
    changed = true;
  }
  if (inProgressTodos.size > MAX_IN_PROGRESS_TODOS) {
    const kept = Array.from(inProgressTodos.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, MAX_IN_PROGRESS_TODOS);
    const keepSet = new Set(kept.map(([uuid]) => uuid));
    for (const uuid of Array.from(inProgressTodos.keys())) {
      if (keepSet.has(uuid)) continue;
      inProgressTodos.delete(uuid);
      changed = true;
    }
  }
  if (changed) await persistInProgressTodos();
}

async function clearTodoInProgress(uuid) {
  if (!uuid || !inProgressTodos.has(uuid)) return false;
  inProgressTodos.delete(uuid);
  await persistInProgressTodos();
  return true;
}

async function toggleTodoInProgress(todo) {
  await pruneInProgressTodos();
  if (!todo || !todo.uuid) {
    setStatus('任务缺少标识，无法设为进行中');
    return false;
  }
  if (todo.date !== getTodayDateStr()) {
    setStatus('只能将今天的任务设为进行中');
    return false;
  }
  if (todo.completed || todo.deletedAt) {
    setStatus('已完成或已删除任务不能设为进行中');
    return false;
  }
  if (inProgressTodos.has(todo.uuid)) {
    inProgressTodos.delete(todo.uuid);
    await persistInProgressTodos();
    return true;
  }
  if (inProgressTodos.size >= MAX_IN_PROGRESS_TODOS) {
    setStatus('最多同时进行 3 个任务');
    return false;
  }
  inProgressTodos.set(todo.uuid, Date.now());
  await persistInProgressTodos();
  return true;
}

function beginTodoEdit(todo, li, textContainer, textNode) {
  if (li.classList.contains('editing')) return;
  li.classList.add('editing');
  const inputEdit = document.createElement('input');
  inputEdit.className = 'edit-input';
  inputEdit.type = 'text';
  inputEdit.value = todo.text;
  textContainer.replaceChild(inputEdit, textNode);
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
      triggerChangeSync();
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

function getNextPendingSortOrder() {
  const pendingOrders = todos
    .filter(todo =>
      todo &&
      !todo.deletedAt &&
      !todo.completed &&
      !isTodoQueued(todo) &&
      Number.isFinite(todo.sortOrder)
    )
    .map(todo => todo.sortOrder);
  if (!pendingOrders.length) return 0;
  return Math.min(...pendingOrders) - 1;
}

function getLastPendingSortOrder() {
  const pendingOrders = todos
    .filter(todo =>
      todo &&
      !todo.deletedAt &&
      !todo.completed &&
      !isTodoQueued(todo) &&
      Number.isFinite(todo.sortOrder)
    )
    .map(todo => todo.sortOrder);
  if (!pendingOrders.length) return -1;
  return Math.max(...pendingOrders);
}

function getNextQueuedSortOrder() {
  const queuedOrders = todos
    .filter(todo =>
      todo &&
      !todo.deletedAt &&
      !todo.completed &&
      isTodoQueued(todo) &&
      Number.isFinite(todo.queueOrder)
    )
    .map(todo => todo.queueOrder);
  if (!queuedOrders.length) return 0;
  return Math.max(...queuedOrders) + 1;
}

function formatTodoText(category, text) {
  const safeCategory = typeof category === 'string' && category.trim()
    ? category.trim()
    : 'Work';
  return `${safeCategory}:${text}`;
}

function parseCategorizedText(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  const match = raw.match(/^(Work|Life|Health|Social|Growth|Leisure|Plan):(.*)$/);
  if (!match) {
    return {
      category: 'Work',
      text: raw
    };
  }
  return {
    category: match[1],
    text: match[2].trim()
  };
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
    text: formatTodoText(todoCategory ? todoCategory.value : 'Work', text),
    completed: false,
    queued: false,
    queueOrder: null,
    sortOrder: getNextPendingSortOrder(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dueMinutes,
    uuid: generateUUID(),
    userId
  });
  triggerChangeSync();
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

if (todoFilterCategory) {
  todoFilterCategory.addEventListener('change', () => {
    renderTodos();
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
  renderDailyFatigueQuestion();
  autoResizeSummary();
  renderTimerTimeline();
  await renderContributionChart();
}

function getTimerTimelineSegmentsForDate(dateStr) {
  const stored = Array.isArray(timerTimelineByDate[dateStr]) ? timerTimelineByDate[dateStr] : [];
  const normalizeSegment = segment => {
    const slices = Array.isArray(segment.slices) && segment.slices.length
      ? segment.slices.map(slice => ({
        startAt: slice.startAt,
        endAt: slice.endAt
      }))
      : [{
        startAt: segment.startAt,
        endAt: segment.endAt
      }];
    const startAt = Math.min(...slices.map(slice => slice.startAt));
    const endAt = Math.max(...slices.map(slice => slice.endAt));
    return {
      ...segment,
      slices,
      startAt,
      endAt
    };
  };
  const segments = stored.map((segment, index) => ({
    ...normalizeSegment(segment),
    _order: index
  }));
  if (activeTimerSegment && activeTimerSegment.date === dateStr) {
    const now = Date.now();
    const liveSlices = (activeTimerSegment.slices || []).map((slice, index, allSlices) => ({
      startAt: slice.startAt,
      endAt: activeTimerSegment.state === 'running' && index === allSlices.length - 1
        ? now
        : slice.endAt
    }));
    segments.push({
      ...normalizeSegment({
        ...activeTimerSegment,
        slices: liveSlices
      }),
      _order: stored.length
    });
  }
  return segments.sort((a, b) => {
    const aSeq = Number.isFinite(a.sequence) ? a.sequence : Number.MAX_SAFE_INTEGER;
    const bSeq = Number.isFinite(b.sequence) ? b.sequence : Number.MAX_SAFE_INTEGER;
    if (aSeq !== bSeq) return aSeq - bSeq;
    return (a._order || 0) - (b._order || 0);
  });
}

function allocateTimelineLanes(segments) {
  return segments.map((segment, index) => ({
    ...segment,
    laneIndex: index,
    endAt: Math.max(segment.endAt || segment.startAt, segment.startAt + 60000)
  }));
}

function getTimelineStateLabel(state) {
  if (state === 'completed') return '自然完成';
  if (state === 'stopped') return '手动结束';
  if (state === 'paused') return '暂停中断';
  if (state === 'running') return '进行中';
  return '已记录';
}

function buildTimelineTooltip(segment) {
  const durationMs = (segment.slices || []).reduce(
    (sum, slice) => sum + Math.max(0, slice.endAt - slice.startAt),
    0
  );
  return [
    `${formatTooltipDate(segment.date)} · 第 ${segment.sequence} 段`,
    `开始：${formatClockTime(segment.startAt)}`,
    `结束：${formatClockTime(segment.endAt)}`,
    `时长：${formatDurationText(durationMs)}`,
    `片段：${(segment.slices || []).length} 段`,
    `状态：${getTimelineStateLabel(segment.state)}`
  ].join('\n');
}

function renderTimerTimeline() {
  if (!timerTimelineChart) return;
  const timelineDate = selectedDate;
  const segments = allocateTimelineLanes(getTimerTimelineSegmentsForDate(timelineDate));
  const dayStartMs = getDateStartMs(timelineDate);
  const dayEndMs = getDateEndMs(timelineDate);

  if (timerTimelineTitle) {
    timerTimelineTitle.textContent = `${formatTooltipDate(timelineDate)}工作时间段`;
  }

  if (!segments.length) {
    timerTimelineChart.replaceChildren(Object.assign(document.createElement('div'), {
      className: 'timeline-empty',
      textContent: timelineDate === getTodayDateStr()
        ? '今天还没有记录到倒计时时间段'
        : '这一天还没有记录到时间段'
    }));
    if (timerTimelineSummary) timerTimelineSummary.textContent = '';
    return;
  }

  const minStart = Math.max(dayStartMs, Math.min(...segments.map(segment => segment.startAt)));
  const maxEnd = Math.min(dayEndMs, Math.max(...segments.map(segment => segment.endAt)));
  const paddingMs = 15 * 60 * 1000;
  let axisStart = Math.max(dayStartMs, minStart - paddingMs);
  let axisEnd = Math.min(dayEndMs, maxEnd + paddingMs);
  if (axisEnd - axisStart < 60 * 60 * 1000) {
    const center = (axisStart + axisEnd) / 2;
    axisStart = Math.max(dayStartMs, center - 30 * 60 * 1000);
    axisEnd = Math.min(dayEndMs, center + 30 * 60 * 1000);
  }
  const axisDuration = Math.max(60 * 1000, axisEnd - axisStart);
  const tickCount = 5;

  const axis = document.createElement('div');
  axis.className = 'timeline-axis';
  axis.style.setProperty('--timeline-ticks', String(tickCount));
  for (let index = 0; index < tickCount; index += 1) {
    const label = document.createElement('span');
    const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
    label.textContent = formatClockTime(axisStart + axisDuration * ratio);
    axis.appendChild(label);
  }

  const body = document.createElement('div');
  body.className = 'timeline-body';

  const grid = document.createElement('div');
  grid.className = 'timeline-grid';
  grid.style.setProperty('--timeline-ticks', String(tickCount));
  for (let index = 0; index < tickCount; index += 1) {
    grid.appendChild(document.createElement('span'));
  }

  const lanes = document.createElement('div');
  lanes.className = 'timeline-lanes';
  const laneCount = Math.max(...segments.map(segment => segment.laneIndex)) + 1;
  const laneEls = Array.from({ length: laneCount }, () => {
    const lane = document.createElement('div');
    lane.className = 'timeline-lane';
    lanes.appendChild(lane);
    return lane;
  });

  const tooltip = document.createElement('div');
  tooltip.className = 'timeline-tooltip';
  tooltip.setAttribute('role', 'status');
  tooltip.setAttribute('aria-live', 'polite');

  const hideTooltip = () => {
    tooltip.classList.remove('is-visible');
  };

  const showTooltip = (button, text) => {
    const chartRect = timerTimelineChart.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    tooltip.textContent = text;
    tooltip.classList.add('is-visible');
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const maxLeft = Math.max(4, chartRect.width - tooltipWidth - 4);
    const left = Math.min(
      maxLeft,
      Math.max(4, buttonRect.left - chartRect.left + buttonRect.width / 2 - tooltipWidth / 2)
    );
    const belowTop = buttonRect.bottom - chartRect.top + 10;
    const aboveTop = buttonRect.top - chartRect.top - tooltipHeight - 10;
    const maxTop = Math.max(4, chartRect.height - tooltipHeight - 4);
    const top = belowTop <= maxTop ? belowTop : Math.max(4, aboveTop);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  segments.forEach(segment => {
    const lane = laneEls[segment.laneIndex];
    const tooltipText = buildTimelineTooltip(segment);
    lane.replaceChildren();
    lane.classList.remove('is-hovered');

    if (segment.state !== 'running') {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'progress-btn timeline-edit-btn';
      editBtn.textContent = '修改';
      editBtn.addEventListener('click', event => {
        event.stopPropagation();
        hideTooltip();
        openTimelineEditModal(segment);
      });
      lane.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-btn timeline-delete-btn';
      deleteBtn.textContent = '删除';
      deleteBtn.addEventListener('click', event => {
        event.stopPropagation();
        hideTooltip();
        deleteTimerTimelineSegment(segment.id);
      });
      lane.appendChild(deleteBtn);

      lane.addEventListener('mouseenter', () => {
        lane.classList.add('is-hovered');
      });
      lane.addEventListener('mouseleave', () => {
        lane.classList.remove('is-hovered');
      });
      lane.addEventListener('focusin', () => {
        lane.classList.add('is-hovered');
      });
      lane.addEventListener('focusout', () => {
        if (!lane.contains(document.activeElement)) {
          lane.classList.remove('is-hovered');
        }
      });
    }

    (segment.slices || []).forEach((slice, index, allSlices) => {
      const startRatio = Math.max(0, Math.min(1, (slice.startAt - axisStart) / axisDuration));
      const endRatio = Math.max(0, Math.min(1, (slice.endAt - axisStart) / axisDuration));
      const left = startRatio * 100;
      const width = Math.max(0, (endRatio - startRatio) * 100);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'timeline-segment';
      button.dataset.state = segment.state;
      button.style.left = `${left}%`;
      button.style.width = `${width}%`;
      button.style.backgroundColor = segment.color;
      if (segment.state === 'paused' && index < allSlices.length - 1) {
        button.classList.add('is-interrupted');
      }
      button.setAttribute('aria-label', tooltipText.replace(/\n/g, '，'));
      button.addEventListener('mouseenter', () => showTooltip(button, tooltipText));
      button.addEventListener('focus', () => showTooltip(button, tooltipText));
      button.addEventListener('mouseleave', hideTooltip);
      button.addEventListener('blur', hideTooltip);
      lane.appendChild(button);
    });
  });

  body.appendChild(grid);
  body.appendChild(lanes);

  const totalDurationMs = segments.reduce(
    (sum, segment) => sum + (segment.slices || []).reduce(
      (sliceSum, slice) => sliceSum + Math.max(0, slice.endAt - slice.startAt),
      0
    ),
    0
  );
  timerTimelineChart.replaceChildren(axis, body, tooltip);
  if (timerTimelineSummary) timerTimelineSummary.textContent = '';
}

async function renderContributionChart() {
  if (!contributionChart && !taskStatusChart) return;
  const allSummaries = await getAllSummaries();
  const latestByDate = new Map();
  const summaryTextStatusByDate = new Map();

  allSummaries
    .filter(summary => !summary.deletedAt)
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || 0);
      const bTime = Date.parse(b.updatedAt || b.createdAt || 0);
      return bTime - aTime;
    })
    .forEach(summary => {
      if (!summary.date || latestByDate.has(summary.date)) return;
      const rawRating = typeof summary.rating === 'number' ? summary.rating : 0;
      const level = Math.max(0, Math.min(10, Math.round(rawRating * 2)));
      latestByDate.set(summary.date, level);
      const summaryText = typeof summary.text === 'string' ? summary.text.trim() : '';
      summaryTextStatusByDate.set(summary.date, summaryText ? 'complete' : 'incomplete');
    });

  contributionScores = latestByDate;
  taskSummaryStatusByDate = summaryTextStatusByDate;

  const focusPeriods = buildContributionHalfPeriods(new Date());
  const focusCurrentPeriod = getContributionHalfPeriod(new Date());
  const taskPeriods = buildContributionMonthPeriods(new Date());
  const taskCurrentPeriod = getContributionMonthPeriod(new Date());
  const todayDateStr = formatDateLocal(new Date());
  if (!focusPeriods.length || !taskPeriods.length) return;
  const activeFocusPeriod = getActiveContributionPeriod(focusPeriods, focusCurrentPeriod);
  const activeTaskPeriod = getActiveTaskStatusMonth(taskPeriods, taskCurrentPeriod);
  if (!activeFocusPeriod || !activeTaskPeriod) return;

  const buildChart = ({ chartEl, getCellData, includePeriodNav = false, periods, currentPeriod, activePeriod, getRange, formatPeriodLabel, onPeriodChange, transpose = false }) => {
    if (!chartEl) return { countA: 0, countB: 0, countC: 0 };
    const { startDate: firstDate, endDate } = getRange(activePeriod);
    const gridStart = startOfWeekMonday(firstDate);
    const diffDays = Math.round((endDate - gridStart) / 86400000);
    const totalDays = diffDays + 1;
    const weekCount = Math.ceil(totalDays / 7);

    const layout = document.createElement('div');
    layout.className = 'contribution-layout';

    const wrapper = document.createElement('div');
    wrapper.className = 'contribution-grid';
    if (transpose) wrapper.classList.add('is-transposed');
    wrapper.style.setProperty('--weeks', String(weekCount));
    wrapper.style.setProperty('--contrib-columns', String(transpose ? 7 : weekCount));

    let months = null;
    if (!transpose) {
      months = document.createElement('div');
      months.className = 'contribution-months';
      let lastLabeledMonth = null;
      for (let week = 0; week < weekCount; week += 1) {
        const monthLabel = document.createElement('span');
        monthLabel.className = 'contribution-month';
        const weekStart = shiftDate(gridStart, week * 7);
        const columnDate = weekStart < firstDate ? firstDate : weekStart;
        const monthKey = `${columnDate.getFullYear()}-${columnDate.getMonth()}`;
        if (columnDate <= endDate && monthKey !== lastLabeledMonth) {
          monthLabel.textContent = formatMonthShort(columnDate);
          lastLabeledMonth = monthKey;
        }
        monthLabel.style.gridColumn = String(week + 1);
        months.appendChild(monthLabel);
      }
    }

    const weekdays = document.createElement('div');
    weekdays.className = 'contribution-weekdays';
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(label => {
      const item = document.createElement('span');
      item.textContent = label;
      weekdays.appendChild(item);
    });

    const cells = document.createElement('div');
    cells.className = 'contribution-cells';
    const tooltip = document.createElement('div');
    tooltip.className = 'contribution-tooltip';
    tooltip.setAttribute('role', 'status');
    tooltip.setAttribute('aria-live', 'polite');

    let countA = 0;
    let countB = 0;
    let countC = 0;

    const hideTooltip = () => {
      tooltip.classList.remove('is-visible');
    };

    const showTooltip = (button, label) => {
      const chartRect = chartEl.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      tooltip.textContent = label;
      tooltip.classList.add('is-visible');
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      const sideOffset = 12;
      const verticalOffset = 10;
      const rightLeft = buttonRect.right - chartRect.left + sideOffset;
      const leftLeft = buttonRect.left - chartRect.left - tooltipWidth - sideOffset;
      const maxLeft = Math.max(4, chartRect.width - tooltipWidth - 4);
      const left = rightLeft <= maxLeft ? rightLeft : Math.max(4, leftLeft);
      const belowTop = buttonRect.bottom - chartRect.top + verticalOffset;
      const aboveTop = buttonRect.top - chartRect.top - tooltipHeight - verticalOffset;
      const maxTop = Math.max(4, chartRect.height - tooltipHeight - 4);
      const top = belowTop <= maxTop ? belowTop : Math.max(4, aboveTop);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };

    for (let week = 0; week < weekCount; week += 1) {
      for (let day = 0; day < 7; day += 1) {
        const cellDate = shiftDate(gridStart, week * 7 + day);
        if (cellDate < firstDate || cellDate > endDate) {
          const spacer = document.createElement('span');
          spacer.className = 'contribution-cell is-outside';
          spacer.setAttribute('aria-hidden', 'true');
          cells.appendChild(spacer);
          continue;
        }

        const dateStr = formatDateLocal(cellDate);
        const cell = getCellData(dateStr);
        countA += cell.countA || 0;
        countB += cell.countB || 0;
        countC += cell.countC || 0;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'contribution-cell';
        if (cell.level != null) button.dataset.level = String(cell.level);
        if (cell.status) button.dataset.status = cell.status;
        button.setAttribute('aria-label', cell.tooltip);
        button.addEventListener('mouseenter', () => showTooltip(button, cell.tooltip));
        button.addEventListener('focus', () => showTooltip(button, cell.tooltip));
        button.addEventListener('mouseleave', hideTooltip);
        button.addEventListener('blur', hideTooltip);
        button.addEventListener('click', () => {
          void setSelectedDate(dateStr, { keepContributionVisible: true });
        });
        cells.appendChild(button);
      }
    }

    if (months) wrapper.appendChild(months);
    wrapper.appendChild(weekdays);
    wrapper.appendChild(cells);
    layout.appendChild(wrapper);

    if (includePeriodNav) {
      const periodNav = document.createElement('div');
      periodNav.className = 'contribution-periods';
      periods
        .slice()
        .reverse()
        .forEach(period => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'contribution-period';
          if (period.key === activePeriod.key) button.classList.add('is-active');
          button.textContent = formatPeriodLabel(period);
          button.setAttribute('aria-pressed', period.key === activePeriod.key ? 'true' : 'false');
          button.addEventListener('click', () => {
            onPeriodChange(period, currentPeriod);
          });
          periodNav.appendChild(button);
        });
      layout.appendChild(periodNav);
    }

    chartEl.replaceChildren(layout, tooltip);
    updateContributionCellSize(wrapper);
    return { countA, countB, countC };
  };

  const focusStats = buildChart({
    chartEl: contributionChart,
    includePeriodNav: true,
    periods: focusPeriods,
    currentPeriod: focusCurrentPeriod,
    activePeriod: activeFocusPeriod,
    getRange: getContributionHalfRange,
    formatPeriodLabel: formatContributionHalfLabel,
    onPeriodChange: (period, currentPeriod) => {
      if (contributionHalfKey === period.key) return;
      contributionHalfKey = period.key;
      contributionFollowCurrentHalf = period.key === currentPeriod.key;
      void renderContributionChart();
    },
    getCellData: dateStr => {
      const level = contributionScores.get(dateStr) ?? 0;
      return {
        level,
        tooltip: `${formatTooltipDate(dateStr)}?\u4e13\u6ce8${level}\u6b21`,
        countA: level > 0 ? 1 : 0,
        countB: level
      };
    }
  });

  const taskStats = buildChart({
    chartEl: taskStatusChart,
    includePeriodNav: true,
    periods: taskPeriods,
    currentPeriod: taskCurrentPeriod,
    activePeriod: activeTaskPeriod,
    getRange: getContributionMonthRange,
    formatPeriodLabel: formatContributionMonthLabel,
    onPeriodChange: (period, currentPeriod) => {
      if (taskStatusMonthKey === period.key) return;
      taskStatusMonthKey = period.key;
      taskStatusFollowCurrentMonth = period.key === currentPeriod.key;
      void renderContributionChart();
    },
    transpose: true,
    getCellData: dateStr => {
      const status = dateStr >= todayDateStr
        ? 'pending'
        : (taskSummaryStatusByDate.get(dateStr) || 'incomplete');
      const tooltipText = status === 'complete'
        ? '\u5df2\u5199\u4eca\u65e5\u603b\u7ed3'
        : status === 'incomplete'
          ? '\u672a\u5199\u4eca\u65e5\u603b\u7ed3'
          : '\u5f53\u5929\u5c1a\u672a\u7ed3\u675f';
      return {
        status,
        tooltip: `${formatTooltipDate(dateStr)}?${tooltipText}`,
        countA: status === 'complete' ? 1 : 0,
        countB: status === 'incomplete' ? 1 : 0,
        countC: status === 'pending' ? 1 : 0
      };
    }
  });

  if (contributionTitle) {
    contributionTitle.textContent = formatContributionHalfTitle(activeFocusPeriod);
  }
  if (contributionChart) {
    contributionChart.setAttribute('aria-label', formatContributionHalfTitle(activeFocusPeriod));
  }
  if (contributionSummary) {
    const recentDays = 15;
    let recentTotal = 0;
    for (let offset = 0; offset < recentDays; offset += 1) {
      const date = shiftDate(parseDateLocal(todayDateStr), -offset);
      recentTotal += contributionScores.get(formatDateLocal(date)) ?? 0;
    }
    contributionSummary.textContent = `最近${recentDays}天平均 ${(recentTotal / recentDays).toFixed(1)} 次`;
  }
  if (taskStatusTitle) {
    taskStatusTitle.textContent = formatContributionMonthTitle(activeTaskPeriod);
  }
  if (taskStatusChart) {
    taskStatusChart.setAttribute('aria-label', `${formatContributionMonthTitle(activeTaskPeriod)}\u53ef\u89c6\u5316\u56fe`);
  }
  if (taskStatusSummary) {
    taskStatusSummary.textContent = `已写 ${taskStats.countA} 天，未写 ${taskStats.countB} 天，未来 ${taskStats.countC} 天`;
  }
}

window.addEventListener('resize', () => {
  if (contributionResizeRaf) cancelAnimationFrame(contributionResizeRaf);
  contributionResizeRaf = requestAnimationFrame(() => {
    contributionResizeRaf = 0;
    updateContributionCellSize(contributionChart?.querySelector('.contribution-grid'));
    updateContributionCellSize(taskStatusChart?.querySelector('.contribution-grid'));
  });
});

// -------- Recurrence rules --------
async function loadRecurrenceRules() {
  recurrenceRules = (await getAllRecurrenceRules()).filter(rule => !rule.deletedAt);
  renderRecurrenceRules();
}

async function getSkippedRuleIdsForDate(dateStr) {
  const record = await getMeta(RECURRENCE_SKIP_META_KEY);
  if (!record || !record.value || typeof record.value !== 'object') return new Set();
  const ids = record.value[dateStr];
  if (!Array.isArray(ids)) return new Set();
  return new Set(ids.map(Number).filter(Number.isFinite));
}

async function addRecurrenceSkip(dateStr, ruleId) {
  if (!dateStr || !Number.isFinite(ruleId)) return;
  const record = await getMeta(RECURRENCE_SKIP_META_KEY);
  const value = record && record.value && typeof record.value === 'object'
    ? { ...record.value }
    : {};
  const current = Array.isArray(value[dateStr]) ? value[dateStr] : [];
  if (current.includes(ruleId)) return;
  value[dateStr] = [...current, ruleId];
  await setMeta(RECURRENCE_SKIP_META_KEY, value);
}

function resetRecurrenceForm() {
  if (recurrenceCategory) recurrenceCategory.value = 'Work';
  if (recurrenceText) recurrenceText.value = '';
  if (recurrenceType) recurrenceType.value = 'daily';
  if (recurrenceInterval) recurrenceInterval.value = '1';
  if (recurrenceUnit) recurrenceUnit.value = 'day';
  if (recurrenceDay) recurrenceDay.value = '1';
  if (recurrenceMonth) recurrenceMonth.value = '1';
  if (recurrenceYearDay) recurrenceYearDay.value = '1';
  if (recurrenceWeekly) {
    recurrenceWeekly.querySelectorAll('input[type="checkbox"]').forEach(el => {
      el.checked = false;
    });
  }
  toggleRecurrenceCustom();
}

function resetRecurrenceEditForm() {
  editingRecurrenceRuleId = null;
  if (recurrenceEditCategory) recurrenceEditCategory.value = 'Work';
  if (recurrenceEditText) recurrenceEditText.value = '';
  if (recurrenceEditType) recurrenceEditType.value = 'daily';
  if (recurrenceEditInterval) recurrenceEditInterval.value = '1';
  if (recurrenceEditUnit) recurrenceEditUnit.value = 'day';
  if (recurrenceEditDay) recurrenceEditDay.value = '1';
  if (recurrenceEditMonth) recurrenceEditMonth.value = '1';
  if (recurrenceEditYearDay) recurrenceEditYearDay.value = '1';
  if (recurrenceEditWeekly) {
    recurrenceEditWeekly.querySelectorAll('input[type="checkbox"]').forEach(el => {
      el.checked = false;
    });
  }
  toggleRecurrenceEditCustom();
}

function fillRecurrenceEditForm(rule) {
  if (!rule) return;
  editingRecurrenceRuleId = rule.id;
  const parsed = parseCategorizedText(rule.text);
  if (recurrenceEditCategory) recurrenceEditCategory.value = parsed.category;
  if (recurrenceEditText) recurrenceEditText.value = parsed.text;
  if (recurrenceEditType) recurrenceEditType.value = rule.type || 'daily';
  if (recurrenceEditInterval) recurrenceEditInterval.value = String(rule.interval || 1);
  if (recurrenceEditUnit) recurrenceEditUnit.value = rule.unit || 'day';
  if (recurrenceEditDay && Number.isFinite(Number(rule.day))) recurrenceEditDay.value = String(rule.day);
  if (recurrenceEditMonth && Number.isFinite(Number(rule.month))) recurrenceEditMonth.value = String(rule.month);
  if (recurrenceEditYearDay && Number.isFinite(Number(rule.day))) recurrenceEditYearDay.value = String(rule.day);
  if (recurrenceEditWeekly) {
    const selected = new Set(Array.isArray(rule.weekdays) ? rule.weekdays.map(Number) : []);
    recurrenceEditWeekly.querySelectorAll('input[type="checkbox"]').forEach(el => {
      el.checked = selected.has(Number(el.value));
    });
  }
  toggleRecurrenceEditCustom();
}

function openRecurrenceEditModal(rule) {
  if (!recurrenceEditModal || !rule) return;
  fillRecurrenceEditForm(rule);
  recurrenceEditModal.classList.remove('hidden');
}

function closeRecurrenceEditModal() {
  resetRecurrenceEditForm();
  if (recurrenceEditModal) recurrenceEditModal.classList.add('hidden');
}

async function syncFutureRecurringTodos(ruleId, nextText) {
  if (!Number.isFinite(Number(ruleId))) return;
  const today = getTodayDateStr();
  const related = await getTodosByRuleId(ruleId);
  const targets = related.filter(todo =>
    !todo.deletedAt &&
    !todo.completed &&
    todo.date >= today
  );
  if (!targets.length) return;
  const now = new Date().toISOString();
  await Promise.all(
    targets.map(todo =>
      updateTodo({
        ...todo,
        text: nextText,
        updatedAt: now
      })
    )
  );
}

function collectRecurrenceFormValue(fields) {
  const text = fields.text ? fields.text.value.trim() : '';
  if (!text) return null;
  const type = fields.type ? fields.type.value : 'daily';
  let weekdays = null;
  let day = null;
  let month = null;
  if (type === 'weekly' && fields.weekly) {
    const selected = Array.from(
      fields.weekly.querySelectorAll('input[type="checkbox"]:checked')
    ).map(el => Number(el.value));
    if (!selected.length) return null;
    weekdays = selected;
  }
  if (type === 'yearly' && fields.month && fields.yearDay) {
    month = Number(fields.month.value);
    day = Number(fields.yearDay.value);
  } else if (type === 'monthly' && fields.day) {
    day = Number(fields.day.value);
  }
  return {
    text: formatTodoText(fields.category ? fields.category.value : 'Work', text),
    type,
    weekdays,
    day,
    month,
    interval: type === 'custom' && fields.interval ? Number(fields.interval.value) : null,
    unit: type === 'custom' && fields.unit ? fields.unit.value : null
  };
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

    const edit = document.createElement('button');
    edit.className = 'edit-btn';
    edit.type = 'button';
    edit.textContent = '修改';
    edit.onclick = event => {
      event.stopPropagation();
      openRecurrenceEditModal(rule);
    };

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
      triggerChangeSync();
      loadRecurrenceRules();
    };

    const actions = document.createElement('div');
    actions.className = 'recurrence-actions';
    actions.appendChild(edit);
    actions.appendChild(del);

    li.appendChild(text);
    li.appendChild(actions);
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
  if (dateStr !== today) return;
  const rules = (await getAllRecurrenceRules()).filter(rule => !rule.deletedAt);
  if (!rules.length) return;
  const skippedRuleIds = await getSkippedRuleIdsForDate(dateStr);
  const todosForDate = await getTodosByDate(dateStr);
  const normalizedNames = new Set(
    todosForDate
      .filter(todo => !todo.deletedAt)
      .map(todo => (typeof todo.text === 'string' ? todo.text.trim() : ''))
      .filter(Boolean)
  );
  const existingRuleIds = new Set(
    todosForDate
      .filter(todo => todo.recurrenceRuleId != null)
      .map(todo => todo.recurrenceRuleId)
  );
  const now = new Date().toISOString();
  let hasChanges = false;
  for (const rule of rules) {
    if (!dateMatchesRule(dateStr, rule)) continue;
    if (skippedRuleIds.has(rule.id)) continue;
    if (existingRuleIds.has(rule.id)) continue;
    const ruleText = typeof rule.text === 'string' ? rule.text.trim() : '';
    if (ruleText && normalizedNames.has(ruleText)) continue;
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
    if (ruleText) normalizedNames.add(ruleText);
    hasChanges = true;
  }
  if (hasChanges) triggerChangeSync();
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

function toggleRecurrenceEditCustom() {
  const type = recurrenceEditType ? recurrenceEditType.value : '';
  if (recurrenceEditCustom) {
    recurrenceEditCustom.classList.toggle('hidden', type !== 'custom');
  }
  if (recurrenceEditWeekly) {
    recurrenceEditWeekly.classList.toggle('hidden', type !== 'weekly');
  }
  if (recurrenceEditMonthly) {
    recurrenceEditMonthly.classList.toggle('hidden', type !== 'monthly');
  }
  if (recurrenceEditYearly) {
    recurrenceEditYearly.classList.toggle('hidden', type !== 'yearly');
  }
}

if (recurrenceType) recurrenceType.addEventListener('change', toggleRecurrenceCustom);
if (recurrenceEditType) recurrenceEditType.addEventListener('change', toggleRecurrenceEditCustom);

if (recurrenceAddBtn) {
  recurrenceAddBtn.addEventListener('click', async () => {
    const now = new Date().toISOString();
    const rule = collectRecurrenceFormValue({
      category: recurrenceCategory,
      text: recurrenceText,
      type: recurrenceType,
      weekly: recurrenceWeekly,
      day: recurrenceDay,
      month: recurrenceMonth,
      yearDay: recurrenceYearDay,
      interval: recurrenceInterval,
      unit: recurrenceUnit
    });
    if (!rule) {
      setStatus('请完善重复规则内容');
      return;
    }
    await addRecurrenceRule({
      ...rule,
      updatedAt: now,
      deletedAt: null,
      createdAt: now,
      uuid: generateUUID()
    });
    triggerChangeSync();
    resetRecurrenceForm();
    await loadRecurrenceRules();
  });
}

if (recurrenceEditSaveBtn) {
  recurrenceEditSaveBtn.addEventListener('click', async () => {
    if (editingRecurrenceRuleId == null) {
      setStatus('未找到要修改的重复规则');
      return;
    }
    const current = recurrenceRules.find(item => item.id === editingRecurrenceRuleId);
    if (!current) {
      setStatus('重复规则已失效，请重新打开');
      return;
    }
    const now = new Date().toISOString();
    const rule = collectRecurrenceFormValue({
      category: recurrenceEditCategory,
      text: recurrenceEditText,
      type: recurrenceEditType,
      weekly: recurrenceEditWeekly,
      day: recurrenceEditDay,
      month: recurrenceEditMonth,
      yearDay: recurrenceEditYearDay,
      interval: recurrenceEditInterval,
      unit: recurrenceEditUnit
    });
    if (!rule) {
      setStatus('请完善重复规则内容');
      return;
    }
    await updateRecurrenceRule({
      ...current,
      ...rule,
      updatedAt: now,
      deletedAt: null,
      createdAt: current.createdAt || now
    });
    await syncFutureRecurringTodos(current.id, rule.text);
    triggerChangeSync();
    await loadRecurrenceRules();
    await loadForDate();
    closeRecurrenceEditModal();
  });
}

if (recurrenceOpenBtn) {
  recurrenceOpenBtn.addEventListener('click', () => {
    if (!recurrenceModal) return;
    recurrenceModal.classList.remove('hidden');
    resetRecurrenceForm();
    if (recurrenceList) recurrenceList.scrollTop = 0;
    void loadRecurrenceRules().then(() => {
      if (!recurrenceList) return;
      requestAnimationFrame(() => {
        recurrenceList.scrollTop = 0;
      });
    });
  });
}

if (recurrenceCloseBtn) {
  recurrenceCloseBtn.addEventListener('click', () => {
    resetRecurrenceForm();
    if (recurrenceModal) recurrenceModal.classList.add('hidden');
  });
}

if (recurrenceModal) {
  recurrenceModal.addEventListener('click', event => {
    if (event.target === recurrenceModal) {
      resetRecurrenceForm();
      recurrenceModal.classList.add('hidden');
    }
  });
}

if (recurrenceEditCloseBtn) {
  recurrenceEditCloseBtn.addEventListener('click', closeRecurrenceEditModal);
}

if (recurrenceEditCancelBtn) {
  recurrenceEditCancelBtn.addEventListener('click', closeRecurrenceEditModal);
}

if (recurrenceEditModal) {
  recurrenceEditModal.addEventListener('click', event => {
    if (event.target === recurrenceEditModal) closeRecurrenceEditModal();
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

if (recurrenceCustom) resetRecurrenceForm();
if (recurrenceEditCustom) resetRecurrenceEditForm();

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
  if (recurrenceEditDay) {
    recurrenceEditDay.innerHTML = '';
    for (let i = 1; i <= 31; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = String(i);
      recurrenceEditDay.appendChild(option);
    }
  }
  if (recurrenceEditMonth) {
    recurrenceEditMonth.innerHTML = '';
    for (let i = 1; i <= 12; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = String(i);
      recurrenceEditMonth.appendChild(option);
    }
  }
  if (recurrenceEditYearDay) {
    recurrenceEditYearDay.innerHTML = '';
    for (let i = 1; i <= 31; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = String(i);
      recurrenceEditYearDay.appendChild(option);
    }
  }
}

buildRecurrenceDateOptions();

let summarySaveTimer = null;
let themeDark = true;
let summaryRatingValue = 0;
let bgmName = 'pinknoise';
let syncReady = false;
let currentUserId = null;
let syncInitPromise = null;
let pendingChangeSync = false;
let changeSyncInFlight = null;
let changeSyncQueued = false;
restoreInProgressPromise = restoreInProgressTodos();
ensureRunningTicker();

function renderBgmStatus(state) {
  if (!bgmStatusEl) return;
  const labels = {
    stopped: '未播放',
    paused: '已暂停',
    loading: '准备播放中',
    playing: '播放中'
  };
  bgmStatusEl.textContent = `BGM：${labels[state] || '未播放'}`;
}

function renderBgmDebug(snapshot) {
  if (!bgmDebugEl || !snapshot) return;
  const audioInfo = snapshot.audio || {};
  const htmlAudioInfo = snapshot.htmlAudio || {};
  const lines = [
    `state=${snapshot.playbackState} shouldPlay=${snapshot.shouldBePlaying} interacted=${snapshot.userInteracted}`,
    `mode=${snapshot.mode || '-'} sourceType=${snapshot.source?.type || '-'} source=${snapshot.source?.value || '-'}`,
    `contextState=${audioInfo.contextState || '-'} sampleRate=${audioInfo.sampleRate || '-'} volume=${snapshot.volume}`,
    `hasSourceNode=${audioInfo.hasSourceNode} hasGainNode=${audioInfo.hasGainNode}`,
    `htmlPaused=${htmlAudioInfo.paused} htmlEnded=${htmlAudioInfo.ended} htmlReady=${htmlAudioInfo.readyState} htmlNetwork=${htmlAudioInfo.networkState}`,
    '',
    ...snapshot.logs
  ];
  bgmDebugEl.textContent = lines.join('\n');
}

let bgmDebugCopyTimer = null;

function setBgmDebugCopyLabel(text) {
  if (!bgmDebugCopyBtn) return;
  bgmDebugCopyBtn.textContent = text;
  if (bgmDebugCopyTimer) {
    clearTimeout(bgmDebugCopyTimer);
    bgmDebugCopyTimer = null;
  }
  if (text === '复制日志') return;
  bgmDebugCopyTimer = window.setTimeout(() => {
    if (!bgmDebugCopyBtn) return;
    bgmDebugCopyBtn.textContent = '复制日志';
    bgmDebugCopyTimer = null;
  }, 1600);
}

async function copyBgmDebugText() {
  if (!bgmDebugEl) return;
  const text = bgmDebugEl.textContent || '';
  if (!text.trim()) {
    setBgmDebugCopyLabel('无内容');
    return;
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      setBgmDebugCopyLabel('已复制');
      return;
    } catch (err) {
      // 回退到选区复制
    }
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(bgmDebugEl);
  selection.removeAllRanges();
  selection.addRange(range);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (err) {
    copied = false;
  }
  selection.removeAllRanges();
  setBgmDebugCopyLabel(copied ? '已复制' : '复制失败');
}

function triggerChangeSync() {
  pendingChangeSync = true;
  void flushChangeSync();
}

async function flushChangeSync() {
  if (!pendingChangeSync || !syncReady) return;
  if (changeSyncInFlight) {
    changeSyncQueued = true;
    return;
  }
  pendingChangeSync = false;
  changeSyncInFlight = (async () => {
    try {
      await pushNow();
    } finally {
      changeSyncInFlight = null;
      if (changeSyncQueued || pendingChangeSync) {
        changeSyncQueued = false;
        void flushChangeSync();
      }
    }
  })();
  await changeSyncInFlight;
}

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

async function restoreRegretCoinLedgerLocal() {
  const record = await getMeta(REGRET_COIN_LEDGER_META_KEY);
  regretCoinLedger = normalizeRegretCoinLedger(record ? record.value : []);
  renderRegretCoinSection();
}

void restoreRegretCoinLedgerLocal();

function autoResizeSummary() {
  if (!summaryInput) return;
  summaryInput.style.height = 'auto';
  summaryInput.style.height = `${summaryInput.scrollHeight}px`;
}

function getLatestSummaryRecord(summaryList = summaries) {
  return summaryList
    .filter(summary => !summary.deletedAt)
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || 0);
      const bTime = Date.parse(b.updatedAt || b.createdAt || 0);
      return bTime - aTime;
    })[0];
}

function scheduleSummarySave() {
  if (summarySaveTimer) clearTimeout(summarySaveTimer);
  summarySaveTimer = setTimeout(saveSummaryNow, 2000);
}

async function saveSummaryNow() {
  if (summarySaveTimer) {
    clearTimeout(summarySaveTimer);
    summarySaveTimer = null;
  }
  const text = summaryInput.value.trim();
  const now = new Date().toISOString();
  const existing = getLatestSummaryRecord();

  if (!text && summaryRatingValue === 0) {
    if (existing) {
      const nextSummary = {
        ...existing,
        deletedAt: now,
        updatedAt: now
      };
      await updateSummary(nextSummary);
      summaries = summaries.map(summary =>
        summary.id === nextSummary.id ? nextSummary : summary
      );
      triggerChangeSync();
      setSummaryStatus('已清空');
      await renderContributionChart();
    }
    return;
  }

  if (existing) {
    const nextSummary = {
      ...existing,
      text,
      rating: summaryRatingValue,
      updatedAt: now,
      deletedAt: null
    };
    await updateSummary(nextSummary);
    summaries = summaries.map(summary =>
      summary.id === nextSummary.id ? nextSummary : summary
    );
    triggerChangeSync();
  } else {
    const initResult = syncInitPromise ? await syncInitPromise : null;
    const userId = currentUserId ||
      (initResult && initResult.userId ? initResult.userId : ensureUserId());
    const nextSummary = {
      date: selectedDate,
      text,
      rating: summaryRatingValue,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      uuid: generateUUID(),
      userId
    };
    const id = await addSummary(nextSummary);
    summaries = [...summaries, { ...nextSummary, id }];
    triggerChangeSync();
  }
  setSummaryStatus('已保存');
  await renderContributionChart();
}


summaryInput.addEventListener('input', () => {
  autoResizeSummary();
  scheduleSummarySave();
});

summaryInput.addEventListener('blur', () => {
  void saveSummaryNow();
});

// -------- Date module --------
async function loadForDate() {
  await Promise.all([loadTodos(), loadSummaries()]);
  renderWorkPunchTable(selectedDate);
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

if (workPunchBtns.length) {
  workPunchBtns.forEach(button => {
    button.addEventListener('click', () => {
      recordWorkPunch(button.dataset.slot);
    });
  });
}

restoreWorkPunchRecords();

setSelectedDate(selectedDate);

// -------- Timer module --------
const DEFAULT_MINUTES = 90;
const DEFAULT_REST_MINUTES = 20;
const TIMER_TIMELINE_COLORS = [
  '#0f766e',
  '#f97316',
  '#2563eb',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#65a30d',
  '#ea580c'
];
let timerDurationMs = DEFAULT_MINUTES * 60 * 1000;
let timerInterval = null;
let timerRunning = false;
let timerRemainingMs = timerDurationMs;
let timerStartAt = Date.now();
let timerMode = 'work';
let bellPhase = {
  state: 'work',
  restEndsAt: 0,
  nextBellAt: 0
};
let alarmVolumeRatio = 0.15;
let timerInlinePromptAction = null;

let audioContext = null;
let lastPersistAt = 0;
let ownsTimerLease = false;
let timerLeaseInterval = null;
let assistTimerDurationMs = 0;
let assistTimerRemainingMs = 0;
let assistTimerRunning = false;
let assistTimerStarted = false;
let assistTimerStartAt = 0;
let assistTimerInterval = null;
let assistTimerPresets = [2, 5, 10, 15, 20];
let workPunchRecords = {};

function getTimerTimelineSequence(dateStr) {
  const history = Array.isArray(timerTimelineByDate[dateStr]) ? timerTimelineByDate[dateStr] : [];
  const activeCount = activeTimerSegment && activeTimerSegment.date === dateStr ? 1 : 0;
  return history.length + activeCount + 1;
}

async function persistTimerTimelineHistory() {
  const updatedAt = new Date().toISOString();
  writeLocalJson(TIMER_TIMELINE_LOCAL_KEY, timerTimelineByDate);
  await Promise.all([
    setMeta(TIMER_TIMELINE_META_KEY, timerTimelineByDate),
    setMeta(TIMER_TIMELINE_UPDATED_AT_META_KEY, updatedAt)
  ]);
}

async function getTimerTimelineManualOps() {
  const record = await getMeta(TIMER_TIMELINE_MANUAL_OPS_KEY);
  const value = record && record.value && typeof record.value === 'object'
    ? record.value
    : {};
  return {
    editedIds: Array.isArray(value.editedIds) ? value.editedIds.filter(Boolean) : [],
    deletedIds: Array.isArray(value.deletedIds) ? value.deletedIds.filter(Boolean) : []
  };
}

async function markTimerTimelineManualEdit(segmentId) {
  if (!segmentId) return;
  const ops = await getTimerTimelineManualOps();
  const deletedIds = ops.deletedIds.filter(id => id !== segmentId);
  const editedIds = ops.editedIds.includes(segmentId)
    ? ops.editedIds
    : [...ops.editedIds, segmentId];
  await setMeta(TIMER_TIMELINE_MANUAL_OPS_KEY, { editedIds, deletedIds });
}

async function markTimerTimelineManualDelete(segmentId) {
  if (!segmentId) return;
  const ops = await getTimerTimelineManualOps();
  const editedIds = ops.editedIds.filter(id => id !== segmentId);
  const deletedIds = ops.deletedIds.includes(segmentId)
    ? ops.deletedIds
    : [...ops.deletedIds, segmentId];
  await setMeta(TIMER_TIMELINE_MANUAL_OPS_KEY, { editedIds, deletedIds });
}

async function persistActiveTimerSegment() {
  const updatedAt = new Date().toISOString();
  writeLocalJson(TIMER_TIMELINE_ACTIVE_LOCAL_KEY, activeTimerSegment);
  await Promise.all([
    setMeta(TIMER_TIMELINE_ACTIVE_META_KEY, activeTimerSegment),
    setMeta(TIMER_TIMELINE_ACTIVE_UPDATED_AT_META_KEY, updatedAt)
  ]);
}

async function restoreTimerTimeline() {
  const localHistory = readLocalJson(TIMER_TIMELINE_LOCAL_KEY);
  const localActive = readLocalJson(TIMER_TIMELINE_ACTIVE_LOCAL_KEY);
  if (localHistory && typeof localHistory === 'object') {
    timerTimelineByDate = localHistory;
  } else {
    const historyRecord = await getMeta(TIMER_TIMELINE_META_KEY);
    timerTimelineByDate = historyRecord && historyRecord.value && typeof historyRecord.value === 'object'
      ? historyRecord.value
      : {};
  }
  if (localActive !== null) {
    activeTimerSegment = localActive;
  } else {
    const activeRecord = await getMeta(TIMER_TIMELINE_ACTIVE_META_KEY);
    activeTimerSegment = activeRecord ? activeRecord.value : null;
  }
  renderTimerTimeline();
}

function startTimerTimelineSegment(now = Date.now()) {
  const dateStr = formatDateLocal(new Date(now));
  if (
    activeTimerSegment &&
    activeTimerSegment.date === dateStr &&
    activeTimerSegment.state === 'paused'
  ) {
    const slices = Array.isArray(activeTimerSegment.slices) ? activeTimerSegment.slices.slice() : [];
    slices.push({ startAt: now, endAt: now });
    activeTimerSegment = {
      ...activeTimerSegment,
      state: 'running',
      slices
    };
    void persistActiveTimerSegment();
    triggerChangeSync();
    renderTimerTimeline();
    return;
  }
  const sequence = getTimerTimelineSequence(dateStr);
  activeTimerSegment = {
    id: generateUUID(),
    date: dateStr,
    startAt: now,
    endAt: now,
    state: 'running',
    plannedDurationMs: timerRemainingMs,
    sequence,
    color: TIMER_TIMELINE_COLORS[(sequence - 1) % TIMER_TIMELINE_COLORS.length],
    slices: [{ startAt: now, endAt: now }]
  };
  void persistActiveTimerSegment();
  triggerChangeSync();
  renderTimerTimeline();
}

function pauseTimerTimelineSegment(endAt = Date.now()) {
  if (!activeTimerSegment || activeTimerSegment.state !== 'running') return;
  const slices = Array.isArray(activeTimerSegment.slices) ? activeTimerSegment.slices.slice() : [];
  if (!slices.length) {
    slices.push({ startAt: endAt, endAt });
  } else {
    const lastIndex = slices.length - 1;
    slices[lastIndex] = {
      ...slices[lastIndex],
      endAt: Math.max(endAt, slices[lastIndex].startAt + 1000)
    };
  }
  activeTimerSegment = {
    ...activeTimerSegment,
    state: 'paused',
    slices
  };
  void persistActiveTimerSegment();
  triggerChangeSync();
  renderTimerTimeline();
}

function finalizeTimerTimelineSegment(state, endAt = Date.now()) {
  if (!activeTimerSegment) return;
  const slices = Array.isArray(activeTimerSegment.slices) ? activeTimerSegment.slices.slice() : [];
  if (activeTimerSegment.state === 'running') {
    if (!slices.length) {
      slices.push({ startAt: endAt, endAt });
    } else {
      const lastIndex = slices.length - 1;
      slices[lastIndex] = {
        ...slices[lastIndex],
        endAt: Math.max(endAt, slices[lastIndex].startAt + 1000)
      };
    }
  }
  const startAt = Math.min(...slices.map(slice => slice.startAt));
  const finalEndAt = Math.max(...slices.map(slice => slice.endAt));
  const segment = {
    ...activeTimerSegment,
    startAt,
    endAt: finalEndAt,
    slices,
    state
  };
  const history = Array.isArray(timerTimelineByDate[segment.date]) ? timerTimelineByDate[segment.date] : [];
  timerTimelineByDate = {
    ...timerTimelineByDate,
    [segment.date]: [...history, segment]
  };
  activeTimerSegment = null;
  void Promise.all([persistTimerTimelineHistory(), persistActiveTimerSegment()]);
  triggerChangeSync();
  renderTimerTimeline();
}

function deleteTimerTimelineSegment(segmentId) {
  if (!segmentId) return;

  if (activeTimerSegment && activeTimerSegment.id === segmentId) {
    if (activeTimerSegment.state === 'running') {
      void openPromptModal('进行中的时间段请先暂停或结束后再删除。', {
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    activeTimerSegment = null;
    void persistActiveTimerSegment();
    triggerChangeSync();
    renderTimerTimeline();
    return;
  }

  let changed = false;
  const nextTimelineByDate = {};
  Object.entries(timerTimelineByDate).forEach(([dateStr, segments]) => {
    const source = Array.isArray(segments) ? segments : [];
    const remaining = source.filter(segment => segment.id !== segmentId);
    if (remaining.length !== source.length) changed = true;
    if (remaining.length) nextTimelineByDate[dateStr] = remaining;
  });

  if (!changed) return;
  timerTimelineByDate = nextTimelineByDate;
  void (async () => {
    await persistTimerTimelineHistory();
    await markTimerTimelineManualDelete(segmentId);
    triggerChangeSync();
    renderTimerTimeline();
  })();
}

function closeTimelineEditModal() {
  timelineEditingSegmentId = null;
  timelineEditingDate = '';
  timelineEditingDraft = [];
  timelineEditingInitialSnapshot = '';
  if (timelineEditModal) timelineEditModal.classList.add('hidden');
}

function getTimelineEditSnapshot() {
  return JSON.stringify(timelineEditingDraft);
}

function hasUnsavedTimelineEdits() {
  return timelineEditingInitialSnapshot && getTimelineEditSnapshot() !== timelineEditingInitialSnapshot;
}

function requestCloseTimelineEditModal() {
  if (hasUnsavedTimelineEdits()) {
    void openPromptModal('当前修改尚未保存，确定要关闭吗？').then(shouldDiscard => {
      if (!shouldDiscard) return;
      closeTimelineEditModal();
    });
    return;
  }
  closeTimelineEditModal();
}

function renderTimelineEditDraft() {
  if (!timelineEditList) return;
  timelineEditList.replaceChildren();

  timelineEditingDraft.forEach((slice, index) => {
    const row = document.createElement('div');
    row.className = 'timeline-edit-row';

    const label = document.createElement('span');
    label.textContent = `片段 ${index + 1}`;

    const startInput = document.createElement('input');
    startInput.type = 'time';
    startInput.step = '60';
    startInput.value = slice.start;
    startInput.addEventListener('input', () => {
      timelineEditingDraft[index].start = startInput.value;
    });

    const endInput = document.createElement('input');
    endInput.type = 'time';
    endInput.step = '60';
    endInput.value = slice.end;
    endInput.addEventListener('input', () => {
      timelineEditingDraft[index].end = endInput.value;
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.style.opacity = '1';
    deleteBtn.style.pointerEvents = 'auto';
    deleteBtn.addEventListener('click', () => {
      timelineEditingDraft.splice(index, 1);
      renderTimelineEditDraft();
    });

    row.append(label, startInput, endInput, deleteBtn);
    timelineEditList.appendChild(row);
  });
}

function openTimelineEditModal(segment) {
  if (!timelineEditModal || !segment) return;
  timelineEditingSegmentId = segment.id;
  timelineEditingDate = segment.date;
  timelineEditingDraft = (segment.slices || []).map(slice => ({
    start: formatTimeInputValue(slice.startAt),
    end: formatTimeInputValue(slice.endAt)
  }));
  timelineEditingInitialSnapshot = getTimelineEditSnapshot();
  if (timelineEditTitle) {
    timelineEditTitle.textContent = `${formatTooltipDate(segment.date)} · 第 ${segment.sequence} 段`;
  }
  renderTimelineEditDraft();
  timelineEditModal.classList.remove('hidden');
}

async function saveTimelineEditModal() {
  if (!timelineEditingSegmentId || !timelineEditingDate) return;
  if (!timelineEditingDraft.length) {
    await openPromptModal('至少保留一个时间片段。', { showCancel: false, confirmText: '知道了' });
    return;
  }

  const slices = timelineEditingDraft
    .map(item => ({
      startAt: parseTimeInputValue(timelineEditingDate, item.start),
      endAt: parseTimeInputValue(timelineEditingDate, item.end)
    }))
    .sort((a, b) => a.startAt - b.startAt);

  if (slices.some(slice => slice.startAt == null || slice.endAt == null || slice.endAt < slice.startAt)) {
    await openPromptModal('请检查时间片段，结束时间不能早于开始时间。', {
      showCancel: false,
      confirmText: '知道了'
    });
    return;
  }
  for (let index = 1; index < slices.length; index += 1) {
    if (slices[index].startAt < slices[index - 1].endAt) {
      await openPromptModal('时间片段不能重叠，请调整后再保存。', {
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
  }

  const updateSegment = segment => ({
    ...segment,
    slices,
    startAt: slices[0].startAt,
    endAt: slices[slices.length - 1].endAt
  });

  if (activeTimerSegment && activeTimerSegment.id === timelineEditingSegmentId) {
    activeTimerSegment = updateSegment(activeTimerSegment);
    await persistActiveTimerSegment();
    triggerChangeSync();
    renderTimerTimeline();
    closeTimelineEditModal();
    return;
  }

  let changed = false;
  timerTimelineByDate = Object.fromEntries(
    Object.entries(timerTimelineByDate).map(([dateStr, segments]) => [
      dateStr,
      (Array.isArray(segments) ? segments : []).map(segment => {
        if (segment.id !== timelineEditingSegmentId) return segment;
        changed = true;
        return updateSegment(segment);
      })
    ])
  );

  if (!changed) return;
  await persistTimerTimelineHistory();
  await markTimerTimelineManualEdit(timelineEditingSegmentId);
  triggerChangeSync();
  renderTimerTimeline();
  closeTimelineEditModal();
}

function readTimerLease() {
  try {
    const raw = window.localStorage.getItem(TIMER_LEASE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writeTimerLease(now = Date.now()) {
  try {
    window.localStorage.setItem(TIMER_LEASE_KEY, JSON.stringify({
      ownerId: timerInstanceId,
      expiresAt: now + TIMER_LEASE_TTL_MS
    }));
    ownsTimerLease = true;
  } catch (err) {
    ownsTimerLease = true;
  }
}

function clearTimerTicking() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function ensureTimerTicking() {
  if (timerInterval) return;
  timerInterval = setInterval(tickTimer, 500);
}

function claimTimerLease() {
  const now = Date.now();
  const lease = readTimerLease();
  if (lease && lease.ownerId !== timerInstanceId && lease.expiresAt > now) {
    ownsTimerLease = false;
    return false;
  }
  writeTimerLease(now);
  return true;
}

function releaseTimerLease() {
  const lease = readTimerLease();
  if (lease && lease.ownerId === timerInstanceId) {
    try {
      window.localStorage.removeItem(TIMER_LEASE_KEY);
    } catch (err) {
      // ignore
    }
  }
  ownsTimerLease = false;
}

function updateTimerLease() {
  const wasOwner = ownsTimerLease;
  if (!timerRunning) {
    releaseTimerLease();
    clearTimerTicking();
    return;
  }
  if (claimTimerLease()) {
    ensureTimerTicking();
    if (!wasOwner) {
      if (timerMode === 'work') bgm.play();
      else bgm.stop();
      tickTimer();
    }
    return;
  }
  clearTimerTicking();
  bgm.stop();
  setTimerStatus('倒计时已在另一页面运行');
}

function ensureTimerLeaseLoop() {
  if (timerLeaseInterval) return;
  timerLeaseInterval = setInterval(updateTimerLease, TIMER_LEASE_HEARTBEAT_MS);
}

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
    gain.gain.value = alarmVolumeRatio;
    osc.connect(gain);
    gain.connect(audioContext.destination);
    const now = audioContext.currentTime;
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  } catch (err) {
    // 静默降级
  }
}

function playToneWithFade(freq, startAt, durationMs, gainValue) {
  if (!audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(gainValue, startAt + 0.08);
  gain.gain.linearRampToValueAtTime(gainValue * 0.88, startAt + Math.max(0.16, durationMs / 1000 - 0.18));
  gain.gain.linearRampToValueAtTime(0.0001, startAt + durationMs / 1000);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(startAt);
  osc.stop(startAt + durationMs / 1000);
}

function playRestEndAlarm() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const gainValue = Math.max(0.02, Math.min(0.9, bgm.getVolume()));
    const startAt = audioContext.currentTime + 0.02;
    const notes = [
      { freq: 440, offset: 0, durationMs: 520 },
      { freq: 554.37, offset: 0.42, durationMs: 520 },
      { freq: 659.25, offset: 0.84, durationMs: 680 },
      { freq: 554.37, offset: 1.46, durationMs: 540 },
      { freq: 440, offset: 1.88, durationMs: 880 }
    ];
    notes.forEach(note => {
      playToneWithFade(note.freq, startAt + note.offset, note.durationMs, gainValue);
    });
  } catch (err) {
    // 静默降级
  }
}

function playAssistEndAlarm() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const gainValue = Math.max(0.04, Math.min(0.28, alarmVolumeRatio * 1.4));
    const startAt = audioContext.currentTime + 0.02;
    const notes = [
      { freq: 880, offset: 0, durationMs: 180 },
      { freq: 1174.66, offset: 0.24, durationMs: 180 },
      { freq: 1567.98, offset: 0.48, durationMs: 260 }
    ];
    notes.forEach(note => {
      playToneWithFade(note.freq, startAt + note.offset, note.durationMs, gainValue);
    });
  } catch (err) {
    // 静默降级
  }
}

function setAlarmVolumePercent(value) {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 15;
  alarmVolumeRatio = safe / 100;
}

function formatAssistTimerText(remainingMs) {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatAssistPresetLabel(minutes) {
  const totalMinutes = Math.max(1, Math.floor(Number(minutes) || 0));
  return `${String(totalMinutes).padStart(2, '0')}:00`;
}

function normalizeAssistTimerPresets(value) {
  const list = Array.isArray(value) ? value : [];
  const normalized = [];
  list.forEach(item => {
    const minutes = Math.floor(Number(item));
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    if (normalized.includes(minutes)) return;
    normalized.push(minutes);
  });
  const merged = [...normalized, ...[2, 5, 10, 15, 20].filter(item => !normalized.includes(item))];
  return merged.slice(0, 5);
}

function persistAssistTimerPresets() {
  writeLocalJson(ASSIST_TIMER_PRESETS_LOCAL_KEY, assistTimerPresets);
}

function renderAssistTimerPresets() {
  if (!assistQuickBtns.length) return;
  const presetButtons = assistQuickBtns.filter(button => button.dataset.custom !== 'true');
  presetButtons.forEach((button, index) => {
    const minutes = assistTimerPresets[index];
    if (!Number.isFinite(minutes)) return;
    button.dataset.minutes = String(minutes);
    button.textContent = formatAssistPresetLabel(minutes);
  });
}

function rememberAssistCustomPreset(minutes) {
  const nextMinutes = Math.floor(Number(minutes));
  if (!Number.isFinite(nextMinutes) || nextMinutes <= 0) return;
  assistTimerPresets = [nextMinutes, ...assistTimerPresets.filter(item => item !== nextMinutes)].slice(0, 5);
  persistAssistTimerPresets();
  renderAssistTimerPresets();
}

function restoreAssistTimerPresets() {
  assistTimerPresets = normalizeAssistTimerPresets(readLocalJson(ASSIST_TIMER_PRESETS_LOCAL_KEY));
  renderAssistTimerPresets();
}

function restoreWorkPunchRecords() {
  const value = readLocalJson(WORK_PUNCH_LOCAL_KEY);
  workPunchRecords = value && typeof value === 'object' ? value : {};
}

function persistWorkPunchRecords() {
  writeLocalJson(WORK_PUNCH_LOCAL_KEY, workPunchRecords);
}

function getWorkPunchRecord(dateStr = selectedDate) {
  const record = workPunchRecords && typeof workPunchRecords === 'object'
    ? workPunchRecords[dateStr]
    : null;
  return record && typeof record === 'object' ? record : {};
}

function renderWorkPunchTable(dateStr = selectedDate) {
  const record = getWorkPunchRecord(dateStr);
  [
    'work1Start',
    'work1End',
    'work2Start',
    'work2End',
    'work3Start',
    'work3End'
  ].forEach(slot => {
    const cell = document.getElementById(`work-punch-${slot}`);
    if (!cell) return;
    cell.textContent = typeof record[slot] === 'string' && record[slot] ? record[slot] : '-';
  });
}

function recordWorkPunch(slot) {
  if (!slot) return;
  const now = new Date();
  const timeText = `${padTimePart(now.getHours())}:${padTimePart(now.getMinutes())}`;
  const current = getWorkPunchRecord(selectedDate);
  workPunchRecords = {
    ...workPunchRecords,
    [selectedDate]: {
      ...current,
      [slot]: timeText
    }
  };
  persistWorkPunchRecords();
  renderWorkPunchTable(selectedDate);
}

function clearAssistTimerTicking() {
  if (!assistTimerInterval) return;
  clearInterval(assistTimerInterval);
  assistTimerInterval = null;
}

function persistAssistTimerState() {
  const value = {
    durationMs: assistTimerDurationMs,
    remainingMs: assistTimerRunning
      ? Math.max(0, assistTimerRemainingMs - (Date.now() - assistTimerStartAt))
      : assistTimerRemainingMs,
    running: assistTimerRunning,
    started: assistTimerStarted,
    startAt: assistTimerRunning ? Date.now() : null
  };
  writeLocalJson(ASSIST_TIMER_STATE_LOCAL_KEY, value.started ? value : null);
}

function updateAssistTimerUI() {
  const remainingMs = assistTimerRunning
    ? Math.max(0, assistTimerRemainingMs - (Date.now() - assistTimerStartAt))
    : assistTimerRemainingMs;
  const percent = assistTimerDurationMs > 0
    ? Math.max(0, Math.min(1, remainingMs / assistTimerDurationMs))
    : 0;

  if (assistTimerActiveEl) assistTimerActiveEl.classList.toggle('hidden', !assistTimerStarted);
  if (assistTimerBarEl) assistTimerBarEl.style.width = `${Math.round(percent * 100)}%`;
  if (assistTimerRemainingEl) assistTimerRemainingEl.textContent = formatAssistTimerText(remainingMs);
  if (assistTimerToggleBtn) {
    assistTimerToggleBtn.textContent = assistTimerRunning ? '暂停' : '继续';
  }
  if (assistQuickBtns.length) {
    assistQuickBtns.forEach(button => {
      const buttonMinutes = Number(button.dataset.minutes);
      const isPreset = Number.isFinite(buttonMinutes) && buttonMinutes > 0;
      const isActive = isPreset &&
        assistTimerStarted &&
        Math.round(assistTimerDurationMs / 60000) === buttonMinutes;
      button.classList.toggle('is-active', isActive);
    });
  }
}

function tickAssistTimer() {
  if (!assistTimerRunning) return;
  const remainingMs = Math.max(0, assistTimerRemainingMs - (Date.now() - assistTimerStartAt));
  if (remainingMs <= 0) {
    assistTimerRunning = false;
    assistTimerStarted = false;
    assistTimerRemainingMs = 0;
    assistTimerDurationMs = 0;
    clearAssistTimerTicking();
    updateAssistTimerUI();
    persistAssistTimerState();
    playAssistEndAlarm();
    return;
  }
  updateAssistTimerUI();
}

function ensureAssistTimerTicking() {
  if (assistTimerInterval) return;
  assistTimerInterval = setInterval(tickAssistTimer, 250);
}

function startAssistTimer(minutes) {
  const parsed = Number(minutes);
  if (!Number.isFinite(parsed) || parsed <= 0) return;
  assistTimerDurationMs = Math.floor(parsed * 60 * 1000);
  assistTimerRemainingMs = assistTimerDurationMs;
  assistTimerRunning = true;
  assistTimerStarted = true;
  assistTimerStartAt = Date.now();
  ensureAssistTimerTicking();
  updateAssistTimerUI();
  persistAssistTimerState();
}

function pauseAssistTimer() {
  if (!assistTimerRunning) return;
  assistTimerRemainingMs = Math.max(0, assistTimerRemainingMs - (Date.now() - assistTimerStartAt));
  assistTimerRunning = false;
  clearAssistTimerTicking();
  updateAssistTimerUI();
  persistAssistTimerState();
}

function resumeAssistTimer() {
  if (!assistTimerStarted || assistTimerRunning || assistTimerRemainingMs <= 0) return;
  assistTimerRunning = true;
  assistTimerStartAt = Date.now();
  ensureAssistTimerTicking();
  updateAssistTimerUI();
  persistAssistTimerState();
}

function stopAssistTimer() {
  assistTimerRunning = false;
  assistTimerStarted = false;
  assistTimerDurationMs = 0;
  assistTimerRemainingMs = 0;
  assistTimerStartAt = 0;
  clearAssistTimerTicking();
  updateAssistTimerUI();
  persistAssistTimerState();
}

function restoreAssistTimerState() {
  const value = readLocalJson(ASSIST_TIMER_STATE_LOCAL_KEY);
  if (!value || !value.started) {
    updateAssistTimerUI();
    return;
  }
  if (!Number.isFinite(value.durationMs) || !Number.isFinite(value.remainingMs) || value.durationMs <= 0 || value.remainingMs < 0) {
    updateAssistTimerUI();
    return;
  }

  assistTimerDurationMs = value.durationMs;
  assistTimerRemainingMs = value.remainingMs;
  assistTimerStarted = true;
  assistTimerRunning = false;

  if (value.running && Number.isFinite(value.startAt)) {
    const remainingMs = Math.max(0, value.remainingMs - (Date.now() - value.startAt));
    if (remainingMs > 0) {
      assistTimerRemainingMs = remainingMs;
      assistTimerRunning = true;
      assistTimerStartAt = Date.now();
      ensureAssistTimerTicking();
    } else {
      stopAssistTimer();
      playAssistEndAlarm();
      return;
    }
  }

  updateAssistTimerUI();
  persistAssistTimerState();
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

function hideTimerInlinePrompt() {
  timerInlinePromptAction = null;
  if (timerInlinePromptEl) timerInlinePromptEl.classList.add('hidden');
}

function showTimerInlinePrompt(message, options = {}) {
  if (!timerInlinePromptEl || !timerInlinePromptTextEl || !timerInlinePromptConfirmBtn || !timerInlinePromptCancelBtn) {
    return;
  }
  timerInlinePromptTextEl.textContent = message;
  timerInlinePromptConfirmBtn.textContent = options.confirmText || '确定';
  timerInlinePromptCancelBtn.textContent = options.cancelText || '取消';
  timerInlinePromptCancelBtn.classList.toggle('hidden', options.showCancel === false);
  timerInlinePromptAction = typeof options.onConfirm === 'function' ? options.onConfirm : null;
  timerInlinePromptEl.classList.remove('hidden');
}

function resetBellSchedule(now) {
  bellPhase = {
    state: 'work',
    restEndsAt: 0,
    nextBellAt: now + randomBellSeconds() * 1000
  };
}

function setTimerMode(nextMode) {
  timerMode = nextMode === 'rest' ? 'rest' : 'work';
}

function getCurrentTimerPauseCount() {
  if (!activeTimerSegment) return 0;
  const slices = Array.isArray(activeTimerSegment.slices) ? activeTimerSegment.slices : [];
  return Math.max(0, slices.length - 1);
}

function prepareWorkTimer(minutes = DEFAULT_MINUTES) {
  timerDurationMs = minutes * 60 * 1000;
  timerRemainingMs = timerDurationMs;
  setTimerMode('work');
  if (timerMinutesInput) timerMinutesInput.value = minutes;
  updateTimerUI(timerRemainingMs);
}

function prepareRestTimer(minutes = DEFAULT_REST_MINUTES) {
  timerDurationMs = minutes * 60 * 1000;
  timerRemainingMs = timerDurationMs;
  setTimerMode('rest');
  if (timerMinutesInput) timerMinutesInput.value = minutes;
  updateTimerUI(timerRemainingMs);
}

function startRestTimer() {
  hideTimerInlinePrompt();
  const now = Date.now();
  prepareRestTimer(DEFAULT_REST_MINUTES);
  timerRunning = true;
  timerStartAt = now;
  bellPhase = {
    state: 'rest',
    restEndsAt: 0,
    nextBellAt: 0
  };
  setTimerStatus('休息中');
  updateToggleLabel();
  persistTimerState();
  updateTimerLease();
  if (ownsTimerLease) {
    bgm.stop();
    tickTimer();
  }
}

function promptStartRest() {
  const pauseCount = getCurrentTimerPauseCount();
  showTimerInlinePrompt(`工作已结束，本次倒计时暂停了 ${pauseCount} 次，是否开始 20 分钟休息？`, {
    confirmText: '开始休息',
    cancelText: '取消',
    onConfirm: () => {
      startRestTimer();
    }
  });
}

function startDefaultWorkTimer() {
  hideTimerInlinePrompt();
  prepareWorkTimer(DEFAULT_MINUTES);
  startTimer();
}

function promptResumeWork() {
  showTimerInlinePrompt('休息已结束，是否继续工作？', {
    confirmText: '确定',
    cancelText: '取消',
    onConfirm: () => {
      startDefaultWorkTimer();
    }
  });
}

function tickTimer() {
  if (!timerRunning || !ownsTimerLease) return;
  const now = Date.now();
  const remainingMs = Math.max(0, timerRemainingMs - (now - timerStartAt));
  updateTimerUI(remainingMs);

  if (remainingMs <= 0) {
    timerRunning = false;
    const finishedMode = timerMode;
    prepareWorkTimer(DEFAULT_MINUTES);
    setTimerStatus(finishedMode === 'rest' ? '休息结束' : '倒计时结束');
    if (finishedMode === 'rest') {
      playRestEndAlarm();
      promptResumeWork();
    } else {
      playTone(600, 800);
      promptStartRest();
      finalizeTimerTimelineSegment('completed', now);
    }
    updateToggleLabel();
    persistTimerState();
    bgm.stop();
    releaseTimerLease();
    clearTimerTicking();
    return;
  }

  if (timerMode === 'rest') {
    setTimerStatus(`休息中，还剩 ${Math.ceil(remainingMs / 1000)} 秒`);
    if (now - lastPersistAt > 5000) {
      lastPersistAt = now;
      persistTimerState();
    }
    return;
  }

  if (bellPhase.state === 'rest') {
    const restLeft = Math.max(0, Math.ceil((bellPhase.restEndsAt - now) / 1000));
    setTimerStatus(`休息中（${restLeft}s）`);
    if (restLeft <= 0) {
      bellPhase.state = 'work';
      bellPhase.nextBellAt = now + randomBellSeconds() * 1000;
      playTone(900, 180);
      renderTimerTimeline();
    }
    return;
  }

  const nextBellIn = Math.max(0, Math.ceil((bellPhase.nextBellAt - now) / 1000));
  setTimerStatus(`距离下次休息还有 ${nextBellIn} 秒`);
  if (nextBellIn <= 0) {
    bellPhase.state = 'rest';
    bellPhase.restEndsAt = now + 10000;
    playTone(420, 180);
    renderTimerTimeline();
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
  const now = Date.now();
  hideTimerInlinePrompt();
  timerRunning = true;
  timerStartAt = now;
  if (timerMode === 'work') {
    resetBellSchedule(now);
    startTimerTimelineSegment(now);
  } else {
    bellPhase = {
      state: 'rest',
      restEndsAt: 0,
      nextBellAt: 0
    };
  }
  updateToggleLabel();
  persistTimerState();
  updateTimerLease();
  if (ownsTimerLease) {
    if (timerMode === 'work') bgm.play();
    else bgm.stop();
    tickTimer();
  }
}

function pauseTimer() {
  if (!timerRunning) return;
  const now = Date.now();
  const remainingMs = Math.max(0, timerRemainingMs - (now - timerStartAt));
  timerRemainingMs = remainingMs;
  timerRunning = false;
  setTimerStatus(timerMode === 'rest' ? '休息已暂停' : '已暂停');
  updateToggleLabel();
  persistTimerState();
  if (timerMode === 'work') pauseTimerTimelineSegment(now);
  bgm.stop();
  releaseTimerLease();
  clearTimerTicking();
}

function stopTimer() {
  const now = Date.now();
  timerRunning = false;
  timerRemainingMs = timerDurationMs;
  updateTimerUI(timerRemainingMs);
  setTimerStatus(timerMode === 'rest' ? '休息已结束' : '已结束');
  updateToggleLabel();
  hideTimerInlinePrompt();
  if (timerMode === 'work') {
    finalizeTimerTimelineSegment('stopped', now);
  }
  prepareWorkTimer(DEFAULT_MINUTES);
  persistTimerState();
  bgm.stop();
  releaseTimerLease();
  clearTimerTicking();
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
  setTimerMode('work');
  updateTimerUI(timerRemainingMs);
  setTimerStatus('未开始');
  updateToggleLabel();
  hideTimerInlinePrompt();
  persistTimerState();
  finalizeTimerTimelineSegment('stopped');
  bgm.stop();
  releaseTimerLease();
  clearTimerTicking();
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

if (assistTimerToggleBtn) {
  assistTimerToggleBtn.addEventListener('click', () => {
    if (assistTimerRunning) pauseAssistTimer();
    else resumeAssistTimer();
  });
}

if (assistTimerStopBtn) {
  assistTimerStopBtn.addEventListener('click', () => {
    stopAssistTimer();
  });
}

if (assistQuickBtns.length) {
  assistQuickBtns.forEach(button => {
    button.addEventListener('click', async () => {
      if (button.dataset.custom === 'true') {
        const input = await openAssistCustomModal('45');
        if (input == null) return;
        const minutes = Number(input);
        if (!Number.isFinite(minutes) || minutes <= 0) return;
        rememberAssistCustomPreset(minutes);
        startAssistTimer(minutes);
        return;
      }
      const minutes = Number(button.dataset.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0) return;
      rememberAssistCustomPreset(minutes);
      startAssistTimer(minutes);
    });
  });
}

if (timerInlinePromptConfirmBtn) {
  timerInlinePromptConfirmBtn.addEventListener('click', () => {
    const action = timerInlinePromptAction;
    hideTimerInlinePrompt();
    if (action) action();
  });
}

if (timerInlinePromptCancelBtn) {
  timerInlinePromptCancelBtn.addEventListener('click', () => {
    hideTimerInlinePrompt();
  });
}

updateTimerUI(timerRemainingMs);
setTimerStatus('未开始');
if (timerVersionEl) timerVersionEl.textContent = `版本 ${APP_VERSION}`;
updateToggleLabel();
restoreAssistTimerPresets();
updateAssistTimerUI();
bgm.init();
renderBgmStatus(bgm.getPlaybackState());
bgm.subscribePlaybackState(renderBgmStatus);
if (typeof bgm.subscribeDebug === 'function') {
  bgm.subscribeDebug(renderBgmDebug);
} else {
  renderBgmDebug({
    playbackState: bgm.getPlaybackState(),
    shouldBePlaying: false,
    userInteracted: false,
    waitingForCanPlay: false,
    retryOnNextInteraction: false,
    reloadBeforeNextPlay: false,
    volume: bgm.getVolume(),
    audio: null,
    logs: ['当前仍是旧版 bgm.js 缓存，调试日志能力未加载。请刷新到最新版本后重试。']
  });
}
ensureTimerLeaseLoop();
window.addEventListener('storage', event => {
  if (event.key !== TIMER_LEASE_KEY) return;
  updateTimerLease();
});
window.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateTimerLease();
    void settlePreviousDayIfNeeded();
    if (syncReady) {
      void syncRegretCoinLedgerFromCloud().then(() => reconcileSettlementRewardsFromCloud());
    }
  }
});
window.addEventListener('pagehide', () => {
  if (ownsTimerLease) releaseTimerLease();
});
daySettlementTimer = window.setInterval(() => {
  void settlePreviousDayIfNeeded();
}, 60 * 1000);
if (bgmCurrentName) bgmCurrentName.textContent = bgmName;
if (bgmVolume) {
  bgm.setVolume(bgmVolume.value / 100);
  bgmVolume.addEventListener('input', () => {
    bgm.setVolume(bgmVolume.value / 100);
  });
}

if (alarmVolume) {
  setAlarmVolumePercent(alarmVolume.value);
  alarmVolume.addEventListener('input', () => {
    setAlarmVolumePercent(alarmVolume.value);
    setMeta('alarmVolume', Math.round(alarmVolumeRatio * 100));
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
    void restoreTimerTimeline();
    loadRecurrenceRules();
    void syncRegretCoinLedgerFromCloud().then(() => reconcileSettlementRewardsFromCloud());
    if (updatedDates.has(selectedDate)) {
      loadForDate();
    }
  }
});
syncInitPromise = initPromise;

initPromise.then(result => {
  syncReady = true;
  currentUserId = result && result.userId ? result.userId : null;
  void syncRegretCoinLedgerFromCloud()
    .then(() => reconcileSettlementRewardsFromCloud())
    .then(() => settlePreviousDayIfNeeded());
  if (pendingChangeSync) {
    void flushChangeSync();
  } else {
    setTimeout(() => {
      syncNow();
      void syncRegretCoinLedgerFromCloud().then(() => reconcileSettlementRewardsFromCloud());
    }, 1200);
  }
  setInterval(() => {
    if (syncReady) {
      syncNow();
      void syncRegretCoinLedgerFromCloud().then(() => reconcileSettlementRewardsFromCloud());
      void settlePreviousDayIfNeeded({ force: true });
    }
  }, 5 * 60 * 1000);
});

if (syncBtn) {
  syncBtn.addEventListener('click', () => {
    if (syncReady) {
      syncNow();
      void syncRegretCoinLedgerFromCloud().then(() => reconcileSettlementRewardsFromCloud());
      void settlePreviousDayIfNeeded({ force: true });
    }
  });
}

if (syncPullBtn) {
  syncPullBtn.addEventListener('click', () => {
    if (syncReady) {
      pullNow();
      void syncRegretCoinLedgerFromCloud().then(() => reconcileSettlementRewardsFromCloud());
      void settlePreviousDayIfNeeded({ force: true });
    }
  });
}

if (syncFullBtn) {
  syncFullBtn.addEventListener('click', () => {
    if (syncReady) {
      syncAllLocalToCloud();
      void syncRegretCoinLedgerFromCloud().then(() => reconcileSettlementRewardsFromCloud());
      void settlePreviousDayIfNeeded({ force: true });
    }
  });
}

window.addEventListener('online', () => {
  if (syncReady) {
    syncNow();
    void syncRegretCoinLedgerFromCloud().then(() => reconcileSettlementRewardsFromCloud());
    void settlePreviousDayIfNeeded({ force: true });
  }
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

if (bgmDebugCopyBtn) {
  bgmDebugCopyBtn.addEventListener('click', () => {
    void copyBgmDebugText();
  });
}

if (bgmModal) {
  bgmModal.addEventListener('click', event => {
    if (event.target === bgmModal) bgmModal.classList.add('hidden');
  });
}

if (timelineEditCloseBtn) {
  timelineEditCloseBtn.addEventListener('click', requestCloseTimelineEditModal);
}

if (timelineEditModal) {
  timelineEditModal.addEventListener('click', event => {
    if (event.target === timelineEditModal) requestCloseTimelineEditModal();
  });
}

if (promptCancelBtn) {
  promptCancelBtn.addEventListener('click', () => {
    resolvePrompt(false);
  });
}

if (promptConfirmBtn) {
  promptConfirmBtn.addEventListener('click', () => {
    resolvePrompt(true);
  });
}

if (promptModal) {
  promptModal.addEventListener('click', event => {
    if (event.target === promptModal) resolvePrompt(false);
  });
}

if (assistCustomCloseBtn) {
  assistCustomCloseBtn.addEventListener('click', () => {
    resolveAssistCustomModal(null);
  });
}

if (assistCustomCancelBtn) {
  assistCustomCancelBtn.addEventListener('click', () => {
    resolveAssistCustomModal(null);
  });
}

if (assistCustomConfirmBtn) {
  assistCustomConfirmBtn.addEventListener('click', () => {
    resolveAssistCustomModal(assistCustomInput ? assistCustomInput.value.trim() : '');
  });
}

if (assistCustomInput) {
  assistCustomInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      resolveAssistCustomModal(assistCustomInput.value.trim());
    }
    if (event.key === 'Escape') {
      resolveAssistCustomModal(null);
    }
  });
}

if (assistCustomModal) {
  assistCustomModal.addEventListener('click', event => {
    if (event.target === assistCustomModal) resolveAssistCustomModal(null);
  });
}

if (dailySettlementCloseBtn) {
  dailySettlementCloseBtn.addEventListener('click', closeDailySettlementModal);
}

if (dailySettlementModal) {
  dailySettlementModal.addEventListener('click', event => {
    if (event.target === dailySettlementModal) closeDailySettlementModal();
  });
}

if (regretCoinSpendBtn) {
  regretCoinSpendBtn.addEventListener('click', async () => {
    const amount = Math.floor(Number(regretCoinSpendInput ? regretCoinSpendInput.value : 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      setRegretCoinStatus('请输入大于 0 的消耗数量');
      return;
    }
    const success = await consumeRegretCoins(amount);
    if (!success) {
      setRegretCoinStatus('后悔币不够');
      return;
    }
    if (regretCoinSpendInput) regretCoinSpendInput.value = '1';
    setRegretCoinStatus(`已消耗 ${amount} 个后悔币`);
  });
}

if (regretCoinSpendInput) {
  regretCoinSpendInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && regretCoinSpendBtn) regretCoinSpendBtn.click();
  });
}

if (timelineEditAddBtn) {
  timelineEditAddBtn.addEventListener('click', () => {
    const last = timelineEditingDraft[timelineEditingDraft.length - 1];
    timelineEditingDraft.push({
      start: last ? last.end : '09:00',
      end: last ? last.end : '09:30'
    });
    renderTimelineEditDraft();
  });
}

if (timelineEditSaveBtn) {
  timelineEditSaveBtn.addEventListener('click', () => {
    void saveTimelineEditModal();
  });
}

function updateToggleLabel() {
  if (!timerToggleBtn) return;
  if (timerRunning) {
    timerToggleBtn.textContent = '暂停';
    return;
  }
  const isPaused = timerRemainingMs > 0 && timerRemainingMs < timerDurationMs;
  timerToggleBtn.textContent = isPaused ? '继续' : '开始';
}

async function persistTimerState() {
  const value = {
    durationMs: timerDurationMs,
    remainingMs: timerRunning
      ? Math.max(0, timerRemainingMs - (Date.now() - timerStartAt))
      : timerRemainingMs,
    running: timerRunning,
    startAt: timerRunning ? Date.now() : null,
    mode: timerMode,
    bellPhase,
    savedAt: Date.now()
  };
  writeLocalJson(TIMER_STATE_LOCAL_KEY, value);
  await setMeta('timer', value);
}

async function restoreTimerState() {
  const localValue = readLocalJson(TIMER_STATE_LOCAL_KEY);
  const record = localValue ? null : await getMeta('timer');
  const value = localValue || (record ? record.value : null);
  if (!value) return;
  if (
    !Number.isFinite(value.durationMs) ||
    !Number.isFinite(value.remainingMs) ||
    value.durationMs < 0 ||
    value.remainingMs < 0
  ) return;
  timerDurationMs = value.durationMs;
  timerRemainingMs = value.remainingMs;
  timerRunning = false;
  timerStartAt = Date.now();
  setTimerMode(value.mode);
  if (timerMinutesInput) timerMinutesInput.value = Math.floor(timerDurationMs / 60000);

  if (timerMode === 'work') {
    resetBellSchedule(Date.now());
    if (activeTimerSegment && activeTimerSegment.state === 'running') {
      pauseTimerTimelineSegment(Date.now());
    }
  } else {
    bellPhase = {
      state: 'rest',
      restEndsAt: 0,
      nextBellAt: 0
    };
  }

  if (value.running && value.startAt) {
    setTimerStatus(value.mode === 'rest' ? '休息已暂停，请手动恢复' : '倒计时已暂停，请手动恢复');
  }

  updateTimerUI(timerRemainingMs);
  updateToggleLabel();
  renderTimerTimeline();
  bgm.stop();
  releaseTimerLease();
  clearTimerTicking();
  persistTimerState();
}
restoreTimerTimeline().then(restoreTimerState);

async function restoreAlarmVolume() {
  const record = await getMeta('alarmVolume');
  if (!record) return;
  const percent = Number(record.value);
  if (!Number.isFinite(percent)) return;
  setAlarmVolumePercent(percent);
  if (alarmVolume) alarmVolume.value = String(Math.round(alarmVolumeRatio * 100));
}

restoreAlarmVolume();
restoreAssistTimerState();

// -------- Service Worker --------
if ('serviceWorker' in navigator) {
  let swRegistration = null;
  const promptForUpdate = () => {
    const confirmUpdate = window.confirm('发现新版本，是否刷新？');
    if (!confirmUpdate) return;
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    location.reload();
  };

  navigator.serviceWorker.register('./sw.js?v=20260325-bgm-fallback-2', { updateViaCache: 'none' }).then(reg => {
    swRegistration = reg;
    reg.update();
    if (reg.waiting) promptForUpdate();
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          promptForUpdate();
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'SW_UPDATE_READY') {
      promptForUpdate();
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}
