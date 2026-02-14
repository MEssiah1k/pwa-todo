const DB_NAME = 'todo-db';
const STORE_NAME = 'todos';
const DB_VERSION = 7;
const SUMMARY_STORE = 'summaries';
const META_STORE = 'meta';
const RECURRENCE_STORE = 'recurrence_rules';

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const todoStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
        todoStore.createIndex('date', 'date', { unique: false });
        todoStore.createIndex('recurrenceRuleId', 'recurrenceRuleId', { unique: false });
        todoStore.createIndex('uuid', 'uuid', { unique: false });
        todoStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      } else {
        const todoStore = request.transaction.objectStore(STORE_NAME);
        if (!todoStore.indexNames.contains('date')) {
          todoStore.createIndex('date', 'date', { unique: false });
        }
        if (!todoStore.indexNames.contains('recurrenceRuleId')) {
          todoStore.createIndex('recurrenceRuleId', 'recurrenceRuleId', { unique: false });
        }
        if (!todoStore.indexNames.contains('uuid')) {
          todoStore.createIndex('uuid', 'uuid', { unique: false });
        }
        if (!todoStore.indexNames.contains('updatedAt')) {
          todoStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      }

      if (!db.objectStoreNames.contains(SUMMARY_STORE)) {
        const summaryStore = db.createObjectStore(SUMMARY_STORE, {
          keyPath: 'id',
          autoIncrement: true
        });
        summaryStore.createIndex('date', 'date', { unique: false });
        summaryStore.createIndex('uuid', 'uuid', { unique: false });
        summaryStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      } else {
        const summaryStore = request.transaction.objectStore(SUMMARY_STORE);
        if (!summaryStore.indexNames.contains('date')) {
          summaryStore.createIndex('date', 'date', { unique: false });
        }
        if (!summaryStore.indexNames.contains('uuid')) {
          summaryStore.createIndex('uuid', 'uuid', { unique: false });
        }
        if (!summaryStore.indexNames.contains('updatedAt')) {
          summaryStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(RECURRENCE_STORE)) {
        const recurrenceStore = db.createObjectStore(RECURRENCE_STORE, {
          keyPath: 'id',
          autoIncrement: true
        });
        recurrenceStore.createIndex('uuid', 'uuid', { unique: false });
        recurrenceStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      } else {
        const recurrenceStore = request.transaction.objectStore(RECURRENCE_STORE);
        if (!recurrenceStore.indexNames.contains('uuid')) {
          recurrenceStore.createIndex('uuid', 'uuid', { unique: false });
        }
        if (!recurrenceStore.indexNames.contains('updatedAt')) {
          recurrenceStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllTodos() {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });
}

export async function getAllSummaries() {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(SUMMARY_STORE, 'readonly');
    const store = tx.objectStore(SUMMARY_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });
}

export async function getTodosByDate(date) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('date');
    const req = index.getAll(date);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function getTodosUpdatedAfter(iso) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () =>
      resolve(req.result.filter(todo => (todo.updatedAt || '') > iso));
  });
}

export async function getSummariesUpdatedAfter(iso) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(SUMMARY_STORE, 'readonly');
    const store = tx.objectStore(SUMMARY_STORE);
    const req = store.getAll();
    req.onsuccess = () =>
      resolve(req.result.filter(summary => (summary.updatedAt || '') > iso));
  });
}

export async function getTodosByRuleId(ruleId) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('recurrenceRuleId');
    const req = index.getAll(ruleId);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function getTodoByUuid(uuid) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('uuid');
    const req = index.get(uuid);
    req.onsuccess = () => resolve(req.result || null);
  });
}

export async function getSummaryByUuid(uuid) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(SUMMARY_STORE, 'readonly');
    const store = tx.objectStore(SUMMARY_STORE);
    const index = store.index('uuid');
    const req = index.get(uuid);
    req.onsuccess = () => resolve(req.result || null);
  });
}

export async function addTodo(todo) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(todo);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateTodo(todo) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(todo);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getTodoById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTodo(id) {
  const todo = await getTodoById(id);
  if (!todo) return false;
  return updateTodo({
    ...todo,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function getSummariesByDate(date) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(SUMMARY_STORE, 'readonly');
    const store = tx.objectStore(SUMMARY_STORE);
    const index = store.index('date');
    const req = index.getAll(date);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function addSummary(summary) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUMMARY_STORE, 'readwrite');
    const store = tx.objectStore(SUMMARY_STORE);
    const req = store.add(summary);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateSummary(summary) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUMMARY_STORE, 'readwrite');
    const store = tx.objectStore(SUMMARY_STORE);
    const req = store.put(summary);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSummary(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUMMARY_STORE, 'readwrite');
    const store = tx.objectStore(SUMMARY_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getSummaryById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUMMARY_STORE, 'readonly');
    const store = tx.objectStore(SUMMARY_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getMeta(key) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
  });
}

export async function setMeta(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const req = store.put({ key, value });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllRecurrenceRules() {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(RECURRENCE_STORE, 'readonly');
    const store = tx.objectStore(RECURRENCE_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });
}

export async function getRecurrenceRulesUpdatedAfter(iso) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(RECURRENCE_STORE, 'readonly');
    const store = tx.objectStore(RECURRENCE_STORE);
    const req = store.getAll();
    req.onsuccess = () =>
      resolve(req.result.filter(rule => (rule.updatedAt || '') > iso));
  });
}

export async function getRecurrenceRuleByUuid(uuid) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(RECURRENCE_STORE, 'readonly');
    const store = tx.objectStore(RECURRENCE_STORE);
    const index = store.index('uuid');
    const req = index.get(uuid);
    req.onsuccess = () => resolve(req.result || null);
  });
}

export async function getRecurrenceRuleById(id) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(RECURRENCE_STORE, 'readonly');
    const store = tx.objectStore(RECURRENCE_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
  });
}

export async function addRecurrenceRule(rule) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECURRENCE_STORE, 'readwrite');
    const store = tx.objectStore(RECURRENCE_STORE);
    const req = store.add(rule);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateRecurrenceRule(rule) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECURRENCE_STORE, 'readwrite');
    const store = tx.objectStore(RECURRENCE_STORE);
    const req = store.put(rule);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRecurrenceRule(id) {
  const rule = await getRecurrenceRuleById(id);
  if (!rule) return false;
  return updateRecurrenceRule({
    ...rule,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}
