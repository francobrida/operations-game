/* Excel track view: grid, formula bar, tools (fill, sort, filter, pivot), check button. */
(function (root) {
  'use strict';
  const OT = root.OT;
  const T = OT.tracks.excel;
  const X = OT.sheet;
  const { h } = OT.ui;

  const NUDGES = [
    'Not yet. Compare your cells with the task; hints are on the left if you want them.',
    'Close. Look at what your formulas return and adjust.',
    "No worries, that's part of the game. Give it another go.",
    "That's not it yet. If you get stuck, hint 1 tells you which part to check.",
  ];
  const show = v => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
    return X.toText(v);
  };

  T.createView = function (pane, api) {
    const name = h('span', { class: 'xl-name' }, 'A1');
    const bar = h('input', { class: 'xl-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      'aria-label': 'Cell content or formula', placeholder: 'type a value or a formula starting with =' });
    const ok = h('button', { class: 'ghost small', type: 'button', title: 'Enter', onclick: () => commit(true) }, '✓');
    const fillTo = h('input', { class: 'xl-row', type: 'number', min: 2, 'aria-label': 'Fill down to row' });
    const tools = {
      fill: h('span', { class: 'xl-tool' }, h('button', { class: 'ghost', type: 'button', onclick: () => fill() }, 'Fill ↓'), ' to row ', fillTo),
      sort: h('span', { class: 'xl-tool' },
        h('button', { class: 'ghost', type: 'button', onclick: () => sort(false) }, 'Sort A→Z'),
        h('button', { class: 'ghost', type: 'button', onclick: () => sort(true) }, 'Sort Z→A')),
      filter: h('span', { class: 'xl-tool' },
        h('button', { class: 'ghost', type: 'button', onclick: () => filter() }, 'Filter = value'),
        h('button', { class: 'ghost', type: 'button', onclick: () => { sh.filter = null; changed(); } }, 'Clear filter')),
    };
    const pvRows = h('select', { 'aria-label': 'Pivot rows' }), pvVals = h('select', { 'aria-label': 'Pivot values' });
    const pvAgg = h('select', { 'aria-label': 'Summarize by' }, ...['SUM', 'COUNT', 'AVERAGE'].map(a => h('option', { value: a }, a[0] + a.slice(1).toLowerCase())));
    const pivotPanel = h('div', { class: 'xl-pivot' },
      h('b', null, 'Pivot'), h('label', null, 'Rows ', pvRows), h('label', null, 'Values ', pvVals), h('label', null, 'Summarize ', pvAgg),
      h('button', { class: 'ghost', type: 'button', onclick: buildPivot }, 'Build pivot'));
    const checkBtn = h('button', { class: 'primary', type: 'button', onclick: () => check() }, 'Check ✓');
    const nextBtn = h('button', { class: 'primary', type: 'button', hidden: true, onclick: () => api.next() }, 'Next mission ▸');
    const reset = h('button', { class: 'ghost', type: 'button', onclick: () => { sh = T.startSheet(mission); select(firstTarget()); changed(); say('sys', 'Sheet reset.'); } }, '↺ Reset sheet');
    const toolRow = h('div', { class: 'xl-tools' });
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const gridWrap = h('div', { class: 'xl-grid-wrap' });
    const pivotOut = h('div', { class: 'xl-pivot-out' });
    pane.replaceChildren(h('div', { class: 'xlpane' },
      h('div', { class: 'xl-bar' }, name, h('span', { class: 'fx' }, 'fx'), bar, ok),
      toolRow, pivotPanel,
      h('div', { class: 'editor-actions xl-actions' }, checkBtn, nextBtn, reset),
      feedback, gridWrap, pivotOut));

    let mission = null, sh = null, sel = 'A1', solved = false, targets = new Set();

    const drafts = () => { const t = OT.store.track('excel'); t.extra.drafts = t.extra.drafts || {}; return t.extra.drafts; };
    function changed() { drafts()[mission.id] = sh; OT.store.save(); render(); }
    function say(type, text) { feedback.append(h('div', { class: 'line ' + type }, text)); }
    const firstTarget = () => (mission.targets ? X.rangeCells(mission.targets)[0] : 'A2');

    function select(a) {
      sel = a;
      name.textContent = a;
      const raw = sh.cells[a];
      bar.value = raw == null ? '' : String(raw);
      const p = X.parseAddr(a);
      const tRows = mission.targets ? X.rangeCells(mission.targets).map(X.parseAddr).filter(q => q.c === p.c).map(q => q.r) : [];
      fillTo.value = tRows.length ? Math.max(...tRows) : X.table(sh).rows;
      render();
    }
    function commit(move) {
      const v = bar.value;
      if (v === '') delete sh.cells[sel]; else sh.cells[sel] = v;
      const p = X.parseAddr(sel);
      changed();
      if (move) select(X.addr(p.c, p.r + 1));
      bar.focus();
    }
    function fill() {
      const p = X.parseAddr(sel), to = parseInt(fillTo.value, 10);
      if (!sh.cells[sel]) { say('nudge', 'Select the cell with the formula you want to copy down first.'); return; }
      if (!(to > p.r)) { say('nudge', 'Pick a row below ' + sel + ' to fill down to.'); return; }
      X.fillDown(sh, sel, to);
      changed();
    }
    function inTable() {
      const p = X.parseAddr(sel), t = X.table(sh);
      return p.c <= t.cols && p.r >= 1 && p.r <= t.rows;
    }
    function sort(desc) {
      if (!inTable()) { say('nudge', 'Select a cell inside the data table (columns with a header in row 1) first.'); return; }
      X.sortTable(sh, X.colName(X.parseAddr(sel).c), desc);
      changed();
    }
    function filter() {
      const p = X.parseAddr(sel);
      if (!inTable() || p.r < 2) { say('nudge', 'Select a data cell with the value you want to keep first.'); return; }
      sh.filter = { col: X.colName(p.c), value: X.toText(X.evaluator(sh).value(sel)) };
      changed();
    }
    function buildPivot() {
      sh.pivot = { rows: pvRows.value, values: pvVals.value, agg: pvAgg.value };
      changed();
    }

    function render() {
      const ev = X.evaluator(sh), b = X.bounds(sh), t = X.table(sh);
      const cols = Math.max(b.cols + 1, 6), rows = Math.max(b.rows + 2, 12);
      const visible = new Set(X.visibleRows(sh));
      const head = h('tr', null, h('th', { class: 'corner' }), ...Array.from({ length: cols }, (_, i) => h('th', null, X.colName(i + 1))));
      const body = [];
      for (let r = 1; r <= rows; r++) {
        if (sh.filter && r >= 2 && r <= t.rows && !visible.has(r)) continue;
        const tds = [h('th', { class: 'rownum' }, r)];
        for (let c = 1; c <= cols; c++) {
          const a = X.addr(c, r), v = ev.at(c, r), raw = sh.cells[a];
          const cls = ['cell', typeof v === 'number' ? 'num' : '', X.isErr(v) ? 'err' : '', r === 1 && c <= t.cols ? 'hdr' : '',
            targets.has(a) ? 'target' : '', a === sel ? 'sel' : '', typeof raw === 'string' && raw.startsWith('=') ? 'formula' : ''].join(' ');
          tds.push(h('td', { class: cls, onclick: () => { select(a); bar.focus(); } }, show(v)));
        }
        body.push(h('tr', null, ...tds));
      }
      gridWrap.replaceChildren(...[
        sh.filter ? h('div', { class: 'muted small xl-filter' }, 'Filter on: column ' + sh.filter.col + ' = "' + sh.filter.value + '" (' + visible.size + ' rows shown)') : null,
        h('table', { class: 'xl-grid' }, h('thead', null, head), h('tbody', null, ...body))].filter(Boolean));
      if (sh.pivot) {
        const pv = X.pivot(sh, sh.pivot);
        const hdr = X.headers(sh), nameOf = col => (hdr.find(x => x.col === col) || {}).name || col;
        pivotOut.replaceChildren(h('div', { class: 'muted small' }, 'Pivot table'),
          h('table', { class: 'rtable' },
            h('thead', null, h('tr', null, h('th', null, nameOf(sh.pivot.rows)), h('th', null, sh.pivot.agg[0] + sh.pivot.agg.slice(1).toLowerCase() + ' of ' + nameOf(sh.pivot.values)))),
            h('tbody', null, ...pv.rows.map(row => h('tr', null, h('td', null, row.label), h('td', null, show(row.value)))),
              h('tr', { class: 'total' }, h('td', null, 'Grand total'), h('td', null, show(pv.total))))));
      } else pivotOut.replaceChildren();
    }

    function check(viaSolution) {
      if (solved) { say('sys', 'Already solved: keep playing with the sheet if you like.'); return; }
      feedback.replaceChildren();
      const r = T.evaluate(mission, sh);
      const mistakes = r.ok ? [] : T.detectMistakes(mission, sh, r);
      if (r.ok) {
        const res = api.attempt({ ok: true, viaSolution: !!viaSolution });
        solved = true;
        say('ok', res.points ? 'Nice! +' + res.points + ' points.' : 'Done! This one is saved for review later.');
        if (mission.note) say('note', mission.note);
        nextBtn.hidden = false;
        nextBtn.focus();
        return;
      }
      if (viaSolution) { say('nudge', 'The official solution did not match. Please report this mission.'); return; }
      api.attempt({ ok: false, diagnosis: T.diagnose(mission, sh, r), mistakes });
      say('nudge', NUDGES[Math.floor(Math.random() * NUDGES.length)]);
      if (mistakes.length) say('tip', 'Tip: ' + mistakes[0].tip);
    }

    bar.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(true); }
      else if (e.key === 'Tab') { e.preventDefault(); const p = X.parseAddr(sel); commit(false); select(X.addr(p.c + 1, p.r)); bar.focus(); }
      else if (e.key === 'Escape') { select(sel); }
    });

    return {
      load(m, inf) {
        mission = m; solved = false;
        targets = new Set(m.targets ? X.rangeCells(m.targets) : []);
        const saved = drafts()[m.id];
        sh = saved && saved.cells ? X.clone(saved) : T.startSheet(m);
        const ts = m.tools || [];
        toolRow.replaceChildren(...['fill', 'sort', 'filter'].filter(k => ts.includes(k)).map(k => tools[k]));
        toolRow.hidden = !toolRow.childElementCount;
        pivotPanel.hidden = !ts.includes('pivot');
        const hdr = X.headers(sh);
        for (const s of [pvRows, pvVals]) s.replaceChildren(...hdr.map(x => h('option', { value: x.col }, x.name + ' (' + x.col + ')')));
        if (sh.pivot) { pvRows.value = sh.pivot.rows; pvVals.value = sh.pivot.values; pvAgg.value = sh.pivot.agg; }
        nextBtn.hidden = true;
        nextBtn.textContent = inf.mi + 1 < inf.level.missions.length ? 'Next mission ▸' : 'Finish level ▸';
        feedback.replaceChildren();
        if (saved) say('sys', 'Your work on this mission was restored. "Reset sheet" starts over.');
        select(firstTarget());
      },
      prefill() {
        const step = mission.solution.steps.find(s => s.set);
        if (step) { select(step.set); bar.value = step.v; bar.focus(); }
      },
      runSolution() {
        if (solved) return;
        sh = T.applySteps(T.startSheet(mission), mission.solution.steps);
        changed();
        check(true);
      },
      destroy() {},
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
