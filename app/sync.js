import {
  getMeta,
  setMeta,
  getAllTodos,
  getAllSummaries,
  getTodosUpdatedAfter,
  getSummariesUpdatedAfter,
  getSummaryByUuid,
  addTodo,
  updateTodo,
  addSummary,
  updateSummary
} from './db.js';

const SUPABASE_URL = 'https://wjyqimuecbairlbdfetr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqeXFpbXVlY2JhaXJsYmRmZXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDU4MDcsImV4cCI6MjA4NjIyMTgwN30.il1pkrnEjHUnnvWR7PCh10VeSWrC18fv596vSCLQOpE';

let supabase = null;
let createClientFn = null;
let userId = null;
let lastSyncAt = '1970-01-01T00:00:00.000Z';
let statusHandler = () => {};
let updateHandler = () => {};
const DEBUG = true;

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
    setStatus('Syncing');
    if (DEBUG) console.log('[sync] push todos');
    await pushLocalTodos();
    if (DEBUG) console.log('[sync] push summaries');
    await pushLocalSummaries();
    if (DEBUG) console.log('[sync] pull');
    const updatedDates = await pullRemoteChanges();
    lastSyncAt = new Date().toISOString();
    await setMeta('lastSyncAt', lastSyncAt);
    setStatus('Idle', `last ${lastSyncAt}`);
    if (updatedDates.size) updateHandler(updatedDates);
  } catch (err) {
    if (DEBUG) console.log('[sync] error', err);
    setStatus('Error');
  }
}

export async function pushLocalTodos() {
  const todos = await getTodosUpdatedAfter(lastSyncAt);
  if (DEBUG) console.log('[sync] todos to push', todos.length);
  if (!todos.length) return;
  if (todos.length) {
    const payload = todos.map(mapTodoToRemote);
    const { error } = await supabase.from('todos').upsert(payload, { onConflict: 'uuid' });
    if (error) throw error;
  }
}

export async function pushLocalSummaries() {
  const summaries = await getSummariesUpdatedAfter(lastSyncAt);
  if (DEBUG) console.log('[sync] summaries to push', summaries.length);
  if (!summaries.length) return;
  if (summaries.length) {
    const payload = summaries.map(mapSummaryToRemote);
    const { error } = await supabase.from('summaries').upsert(payload, { onConflict: 'uuid' });
    if (error) throw error;
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

  const { data: todoRows } = await supabase
    .from('todos')
    .select('*')
    .gt('updated_at', lastSyncAt);
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

  const { data: summaryRows } = await supabase
    .from('summaries')
    .select('*')
    .gt('updated_at', lastSyncAt);
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
  return updatedDates;
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
    (local.createdAt || '') !== (next.createdAt || '') ||
    (local.updatedAt || '') !== (next.updatedAt || '') ||
    (local.deletedAt || null) !== (next.deletedAt || null)
  );
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
