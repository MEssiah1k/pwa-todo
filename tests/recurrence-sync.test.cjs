const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Run the real sync implementation with in-memory IndexedDB/Supabase adapters.
const source = fs.readFileSync(path.join(__dirname, '../app/sync.js'), 'utf8')
  .replace(/^import\s*\{[\s\S]*?\}\s*from\s*'[^']+';\s*/gm, '')
  .replace(/\bexport\s+/g, '');
const createdAt = '2026-01-01T00:00:00.000Z';
const deletedAt = '2026-02-01T00:00:00.000Z';
const newer = '2026-03-01T00:00:00.000Z';
const rule = (overrides = {}) => ({
  id: 1, uuid: 'rule-1', text: 'Daily task', type: 'daily',
  createdAt, updatedAt: createdAt, deletedAt: null, ...overrides
});

function harness(initial, remoteInitial = [], todos = []) {
  const local = structuredClone(initial);
  const remote = structuredClone(remoteInitial);
  const uploads = [];
  let readError = null;
  const context = vm.createContext({
    console: { log() {}, warn() {} }, crypto: require('node:crypto').webcrypto,
    createScopedStorageKey: key => key, migrateLegacyLocalStorageKeys() {},
    getAllRecurrenceRules: async () => structuredClone(local),
    getRecurrenceRuleByUuid: async uuid => structuredClone(local.find(r => r.uuid === uuid)),
    addRecurrenceRule: async value => {
      const id = Math.max(0, ...local.map(r => r.id)) + 1;
      local.push({ ...value, id });
      return id;
    },
    updateRecurrenceRule: async value => { local[local.findIndex(r => r.id === value.id)] = { ...value }; },
    getAllTodos: async () => structuredClone(todos), getAllSummaries: async () => [],
    getTodosByRuleId: async id => structuredClone(todos.filter(t => t.recurrenceRuleId === id)),
    updateTodo: async value => { todos[todos.findIndex(t => t.id === value.id)] = value; },
    client: {
      from(table) {
        assert.equal(table, 'recurrence_rules');
        return {
          select() { return this; }, order() { return this; },
          async range(start, end) { return { data: structuredClone(remote.slice(start, end + 1)), error: readError }; },
          async upsert(rows) {
            assert.equal(new Set(rows.map(row => row.uuid)).size, rows.length,
              'one upsert batch must contain each UUID only once');
            uploads.push(structuredClone(rows));
            for (const row of rows) {
              const index = remote.findIndex(r => r.uuid === row.uuid);
              if (index < 0) remote.push({ ...row });
              else remote[index] = { ...row };
            }
            return { error: null };
          }
        };
      }
    }
  });
  vm.runInContext(source + '\nsupabase = client;', context);
  return {
    local, remote, uploads,
    row: value => context.mapRecurrenceRuleToRemote(value),
    pull: () => context.pullRemoteRecurrenceRules(new Set()),
    sync: () => context.syncRecurrenceRulesWithCloud(),
    dedupe: () => context.dedupeLocalRecurrenceRules(),
    failRead: () => { readError = { message: 'network unavailable' }; },
    context
  };
}

test('offline deletion survives newer cloud copy and repeated refreshes, and is uploaded', async () => {
  const h = harness([rule({ deletedAt, updatedAt: deletedAt })]);
  h.remote.push(h.row(rule({ updatedAt: newer })));
  await h.pull();
  await h.sync();
  await h.pull();
  assert.equal(h.local[0].deletedAt, deletedAt);
  assert.equal(h.remote[0].deleted_at, deletedAt);
});

test('legacy local rows sharing a UUID propagate deletion to every copy and cloud', async () => {
  const h = harness([
    rule({ deletedAt, updatedAt: deletedAt }),
    rule({ id: 2, updatedAt: newer })
  ]);
  h.remote.push(h.row(rule({ updatedAt: newer })));
  await h.sync();
  await h.sync();
  assert.ok(h.local.every(item => item.deletedAt));
  assert.equal(h.remote[0].deleted_at, deletedAt);
});

test('active legacy rows sharing a UUID upload once without deleting the rule', async () => {
  const h = harness([rule(), rule({ id: 2, updatedAt: newer })]);
  await h.sync();
  await h.sync();
  assert.ok(h.local.every(item => !item.deletedAt));
  assert.equal(h.remote.length, 1);
  assert.equal(h.remote[0].updated_at, newer);
});

test('cloud deletion beats a stale device edit even on push-only sync', async () => {
  const h = harness([rule({ updatedAt: newer })]);
  h.remote.push(h.row(rule({ deletedAt, updatedAt: deletedAt })));
  await h.sync();
  assert.equal(h.local[0].deletedAt, deletedAt);
  assert.equal(h.remote[0].deleted_at, deletedAt);
});

test('old cloud duplicate with another UUID cannot restore a deleted rule', async () => {
  const h = harness([rule({ deletedAt, updatedAt: deletedAt })]);
  h.remote.push(h.row(rule({ uuid: 'old-duplicate', updatedAt: newer })));
  await h.sync();
  assert.equal(h.local.filter(r => !r.deletedAt).length, 0);
  assert.ok(h.remote.every(r => r.deleted_at));
});

test('cloud tombstone deletes an older local duplicate with another UUID', async () => {
  const h = harness([rule({ uuid: 'stale-local-copy', updatedAt: newer })]);
  h.remote.push(h.row(rule({ uuid: 'deleted-cloud-copy', deletedAt, updatedAt: deletedAt })));
  await h.sync();
  assert.equal(h.local.filter(r => !r.deletedAt).length, 0);
  assert.ok(h.remote.every(r => r.deleted_at));
});

test('newly recreated rule with a new UUID remains active', async () => {
  const h = harness([rule({ deletedAt, updatedAt: deletedAt })]);
  h.remote.push(h.row(rule({ uuid: 'recreated', createdAt: newer, updatedAt: newer })));
  await h.sync();
  await h.sync();
  assert.equal(h.local.find(r => r.uuid === 'recreated').deletedAt, null);
});

test('repeated dedupe preserves the survivor and uploads every duplicate tombstone', async () => {
  const h = harness([rule(), rule({ id: 2, uuid: 'duplicate', updatedAt: newer })]);
  await h.dedupe();
  await h.dedupe();
  await h.sync();
  await h.sync();
  assert.equal(h.local.filter(r => !r.deletedAt).length, 1);
  assert.equal(h.remote.length, 2);
  assert.equal(h.remote.filter(r => !r.deleted_at).length, 1);
});

test('empty local database imports cloud rules instead of erasing them', async () => {
  const h = harness([]);
  h.remote.push(h.row(rule()));
  await h.sync();
  assert.equal(h.local.length, 1);
  assert.equal(h.remote[0].deleted_at, null);
});

test('new device imports a deduped cloud collection without deleting the survivor', async () => {
  const h = harness([]);
  h.remote.push(h.row(rule({ uuid: 'old-copy', deletedAt, updatedAt: deletedAt })));
  h.remote.push(h.row(rule({ uuid: 'survivor' })));
  await h.sync();
  await h.sync();
  assert.equal(h.local.find(r => r.uuid === 'survivor').deletedAt, null);
  assert.equal(h.remote.filter(r => !r.deleted_at).length, 1);
});

test('recurrence rule cloud mapping preserves its default quadrant', () => {
  const h = harness([]);
  const remoteRow = h.context.mapRecurrenceRuleToRemote(rule({ quadrant: 'q3' }));
  assert.equal(remoteRow.quadrant, 'q3');
  assert.equal(h.context.mapRecurrenceRuleFromRemote(remoteRow).quadrant, 'q3');
  assert.equal(h.context.mapRecurrenceRuleToRemote(rule()).quadrant, 'q1');
});

test('otherwise identical recurrence rules in different quadrants are deduped', async () => {
  const h = harness([
    rule({ quadrant: 'q1' }),
    rule({ id: 2, uuid: 'rule-2', quadrant: 'q2', updatedAt: newer })
  ]);
  await h.dedupe();
  const survivors = h.local.filter(item => !item.deletedAt);
  assert.equal(survivors.length, 1);
  assert.equal(survivors[0].quadrant, 'q2');
});

test('todo identity ignores quadrant while newer quadrant data still wins', () => {
  const h = harness([]);
  const q1 = { date: '2026-09-23', text: 'Work:same task', quadrant: 'q1' };
  const q4 = { ...q1, quadrant: 'q4', quadrantOrder: 2 };
  assert.equal(h.context.getTodoFingerprint(q1), h.context.getTodoFingerprint(q4));

  const local = {
    id: 18, uuid: 'same-task-local', ...q1, completed: false,
    createdAt, updatedAt: deletedAt, deletedAt: null
  };
  const remote = {
    uuid: 'same-task-remote', ...q4, completed: false,
    createdAt, updatedAt: newer, deletedAt: null
  };
  const merged = h.context.mergeTodoForPull(local, remote);
  assert.equal(merged.id, local.id);
  assert.equal(merged.quadrant, 'q4');
  assert.equal(merged.quadrantOrder, 2);
});

test('failed cloud read prevents upload of stale active rules', async () => {
  const h = harness([rule()]);
  h.failRead();
  await assert.rejects(h.sync(), { message: 'network unavailable' });
  assert.equal(h.uploads.length, 0);
});

test('cloud deletion cleans future linked tasks and retains past history', async () => {
  const todos = [
    { id: 1, recurrenceRuleId: 1, date: '2999-01-01', deletedAt: null },
    { id: 2, recurrenceRuleId: 1, date: '2000-01-01', deletedAt: null }
  ];
  const h = harness([rule()], [], todos);
  h.remote.push(h.row(rule({ deletedAt, updatedAt: deletedAt })));
  await h.pull();
  assert.ok(todos[0].deletedAt);
  assert.equal(todos[1].deletedAt, null);
});

test('task conflict baseline remains last-write-wins with completed sticky', () => {
  const h = harness([]);
  const local = {
    id: 7, uuid: 'todo-1', text: 'local', completed: true,
    updatedAt: newer, deletedAt: null, recurrenceRuleId: 3
  };
  const olderRemoteDeletion = {
    uuid: 'todo-1', text: 'remote', completed: false,
    updatedAt: deletedAt, deletedAt
  };
  const localWinner = h.context.mergeTodoForPull(local, olderRemoteDeletion);
  assert.equal(localWinner.text, 'local');
  assert.equal(localWinner.deletedAt, null);
  assert.equal(localWinner.completed, true);
  assert.equal(localWinner.recurrenceRuleId, 3);

  const newestRemoteDeletion = { ...olderRemoteDeletion, updatedAt: '2026-04-01T00:00:00.000Z' };
  const remoteWinner = h.context.mergeTodoForPull(local, newestRemoteDeletion);
  assert.equal(remoteWinner.text, 'remote');
  assert.equal(remoteWinner.deletedAt, deletedAt);
  assert.equal(remoteWinner.completed, true);
});

test('todo cloud mapping round-trips quadrant and quadrant order', () => {
  const h = harness([]);
  const localTodo = {
    uuid: 'todo-quadrant', date: '2026-09-23', text: 'Work:cloud quadrant',
    completed: false, createdAt, updatedAt: newer, deletedAt: null,
    parentId: null, quadrant: 'q3', quadrantOrder: 4
  };
  const remoteRow = h.context.mapTodoToRemote(localTodo);
  assert.equal(remoteRow.quadrant, 'q3');
  assert.equal(remoteRow.quadrant_order, 4);

  const roundTrip = h.context.mapTodoFromRemote(remoteRow);
  assert.equal(roundTrip.quadrant, 'q3');
  assert.equal(roundTrip.quadrantOrder, 4);
});

test('newer remote quadrant wins while newer local quadrant is preserved', () => {
  const h = harness([]);
  const local = {
    id: 8, uuid: 'todo-quadrant-conflict', text: 'Work:conflict', completed: false,
    createdAt, updatedAt: deletedAt, deletedAt: null, quadrant: 'q2', quadrantOrder: 1
  };
  const newerRemote = {
    uuid: local.uuid, text: local.text, completed: false,
    createdAt, updatedAt: newer, deletedAt: null, quadrant: 'q4', quadrantOrder: 3
  };
  const remoteWinner = h.context.mergeTodoForPull(local, newerRemote);
  assert.equal(remoteWinner.quadrant, 'q4');
  assert.equal(remoteWinner.quadrantOrder, 3);
  assert.equal(h.context.shouldUpdateTodo(local, remoteWinner), true);

  const newestLocal = { ...local, updatedAt: '2026-04-01T00:00:00.000Z' };
  const localWinner = h.context.mergeTodoForPull(newestLocal, newerRemote);
  assert.equal(localWinner.quadrant, 'q2');
  assert.equal(localWinner.quadrantOrder, 1);
});
