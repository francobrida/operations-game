/* MongoDB track view: collections, shell input, results printed like mongosh. */
(function (root) {
  'use strict';
  const OT = root.OT;
  const T = OT.tracks.mongo;
  const M = OT.mongo;
  const { h } = OT.ui;
  const NUDGES = [
    'Not yet. Compare your documents with the task; hints are on the left if you want them.',
    'Close. Look at what the shell returned and adjust.',
    "No worries, that's part of the game. Give it another go.",
    "That's not it yet. If you get stuck, hint 1 tells you which part to check.",
  ];
  const sample = { payments: 'artist, song, amount, payment_date', songs: 'title, plays, duration_sec, artist { name, country }', artists: 'name, country', import_log: 'file, date, rows_loaded' };

  T.createView = function (pane, api) {
    const schema = h('div', { class: 'schema' }, ...Object.keys(sample).map(c => h('span', { class: 'schema-t' }, h('b', null, c), ' { _id, ' + sample[c] + ' }')));
    const input = h('textarea', { class: 'sql-input', rows: 5, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'MongoDB query',
      placeholder: 'db.payments.find({ … })\n\nCtrl+Enter runs the query' });
    const runBtn = h('button', { class: 'primary', type: 'button', onclick: () => submit() }, 'Run ▸');
    const nextBtn = h('button', { class: 'primary', type: 'button', hidden: true, onclick: () => api.next() }, 'Next mission ▸');
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const result = h('div', { class: 'result' });
    pane.replaceChildren(h('div', { class: 'sqlpane' }, schema,
      h('div', { class: 'editor' }, input, h('div', { class: 'editor-actions' }, runBtn, nextBtn, h('span', { class: 'muted small' }, 'Ctrl+Enter runs · the data never changes'))),
      feedback, result));
    let mission = null, solved = false;
    const say = (type, text) => feedback.append(h('div', { class: 'line ' + type }, text));

    function showResult(res) {
      const out = [];
      if (res.warning) out.push(h('div', { class: 'line nudge' }, res.warning));
      if (res.error) out.push(h('div', { class: 'line err' }, (res.parse ? 'SyntaxError: ' : 'MongoServerError: ') + res.error));
      else if (res.count !== undefined && res.count !== null) out.push(h('pre', { class: 'py-stdout' }, String(res.count)));
      else if (res.docs) {
        out.push(h('div', { class: 'muted small' }, res.docs.length + ' document' + (res.docs.length === 1 ? '' : 's')));
        out.push(h('pre', { class: 'py-stdout mongo-out' }, res.docs.length ? '[\n' + res.docs.slice(0, 40).map(d => M.show(d, '  ').replace(/^/, '  ')).join(',\n') + (res.docs.length > 40 ? ',\n  …' : '') + '\n]' : '[]'));
      }
      result.replaceChildren(...out);
    }
    function submit(viaSolution) {
      if (!input.value.trim()) return;
      feedback.replaceChildren();
      const { res, cmp } = T.evaluate(mission, input.value);
      showResult(res);
      if (solved) { say('sys', 'Already solved: this run is just for practice.'); return; }
      if (cmp.ok) {
        const r = api.attempt({ ok: true, viaSolution: !!viaSolution });
        solved = true;
        say('ok', r.points ? 'Nice! +' + r.points + ' points.' : 'Done! This one is saved for review later.');
        if (mission.note) say('note', mission.note);
        nextBtn.hidden = false; nextBtn.focus();
        return;
      }
      if (viaSolution) { say('nudge', 'The official solution did not match. Please report this mission.'); return; }
      const mistakes = T.detectMistakes(mission, input.value, res);
      api.attempt({ ok: false, diagnosis: T.diagnose(mission, input.value, res, cmp), mistakes });
      say('nudge', NUDGES[Math.floor(Math.random() * NUDGES.length)]);
      if (mistakes.length) say('tip', 'Tip: ' + mistakes[0].tip);
    }
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (solved) api.next(); else submit(); } });

    return {
      load(m, inf) {
        mission = m; solved = false; input.value = '';
        nextBtn.hidden = true;
        nextBtn.textContent = inf.mi + 1 < inf.level.missions.length ? 'Next mission ▸' : 'Finish level ▸';
        feedback.replaceChildren();
        result.replaceChildren(h('div', { class: 'muted small' }, 'The documents your query returns show up here.'));
        input.focus();
      },
      prefill(q) { input.value = q; input.focus(); },
      runSolution() { if (!solved) { input.value = mission.solution.cmd; submit(true); } },
      destroy() {},
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
