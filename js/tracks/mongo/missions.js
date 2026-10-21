/* MongoDB track (optional, ~30 min): documents vs rows, find() with filters and projection,
   and aggregate() with $match and $group. Checked by comparing the returned documents. */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  const M = OT.mongo;

  const L1 = [
    { id: 'find-all', title: 'Documents, not rows',
      brief: 'Data team: "Have a look at the songs collection: show every document." Notice where the artist is.',
      concept: 'A collection holds documents, like a table holds rows. A document can contain another document: here each song carries its artist inside. find() with no filter returns them all.',
      skeleton: 'db._____.find()',
      solution: { cmd: 'db.songs.find()', parts: [['db.songs', 'The songs collection.'], ['.find()', 'Every document, no filter.']] },
      note: 'No JOIN needed: the artist is embedded in each song. The orphan song simply has no artist field.' },
    { id: 'find-eq', title: 'Filter by a field',
      brief: 'Finance: "Find every payment of DJ Pampa."',
      concept: 'find({ field: value }) keeps the documents where that field equals the value. Text goes in quotes.',
      skeleton: 'db.payments.find({ ______: "________" })',
      solution: { cmd: 'db.payments.find({ artist: "DJ Pampa" })', parts: [['{ artist: "DJ Pampa" }', 'The filter: artist equals DJ Pampa.']] } },
    { id: 'find-dot', title: 'Inside a document',
      brief: 'Marketing: "Which songs are by artists from Chile?"',
      concept: 'To filter on a field inside an embedded document, use a dotted path in quotes: "artist.country".',
      skeleton: 'db.songs.find({ "______.______": "_____" })',
      solution: { cmd: 'db.songs.find({ "artist.country": "Chile" })', parts: [['"artist.country"', 'The country field inside artist (quoted because of the dot).'], ['"Chile"', 'The value to match.']] } },
  ];
  const L2 = [
    { id: 'find-gt', title: 'Bigger than',
      brief: 'Finance: "Show me the payments with an amount greater than 150."',
      concept: 'Comparisons are operators that start with $: { amount: { $gt: 150 } }. Also $gte, $lt, $lte, $ne, $in.',
      skeleton: 'db.payments.find({ amount: { ___: ___ } })',
      solution: { cmd: 'db.payments.find({ amount: { $gt: 150 } })', parts: [['{ $gt: 150 }', 'Greater than 150.']] } },
    { id: 'projection', title: 'Only some fields', names: true,
      brief: 'Finance: "For Luna Ferreyra\'s payments I only need the song and the amount. No _id."',
      concept: 'The second argument of find() is the projection: { field: 1 } to include it, _id: 0 to hide the id (it is shown by default).',
      skeleton: 'db.payments.find({ artist: "Luna Ferreyra" }, { ____: 1, ______: 1, ___: 0 })',
      solution: { cmd: 'db.payments.find({ artist: "Luna Ferreyra" }, { song: 1, amount: 1, _id: 0 })', parts: [['{ artist: "Luna Ferreyra" }', 'Which documents.'], ['{ song: 1, amount: 1, _id: 0 }', 'Which fields: song and amount, without _id.']] },
      note: '"luna ferreyra" (lowercase) is not included: MongoDB text matching is exact, like SQL.' },
    { id: 'sort-limit', title: 'Top 3 songs', names: true, ordered: true,
      brief: 'Editorial: "The 3 most played songs, most played first: title and plays only, no _id."',
      concept: 'Chain .sort({ field: -1 }) for descending and .limit(n) to keep the first n. An empty filter {} means "all documents".',
      skeleton: 'db.songs.find({}, { title: 1, plays: 1, _id: 0 }).sort({ _____: __ }).limit(_)',
      solution: { cmd: 'db.songs.find({}, { title: 1, plays: 1, _id: 0 }).sort({ plays: -1 }).limit(3)', parts: [['find({}, { title: 1, plays: 1, _id: 0 })', 'All songs, two fields.'], ['.sort({ plays: -1 })', 'Most plays first.'], ['.limit(3)', 'Only three.']] } },
    { id: 'count', title: 'Just a number',
      brief: 'Support: "How many payments are dated 2026-08-14? I only need the number."',
      concept: 'countDocuments(filter) returns how many documents match, instead of the documents themselves.',
      skeleton: 'db.payments.______________({ payment_date: "__________" })',
      solution: { cmd: 'db.payments.countDocuments({ payment_date: "2026-08-14" })', parts: [['countDocuments(…)', 'Counts the matching documents.']] } },
  ];
  const L3 = [
    { id: 'group-sum', title: 'Total per artist',
      brief: 'Finance: "Total amount paid per artist (as written in payments)."',
      concept: 'aggregate([ stages ]) runs a pipeline. $group with _id: "$artist" makes one group per artist; total: { $sum: "$amount" } adds the amounts. Field paths start with $.',
      skeleton: 'db.payments.aggregate([ { $group: { _id: "$______", total: { ____: "$______" } } } ])',
      solution: { cmd: 'db.payments.aggregate([\n  { $group: { _id: "$artist", total: { $sum: "$amount" } } }\n])', parts: [['$group', 'Groups documents, like GROUP BY.'], ['_id: "$artist"', 'One group per artist value.'], ['total: { $sum: "$amount" }', 'Adds the amounts of each group.']] } },
    { id: 'match-group', title: 'August totals, ranked', ordered: true,
      brief: 'Finance: "Only the payments dated 2026-08-14: total per artist, biggest first."',
      concept: 'Stages run in order: $match filters first (like WHERE), then $group, then $sort on the new total field.',
      skeleton: 'db.payments.aggregate([\n  { $match: { payment_date: "__________" } },\n  { $group: { _id: "$artist", total: { $sum: "$amount" } } },\n  { $sort: { _____: __ } }\n])',
      solution: { cmd: 'db.payments.aggregate([\n  { $match: { payment_date: "2026-08-14" } },\n  { $group: { _id: "$artist", total: { $sum: "$amount" } } },\n  { $sort: { total: -1 } }\n])', parts: [['$match', 'Keeps only August 14.'], ['$group … $sum', 'Total per artist.'], ['$sort: { total: -1 }', 'Biggest first.']] } },
    { id: 'mongo-dups', title: 'Duplicates, the Mongo way',
      brief: 'Support: "Find the August payments repeated with the same artist and song: one result per repeated pair, with the number of copies."',
      concept: 'Group by two fields with an object _id: { artist: "$artist", song: "$song" }; count with { $sum: 1 }; then a second $match keeps the groups with more than one copy (like HAVING).',
      skeleton: 'db.payments.aggregate([\n  { $match: { payment_date: { $gte: "2026-08-01", $lte: "2026-08-31" } } },\n  { $group: { _id: { artist: "$artist", song: "$song" }, copies: { $sum: _ } } },\n  { $match: { copies: { ___: 1 } } }\n])',
      solution: { cmd: 'db.payments.aggregate([\n  { $match: { payment_date: { $gte: "2026-08-01", $lte: "2026-08-31" } } },\n  { $group: { _id: { artist: "$artist", song: "$song" }, copies: { $sum: 1 } } },\n  { $match: { copies: { $gt: 1 } } }\n])', parts: [['$match on payment_date', 'Only August.'], ['_id: { artist: "$artist", song: "$song" }', 'One group per artist + song.'], ['copies: { $sum: 1 }', 'Counts the documents of each group.'], ['$match: { copies: { $gt: 1 } }', 'Only the repeated ones.']] },
      note: 'Same six duplicates as in SQL, Excel and Python: the same question works in every tool.' },
  ];

  const LEVELS = [
    { id: 'documents', title: 'Documents and find()', minutes: 8, intro: 'Collections of documents instead of tables of rows.',
      cheat: [['db.coll.find()', 'Every document'], ['find({ field: value })', 'Filter'], ['"a.b"', 'Field inside an embedded document (in quotes)']], missions: L1 },
    { id: 'filters', title: 'Filters, projection and sorting', minutes: 10, intro: 'Operators, choosing fields, sorting and counting.',
      cheat: [['{ f: { $gt: 1 } }', '$gt $gte $lt $lte $ne $in'], ['find(filter, { f: 1, _id: 0 })', 'Projection: which fields'], ['.sort({ f: -1 }).limit(3)', 'Sort descending, keep 3'],
        ['countDocuments(filter)', 'How many match']], missions: L2 },
    { id: 'aggregate', title: 'aggregate()', minutes: 12, intro: 'Pipelines: filter, group and sum, the MongoDB GROUP BY.',
      cheat: [['aggregate([ … ])', 'A pipeline of stages'], ['{ $match: filter }', 'Filter (WHERE)'], ['{ $group: { _id: "$f", t: { $sum: "$x" } } }', 'Group and sum (GROUP BY)'],
        ['{ $sum: 1 }', 'Count'], ['{ $sort: { t: -1 } }', 'Sort']], missions: L3 },
  ];
  const flat = [];
  LEVELS.forEach((lv, li) => lv.missions.forEach((m, mi) => flat.push({ mission: m, li, mi, gi: flat.length })));

  const cache = {};
  const expected = m => cache[m.id] || (cache[m.id] = M.run(m.solution.cmd));
  function evaluate(m, input) { const res = M.run(input); return { res, cmp: M.compare(res, expected(m), m) }; }

  function diagnose(m, input, res, cmp) {
    if (res.error && res.parse) return 'The shell cannot read your query: ' + res.error + '. Check brackets, quotes, colons and commas.';
    if (res.error) return 'MongoDB says: ' + res.error + '.';
    if (res.warning) return res.warning;
    if (cmp.kind === 'wantCount') return 'This task wants a single number, not a list of documents.';
    if (cmp.kind === 'wantDocs') return 'This task wants the documents themselves, not a count.';
    if (cmp.kind === 'countValue') return 'You returned a number, but not the right one: check the filter.';
    if (cmp.kind === 'docs') return 'You got ' + cmp.got + ' document' + (cmp.got === 1 ? '' : 's') + '; the answer has ' + cmp.want + '. Look at the filter (or the grouping).';
    if (cmp.kind === 'fields') return 'Your documents have ' + cmp.got + ' fields each; the answer has ' + cmp.want + '. Look at the projection (or the group fields).';
    if (cmp.kind === 'names') return 'Right values. Now name the fields as the task asks.';
    if (cmp.kind === 'order') return 'Right documents, wrong order. Look at the sort.';
    return 'Right number of documents, but different ones or different values. Check the filter values and the field paths.';
  }
  const DETECTORS = [
    { id: 'sql-habit', label: 'Writing SQL in MongoDB', tip: 'MongoDB has no SELECT: a query looks like db.payments.find({ artist: "DJ Pampa" }).', test: c => /^\s*select\b/i.test(c.input) },
    { id: 'dotted-key-quotes', label: 'Dotted field without quotes', tip: 'A field path with a dot goes in quotes: { "artist.country": "Chile" }.', test: c => !!c.res.parse && /dot must be in quotes/.test(c.res.error) },
    { id: 'operator-dollar', label: 'Operator without $', tip: 'Operators start with $: { amount: { $gt: 150 } }.', test: c => /\{\s*(gt|gte|lt|lte|ne|in|nin|sum|match|group|sort)\s*:/.test(c.input) },
    { id: 'path-dollar', label: 'Field path without $ in aggregate', tip: 'Inside aggregate, field values are written with $: "$artist", "$amount".', test: c => /\$group[\s\S]*:\s*["'](artist|song|amount|payment_date|title|plays|duration_sec|name|country)["']/.test(c.input) },
    { id: 'find-for-groups', label: 'Using find() for totals per group', tip: 'Totals per group need aggregate() with $group; find() only filters documents.', test: c => /aggregate/.test(c.m.solution.cmd) && /\.find\(/.test(c.input) },
    { id: 'projection-mix', label: 'Mixing 1 and 0 in a projection', tip: 'A projection either lists the fields to show (1) or the ones to hide (0); only _id: 0 can be mixed in.', test: c => /exclusion on field/.test(c.res.error || '') },
    { id: 'wrong-collection', label: 'Wrong collection name', tip: 'Collections: payments, songs, artists, import_log.', test: c => !!c.res.warning },
    { id: 'shell-syntax', label: 'Unbalanced brackets or quotes', tip: 'Every { needs its }, every [ its ], and each field is name: value, separated by commas.', test: c => !!c.res.parse && !/dot must be in quotes/.test(c.res.error) },
  ];
  const detectMistakes = (m, input, res) => DETECTORS.filter(d => { try { return d.test({ m, input, res }); } catch (e) { return false; } });
  const cheatUpTo = li => LEVELS.slice(0, li + 1).map(lv => ({ title: lv.title, rows: lv.cheat }));

  OT.tracks = OT.tracks || {};
  OT.tracks.mongo = {
    id: 'mongo', title: 'MongoDB', levels: LEVELS, flat, expected, evaluate, diagnose, detectMistakes, cheatUpTo,
    notice: { title: 'A small MongoDB shell, not the real server.', text: 'It understands find() with filters and projection, sort(), limit(), countDocuments() and aggregate() with $match, $group ($sum, $avg, $min, $max), $sort and $limit. Collections: payments, songs, artists, import_log, built from the same data as the other tracks.' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
