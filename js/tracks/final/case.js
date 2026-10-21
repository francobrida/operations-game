/* The Final Case: one story across the tracks. Steps 1-5 reuse the ceiling missions of SQL, Bash,
   Excel and Python (same checks, same views) with the story's briefs; step 6 is a written wrap-up
   with a model answer and a self-assessment checklist. Ends with a final score and weak spots. */
(function (root) {
  'use strict';
  const OT = root.OT;
  const { h } = OT.ui;
  const T = OT.tracks;
  const REQUIRES = ['bash', 'sql', 'excel', 'python'];

  function step(kind, baseId, id, title, brief) {
    const f = T[kind].flat.find(x => x.mission.id === baseId);
    return Object.assign({}, f.mission, { id, title, brief, kind, baseGi: f.gi });
  }
  const CHECKLIST = [
    ['problem', 'Problem', 'What happened: some August payments were made twice.'],
    ['impact', 'Impact', 'How much and who: 755.50 overpaid to 5 artists (6 extra payments).'],
    ['cause', 'Cause', 'Why: payments_2026-08.csv was imported twice on August 14.'],
    ['fix', 'Fix', 'What we do now: recover or offset the 755.50.'],
    ['prevention', 'Prevention', 'How it will not happen again: the duplicate check runs before every import.'],
  ];
  const MODEL = 'On August 14 the file payments_2026-08.csv was imported twice, so six August payments were made a second time. ' +
    'Five artists received a total of 755.50 more than they should have, DJ Pampa the most (220.00). ' +
    'We found the duplicates in the payments table and confirmed the double import in the import logs, which show a duplicate_batch error. ' +
    'We will offset the 755.50 against the next payments and send each artist the detail. ' +
    'To prevent it, a script now checks every CSV for repeated artist and song pairs before it is imported and writes a report.';

  const MISSIONS = [
    step('sql', 'aug-dups', 'case-detect', '1 · Detect',
      'Client ticket: "You paid us twice for the same song in August. Please check." Start in the database: find the August payments that repeat the same artist and song, with artist, song and the number of copies.'),
    step('sql', 'final-report', 'case-quantify', '2 · Quantify',
      'Head of Operations: "How bad is it? Give me artist name, country and overpaid amount, only artists overpaid more than 100, biggest first."'),
    step('bash', 'dup-names', 'case-cause', '3 · Root cause',
      'Support: "Why did it happen? Check the import logs on the server: which file raised duplicate_batch, and how many times?" (the logs are in the logs folder; the file name comes after the =).'),
    step('excel', 'client-table', 'case-communicate', '4 · Communicate',
      'Head of Operations: "The client wants a table, not SQL. Finish the summary in K1:M7: each artist\'s country (artists in O:P), their overpaid amount from column H, and the total in M7."'),
    step('python', 'full-script', 'case-prevent', '5 · Prevent',
      'Head of Operations: "This cannot happen again. Write the script that reads payments.csv before import and writes duplicates_report.txt: one line per extra copy, like id 16: Luna Ferreyra - Mar de Fondo - 125.00, and a last line Total overpaid: 755.50."'),
    { id: 'case-wrapup', kind: 'write', title: '6 · Wrap-up',
      brief: 'Head of Operations: "Write the reply for the client and the team, in English, 4–5 sentences: what happened, the impact, the cause and the fix." You will see a model answer and a checklist after you submit.',
      concept: 'A good incident summary answers five questions: what happened (problem), how much and who (impact), why (cause), what we do now (fix) and how it will not happen again (prevention).',
      skeleton: 'On <date> the file <name> was … so … payments were made twice.\n<N> artists received … more than they should have.\nWe found it in … and confirmed it in ….\nWe will ….\nTo prevent it, ….',
      solution: { cmd: MODEL, parts: CHECKLIST.map(([, label, why]) => [label, why]) } },
  ];
  const LEVELS = [{ id: 'case', title: 'The Final Case', minutes: 30,
    intro: '"You paid us twice for the same song in August." Detect, quantify, find the cause, communicate, prevent and report.',
    cheat: [], missions: MISSIONS }];
  const flat = MISSIONS.map((m, mi) => ({ mission: m, li: 0, mi, gi: mi }));

  // Cheat sheet: the top level of each track involved, plus the writing checklist.
  const cheatUpTo = () => REQUIRES.map(id => { const t = T[id]; const top = t.cheatUpTo(t.levels.length - 1); return { title: t.title, rows: top[top.length - 1].rows }; })
    .concat([{ title: 'Wrap-up', rows: CHECKLIST.map(([, label, why]) => [label, why]) }]);

  /* ---- step 6: the writing view ---- */
  function writeView(pane, api) {
    const input = h('textarea', { class: 'sql-input case-text', rows: 8, spellcheck: 'true', 'aria-label': 'Your wrap-up', placeholder: 'Write 4–5 sentences in English…' });
    const counter = h('span', { class: 'muted small' }, '0 words');
    const submitBtn = h('button', { class: 'primary', type: 'button', onclick: () => submit() }, 'Submit ▸');
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const after = h('div');
    pane.replaceChildren(h('div', { class: 'sqlpane' },
      h('div', { class: 'editor' }, input, h('div', { class: 'editor-actions' }, submitBtn, counter)), feedback, after));
    const words = () => (input.value.trim().match(/\S+/g) || []).length;
    input.addEventListener('input', () => { counter.textContent = words() + ' words'; });
    let done = false;
    function submit(viaSolution) {
      feedback.replaceChildren();
      if (done) return;
      if (words() < 30) { feedback.append(h('div', { class: 'line nudge' }, 'A bit more: 4–5 full sentences (at least 30 words). You have ' + words() + '.')); api.attempt({ ok: false, diagnosis: 'The text is too short: cover problem, impact, cause, fix and prevention, one sentence each.' }); return; }
      done = true; input.readOnly = true; submitBtn.hidden = true;
      const boxes = CHECKLIST.map(([id, label, why]) => h('label', { class: 'case-check' }, h('input', { type: 'checkbox', 'data-id': id }), h('b', null, label), ' ' + why));
      const finish = h('button', { class: 'primary', type: 'button', onclick: () => {
        const missing = boxes.filter(b => !b.querySelector('input').checked).map(b => b.querySelector('b').textContent.toLowerCase());
        const r = api.attempt({ ok: true, viaSolution: !!viaSolution });
        finish.disabled = true;
        feedback.replaceChildren(h('div', { class: 'line ok' }, (r.points ? '+' + r.points + ' points. ' : '') + (missing.length ? 'Next time add: ' + missing.join(', ') + '.' : 'All five covered. Case closed.')));
        setTimeout(() => api.next(), 1200);
      } }, 'Finish the case ▸');
      after.replaceChildren(h('section', { class: 'case-model' },
        h('h3', null, 'Model answer'), h('p', null, MODEL),
        h('h3', null, 'Check your text: tick what you covered'), ...boxes,
        h('div', { class: 'sol-actions' }, finish)));
    }
    return {
      load() { input.focus(); },
      prefill(q) { if (!done) { input.value = q; counter.textContent = words() + ' words'; input.focus(); } },
      runSolution() { if (!done) { input.value = MODEL; submit(true); } },
      destroy() {},
    };
  }

  /* ---- the case view: mounts the right track's view for each step ---- */
  function createView(pane, api) {
    let sub = null;
    return {
      load(m, inf) {
        if (sub && sub.destroy) sub.destroy();
        sub = m.kind === 'write' ? writeView(pane, api) : T[m.kind].createView(pane, api);
        sub.load(m, Object.assign({}, inf, { gi: m.baseGi }));
      },
      prefill(q) { if (sub && sub.prefill) sub.prefill(q); },
      runSolution() { if (sub && sub.runSolution) sub.runSolution(); },
      destroy() { if (sub && sub.destroy) sub.destroy(); },
    };
  }

  /* ---- end of the case: final score and weak spots from the whole mistake history ---- */
  function summary() {
    const names = { final: 'Final Case' };
    Object.keys(T).forEach(id => { names[id] = names[id] || T[id].title; });
    const weak = Object.keys(names).flatMap(id => OT.store.topMistakes(id, 10).map(x => Object.assign({ track: names[id] }, x)))
      .sort((a, b) => b.count - a.count).slice(0, 5);
    const total = Object.keys(T).reduce((n, id) => n + OT.store.score(id), 0);
    return h('div', { class: 'case-summary' },
      h('p', null, 'Final Case score: ', h('b', null, OT.store.score('final') + ' / ' + MISSIONS.length * 10), ' · All tracks: ', h('b', null, total + ' pts')),
      h('h3', null, 'Weak spots to study next'),
      weak.length ? h('ol', null, ...weak.map(x => h('li', null, h('b', null, x.label), ' · ' + x.track + ' (' + x.count + '×)')))
        : h('p', { class: 'muted' }, 'No repeated mistakes on record. Nice work.'));
  }

  T.final = { id: 'final', title: 'The Final Case', levels: LEVELS, flat, cheatUpTo, createView, summary, requires: REQUIRES,
    notice: { title: 'Boss mode.', text: 'One story, six steps, each in the tool it belongs to. Hints and solutions work as everywhere else, and at the end you get your score and the mistakes you repeat most.' } };
})(typeof window !== 'undefined' ? window : globalThis);
