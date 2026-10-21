// Run: node tests/python.test.js   (needs a local Python 3 on the PATH as "python")
// Runs the same harness the browser uses (in Pyodide) on local CPython: every official solution
// passes, starter code fails, valid alternatives pass, common mistakes fail with the right tip.
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { execFileSync } = require('child_process');

const base = path.join(__dirname, '..');
for (const f of ['js/data.js', 'js/tracks/python/harness.js', 'js/tracks/python/missions.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
}
const OT = globalThis.OT, T = OT.tracks.python;
const byId = Object.fromEntries(T.flat.map(x => [x.mission.id, x.mission]));
let failures = 0;
const check = (name, fn) => { try { fn(); } catch (e) { failures++; console.log('FAIL', name, '-', e.message); } };

const cases = [];
const add = (label, id, code, expect) => cases.push({ label, id, code, expect });
for (const { mission: m } of T.flat) {
  add('solution', m.id, m.solution.cmd, { pass: true });
  add('starter', m.id, m.starter, { pass: false });
}
const L = "import csv\n\nwith open('payments.csv') as f:\n    rows = list(csv.DictReader(f))\n";
// valid alternatives
add('alt', 'for-loop', 'amounts = [125, 60, 101, 80, 220]\ntotal = 0\nfor a in amounts:\n    total += a\n', { pass: true });
add('alt', 'if-else', "def size(amount):\n    return 'big' if amount >= 150 else 'small'\n", { pass: true });
add('alt', 'csv-count', "import csv\ncount = 0\nwith open('payments.csv') as f:\n    for r in csv.DictReader(f):\n        count += 1\n", { pass: true });
add('alt', 'csv-total', "import csv\nwith open('payments.csv') as f:\n    rows = list(csv.DictReader(f))\ntotal = sum(float(r['amount']) for r in rows if r['payment_date'][:7] == '2026-08' and r['amount'] != '')\n", { pass: true });
add('alt', 'overpaid-dict', L + "\nfrom collections import Counter\nc = Counter()\noverpaid = {}\nfor r in rows:\n    k = (r['artist'], r['song'], r['payment_date'][:7])\n    c[k] += 1\n    if c[k] > 1:\n        overpaid[r['artist']] = overpaid.get(r['artist'], 0) + float(r['amount'])\n", { pass: true });
// mistakes: [mission, code, tip id or null]
const WRONG = [
  ['variables', 'amount = 125\nfee = 15\ntotal = 140\n', null],
  ['for-loop', 'amounts = [125, 60, 101, 80, 220]\ntotal = sum(amounts)\n', null],
  ['def', 'def add_fee(amount):\n    print(amount + 15)\n', 'print-not-return'],
  ['if-else', "def size(amount)\n    return 'big'\n", 'missing-colon'],
  ['if-else', "def size(amount):\nreturn 'big'\n", 'indentation'],
  ['if-else', "def size(amount):\n    if amount = 150:\n        return 'big'\n", 'assign-vs-compare'],
  ['csv-total', "import csv\ntotal = 0\nwith open('payments.csv') as f:\n    for r in csv.DictReader(f):\n        if r['payment_date'].startswith('2026-08'):\n            total += r['amount']\n", 'text-number'],
  ['csv-total', "import csv\ntotal = 0\nwith open('payments.csv') as f:\n    for r in csv.DictReader(f):\n        total += float(r['amount'])\n", 'empty-number'],
  ['csv-count', 'count = 27\n', null],
  ['csv-header', "import csv\nwith open('pagos.csv') as f:\n    print(next(csv.reader(f)))\n", 'file-name'],
  ['csv-filter', "import csv\nwith open('payments.csv') as f:\n    for r in csv.DictReader(f):\n        print(r['Id'])\n", 'key-typo'],
  ['lists', 'amounts = [125, 60, 101, 80]\ncount = len(amount)\n', 'name-typo'],
  ['overpaid-dict', L + "\noverpaid = {'DJ Pampa': 220, 'Luna Ferreyra': 185, 'Sofía Beltrán': 140, 'Nico Valdés': 115, 'Camila Roldán': 95.5}\n", null],
];
for (const [id, code, tip] of WRONG) add('wrong', id, code, { pass: false, tip });

// Run every case in one Python process.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ot-py-'));
fs.writeFileSync(path.join(dir, 'harness.py'), OT.pyHarness);
fs.writeFileSync(path.join(dir, 'cases.json'), JSON.stringify(cases.map(c => ({ code: c.code, spec: T.specOf(byId[c.id]) }))));
fs.writeFileSync(path.join(dir, 'driver.py'), [
  'import json, sys',
  "exec(open(sys.argv[1], encoding='utf-8').read())",
  "cases = json.load(open(sys.argv[2], encoding='utf-8'))",
  "sys.stdout.reconfigure(encoding='utf-8')",
  "print(json.dumps([json.loads(run_mission(c['code'], json.dumps(c['spec']))) for c in cases]))",
].join('\n'));
const results = JSON.parse(execFileSync('python', [path.join(dir, 'driver.py'), path.join(dir, 'harness.py'), path.join(dir, 'cases.json')], { encoding: 'utf8', maxBuffer: 1 << 26, env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) }));  // UTF-8 by default, like Pyodide

cases.forEach((c, i) => {
  const r = results[i], m = byId[c.id];
  check(`${c.label} ${c.id}${c.label === 'wrong' ? ': ' + c.code.split('\n').slice(-2).join(' ').trim().slice(0, 50) : ''}`, () => {
    const ok = T.passed(r);
    const why = r.error ? JSON.stringify(r.error) : JSON.stringify(r.tests.filter(t => !t.ok));
    assert.strictEqual(ok, c.expect.pass, why);
    if (!ok) {
      const d = T.diagnose(m, c.code, r);
      assert(d && !d.includes(m.solution.cmd), 'hint 1 present and not the solution');
      const tips = T.detectMistakes(m, c.code, r).map(x => x.id);
      if (c.expect.tip) assert(tips.includes(c.expect.tip), 'expected tip ' + c.expect.tip + ', got ' + tips);
    }
  });
});
check('dataset two changes the answer', () => {
  const r = results[cases.findIndex(c => c.label === 'wrong' && c.id === 'overpaid-dict')];
  assert(/different payments\.csv/.test(r.tests[0].msg), r.tests[0].msg);
});

for (const c of cases.filter(x => x.label === 'wrong').slice(0, 8)) {
  const r = results[cases.indexOf(c)], m = byId[c.id];
  console.log(`  [${c.id}] -> ${T.diagnose(m, c.code, r)}  {${T.detectMistakes(m, c.code, r).map(x => x.id)}}`);
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${T.flat.length} missions: ` + T.levels.map(l => `${l.title} (${l.missions.length})`).join(' | '));
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
