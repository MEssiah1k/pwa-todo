import {
  getMeta,
  setMeta,
  getAllTodos,
  getAllSummaries,
  getTodosUpdatedAfter,
  getSummariesUpdatedAfter,
  getTodoByUuid,
  getSummaryByUuid,
  addTodo,
  updateTodo,
  addSummary,
  updateSummary
} from './db.js';

const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

let supabase = null;
let createClientFn = null;
let userId = null;
let lastSyncAt = '1970-01-01T00:00:00.000Z';
let statusHandler = () => {};
let updateHandler = () => {};

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
}

function mapTodoToRemote(todo) {
  return {
    uuid: todo.uuid,
    user_id: todo.userId,
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
    user_id: summary.userId,
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
    userId: row.user_id,
    date: row.date,
    text: row.text,
    completed: row.completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null
  };
}

function mapSummaryFromRemote(row) {
  return {
    uuid: row.uuid,
    userId: row.user_id,
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
        userId: todo.userId || userId,
        updatedAt: todo.updatedAt || todo.createdAt || now,
        deletedAt: todo.deletedAt ?? null
      };
      if (
        next.uuid !== todo.uuid ||
        next.userId !== todo.userId ||
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
        userId: summary.userId || userId,
        updatedAt: summary.updatedAt || summary.createdAt || now,
        deletedAt: summary.deletedAt ?? null
      };
      if (
        next.uuid !== summary.uuid ||
        next.userId !== summary.userId ||
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

  const userRecord = await getMeta('userId');
  userId = userRecord && userRecord.value ? userRecord.value : generateUUID();
  await setMeta('userId', userId);

  const syncRecord = await getMeta('lastSyncAt');
  if (syncRecord && syncRecord.value) lastSyncAt = syncRecord.value;

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
  return { userId };
}

export async function syncNow() {
  if (!supabase) return;
  try {
    setStatus('Syncing');
    await pushLocalChanges();
    const updatedDates = await pullRemoteChanges();
    lastSyncAt = new Date().toISOString();
    await setMeta('lastSyncAt', lastSyncAt);
    setStatus('Idle', `last ${lastSyncAt}`);
    if (updatedDates.size) updateHandler(updatedDates);
  } catch (err) {
    setStatus('Error');
  }
}

export async function pushLocalChanges() {
  const todos = await getTodosUpdatedAfter(lastSyncAt);
  const summaries = await getSummariesUpdatedAfter(lastSyncAt);
  if (todos.length) {
    const payload = todos.map(mapTodoToRemote);
    await supabase.from('todos').upsert(payload, { onConflict: 'uuid' });
  }
  if (summaries.length) {
    const payload = summaries.map(mapSummaryToRemote);
    await supabase.from('summaries').upsert(payload, { onConflict: 'uuid' });
  }
}

export async function pullRemoteChanges() {
  const updatedDates = new Set();
  const { data: todoRows } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', lastSyncAt);
  if (Array.isArray(todoRows)) {
    for (const row of todoRows) {
      const remote = mapTodoFromRemote(row);
      const local = await getTodoByUuid(remote.uuid);
      if (!local) {
        await addTodo(remote);
        updatedDates.add(remote.date);
        continue;
      }
      if ((remote.updatedAt || '') > (local.updatedAt || '')) {
        await updateTodo({ ...local, ...remote, id: local.id });
        updatedDates.add(remote.date);
      }
    }
  }

  const { data: summaryRows } = await supabase
    .from('summaries')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', lastSyncAt);
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
async function getSupabase() {
  if (supabase) return supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    if (!createClientFn) {
      const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      createClientFn = mod.createClient;
    }
    supabase = createClientFn(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  } catch (err) {
    return null;
  }
}
