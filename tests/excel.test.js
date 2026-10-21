// Run: node tests/excel.test.js
// Formula engine unit checks, then every Excel mission: official steps pass, the untouched sheet
// does not, equivalent answers are accepted, and common mistakes fail with the right tip.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const base = path.join(__dirname, '..');
for (const f of ['js/data.js', 'js/tracks/excel/formula.js', 'js/tracks/excel/missions.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
}
const X = globalThis.OT.sheet;
const T = globalThis.OT.tracks.excel;
let failures = 0;
const check = (name, fn) => { try { fn(); } catch (e) { failures++; console.log('FAIL', name, '-', e.message); } };

// ---- engine ----
const ev = cells => X.evaluator(X.newSheet(cells));
check('arithmetic and precedence', () => {
  const e = ev({ A1: 2, A2: 3, B1: '=A1+A2*2', B2: '=(A1+A2)*2', B3: '=-A1^2', B4: '=A1/0', B5: '="x"&A1&"y"', B6: '=A1>1', B7: '=10/4' });
  assert.deepStrictEqual(['B1', 'B2', 'B3', 'B5', 'B6', 'B7'].map(e.value), [8, 10, 4, 'x2y', true, 2.5]);
  assert.strictEqual(e.value('B4').e, '#DIV/0!');
});
check('functions and aliases', () => {
  const e = ev({ A1: 1, A2: 2, A3: 'x', A4: 4, B1: '=SUM(A1:A4)', B2: '=SUMA(A1:A4)', B3: '=COUNT(A1:A4)', B4: '=COUNTA(A1:A4)', B5: '=AVERAGE(A1:A4)',
    B6: '=SI(A1>0;"pos";"neg")', B7: '=ROUND(10/3,2)', B8: '=TRIM("  a  b ")', B9: '=FOO(A1)', B10: '=IFERROR(1/0,"z")', B11: '=MAX(A1:A4)-MIN(A:A)' });
  assert.deepStrictEqual(['B1', 'B2', 'B3', 'B4', 'B6', 'B7', 'B8', 'B10', 'B11'].map(e.value), [7, 7, 3, 4, 'pos', 3.33, 'a b', 'z', 3]);
  assert(Math.abs(e.value('B5') - 7 / 3) < 1e-9);
  assert.strictEqual(e.value('B9').e, '#NAME?');
});
check('criteria', () => {
  const e = ev({ A1: 50, A2: 150, A3: 'DJ Pampa', A4: 'dj pampa', B1: '=COUNTIF(A1:A4,">100")', B2: '=COUNTIF(A1:A4,"DJ Pampa")', B3: '=SUMIF(A1:A2,"<100")',
    B4: '=COUNTIF(A1:A4,"<>50")', B5: '=COUNTIF(A1:A4,"dj*")', B6: '=COUNTIFS(A1:A4,">10",A1:A4,"<100")' });
  assert.deepStrictEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].map(e.value), [1, 2, 50, 3, 2, 1]);
});
check('lookups', () => {
  const e = ev({ A1: 'b', B1: 2, A2: 'a', B2: 1, A3: 'c', B3: 3, C1: '=VLOOKUP("A",A1:B3,2,FALSE)', C2: '=XLOOKUP("c",A1:A3,B1:B3)', C3: '=XLOOKUP("z",A1:A3,B1:B3,"none")',
    C4: '=VLOOKUP("z",A1:B3,2,FALSE)', C5: '=VLOOKUP("a",A1:B3,3,FALSE)' });
  assert.deepStrictEqual(['C1', 'C2', 'C3'].map(e.value), [1, 3, 'none']);
  assert.strictEqual(e.value('C4').e, '#N/A');
  assert.strictEqual(e.value('C5').e, '#REF!');
});
check('fill down shifts only relative parts', () => {
  assert.strictEqual(X.shift('=COUNTIF($B$2:$B$16,G2)', 3, 0), '=COUNTIF($B$2:$B$16,G5)');
  assert.strictEqual(X.shift('=COUNTIF($F$2:F2,F2)', 1, 0), '=COUNTIF($F$2:F3,F3)');
  assert.strictEqual(X.shift('=B2&" | B2 "&C2', 1, 0), '=B3&" | B2 "&C3');
  assert.strictEqual(X.shift('=I2/$I$10', 2, 0), '=I4/$I$10');
});
check('circular and broken formulas', () => {
  const e = ev({ A1: '=A2', A2: '=A1', B1: '=SUM(A1:', B2: '=(1+2' });
  assert.strictEqual(e.value('A1').e, '#CIRC');
  assert.strictEqual(e.value('B1').e, '#ERROR');
  assert.strictEqual(e.value('B2').e, '#ERROR');
});

// ---- missions ----
const byId = Object.fromEntries(T.flat.map(x => [x.mission.id, x.mission]));
const solved = m => T.applySteps(T.startSheet(m), m.solution.steps);
for (const { mission: m } of T.flat) {
  check('solution ' + m.id, () => {
    const r = T.evaluate(m, solved(m));
    assert(r.ok, JSON.stringify(r));
    const untouched = T.evaluate(m, T.startSheet(m));
    assert(!untouched.ok, 'the untouched sheet must not pass');
    assert(T.diagnose(m, T.startSheet(m), untouched));
  });
}
check('numbers match the SQL track', () => {
  const sh = solved(byId['client-table']), e = X.evaluator(sh);
  assert.strictEqual(e.value('M7'), 755.5);
  assert.deepStrictEqual(['M2', 'M3', 'M4', 'M5', 'M6'].map(e.value), [220, 185, 140, 115, 95.5]);
  assert.deepStrictEqual(['L2', 'L3', 'L4', 'L5', 'L6'].map(e.value), ['Chile', 'Argentina', 'Mexico', 'Spain', 'Colombia']);
});

// Equivalent answers: [mission, steps]
const ALT = [
  ['sum', [{ set: 'C17', v: '=sum(c2:c15)' }]],
  ['sum', [{ set: 'C17', v: '=SUMA(C2:C15)' }]],
  ['countif', [{ set: 'H2', v: '=CONTAR.SI(B2:B16;G2)' }]],
  ['countif', [{ set: 'H2', v: '=COUNTIF(B:B,"Andes Trío")' }]],
  ['abs-count', [{ set: 'H2', v: '=COUNTIF(B$2:B$16,G2)' }, { fill: 'H2', to: 9 }]],
  ['vlookup-fill', [{ set: 'F2', v: '=VLOOKUP(B2,$L$2:$M$10,2,0)' }, { fill: 'F2', to: 16 }]],
  ['vlookup-bug', [{ set: 'F2', v: '=XLOOKUP(B2,$L$2:$L$10,$M$2:$M$10)' }, { fill: 'F2', to: 16 }]],
  ['key', [{ set: 'F2', v: '=B2&C2' }, { fill: 'F2', to: 16 }]],
  ['count-key', [{ set: 'G2', v: '=COUNTIFS($B$2:$B$16,B2,$C$2:$C$16,C2)' }, { fill: 'G2', to: 16 }]],
  ['copy-number', [{ set: 'G2', v: '=COUNTIFS($B$2:B2,B2,$C$2:C2,C2)' }, { fill: 'G2', to: 16 }]],
  ['pivot-count', [{ pivot: { rows: 'B', values: 'C', agg: 'COUNT' } }]],
  ['sort-amount', [{ sort: 'B' }, { sort: 'D', desc: true }]],
  ['client-table', [{ set: 'L2', v: '=VLOOKUP(K2,$O$2:$P$10,2,FALSE)' }, { fill: 'L2', to: 6 }, { set: 'M2', v: '=SUMIFS($H$2:$H$16,$B$2:$B$16,K2)' }, { fill: 'M2', to: 6 }, { set: 'M7', v: '=M2+M3+M4+M5+M6' }]],
];
for (const [id, steps] of ALT) {
  check('alt ' + id + ' ' + JSON.stringify(steps[0]).slice(0, 60), () => {
    const m = byId[id]; const r = T.evaluate(m, T.applySteps(T.startSheet(m), steps));
    assert(r.ok, JSON.stringify(r));
  });
}
// Wrong answers: [mission, steps, expected kind, expected tip or null]
const WRONG = [
  ['sum', [{ set: 'C17', v: 'SUM(C2:C15)' }], 'notFormula', 'missing-equals'],
  ['sum', [{ set: 'C17', v: '1234' }], 'notFormula', null],
  ['sum', [{ set: 'C17', v: '=SUM(C2:C14)' }], 'wrong', null],
  ['abs-count', [{ set: 'H2', v: '=COUNTIF(B2:B16,G2)' }, { fill: 'H2', to: 9 }], 'wrongLater', 'relative-fill'],
  ['abs-sum', [{ set: 'I2', v: '=SUMIF($B$2:$B$16,G2,$D$2:$D$16)' }], 'notFilled', null],
  ['criteria', [{ set: 'H12', v: '=COUNTIF(D2:D16,>100)' }], 'error', 'criteria-quotes'],
  ['vlookup-fill', [{ set: 'F2', v: '=VLOOKUP(B2,$L$2:$M$10,2)' }, { fill: 'F2', to: 16 }], 'wrongLater', 'vlookup-approx'],
  ['vlookup', [{ set: 'F2', v: '=VLOOKUP(B2,$L$2:$M$10,3,FALSE)' }], 'error', 'vlookup-column'],
  ['vlookup', [{ set: 'F2', v: '=XLOOKUP(B2,$L$2:$L$10,$M$2:$M$10)' }], 'uses', null],
  ['not-found', [{ set: 'F2', v: '=XLOOKUP(B2,$L$2:$L$10,$M$2:$M$10)' }, { fill: 'F2', to: 7 }], 'error', 'lookup-not-found'],
  ['flag', [{ set: 'H2', v: '=IF(G2>1,DUP,OK)' }], 'error', 'unquoted-text'],
  ['sum', [{ set: 'C17', v: '=TOTAL(C2:C15)' }], 'error', 'unsupported-function'],
  ['sum', [{ set: 'C17', v: '=C17+1' }], 'error', 'circular'],
  ['key', [{ set: 'F2', v: '=B2' }, { fill: 'F2', to: 16 }], 'keyWrong', null],
  ['sort-amount', [{ sort: 'D' }], 'sortOrder', null],
  ['filter', [{ filter: 'B', value: 'Luna Ferreyra' }], 'wrongFilter', null],
  ['pivot-sum', [{ pivot: { rows: 'B', values: 'D', agg: 'COUNT' } }], 'wrongPivot', null],
  ['copy-number', [{ set: 'G2', v: '=COUNTIF($F$2:$F$16,F2)' }, { fill: 'G2', to: 16 }], 'wrong', null],
];
for (const [id, steps, kind, tip] of WRONG) {
  check('wrong ' + id + ' ' + JSON.stringify(steps[0]).slice(0, 60), () => {
    const m = byId[id]; const sh = T.applySteps(T.startSheet(m), steps);
    const r = T.evaluate(m, sh);
    assert(!r.ok, 'should fail');
    assert.strictEqual(r.kind, kind);
    const d = T.diagnose(m, sh, r);
    assert(d && !d.includes(m.solution.cmd.split('\n')[0]), 'hint 1 present and not the solution');
    const tips = T.detectMistakes(m, sh, r).map(x => x.id);
    if (tip) assert(tips.includes(tip), 'expected tip ' + tip + ', got ' + tips);
  });
}
check('no tips on official solutions', () => {
  for (const { mission: m } of T.flat) {
    const sh = solved(m); const tips = T.detectMistakes(m, sh, T.evaluate(m, sh)).map(x => x.id);
    assert.deepStrictEqual(tips, [], m.id + ': ' + tips);
  }
});

for (const [id, steps] of WRONG.slice(0, 7).map(w => [w[0], w[1]])) {
  const m = byId[id]; const sh = T.applySteps(T.startSheet(m), steps); const r = T.evaluate(m, sh);
  console.log(`  [${id}] ${JSON.stringify(steps[0])}\n      -> ${T.diagnose(m, sh, r)}  {${T.detectMistakes(m, sh, r).map(x => x.id)}}`);
}
console.log(`\n${T.flat.length} missions: ` + T.levels.map(l => `${l.title} (${l.missions.length})`).join(' | '));
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
