// Sync merge: two devices edit the same data; nothing should be lost or resurrected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeMeta, mergeById, merge3 } from '../js/merge.js';

const P = (id, updated, extra = {}) => ({ id, title: id, course: 'c0', status: 'open', updated, secs: 0, ...extra });
const meta = (o = {}) => ({ courses: [{ id: 'c0', name: 'Devre' }], problems: [], trash: [], notes: {}, time: {}, pomos: {}, badges: {}, settings: { goal: 10 }, ...o });
const ids = m => m.problems.map(p => p.id).sort();

test('first sync (no base) keeps everything from both devices', () => {
  const m = mergeMeta(null, meta({ problems: [P('a', 1)] }), meta({ problems: [P('b', 2)] }));
  assert.deepEqual(ids(m), ['a', 'b']);
});

test('a change on one side wins over the unchanged other side', () => {
  const base = meta({ problems: [P('a', 1, { status: 'open' })] });
  const local = meta({ problems: [P('a', 1, { status: 'open' })] });
  const remote = meta({ problems: [P('a', 5, { status: 'solved' })] });
  assert.equal(mergeMeta(base, local, remote).problems[0].status, 'solved');
});

test('both sides changed the same problem: newer wins, study time is never lost', () => {
  const base = meta({ problems: [P('a', 1, { secs: 10 })] });
  const local = meta({ problems: [P('a', 9, { title: 'yeni ad', secs: 300 })] });
  const remote = meta({ problems: [P('a', 5, { status: 'solved', secs: 120 })] });
  const p = mergeMeta(base, local, remote).problems[0];
  assert.equal(p.title, 'yeni ad'); assert.equal(p.secs, 300);
});

test('deleted on one device and untouched on the other stays deleted', () => {
  const base = meta({ problems: [P('a', 1), P('b', 1)] });
  const local = meta({ problems: [P('a', 1)], trash: [{ kind: 'problem', at: 20, item: P('b', 1) }] });
  const remote = meta({ problems: [P('a', 1), P('b', 1)] });
  const m = mergeMeta(base, local, remote);
  assert.deepEqual(ids(m), ['a']);
  assert.equal(m.trash.length, 1);
});

test('deleted here but edited later there: the later edit brings it back', () => {
  const base = meta({ problems: [P('b', 1)] });
  const local = meta({ problems: [], trash: [{ kind: 'problem', at: 20, item: P('b', 1) }] });
  const remote = meta({ problems: [P('b', 30, { status: 'solved' })] });
  const m = mergeMeta(base, local, remote);
  assert.deepEqual(ids(m), ['b']);
  assert.equal(m.trash.length, 0);
});

test('permanently deleted ids never come back', () => {
  const base = meta({ problems: [P('b', 1)] });
  const local = meta({ problems: [], gone: { b: 50 } });
  const remote = meta({ problems: [P('b', 1)] });
  assert.deepEqual(ids(mergeMeta(base, local, remote)), []);
});

test('a course moved to the trash takes its problems with it', () => {
  const base = meta({ courses: [{ id: 'c0', name: 'Devre' }, { id: 'c1', name: 'Kontrol' }], problems: [P('a', 1, { course: 'c1' })] });
  const local = meta({ courses: [{ id: 'c0', name: 'Devre' }], trash: [{ kind: 'course', at: 9, item: { id: 'c1', name: 'Kontrol' }, problems: [P('a', 1, { course: 'c1' })] }] });
  const remote = base;
  const m = mergeMeta(base, local, remote);
  assert.deepEqual(m.courses.map(c => c.id), ['c0']);
  assert.deepEqual(ids(m), []);
});

test('daily study time and badges merge sensibly', () => {
  const m = mergeMeta(meta(), meta({ time: { '2026-11-19': 600 }, badges: { first: 200 } }), meta({ time: { '2026-11-19': 900, '2026-11-18': 60 }, badges: { first: 100, ten: 300 } }));
  assert.deepEqual(m.time, { '2026-11-19': 900, '2026-11-18': 60 });
  assert.deepEqual(m.badges, { first: 100, ten: 300 });
});

test('notes: an edit on one side is kept, a conflicting edit prefers this device', () => {
  const base = meta({ notes: { c0: 'eski' } });
  assert.equal(mergeMeta(base, meta({ notes: { c0: 'eski' } }), meta({ notes: { c0: 'uzak' } })).notes.c0, 'uzak');
  assert.equal(mergeMeta(base, meta({ notes: { c0: 'yerel' } }), meta({ notes: { c0: 'uzak' } })).notes.c0, 'yerel');
});

test('merge3 and mergeById basics', () => {
  assert.equal(merge3(1, 1, 2), 2);
  assert.equal(merge3(1, 3, 1), 3);
  assert.equal(merge3(1, 3, 4, Math.max), 4);
  assert.deepEqual(mergeById([{ id: 1 }], [], [{ id: 1 }]), []);
  assert.deepEqual(mergeById([], [{ id: 1 }], [{ id: 2 }]).map(x => x.id), [1, 2]);
});
