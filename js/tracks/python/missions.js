/* Python track: levels, missions (starter code + tests), hint-1 diagnosis and mistake tips.
   Tests are Python snippets run by the harness after the player's code; missions that read
   payments.csv run twice, the second time on a different file, so hard-coded answers fail. */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  const D = OT.data;
  const py = String.raw;

  /* ---- files ---- */
  function csvOf(rows) {
    const cols = D.schema.payments;
    const cell = (c, v) => (v === null || v === undefined ? '' : c === 'amount' ? Number(v).toFixed(2) : String(v));
    return [cols.join(',')].concat(rows.map(r => cols.map(c => cell(c, r[c])).join(','))).join('\n') + '\n';
  }
  const MAIN = csvOf(D.payments);
  const NO_DUPS = D.payments.filter(p => p.id < 16 || p.id > 21);
  const OTHER_DUPS = NO_DUPS.concat([9, 10, 10, 13].map((id, i) => Object.assign({}, D.payments.find(p => p.id === id), { id: 30 + i })));
  const TWO = [{ 'payments.csv': MAIN }, { 'payments.csv': csvOf(OTHER_DUPS) }];
  const WITH_CLEAN = TWO.map(f => Object.assign({ 'clean.csv': csvOf(NO_DUPS) }, f));

  const LOAD = "import csv\n\nwith open('payments.csv') as f:\n    rows = list(csv.DictReader(f))\n";
  const FIND = "def find_duplicates(rows):\n    seen = set()\n    extra = []\n    for r in rows:\n        key = (r['artist'], r['song'], r['payment_date'][:7])\n        if key in seen:\n            extra.append(r)\n        seen.add(key)\n    return extra\n";
  const OVER = "def overpaid_by_artist(rows):\n    totals = {}\n    for r in find_duplicates(rows):\n        totals[r['artist']] = totals.get(r['artist'], 0) + float(r['amount'])\n    return totals\n";
  const t = (name, code, first) => ({ name, code, first: !!first });

  const L1 = [
    { id: 'variables', title: 'Your first variables',
      brief: 'Finance: "Store a payment amount of 125 in amount, a 15 fee in fee, and their sum in total."',
      concept: 'A variable is a name for a value: name = value. Let Python work out total from the other two: total = amount + fee.',
      skeleton: 'amount = ___\nfee = __\ntotal = ______ + ___',
      starter: '# Create amount, fee and total\n',
      tests: [
        t('amount is 125', py`assert var('amount') == 125, f"amount is {var('amount')!r}, it should be 125"`),
        t('fee is 15', py`assert var('fee') == 15, f"fee is {var('fee')!r}, it should be 15"`),
        t('total adds them up', py`assert var('total') == var('amount') + var('fee'), f"total is {var('total')!r}"`),
        t('total is calculated', py`assert uses('BinOp'), "write total = amount + fee instead of typing the result"`),
      ],
      solution: { cmd: 'amount = 125\nfee = 15\ntotal = amount + fee\n', parts: [['amount = 125', 'Stores 125 under the name amount.'], ['total = amount + fee', 'Python computes 140 from the other two.']] } },

    { id: 'lists', title: 'A list of amounts',
      brief: 'Data team: "Put the amounts 125, 60, 101 and 80 in a list called amounts, and store how many there are in count."',
      concept: 'A list holds several values in order: [a, b, c]. len(list) says how many items it has.',
      skeleton: 'amounts = [___, __, ___, __]\ncount = ___(amounts)',
      starter: '# Create the list and count its items\n',
      tests: [
        t('amounts holds the four values', py`assert var('amounts') == [125, 60, 101, 80], f"amounts is {var('amounts')!r}"`),
        t('count matches the list', py`assert var('count') == len(var('amounts')), f"count is {var('count')!r}"`),
        t('count uses len()', py`assert calls('len'), "use len(amounts), so it still works when the list changes"`),
      ],
      solution: { cmd: 'amounts = [125, 60, 101, 80]\ncount = len(amounts)\n', parts: [['[125, 60, 101, 80]', 'A list with four numbers.'], ['len(amounts)', 'How many items it has.']] } },

    { id: 'for-loop', title: 'Add them up with a loop',
      brief: 'Finance: "Add up every amount of the list with a for loop (not sum()), into total."',
      concept: 'for item in list: runs the indented lines once per item. Indent them with 4 spaces.',
      skeleton: 'for amount in _______:\n    total = _____ + ______',
      starter: 'amounts = [125, 60, 101, 80, 220]\ntotal = 0\n# add every amount to total with a for loop\n',
      tests: [
        t('total is the sum of amounts', py`assert var('total') == sum(var('amounts')), f"total is {var('total')!r}"`),
        t('uses a for loop', py`assert uses('For'), "use a for loop over amounts"`),
        t('without sum()', py`assert not calls('sum'), "this one is about the loop: keep sum() for later"`),
      ],
      solution: { cmd: 'amounts = [125, 60, 101, 80, 220]\ntotal = 0\nfor amount in amounts:\n    total = total + amount\n', parts: [['for amount in amounts:', 'Repeat for every value in the list.'], ['    total = total + amount', 'Indented: runs each time, adding the current value.']] } },

    { id: 'f-strings', title: 'Dictionaries and f-strings',
      brief: 'Marketing: "Print DJ Pampa is from Chile, taking both values from the artist dictionary."',
      concept: "A dictionary maps keys to values: artist['name']. An f-string puts values inside text: f\"{a} is from {b}\".",
      skeleton: "print(f\"{artist['____']} is from {artist['_______']}\")",
      starter: "artist = {'name': 'DJ Pampa', 'country': 'Chile'}\n# print: DJ Pampa is from Chile\n",
      tests: [
        t('prints the sentence', py`assert lines() == ['DJ Pampa is from Chile'], f"printed {lines()}"`),
        t('uses an f-string', py`assert uses('JoinedStr'), "build the text with an f-string: f\"...\""`),
        t('reads the dictionary', py`assert uses('Subscript'), "take the values from artist['name'] and artist['country']"`),
      ],
      solution: { cmd: "artist = {'name': 'DJ Pampa', 'country': 'Chile'}\nprint(f\"{artist['name']} is from {artist['country']}\")\n", parts: [["artist['name']", 'The value stored under the key name.'], ['f"…{…}…"', 'Text with values inserted where the braces are.']] } },

    { id: 'loop-dicts', title: 'One line per payment',
      brief: 'Finance: "Print one line per payment: the artist, a colon and the amount, like Luna Ferreyra: 125.0"',
      concept: 'Loop over the list; each item is a dictionary, so read its keys inside the loop.',
      skeleton: "for p in ________:\n    print(f\"{p['______']}: {p['______']}\")",
      starter: "payments = [\n    {'artist': 'Luna Ferreyra', 'amount': 125.0},\n    {'artist': 'DJ Pampa', 'amount': 220.0},\n    {'artist': 'Nico Valdés', 'amount': 115.0},\n]\n# print one line per payment, like: Luna Ferreyra: 125.0\n",
      tests: [
        t('one line per payment', py`exp = [f"{p['artist']}: {p['amount']}" for p in var('payments')]
assert lines() == exp, f"printed {lines()}"`),
        t('uses a loop', py`assert uses('For'), "loop over payments instead of printing each one by hand"`),
      ],
      solution: { cmd: "payments = [\n    {'artist': 'Luna Ferreyra', 'amount': 125.0},\n    {'artist': 'DJ Pampa', 'amount': 220.0},\n    {'artist': 'Nico Valdés', 'amount': 115.0},\n]\nfor p in payments:\n    print(f\"{p['artist']}: {p['amount']}\")\n", parts: [['for p in payments:', 'p is one dictionary at a time.'], ["p['artist'], p['amount']", 'Its two values.']] } },
  ];

  const L2 = [
    { id: 'def', title: 'Your first function',
      brief: 'Finance: "Write a function add_fee(amount) that returns the amount plus a 15 fee."',
      concept: 'def name(parameter): defines a function. return sends the result back to whoever called it (print would only show it).',
      skeleton: 'def add_fee(______):\n    return ______ + __',
      starter: '# define add_fee here\n',
      tests: [
        t('add_fee(100) is 115', py`r = call('add_fee', 100)
assert r == 115, f"add_fee(100) returned {r!r}, expected 115"`),
        t('add_fee(0) is 15', py`r = call('add_fee', 0)
assert r == 15, f"add_fee(0) returned {r!r}, expected 15"`),
        t('works with decimals', py`r = call('add_fee', 60.5)
assert r == 75.5, f"add_fee(60.5) returned {r!r}, expected 75.5"`),
      ],
      solution: { cmd: 'def add_fee(amount):\n    return amount + 15\n', parts: [['def add_fee(amount):', 'A function with one input, amount.'], ['    return amount + 15', 'Sends back the amount plus the fee.']] } },

    { id: 'if-else', title: 'Big or small',
      brief: 'Finance: "Write size(amount): it returns \'big\' when the amount is 150 or more, and \'small\' otherwise."',
      concept: 'if condition: … else: … picks one of two paths. >= means "greater than or equal".',
      skeleton: "def size(amount):\n    if amount __ 150:\n        return '___'\n    else:\n        return '_____'",
      starter: '# define size here\n',
      tests: [
        t('200 is big', py`r = call('size', 200)
assert r == 'big', f"size(200) returned {r!r}"`),
        t('150 counts as big', py`r = call('size', 150)
assert r == 'big', f"size(150) returned {r!r}: 150 or more is big"`),
        t('149.99 is small', py`r = call('size', 149.99)
assert r == 'small', f"size(149.99) returned {r!r}"`),
      ],
      solution: { cmd: "def size(amount):\n    if amount >= 150:\n        return 'big'\n    else:\n        return 'small'\n", parts: [['if amount >= 150:', '150 or more…'], ["return 'big'", '…is big.'], ["else: return 'small'", 'Anything else.']] } },

    { id: 'none', title: 'Missing values',
      brief: 'Support: "Some payments have no amount (None). Make size(amount) return \'missing\' for those, and keep big/small for the rest."',
      concept: 'Test for None first, with is None, and return early. Comparing None >= 150 would crash.',
      skeleton: "def size(amount):\n    if amount __ ____:\n        return 'missing'\n    if amount >= 150:\n        return 'big'\n    return 'small'",
      starter: "def size(amount):\n    if amount >= 150:\n        return 'big'\n    return 'small'\n",
      tests: [
        t('None is missing', py`r = call('size', None)
assert r == 'missing', f"size(None) returned {r!r}"`),
        t('150 is still big', py`r = call('size', 150)
assert r == 'big', f"size(150) returned {r!r}"`),
        t('20 is still small', py`r = call('size', 20)
assert r == 'small', f"size(20) returned {r!r}"`),
      ],
      solution: { cmd: "def size(amount):\n    if amount is None:\n        return 'missing'\n    if amount >= 150:\n        return 'big'\n    return 'small'\n", parts: [['if amount is None:', 'Checked first, before any comparison.'], ["return 'missing'", 'Leaves the function right there.']] } },

    { id: 'clean', title: 'Clean a name',
      brief: 'Data team: "Write clean(name): it removes the spaces at both ends and lowercases. For None it returns an empty text \'\'."',
      concept: 'Text has methods: name.strip() removes surrounding spaces, name.lower() lowercases. They can be chained: name.strip().lower().',
      skeleton: "def clean(name):\n    if name is None:\n        return ''\n    return name._____()._____()",
      starter: '# define clean here\n',
      tests: [
        t('removes spaces', py`r = call('clean', '  Marta Quiroga ')
assert r == 'marta quiroga', f"clean('  Marta Quiroga ') returned {r!r}"`),
        t('lowercases', py`r = call('clean', 'LOS CARDALES')
assert r == 'los cardales', f"clean('LOS CARDALES') returned {r!r}"`),
        t('None gives empty text', py`r = call('clean', None)
assert r == '', f"clean(None) returned {r!r}"`),
      ],
      solution: { cmd: "def clean(name):\n    if name is None:\n        return ''\n    return name.strip().lower()\n", parts: [['name.strip()', 'Without the spaces at the ends…'], ['.lower()', '…and lowercased.']] } },

    { id: 'total-for', title: 'Total for one artist',
      brief: 'Finance: "Write total_for(payments, artist): it adds up the amounts of the payments of that artist."',
      concept: 'A loop with an if inside: only the payments that match add to the running total.',
      skeleton: "def total_for(payments, artist):\n    total = 0\n    for p in payments:\n        if p['______'] == ______:\n            total += p['______']\n    return total",
      starter: '# define total_for here\n',
      tests: [
        t('adds only that artist', py`ps = [{'artist': 'A', 'amount': 10}, {'artist': 'B', 'amount': 5}, {'artist': 'A', 'amount': 2.5}]
r = call('total_for', ps, 'A')
assert r == 12.5, f"total_for(..., 'A') returned {r!r}, expected 12.5"`),
        t('0 when there are none', py`r = call('total_for', [{'artist': 'B', 'amount': 5}], 'A')
assert r == 0, f"returned {r!r}, expected 0"`),
      ],
      solution: { cmd: "def total_for(payments, artist):\n    total = 0\n    for p in payments:\n        if p['artist'] == artist:\n            total += p['amount']\n    return total\n", parts: [['total = 0', 'Start the running total.'], ["if p['artist'] == artist:", 'Only matching payments…'], ["total += p['amount']", '…add their amount.']] } },
  ];

  const L3 = [
    { id: 'csv-header', title: 'Open the CSV', datasets: TWO,
      brief: 'Data team: "There is a payments.csv file next to your code. Open it with the csv module and print its first row, the header."',
      concept: 'with open(name) as f: opens a file and closes it afterwards. csv.reader(f) gives one list per line; next(reader) takes the first one.',
      skeleton: "import csv\n\nwith open('____________') as f:\n    reader = csv.______(f)\n    print(____(reader))",
      starter: 'import csv\n\n# open payments.csv and print its first row (the header)\n',
      tests: [
        t('prints the header', py`assert lines()[:1] == [str(['id', 'artist', 'song', 'amount', 'payment_date'])], f"printed {lines()[:3]}"`),
        t('opens the file', py`assert calls('open'), "open the file with open('payments.csv')"`),
      ],
      solution: { cmd: "import csv\n\nwith open('payments.csv') as f:\n    reader = csv.reader(f)\n    print(next(reader))\n", parts: [["with open('payments.csv') as f:", 'Opens the file as f.'], ['csv.reader(f)', 'Splits each line by commas.'], ['next(reader)', 'The first line: the header.']] } },

    { id: 'csv-count', title: 'How many payments?', datasets: TWO,
      brief: 'Data team: "How many payments are in the file? Store the number of data rows (not counting the header) in count."',
      concept: 'csv.DictReader(f) skips the header and gives each row as a dictionary keyed by column name. list(...) collects them all.',
      skeleton: "with open('payments.csv') as f:\n    rows = ____(csv.DictReader(f))\ncount = ___(rows)",
      starter: 'import csv\n\n# read payments.csv and store the number of payments in count\n',
      tests: [t('count is right', py`exp = len(ref_rows())
assert var('count') == exp, f"count is {var('count')!r}, expected {exp}"`)],
      solution: { cmd: "import csv\n\nwith open('payments.csv') as f:\n    rows = list(csv.DictReader(f))\ncount = len(rows)\n", parts: [['csv.DictReader(f)', 'Rows as dictionaries; the header becomes the keys.'], ['list(…)', 'All rows in a list.'], ['len(rows)', 'How many.']] } },

    { id: 'csv-filter', title: 'The August batch', datasets: TWO,
      brief: 'Support: "Print the id of every payment dated 2026-08-14, one per line."',
      concept: "Loop over the DictReader rows and print only when row['payment_date'] matches. Every value read from a CSV is text.",
      skeleton: "for row in csv.DictReader(f):\n    if row['____________'] == '__________':\n        print(row['__'])",
      starter: 'import csv\n\n# print the id of every payment dated 2026-08-14\n',
      tests: [t('prints the right ids', py`exp = [r['id'] for r in ref_rows() if r['payment_date'] == '2026-08-14']
assert lines() == exp, f"printed {lines()}"`)],
      solution: { cmd: "import csv\n\nwith open('payments.csv') as f:\n    for row in csv.DictReader(f):\n        if row['payment_date'] == '2026-08-14':\n            print(row['id'])\n", parts: [['for row in csv.DictReader(f):', 'One row at a time.'], ["if row['payment_date'] == '2026-08-14':", 'Only that date (text compared with text).']] } },

    { id: 'csv-total', title: 'Total for August', datasets: TWO,
      brief: 'Finance: "Add up the amounts of every August 2026 payment into total. Careful: some amounts are empty."',
      concept: "CSV values are text: float(text) turns '125.00' into 125.0. An empty text cannot be converted, so skip rows where amount is ''.",
      skeleton: "total = 0\nfor row in csv.DictReader(f):\n    if row['payment_date'].__________('2026-08') and row['amount']:\n        total += _____(row['amount'])",
      starter: 'import csv\n\n# total of the August 2026 amounts, skipping empty ones\n',
      tests: [t('total is right', py`exp = sum(float(r['amount']) for r in ref_rows() if r['payment_date'].startswith('2026-08') and r['amount'])
assert approx(var('total'), exp), f"total is {var('total')!r}, expected {exp}"`)],
      solution: { cmd: "import csv\n\ntotal = 0\nwith open('payments.csv') as f:\n    for row in csv.DictReader(f):\n        if row['payment_date'].startswith('2026-08') and row['amount']:\n            total += float(row['amount'])\n", parts: [[".startswith('2026-08')", 'Any day of August.'], ["and row['amount']", 'Empty text counts as false: skips missing amounts.'], ["float(row['amount'])", 'Text to number.']] } },

    { id: 'load', title: 'A loader function', datasets: TWO,
      brief: 'Data team: "Write load(path): it returns the rows of the CSV as dictionaries, with amount converted to a float, or None when it is empty."',
      concept: 'Same reading as before, inside a function, changing one value of each row before keeping it.',
      skeleton: "def load(path):\n    rows = []\n    with open(____) as f:\n        for r in csv.DictReader(f):\n            r['amount'] = float(r['amount']) if r['amount'] else ____\n            rows.______(r)\n    return rows",
      starter: 'import csv\n\n# define load(path) here\n',
      tests: [
        t('returns every row', py`rows = call('load', 'payments.csv')
assert isinstance(rows, list) and len(rows) == len(ref_rows()), f"got {type(rows).__name__} with {len(rows) if hasattr(rows, '__len__') else '?'} items"`),
        t('amounts are numbers', py`rows = call('load', 'payments.csv')
bad = [r['amount'] for r in rows if not (r['amount'] is None or isinstance(r['amount'], float))]
assert not bad, f"some amounts are still {type(bad[0]).__name__}: {bad[0]!r}"`),
        t('empty amounts are None', py`rows = call('load', 'payments.csv')
exp = sum(1 for r in ref_rows() if not r['amount'])
got = sum(1 for r in rows if r['amount'] is None)
assert got == exp, f"{got} rows have None, expected {exp}"`),
      ],
      solution: { cmd: "import csv\n\ndef load(path):\n    rows = []\n    with open(path) as f:\n        for r in csv.DictReader(f):\n            r['amount'] = float(r['amount']) if r['amount'] else None\n            rows.append(r)\n    return rows\n", parts: [['def load(path):', 'Works with any file name.'], ["float(…) if r['amount'] else None", 'A number, or None when empty.'], ['rows.append(r)', 'Adds the row to the list.']] } },
  ];

  const COUNTS = LOAD + "\ncounts = {}\nfor r in rows:\n    key = (r['artist'], r['song'], r['payment_date'][:7])\n    counts[key] = counts.get(key, 0) + 1\n";
  const L4 = [
    { id: 'set', title: 'Each artist once',
      brief: 'Data team: "Put the different artists of this list in a set called unique (each one once)."',
      concept: 'A set keeps each value only once and does not care about order: set(list) removes the repeats.',
      skeleton: 'unique = ___(artists)',
      starter: "artists = ['Luna Ferreyra', 'Luna Ferreyra', 'DJ Pampa', 'Sofía Beltrán', 'DJ Pampa', 'Luna Ferreyra']\n# store the different artists in unique\n",
      tests: [
        t('unique is a set', py`assert isinstance(var('unique'), set), f"unique is a {type(var('unique')).__name__}, make it a set"`),
        t('each artist once', py`assert var('unique') == set(var('artists')), f"unique is {var('unique')!r}"`),
      ],
      solution: { cmd: "artists = ['Luna Ferreyra', 'Luna Ferreyra', 'DJ Pampa', 'Sofía Beltrán', 'DJ Pampa', 'Luna Ferreyra']\nunique = set(artists)\n", parts: [['set(artists)', 'Same values, without repeats.']] } },

    { id: 'seen', title: 'Spot the repeats',
      brief: 'Data team: "Put every key that appears more than once in a set called dups."',
      concept: 'Keep a set of what you have already seen. If the current item is already in it, it is a repeat.',
      skeleton: 'seen = set()\ndups = set()\nfor k in keys:\n    if k __ seen:\n        dups.___(k)\n    seen.add(k)',
      starter: "keys = ['A|x', 'B|y', 'A|x', 'C|z', 'B|y', 'A|x']\n# put every key that appears more than once in dups\n",
      tests: [t('dups has the repeated keys', py`keys = var('keys')
exp = {k for k in keys if keys.count(k) > 1}
assert set(var('dups')) == exp, f"dups is {var('dups')!r}, expected {exp!r}"`)],
      solution: { cmd: "keys = ['A|x', 'B|y', 'A|x', 'C|z', 'B|y', 'A|x']\nseen = set()\ndups = set()\nfor k in keys:\n    if k in seen:\n        dups.add(k)\n    seen.add(k)\n", parts: [['if k in seen:', 'Already met before?'], ['dups.add(k)', 'Then it is a repeat.'], ['seen.add(k)', 'Remember it for later.']] } },

    { id: 'counts', title: 'Count each payment', datasets: TWO,
      brief: 'Data team: "Count how many times each (artist, song, month) appears in the file, in a dict called counts. The month is the first 7 characters of payment_date."',
      concept: 'A dictionary can count: counts.get(key, 0) + 1. A tuple (a, b, c) works as a key, and text[:7] takes its first 7 characters.',
      skeleton: "counts = {}\nfor r in rows:\n    key = (r['artist'], r['song'], r['payment_date'][:_])\n    counts[key] = counts.get(key, _) + 1",
      starter: LOAD + "\n# count each (artist, song, month) in a dict called counts\n",
      tests: [t('counts is right', py`exp = {}
for r in ref_rows():
    exp[key(r)] = exp.get(key(r), 0) + 1
got = var('counts')
assert got == exp, f"counts has {len(got) if isinstance(got, dict) else '?'} keys, expected {len(exp)}; check the key and the +1"`)],
      solution: { cmd: COUNTS, parts: [["(r['artist'], r['song'], r['payment_date'][:7])", 'The identity of a payment.'], ['counts.get(key, 0) + 1', 'Current count (0 if new), plus one.']] } },

    { id: 'dup-keys', title: 'Which ones repeat?', datasets: TWO,
      brief: 'Support: "From counts, make a list dup_keys with the keys that appear more than once."',
      concept: 'counts.items() gives (key, number) pairs. A list comprehension filters them in one line: [k for k, n in counts.items() if n > 1].',
      skeleton: 'dup_keys = [k for k, n in counts._____() if n > _]',
      starter: COUNTS + "\n# list the keys that appear more than once in dup_keys\n",
      tests: [t('dup_keys is right', py`exp = {key(r) for r in ref_extra(ref_rows())}
assert set(var('dup_keys')) == exp, f"dup_keys is {var('dup_keys')!r}"`)],
      solution: { cmd: COUNTS + 'dup_keys = [k for k, n in counts.items() if n > 1]\n', parts: [['counts.items()', 'Every (key, count) pair.'], ['if n > 1', 'Only the repeated ones.']] } },

    { id: 'overpaid-dict', title: 'Overpaid per artist', datasets: TWO,
      brief: 'Finance: "Build a dict overpaid: for each artist, the money paid for extra copies (the 2nd, 3rd… time the same artist + song + month appears)."',
      concept: 'Loop with a seen set again: the first copy is fine, every later copy adds its amount to that artist in the dict.',
      skeleton: "overpaid = {}\nseen = set()\nfor r in rows:\n    key = (r['artist'], r['song'], r['payment_date'][:7])\n    if key in ____:\n        overpaid[r['artist']] = overpaid.get(r['artist'], 0) + _____(r['amount'])\n    seen.add(key)",
      starter: LOAD + "\n# overpaid = {artist: money paid for extra copies}\n",
      tests: [t('overpaid is right', py`exp = ref_overpaid(ref_rows())
assert same_dict(var('overpaid'), exp), f"overpaid is {var('overpaid')!r}, expected {exp!r}"`)],
      solution: { cmd: LOAD + "\noverpaid = {}\nseen = set()\nfor r in rows:\n    key = (r['artist'], r['song'], r['payment_date'][:7])\n    if key in seen:\n        overpaid[r['artist']] = overpaid.get(r['artist'], 0) + float(r['amount'])\n    seen.add(key)\n", parts: [['if key in seen:', 'A copy we already paid once…'], ["overpaid.get(…, 0) + float(r['amount'])", '…adds its amount to the artist.'], ['seen.add(key)', 'Remember the first copy.']] },
      note: 'With the real file: DJ Pampa 220, Luna Ferreyra 185, Sofía Beltrán 140, Nico Valdés 115, Camila Roldán 95.5. Same as SQL and Excel.' },
  ];

  const L5 = [
    { id: 'find-duplicates', title: 'find_duplicates()', datasets: TWO,
      brief: 'Data team: "Turn it into a reusable function: find_duplicates(rows) returns the list of rows that are extra copies."',
      concept: 'Same seen-set logic, inside a function that receives the rows and returns a list.',
      skeleton: 'def find_duplicates(rows):\n    seen = set()\n    extra = []\n    for r in rows:\n        key = (…)\n        if key in seen:\n            extra.______(r)\n        seen.add(key)\n    return _____',
      starter: LOAD + "\n# define find_duplicates(rows) here\n",
      tests: [t('returns the extra copies', py`got = call('find_duplicates', ref_rows())
exp = sorted(r['id'] for r in ref_extra(ref_rows()))
ids = sorted(r['id'] for r in got) if isinstance(got, list) else got
assert ids == exp, f"returned ids {ids}, expected {exp}"`)],
      solution: { cmd: LOAD + '\n' + FIND, parts: [['def find_duplicates(rows):', 'Takes the rows as input.'], ['extra.append(r)', 'Collects each extra copy.'], ['return extra', 'Gives the list back.']] } },

    { id: 'overpaid-function', title: 'overpaid_by_artist()', datasets: TWO,
      brief: 'Finance: "Now overpaid_by_artist(rows): it returns {artist: overpaid amount}, using find_duplicates."',
      concept: 'Functions can use other functions: loop over find_duplicates(rows) and add up each amount per artist.',
      skeleton: "def overpaid_by_artist(rows):\n    totals = {}\n    for r in _______________(rows):\n        totals[r['artist']] = totals.get(r['artist'], 0) + float(r['______'])\n    return ______",
      starter: LOAD + '\n' + FIND + "\n# define overpaid_by_artist(rows) here\n",
      tests: [t('returns the right totals', py`exp = ref_overpaid(ref_rows())
got = call('overpaid_by_artist', ref_rows())
assert same_dict(got, exp), f"returned {got!r}, expected {exp!r}"`)],
      solution: { cmd: LOAD + '\n' + FIND + '\n' + OVER, parts: [['for r in find_duplicates(rows):', 'Only the extra copies.'], ["totals.get(r['artist'], 0) + float(r['amount'])", 'Adds each one to its artist.']] } },

    { id: 'write-report', title: 'Write the report', datasets: TWO,
      brief: 'Head of Operations: "Write report.csv with a header artist,overpaid and one row per artist, biggest amount first, with 2 decimals."',
      concept: "open(name, 'w', newline='') opens a file for writing; csv.writer(f).writerow([...]) writes one line. sorted(d.items(), key=lambda x: x[1], reverse=True) orders by amount.",
      skeleton: "totals = overpaid_by_artist(rows)\nwith open('report.csv', '_', newline='') as f:\n    w = csv.writer(f)\n    w.writerow(['artist', 'overpaid'])\n    for artist, amount in sorted(totals.items(), key=lambda x: x[1], reverse=____):\n        w.writerow([artist, f'{amount:.2f}'])",
      starter: LOAD + '\n' + FIND + '\n' + OVER + "\n# write report.csv here\n",
      tests: [
        t('report.csv exists', py`assert read('report.csv') is not None, "there is no report.csv: open it with 'w' and write to it"`),
        t('report has the right rows, biggest first', py`got = list(csv.reader(io.StringIO(read('report.csv') or '')))
exp = [['artist', 'overpaid']] + [[a, f'{v:.2f}'] for a, v in sorted(ref_overpaid(ref_rows()).items(), key=lambda x: x[1], reverse=True)]
assert got == exp, f"report.csv has {got[:3]}..., expected {exp[:3]}..."`),
      ],
      solution: { cmd: LOAD + '\n' + FIND + '\n' + OVER + "\ntotals = overpaid_by_artist(rows)\nwith open('report.csv', 'w', newline='') as f:\n    w = csv.writer(f)\n    w.writerow(['artist', 'overpaid'])\n    for artist, amount in sorted(totals.items(), key=lambda x: x[1], reverse=True):\n        w.writerow([artist, f'{amount:.2f}'])\n", parts: [["open('report.csv', 'w', newline='')", 'A new file to write.'], ["w.writerow(['artist', 'overpaid'])", 'The header.'], ['sorted(…, reverse=True)', 'Biggest amount first.'], ["f'{amount:.2f}'", 'Two decimals.']] } },

    { id: 'guard', title: 'Check before importing', datasets: WITH_CLEAN,
      brief: 'Data team: "To stop this happening again: check_before_import(path) returns the sorted list of duplicated (artist, song, month) keys in a CSV, or an empty list if it is clean. Try it on payments.csv and clean.csv."',
      concept: 'Read the file inside the function, reuse find_duplicates, and turn the extra rows into a set of keys, then sorted().',
      skeleton: "def check_before_import(path):\n    with open(path) as f:\n        rows = list(csv.DictReader(f))\n    keys = {(r['artist'], r['song'], r['payment_date'][:7]) for r in _______________(rows)}\n    return ______(keys)",
      starter: 'import csv\n\n' + FIND + "\n# define check_before_import(path) here\n",
      tests: [
        t('finds the duplicates', py`got = call('check_before_import', 'payments.csv')
exp = sorted({key(r) for r in ref_extra(ref_rows())})
assert got == exp, f"returned {got!r}, expected {exp!r}"`),
        t('a clean file gives []', py`got = call('check_before_import', 'clean.csv')
assert got == [], f"clean.csv returned {got!r}, expected []"`),
      ],
      solution: { cmd: 'import csv\n\n' + FIND + "\ndef check_before_import(path):\n    with open(path) as f:\n        rows = list(csv.DictReader(f))\n    keys = {(r['artist'], r['song'], r['payment_date'][:7]) for r in find_duplicates(rows)}\n    return sorted(keys)\n", parts: [['with open(path) as f:', 'Any file you pass in.'], ['{… for r in find_duplicates(rows)}', 'A set: each duplicated key once.'], ['sorted(keys)', 'A list in a stable order (empty if clean).']] },
      note: 'Run this before every import and the August incident never happens: the file is rejected when the list is not empty.' },

    { id: 'full-script', title: 'The whole automation', datasets: TWO,
      brief: 'Head of Operations: "One script that does it all: read payments.csv and write duplicates_report.txt with one line per extra copy, like id 16: Luna Ferreyra - Mar de Fondo - 125.00, and a last line Total overpaid: 755.50."',
      concept: 'Put the pieces together: read, find the extra copies, write one formatted line each, then the total with 2 decimals.',
      skeleton: "extra = find_duplicates(rows)\nwith open('duplicates_report.txt', 'w') as f:\n    for r in extra:\n        f.write(f\"id {r['id']}: {r['artist']} - {r['song']} - {float(r['amount']):.2f}\\n\")\n    f.write(f\"Total overpaid: {_____:.2f}\\n\")",
      starter: '# Write the whole script: read payments.csv, find the extra copies,\n# and write duplicates_report.txt\n',
      tests: [
        t('the report file exists', py`assert read('duplicates_report.txt') is not None, "there is no duplicates_report.txt"`),
        t('one line per extra copy', py`ex = ref_extra(ref_rows())
exp = [f"id {r['id']}: {r['artist']} - {r['song']} - {float(r['amount']):.2f}" for r in ex]
got = lines(read('duplicates_report.txt') or '')
assert got[:len(exp)] == exp, f"first lines are {got[:2]}, expected {exp[:2]}"`),
        t('ends with the total', py`ex = ref_extra(ref_rows())
total = sum(float(r['amount']) for r in ex)
got = lines(read('duplicates_report.txt') or '')
assert got and got[-1] == f"Total overpaid: {total:.2f}", f"last line is {got[-1] if got else None!r}"`),
      ],
      solution: { cmd: LOAD + '\n' + FIND + "\nextra = find_duplicates(rows)\ntotal = 0\nwith open('duplicates_report.txt', 'w') as f:\n    for r in extra:\n        amount = float(r['amount'])\n        total += amount\n        f.write(f\"id {r['id']}: {r['artist']} - {r['song']} - {amount:.2f}\\n\")\n    f.write(f\"Total overpaid: {total:.2f}\\n\")\n", parts: [['find_duplicates(rows)', 'The extra copies.'], ['f.write(f"…\\n")', 'One formatted line each (\\n ends the line).'], ['Total overpaid: {total:.2f}', 'The closing line.']] },
      note: 'That is the Python part of the Final Case: the manual check, automated.' },
  ];

  const LEVELS = [
    { id: 'basics', title: 'Python basics', minutes: 10,
      intro: 'Variables, lists, dictionaries, loops and f-strings.',
      cheat: [['x = 5', 'A variable'], ['[1, 2, 3]', 'A list'], ['len(x)', 'How many items'], ["{'k': 'v'}", "A dictionary; d['k'] reads it"],
        ['for x in items:', 'Loop (indent the body 4 spaces)'], ['print(…)', 'Show a value'], ['f"{x} and {y}"', 'f-string: values inside text']],
      missions: L1 },
    { id: 'functions', title: 'Functions and conditionals', minutes: 12,
      intro: 'Reusable pieces of code, and choosing between paths.',
      cheat: [['def f(x):', 'Define a function'], ['return value', 'Send the result back'], ['if / elif / else', 'Choose a path'], ['== != >= <', 'Comparisons'],
        ['x is None', 'Is it empty?'], ["text.strip() / .lower()", 'Clean text']],
      missions: L2 },
    { id: 'csv', title: 'Reading a CSV', minutes: 12,
      intro: 'Open payments.csv with the csv module and work with its rows.',
      cheat: [['import csv', 'The CSV module'], ["with open('f.csv') as f:", 'Open a file'], ['csv.reader(f)', 'Rows as lists'], ['csv.DictReader(f)', 'Rows as dictionaries'],
        ["float('125.00')", 'Text to number'], [".startswith('2026-08')", 'Text begins with…']],
      missions: L3 },
    { id: 'duplicates', title: 'Sets and dicts for duplicates', minutes: 12,
      intro: 'Count, spot repeats and add up the overpaid money.',
      cheat: [['set(items)', 'Each value once'], ['x in s', 'Is it already there?'], ['d.get(k, 0) + 1', 'Count with a dict'], ['(a, b, c)', 'A tuple, usable as a key'],
        ['d.items()', '(key, value) pairs'], ['[x for x in xs if …]', 'List comprehension']],
      missions: L4 },
    { id: 'script', title: 'The automation script', minutes: 15,
      intro: 'Functions that find duplicates, measure them and write a report: the check that stops the next incident.',
      cheat: [["open('f', 'w', newline='')", 'Open for writing'], ['csv.writer(f).writerow([…])', 'Write a CSV line'], ['f.write(text)', 'Write text'],
        ['sorted(d.items(), key=lambda x: x[1], reverse=True)', 'Order by value, biggest first'], ["f'{x:.2f}'", 'Two decimals']],
      missions: L5 },
  ];

  const flat = [];
  LEVELS.forEach((lv, li) => lv.missions.forEach((m, mi) => flat.push({ mission: m, li, mi, gi: flat.length })));
  const specOf = m => ({ datasets: m.datasets || [{}], tests: m.tests });
  const passed = r => !!r && !r.timeout && !r.crash && !r.error && r.tests.length > 0 && r.tests.every(x => x.ok);

  /* ---- hint 1 ---- */
  function explainError(e) {
    const at = e.line ? 'Line ' + e.line : 'Your code';
    let m, s;
    if (e.type === 'IndentationError' || e.type === 'TabError') s = at + ': the indentation (the spaces at the start) does not match the lines around it.';
    else if (e.type === 'SyntaxError') {
      if (/expected ':'/.test(e.msg)) s = at + ': a line that opens a block (if, for, def, with, else) must end with a colon.';
      else if (/unterminated string|EOL|unterminated triple/.test(e.msg)) s = at + ': a text is missing its closing quote.';
      else if (/was never closed|unexpected EOF/.test(e.msg)) s = at + ': a parenthesis or bracket is opened but never closed.';
      else if (/Maybe you meant '=='|cannot assign/.test(e.msg)) s = at + ': to compare two values use ==; a single = stores a value.';
      else s = at + ': Python cannot read this line (' + e.msg + ').';
    } else if (e.type === 'NameError' && (m = /name '(\w+)' is not defined/.exec(e.msg))) s = at + ' uses ' + m[1] + ', which does not exist at that point: check the spelling, or create it before using it.';
    else if (e.type === 'KeyError') s = at + ': the dictionary has no key ' + e.msg + '. Check the spelling and the quotes of the key.';
    else if (e.type === 'TypeError' && /str/.test(e.msg) && /int|float|concatenate/.test(e.msg)) s = at + ' mixes text and numbers. Values read from a CSV are text: convert them with float().';
    else if (e.type === 'ValueError' && /could not convert string to float/.test(e.msg)) s = at + ' turns a text into a number, but that text is empty or not a number: skip empty amounts first.';
    else if (e.type === 'FileNotFoundError') s = at + ': that file does not exist here. The data file is called payments.csv.';
    else s = at + ': ' + e.type + ': ' + e.msg;
    return s + (e.dataset ? ' (This happened with the second, different payments.csv the tests use.)' : '');
  }
  function diagnose(m, code, r) {
    if (r.timeout) return 'Your code ran for more than 5 seconds and was stopped: most likely a loop that never ends.';
    if (r.crash) return 'Python could not run your code: ' + r.crash;
    if (r.error) return explainError(r.error);
    const f = r.tests.find(x => !x.ok);
    return f ? 'Test "' + f.name + '" fails: ' + f.msg : null;
  }

  /* ---- typical Python mistakes ---- */
  const err = (r, type, re) => r.error && r.error.type === type && (!re || re.test(r.error.msg));
  const DETECTORS = [
    { id: 'missing-colon', label: 'Forgetting the : after if / for / def', tip: 'Lines that open a block (if, for, def, with, else) end with a colon, and the next lines are indented.', test: r => err(r, 'SyntaxError', /expected ':'/) },
    { id: 'indentation', label: 'Wrong indentation', tip: 'Python uses indentation to know what is inside a block: 4 spaces per level, the same on every line of the block.', test: r => err(r, 'IndentationError') || err(r, 'TabError') },
    { id: 'assign-vs-compare', label: 'Using = instead of ==', tip: '= stores a value, == compares two values.', test: r => err(r, 'SyntaxError', /Maybe you meant '=='|cannot assign/) },
    { id: 'name-typo', label: 'Using a name before it exists (or misspelled)', tip: 'Python reads top to bottom: a variable must be created before it is used, with exactly the same spelling.', test: r => err(r, 'NameError') },
    { id: 'key-typo', label: 'Wrong dictionary key', tip: "Keys must match exactly, quotes included: row['amount'], not row[amount] or row['Amount'].", test: r => err(r, 'KeyError') },
    { id: 'text-number', label: 'Mixing text and numbers', tip: "Everything read from a CSV is text. Convert before doing math: float(row['amount']).", test: r => err(r, 'TypeError', /str/) },
    { id: 'empty-number', label: 'Converting an empty value to a number', tip: "Some amounts are empty. Check first: if row['amount']: …", test: r => err(r, 'ValueError', /could not convert string to float/) },
    { id: 'print-not-return', label: 'print instead of return in a function', tip: 'print only shows a value on screen; return hands it back so other code can use it.', test: r => !!r.tests && r.tests.some(x => !x.ok && /returned None: use return/.test(x.msg || '')) },
    { id: 'file-name', label: 'Wrong file name', tip: "The data file is payments.csv, next to your code: open('payments.csv').", test: r => err(r, 'FileNotFoundError') },
    { id: 'infinite-loop', label: 'A loop that never ends', tip: 'A while loop needs something that eventually makes its condition false. A for loop over a list always ends.', test: r => !!r.timeout },
  ];
  const detectMistakes = (m, code, r) => DETECTORS.filter(d => { try { return d.test(r); } catch (e) { return false; } });
  function cheatUpTo(li) { return LEVELS.slice(0, li + 1).map(lv => ({ title: lv.title, rows: lv.cheat })); }

  OT.tracks = OT.tracks || {};
  OT.tracks.python = {
    id: 'python', title: 'Python', levels: LEVELS, flat,
    specOf, passed, diagnose, detectMistakes, cheatUpTo,
    notice: { title: 'Real Python, downloaded on first use.',
      text: 'Your code runs on real Python 3.12 (Pyodide) inside the browser. The first time it downloads about 10 MB, which can take a few seconds; then it is cached. It needs an internet connection, and any run longer than 5 seconds is stopped. Only the standard library is available.' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
