/* Generic mission runner shared by every track.
   The engine owns the mission card (brief, progressive hints, solution, score) and progress.
   A track only provides createView(pane, api): an input area that evaluates attempts and
   reports them with api.attempt({ ok, diagnosis, mistakes }). */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  const { h, confirmButton } = OT.ui;
  const POINTS = [10, 8, 6, 4];
  const pointsFor = (hints, usedSolution) => usedSolution ? 0 : POINTS[Math.min(hints, 3)];
  const HINT_LABELS = ["What's off?", 'Concept', 'Skeleton'];

  function levelStats(track, li) {
    const ms = track.levels[li].missions;
    let done = 0, review = 0, points = 0;
    for (const m of ms) {
      const r = OT.store.rec(track.id, m.id);
      if (r && r.done) done++;
      if (r && r.review) review++;
      if (r) points += r.points || 0;
    }
    return { done, review, points, total: ms.length };
  }
  // Index of the track's top level (practice levels after it don't count).
  function ceiling(track) { let i = track.levels.length - 1; while (i > 0 && track.levels[i].practice) i--; return i; }
  function firstPending(track, li) {
    const i = track.levels[li].missions.findIndex(m => !(OT.store.rec(track.id, m.id) || {}).done);
    return i === -1 ? 0 : i;
  }

  // nav: { toTrack(), toMission(li, mi), openCheat(li), replaceHash(li, mi) }
  function mountPlay(host, track, li, startMi, nav) {
    const level = track.levels[li];
    const gOffset = track.levels.slice(0, li).reduce((n, lv) => n + lv.missions.length, 0);
    let mi = startMi, s = null, view = null;

    const crumbs = h('div', { class: 'crumbs' });
    const dots = h('div', { class: 'dots' });
    const bar = h('div', { class: 'playbar' },
      h('button', { class: 'ghost', type: 'button', onclick: nav.toTrack }, '◂ Levels'),
      crumbs, dots,
      h('button', { class: 'ghost', type: 'button', onclick: () => nav.openCheat(li) }, 'Cheat sheet'));
    const card = h('aside', { class: 'mission', 'aria-live': 'polite' });
    const pane = h('section', { class: 'pane' });
    const board = h('div', { class: 'board' }, card, pane);
    host.replaceChildren(bar, board);

    const api = { attempt, next, mission: () => s.m };
    view = track.createView(pane, api);
    load(mi);

    function load(i) {
      mi = i;
      const m = level.missions[mi];
      s = { m, attempts: 0, hints: 0, solution: false, diag: null, hint1Wait: false };
      const r = OT.store.rec(track.id, m.id);
      if (r && r.solution && !r.done) s.solution = true;
      OT.store.setLast({ track: track.id, li, mi });
      nav.replaceHash(li, mi);
      renderBar();
      renderCard();
      view.load(m, { li, mi, gi: gOffset + mi, level });
    }

    function renderBar() {
      crumbs.replaceChildren(h('b', null, track.title), ' · Level ' + (li + 1) + ': ' + level.title);
      dots.replaceChildren(...level.missions.map((m, i) => {
        const r = OT.store.rec(track.id, m.id) || {};
        const cls = ['mdot', r.done ? 'done' : '', r.review ? 'review' : '', i === mi ? 'current' : ''].join(' ');
        const state = r.review ? 'to review' : r.done ? 'done' : 'pending';
        return h('button', { class: cls, type: 'button', title: (i + 1) + '. ' + m.title + ' (' + state + ')',
          'aria-label': 'Mission ' + (i + 1) + ': ' + m.title + ', ' + state, onclick: () => load(i) });
      }));
    }

    function renderCard() {
      const m = s.m;
      const r = OT.store.rec(track.id, m.id) || {};
      const badges = [];
      if (r.done) badges.push(h('span', { class: 'badge ok' }, 'Done'));
      if (r.review || s.solution) badges.push(h('span', { class: 'badge warn' }, 'To review'));
      card.replaceChildren(
        h('div', { class: 'card-head' }, h('span', { class: 'tag' }, 'Mission ' + (mi + 1) + ' of ' + level.missions.length), ...badges),
        h('h2', null, m.title),
        h('p', { class: 'brief' }, m.brief),
        renderHints(),
        renderSolution(),
        h('div', { class: 'mscore' },
          h('span', null, 'Worth ', h('b', null, pointsFor(s.hints, s.solution) + ' pts'), s.hints ? ' (' + s.hints + ' hint' + (s.hints > 1 ? 's' : '') + ' used)' : ''),
          h('span', null, track.title + ': ', h('b', null, OT.store.score(track.id) + ' pts')))
      );
    }

    function hintText(k) {
      if (k === 1) return s.diag || "Your last try didn't produce a clear error: reread the task and compare with the result it asks for.";
      return k === 2 ? s.m.concept : s.m.skeleton;
    }
    function renderHints() {
      const reveal = k => {
        if (k === 1 && s.attempts === 0) { s.hint1Wait = true; renderCard(); return; }
        s.hint1Wait = false;
        s.hints = Math.max(s.hints, k);
        renderCard();
      };
      const buttons = [1, 2, 3].map(k => h('button', {
        class: 'hint-btn' + (s.hints >= k ? ' used' : ''), type: 'button',
        disabled: k > s.hints + 1, onclick: () => reveal(k),
        title: k > s.hints + 1 ? 'Open hint ' + (k - 1) + ' first' : '',
      }, 'Hint ' + k));
      const list = [];
      for (let k = 1; k <= s.hints; k++) {
        list.push(h('li', { class: 'hint' }, h('span', { class: 'hint-k' }, k + ' · ' + HINT_LABELS[k - 1]),
          h('span', { class: k === 3 ? 'hint-t mono' : 'hint-t' }, hintText(k))));
      }
      return h('div', { class: 'hints' },
        h('div', { class: 'hint-row' }, ...buttons),
        s.hint1Wait ? h('p', { class: 'muted small' }, 'Try something first: hint 1 tells you which part of your attempt to check.') : null,
        list.length ? h('ol', { class: 'hint-list' }, ...list) : null,
        h('p', { class: 'muted small' }, 'Each hint costs 2 points. They are optional.'));
    }

    function renderSolution() {
      const m = s.m;
      if (!s.solution) {
        return confirmButton('Show solution', 'Sure? It goes to review · confirm', () => {
          s.solution = true;
          const r = OT.store.ensureRec(track.id, m.id);
          r.solution = true; r.review = true;
          OT.store.save();
          renderBar(); renderCard();
        }, { class: 'link' });
      }
      return h('div', { class: 'solution' },
        h('div', { class: 'sol-head' }, 'Solution'),
        h('code', { class: 'sol-code' }, m.solution.cmd),
        h('dl', { class: 'sol-parts' }, ...m.solution.parts.map(([frag, why]) => [h('dt', null, frag), h('dd', null, why)])),
        h('p', { class: 'muted small' }, 'Marked for review. Type it yourself (that is how it sticks) or run it here:'),
        h('div', { class: 'sol-actions' },
          view.prefill ? h('button', { class: 'ghost', type: 'button', onclick: () => view.prefill(m.solution.cmd) }, 'Copy to input') : null,
          view.runSolution ? h('button', { class: 'ghost', type: 'button', onclick: () => view.runSolution() }, 'Run it and continue') : null));
    }

    function attempt(res) {
      const m = s.m;
      const r = OT.store.ensureRec(track.id, m.id);
      s.attempts++; r.attempts++;
      for (const x of res.mistakes || []) OT.store.addMistake(track.id, x.id, x.label);
      if (!res.ok) {
        if (res.diagnosis) s.diag = res.diagnosis;
        s.hint1Wait = false;
        OT.store.save();
        renderCard();
        return { ok: false };
      }
      const usedSolution = s.solution || !!res.viaSolution;
      const points = pointsFor(s.hints, usedSolution);
      r.done = true;
      r.at = Date.now();
      r.hints = s.hints;
      r.solution = r.solution || usedSolution;
      r.review = usedSolution || s.hints >= 3;
      r.points = Math.max(r.points || 0, points);
      const nextMi = mi + 1 < level.missions.length ? mi + 1 : mi;
      OT.store.setLast({ track: track.id, li, mi: nextMi });
      OT.store.save();
      renderBar();
      renderCard();
      return { ok: true, points, review: r.review };
    }

    function next() {
      if (mi + 1 < level.missions.length) load(mi + 1);
      else showSummary();
    }

    function showSummary() {
      if (view.destroy) view.destroy();
      const st = levelStats(track, li);
      const hasNext = li + 1 < track.levels.length;
      board.replaceChildren(h('div', { class: 'summary' },
        h('span', { class: 'tag' }, 'Level ' + (li + 1) + ' complete'),
        h('h2', null, level.title + ': done!'),
        h('ul', { class: 'stats' },
          h('li', null, h('b', null, st.done + '/' + st.total), ' missions done'),
          h('li', null, h('b', null, st.points), ' points in this level'),
          h('li', null, h('b', null, st.review), st.review === 1 ? ' mission to review' : ' missions to review')),
        st.done < st.total ? h('p', { class: 'muted' }, 'Some missions are still pending: the empty squares at the top.') : null,
        track.summary ? track.summary() : null,
        h('div', { class: 'sol-actions' },
          hasNext ? h('button', { class: 'primary', type: 'button', onclick: () => nav.toMission(li + 1, firstPending(track, li + 1)) }, 'Next level ▸') : null,
          h('button', { class: 'ghost', type: 'button', onclick: nav.toTrack }, 'Back to levels'))));
    }

    return { destroy() { if (view && view.destroy) view.destroy(); } };
  }

  OT.engine = { mountPlay, levelStats, firstPending, pointsFor, ceiling };
})(typeof window !== 'undefined' ? window : globalThis);
