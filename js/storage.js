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

  function resetTrack(id) { if (!data) load(); delete data.tracks[id]; delete data.mistakes[id]; save(); }
  function resetAll() { data = fresh(); try { root.localStorage.removeItem(KEY); } catch (e) { /* memory only */ } }

  OT.store = {
    load, save, track, rec, ensureRec, score, addMistake, topMistakes,
    setLast, getLast, resetTrack, resetAll,
    isPersistent: () => persistent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
