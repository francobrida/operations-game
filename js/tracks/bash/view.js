/* Bash track view: the fake terminal. Evaluates commands and reports to the engine. */
(function (root) {
  'use strict';
  const OT = root.OT;
  const T = OT.tracks.bash;
  const S = OT.bashSim;
  const { h } = OT.ui;

  const NUDGES = [
    'Not yet. Reread the task and try again; hints are on the left if you want them.',
    'Close. Look at what the terminal returned and adjust.',
    "No worries, that's part of the game. Give it another go.",
    "That's not it yet. If you get stuck, hint 1 tells you which part to check.",
  ];

  T.createView = function (pane, api) {
    const body = h('div', { class: 'term-body', role: 'log', 'aria-live': 'polite' });
    const prompt = h('span', { class: 'prompt' });
    const title = h('span', { class: 'term-title' });
    const input = h('input', { class: 'term-input', type: 'text', autocomplete: 'off', autocapitalize: 'off',
      spellcheck: 'false', 'aria-label': 'Bash command', placeholder: 'type a command and press Enter' });
    const restore = h('button', { class: 'ghost small', type: 'button',
      title: 'Puts the files back as they were when this mission started', onclick: restoreWorld }, '↺ Restore files');
    const term = h('div', { class: 'term' },
      h('div', { class: 'term-bar' }, h('i', { class: 'dot r' }), h('i', { class: 'dot y' }), h('i', { class: 'dot g' }), title, restore),
      body,
      h('div', { class: 'term-input-row' }, prompt, input));
    pane.replaceChildren(term);
    term.addEventListener('click', e => { if (!e.target.closest('button') && !window.getSelection().toString()) input.focus(); });

    let world = null, mission = null, info = null, busy = false;
    const history = []; let hpos = 0;

    function print(type, text) {
      const div = h('div', { class: 'line ' + type });
      if (type === 'cmd') div.append(h('span', { class: 'p' }, S.promptPath(world.cwd) + '$'), ' ' + text);
      else div.textContent = text;
      body.append(div);
      body.scrollTop = body.scrollHeight;
    }
    function refresh() {
      prompt.textContent = S.promptPath(world.cwd) + '$';
      title.textContent = 'yury@sonora:' + S.promptPath(world.cwd);
    }
    function persist() { OT.store.track('bash').extra.world = world; OT.store.save(); }

    function ensureWorld(gi) {
      const t = OT.store.track('bash');
      let w = t.extra.world;
      if (!w || !w.fs || w.pos !== gi) {
        const st = T.buildWorldAt(gi);
        w = { fs: st.fs, cwd: st.cwd, env: st.env, pos: gi };
        t.extra.world = w;
      }
      return w;
    }
    function restoreWorld() {
      const st = T.buildWorldAt(info.gi);
      Object.assign(world, { fs: st.fs, cwd: st.cwd, env: st.env, pos: info.gi });
      if (mission.setup) mission.setup(world);
      persist(); refresh();
      print('sys', 'Files restored: everything is as it was when this mission started.');
      input.focus();
    }

    function load(m, inf) {
      mission = m; info = inf; busy = false;
      world = ensureWorld(inf.gi);
      if (m.setup) m.setup(world);
      persist(); refresh();
      if (inf.mi === 0 || !body.childElementCount) {
        body.replaceChildren();
        print('sys', 'Level ' + (inf.li + 1) + ': ' + inf.level.title + '. ' + inf.level.intro);
      }
      print('sys', '');
      print('sys', '— Mission ' + (inf.mi + 1) + ': ' + m.title + ' —');
      print('sys', m.brief);
      input.disabled = false;
      input.focus();
    }

    function succeed(r) {
      world.pos = info.gi + 1;
      persist();
      print('ok', r.points ? 'Nice! +' + r.points + ' points.' : 'Done! This one is saved for review later.');
      if (mission.note) print('note', mission.note);
      busy = true; input.disabled = true;
      const solved = mission;
      setTimeout(() => { if (mission === solved) api.next(); }, 900);
    }

    function submit() {
      const raw = input.value;
      if (!raw.trim() || busy) return;
      history.push(raw); hpos = history.length;
      print('cmd', raw);
      input.value = '';
      const cmd = raw.trim();
      if (cmd === 'clear') { body.replaceChildren(); return; }
      if (cmd === 'help') {
        for (const sec of T.cheatUpTo(info.li)) {
          print('out', sec.title + ':');
          for (const [c, d] of sec.rows) print('out', '  ' + c.padEnd(28) + d);
        }
        print('sys', '"clear" wipes the screen. Progress saves automatically.');
        return;
      }
      const res = S.runLine(raw, world);
      refresh();
      if (res.error) print('err', res.error);
      if (res.stdout) print('out', res.stdout);
      let pass = false;
      try { pass = mission.check(res, world, raw) === true; } catch (e) { pass = false; }
      if (pass) { succeed(api.attempt({ ok: true })); return; }

      const mistakes = T.detectMistakes(mission, raw, res, world);
      api.attempt({ ok: false, diagnosis: T.diagnose(mission, raw, res), mistakes });
      persist();
      let partial = null;
      if (mission.partial) { try { partial = mission.partial(res, world); } catch (e) { partial = null; } }
      if (partial) { print('tip', partial); return; }
      print('nudge', NUDGES[Math.floor(Math.random() * NUDGES.length)]);
      if (mistakes.length) print('tip', 'Tip: ' + mistakes[0].tip);
    }

    function runSolution() {
      if (busy) return;
      const cmd = mission.solution.cmd;
      print('cmd', cmd);
      const res = S.runLine(cmd, world);
      refresh();
      if (res.error) print('err', res.error);
      if (res.stdout) print('out', res.stdout);
      let pass = false;
      try { pass = mission.check(res, world, cmd) === true; } catch (e) { pass = false; }
      if (!pass) { print('nudge', 'That did not work: some file changed along the way. Click "Restore files" and try again.'); return; }
      succeed(api.attempt({ ok: true, viaSolution: true }));
    }

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { submit(); }
      else if (e.key === 'ArrowUp') { if (hpos > 0) input.value = history[--hpos]; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { hpos = Math.min(hpos + 1, history.length); input.value = history[hpos] || ''; e.preventDefault(); }
    });

    return {
      load, runSolution,
      prefill(cmd) { input.value = cmd; input.focus(); },
      destroy() { busy = true; },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
