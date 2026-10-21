// Run: node tests/final.test.js
// The Final Case steps point at real ceiling missions and keep their checks working.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const base = path.join(__dirname, '..');
globalThis.OT = { ui: { h: () => null } };
for (const f of ['js/data.js', 'js/tracks/bash/sim.js', 'js/tracks/bash/missions.js', 'js/tracks/sql/missions.js',
  'js/tracks/excel/formula.js', 'js/tracks/excel/missions.js', 'js/tracks/python/harness.js', 'js/tracks/python/missions.js', 'js/tracks/final/case.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
}
const T = globalThis.OT.tracks;
const F = T.final;
let failures = 0;
const check = (name, fn) => { try { fn(); } catch (e) { failures++; console.log('FAIL', name, '-', e.message); } };

check('six steps, ids unique and not reused from tracks', () => {
  assert.strictEqual(F.flat.length, 6);
  const ids = F.flat.map(x => x.mission.id);
  assert.strictEqual(new Set(ids).size, 6);
  for (const id of ids) for (const k of ['bash', 'sql', 'excel', 'python']) assert(!T[k].flat.some(x => x.mission.id === id), id + ' clashes with ' + k);
});
check('every step has the hint and solution fields', () => F.flat.forEach(({ mission: m }) => {
  for (const k of ['brief', 'concept', 'skeleton']) assert(m[k], m.id + ' ' + k);
  assert(m.solution.cmd && m.solution.parts.length, m.id + ' solution');
}));
check('bash step replays the world and its solution passes', () => {
  const m = F.flat.find(x => x.mission.kind === 'bash').mission;
  const st = T.bash.buildWorldAt(m.baseGi);
  if (m.setup) m.setup(st);
  assert(m.check(OT.bashSim.runLine(m.solution.cmd, st), st, m.solution.cmd) === true);
});
check('excel step solution passes', () => {
  const m = F.flat.find(x => x.mission.kind === 'excel').mission;
  assert(T.excel.evaluate(m, T.excel.applySteps(T.excel.startSheet(m), m.solution.steps)).ok);
});
check('cheat sheet covers the four tracks and the checklist', () => assert.strictEqual(F.cheatUpTo(0).length, 5));

console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
