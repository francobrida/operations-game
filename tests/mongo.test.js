// Run: node tests/mongo.test.js
// Shell parser/engine checks, then every MongoDB mission: official query passes, equivalents pass,
// common mistakes fail with the right tip.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const base = path.join(__dirname, '..');
for (const f of ['js/data.js', 'js/tracks/mongo/engine.js', 'js/tracks/mongo/missions.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(base, f), 'utf8'), { filename: f });
}
const M = globalThis.OT.mongo;
const T = globalThis.OT.tracks.mongo;
let failures = 0;
const check = (name, fn) => { try { fn(); } catch (e) { failures++; console.log('FAIL', name, '-', e.message); } };
const byId = id => T.flat.find(f => f.mission.id === id).mission;
const passes = (id, q) => T.evaluate(byId(id), q).cmp.ok;
const tipOf = (id, q) => { const m = byId(id); const { res } = T.evaluate(m, q); return T.detectMistakes(m, q, res).map(d => d.id); };

// ---- engine ----
check('parser errors', () => {
  assert(M.run('SELECT * FROM payments').parse);
  assert(M.run('db.payments.find({ artist: "DJ Pampa" ').parse);
  assert(/dot must be in quotes/.test(M.run('db.songs.find({ artist.country: "Chile" })').error));
});
check('unknown collection warns', () => assert(M.run('db.payment.find()').warning));
check('filters', () => {
  assert.strictEqual(M.run('db.payments.find({ artist: "DJ Pampa" })').docs.length, M.run("db.payments.find({ 'artist': 'DJ Pampa' });").docs.length);
  assert.strictEqual(M.run('db.payments.countDocuments({ amount: { $exists: false } })').count, 1);
  assert.strictEqual(M.run('db.payments.find({ $or: [{ amount: { $gt: 150 } }, { amount: { $lt: 0 } }] }).count()').count, M.run('db.payments.countDocuments({ amount: { $gt: 150 } })').count);
});
check('projection mix error', () => assert(/exclusion/.test(M.run('db.payments.find({}, { song: 1, amount: 0 })').error)));

// ---- missions ----
check('every official solution passes', () => T.flat.forEach(({ mission: m }) => assert(T.evaluate(m, m.solution.cmd).cmp.ok, m.id)));
check('expected sizes', () => {
  assert.strictEqual(T.expected(byId('count')).count, 15);
  assert.strictEqual(T.expected(byId('mongo-dups')).docs.length, 6);
  assert.strictEqual(T.expected(byId('sort-limit')).docs.length, 3);
});
check('equivalents pass', () => {
  assert(passes('find-all', 'db.songs.find({})'));
  assert(passes('find-eq', "db.payments.find({artist:'DJ Pampa'})"));
  assert(passes('find-eq', 'db.payments.find({ artist: { $eq: "DJ Pampa" } })'));
  assert(passes('projection', 'db.payments.find({ artist: "Luna Ferreyra" }, { _id: 0, amount: 1, song: 1 })'));
  assert(passes('sort-limit', 'db.songs.find({}, { _id: 0, plays: 1, title: 1 }).sort({ plays: -1 }).limit(3)'));
  assert(passes('count', 'db.payments.find({ payment_date: "2026-08-14" }).count()'));
  assert(passes('group-sum', 'db.payments.aggregate([{ $group: { _id: "$artist", sum: { $sum: "$amount" } } }])'));
  assert(passes('mongo-dups', 'db.payments.aggregate([{ $match: { payment_date: "2026-08-14" } }, { $group: { _id: { a: "$artist", s: "$song" }, n: { $sum: 1 } } }, { $match: { n: { $gte: 2 } } }])'));
});
check('wrong answers fail', () => {
  assert(!passes('projection', 'db.payments.find({ artist: "Luna Ferreyra" })'));
  assert(!passes('sort-limit', 'db.songs.find({}, { _id: 0, plays: 1, title: 1 }).sort({ plays: 1 }).limit(3)'));
  assert(!passes('count', 'db.payments.find({ payment_date: "2026-08-14" })'));
  assert(!passes('match-group', 'db.payments.aggregate([{ $match: { payment_date: "2026-08-14" } }, { $group: { _id: "$artist", total: { $sum: "$amount" } } }])'));
});
check('diagnosis kinds', () => {
  const m = byId('count');
  assert(/single number/.test(T.diagnose(m, 'x', ...Object.values(T.evaluate(m, 'db.payments.find()')))));
  const p = byId('projection'), r = T.evaluate(p, 'db.payments.find({ artist: "Luna Ferreyra" })');
  assert(/fields/.test(T.diagnose(p, '', r.res, r.cmp)));
});
check('mistake tips', () => {
  assert(tipOf('find-eq', 'SELECT * FROM payments').includes('sql-habit'));
  assert(tipOf('find-dot', 'db.songs.find({ artist.country: "Chile" })').includes('dotted-key-quotes'));
  assert(tipOf('find-gt', 'db.payments.find({ amount: { gt: 150 } })').includes('operator-dollar'));
  assert(tipOf('group-sum', 'db.payments.aggregate([{ $group: { _id: "artist", total: { $sum: "$amount" } } }])').includes('path-dollar'));
  assert(tipOf('mongo-dups', 'db.payments.aggregate([{ $group: { _id: { artist: "artist", song: "$song" }, copies: { $sum: 1 } } }])').includes('path-dollar'));
  assert(!tipOf('mongo-dups', byId('mongo-dups').solution.cmd).includes('path-dollar'));
  assert(tipOf('group-sum', 'db.payments.find({ artist: "DJ Pampa" })').includes('find-for-groups'));
  assert(tipOf('projection', 'db.payments.find({}, { song: 1, artist: 0 })').includes('projection-mix'));
  assert(tipOf('find-all', 'db.song.find()').includes('wrong-collection'));
});

console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
