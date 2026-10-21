/* Progress, scores, mistake history and per-track extra state.
   Falls back to memory when localStorage is unavailable (private mode, blocked storage). */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  const KEY = 'operations_trainer_v1';
  let data = null;
  let persistent = true;

  function fresh() { return { v: 1, tracks: {}, mistakes: {}, last: null }; }

  function load() {
    try {
      const raw = root.localStorage.getItem(KEY);
      data = raw ? JSON.parse(raw) : fresh();
      if (!data || data.v !== 1) data = fresh();
    } catch (e) {
      persistent = false;
      data = data || fresh();
    }
    return data;
  }

  function save() {
    if (!persistent) return;
    try { root.localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { persistent = false; }
  }

  function track(id) {
    if (!data) load();
    if (!data.tracks[id]) data.tracks[id] = { recs: {}, extra: {} };
    return data.tracks[id];
  }

  // Mission record: { done, review, attempts, hints, solution, points, at }
  function rec(trackId, missionId) { return track(trackId).recs[missionId] || null; }
  function ensureRec(trackId, missionId) {
    const t = track(trackId);
    if (!t.recs[missionId]) t.recs[missionId] = { done: false, review: false, attempts: 0, hints: 0, solution: false, points: 0 };
    return t.recs[missionId];
  }

  function score(trackId) {
    const recs = track(trackId).recs;
    return Object.keys(recs).reduce((s, k) => s + (recs[k].points || 0), 0);
  }

  function addMistake(trackId, id, label) {
    if (!data) load();
    const bucket = data.mistakes[trackId] = data.mistakes[trackId] || {};
    const m = bucket[id] = bucket[id] || { count: 0, label: label || id };
    m.count++;
    m.last = Date.now();
    if (label) m.label = label;
  }
  function topMistakes(trackId, n) {
    if (!data) load();
    const bucket = data.mistakes[trackId] || {};
    return Object.keys(bucket).map(id => Object.assign({ id }, bucket[id]))
      .sort((a, b) => b.count - a.count).slice(0, n || 5);
  }

  function setLast(v) { if (!data) load(); data.last = v; save(); }
  function getLast() { if (!data) load(); return data.last; }

  /* ---- sync code: compact snapshot of mission records + mistakes, merged on import ---- */
  // A record as [done, points, review, solution, attempts, hints]; the Bash disk is rebuilt, not copied.
  function snapshot() {
    if (!data) load();
    const t = {}, m = {};
    for (const id of Object.keys(data.tracks)) {
      const recs = data.tracks[id].recs;
      const out = {};
      for (const k of Object.keys(recs)) {
        const r = recs[k];
        out[k] = [r.done ? 1 : 0, r.points || 0, r.review ? 1 : 0, r.solution ? 1 : 0, r.attempts || 0, r.hints || 0];
      }
      if (Object.keys(out).length) t[id] = out;
    }
    for (const id of Object.keys(data.mistakes)) {
      m[id] = {};
      for (const k of Object.keys(data.mistakes[id])) m[id][k] = [data.mistakes[id][k].count, data.mistakes[id][k].label];
    }
    return { v: 1, t, m };
  }
  // Keeps the better record of each mission, so syncing both ways never loses progress.
  function merge(snap) {
    if (!snap || snap.v !== 1 || typeof snap.t !== 'object') throw new Error('not a sync code');
    let changed = 0;
    for (const id of Object.keys(snap.t)) {
      const t = track(id);
      for (const k of Object.keys(snap.t[id])) {
        const [done, points, review, solution, attempts, hints] = snap.t[id][k];
        const theirs = { done: !!done, points, review: !!review, solution: !!solution, attempts, hints };
        const mine = t.recs[k];
        if (!mine) { t.recs[k] = theirs; changed++; continue; }
        const better = theirs.points > mine.points || (theirs.done && !mine.done);
        const tie = theirs.done === mine.done && theirs.points === mine.points;
        const merged = better ? Object.assign({}, mine, theirs) : Object.assign({}, mine);
        if (tie) merged.review = mine.review && theirs.review;
        merged.attempts = Math.max(mine.attempts || 0, attempts);
        merged.solution = mine.solution || theirs.solution;
        if (JSON.stringify(merged) !== JSON.stringify(mine)) { t.recs[k] = merged; changed++; }
      }
    }
    for (const id of Object.keys(snap.m || {})) {
      const bucket = data.mistakes[id] = data.mistakes[id] || {};
      for (const k of Object.keys(snap.m[id])) {
        const [count, label] = snap.m[id][k];
        const cur = bucket[k] = bucket[k] || { count: 0, label };
        cur.count = Math.max(cur.count, count);
      }
    }
    save();
    return changed;
  }

  const B64 = { enc: bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) };
  async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
  const canZip = typeof CompressionStream === 'function';
  async function exportCode() {
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot()));
    return canZip ? 'OT1.' + B64.enc(await pipe(bytes, new CompressionStream('deflate-raw'))) : 'OT0.' + B64.enc(bytes);
  }
  async function importCode(code) {
    const m = (code || '').trim().match(/^OT([01])\.([A-Za-z0-9_-]+)$/);
    if (!m) throw new Error('not a sync code');
    let bytes = B64.dec(m[2]);
    if (m[1] === '1') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    return merge(JSON.parse(new TextDecoder().decode(bytes)));
  }

  function resetTrack(id) { if (!data) load(); delete data.tracks[id]; delete data.mistakes[id]; save(); }
  function resetAll() { data = fresh(); try { root.localStorage.removeItem(KEY); } catch (e) { /* memory only */ } }

  OT.store = {
    load, save, track, rec, ensureRec, score, addMistake, topMistakes,
    setLast, getLast, resetTrack, resetAll, exportCode, importCode,
    isPersistent: () => persistent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
