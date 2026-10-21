// Run: node tests/sql.test.js
// Runs every SQL mission's official solution on real SQLite, checks the expected shape,
// accepts equivalent queries, rejects common wrong ones and fires the right mistake tips.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const base = path.join(__dirname, '..');
const initSqlJs = require(path.join(base, 'vendor', 'sql-wasm.js'));
for (const f of ['js/data.js', 'js/tracks/sql/db.js', 'js/tracks/sql/missions.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
}
const DB = globalThis.OT.sqlDB;
const T = globalThis.OT.tracks.sql;
let failures = 0;
const check = (name, fn) => { try { fn(); } catch (e) { failures++; console.log('FAIL', name, '-', e.message); } };

const ROWS = {
  'select-all': 9, 'select-cols': 9, 'where-eq': 2, 'order-limit': 3, 'distinct': 7, 'in-list': 4, 'and': 2,
  'between': 10, 'like': 5, 'is-null': 1, 'alias': 14,
  'count-all': 1, 'count-col': 1, 'sum': 1, 'min-max-avg': 1, 'group-date': 4, 'group-songs': 9, 'group-sum': 12, 'group-order': 12,
  'per-each': 8, 'having-count': 5, 'having-sum': 4, 'where-having': 5, 'dup-basic': 6, 'dup-date': 6, 'file-twice': 1, 'rows-per-file': 3,
  'inner-join': 13, 'join-where': 4, 'join-group': 7, 'left-join': 14, 'orphans': 1, 'left-count': 9, 'join-payments': 23,
  'clean-names': 27, 'join-clean': 26, 'coalesce': 27, 'case-when': 27, 'month-filter': 15, 'aug-dups': 6,
  'overpaid-each': 6, 'overpaid-total': 1, 'overpaid-artist': 5, 'final-report': 4,
};
const ALT = {
  'select-cols': 'select country, name from artists',
  'where-eq': "SELECT name FROM artists WHERE country LIKE 'argentina'",
  'order-limit': 'select plays, title from songs order by plays desc limit 3',
  'in-list': 'SELECT title FROM songs WHERE artist_id = 1 OR artist_id = 4',
  'between': 'SELECT id, artist, amount FROM payments WHERE amount >= 100 AND amount <= 150',
  'alias': 'SELECT title, ROUND(duration_sec / 60.0, 2) AS Minutes FROM songs',
  'count-col': 'SELECT COUNT(*) FROM payments WHERE amount IS NOT NULL',
  'group-order': 'SELECT artist, SUM(amount) AS total FROM payments GROUP BY 1 ORDER BY 2 DESC',
  'having-sum': 'SELECT artist, SUM(amount) AS t FROM payments GROUP BY artist HAVING t > 400',
  'inner-join': 'SELECT songs.title, artists.name FROM artists INNER JOIN songs ON artists.id = songs.artist_id',
  'coalesce': 'SELECT id, IFNULL(amount, 0) FROM payments',
  'month-filter': "SELECT * FROM payments WHERE strftime('%Y-%m', payment_date) = '2026-08'",
  'aug-dups': "SELECT artist, song, COUNT(*) FROM payments WHERE MONTH(payment_date) = 8 AND YEAR(payment_date) = 2026 GROUP BY artist, song HAVING COUNT(*) >= 2",
  'overpaid-each': "SELECT artist, song, SUM(amount) - MAX(amount) FROM payments WHERE payment_date BETWEEN '2026-08-01' AND '2026-08-31' GROUP BY artist, song HAVING COUNT(*) > 1",
  'overpaid-total': "WITH d AS (SELECT (COUNT(*) - 1) * MAX(amount) AS x FROM payments WHERE payment_date LIKE '2026-08%' GROUP BY artist, song HAVING COUNT(*) > 1) SELECT SUM(x) FROM d;",
  'final-report': "SELECT a.name, a.country, SUM(d.o) AS total FROM (SELECT artist, (COUNT(*) - 1) * MAX(amount) AS o FROM payments WHERE payment_date LIKE '2026-08%' GROUP BY artist, song HAVING COUNT(*) > 1) d JOIN artists a ON a.name = d.artist GROUP BY a.name, a.country HAVING total > 100 ORDER BY total DESC",
};
// [mission, wrong query, mistake id expected among the detected tips (or null)]
const WRONG = [
  ['where-eq', 'SELECT name FROM artists WHERE country = Argentina', 'unquoted-text'],
  ['order-limit', 'SELECT title, plays FROM songs ORDER BY plays LIMIT 3', null],
  ['order-limit', 'SELECT title, plays FROM songs ORD BY plays DESC LIMIT 3', 'ord-by'],
  ['group-order', 'SELECT artist, SUM(amount) AS total FROM payments GROUP BY artist ORDER BY total', null],
  ['group-order', 'SELECT artist, SUM(amount) AS total FROM payments GROUP BY artist ORDER BY total, DESC', 'comma-before-desc'],
  ['group-order', 'SELECT artist, SUM(amount) AS total FROM payments GROUP BY artist ORDER BY DESC', 'order-by-no-column'],
  ['is-null', 'SELECT * FROM payments WHERE amount = NULL', 'equals-null'],
  ['count-all', 'SELECT COUNT(*)', 'missing-from'],
  ['group-sum', 'SELECT artist, SUM amount FROM payments GROUP BY artist', 'aggregate-no-parens'],
  ['group-sum', 'SELECT artist, SUM(amount) FROM payments', 'per-each-group-by'],
  ['having-sum', 'SELECT artist, SUM(amount) FROM payments WHERE SUM(amount) > 400 GROUP BY artist', 'where-vs-having'],
  ['dup-basic', 'SELECT artist, song, amount, COUNT(*) FROM payments GROUP BY artist HAVING COUNT(*) > 1', 'bare-column-group'],
  ['select-all', 'SELECT * FROM artist', 'table-typo'],
  ['select-cols', 'SELECT nam, country FROM artists', 'column-typo'],
  ['left-join', 'SELECT s.title, a.name FROM songs s JOIN artists a ON s.artist_id = a.id', null],
  ['left-count', 'SELECT a.name, COUNT(*) FROM artists a LEFT JOIN songs s ON s.artist_id = a.id GROUP BY a.name', null],
  ['month-filter', "SELECT * FROM payments WHERE DATE_FORMAT(payment_date, '%Y-%m') = '2026-08'", 'mysql-function'],
  ['alias', 'SELECT title, duration_sec / 60 AS minutes FROM songs', null],
  ['alias', 'SELECT title, duration_sec / 60.0 FROM songs', null],
  ['final-report', "WITH dups AS (SELECT artist, song, (COUNT(*) - 1) * MAX(amount) AS overpaid FROM payments WHERE payment_date LIKE '2026-08%' GROUP BY artist, song HAVING COUNT(*) > 1) SELECT a.name, a.country, SUM(d.overpaid) AS overpaid FROM dups d JOIN artists a ON a.name = d.artist GROUP BY a.name, a.country HAVING SUM(d.overpaid) > 100", null],
];

(async () => {
  await DB.init(initSqlJs, fs.readFileSync(path.join(base, 'vendor', 'sql-wasm.wasm')));
  const byId = Object.fromEntries(T.flat.map(x => [x.mission.id, x.mission]));

  check('row counts cover every mission', () => assert.deepStrictEqual(Object.keys(ROWS).sort(), Object.keys(byId).sort()));
  for (const { mission: m } of T.flat) {
    check('solution ' + m.id, () => {
      const exp = T.expected(m);
      assert(!exp.error, exp.error);
      assert.strictEqual(exp.rows.length, ROWS[m.id], 'rows');
      assert(T.evaluate(m, m.solution.cmd).cmp.ok, 'solution passes its own check');
      const tips = T.detectMistakes(m, m.solution.cmd, exp).map(d => d.id);
      assert.deepStrictEqual(tips, [], 'no tips on the official solution: ' + tips);
    });
  }
  check('numbers', () => {
    assert.strictEqual(T.expected(byId['count-all']).rows[0][0], 27);
    assert.strictEqual(T.expected(byId['count-col']).rows[0][0], 26);
    assert.strictEqual(T.expected(byId['overpaid-total']).rows[0][0], 755.5);
    assert.deepStrictEqual(T.expected(byId['final-report']).rows.map(r => r[0]), ['DJ Pampa', 'Luna Ferreyra', 'Sofía Beltrán', 'Nico Valdés']);
  });
  for (const [id, sql] of Object.entries(ALT)) {
    check('alt ' + id, () => { const r = T.evaluate(byId[id], sql); assert(r.cmp.ok, JSON.stringify(r.cmp) + ' ' + (r.res.error || '')); });
  }
  for (const [id, sql, tip] of WRONG) {
    check('wrong ' + id + ': ' + sql.slice(0, 50), () => {
      const m = byId[id];
      const { res, cmp } = T.evaluate(m, sql);
      assert(!cmp.ok, 'should fail');
      const d = T.diagnose(m, sql, res, cmp);
      assert(d && !d.includes(m.solution.cmd), 'hint 1 present and not the solution');
      const tips = T.detectMistakes(m, sql, res).map(x => x.id);
      if (tip) assert(tips.includes(tip), 'expected tip ' + tip + ', got ' + tips);
    });
  }
  check('style tip on a correct query', () => {
    const m = byId['inner-join'];
    const sql = 'SELECT s.title, a.name FROM songs s JOIN artists a WHERE s.artist_id = a.id';
    const { res, cmp } = T.evaluate(m, sql);
    assert(cmp.ok, 'still correct');
    assert(T.detectMistakes(m, sql, res).some(d => d.id === 'join-in-where' && d.style));
  });
  for (const sql of ['', 'hello', 'SELECT', "SELECT * FROM payments WHERE artist = 'x", 'DROP TABLE artists', 'WITH RECURSIVE x AS (SELECT 1) SELECT * FROM x']) {
    check('garbage ' + JSON.stringify(sql), () => {
      const m = byId['select-all'];
      const { res, cmp } = T.evaluate(m, sql);
      assert(!cmp.ok);
      T.diagnose(m, sql, res, cmp); T.detectMistakes(m, sql, res);
    });
  }
  check('each query gets a fresh database', () => {
    DB.run('DELETE FROM artists');
    assert.strictEqual(DB.run('SELECT COUNT(*) FROM artists').rows[0][0], 9);
  });

  for (const [id, sql] of WRONG.slice(0, 8).map(w => [w[0], w[1]])) {
    const m = byId[id]; const { res, cmp } = T.evaluate(m, sql);
    console.log(`  [${id}] ${sql}\n      -> ${T.diagnose(m, sql, res, cmp)}  {${T.detectMistakes(m, sql, res).map(x => x.id)}}`);
  }
  console.log(`\n${T.flat.length} missions: ` + T.levels.map(l => `${l.title} (${l.missions.length})`).join(' | '));
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
