import {
  getMeta,
  setMeta,
  getAllTodos,
  getAllSummaries,
  getAllRecurrenceRules,
  getTodosUpdatedAfter,
  getTodosUpdatedBetween,
  getSummariesUpdatedAfter,
  getSummariesUpdatedBetween,
  getRecurrenceRulesUpdatedAfter,
  getRecurrenceRulesUpdatedBetween,
  getSummaryByUuid,
  getRecurrenceRuleByUuid,
  getTodosByRuleId,
  addTodo,
  updateTodo,
  addSummary,
  updateSummary,
  addRecurrenceRule,
  updateRecurrenceRule
} from './db.js?v=20260325-module-fix-1';
import {
  createScopedStorageKey,
  migrateLegacyLocalStorageKeys
} from './storage-scope.js?v=20260325-module-fix-1';

const SUPABASE_URL = 'https://wjyqimuecbairlbdfetr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqeXFpbXVlY2JhaXJsYmRmZXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDU4MDcsImV4cCI6MjA4NjIyMTgwN30.il1pkrnEjHUnnvWR7PCh10VeSWrC18fv596vSCLQOpE';

let supabase = null;
let createClientFn = null;
let userId = null;
let lastSyncAt = '1970-01-01T00:00:00.000Z';
let statusHandler = () => {};
let updateHandler = () => {};

const TIMER_TIMELINE_META_KEY = 'timerTimelineByDate';
const TIMER_TIMELINE_ACTIVE_META_KEY = 'timerTimelineActive';
const TIMER_TIMELINE_UPDATED_AT_META_KEY = 'timerTimelineUpdatedAt';
const TIMER_TIMELINE_ACTIVE_UPDATED_AT_META_KEY = 'timerTimelineActiveUpdatedAt';
const TIMER_TIMELINE_MANUAL_OPS_KEY = 'timerTimelineManualOps';
const TIMER_TIMELINE_LOCAL_KEY = createScopedStorageKey('pwaTodo.timerTimelineByDate');
const TIMER_TIMELINE_ACTIVE_LOCAL_KEY = createScopedStorageKey('pwaTodo.timerTimelineActive');
const WORK_PUNCH_LOCAL_KEY = createScopedStorageKey('pwaTodo.workPunchRecords');
const WORK_PUNCH_REMOTE_KEY = 'work_punch_records';
const TODO_QUEUE_STATE_REMOTE_KEY = 'todo_queue_state';
const MAX_AUTO_DEDUPE_DELETE_COUNT = 50;
const MAX_AUTO_DEDUPE_DELETE_RATIO = 0.3;

migrateLegacyLocalStorageKeys([
  'pwaTodo.timerTimelineByDate',
  'pwaTodo.timerTimelineActive'
]);

function getTodayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
const DEBUG = true;

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
    // ignore
  }
}

function generateUUID() {
  if (crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getUserId() {
  return userId;
}

function setStatus(state, detail = '') {
  statusHandler(`${state}${detail ? ` · ${detail}` : ''}`);
  if (DEBUG) console.log('[sync][status]', state, detail);
}

function mapTodoToRemote(todo) {
  return {
    uuid: todo.uuid,
    date: todo.date,
    text: todo.text,
    completed: todo.completed,
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
    deleted_at: todo.deletedAt
  };
}

function mapSummaryToRemote(summary) {
  return {
    uuid: summary.uuid,
    date: summary.date,
    text: summary.text,
    rating: summary.rating ?? 0,
    created_at: summary.createdAt,
    updated_at: summary.updatedAt,
    deleted_at: summary.deletedAt
  };
}

function mapTodoFromRemote(row) {
  return {
    uuid: row.uuid,
    date: row.date,
    text: row.text,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null
  };
}

function mapRecurrenceRuleToRemote(rule) {
  return {
    uuid: rule.uuid,
    text: rule.text,
    type: rule.type,
    weekdays: rule.weekdays || null,
    day: rule.day ?? null,
    month: rule.month ?? null,
    interval: rule.interval ?? null,
    unit: rule.unit ?? null,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
    deleted_at: rule.deletedAt ?? null
  };
}

function mapRecurrenceRuleFromRemote(row) {
  return {
    uuid: row.uuid,
    text: row.text,
    type: row.type,
    weekdays: row.weekdays || null,
    day: row.day ?? null,
    month: row.month ?? null,
    interval: row.interval ?? null,
    unit: row.unit ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null
  };
}

function mapSummaryFromRemote(row) {
  return {
    uuid: row.uuid,
    date: row.date,
    text: row.text,
    rating: row.rating ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null
  };
}

async function normalizeLocalData() {
  const now = new Date().toISOString();
  const todos = await getAllTodos();
  await Promise.all(
    todos.map(todo => {
      const next = {
        ...todo,
        uuid: todo.uuid || generateUUID(),
        updatedAt: todo.updatedAt || todo.createdAt || now,
        deletedAt: todo.deletedAt ?? null
      };
      if (
        next.uuid !== todo.uuid ||
        next.updatedAt !== todo.updatedAt ||
        next.deletedAt !== todo.deletedAt
      ) {
        return updateTodo(next);
      }
      return null;
    })
  );

  const summaries = await getAllSummaries();
  await Promise.all(
    summaries.map(summary => {
      const next = {
        ...summary,
        uuid: summary.uuid || generateUUID(),
        updatedAt: summary.updatedAt || summary.createdAt || now,
        deletedAt: summary.deletedAt ?? null
      };
      if (
        next.uuid !== summary.uuid ||
        next.updatedAt !== summary.updatedAt ||
        next.deletedAt !== summary.deletedAt
      ) {
        return updateSummary(next);
      }
      return null;
    })
  );

  const rules = await getAllRecurrenceRules();
  await Promise.all(
    rules.map(rule => {
      const next = {
        ...rule,
        uuid: rule.uuid || generateUUID(),
        updatedAt: rule.updatedAt || rule.createdAt || now,
        deletedAt: rule.deletedAt ?? null
      };
      if (
        next.uuid !== rule.uuid ||
        next.updatedAt !== rule.updatedAt ||
        next.deletedAt !== rule.deletedAt
      ) {
        return updateRecurrenceRule(next);
      }
      return null;
    })
  );
}

export async function initSync({ onStatus, onUpdate } = {}) {
  if (onStatus) statusHandler = onStatus;
  if (onUpdate) updateHandler = onUpdate;
  if (DEBUG) console.log('[sync] init start');

  const syncRecord = await getMeta('lastSyncAt');
  if (syncRecord && syncRecord.value) lastSyncAt = syncRecord.value;
  const initRecord = await getMeta('syncInitialized');
  if (!initRecord || !initRecord.value) {
    lastSyncAt = '1970-01-01T00:00:00.000Z';
    await setMeta('lastSyncAt', lastSyncAt);
    await setMeta('syncInitialized', 'true');
  }
  if (DEBUG) console.log('[sync] lastSyncAt', lastSyncAt);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setStatus('Sync disabled', 'missing config');
    return { userId };
  }

  supabase = await getSupabase();
  if (!supabase) {
    setStatus('Sync disabled', 'sdk unavailable');
    return { userId };
  }
  await normalizeLocalData();
  if (DEBUG) console.log('[sync] init done');
  return { userId: null };
}

export async function syncNow() {
  if (!supabase) return;
  try {
    const syncCutoff = new Date().toISOString();
    const previousSyncAt = lastSyncAt;
    setStatus('Syncing');

    // pull first, then push local updates (git-like flow)
    if (DEBUG) console.log('[sync] pull first');
    const updatedDates = await pullRemoteChanges();

    if (DEBUG) console.log('[sync] dedupe local todos after pull');
    const dedupedAfterPull = await dedupeLocalTodosByNameAndStatus();

    if (DEBUG) console.log('[sync] push todos');
    await pushLocalTodos(previousSyncAt, syncCutoff);
    if (DEBUG) console.log('[sync] push summaries');
    await pushLocalSummaries(previousSyncAt, syncCutoff);
    if (DEBUG) console.log('[sync] overwrite recurrence rules (local -> cloud)');
    await overwriteRemoteRecurrenceRulesFromLocal();
    if (DEBUG) console.log('[sync] push timer timeline');
    await pushLocalTimerTimeline(previousSyncAt, syncCutoff);
    if (DEBUG) console.log('[sync] sync work punch');
    const workPunchUpdatedDates = await syncWorkPunchRecords();
    if (DEBUG) console.log('[sync] sync todo queue state');
    const queueUpdatedDates = await syncTodoQueueState();

    dedupedAfterPull.forEach(date => updatedDates.add(date));
    workPunchUpdatedDates.forEach(date => updatedDates.add(date));
    queueUpdatedDates.forEach(date => updatedDates.add(date));
    lastSyncAt = syncCutoff;
    await setMeta('lastSyncAt', lastSyncAt);
    setStatus('Idle', `last ${lastSyncAt}`);
    updateHandler(updatedDates);
  } catch (err) {
    if (DEBUG) console.log('[sync] error', err);
    setStatus('Error');
  }
}

export async function pushNow() {
  if (!supabase) return;
  try {
    const syncCutoff = new Date().toISOString();
    const previousSyncAt = lastSyncAt;
    setStatus('Syncing', 'push only');
    await normalizeLocalData();
    if (DEBUG) console.log('[sync] push-only todos');
    await pushLocalTodos(previousSyncAt, syncCutoff);
    if (DEBUG) console.log('[sync] push-only summaries');
    await pushLocalSummaries(previousSyncAt, syncCutoff);
    if (DEBUG) console.log('[sync] push-only recurrence rules');
    await overwriteRemoteRecurrenceRulesFromLocal();
    if (DEBUG) console.log('[sync] push-only timer timeline');
    await pushLocalTimerTimeline(previousSyncAt, syncCutoff);
    if (DEBUG) console.log('[sync] push-only work punch');
    await syncWorkPunchRecords();
    if (DEBUG) console.log('[sync] push-only todo queue state');
    await syncTodoQueueState();

    lastSyncAt = syncCutoff;
    await setMeta('lastSyncAt', lastSyncAt);
    setStatus('Idle', `last ${lastSyncAt}`);
  } catch (err) {
    if (DEBUG) console.log('[sync] push-only error', err);
    setStatus('Error');
  }
}

export async function pullNow() {
  if (!supabase) return;
  try {
    setStatus('Syncing', 'pull only');
    const updatedDates = await pullRemoteChanges();
    const dedupedAfterPull = await dedupeLocalTodosByNameAndStatus();
    const workPunchUpdatedDates = await syncWorkPunchRecords();
    const queueUpdatedDates = await syncTodoQueueState();
    dedupedAfterPull.forEach(date => updatedDates.add(date));
    workPunchUpdatedDates.forEach(date => updatedDates.add(date));
    queueUpdatedDates.forEach(date => updatedDates.add(date));
    lastSyncAt = new Date().toISOString();
    await setMeta('lastSyncAt', lastSyncAt);
    setStatus('Idle', `last ${lastSyncAt}`);
    updateHandler(updatedDates);
  } catch (err) {
    if (DEBUG) console.log('[sync] pull-only error', err);
    setStatus('Error');
  }
}

export async function syncAllLocalToCloud() {
  if (!supabase) return;
  try {
    setStatus('Syncing', 'full push');
    await normalizeLocalData();
    const fullSyncUpdatedAt = new Date().toISOString();
    if (DEBUG) console.log('[sync] dedupe local todos before full push');
    const dedupedBeforePush = await dedupeLocalTodosByNameAndStatus();
    const allTodos = await getAllTodos();
    const dedupedTodos = dedupeTodosForPush(allTodos);
    if (DEBUG) console.log('[sync] full todos to push', dedupedTodos.length);
    if (dedupedTodos.length) {
      const todoPayload = dedupedTodos.map(todo =>
        mapTodoToRemote({ ...todo, updatedAt: fullSyncUpdatedAt })
      );
      const { error: todoError } = await supabase
        .from('todos')
        .upsert(todoPayload, { onConflict: 'uuid' });
      if (todoError) throw todoError;
    }

    const allSummaries = await getAllSummaries();
    if (DEBUG) console.log('[sync] full summaries to push', allSummaries.length);
    if (allSummaries.length) {
      const summaryPayload = allSummaries.map(summary =>
        mapSummaryToRemote({ ...summary, updatedAt: fullSyncUpdatedAt })
      );
      const { error: summaryError } = await supabase
        .from('summaries')
        .upsert(summaryPayload, { onConflict: 'uuid' });
      if (summaryError) throw summaryError;
    }

    if (DEBUG) console.log('[sync] overwrite recurrence rules (local -> cloud)');
    await overwriteRemoteRecurrenceRulesFromLocal(fullSyncUpdatedAt);
    if (DEBUG) console.log('[sync] full push timer timeline');
    await pushLocalTimerTimeline('1970-01-01T00:00:00.000Z', fullSyncUpdatedAt, true);
    if (DEBUG) console.log('[sync] full push work punch');
    await syncWorkPunchRecords(true);
    if (DEBUG) console.log('[sync] full push todo queue state');
    await syncTodoQueueState(true);

    lastSyncAt = new Date().toISOString();
    await setMeta('lastSyncAt', lastSyncAt);
    setStatus('Idle', `last ${lastSyncAt}`);
    updateHandler(dedupedBeforePush);
  } catch (err) {
    if (DEBUG) console.log('[sync] full push error', err);
    setStatus('Error');
  }
}

export async function pushLocalTodos(afterIso = lastSyncAt, upToIso = null) {
  const todos = upToIso
    ? await getTodosUpdatedBetween(afterIso, upToIso)
    : await getTodosUpdatedAfter(afterIso);
  if (DEBUG) console.log('[sync] todos to push', todos.length);
  if (!todos.length) return;
  const dedupedTodos = dedupeTodosForPush(todos);
  if (DEBUG) console.log('[sync] todos to push after uuid dedupe', dedupedTodos.length);
  if (!dedupedTodos.length) return;
  const payload = dedupedTodos.map(mapTodoToRemote);
  const { error } = await supabase.from('todos').upsert(payload, { onConflict: 'uuid' });
  if (error) throw error;
}

export async function pushLocalSummaries(afterIso = lastSyncAt, upToIso = null) {
  const summaries = upToIso
    ? await getSummariesUpdatedBetween(afterIso, upToIso)
    : await getSummariesUpdatedAfter(afterIso);
  if (DEBUG) console.log('[sync] summaries to push', summaries.length);
  if (!summaries.length) return;
  if (summaries.length) {
    const payload = summaries.map(mapSummaryToRemote);
    const { error } = await supabase.from('summaries').upsert(payload, { onConflict: 'uuid' });
    if (error) throw error;
  }
}

export async function pushLocalRecurrenceRules(afterIso = lastSyncAt, upToIso = null) {
  const rules = upToIso
    ? await getRecurrenceRulesUpdatedBetween(afterIso, upToIso)
    : await getRecurrenceRulesUpdatedAfter(afterIso);
  if (DEBUG) console.log('[sync] recurrence rules to push', rules.length);
  if (!rules.length) return;
  const payload = rules.map(mapRecurrenceRuleToRemote);
  const { error } = await supabase
    .from('recurrence_rules')
    .upsert(payload, { onConflict: 'uuid' });
  if (error) {
    if (isMissingRecurrenceTable(error)) return;
    throw error;
  }
}

export async function pushLocalTimerTimeline(afterIso = lastSyncAt, upToIso = null, force = false) {
  const historyRecord = await getMeta(TIMER_TIMELINE_META_KEY);
  const activeRecord = await getMeta(TIMER_TIMELINE_ACTIVE_META_KEY);
  const historyUpdatedAtRecord = await getMeta(TIMER_TIMELINE_UPDATED_AT_META_KEY);
  const activeUpdatedAtRecord = await getMeta(TIMER_TIMELINE_ACTIVE_UPDATED_AT_META_KEY);
  const manualOpsRecord = await getMeta(TIMER_TIMELINE_MANUAL_OPS_KEY);

  const historyValue = historyRecord ? historyRecord.value : null;
  const activeValue = activeRecord ? activeRecord.value : null;
  const historyUpdatedAt = historyUpdatedAtRecord && typeof historyUpdatedAtRecord.value === 'string'
    ? historyUpdatedAtRecord.value
    : '';
  const activeUpdatedAt = activeUpdatedAtRecord && typeof activeUpdatedAtRecord.value === 'string'
    ? activeUpdatedAtRecord.value
    : '';
  const manualOps = normalizeTimerTimelineManualOps(
    manualOpsRecord ? manualOpsRecord.value : null
  );

  const hasHistory = historyValue && typeof historyValue === 'object';
  const hasActive = activeRecord && 'value' in activeRecord;

  const shouldPushHistory = force || (
    hasHistory && (
      !historyUpdatedAt ||
      (historyUpdatedAt > afterIso && (!upToIso || historyUpdatedAt <= upToIso))
    )
  );
  const shouldPushActive = force || (
    hasActive && (
      !activeUpdatedAt ||
      (activeUpdatedAt > afterIso && (!upToIso || activeUpdatedAt <= upToIso))
    )
  );

  if (!shouldPushHistory && !shouldPushActive) return;

  const pushAt = new Date().toISOString();
  const payload = [];
  if (shouldPushHistory) {
    const nextHistoryValue = await buildMergedTimerTimelineHistory(historyValue || {}, manualOps);
    payload.push({
      key: TIMER_TIMELINE_META_KEY,
      value: nextHistoryValue,
      updated_at: force && upToIso ? upToIso : pushAt
    });
  }
  if (shouldPushActive) {
    payload.push({
      key: TIMER_TIMELINE_ACTIVE_META_KEY,
      value: activeValue ?? null,
      updated_at: force && upToIso ? upToIso : pushAt
    });
  }

  const { error } = await supabase
    .from('timer_timeline')
    .upsert(payload, { onConflict: 'key' });
  if (error) {
    if (isMissingTable(error, 'timer_timeline')) return;
    throw error;
  }

  if (shouldPushHistory) {
    await setMeta(TIMER_TIMELINE_UPDATED_AT_META_KEY, pushAt);
    if (manualOps.editedIds.length || manualOps.deletedIds.length) {
      await setMeta(TIMER_TIMELINE_MANUAL_OPS_KEY, { editedIds: [], deletedIds: [] });
    }
  }
  if (shouldPushActive) {
    await setMeta(TIMER_TIMELINE_ACTIVE_UPDATED_AT_META_KEY, pushAt);
  }
}

export async function fetchRemoteKv(key) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('timer_timeline')
    .select('*')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error, 'timer_timeline')) return null;
    throw error;
  }
  return data || null;
}

export async function fetchRemoteKvsByPrefix(prefix) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('timer_timeline')
    .select('*')
    .like('key', `${prefix}%`)
    .order('updated_at', { ascending: true });
  if (error) {
    if (isMissingTable(error, 'timer_timeline')) return [];
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

export async function upsertRemoteKv(key, value, updatedAt = new Date().toISOString()) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('timer_timeline')
    .upsert([{ key, value, updated_at: updatedAt }], { onConflict: 'key' });
  if (error) {
    if (isMissingTable(error, 'timer_timeline')) return false;
    throw error;
  }
  return true;
}

export async function insertRemoteKvIfAbsent(key, value, updatedAt = new Date().toISOString()) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('timer_timeline')
    .insert([{ key, value, updated_at: updatedAt }]);
  if (!error) return true;
  const code = String(error.code || '');
  const message = String(error.message || '');
  if (code === '23505' || message.includes('duplicate key value violates unique constraint')) {
    return false;
  }
  if (isMissingTable(error, 'timer_timeline')) return false;
  throw error;
}

function normalizeWorkPunchRecords(value) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  Object.entries(source).forEach(([dateStr, record]) => {
    if (!dateStr || !record || typeof record !== 'object') return;
    const nextRecord = {};
    Object.entries(record).forEach(([slot, slotValue]) => {
      if (!slot) return;
      if (typeof slotValue === 'string' && slotValue) {
        nextRecord[slot] = { time: slotValue, updatedAt: '' };
        return;
      }
      if (!slotValue || typeof slotValue !== 'object') return;
      const time = typeof slotValue.time === 'string' ? slotValue.time : '';
      if (!time) return;
      nextRecord[slot] = {
        time,
        updatedAt: typeof slotValue.updatedAt === 'string' ? slotValue.updatedAt : ''
      };
    });
    if (Object.keys(nextRecord).length) result[dateStr] = nextRecord;
  });
  return result;
}

function mergeWorkPunchRecords(localRecords, remoteRecords) {
  const merged = {};
  const allDates = new Set([
    ...Object.keys(localRecords || {}),
    ...Object.keys(remoteRecords || {})
  ]);
  allDates.forEach(dateStr => {
    const localRecord = localRecords && localRecords[dateStr] ? localRecords[dateStr] : {};
    const remoteRecord = remoteRecords && remoteRecords[dateStr] ? remoteRecords[dateStr] : {};
    const slotResult = {};
    const allSlots = new Set([...Object.keys(localRecord), ...Object.keys(remoteRecord)]);
    allSlots.forEach(slot => {
      const localValue = localRecord[slot];
      const remoteValue = remoteRecord[slot];
      if (!localValue && remoteValue) {
        slotResult[slot] = remoteValue;
        return;
      }
      if (localValue && !remoteValue) {
        slotResult[slot] = localValue;
        return;
      }
      if (!localValue && !remoteValue) return;
      slotResult[slot] = (remoteValue.updatedAt || '') > (localValue.updatedAt || '')
        ? remoteValue
        : localValue;
    });
    if (Object.keys(slotResult).length) merged[dateStr] = slotResult;
  });
  return merged;
}

async function syncWorkPunchRecords(force = false) {
  const updatedDates = new Set();
  const localRecords = normalizeWorkPunchRecords(readLocalJson(WORK_PUNCH_LOCAL_KEY));
  const remoteRow = await fetchRemoteKv(WORK_PUNCH_REMOTE_KEY);
  const remoteRecords = normalizeWorkPunchRecords(remoteRow && remoteRow.value ? remoteRow.value.records : {});
  const mergedRecords = mergeWorkPunchRecords(localRecords, remoteRecords);
  const localSnapshot = JSON.stringify(localRecords);
  const remoteSnapshot = JSON.stringify(remoteRecords);
  const mergedSnapshot = JSON.stringify(mergedRecords);
  if (localSnapshot !== mergedSnapshot) {
    writeLocalJson(WORK_PUNCH_LOCAL_KEY, mergedRecords);
    Object.keys(mergedRecords).forEach(dateStr => updatedDates.add(dateStr));
  }
  const remoteUpdatedAt = remoteRow && remoteRow.updated_at ? remoteRow.updated_at : '';
  const newestLocalUpdatedAt = Object.values(mergedRecords)
    .flatMap(record => Object.values(record))
    .map(item => item.updatedAt || '')
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || new Date().toISOString();
  if (force || remoteSnapshot !== mergedSnapshot || remoteUpdatedAt < newestLocalUpdatedAt) {
    await upsertRemoteKv(WORK_PUNCH_REMOTE_KEY, { records: mergedRecords }, newestLocalUpdatedAt);
  }
  return updatedDates;
}

function buildTodoQueueStateMap(todos) {
  const result = {};
  todos.forEach(todo => {
    if (!todo || !todo.uuid) return;
    result[todo.uuid] = {
      queued: Boolean(todo.queued),
      queueOrder: Number.isFinite(todo.queueOrder) ? todo.queueOrder : null,
      sortOrder: Number.isFinite(todo.sortOrder) ? todo.sortOrder : null,
      updatedAt: todo.updatedAt || todo.createdAt || '',
      deletedAt: todo.deletedAt || null,
      completed: Boolean(todo.completed)
    };
  });
  return result;
}

function mergeTodoQueueState(localState, remoteState) {
  const merged = {};
  const allIds = new Set([
    ...Object.keys(localState || {}),
    ...Object.keys(remoteState || {})
  ]);
  allIds.forEach(uuid => {
    const localValue = localState && localState[uuid] ? localState[uuid] : null;
    const remoteValue = remoteState && remoteState[uuid] ? remoteState[uuid] : null;
    if (!localValue && remoteValue) {
      merged[uuid] = remoteValue;
      return;
    }
    if (localValue && !remoteValue) {
      merged[uuid] = localValue;
      return;
    }
    if (!localValue && !remoteValue) return;
    merged[uuid] = (remoteValue.updatedAt || '') > (localValue.updatedAt || '')
      ? remoteValue
      : localValue;
  });
  return merged;
}

async function syncTodoQueueState(force = false) {
  const updatedDates = new Set();
  const todos = await getAllTodos();
  const localState = buildTodoQueueStateMap(todos);
  const remoteRow = await fetchRemoteKv(TODO_QUEUE_STATE_REMOTE_KEY);
  const remoteState = remoteRow && remoteRow.value && typeof remoteRow.value.state === 'object'
    ? remoteRow.value.state
    : {};
  const mergedState = mergeTodoQueueState(localState, remoteState);

  const localByUuid = new Map(todos.filter(todo => todo && todo.uuid).map(todo => [todo.uuid, todo]));
  await Promise.all(
    Object.entries(mergedState).map(async ([uuid, state]) => {
      const localTodo = localByUuid.get(uuid);
      if (!localTodo) return;
      if ((state.updatedAt || '') <= (localTodo.updatedAt || '')) return;
      const nextTodo = {
        ...localTodo,
        queued: Boolean(state.queued),
        queueOrder: state.queueOrder ?? null,
        sortOrder: state.sortOrder ?? null,
        updatedAt: state.updatedAt || localTodo.updatedAt
      };
      if (
        Boolean(localTodo.queued) === Boolean(nextTodo.queued) &&
        (localTodo.queueOrder ?? null) === (nextTodo.queueOrder ?? null) &&
        (localTodo.sortOrder ?? null) === (nextTodo.sortOrder ?? null)
      ) {
        return;
      }
      await updateTodo(nextTodo);
      if (nextTodo.date) updatedDates.add(nextTodo.date);
    })
  );

  const mergedSnapshot = JSON.stringify(mergedState);
  const remoteSnapshot = JSON.stringify(remoteState || {});
  const newestUpdatedAt = Object.values(mergedState)
    .map(item => item && item.updatedAt ? item.updatedAt : '')
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || new Date().toISOString();
  if (force || mergedSnapshot !== remoteSnapshot || (remoteRow && remoteRow.updated_at ? remoteRow.updated_at : '') < newestUpdatedAt) {
    await upsertRemoteKv(TODO_QUEUE_STATE_REMOTE_KEY, { state: mergedState }, newestUpdatedAt);
  }
  return updatedDates;
}

function normalizeTimerTimelineManualOps(value) {
  const next = value && typeof value === 'object' ? value : {};
  return {
    editedIds: Array.isArray(next.editedIds) ? next.editedIds.filter(Boolean) : [],
    deletedIds: Array.isArray(next.deletedIds) ? next.deletedIds.filter(Boolean) : []
  };
}

async function buildMergedTimerTimelineHistory(localHistory, manualOps) {
  const remoteHistory = await getRemoteTimerTimelineHistory();
  if (!remoteHistory) return localHistory;

  const editedIdSet = new Set(manualOps && manualOps.editedIds ? manualOps.editedIds : []);
  const deletedIdSet = new Set(manualOps && manualOps.deletedIds ? manualOps.deletedIds : []);
  const remoteById = new Map();
  const localById = new Map();

  for (const segments of Object.values(remoteHistory)) {
    for (const segment of Array.isArray(segments) ? segments : []) {
      if (!segment || !segment.id) continue;
      remoteById.set(segment.id, segment);
    }
  }

  for (const segments of Object.values(localHistory || {})) {
    for (const segment of Array.isArray(segments) ? segments : []) {
      if (!segment || !segment.id) continue;
      localById.set(segment.id, segment);
    }
  }

  const mergedById = new Map();

  for (const [segmentId, remoteSegment] of remoteById.entries()) {
    if (deletedIdSet.has(segmentId)) continue;
    if (editedIdSet.has(segmentId) && localById.has(segmentId)) {
      mergedById.set(segmentId, localById.get(segmentId));
      continue;
    }
    mergedById.set(segmentId, remoteSegment);
  }

  for (const [segmentId, localSegment] of localById.entries()) {
    if (deletedIdSet.has(segmentId)) continue;
    if (!remoteById.has(segmentId)) {
      mergedById.set(segmentId, localSegment);
      continue;
    }
    if (editedIdSet.has(segmentId)) {
      mergedById.set(segmentId, localSegment);
    }
  }

  const groupedByDate = new Map();
  for (const segment of mergedById.values()) {
    if (!segment || !segment.date) continue;
    if (!groupedByDate.has(segment.date)) groupedByDate.set(segment.date, []);
    groupedByDate.get(segment.date).push(segment);
  }

  return Object.fromEntries(
    Array.from(groupedByDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateStr, segments]) => [
        dateStr,
        segments.sort(compareTimerTimelineSegment)
      ])
  );
}

async function getRemoteTimerTimelineHistory() {
  const { data, error } = await supabase
    .from('timer_timeline')
    .select('value')
    .eq('key', TIMER_TIMELINE_META_KEY)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error, 'timer_timeline')) return null;
    throw error;
  }
  return data && data.value && typeof data.value === 'object'
    ? data.value
    : null;
}

function compareTimerTimelineSegment(a, b) {
  const aSequence = Number.isFinite(a && a.sequence) ? a.sequence : Number.MAX_SAFE_INTEGER;
  const bSequence = Number.isFinite(b && b.sequence) ? b.sequence : Number.MAX_SAFE_INTEGER;
  if (aSequence !== bSequence) return aSequence - bSequence;
  const aStartAt = Number.isFinite(a && a.startAt) ? a.startAt : 0;
  const bStartAt = Number.isFinite(b && b.startAt) ? b.startAt : 0;
  if (aStartAt !== bStartAt) return aStartAt - bStartAt;
  return String(a && a.id ? a.id : '').localeCompare(String(b && b.id ? b.id : ''));
}

async function overwriteRemoteRecurrenceRulesFromLocal(forcedUpdatedAt = null) {
  await normalizeLocalData();
  const localRules = await getAllRecurrenceRules();
  const localUuids = localRules
    .map(rule => rule && rule.uuid)
    .filter(Boolean);

  if (DEBUG) console.log('[sync] local recurrence rules', localRules.length);
  if (localRules.length) {
    const payload = localRules.map(rule =>
      mapRecurrenceRuleToRemote(
        forcedUpdatedAt ? { ...rule, updatedAt: forcedUpdatedAt } : rule
      )
    );
    const { error: upsertError } = await supabase
      .from('recurrence_rules')
      .upsert(payload, { onConflict: 'uuid' });
    if (upsertError) {
      if (isMissingRecurrenceTable(upsertError)) return;
      throw upsertError;
    }
  }

  const { data: remoteRows, error: remoteListError } = await supabase
    .from('recurrence_rules')
    .select('uuid');
  if (remoteListError) {
    if (isMissingRecurrenceTable(remoteListError)) return;
    throw remoteListError;
  }

  const localUuidSet = new Set(localUuids);
  const remoteOnlyUuids = (remoteRows || [])
    .map(row => row && row.uuid)
    .filter(uuid => uuid && !localUuidSet.has(uuid));

  if (!remoteOnlyUuids.length) return;
  if (DEBUG) console.log('[sync] delete remote-only recurrence rules', remoteOnlyUuids.length);

  const CHUNK_SIZE = 200;
  for (let i = 0; i < remoteOnlyUuids.length; i += CHUNK_SIZE) {
    const chunk = remoteOnlyUuids.slice(i, i + CHUNK_SIZE);
    const { error: deleteError } = await supabase
      .from('recurrence_rules')
      .delete()
      .in('uuid', chunk);
    if (deleteError) {
      if (isMissingRecurrenceTable(deleteError)) return;
      throw deleteError;
    }
  }
}

async function syncDeletedRuleTodos(ruleId, updatedDates) {
  if (ruleId == null) return;
  const today = getTodayDateStr();
  const relatedTodos = await getTodosByRuleId(ruleId);
  const now = new Date().toISOString();

  for (const todo of relatedTodos) {
    if (!todo || todo.deletedAt) continue;
    if (!todo.date || todo.date <= today) continue;
    await updateTodo({
      ...todo,
      deletedAt: now,
      updatedAt: now
    });
    if (updatedDates && todo.date) {
      updatedDates.add(todo.date);
    }
  }
}

export async function pullRemoteChanges() {
  const updatedDates = new Set();
  const localTodos = await getAllTodos();
  const localByUuid = new Map();
  const localByFingerprint = new Map();

  for (const todo of localTodos) {
    if (todo && todo.uuid) {
      const existing = localByUuid.get(todo.uuid);
      if (!existing || (todo.updatedAt || '') > (existing.updatedAt || '')) {
        localByUuid.set(todo.uuid, todo);
      }
    }
    if (todo) {
      const key = getTodoFingerprint(todo);
      const existingByKey = localByFingerprint.get(key);
      if (!existingByKey || (todo.updatedAt || '') > (existingByKey.updatedAt || '')) {
        localByFingerprint.set(key, todo);
      }
    }
  }

  const todoRows = await fetchAllRows('todos');
  if (DEBUG) console.log('[sync] pull todos', todoRows ? todoRows.length : 0);
  if (Array.isArray(todoRows)) {
    for (const row of todoRows) {
      const remote = mapTodoFromRemote(row);
      const byUuid = remote.uuid ? localByUuid.get(remote.uuid) : null;
      const byFingerprint = localByFingerprint.get(getTodoFingerprint(remote)) || null;
      const local = byUuid || byFingerprint;

      if (!local) {
        await addTodo(remote);
        if (remote.uuid) localByUuid.set(remote.uuid, remote);
        localByFingerprint.set(getTodoFingerprint(remote), remote);
        updatedDates.add(remote.date);
        continue;
      }

      const merged = mergeTodoForPull(local, remote);
      if (shouldUpdateTodo(local, merged)) {
        await updateTodo({ ...local, ...merged, id: local.id });
        if (merged.uuid) localByUuid.set(merged.uuid, { ...local, ...merged });
        localByFingerprint.set(getTodoFingerprint(merged), { ...local, ...merged });
        updatedDates.add(remote.date);
      }
    }
  }

  const summaryRows = await fetchAllRows('summaries');
  if (DEBUG) console.log('[sync] pull summaries', summaryRows ? summaryRows.length : 0);
  if (Array.isArray(summaryRows)) {
    for (const row of summaryRows) {
      const remote = mapSummaryFromRemote(row);
      const local = await getSummaryByUuid(remote.uuid);
      if (!local) {
        await addSummary(remote);
        updatedDates.add(remote.date);
        continue;
      }
      if ((remote.updatedAt || '') > (local.updatedAt || '')) {
        await updateSummary({ ...local, ...remote, id: local.id });
        updatedDates.add(remote.date);
      }
    }
  }

  const { data: ruleRows, error: rulePullError } = await fetchAllRowsWithError('recurrence_rules');
  if (rulePullError) {
    if (!isMissingRecurrenceTable(rulePullError)) throw rulePullError;
  } else if (Array.isArray(ruleRows)) {
    if (DEBUG) console.log('[sync] pull recurrence rules', ruleRows.length);
    for (const row of ruleRows) {
      const remote = mapRecurrenceRuleFromRemote(row);
      const local = await getRecurrenceRuleByUuid(remote.uuid);
      if (!local) {
        const id = await addRecurrenceRule(remote);
        if (remote.deletedAt) {
          await syncDeletedRuleTodos(id, updatedDates);
        }
        continue;
      }
      if ((remote.updatedAt || '') > (local.updatedAt || '')) {
        await updateRecurrenceRule({ ...local, ...remote, id: local.id });
        if (remote.deletedAt) {
          await syncDeletedRuleTodos(local.id, updatedDates);
        }
      }
    }
  }

  const { data: timerRows, error: timerPullError } = await fetchAllRowsWithError('timer_timeline');
  if (timerPullError) {
    if (!isMissingTable(timerPullError, 'timer_timeline')) throw timerPullError;
  } else if (Array.isArray(timerRows)) {
    if (DEBUG) console.log('[sync] pull timer timeline', timerRows.length);
    await applyRemoteTimerTimeline(timerRows, updatedDates);
  }

  return updatedDates;
}

async function applyRemoteTimerTimeline(rows, updatedDates) {
  const byKey = new Map();
  for (const row of rows) {
    if (row && row.key) byKey.set(row.key, row);
  }

  const historyRow = byKey.get(TIMER_TIMELINE_META_KEY) || null;
  const activeRow = byKey.get(TIMER_TIMELINE_ACTIVE_META_KEY) || null;

  if (historyRow) {
    const localUpdatedAtRecord = await getMeta(TIMER_TIMELINE_UPDATED_AT_META_KEY);
    const localUpdatedAt = localUpdatedAtRecord && typeof localUpdatedAtRecord.value === 'string'
      ? localUpdatedAtRecord.value
      : '';
    const remoteUpdatedAt = historyRow.updated_at || '';
    if (remoteUpdatedAt > localUpdatedAt) {
      const historyValue = historyRow.value && typeof historyRow.value === 'object'
        ? historyRow.value
        : {};
      await setMeta(TIMER_TIMELINE_META_KEY, historyValue);
      await setMeta(TIMER_TIMELINE_UPDATED_AT_META_KEY, remoteUpdatedAt || new Date().toISOString());
      writeLocalJson(TIMER_TIMELINE_LOCAL_KEY, historyValue);
      Object.keys(historyValue).forEach(date => {
        if (date) updatedDates.add(date);
      });
    }
  }

  if (activeRow) {
    const localUpdatedAtRecord = await getMeta(TIMER_TIMELINE_ACTIVE_UPDATED_AT_META_KEY);
    const localUpdatedAt = localUpdatedAtRecord && typeof localUpdatedAtRecord.value === 'string'
      ? localUpdatedAtRecord.value
      : '';
    const remoteUpdatedAt = activeRow.updated_at || '';
    if (remoteUpdatedAt > localUpdatedAt) {
      const activeValue = activeRow.value ?? null;
      await setMeta(TIMER_TIMELINE_ACTIVE_META_KEY, activeValue);
      await setMeta(TIMER_TIMELINE_ACTIVE_UPDATED_AT_META_KEY, remoteUpdatedAt || new Date().toISOString());
      writeLocalJson(TIMER_TIMELINE_ACTIVE_LOCAL_KEY, activeValue);
      if (activeValue && activeValue.date) {
        updatedDates.add(activeValue.date);
      }
    }
  }
}

async function fetchAllRows(table) {
  const { data, error } = await fetchAllRowsWithError(table);
  if (error) throw error;
  return data;
}

async function fetchAllRowsWithError(table) {
  const PAGE_SIZE = 1000;
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('updated_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    if (!Array.isArray(data) || !data.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { data: rows, error: null };
}

function getTodoFingerprint(todo) {
  const date = todo && todo.date ? todo.date : '';
  const text = todo && typeof todo.text === 'string' ? todo.text.trim() : '';
  const createdAt = todo && todo.createdAt ? todo.createdAt : '';
  return `${date}__${text}__${createdAt}`;
}

function mergeTodoForPull(local, remote) {
  const localUpdatedAt = local.updatedAt || '';
  const remoteUpdatedAt = remote.updatedAt || '';
  const remoteNewer = remoteUpdatedAt > localUpdatedAt;
  const winner = remoteNewer ? remote : local;
  const merged = {
    ...winner,
    id: local.id,
    uuid: local.uuid || remote.uuid
  };

  // 远端表当前不承载这些本地字段，拉取合并时保留本地值，避免被“覆盖为空”
  if (merged.recurrenceRuleId == null && local.recurrenceRuleId != null) {
    merged.recurrenceRuleId = local.recurrenceRuleId;
  }
  if (merged.dueMinutes == null && local.dueMinutes != null) {
    merged.dueMinutes = local.dueMinutes;
  }
  if (merged.carriedFrom == null && local.carriedFrom != null) {
    merged.carriedFrom = local.carriedFrom;
  }
  if (merged.sortOrder == null && local.sortOrder != null) {
    merged.sortOrder = local.sortOrder;
  }
  if (merged.queued == null && local.queued != null) {
    merged.queued = local.queued;
  }
  if (merged.queueOrder == null && local.queueOrder != null) {
    merged.queueOrder = local.queueOrder;
  }
  if (!merged.userId && local.userId) {
    merged.userId = local.userId;
  }

  // 冲突时“已完成”优先于“未完成”
  const completedMerged = Boolean(local.completed) || Boolean(remote.completed);
  if (merged.completed !== completedMerged) {
    merged.completed = completedMerged;
    merged.updatedAt = new Date().toISOString();
  }

  return merged;
}

function shouldUpdateTodo(local, next) {
  return (
    local.uuid !== next.uuid ||
    local.date !== next.date ||
    local.text !== next.text ||
    Boolean(local.completed) !== Boolean(next.completed) ||
    (local.recurrenceRuleId ?? null) !== (next.recurrenceRuleId ?? null) ||
    (local.dueMinutes ?? null) !== (next.dueMinutes ?? null) ||
    (local.carriedFrom ?? null) !== (next.carriedFrom ?? null) ||
    Boolean(local.queued) !== Boolean(next.queued) ||
    (local.queueOrder ?? null) !== (next.queueOrder ?? null) ||
    (local.sortOrder ?? null) !== (next.sortOrder ?? null) ||
    (local.userId ?? null) !== (next.userId ?? null) ||
    (local.createdAt || '') !== (next.createdAt || '') ||
    (local.updatedAt || '') !== (next.updatedAt || '') ||
    (local.deletedAt || null) !== (next.deletedAt || null)
  );
}

async function dedupeLocalTodosByNameAndStatus() {
  const todos = await getAllTodos();
  const groups = new Map();
  const updatedDates = new Set();
  const now = new Date().toISOString();
  const activeTodos = todos.filter(
    todo =>
      todo &&
      !todo.deletedAt &&
      todo.date &&
      typeof todo.text === 'string' &&
      todo.text.trim()
  );

  for (const todo of activeTodos) {
    const key = getDedupeKey(todo);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(todo);
  }

  const duplicates = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(compareTodoForNameConflict);
    duplicates.push(...group.slice(1));
  }

  // 自动去重需要保留，但必须避免异常数据触发大面积软删除。
  if (shouldSkipAutoDedupe(duplicates.length, activeTodos.length)) {
    if (DEBUG) {
      console.warn('[sync] skip auto dedupe due to safety limit', {
        duplicateCount: duplicates.length,
        activeCount: activeTodos.length
      });
    }
    setStatus('Sync warning', 'skip bulk dedupe');
    return updatedDates;
  }

  for (const duplicate of duplicates) {
    await updateTodo({
      ...duplicate,
      deletedAt: now,
      updatedAt: now
    });
    if (duplicate.date) updatedDates.add(duplicate.date);
  }

  return updatedDates;
}

function getDedupeKey(todo) {
  const date = todo && todo.date ? todo.date : '';
  const name = todo && typeof todo.text === 'string' ? todo.text.trim() : '';
  return `${date}__${name}`;
}

function shouldSkipAutoDedupe(duplicateCount, activeCount) {
  if (!duplicateCount || !activeCount) return false;
  return (
    duplicateCount > MAX_AUTO_DEDUPE_DELETE_COUNT ||
    duplicateCount / activeCount > MAX_AUTO_DEDUPE_DELETE_RATIO
  );
}

function compareTodoForNameConflict(a, b) {
  const aCompleted = Boolean(a && a.completed);
  const bCompleted = Boolean(b && b.completed);
  if (aCompleted !== bCompleted) return aCompleted ? -1 : 1;
  return compareTodoForDedupe(a, b);
}

function compareTodoForDedupe(a, b) {
  const aUpdated = a.updatedAt || a.createdAt || '';
  const bUpdated = b.updatedAt || b.createdAt || '';
  if (aUpdated !== bUpdated) return bUpdated.localeCompare(aUpdated);
  const aCreated = a.createdAt || '';
  const bCreated = b.createdAt || '';
  if (aCreated !== bCreated) return bCreated.localeCompare(aCreated);
  return (b.id || 0) - (a.id || 0);
}

function dedupeTodosForPush(todos) {
  const byUuid = new Map();
  const withoutUuid = [];

  for (const todo of todos) {
    if (!todo || !todo.uuid) {
      if (todo) withoutUuid.push(todo);
      continue;
    }
    const existing = byUuid.get(todo.uuid);
    if (!existing || compareTodoForDedupe(todo, existing) < 0) {
      byUuid.set(todo.uuid, todo);
    }
  }

  return [...byUuid.values(), ...withoutUuid];
}

function isMissingRecurrenceTable(error) {
  return isMissingTable(error, 'recurrence_rules');
}

function isMissingTable(error, tableName) {
  const text = String(
    (error && error.message) ||
    (error && error.details) ||
    (error && error.hint) ||
    ''
  );
  return text.includes(tableName) && text.includes('does not exist');
}
async function getSupabase() {
  if (supabase) return supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    if (!createClientFn) {
      const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      createClientFn = mod.createClient;
      if (DEBUG) console.log('[sync] sdk loaded');
    }
    supabase = createClientFn(SUPABASE_URL, SUPABASE_ANON_KEY);
    if (DEBUG) console.log('[sync] client created', SUPABASE_URL);
    return supabase;
  } catch (err) {
    if (DEBUG) console.log('[sync] sdk load failed', err);
    return null;
  }
}
