/* Excel track: sheets built from the shared dataset, levels, missions, checks, hints, mistake tips.
   A mission passes when its target cells show the same values as the official solution
   (any equivalent formula), or when the sheet is sorted / filtered / pivoted the way the task asks. */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  const X = OT.sheet;
  const D = OT.data;

  /* ---- starting sheets ---- */
  function grid(rows, startCol, startRow) {
    const cells = {};
    rows.forEach((row, i) => row.forEach((v, j) => {
      if (v !== null && v !== undefined && v !== '') cells[X.addr((startCol || 1) + j, (startRow || 1) + i)] = v;
    }));
    return cells;
  }
  const SONGS = grid([['title', 'artist_id', 'plays', 'duration_sec']].concat(D.songs.map(s => [s.title, s.artist_id, s.plays, s.duration_sec])));
  const AUG_ROWS = D.payments.filter(p => (p.payment_date || '').startsWith('2026-08'));
  const AUG = grid([['id', 'artist', 'song', 'amount', 'payment_date']].concat(AUG_ROWS.map(p => [p.id, p.artist, p.song, p.amount, p.payment_date])));
  const SEPT = grid([['id', 'artist', 'song', 'amount', 'payment_date']].concat(D.payments.filter(p => (p.payment_date || '').startsWith('2026-09')).map(p => [p.id, p.artist, p.song, p.amount, p.payment_date])));
  const ARTISTS = col => grid([['name', 'country']].concat(D.artists.map(a => [a.name, a.country])), X.colNum(col), 1);
  const LAST = AUG_ROWS.length + 1; // last data row of the August sheet
  // Alphabetical, so a range that slides while filling really misses rows.
  const AUG_ARTISTS = [...new Set(AUG_ROWS.map(p => p.artist))].sort((a, b) => a.localeCompare(b));
  const SUMMARY = grid([['artist', 'payments', 'total', 'share']].concat(AUG_ARTISTS.map(a => [a])).concat([['Total']]), X.colNum('G'), 1);
  const fillCol = (col, from, to, formula) => { const sh = X.newSheet({ [col + from]: formula }); X.fillDown(sh, col + from, to); return sh.cells; };
  const KEY = fillCol('F', 2, LAST, '=B2&" | "&C2');
  const COPY = fillCol('G', 2, LAST, '=COUNTIF($F$2:F2,F2)');
  const OVERPAID = fillCol('H', 2, LAST, '=IF(G2>1,D2,0)');
  const sheet = (...parts) => Object.assign({}, ...parts);

  /* ---- missions ---- */
  // fields: id, title, brief, concept, skeleton, start (cells), tools, targets, uses?, check?, solution {cmd, parts, steps}, note?
  const L1 = [
    { id: 'sum', title: 'Total plays', start: sheet(SONGS, { A17: 'Total plays' }), targets: 'C17',
      brief: 'Editorial: "In C17, give me the total plays of all the songs."',
      concept: 'A formula starts with =. SUM adds a range, written as first cell:last cell.',
      skeleton: '=SUM(__:___)',
      solution: { cmd: 'C17: =SUM(C2:C15)', parts: [['=', 'Starts a formula.'], ['SUM( )', 'Adds everything inside.'], ['C2:C15', 'The range: from C2 down to C15.']], steps: [{ set: 'C17', v: '=SUM(C2:C15)' }] } },

    { id: 'average', title: 'Average length', start: sheet(SONGS, { A17: 'Average duration' }), targets: 'D17',
      brief: 'Editorial: "In D17, the average song duration in seconds."',
      concept: 'AVERAGE works like SUM, but divides by how many numbers there are.',
      skeleton: '=AVERAGE(__:___)',
      solution: { cmd: 'D17: =AVERAGE(D2:D15)', parts: [['AVERAGE(D2:D15)', 'Mean of the durations.']], steps: [{ set: 'D17', v: '=AVERAGE(D2:D15)' }] } },

    { id: 'count', title: 'How many have plays?', start: (() => { const s = sheet(SONGS, { A17: 'Songs with plays' }); delete s.C9; return s; })(), targets: 'C17',
      brief: 'Data team: "One song has no plays number yet. In C17, count how many songs DO have a number in column C."',
      concept: 'COUNT counts only the cells that contain numbers; empty cells are skipped.',
      skeleton: '=COUNT(__:___)',
      solution: { cmd: 'C17: =COUNT(C2:C15)', parts: [['COUNT(C2:C15)', 'How many cells in the range hold a number.']], steps: [{ set: 'C17', v: '=COUNT(C2:C15)' }] },
      note: 'COUNTA would count every non-empty cell, text included.' },

    { id: 'max-min', title: 'Most and fewest', start: sheet(SONGS, { A17: 'Most plays', A18: 'Fewest plays' }), targets: ['C17', 'C18'],
      brief: 'Editorial: "The highest number of plays in C17 and the lowest in C18."',
      concept: 'MAX returns the largest number in a range, MIN the smallest.',
      skeleton: 'C17: =___(C2:C15)   C18: =___(C2:C15)',
      solution: { cmd: 'C17: =MAX(C2:C15)\nC18: =MIN(C2:C15)', parts: [['MAX(C2:C15)', 'Largest value.'], ['MIN(C2:C15)', 'Smallest value.']], steps: [{ set: 'C17', v: '=MAX(C2:C15)' }, { set: 'C18', v: '=MIN(C2:C15)' }] } },

    { id: 'arith', title: 'Seconds to minutes', start: sheet(SONGS, { E1: 'minutes' }), targets: 'E2',
      brief: 'Editorial: "In E2, the duration of the first song in minutes."',
      concept: 'Formulas can do math with cells: + - * /. A cell reference like D2 uses whatever is in D2.',
      skeleton: '=__/60',
      solution: { cmd: 'E2: =D2/60', parts: [['D2', 'The seconds of that song.'], ['/60', 'Divided by 60.']], steps: [{ set: 'E2', v: '=D2/60' }] } },

    { id: 'fill', title: 'Fill it down', start: sheet(SONGS, { E1: 'minutes', E2: '=D2/60' }), tools: ['fill'], targets: 'E2:E15',
      brief: 'Editorial: "E2 already has the minutes of the first song. I need it for every song, down to E15."',
      concept: 'Filling down copies a formula to the cells below and moves its references along: in E3 it becomes =D3/60. Select E2 and use Fill ↓.',
      skeleton: 'select E2 → Fill ↓',
      solution: { cmd: 'Select E2, then Fill ↓ (down to E15)', parts: [['Fill ↓', 'Copies E2 down to the last row.'], ['=D2/60 → =D3/60 …', 'Each copy points at its own row.']], steps: [{ fill: 'E2', to: 15 }] } },
  ];

  const L2 = [
    { id: 'countif', title: 'Payments for one artist', start: sheet(AUG, SUMMARY), targets: 'H2',
      brief: 'Finance: "These are the August payments. In H2, how many of them went to the artist in G2?"',
      concept: 'COUNTIF(range, criterion) counts the cells of the range that match the criterion. The criterion can be a cell, like G2.',
      skeleton: '=COUNTIF(__:___, __)',
      solution: { cmd: 'H2: =COUNTIF(B2:B16,G2)', parts: [['B2:B16', 'Where to look: the artist column.'], ['G2', 'What to count: that artist.']], steps: [{ set: 'H2', v: '=COUNTIF(B2:B16,G2)' }] } },

    { id: 'sumif', title: 'Total for one artist', start: sheet(AUG, SUMMARY), targets: 'I2',
      brief: 'Finance: "In I2, the total amount paid in August to the artist in G2."',
      concept: 'SUMIF(range, criterion, sum_range) adds the sum_range values on the rows where range matches.',
      skeleton: '=SUMIF(__:___, __, __:___)',
      solution: { cmd: 'I2: =SUMIF(B2:B16,G2,D2:D16)', parts: [['B2:B16', 'Rows to check: artist.'], ['G2', 'Must match this artist.'], ['D2:D16', 'What to add: amount.']], steps: [{ set: 'I2', v: '=SUMIF(B2:B16,G2,D2:D16)' }] } },

    { id: 'criteria', title: 'Over 100', start: sheet(AUG, SUMMARY, { G12: 'Over 100' }), targets: 'H12',
      brief: 'Finance: "In H12, how many August payments are above 100?"',
      concept: 'A criterion with an operator goes in double quotes: ">100", "<=50", "<>0".',
      skeleton: '=COUNTIF(__:___, "____")',
      solution: { cmd: 'H12: =COUNTIF(D2:D16,">100")', parts: [['D2:D16', 'The amounts.'], ['">100"', 'Only those greater than 100.']], steps: [{ set: 'H12', v: '=COUNTIF(D2:D16,">100")' }] } },

    { id: 'abs-count', title: 'Lock the range', start: sheet(AUG, SUMMARY), tools: ['fill'], targets: 'H2:H9',
      brief: 'Finance: "I need the payment count for every artist, H2 to H9. Write it once in H2 and fill it down."',
      concept: 'When you fill down, references move. A $ locks a reference: $B$2:$B$16 stays the same in every row, while G2 should move to G3, G4…',
      skeleton: '=COUNTIF($_$_:$_$__, G2)   then Fill ↓',
      solution: { cmd: 'H2: =COUNTIF($B$2:$B$16,G2)\nthen Fill ↓ to H9', parts: [['$B$2:$B$16', 'Locked: always the whole artist column.'], ['G2', 'Not locked: becomes G3, G4… as it fills.']], steps: [{ set: 'H2', v: '=COUNTIF($B$2:$B$16,G2)' }, { fill: 'H2', to: 9 }] } },

    { id: 'abs-sum', title: 'Totals for everyone', start: sheet(AUG, SUMMARY), tools: ['fill'], targets: 'I2:I9',
      brief: 'Finance: "Same for the totals: I2 to I9, one formula filled down."',
      concept: 'Both ranges of the SUMIF must be locked; only the artist cell moves.',
      skeleton: '=SUMIF($_$_:$_$__, G2, $_$_:$_$__)   then Fill ↓',
      solution: { cmd: 'I2: =SUMIF($B$2:$B$16,G2,$D$2:$D$16)\nthen Fill ↓ to I9', parts: [['$B$2:$B$16', 'Locked artist column.'], ['G2', 'Moves row by row.'], ['$D$2:$D$16', 'Locked amount column.']], steps: [{ set: 'I2', v: '=SUMIF($B$2:$B$16,G2,$D$2:$D$16)' }, { fill: 'I2', to: 9 }] } },

    { id: 'share', title: 'Share of the total', tools: ['fill'], targets: 'J2:J9',
      start: sheet(AUG, SUMMARY, fillCol('I', 2, 9, '=SUMIF($B$2:$B$16,G2,$D$2:$D$16)'), { I10: '=SUM(I2:I9)' }),
      brief: 'Finance: "In J2 to J9, each artist\'s share of the August total, which is in I10. Write J2 and fill down."',
      concept: 'A single cell can be locked too: $I$10. Each row divides its own total by the same grand total.',
      skeleton: '=I2/$_$__   then Fill ↓',
      solution: { cmd: 'J2: =I2/$I$10\nthen Fill ↓ to J9', parts: [['I2', "This artist's total (moves)."], ['$I$10', 'The grand total (locked).']], steps: [{ set: 'J2', v: '=I2/$I$10' }, { fill: 'J2', to: 9 }] },
      note: 'Format it as a percentage and it reads 0.19 → 19%.' },
  ];

  const L3 = [
    { id: 'vlookup', title: 'Look up a country', start: sheet(AUG, { F1: 'country' }, ARTISTS('L')), targets: 'F2', uses: ['VLOOKUP'],
      brief: 'Finance: "In F2, the country of the artist in B2. The artists table is in L1:M10."',
      concept: 'VLOOKUP(value, table, column_number, FALSE) finds value in the first column of table and returns the cell column_number columns to the right. FALSE means exact match.',
      skeleton: '=VLOOKUP(__, $_$_:$_$__, _, _____)',
      solution: { cmd: 'F2: =VLOOKUP(B2,$L$2:$M$10,2,FALSE)', parts: [['B2', 'The artist to look for.'], ['$L$2:$M$10', 'The table (locked, ready to fill).'], ['2', 'Return its 2nd column: country.'], ['FALSE', 'Exact match only.']], steps: [{ set: 'F2', v: '=VLOOKUP(B2,$L$2:$M$10,2,FALSE)' }] } },

    { id: 'vlookup-fill', title: 'Countries for everyone', start: sheet(AUG, { F1: 'country' }, ARTISTS('L')), tools: ['fill'], targets: 'F2:F16',
      brief: 'Finance: "Now the country for every payment, F2 to F16."',
      concept: 'Same lookup, filled down. The table must be locked with $, the looked-up cell must move.',
      skeleton: '=VLOOKUP(B2, $_$_:$_$__, 2, FALSE)   then Fill ↓',
      solution: { cmd: 'F2: =VLOOKUP(B2,$L$2:$M$10,2,FALSE)\nthen Fill ↓ to F16', parts: [['B2', 'Moves row by row.'], ['$L$2:$M$10', 'Locked table.']], steps: [{ set: 'F2', v: '=VLOOKUP(B2,$L$2:$M$10,2,FALSE)' }, { fill: 'F2', to: 16 }] } },

    { id: 'vlookup-bug', title: 'Fix the wrong countries', tools: ['fill'], targets: 'F2:F16',
      start: sheet(AUG, { F1: 'country' }, ARTISTS('L'), fillCol('F', 2, 16, '=VLOOKUP(B2,$L$2:$M$10,2)')),
      brief: 'Support: "A coworker filled column F, but some countries are wrong. Find the problem in F2, fix it and fill down again."',
      concept: 'Without the 4th argument, VLOOKUP does an approximate match, which only works on a table sorted by its first column. This one is not sorted.',
      skeleton: '=VLOOKUP(B2,$L$2:$M$10,2,_____)   then Fill ↓',
      solution: { cmd: 'F2: =VLOOKUP(B2,$L$2:$M$10,2,FALSE)\nthen Fill ↓ to F16', parts: [['FALSE', 'The missing 4th argument: exact match.']], steps: [{ set: 'F2', v: '=VLOOKUP(B2,$L$2:$M$10,2,FALSE)' }, { fill: 'F2', to: 16 }] },
      note: 'This bug is common in real spreadsheets: always pass FALSE (or 0) as the last argument.' },

    { id: 'xlookup', title: 'The modern lookup', start: sheet(AUG, { F1: 'country' }, ARTISTS('L')), tools: ['fill'], targets: 'F2:F16', uses: ['XLOOKUP'],
      brief: 'Finance: "Do the same countries with XLOOKUP instead, F2 to F16."',
      concept: 'XLOOKUP(value, lookup_column, return_column) searches one column and returns the matching cell of another. Exact match by default, no column number to count.',
      skeleton: '=XLOOKUP(B2, $_$_:$_$__, $_$_:$_$__)   then Fill ↓',
      solution: { cmd: 'F2: =XLOOKUP(B2,$L$2:$L$10,$M$2:$M$10)\nthen Fill ↓ to F16', parts: [['B2', 'What to find.'], ['$L$2:$L$10', 'Where to find it: names.'], ['$M$2:$M$10', 'What to return: countries.']], steps: [{ set: 'F2', v: '=XLOOKUP(B2,$L$2:$L$10,$M$2:$M$10)' }, { fill: 'F2', to: 16 }] } },

    { id: 'not-found', title: 'When it is not there', start: sheet(SEPT, { F1: 'country' }, ARTISTS('L')), tools: ['fill'], targets: 'F2:F7', uses: ['XLOOKUP'],
      brief: 'Data team: "These are the September payments. Country for each one in F2:F7, but show not found when the artist is not in the table, instead of an error."',
      concept: 'XLOOKUP has an optional 4th argument: what to return when nothing matches.',
      skeleton: '=XLOOKUP(B2, $L$2:$L$10, $M$2:$M$10, "_________")   then Fill ↓',
      solution: { cmd: 'F2: =XLOOKUP(B2,$L$2:$L$10,$M$2:$M$10,"not found")\nthen Fill ↓ to F7', parts: [['"not found"', 'Shown instead of #N/A.']], steps: [{ set: 'F2', v: '=XLOOKUP(B2,$L$2:$L$10,$M$2:$M$10,"not found")' }, { fill: 'F2', to: 7 }] },
      note: 'Lookups ignore upper/lower case, so "luna ferreyra" and "LOS CARDALES" were found. "  Marta Quiroga " was not: it has extra spaces.' },

    { id: 'trim', title: 'Spaces get in the way', start: sheet(SEPT, { F1: 'country' }, ARTISTS('L')), tools: ['fill'], targets: 'F2:F7', uses: ['TRIM'],
      brief: 'Data team: "Fix the Marta Quiroga row: clean the name with TRIM inside the lookup. Keep not found for real misses."',
      concept: 'TRIM removes the spaces at the start and end of a text (and doubles in the middle). You can put it right inside XLOOKUP.',
      skeleton: '=XLOOKUP(____(B2), $L$2:$L$10, $M$2:$M$10, "not found")   then Fill ↓',
      solution: { cmd: 'F2: =XLOOKUP(TRIM(B2),$L$2:$L$10,$M$2:$M$10,"not found")\nthen Fill ↓ to F7', parts: [['TRIM(B2)', 'The name without extra spaces.'], ['"not found"', 'Only the payment with no artist at all stays not found.']], steps: [{ set: 'F2', v: '=XLOOKUP(TRIM(B2),$L$2:$L$10,$M$2:$M$10,"not found")' }, { fill: 'F2', to: 7 }] } },
  ];

  const rowsOf = (sh, cols) => X.visibleRows(sh).map(r => Array.from({ length: cols }, (_, i) => X.toText(X.parseInput(sh.cells[X.addr(i + 1, r)]))).join('|'));
  function sortedCheck(col, desc) {
    return (sh, exp) => {
      const a = rowsOf(sh, 5), b = rowsOf(exp, 5);
      if (a.slice().sort().join('\n') !== b.slice().sort().join('\n')) return { ok: false, kind: 'dataChanged' };
      if (a.join('\n') === rowsOf(X.newSheet(AUG), 5).join('\n')) return { ok: false, kind: 'notSorted' };
      const ev = X.evaluator(sh), c = X.colNum(col);
      const keys = X.visibleRows(sh).map(r => ev.at(c, r));
      const cmp = (x, y) => (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: 'base' }));
      for (let i = 1; i < keys.length; i++) if ((desc ? -1 : 1) * cmp(keys[i - 1], keys[i]) > 0) return { ok: false, kind: 'sortOrder' };
      return { ok: true };
    };
  }
  const filterCheck = (sh, exp) => {
    if (!sh.filter) return { ok: false, kind: 'noFilter' };
    return rowsOf(sh, 5).sort().join('\n') === rowsOf(exp, 5).sort().join('\n') ? { ok: true } : { ok: false, kind: 'wrongFilter' };
  };
  const keyCheck = sh => {
    const cells = X.rangeCells('F2:F' + LAST);
    const ev = X.evaluator(sh);
    for (const [i, a] of cells.entries()) {
      const raw = sh.cells[a];
      if (raw == null || raw === '') return { ok: false, kind: i ? 'notFilled' : 'empty', cell: a, first: 'F2' };
      if (!(typeof raw === 'string' && raw.startsWith('='))) return { ok: false, kind: 'notFormula', cell: a };
      const v = ev.value(a);
      if (X.isErr(v)) return { ok: false, kind: 'error', cell: a, code: v.e, fn: v.fn, msg: v.msg };
    }
    for (let i = 2; i <= LAST; i++) for (let j = i + 1; j <= LAST; j++) {
      const samePay = ['B', 'C'].every(c => X.toText(ev.value(c + i)).toLowerCase() === X.toText(ev.value(c + j)).toLowerCase());
      const sameKey = X.toText(ev.value('F' + i)) === X.toText(ev.value('F' + j));
      if (samePay !== sameKey) return { ok: false, kind: 'keyWrong' };
    }
    return { ok: true };
  };

  const L4 = [
    { id: 'sort-amount', title: 'Biggest payments first', start: sheet(AUG), tools: ['sort'], check: sortedCheck('D', true),
      brief: 'Finance: "Sort the August payments by amount, largest first."',
      concept: 'Sorting reorders whole rows by one column. Select any cell of that column, then choose the direction: A→Z is smallest first, Z→A largest first.',
      skeleton: 'select a cell in column D → Sort _→_',
      solution: { cmd: 'Select a cell in column D (amount), then Sort Z→A', parts: [['column D', 'The column to sort by.'], ['Z→A', 'Descending: largest first.']], steps: [{ sort: 'D', desc: true }] } },

    { id: 'filter', title: 'Just one artist', start: sheet(AUG), tools: ['sort', 'filter'], check: filterCheck,
      brief: 'Support: "Show me only the payments of DJ Pampa."',
      concept: 'A filter hides the rows that do not match, without deleting anything. Select a cell with the value to keep, then Filter.',
      skeleton: 'select a cell that says DJ Pampa → Filter',
      solution: { cmd: 'Select a cell in column B with DJ Pampa, then Filter = value', parts: [['Filter', 'Keeps only rows with that same value in that column.']], steps: [{ filter: 'B', value: 'DJ Pampa' }] },
      note: 'Two payments, same song, same amount, same day. Suspicious.' },

    { id: 'sort-artist', title: 'Group them visually', start: sheet(AUG), tools: ['sort', 'filter'], check: sortedCheck('B', false),
      brief: 'Support: "Sort the payments by artist, A to Z, so repeated payments end up next to each other."',
      concept: 'Same sort tool, on the artist column, ascending.',
      skeleton: 'select a cell in column B → Sort _→_',
      solution: { cmd: 'Select a cell in column B (artist), then Sort A→Z', parts: [['column B', 'Artist.'], ['A→Z', 'Alphabetical.']], steps: [{ sort: 'B' }] } },

    { id: 'key', title: 'Build a key', start: sheet(AUG, { F1: 'key' }), tools: ['fill'], check: keyCheck,
      brief: 'Data team: "To catch duplicates we need one cell per row that identifies the payment: in F2, join the artist and the song, then fill down to F16."',
      concept: '& joins texts: =B2&C2 glues them. A separator like " | " makes it readable: =B2&" | "&C2.',
      skeleton: '=__&" | "&__   then Fill ↓',
      solution: { cmd: 'F2: =B2&" | "&C2\nthen Fill ↓ to F16', parts: [['B2&" | "&C2', 'Artist, a separator, then the song.']], steps: [{ set: 'F2', v: '=B2&" | "&C2' }, { fill: 'F2', to: LAST }] } },

    { id: 'count-key', title: 'How many of each?', start: sheet(AUG, { F1: 'key', G1: 'copies' }, KEY), tools: ['fill'], targets: 'G2:G16',
      brief: 'Data team: "In G2, how many times does this row\'s key appear in the whole column F? Fill down to G16."',
      concept: 'COUNTIF over the locked key column, with this row\'s key as the criterion. A count above 1 means duplicate.',
      skeleton: '=COUNTIF($_$_:$_$__, F2)   then Fill ↓',
      solution: { cmd: 'G2: =COUNTIF($F$2:$F$16,F2)\nthen Fill ↓ to G16', parts: [['$F$2:$F$16', 'Every key (locked).'], ['F2', 'This row\'s key (moves).']], steps: [{ set: 'G2', v: '=COUNTIF($F$2:$F$16,F2)' }, { fill: 'G2', to: LAST }] },
      note: 'COUNTIFS($B$2:$B$16,B2,$C$2:$C$16,C2) gives the same without a key column.' },

    { id: 'flag', title: 'Flag the duplicates', start: sheet(AUG, { F1: 'key', G1: 'copies', H1: 'flag' }, KEY, fillCol('G', 2, LAST, '=COUNTIF($F$2:$F$16,F2)')), tools: ['fill'], targets: 'H2:H16',
      brief: 'Support: "In H2, write DUP if the payment appears more than once, otherwise OK. Fill down."',
      concept: 'IF(condition, value_if_true, value_if_false). Text results go in double quotes.',
      skeleton: '=IF(__>1, "___", "__")   then Fill ↓',
      solution: { cmd: 'H2: =IF(G2>1,"DUP","OK")\nthen Fill ↓ to H16', parts: [['G2>1', 'The condition: more than one copy.'], ['"DUP"', 'If true.'], ['"OK"', 'If false.']], steps: [{ set: 'H2', v: '=IF(G2>1,"DUP","OK")' }, { fill: 'H2', to: LAST }] },
      note: 'In real Excel, Conditional Formatting → Highlight duplicates does this visually; a flag column also works with filters and pivots.' },
  ];

  function pivotCheck(sh, exp) {
    if (!sh.pivot) return { ok: false, kind: 'noPivot' };
    const a = X.pivot(sh, sh.pivot), b = X.pivot(exp, exp.pivot);
    const norm = p => p.rows.map(r => r.label.toLowerCase() + '=' + Math.round(r.value * 100) / 100).join('|');
    return norm(a) === norm(b) ? { ok: true } : { ok: false, kind: 'wrongPivot' };
  }
  const L5 = [
    { id: 'pivot-sum', title: 'Your first pivot', start: sheet(AUG), tools: ['pivot'], check: pivotCheck,
      brief: 'Finance: "Build a pivot table: one row per artist, with the total amount paid in August."',
      concept: 'A pivot table groups rows: Rows = the column to group by, Values = the column to summarize, and how (Sum, Count, Average).',
      skeleton: 'Pivot: Rows = ______, Values = ______, Sum',
      solution: { cmd: 'Pivot: Rows = artist, Values = amount, Sum → Build', parts: [['Rows = artist', 'One row per artist.'], ['Values = amount, Sum', 'Adds their amounts.']], steps: [{ pivot: { rows: 'B', values: 'D', agg: 'SUM' } }] },
      note: 'Same idea as SQL\'s GROUP BY artist with SUM(amount).' },

    { id: 'pivot-count', title: 'Count with a pivot', start: sheet(AUG), tools: ['pivot'], check: pivotCheck,
      brief: 'Finance: "Now a pivot with the NUMBER of payments per artist."',
      concept: 'Same pivot, but summarize by Count instead of Sum.',
      skeleton: 'Pivot: Rows = artist, Values = __, _____',
      solution: { cmd: 'Pivot: Rows = artist, Values = id, Count → Build', parts: [['Count', 'How many rows each artist has.']], steps: [{ pivot: { rows: 'B', values: 'A', agg: 'COUNT' } }] } },

    { id: 'copy-number', title: 'Which copy is this?', start: sheet(AUG, { F1: 'key', G1: 'copy' }, KEY), tools: ['fill'], targets: 'G2:G16',
      brief: 'Data team: "In G2, number the copies of each key: the first time a key appears it is 1, the second time 2. Fill down."',
      concept: 'Count only from the top down to this row: $F$2:F2 locks the start and lets the end move, so the range grows as you fill.',
      skeleton: '=COUNTIF($_$_:__, F2)   then Fill ↓',
      solution: { cmd: 'G2: =COUNTIF($F$2:F2,F2)\nthen Fill ↓ to G16', parts: [['$F$2', 'Start locked at the top.'], [':F2', 'End not locked: F3, F4… a growing range.'], ['F2', 'This row\'s key.']], steps: [{ set: 'G2', v: '=COUNTIF($F$2:F2,F2)' }, { fill: 'G2', to: LAST }] } },

    { id: 'overpaid', title: 'Overpaid column', start: sheet(AUG, { F1: 'key', G1: 'copy', H1: 'overpaid' }, KEY, COPY), tools: ['fill'], targets: 'H2:H16',
      brief: 'Finance: "In H2, the overpaid amount: the payment\'s amount if it is a second (or later) copy, 0 otherwise. Fill down."',
      concept: 'IF on the copy number: a copy above 1 is money paid twice.',
      skeleton: '=IF(__>1, __, _)   then Fill ↓',
      solution: { cmd: 'H2: =IF(G2>1,D2,0)\nthen Fill ↓ to H16', parts: [['G2>1', 'A repeated copy…'], ['D2', '…counts its amount as overpaid.'], ['0', 'The first copy is legitimate.']], steps: [{ set: 'H2', v: '=IF(G2>1,D2,0)' }, { fill: 'H2', to: LAST }] } },

    { id: 'pivot-overpaid', title: 'Overpaid per artist', start: sheet(AUG, { F1: 'key', G1: 'copy', H1: 'overpaid' }, KEY, COPY, OVERPAID), tools: ['pivot'], check: pivotCheck,
      brief: 'Finance: "Pivot it: overpaid amount per artist."',
      concept: 'The pivot can summarize the column you just built.',
      skeleton: 'Pivot: Rows = ______, Values = ________, Sum',
      solution: { cmd: 'Pivot: Rows = artist, Values = overpaid, Sum → Build', parts: [['Values = overpaid', 'The helper column.'], ['Sum', 'Added per artist.']], steps: [{ pivot: { rows: 'B', values: 'H', agg: 'SUM' } }] },
      note: 'Same numbers as the SQL track: DJ Pampa 220, Luna Ferreyra 185, Sofía Beltrán 140, Nico Valdés 115, Camila Roldán 95.5.' },

    { id: 'client-table', title: 'The table for the client', tools: ['fill'], targets: ['L2:L6', 'M2:M6', 'M7'],
      start: sheet(AUG, { F1: 'key', G1: 'copy', H1: 'overpaid' }, KEY, COPY, OVERPAID,
        grid([['artist', 'country', 'overpaid'], ['DJ Pampa'], ['Luna Ferreyra'], ['Sofía Beltrán'], ['Nico Valdés'], ['Camila Roldán'], ['Total']], X.colNum('K'), 1), ARTISTS('O')),
      brief: 'Head of Operations: "Finish the summary in K1:M7 for the client: each artist\'s country (artists table in O:P), their overpaid amount from column H, and the total in M7."',
      concept: 'Everything together: a lookup for the country, SUMIF over the overpaid column for each artist, and SUM for the total. Lock the ranges before filling.',
      skeleton: 'L2: =XLOOKUP(K2, …, …)   M2: =SUMIF($B$2:$B$16, K2, $_$_:$_$__)   M7: =SUM(…)',
      solution: { cmd: 'L2: =XLOOKUP(K2,$O$2:$O$10,$P$2:$P$10), Fill ↓ to L6\nM2: =SUMIF($B$2:$B$16,K2,$H$2:$H$16), Fill ↓ to M6\nM7: =SUM(M2:M6)', parts: [['XLOOKUP(K2,$O$2:$O$10,$P$2:$P$10)', 'Country of each artist.'], ['SUMIF($B$2:$B$16,K2,$H$2:$H$16)', 'Their overpaid amount.'], ['SUM(M2:M6)', 'The total to refund.']],
        steps: [{ set: 'L2', v: '=XLOOKUP(K2,$O$2:$O$10,$P$2:$P$10)' }, { fill: 'L2', to: 6 }, { set: 'M2', v: '=SUMIF($B$2:$B$16,K2,$H$2:$H$16)' }, { fill: 'M2', to: 6 }, { set: 'M7', v: '=SUM(M2:M6)' }] },
      note: 'That is the Excel part of the Final Case: a table a client can read, totalling 755.5 to refund.' },
  ];

  const LEVELS = [
    { id: 'basics', title: 'Formulas and ranges', minutes: 10,
      intro: 'Formulas, ranges and filling down: the base of every spreadsheet.',
      cheat: [['=…', 'Every formula starts with ='], ['A1', 'A cell (column A, row 1)'], ['C2:C15', 'A range'], ['SUM / AVERAGE (range)', 'Total / mean'],
        ['COUNT (range)', 'How many numbers'], ['MAX / MIN (range)', 'Largest / smallest'], ['+ - * /', 'Math'], ['Fill ↓', 'Copy a formula down (references move)']],
      missions: L1 },
    { id: 'conditional', title: 'COUNTIF, SUMIF and $', minutes: 12,
      intro: 'Count and add only what matches, and lock references before filling.',
      cheat: [['COUNTIF(range, crit)', 'Count matches'], ['SUMIF(range, crit, sum_range)', 'Add where it matches'], ['">100"', 'Criterion with an operator, in quotes'],
        ['$B$2', 'Locked reference (stays when filling)'], ['$B$2:F2', 'Locked start, moving end']],
      missions: L2 },
    { id: 'lookups', title: 'Lookups', minutes: 12,
      intro: 'Bring a value from another table: VLOOKUP, XLOOKUP, and what to do when it is not found.',
      cheat: [['VLOOKUP(v, table, col, FALSE)', 'Find v in the 1st column, return column col'], ['XLOOKUP(v, look_col, return_col, [if_not_found])', 'Find v, return the matching cell'],
        ['TRIM(text)', 'Remove extra spaces'], ['#N/A', 'Not found']],
      missions: L3 },
    { id: 'duplicates', title: 'Sort, filter and duplicates', minutes: 12,
      intro: 'Organize the August payments and catch the ones that appear twice.',
      cheat: [['Sort A→Z / Z→A', 'Reorder rows by the selected column'], ['Filter = value', 'Show only rows with that value'], ['=B2&" | "&C2', 'Join texts with &'],
        ['IF(cond, a, b)', 'a if cond is true, otherwise b'], ['COUNTIF($F$2:$F$16, F2) > 1', 'Duplicate test']],
      missions: L4 },
    { id: 'pivot', title: 'Pivots and the client summary', minutes: 14,
      intro: 'Summarize with pivot tables, compute the overpaid money, and build the table for the client.',
      cheat: [['Pivot: Rows / Values / Sum', 'Group and summarize'], ['COUNTIF($F$2:F2, F2)', 'Copy number (growing range)'], ['IF(copy>1, amount, 0)', 'Overpaid helper'],
        ['SUMIF + XLOOKUP + SUM', 'The client summary']],
      missions: L5 },
  ];

  const flat = [];
  LEVELS.forEach((lv, li) => lv.missions.forEach((m, mi) => flat.push({ mission: m, li, mi, gi: flat.length })));

  /* ---- evaluation ---- */
  function applySteps(sh, steps) {
    for (const s of steps) {
      if (s.set) sh.cells[s.set] = s.v;
      if (s.fill) X.fillDown(sh, s.fill, s.to);
      if (s.sort) X.sortTable(sh, s.sort, !!s.desc);
      if (s.filter) sh.filter = { col: s.filter, value: s.value };
      if (s.pivot) sh.pivot = Object.assign({}, s.pivot);
    }
    return sh;
  }
  const startSheet = m => X.newSheet(m.start);
  const cache = {};
  const expectedSheet = m => cache[m.id] || (cache[m.id] = applySteps(startSheet(m), m.solution.steps));
  const same = (a, b) => (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) < 0.005
    : X.toText(a).trim().toLowerCase() === X.toText(b).trim().toLowerCase();

  function checkTargets(m, sh, exp) {
    const cells = X.rangeCells(m.targets);
    const ev = X.evaluator(sh), ee = X.evaluator(exp);
    for (const [i, a] of cells.entries()) {
      const raw = sh.cells[a];
      if (raw == null || raw === '') return { ok: false, kind: i === 0 ? 'empty' : 'notFilled', cell: a, first: cells[0] };
      if (!(typeof raw === 'string' && raw.startsWith('='))) return { ok: false, kind: 'notFormula', cell: a };
      const v = ev.value(a);
      if (X.isErr(v)) return { ok: false, kind: 'error', cell: a, code: v.e, fn: v.fn, msg: v.msg };
      if (!same(v, ee.value(a))) return { ok: false, kind: i === 0 ? 'wrong' : 'wrongLater', cell: a, first: cells[0] };
    }
    if (m.uses) {
      const fns = new Set([].concat(...cells.map(a => X.functionsIn(sh.cells[a]))));
      if (!m.uses.some(f => fns.has(f))) return { ok: false, kind: 'uses' };
    }
    return { ok: true };
  }
  function evaluate(m, sh) {
    const exp = expectedSheet(m);
    return m.check ? m.check(sh, exp) : checkTargets(m, sh, exp);
  }

  /* ---- hint 1: which part is off ---- */
  const ERRORS = {
    '#NAME?': 'a name the sheet does not recognize: a misspelled or unsupported function, or text without double quotes',
    '#DIV/0!': 'a division by zero or by an empty cell',
    '#N/A': 'the lookup did not find the value',
    '#REF!': 'a reference outside the table (for VLOOKUP: a column number bigger than the table)',
    '#VALUE!': 'text used where a number (or a single cell) was expected',
    '#CIRC': 'the formula points at its own cell',
    '#ERROR': 'the formula cannot be read: check parentheses, commas and quotes',
  };
  function diagnose(m, sh, r) {
    switch (r.kind) {
      case 'empty': return 'Cell ' + r.cell + ' is still empty.';
      case 'notFilled': return r.first + ' has something, but ' + r.cell + ' is still empty: it has to go all the way down.';
      case 'notFormula': return r.cell + ' holds a value typed by hand. This needs a formula (starting with =) so it updates when the data changes.';
      case 'error': return r.cell + ' shows ' + r.code + ': ' + (ERRORS[r.code] || 'an error') + '.' + (r.msg ? ' (' + r.msg + ')' : '');
      case 'wrong': return r.cell + ' returns a value, but not the right one. Check the range and the condition you used.';
      case 'wrongLater': return r.first + ' is right, but ' + r.cell + ' is not: when the formula was filled down, a reference that should have stayed fixed moved along (or one that should move did not).';
      case 'uses': return 'The values are right, but this mission practices a specific function: reread the task.';
      case 'notSorted': return 'Nothing has been sorted yet: select a cell in the column to sort by, then use a sort button.';
      case 'sortOrder': return 'The rows are intact, but not in the requested order. Check which column you sorted by and the direction.';
      case 'dataChanged': return 'Some rows changed. Click "Reset sheet" and use only the sort buttons.';
      case 'noFilter': return 'No filter is on yet: select a cell with the value you want to keep, then Filter.';
      case 'wrongFilter': return 'A filter is on, but it keeps the wrong rows. Check which cell you filtered on.';
      case 'noPivot': return 'There is no pivot table yet: choose the fields in the Pivot panel and build it.';
      case 'wrongPivot': return 'The pivot is there, but it summarizes something else. Check the Rows field, the Values field and how it is summarized.';
      case 'keyWrong': return 'Some different payments got the same key, or copies of the same payment got different keys: the key must combine the artist and the song.';
    }
    return 'Something is off: compare your sheet with the task.';
  }

  /* ---- typical spreadsheet mistakes ---- */
  const targetRaws = (m, sh) => (m.targets ? X.rangeCells(m.targets) : ['F2']).map(a => sh.cells[a]).filter(v => typeof v === 'string');
  const DETECTORS = [
    { id: 'missing-equals', label: 'Writing a formula without =',
      tip: 'Formulas start with =. Without it, the sheet just shows the text you typed.',
      test: c => c.raws.some(v => !v.startsWith('=') && /^\s*[A-Za-z.]+\s*\(|^\s*[A-Za-z]+\d+\s*[-+*/&]/.test(v)) },
    { id: 'relative-fill', label: 'Forgetting $ when filling down',
      tip: 'A $ locks a reference: $B$2:$B$16 stays the same in every row when you fill down.',
      test: c => c.r.kind === 'wrongLater' && !!c.raws[0] && !c.raws[0].includes('$') },
    { id: 'vlookup-approx', label: 'VLOOKUP without FALSE',
      tip: 'Without FALSE as its 4th argument, VLOOKUP does an approximate match and can return the wrong row.',
      test: c => c.raws.some(v => /(VLOOKUP|BUSCARV)\(/i.test(v) && !/(FALSE|FALSO|[,;]\s*0\s*\))/i.test(v)) },
    { id: 'criteria-quotes', label: 'Criterion with an operator but no quotes',
      tip: 'A criterion with an operator goes in double quotes: ">100", not >100.',
      test: c => c.raws.some(v => /(COUNTIFS?|SUMIFS?|CONTAR\.SI|SUMAR\.SI)\([^)]*[,;]\s*[<>]=?\s*\d/i.test(v)) },
    { id: 'unsupported-function', label: 'Using a function the sheet does not support',
      tip: 'This sheet supports: ' + X.FUNCS.join(', ') + ' (Spanish names work too).',
      test: c => c.r.code === '#NAME?' && !!c.r.fn },
    { id: 'unquoted-text', label: 'Text in a formula without quotes',
      tip: 'Text inside a formula goes in double quotes, like "DUP" or "not found".',
      test: c => c.r.code === '#NAME?' && !c.r.fn },
    { id: 'vlookup-column', label: 'Wrong VLOOKUP column number',
      tip: 'The column number counts from the first column of the table range, starting at 1.',
      test: c => c.r.code === '#REF!' && c.raws.some(v => /(VLOOKUP|BUSCARV)/i.test(v)) },
    { id: 'lookup-not-found', label: 'Lookup not finding a value',
      tip: 'Not found usually means a spelling difference or extra spaces between the two tables.',
      test: c => c.r.code === '#N/A' },
    { id: 'circular', label: 'Circular reference',
      tip: 'A formula cannot use its own cell: point at the cells with the data instead.',
      test: c => c.r.code === '#CIRC' },
  ];
  function detectMistakes(m, sh, r) {
    const c = { r, raws: targetRaws(m, sh) };
    return DETECTORS.filter(d => { try { return d.test(c); } catch (e) { return false; } });
  }

  function cheatUpTo(li) { return LEVELS.slice(0, li + 1).map(lv => ({ title: lv.title, rows: lv.cheat })); }

  OT.tracks = OT.tracks || {};
  OT.tracks.excel = {
    id: 'excel', title: 'Excel', levels: LEVELS, flat,
    startSheet, applySteps, expectedSheet, evaluate, diagnose, detectMistakes, cheatUpTo,
    notice: { title: 'A small spreadsheet, not all of Excel.',
      text: 'Formulas use English names (SUM, COUNTIF, VLOOKUP…). Spanish names work too (SUMA, CONTAR.SI, BUSCARV…), and ; works as a separator. Only the functions on the cheat sheet are supported; anything else shows #NAME?.' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
