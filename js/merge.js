// Three-way merge of MathPad data between this device (local), Google Drive (remote) and the last synced state (base).
// Rule for every record: if only one side changed it since the last sync, take that side; if both changed, `pick` decides.
// A record missing on one side was deleted there if it existed in base and the other side did not change it.

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function merge3(base, local, remote, pick = l => l) {
  if (eq(local, remote)) return local;
  if (base !== undefined && eq(local, base)) return remote;
  if (base !== undefined && eq(remote, base)) return local;
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  return pick(local, remote);
}

// Records keyed by id inside arrays. Keeps local order, then remote-only records.
export function mergeById(B = [], L = [], R = [], key = x => x.id, pick) {
  const mb = new Map(B.map(x => [key(x), x])), ml = new Map(L.map(x => [key(x), x])), mr = new Map(R.map(x => [key(x), x]));
  const out = [];
  for (const k of new Set([...ml.keys(), ...mr.keys()])) {
    const b = mb.get(k), l = ml.get(k), r = mr.get(k);
    if (l === undefined && b !== undefined && eq(r, b)) continue; // deleted here, untouched there
    if (r === undefined && b !== undefined && eq(l, b)) continue; // deleted there, untouched here
    out.push(merge3(b, l, r, pick));
  }
  return out;
}

// Plain objects { key: value }, same deletion rules.
export function mergeMap(B = {}, L = {}, R = {}, pick) {
  const out = {};
  for (const k of new Set([...Object.keys(L), ...Object.keys(R)])) {
    const b = B[k], l = L[k], r = R[k];
    if (l === undefined && b !== undefined && eq(r, b)) continue;
    if (r === undefined && b !== undefined && eq(l, b)) continue;
    out[k] = merge3(b, l, r, pick);
  }
  return out;
}

const newer = f => (l, r) => ((r[f] || 0) > (l[f] || 0) ? r : l);

// Merges the app's meta object (S). base may be null on the very first sync (then nothing counts as deleted).
export function mergeMeta(base, local, remote) {
  const B = base || {}, L = local, R = remote || {};
  const m = { ...L };
  m.courses = mergeById(B.courses, L.courses, R.courses, c => c.id, newer('updated'));
  m.problems = mergeById(B.problems, L.problems, R.problems, p => p.id,
    (l, r) => ({ ...newer('updated')(l, r), secs: Math.max(l.secs || 0, r.secs || 0) }));
  m.trash = mergeById(B.trash, L.trash, R.trash, e => `${e.kind}:${e.item.id}`, newer('at'));
  m.notes = mergeMap(B.notes, L.notes, R.notes);
  m.time = mergeMap(B.time, L.time, R.time, Math.max);
  m.pomos = mergeMap(B.pomos, L.pomos, R.pomos, Math.max);
  m.badges = mergeMap(B.badges, L.badges, R.badges, Math.min);
  m.settings = mergeMap(B.settings, L.settings, R.settings);
  m.coach = merge3(B.coach, L.coach, R.coach, newer('at'));
  m.gone = mergeMap(B.gone, L.gone, R.gone, Math.max); // permanently deleted ids

  // deleted on one device, edited on the other: the later action wins
  const binned = new Map(m.trash.map(e => [e.item.id, e.at]));
  const trashedCourse = new Map(m.trash.filter(e => e.kind === 'course').map(e => [e.item.id, e]));
  m.problems = m.problems.filter(p => !m.gone[p.id] && !(binned.has(p.id) && binned.get(p.id) >= (p.updated || 0)) && !(trashedCourse.has(p.course) && trashedCourse.get(p.course).at >= (p.updated || 0)));
  m.courses = m.courses.filter(c => !m.gone[c.id] && !(binned.has(c.id) && binned.get(c.id) >= (c.updated || 0)));
  const live = new Set([...m.problems.map(p => p.id), ...m.courses.map(c => c.id)]);
  m.trash = m.trash.filter(e => !m.gone[e.item.id] && !live.has(e.item.id));
  return m;
}
