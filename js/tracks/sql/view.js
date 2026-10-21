/* SQL track view: schema, editor, result table. Evaluates queries and reports to the engine. */
(function (root) {
  'use strict';
  const OT = root.OT;
  const T = OT.tracks.sql;
  const DB = OT.sqlDB;
  const { h } = OT.ui;
  const MAX_ROWS = 100;

  const NUDGES = [
    'Not yet. Compare your table with what the task asks; hints are on the left if you want them.',
    'Close. Look at the result you got and adjust the query.',
    "No worries, that's part of the game. Give it another go.",
    "That's not it yet. If you get stuck, hint 1 tells you which part to check.",
  ];

  T.createView = function (pane, api) {
    const schema = h('div', { class: 'schema', 'aria-label': 'Tables' },
      ...Object.keys(OT.data.schema).map(t => h('span', { class: 'schema-t' }, h('b', null, t), ' (' + OT.data.schema[t].join(', ') + ')')));
    const input = h('textarea', { class: 'sql-input', rows: 6, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
      'aria-label': 'SQL query', placeholder: 'SELECT … FROM …;\n\nCtrl+Enter runs the query' });
    const runBtn = h('button', { class: 'primary', type: 'button', disabled: true, onclick: () => submit() }, 'Run ▸');
    const nextBtn = h('button', { class: 'primary', type: 'button', hidden: true, onclick: () => api.next() }, 'Next mission ▸');
    const status = h('span', { class: 'muted small' }, 'Loading the SQL engine (SQLite, about 1 MB)…');
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const result = h('div', { class: 'result' });
    pane.replaceChildren(h('div', { class: 'sqlpane' }, schema,
      h('div', { class: 'editor' }, input, h('div', { class: 'editor-actions' }, runBtn, nextBtn, status)),
      feedback, result));

    let mission = null, solved = false;

    DB.ready().then(() => {
      runBtn.disabled = false;
      status.textContent = 'Ctrl+Enter runs · each run uses a fresh copy of the data, so nothing can break';
    }).catch(e => { status.textContent = 'Could not load the SQL engine: ' + e.message; });

    function say(type, text) { feedback.append(h('div', { class: 'line ' + type }, text)); }
    function showResult(res) {
      if (res.error) { result.replaceChildren(h('div', { class: 'line err' }, 'Error: ' + res.error)); return; }
      if (!res.columns.length) { result.replaceChildren(h('div', { class: 'muted small' }, 'The query ran but returned no table.')); return; }
      const rows = res.rows.slice(0, MAX_ROWS);
      result.replaceChildren(
        h('div', { class: 'muted small' }, res.rows.length + ' row' + (res.rows.length === 1 ? '' : 's') + ' × ' + res.columns.length + ' column' + (res.columns.length === 1 ? '' : 's') +
          (res.rows.length > MAX_ROWS ? ' (showing the first ' + MAX_ROWS + ')' : '')),
        h('div', { class: 'table-wrap' }, h('table', { class: 'rtable' },
          h('thead', null, h('tr', null, ...res.columns.map(c => h('th', null, c)))),
          h('tbody', null, ...rows.map(r => h('tr', null, ...r.map(v => v === null ? h('td', { class: 'null' }, 'NULL') : h('td', null, String(v)))))))));
    }

    function succeed(r) {
      solved = true;
      say('ok', r.points ? 'Nice! +' + r.points + ' points.' : 'Done! This one is saved for review later.');
      if (mission.note) say('note', mission.note);
      nextBtn.hidden = false;
      nextBtn.focus();
    }

    function submit(viaSolution) {
      const sql = input.value;
      if (!sql.trim() || !DB.isReady()) return;
      feedback.replaceChildren();
      const { res, cmp } = T.evaluate(mission, sql);
      showResult(res);
      if (solved) { say('sys', 'Already solved: this run is just for practice.'); return; }
      const mistakes = T.detectMistakes(mission, sql, res);
      if (cmp.ok) {
        const style = mistakes.filter(d => d.style);
        const r = api.attempt({ ok: true, viaSolution: !!viaSolution, mistakes: style });
        succeed(r);
        if (style.length) say('tip', 'Tip: it works, but ' + style[0].tip.charAt(0).toLowerCase() + style[0].tip.slice(1));
        return;
      }
      if (viaSolution) { say('nudge', 'The official solution did not match. Please report this mission.'); return; }
      api.attempt({ ok: false, diagnosis: T.diagnose(mission, sql, res, cmp), mistakes });
      say('nudge', NUDGES[Math.floor(Math.random() * NUDGES.length)]);
      const tip = mistakes.find(d => !d.style) || mistakes[0];
      if (tip) say('tip', 'Tip: ' + tip.tip);
    }

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (solved) api.next(); else submit(); }
    });

    return {
      load(m, inf) {
        mission = m; solved = false;
        input.value = '';
        nextBtn.hidden = true;
        nextBtn.textContent = inf.mi + 1 < inf.level.missions.length ? 'Next mission ▸' : 'Finish level ▸';
        feedback.replaceChildren();
        result.replaceChildren(h('div', { class: 'muted small' }, 'Your result table will show up here.'));
        input.focus();
      },
      prefill(sql) { input.value = sql; input.focus(); },
      runSolution() { if (!solved && DB.isReady()) { input.value = mission.solution.cmd; submit(true); } },
      destroy() {},
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
