/* App shell: home menu, track screen, cheat sheet, hash routing. */
(function (root) {
  'use strict';
  const OT = root.OT;
  const { h, confirmButton, progressBar } = OT.ui;

  const TRACKS = [
    { id: 'bash', icon: '$_', title: 'Bash', blurb: 'Move around a Linux server, search logs and automate with scripts.', phase: 1 },
    { id: 'sql', icon: 'SQL', title: 'SQL', blurb: 'Queries to find duplicated payments and measure how much was overpaid.', phase: 2 },
    { id: 'excel', icon: 'fx', title: 'Excel', blurb: 'Formulas, lookups and a summary table a client can read.', phase: 3 },
    { id: 'python', icon: 'py', title: 'Python', blurb: 'A script that reads the payments CSV and catches duplicates before import.', phase: 4 },
    { id: 'mongo', icon: '{ }', title: 'MongoDB', blurb: 'Documents, find() and an aggregation of amounts per artist.', phase: 5, optional: true },
  ];
  const FINAL_REQUIRES = ['bash', 'sql', 'excel', 'python'];
  const app = document.getElementById('app');
  let current = null;

  const tracks = () => OT.tracks || {};
  function progress(id) {
    const t = tracks()[id];
    if (!t) return null;
    const total = t.flat.length;
    const done = t.flat.filter(x => (OT.store.rec(id, x.mission.id) || {}).done).length;
    const review = t.flat.filter(x => (OT.store.rec(id, x.mission.id) || {}).review).length;
    const top = OT.engine.levelStats(t, t.levels.length - 1);
    return { done, total, review, score: OT.store.score(id), topDone: top.done === top.total };
  }
  function levelReached(t) {
    let reached = 0;
    t.levels.forEach((lv, li) => { if (lv.missions.some(m => OT.store.rec(t.id, m.id))) reached = li; });
    return reached;
  }

  /* ---- routing ---- */
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function replaceHash(hash) { try { history.replaceState(null, '', hash); } catch (e) { /* file:// quirks */ } }
  function parse() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    if (p[0] === 't' && tracks()[p[1]]) return { view: 'track', id: p[1] };
    if (p[0] === 'p' && tracks()[p[1]]) {
      const t = tracks()[p[1]];
      const li = Math.min(Math.max(parseInt(p[2], 10) || 0, 0), t.levels.length - 1);
      const mi = Math.min(Math.max(parseInt(p[3], 10) || 0, 0), t.levels[li].missions.length - 1);
      return { view: 'play', id: p[1], li, mi };
    }
    return { view: 'home' };
  }
  function render() {
    if (current && current.destroy) current.destroy();
    current = null;
    closeModal();
    const r = parse();
    if (r.view === 'track') renderTrack(tracks()[r.id]);
    else if (r.view === 'play') renderPlay(tracks()[r.id], r.li, r.mi);
    else renderHome();
    window.scrollTo(0, 0);
  }

  /* ---- home ---- */
  function renderHome() {
    const last = OT.store.getLast();
    const lastT = last && tracks()[last.track];
    const cards = TRACKS.map(meta => {
      const p = progress(meta.id);
      const ready = !!p;
      return h('button', { class: 'tcard' + (ready ? '' : ' soon'), type: 'button', disabled: !ready,
        onclick: () => go('#/t/' + meta.id) },
        h('div', { class: 'tcard-head' }, h('span', { class: 'icon' }, meta.icon), h('span', { class: 'tcard-title' }, meta.title),
          meta.optional ? h('span', { class: 'badge' }, 'optional') : null,
          !ready ? h('span', { class: 'badge' }, 'Coming soon · phase ' + meta.phase) : null,
          p && p.done === p.total ? h('span', { class: 'badge ok' }, 'Complete') : null),
        h('p', null, meta.blurb),
        ready ? progressBar(p.done, p.total) : null,
        ready ? h('div', { class: 'tcard-foot' }, h('span', null, p.done + '/' + p.total + ' missions'),
          p.review ? h('span', { class: 'warn-text' }, p.review + ' to review') : null, h('span', null, p.score + ' pts')) : null);
    });

    const missing = FINAL_REQUIRES.filter(id => { const p = progress(id); return !p || !p.topDone; });
    const finalCard = h('div', { class: 'final' + (missing.length ? ' locked' : '') },
      h('div', { class: 'tcard-head' }, h('span', { class: 'icon' }, '★'), h('span', { class: 'tcard-title' }, 'The Final Case'),
        h('span', { class: 'badge' }, missing.length ? 'Locked' : 'Coming soon · phase 6')),
      h('p', null, '"You paid us twice for the same song in August." A full Operations case mixing SQL, Bash, Excel and Python, closed with a short written report.'),
      h('ul', { class: 'reqs' }, ...FINAL_REQUIRES.map(id => {
        const p = progress(id); const meta = TRACKS.find(t => t.id === id);
        const okNow = p && p.topDone;
        return h('li', { class: okNow ? 'ok' : '' }, (okNow ? '✓ ' : '○ ') + meta.title + ': finish the top level');
      })),
      h('p', { class: 'muted small' }, 'MongoDB is not required to unlock it.'));

    const total = TRACKS.reduce((n, t) => n + (progress(t.id) ? progress(t.id).score : 0), 0);
    app.replaceChildren(
      h('header', { class: 'top' },
        h('div', { class: 'brand' }, h('h1', null, 'Operations Trainer'), h('span', null, OT.data.company + ' · hands-on data operations practice')),
        h('div', { class: 'top-stats' }, 'Total score: ', h('b', null, total))),
      h('section', { class: 'hero' },
        h('p', null, 'Pick what to practice. Every track stops exactly where the Final Case needs it. Short sessions: one level takes 10–15 minutes.'),
        h('div', { class: 'sol-actions' },
          lastT ? h('button', { class: 'primary', type: 'button', onclick: () => go('#/p/' + last.track + '/' + last.li + '/' + last.mi) },
            'Continue where I left off ▸ ', h('span', { class: 'muted-on-primary' }, lastT.title + ' · Level ' + (last.li + 1) + ' · Mission ' + (last.mi + 1)))
            : h('button', { class: 'primary', type: 'button', onclick: () => go('#/p/bash/0/0') }, 'Start with Bash ▸'),
          h('button', { class: 'ghost', type: 'button', onclick: openSync }, '⇄ Sync progress'))),
      h('div', { class: 'grid' }, ...cards),
      finalCard,
      footer());
  }

  function footer() {
    return h('footer', null,
      h('span', null, OT.store.isPersistent()
        ? 'Your progress is saved in this browser. Nothing touches real files: the disk and the database are make-believe.'
        : 'This browser does not allow saving: progress will be lost when you close the tab.'),
      confirmButton('Erase all progress', 'Sure? This cannot be undone · confirm', () => { OT.store.resetAll(); go('#/'); }, { class: 'link' }));
  }

  /* ---- track screen ---- */
  function renderTrack(t) {
    const meta = TRACKS.find(x => x.id === t.id);
    const p = progress(t.id);
    const levels = t.levels.map((lv, li) => {
      const st = OT.engine.levelStats(t, li);
      const label = st.done === 0 ? 'Start' : st.done === st.total ? 'Replay' : 'Continue';
      return h('div', { class: 'lcard' + (st.done === st.total ? ' complete' : '') },
        h('div', { class: 'lnum' }, li + 1),
        h('div', { class: 'lbody' },
          h('div', { class: 'ltitle' }, lv.title, li === t.levels.length - 1 ? h('span', { class: 'badge' }, 'track ceiling') : null),
          h('p', null, lv.intro),
          h('div', { class: 'lmeta' }, progressBar(st.done, st.total),
            h('span', null, st.done + '/' + st.total + ' missions · ~' + lv.minutes + ' min'),
            st.review ? h('span', { class: 'warn-text' }, st.review + ' to review') : null)),
        h('button', { class: st.done === st.total ? 'ghost' : 'primary', type: 'button',
          onclick: () => go('#/p/' + t.id + '/' + li + '/' + (st.done === st.total ? 0 : OT.engine.firstPending(t, li))) }, label));
    });
    app.replaceChildren(
      h('header', { class: 'top' },
        h('button', { class: 'ghost', type: 'button', onclick: () => go('#/') }, '◂ Menu'),
        h('div', { class: 'top-stats' }, p.done + '/' + p.total + ' missions · ', h('b', null, p.score + ' pts'))),
      h('section', { class: 'track-head' },
        h('h1', null, h('span', { class: 'icon' }, meta.icon), ' ' + t.title),
        h('p', null, meta.blurb + ' You can jump into any level whenever you like.'),
        t.notice ? h('div', { class: 'notice' }, h('b', null, t.notice.title + ' '), t.notice.text) : null,
        h('div', { class: 'sol-actions' },
          h('button', { class: 'ghost', type: 'button', onclick: () => openCheat(t, levelReached(t)) }, 'Cheat sheet'),
          confirmButton('Reset this track', 'Sure? Erases ' + t.title + ' progress · confirm', () => { OT.store.resetTrack(t.id); render(); }, { class: 'link' }))),
      h('div', { class: 'levels' }, ...levels),
      footer());
  }

  /* ---- play ---- */
  function renderPlay(t, li, mi) {
    current = OT.engine.mountPlay(app, t, li, mi, {
      toTrack: () => go('#/t/' + t.id),
      toMission: (l, m) => go('#/p/' + t.id + '/' + l + '/' + m),
      openCheat: l => openCheat(t, Math.max(l, levelReached(t))),
      replaceHash: (l, m) => replaceHash('#/p/' + t.id + '/' + l + '/' + m),
    });
  }

  /* ---- cheat sheet: only what was taught up to the level reached ---- */
  let modal = null;
  function openCheat(t, li) {
    closeModal();
    const close = h('button', { class: 'ghost', type: 'button', onclick: closeModal }, 'Close');
    modal = h('div', { class: 'backdrop', onclick: e => { if (e.target === modal) closeModal(); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.title + ' cheat sheet' },
        h('div', { class: 'modal-head' }, h('h2', null, 'Cheat sheet · ' + t.title), close),
        h('p', { class: 'muted small' }, 'Only what you have seen up to level ' + (li + 1) + '.'),
        ...t.cheatUpTo(li).map(sec => h('section', null, h('h3', null, sec.title),
          h('table', { class: 'cheat' }, ...sec.rows.map(([c, d]) => h('tr', null, h('td', null, h('code', null, c)), h('td', null, d))))))));
    document.body.append(modal);
    close.focus();
  }
  /* ---- sync between devices: copy a code here, paste it there (both ways merge) ---- */
  function openSync() {
    closeModal();
    const close = h('button', { class: 'ghost', type: 'button', onclick: () => { closeModal(); render(); } }, 'Close');
    const mine = h('textarea', { class: 'sync-code', readonly: true, rows: 4, 'aria-label': 'Your sync code' }, 'Preparing your code…');
    const copyMsg = h('span', { class: 'muted small' });
    const copy = h('button', { class: 'primary', type: 'button', onclick: async () => {
      mine.select();
      try { await navigator.clipboard.writeText(mine.value); copyMsg.textContent = 'Copied. Send it to your other device.'; }
      catch (e) { copyMsg.textContent = 'Selected: copy it with Ctrl+C (or long-press → Copy).'; }
    } }, 'Copy code');
    const theirs = h('textarea', { class: 'sync-code', rows: 4, placeholder: 'Paste the code from your other device here', 'aria-label': 'Code from your other device' });
    const importMsg = h('p', { class: 'small', 'aria-live': 'polite' });
    const doImport = h('button', { class: 'primary', type: 'button', onclick: async () => {
      try {
        const n = await OT.store.importCode(theirs.value);
        importMsg.className = 'small ok-text';
        importMsg.textContent = n ? 'Done: ' + n + ' mission' + (n === 1 ? '' : 's') + ' updated. Nothing was lost.' : 'Already up to date: that code had nothing new.';
        theirs.value = '';
        mine.value = await OT.store.exportCode();
      } catch (e) {
        importMsg.className = 'small err-text';
        importMsg.textContent = "That doesn't look like a sync code. Copy the whole thing, it starts with OT.";
      }
    } }, 'Import');
    modal = h('div', { class: 'backdrop', onclick: e => { if (e.target === modal) { closeModal(); render(); } } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sync progress' },
        h('div', { class: 'modal-head' }, h('h2', null, 'Sync progress'), close),
        h('p', { class: 'muted small' }, 'Each device keeps its own progress. To move it, copy the code on one device and import it on the other. Both sides are merged and the best result of every mission is kept, so you can do it in either direction any time.'),
        h('section', null, h('h3', null, '1 · Code from this device'), mine, h('div', { class: 'sol-actions' }, copy, copyMsg)),
        h('section', null, h('h3', null, '2 · Paste a code from your other device'), theirs, h('div', { class: 'sol-actions' }, doImport), importMsg)));
    document.body.append(modal);
    OT.store.exportCode().then(code => { mine.value = code; }).catch(() => { mine.value = 'This browser cannot create sync codes.'; });
  }
  function closeModal() { if (modal) { modal.remove(); modal = null; } }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  OT.store.load();
  window.addEventListener('hashchange', render);
  render();
})(window);
