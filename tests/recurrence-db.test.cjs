const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/db.js'), 'utf8')
  .replace(/^import .*;\s*/gm, '').replace(/\bexport\s+/g, '');

// Model queued IndexedDB requests and transaction completion, including a
// request added by another request's success callback.
function harness(initial) {
  const rows = structuredClone(initial);
  const db = {
    transaction() {
      let pending = 0;
      const tx = {
        objectStore() {
          const request = operation => {
            pending++;
            const req = {};
            setImmediate(() => {
              req.result = operation();
              if (req.onsuccess) req.onsuccess();
              if (--pending === 0 && tx.oncomplete) tx.oncomplete();
            });
            return req;
          };
          return {
            get: id => request(() => structuredClone(rows.find(row => row.id === id))),
            getAll: () => request(() => structuredClone(rows)),
            put: row => request(() => {
              const index = rows.findIndex(item => item.id === row.id);
              if (index < 0) rows.push(structuredClone(row));
              else rows[index] = structuredClone(row);
              return row.id;
            })
          };
        }
      };
      return tx;
    }
  };
  const context = vm.createContext({ createScopedDbName: name => name, db });
  vm.runInContext(source + '\nopenDB = async () => db;', context);
  return { rows, context };
}

test('deleting a legacy rule commits deletion of every local row with its UUID', async () => {
  const h = harness([
    { id: 1, uuid: 'same', deletedAt: null },
    { id: 2, uuid: 'same', deletedAt: null },
    { id: 3, uuid: 'other', deletedAt: null }
  ]);
  assert.equal(await h.context.deleteRecurrenceRule(2), true);
  assert.ok(h.rows[0].deletedAt);
  assert.equal(h.rows[1].deletedAt, h.rows[0].deletedAt);
  assert.equal(h.rows[2].deletedAt, null);
});

test('a stale sync snapshot cannot overwrite a committed deletion', async () => {
  const original = { id: 1, uuid: 'same', text: 'old', deletedAt: null };
  const h = harness([original]);
  await h.context.deleteRecurrenceRule(1);
  const deletedAt = h.rows[0].deletedAt;
  await h.context.updateRecurrenceRule({ ...original, text: 'stale cloud edit', updatedAt: '2999-01-01' });
  assert.equal(h.rows[0].deletedAt, deletedAt);
  assert.equal(h.rows[0].text, 'old');
});

test('legacy tombstones without a UUID can still be normalized for upload', async () => {
  const h = harness([{ id: 1, deletedAt: '2026-01-01' }]);
  await h.context.updateRecurrenceRule({ id: 1, uuid: 'generated', deletedAt: null });
  assert.equal(h.rows[0].uuid, 'generated');
  assert.equal(h.rows[0].deletedAt, '2026-01-01');
});
