// Run: node tests/bash.test.js
// Plays every Bash mission with its official solution (in order and via jump-in),
// checks that common wrong answers fail, and that hint 1 never leaks the answer.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..', 'js');
for (const f of ['data.js', 'tracks/bash/sim.js', 'tracks/bash/missions.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
}
const S = globalThis.OT.bashSim;
const T = globalThis.OT.tracks.bash;
let failures = 0;
const check = (name, fn) => { try { fn(); } catch (e) { failures++; console.log('FAIL', name, '-', e.message); } };

function attempt(st, m, cmd) {
  if (m.setup) m.setup(st);
  const res = S.runLine(cmd, st);
  return { res, pass: m.check(res, st, cmd) === true };
}

// 1. Continuous play-through, like a player who solves everything in order.
check('continuous play', () => {
  const st = S.freshState();
  for (const { mission: m, gi } of T.flat) {
    const { res, pass } = attempt(st, m, m.solution.cmd);
    assert(pass, `#${gi + 1} ${m.id} failed: ${JSON.stringify(res)}`);
  }
});

// 2. Jumping straight into any mission rebuilds the disk correctly.
for (const { mission: m, gi } of T.flat) {
  check('jump ' + m.id, () => {
    const st = T.buildWorldAt(gi);
    const { res, pass } = attempt(st, m, m.solution.cmd);
    assert(pass, `jump to #${gi + 1} ${m.id} failed: ${JSON.stringify(res)}`);
  });
}

// 3. Alternative correct answers are accepted.
const ALT = {
  'cat': 'less readme.txt',
  'wc-file': 'cat notes.txt | wc -l',
  'grep-i': 'grep -i vendor *.txt',
  'grep-ri': 'grep -ir urgent .',
  'log-count': 'grep ERROR logs/import_2026-08-14.log | wc -l',
  'log-all': 'grep -r duplicate_batch .',
  'csv-head': 'head -5 exports/payments.csv',
  'csv-uniq': 'cut -d"," -f2 exports/payments.csv | sort | uniq -c | sort -rn',
  'dup-distinct': 'grep -r duplicate_batch logs | cut -d= -f2 | sort | uniq -c | wc -l',
  'env-name': 'export NAME=Ana; echo "Hi, $NAME"',
  'run-script': 'bash run.sh',
};
// 4. Common wrong answers must fail.
const WRONG = {
  'cat-relative': 'cd notes; cat todo.txt',
  'cp': 'mv notes.txt notes_backup.txt',
  'grep-i': 'grep vendor q2.txt',
  'grep-r': 'grep URGENT *.txt',
  'grep-ri': 'grep -r urgent .',
  'redir-append': 'echo "Backup complete" > log.txt',
  'redir-save': 'ls | filelist.txt',
  'run-script': 'run.sh',
  'log-count': 'grep ERROR logs/import_2026-08-14.log',
  'log-lines': 'grep -n ERROR logs/*.log',
  'csv-head': 'head exports/payments.csv',
  'csv-cut': 'cut -d, -f3 exports/payments.csv',
  'dup-save': 'grep -r duplicate_batch logs > reports/duplicates.txt',
  'dup-append': 'echo "Reviewed on $(date +%F)" > reports/duplicates.txt',
  'script-run': './scripts/check_logs.sh',
};
const byId = Object.fromEntries(T.flat.map(x => [x.mission.id, x]));
for (const [id, cmd] of Object.entries(ALT)) {
  check('alt ' + id, () => { const { mission, gi } = byId[id]; assert(attempt(T.buildWorldAt(gi), mission, cmd).pass, cmd); });
}
for (const [id, cmd] of Object.entries(WRONG)) {
  check('wrong ' + id, () => { const { mission, gi } = byId[id]; assert(!attempt(T.buildWorldAt(gi), mission, cmd).pass, cmd); });
}

// 5. Hint 1 + mistake detectors: never throw, never reveal the full solution.
const SAMPLES = ['', 'ls', 'lss', 'grep', 'cd nowhere', 'echo "unclosed', 'cat x | | wc', 'run.sh', 'find . -name', 'cut -f2', 'sort -rn', 'head -n'];
for (const { mission: m, gi } of T.flat) {
  check('diagnose ' + m.id, () => {
    for (const cmd of SAMPLES.concat(WRONG[m.id] ? [WRONG[m.id]] : [])) {
      const st = T.buildWorldAt(gi);
      if (m.setup) m.setup(st);
      const res = S.runLine(cmd, st);
      const d = cmd ? T.diagnose(m, cmd, res) : '';
      if (d) assert(!d.includes(m.solution.cmd), `hint 1 leaks solution for ${m.id}: ${d}`);
      T.detectMistakes(m, cmd, res, st);
    }
  });
}

// Show a few diagnoses so their wording can be reviewed.
for (const id of ['grep-i', 'grep-r', 'redir-append', 'run-script', 'log-count', 'csv-cut', 'dup-save', 'cp']) {
  const { mission, gi } = byId[id];
  const st = T.buildWorldAt(gi); if (mission.setup) mission.setup(st);
  const res = S.runLine(WRONG[id], st);
  const tips = T.detectMistakes(mission, WRONG[id], res, st).map(x => x.id).join(', ');
  console.log(`  [${id}] "${WRONG[id]}" -> ${T.diagnose(mission, WRONG[id], res)}  {${tips}}`);
}

const levels = T.levels.map(l => `${l.title} (${l.missions.length})`).join(' | ');
console.log(`\n${T.flat.length} missions: ${levels}`);
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
