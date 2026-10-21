/* Python track view: files, code editor, run button, output and test results. */
(function (root) {
  'use strict';
  const OT = root.OT;
  const T = OT.tracks.python;
  const R = OT.pyRunner;
  const { h } = OT.ui;
  const TIMEOUT = 5000;

  const NUDGES = [
    'Not yet. Read the first failing test; hints are on the left if you want them.',
    'Close. Look at what your code printed and what the test expected.',
    "No worries, that's part of the game. Give it another go.",
    "That's not it yet. If you get stuck, hint 1 tells you which part to check.",
  ];
  const STATUS = {
    loading: 'Loading Python (Pyodide, about 10 MB the first time, cached afterwards)…',
    ready: 'Python ready · Ctrl+Enter runs the tests · runs longer than 5 s are stopped',
    running: 'Running… (stopped after 5 seconds)',
    stopped: 'Stopped after 5 seconds. Python restarts on the next run.',
    failed: 'Python could not load. It needs an internet connection; reload the page to retry.',
  };

  T.createView = function (pane, api) {
    const files = h('div', { class: 'py-files' });
    const input = h('textarea', { class: 'sql-input py-input', rows: 12, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Python code' });
    const runBtn = h('button', { class: 'primary', type: 'button', onclick: () => submit() }, 'Run tests ▸');
    const nextBtn = h('button', { class: 'primary', type: 'button', hidden: true, onclick: () => api.next() }, 'Next mission ▸');
    const reset = h('button', { class: 'ghost', type: 'button', onclick: () => { input.value = mission.starter; saveDraft(); } }, '↺ Reset code');
    const status = h('span', { class: 'muted small' });
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const output = h('div', { class: 'py-output' });
    pane.replaceChildren(h('div', { class: 'sqlpane' }, files,
      h('div', { class: 'editor' }, input, h('div', { class: 'editor-actions' }, runBtn, nextBtn, reset, status)),
      feedback, output));

    let mission = null, solved = false, busy = false;
    const off = R.onStatus(s => { status.textContent = STATUS[s] || ''; });
    R.ready().catch(() => { status.textContent = STATUS.failed; });

    const drafts = () => { const t = OT.store.track('python'); t.extra.drafts = t.extra.drafts || {}; return t.extra.drafts; };
    function saveDraft() { drafts()[mission.id] = input.value; OT.store.save(); }
    function say(type, text) { feedback.append(h('div', { class: 'line ' + type }, text)); }

    function showFiles() {
      const fs = mission.datasets ? mission.datasets[0] : null;
      if (!fs) { files.replaceChildren(); return; }
      files.replaceChildren(...Object.keys(fs).map(name => {
        const lines = fs[name].split('\n');
        return h('details', { class: 'py-file' },
          h('summary', null, h('code', null, name), ' · ' + (lines.length - 2) + ' data rows · peek'),
          h('pre', null, lines.slice(0, 8).join('\n') + (lines.length > 9 ? '\n…' : '')));
      }));
    }
    function showResult(r) {
      const parts = [];
      if (r.timeout) parts.push(h('div', { class: 'line err' }, 'Stopped: your code ran for more than 5 seconds.'));
      if (r.crash) parts.push(h('div', { class: 'line err' }, 'Python error: ' + r.crash));
      if (r.stdout) parts.push(h('div', { class: 'muted small' }, 'Output'), h('pre', { class: 'py-stdout' }, r.stdout));
      if (r.error) parts.push(h('div', { class: 'line err' }, r.error.type + (r.error.line ? ' on line ' + r.error.line : '') + ': ' + r.error.msg + (r.error.dataset ? ' (second payments.csv)' : '')));
      if (r.tests && r.tests.length && !r.error) {
        parts.push(h('div', { class: 'muted small' }, 'Tests'), h('ul', { class: 'py-tests' }, ...r.tests.map(x =>
          h('li', { class: x.ok ? 'ok' : 'fail' }, (x.ok ? '✓ ' : '✗ ') + x.name, x.ok ? null : h('div', { class: 'py-msg' }, x.msg)))));
      }
      output.replaceChildren(...parts);
    }

    async function submit(viaSolution) {
      if (busy) return;
      if (solved) { say('sys', 'Already solved: keep experimenting if you like.'); }
      busy = true; runBtn.disabled = true;
      feedback.replaceChildren();
      saveDraft();
      let r;
      try { r = await R.run(input.value, T.specOf(mission), TIMEOUT); }
      catch (e) { r = { crash: e.message }; }
      busy = false; runBtn.disabled = false;
      showResult(r);
      if (solved) return;
      if (T.passed(r)) {
        const res = api.attempt({ ok: true, viaSolution: !!viaSolution });
        solved = true;
        say('ok', res.points ? 'All tests pass! +' + res.points + ' points.' : 'Done! This one is saved for review later.');
        if (mission.note) say('note', mission.note);
        nextBtn.hidden = false;
        nextBtn.focus();
        return;
      }
      if (r.crash && /load|internet|connection/i.test(r.crash)) { say('nudge', r.crash); return; }
      if (viaSolution) { say('nudge', 'The official solution did not pass. Please report this mission.'); return; }
      const mistakes = T.detectMistakes(mission, input.value, r);
      api.attempt({ ok: false, diagnosis: T.diagnose(mission, input.value, r), mistakes });
      say('nudge', NUDGES[Math.floor(Math.random() * NUDGES.length)]);
      if (mistakes.length) say('tip', 'Tip: ' + mistakes[0].tip);
    }

    // Editor comfort: Tab = 4 spaces, Enter keeps the indentation (and adds a level after ":").
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (solved) api.next(); else submit(); return; }
      const v = input.value, s = input.selectionStart, end = input.selectionEnd;
      if (e.key === 'Tab') {
        e.preventDefault();
        input.setRangeText('    ', s, end, 'end');
      } else if (e.key === 'Enter') {
        const lineStart = v.lastIndexOf('\n', s - 1) + 1;
        const line = v.slice(lineStart, s);
        let indent = (line.match(/^ */) || [''])[0];
        if (/:\s*$/.test(line)) indent += '    ';
        e.preventDefault();
        input.setRangeText('\n' + indent, s, end, 'end');
      } else return;
      saveDraft();
    });
    input.addEventListener('input', saveDraft);

    return {
      load(m, inf) {
        mission = m; solved = false;
        input.value = drafts()[m.id] ?? m.starter;
        nextBtn.hidden = true;
        nextBtn.textContent = inf.mi + 1 < inf.level.missions.length ? 'Next mission ▸' : 'Finish level ▸';
        feedback.replaceChildren();
        output.replaceChildren(h('div', { class: 'muted small' }, 'Write your code above and run the tests. What you print shows up here.'));
        showFiles();
      },
      prefill(code) { input.value = code; saveDraft(); input.focus(); },
      runSolution() { if (!solved) { input.value = mission.solution.cmd; submit(true); } },
      destroy() { off(); },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
