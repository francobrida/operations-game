/* SQL track: levels, missions, hint-1 diagnosis and mistake detectors.
   A mission passes when the player's result table matches the official solution's
   (any column order, any equivalent query). ordered: row order matters; names: column names matter. */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  const DB = OT.sqlDB;

  const AUG = "payment_date LIKE '2026-08%'";
  const DUPS = `SELECT artist, song, (COUNT(*) - 1) * MAX(amount) AS overpaid
  FROM payments
  WHERE ${AUG}
  GROUP BY artist, song
  HAVING COUNT(*) > 1`;

  const L1 = [
    { id: 'select-all', title: 'First look',
      brief: 'Data team: "Before anything else, have a look at the artists table. Show me everything in it."',
      concept: 'SELECT chooses the columns (* means all of them) and FROM says which table to read.',
      skeleton: 'SELECT _ FROM ______;',
      solution: { cmd: 'SELECT * FROM artists;', parts: [['SELECT *', 'Every column.'], ['FROM artists', 'From the artists table.']] } },

    { id: 'select-cols', title: 'Just two columns',
      brief: 'Data team: "I only need each artist\'s name and country."',
      concept: 'List the columns you want after SELECT, separated by commas.',
      skeleton: 'SELECT ____, ____ FROM ______;',
      solution: { cmd: 'SELECT name, country FROM artists;', parts: [['SELECT name, country', 'Only these two columns.'], ['FROM artists', 'From artists.']] } },

    { id: 'where-eq', title: 'Artists from Argentina',
      brief: 'Marketing: "Which of our artists are from Argentina? Names only."',
      concept: 'WHERE keeps only the rows that match a condition. Text values go in single quotes.',
      skeleton: "SELECT name FROM artists WHERE _______ = '_________';",
      solution: { cmd: "SELECT name FROM artists WHERE country = 'Argentina';", parts: [['SELECT name', 'The column to show.'], ['FROM artists', 'The table.'], ["WHERE country = 'Argentina'", 'Keep only rows whose country is Argentina.']] } },

    { id: 'order-limit', title: 'Top 3 songs', ordered: true,
      brief: 'Editorial: "Give me the 3 most played songs, most played first: title and plays."',
      concept: 'ORDER BY column DESC sorts from biggest to smallest; LIMIT n keeps only the first n rows.',
      skeleton: 'SELECT title, plays FROM songs ORDER BY _____ ____ LIMIT _;',
      solution: { cmd: 'SELECT title, plays FROM songs ORDER BY plays DESC LIMIT 3;', parts: [['SELECT title, plays FROM songs', 'Two columns from songs.'], ['ORDER BY plays DESC', 'Most plays first.'], ['LIMIT 3', 'Only the first three rows.']] } },

    { id: 'distinct', title: 'Where are they from?',
      brief: 'Finance: "In which countries do we have artists? Each country once."',
      concept: 'SELECT DISTINCT removes repeated rows from the result.',
      skeleton: 'SELECT ________ country FROM artists;',
      solution: { cmd: 'SELECT DISTINCT country FROM artists;', parts: [['SELECT DISTINCT country', 'Each different country, once.'], ['FROM artists', 'From artists.']] } },

    { id: 'in-list', title: 'Two artists',
      brief: 'Label manager: "Show me the titles of every song by artists 1 and 4 (artist_id)."',
      concept: 'IN (a, b) checks against a list of values. It is a shorter way to write several ORs.',
      skeleton: 'SELECT title FROM songs WHERE artist_id __ (_, _);',
      solution: { cmd: 'SELECT title FROM songs WHERE artist_id IN (1, 4);', parts: [['SELECT title FROM songs', 'Song titles.'], ['WHERE artist_id IN (1, 4)', 'Only songs whose artist_id is 1 or 4.']] } },

    { id: 'and', title: 'Long and popular',
      brief: 'Editorial: "Songs longer than 240 seconds AND with more than 20000 plays. Titles only."',
      concept: 'AND joins two conditions: a row stays only if both are true. (OR keeps it if either is.)',
      skeleton: 'SELECT title FROM songs WHERE ____________ > ___ ___ _____ > _____;',
      solution: { cmd: 'SELECT title FROM songs WHERE duration_sec > 240 AND plays > 20000;', parts: [['WHERE duration_sec > 240', 'Longer than 4 minutes…'], ['AND plays > 20000', '…and more than 20000 plays.']] } },

    { id: 'between', title: 'Mid-size payments',
      brief: 'Finance: "List the id, artist and amount of every payment between 100 and 150, both included."',
      concept: 'BETWEEN a AND b keeps values from a to b, including both ends.',
      skeleton: 'SELECT id, artist, amount FROM payments WHERE amount _______ ___ ___ ___;',
      solution: { cmd: 'SELECT id, artist, amount FROM payments WHERE amount BETWEEN 100 AND 150;', parts: [['SELECT id, artist, amount FROM payments', 'Three columns from payments.'], ['WHERE amount BETWEEN 100 AND 150', 'Amounts from 100 to 150, inclusive.']] } },

    { id: 'like', title: 'Titles starting with C',
      brief: 'Editorial: "Which song titles start with the letter C?"',
      concept: "LIKE compares text with a pattern: % means \"anything\", so 'C%' is \"C, then anything\".",
      skeleton: "SELECT title FROM songs WHERE title ____ '__';",
      solution: { cmd: "SELECT title FROM songs WHERE title LIKE 'C%';", parts: [['SELECT title FROM songs', 'Song titles.'], ["WHERE title LIKE 'C%'", 'Titles that start with C.']] } },

    { id: 'is-null', title: 'Missing amounts',
      brief: 'Support: "Some payments have no amount at all. Show me those payments, every column."',
      concept: 'An empty value is NULL. You test it with IS NULL: nothing is "= NULL", not even NULL itself.',
      skeleton: 'SELECT * FROM payments WHERE amount __ ____;',
      solution: { cmd: 'SELECT * FROM payments WHERE amount IS NULL;', parts: [['SELECT * FROM payments', 'All columns.'], ['WHERE amount IS NULL', 'Only rows where amount is empty.']] } },

    { id: 'alias', title: 'Minutes, not seconds', names: true,
      brief: 'Editorial: "Show each song title with its duration in minutes, decimals included, and call that column minutes."',
      concept: 'You can compute in SELECT and name the result with AS. Careful: in SQLite, integer / integer drops the decimals, so divide by 60.0.',
      skeleton: 'SELECT title, ____________ / ____ AS _______ FROM songs;',
      solution: { cmd: 'SELECT title, duration_sec / 60.0 AS minutes FROM songs;', parts: [['duration_sec / 60.0', 'Seconds to minutes, keeping decimals.'], ['AS minutes', 'Names the new column.']] },
      note: 'Dialect difference: in MySQL 215 / 60 already gives 3.5833. In SQLite it gives 3, unless one side has decimals.' },
  ];

  const L2 = [
    { id: 'count-all', title: 'How many payments?',
      brief: 'Finance: "How many payments are there in total?"',
      concept: 'COUNT(*) counts rows. It is an aggregate: it turns many rows into one number.',
      skeleton: 'SELECT _____(_) FROM payments;',
      solution: { cmd: 'SELECT COUNT(*) FROM payments;', parts: [['COUNT(*)', 'How many rows.'], ['FROM payments', 'In the payments table.']] } },

    { id: 'count-col', title: 'Payments with an amount',
      brief: 'Finance: "And how many of those payments actually have an amount?"',
      concept: 'COUNT(column) only counts rows where that column is not NULL. COUNT(*) counts every row.',
      skeleton: 'SELECT COUNT(______) FROM payments;',
      solution: { cmd: 'SELECT COUNT(amount) FROM payments;', parts: [['COUNT(amount)', 'Rows where amount is not NULL.']] } },

    { id: 'sum', title: 'Total paid',
      brief: 'Finance: "What is the total amount we have paid, all payments together?"',
      concept: 'SUM(column) adds up every value of the column (NULLs are skipped).',
      skeleton: 'SELECT ___(______) FROM payments;',
      solution: { cmd: 'SELECT SUM(amount) FROM payments;', parts: [['SUM(amount)', 'Adds every amount.']] } },

    { id: 'min-max-avg', title: 'Smallest, largest, average',
      brief: 'Finance: "Give me the smallest payment, the largest one and the average, in one row."',
      concept: 'MIN, MAX and AVG work like SUM. You can put several aggregates in the same SELECT.',
      skeleton: 'SELECT ___(amount), ___(amount), ___(amount) FROM payments;',
      solution: { cmd: 'SELECT MIN(amount), MAX(amount), AVG(amount) FROM payments;', parts: [['MIN(amount)', 'Smallest.'], ['MAX(amount)', 'Largest.'], ['AVG(amount)', 'Average (NULLs ignored).']] } },

    { id: 'group-date', title: 'Payments per date',
      brief: 'Finance: "How many payments were made per payment date?"',
      concept: '"Per X" means GROUP BY X: one row per value of X, and the aggregate is computed inside each group.',
      skeleton: 'SELECT payment_date, COUNT(*) FROM payments _____ __ ____________;',
      solution: { cmd: 'SELECT payment_date, COUNT(*) FROM payments GROUP BY payment_date;', parts: [['SELECT payment_date, COUNT(*)', 'The date and how many rows it has.'], ['GROUP BY payment_date', 'One group per date.']] },
      note: 'One group is NULL: a payment with no date. NULLs form their own group.' },

    { id: 'group-songs', title: 'Songs per artist',
      brief: 'Label manager: "How many songs does each artist_id have?"',
      concept: 'Same mold: the grouped column in SELECT, plus an aggregate.',
      skeleton: 'SELECT _________, COUNT(*) FROM songs GROUP BY _________;',
      solution: { cmd: 'SELECT artist_id, COUNT(*) FROM songs GROUP BY artist_id;', parts: [['SELECT artist_id, COUNT(*)', 'Each artist id and its song count.'], ['GROUP BY artist_id', 'One group per artist.']] } },

    { id: 'group-sum', title: 'Paid per artist',
      brief: 'Finance: "How much have we paid each artist, as the name is written in payments?"',
      concept: 'GROUP BY works with SUM too: one total per group.',
      skeleton: 'SELECT artist, ___(amount) FROM payments GROUP BY ______;',
      solution: { cmd: 'SELECT artist, SUM(amount) FROM payments GROUP BY artist;', parts: [['SELECT artist, SUM(amount)', 'Each artist and the sum of their payments.'], ['GROUP BY artist', 'One group per artist name.']] },
      note: 'Look closely: "luna ferreyra" and "LOS CARDALES" show up as different artists. Messy names split the groups; you will fix that in level 5.' },

    { id: 'group-order', title: 'Ranking', ordered: true,
      brief: 'Finance: "Same totals, but ranked: the artist we paid the most first. Call the total column total."',
      concept: 'Give the aggregate a name with AS, then ORDER BY that name.',
      skeleton: 'SELECT artist, SUM(amount) AS _____ FROM payments GROUP BY artist ORDER BY _____ ____;',
      solution: { cmd: 'SELECT artist, SUM(amount) AS total FROM payments GROUP BY artist ORDER BY total DESC;', parts: [['SUM(amount) AS total', 'Names the total.'], ['GROUP BY artist', 'One row per artist.'], ['ORDER BY total DESC', 'Highest total first.']] } },
  ];

  const L3 = [
    { id: 'per-each', title: 'August, per artist',
      brief: "Support: \"How many payments did each artist get in the August batch (payment_date = '2026-08-14')?\"",
      concept: 'WHERE filters the rows first, then GROUP BY groups what is left.',
      skeleton: "SELECT artist, COUNT(*) FROM payments WHERE ____________ = '__________' GROUP BY ______;",
      solution: { cmd: "SELECT artist, COUNT(*) FROM payments WHERE payment_date = '2026-08-14' GROUP BY artist;", parts: [["WHERE payment_date = '2026-08-14'", 'Only the August batch.'], ['GROUP BY artist', 'Then one row per artist.'], ['COUNT(*)', 'How many payments each one got.']] } },

    { id: 'having-count', title: 'Frequent payees',
      brief: 'Finance: "Which artists (as written in payments) have more than 2 payments in total?"',
      concept: 'HAVING filters groups after GROUP BY, so it can use aggregates. WHERE cannot.',
      skeleton: 'SELECT artist, COUNT(*) FROM payments GROUP BY artist ______ ________ > _;',
      solution: { cmd: 'SELECT artist, COUNT(*) FROM payments GROUP BY artist HAVING COUNT(*) > 2;', parts: [['GROUP BY artist', 'One group per artist.'], ['HAVING COUNT(*) > 2', 'Keep only groups with more than 2 rows.']] } },

    { id: 'having-sum', title: 'Big earners',
      brief: 'Finance: "Which artists have been paid more than 400 in total? Show the artist and the total."',
      concept: 'Conditions on a SUM go in HAVING, after the GROUP BY.',
      skeleton: 'SELECT artist, SUM(amount) FROM payments GROUP BY artist HAVING ___(______) > ___;',
      solution: { cmd: 'SELECT artist, SUM(amount) FROM payments GROUP BY artist HAVING SUM(amount) > 400;', parts: [['SUM(amount)', 'Total per artist.'], ['HAVING SUM(amount) > 400', 'Keep only totals above 400.']] } },

    { id: 'where-having', title: 'August big earners',
      brief: "Finance: \"In the August batch only (payment_date = '2026-08-14'), which artists were paid more than 150 in total?\"",
      concept: 'Both at once: WHERE picks the rows (a plain column), HAVING picks the groups (an aggregate).',
      skeleton: "SELECT artist, SUM(amount) FROM payments WHERE ____________ = '__________' GROUP BY artist HAVING ___(amount) > ___;",
      solution: { cmd: "SELECT artist, SUM(amount) FROM payments WHERE payment_date = '2026-08-14' GROUP BY artist HAVING SUM(amount) > 150;", parts: [["WHERE payment_date = '2026-08-14'", 'Rows: only August.'], ['GROUP BY artist', 'Group them by artist.'], ['HAVING SUM(amount) > 150', 'Groups: only totals above 150.']] } },

    { id: 'dup-basic', title: 'The same payment twice?',
      brief: 'Support: "Find payments that appear more than once with the same artist, song and amount. Show those three columns and how many times each appears."',
      concept: 'To find duplicates, group by every column that should be unique and keep the groups with COUNT(*) > 1.',
      skeleton: 'SELECT artist, song, amount, COUNT(*) FROM payments GROUP BY ______, ____, ______ HAVING COUNT(*) > _;',
      solution: { cmd: 'SELECT artist, song, amount, COUNT(*) FROM payments GROUP BY artist, song, amount HAVING COUNT(*) > 1;', parts: [['GROUP BY artist, song, amount', 'One group per identical combination.'], ['HAVING COUNT(*) > 1', 'Only combinations that appear more than once.']] } },

    { id: 'dup-date', title: 'Same day, same payment',
      brief: 'Support: "Now make it stricter: same artist, same song AND same payment date. Show artist, song, payment_date and the count."',
      concept: 'Same duplicates mold, with a different set of columns in GROUP BY.',
      skeleton: 'SELECT artist, song, payment_date, COUNT(*) FROM payments GROUP BY ______, ____, ____________ HAVING ________ > 1;',
      solution: { cmd: 'SELECT artist, song, payment_date, COUNT(*) FROM payments GROUP BY artist, song, payment_date HAVING COUNT(*) > 1;', parts: [['GROUP BY artist, song, payment_date', 'One group per artist + song + date.'], ['HAVING COUNT(*) > 1', 'Only the repeated ones.']] },
      note: 'Six payments, all on 2026-08-14. That is not a coincidence: the Bash logs showed the August file being imported twice.' },

    { id: 'file-twice', title: 'Imported twice?',
      brief: 'Data team: "Check import_log: which files were imported more than once, and how many times?"',
      concept: 'The duplicates mold works on any table.',
      skeleton: 'SELECT file, COUNT(*) FROM import_log GROUP BY ____ HAVING ________ > _;',
      solution: { cmd: 'SELECT file, COUNT(*) FROM import_log GROUP BY file HAVING COUNT(*) > 1;', parts: [['GROUP BY file', 'One group per file name.'], ['HAVING COUNT(*) > 1', 'Files that appear more than once.']] } },

    { id: 'rows-per-file', title: 'Rows loaded per file',
      brief: 'Data team: "How many rows were loaded in total for each file?"',
      concept: '"For each file" = GROUP BY file, with SUM of the rows loaded.',
      skeleton: 'SELECT file, ___(___________) FROM import_log GROUP BY ____;',
      solution: { cmd: 'SELECT file, SUM(rows_loaded) FROM import_log GROUP BY file;', parts: [['SUM(rows_loaded)', 'Adds the rows of every import.'], ['GROUP BY file', 'One total per file.']] },
      note: 'payments_2026-08.csv loaded 15 rows, but the file only has 9: the 6 extra rows are the duplicates.' },
  ];

  const L4 = [
    { id: 'inner-join', title: 'Songs with their artist',
      brief: 'Editorial: "List every song title next to its artist\'s name."',
      concept: "JOIN … ON combines two tables by matching a column: here songs.artist_id with artists.id. Short aliases (s, a) save typing.",
      skeleton: 'SELECT s.title, a.name FROM songs s JOIN artists a ON s.________ = a.__;',
      solution: { cmd: 'SELECT s.title, a.name FROM songs s JOIN artists a ON s.artist_id = a.id;', parts: [['FROM songs s', 'songs, nicknamed s.'], ['JOIN artists a', 'Combined with artists, nicknamed a…'], ['ON s.artist_id = a.id', '…matching each song to its artist.']] } },

    { id: 'join-where', title: 'Argentine songs',
      brief: 'Marketing: "Which songs are by artists from Argentina? Titles only."',
      concept: 'After a JOIN you can filter with WHERE on columns from either table.',
      skeleton: "SELECT s.title FROM songs s JOIN artists a ON s.artist_id = a.id WHERE _.______ = '_________';",
      solution: { cmd: "SELECT s.title FROM songs s JOIN artists a ON s.artist_id = a.id WHERE a.country = 'Argentina';", parts: [['JOIN artists a ON s.artist_id = a.id', 'Brings in the artist of each song.'], ["WHERE a.country = 'Argentina'", 'Keeps only Argentine artists.']] } },

    { id: 'join-group', title: 'Plays per country',
      brief: 'Marketing: "How many plays do we have per country?"',
      concept: 'JOIN first, then GROUP BY a column of the joined table, with SUM of a column of the other one.',
      skeleton: 'SELECT a.country, SUM(s.plays) FROM songs s JOIN artists a ON s.artist_id = a.id GROUP BY _._______;',
      solution: { cmd: 'SELECT a.country, SUM(s.plays) FROM songs s JOIN artists a ON s.artist_id = a.id GROUP BY a.country;', parts: [['JOIN … ON s.artist_id = a.id', 'Each song with its artist.'], ['GROUP BY a.country', 'One group per country.'], ['SUM(s.plays)', 'Plays added up.']] } },

    { id: 'left-join', title: 'Every song, even orphans',
      brief: 'Data team: "List every song with its artist name. Include songs whose artist we cannot find."',
      concept: 'LEFT JOIN keeps every row of the left table; when there is no match, the right side comes back as NULL.',
      skeleton: 'SELECT s.title, a.name FROM songs s ____ JOIN artists a ON s.artist_id = a.id;',
      solution: { cmd: 'SELECT s.title, a.name FROM songs s LEFT JOIN artists a ON s.artist_id = a.id;', parts: [['FROM songs s', 'The table whose rows you want to keep all of.'], ['LEFT JOIN artists a ON s.artist_id = a.id', 'Adds the artist, or NULL if there is none.']] } },

    { id: 'orphans', title: 'Songs without an artist',
      brief: 'Data team: "Which songs point to an artist that does not exist? Titles only."',
      concept: 'Orphan mold: LEFT JOIN, then keep the rows where the right side came back NULL.',
      skeleton: 'SELECT s.title FROM songs s LEFT JOIN artists a ON s.artist_id = a.id WHERE a.__ __ ____;',
      solution: { cmd: 'SELECT s.title FROM songs s LEFT JOIN artists a ON s.artist_id = a.id WHERE a.id IS NULL;', parts: [['LEFT JOIN artists a …', 'Every song, with its artist if any.'], ['WHERE a.id IS NULL', 'Only songs that found no artist.']] },
      note: 'Its artist_id is 99, and there is no artist 99: an orphan record. That is a classic data-quality issue.' },

    { id: 'left-count', title: 'Zero counts too',
      brief: 'Label manager: "How many songs does each artist have, by name? Artists with no songs must appear with 0."',
      concept: 'Start from artists and LEFT JOIN songs. Count a column of songs (COUNT(s.id)), because COUNT(*) would count the empty row as 1.',
      skeleton: 'SELECT a.name, COUNT(_.__) FROM artists a ____ JOIN songs s ON s.artist_id = a.id GROUP BY a.name;',
      solution: { cmd: 'SELECT a.name, COUNT(s.id) FROM artists a LEFT JOIN songs s ON s.artist_id = a.id GROUP BY a.name;', parts: [['FROM artists a LEFT JOIN songs s', 'Every artist, even without songs.'], ['COUNT(s.id)', 'Counts only real songs (NULL is not counted).'], ['GROUP BY a.name', 'One row per artist.']] } },

    { id: 'join-payments', title: 'Payments with a country',
      brief: 'Finance: "For each payment, show its id, the artist as written in payments, and the artist\'s country. Match on the name."',
      concept: 'You can join on any column that should be equal, like payments.artist = artists.name.',
      skeleton: 'SELECT p.id, p.artist, a.country FROM payments p JOIN artists a ON p.______ = a.____;',
      solution: { cmd: 'SELECT p.id, p.artist, a.country FROM payments p JOIN artists a ON p.artist = a.name;', parts: [['FROM payments p JOIN artists a', 'Payments combined with artists…'], ['ON p.artist = a.name', '…when the names are exactly equal.']] },
      note: 'Only 23 of the 27 payments came back: "luna ferreyra", "  Marta Quiroga ", "LOS CARDALES" and the NULL one do not match exactly. Level 5 fixes that.' },
  ];

  const L5 = [
    { id: 'clean-names', title: 'Clean up the names',
      brief: 'Data team: "Show each payment id with the artist name cleaned up: no spaces at the edges, all lowercase."',
      concept: 'TRIM(x) removes spaces at both ends; LOWER(x) lowercases (UPPER does the opposite). They can be nested.',
      skeleton: 'SELECT id, _____(____(artist)) FROM payments;',
      solution: { cmd: 'SELECT id, LOWER(TRIM(artist)) AS artist FROM payments;', parts: [['TRIM(artist)', 'Removes the extra spaces…'], ['LOWER(…)', '…and then lowercases.']] } },

    { id: 'join-clean', title: 'Join despite messy names',
      brief: 'Finance: "Join payments to artists even when the name is written differently. Show payment id, the official artist name and the amount."',
      concept: 'The ON condition can use functions: clean both sides the same way before comparing.',
      skeleton: 'SELECT p.id, a.name, p.amount FROM payments p JOIN artists a ON _____(____(p.artist)) = _____(a.name);',
      solution: { cmd: 'SELECT p.id, a.name, p.amount FROM payments p JOIN artists a ON LOWER(TRIM(p.artist)) = LOWER(a.name);', parts: [['LOWER(TRIM(p.artist))', 'The messy name, cleaned.'], ['= LOWER(a.name)', 'Compared with the official name, lowercased too.']] },
      note: '26 of 27 now: only the payment with no artist at all (NULL) is left out.' },

    { id: 'coalesce', title: 'No empty amounts',
      brief: 'Finance: "Show every payment id with its amount, but put 0 where the amount is missing."',
      concept: 'COALESCE(x, y) returns x, or y when x is NULL.',
      skeleton: 'SELECT id, ________(amount, _) FROM payments;',
      solution: { cmd: 'SELECT id, COALESCE(amount, 0) AS amount FROM payments;', parts: [['COALESCE(amount, 0)', 'The amount, or 0 if it is NULL.']] },
      note: 'IFNULL(amount, 0) also works here and in MySQL.' },

    { id: 'case-when', title: 'Label the payments',
      brief: "Finance: \"Show id, amount and a column size that says 'missing' if there is no amount, 'big' if it is 150 or more, and 'small' otherwise.\"",
      concept: 'CASE WHEN condition THEN value … ELSE value END builds a value row by row. The first true WHEN wins.',
      skeleton: "SELECT id, amount, CASE WHEN ______ __ ____ THEN 'missing' WHEN amount >= ___ THEN 'big' ELSE '_____' END AS size FROM payments;",
      solution: { cmd: "SELECT id, amount, CASE WHEN amount IS NULL THEN 'missing' WHEN amount >= 150 THEN 'big' ELSE 'small' END AS size FROM payments;", parts: [["WHEN amount IS NULL THEN 'missing'", 'First check: no amount.'], ["WHEN amount >= 150 THEN 'big'", 'Then: 150 or more.'], ["ELSE 'small'", 'Anything else.'], ['END AS size', 'Closes the CASE and names the column.']] } },

    { id: 'month-filter', title: 'August only',
      brief: 'Support: "Show me every payment made in August 2026, all columns."',
      concept: "Dates here are text like '2026-08-14', so a month is a range: BETWEEN '2026-08-01' AND '2026-08-31', or LIKE '2026-08%'.",
      skeleton: "SELECT * FROM payments WHERE payment_date _______ '__________' AND '__________';",
      solution: { cmd: "SELECT * FROM payments WHERE payment_date BETWEEN '2026-08-01' AND '2026-08-31';", parts: [["WHERE payment_date BETWEEN '2026-08-01' AND '2026-08-31'", 'Every date in August.']] },
      note: "Dialect difference: SQLite uses strftime('%Y-%m', payment_date) = '2026-08'; MySQL uses DATE_FORMAT(payment_date, '%Y-%m') or MONTH()/YEAR(). BETWEEN and LIKE work in both." },

    { id: 'aug-dups', title: 'The duplicated August payments',
      brief: 'Client: "You paid us twice for the same song in August." Find the August payments that repeat the same artist and song. Show artist, song and the number of copies.',
      concept: 'Combine the month filter with the duplicates mold.',
      skeleton: "SELECT artist, song, COUNT(*) AS copies FROM payments WHERE payment_date ____ '_______%' GROUP BY ______, ____ HAVING ________ > 1;",
      solution: { cmd: `SELECT artist, song, COUNT(*) AS copies
FROM payments
WHERE ${AUG}
GROUP BY artist, song
HAVING COUNT(*) > 1;`, parts: [['WHERE ' + AUG, 'Only August.'], ['GROUP BY artist, song', 'One group per artist and song.'], ['HAVING COUNT(*) > 1', 'Only the ones paid more than once.']] } },

    { id: 'overpaid-each', title: 'Overpaid per duplicate',
      brief: 'Finance: "For each duplicated August payment, how much did we overpay? Extra copies times the amount. Show artist, song and overpaid."',
      concept: 'You can do math with aggregates: (COUNT(*) - 1) is the number of extra copies, MAX(amount) is the amount of one copy.',
      skeleton: "SELECT artist, song, (________ - 1) * ___(amount) AS overpaid FROM payments WHERE payment_date LIKE '2026-08%' GROUP BY artist, song HAVING COUNT(*) > 1;",
      solution: { cmd: DUPS + ';', parts: [['(COUNT(*) - 1)', 'Extra copies (all but one).'], ['* MAX(amount)', 'Times the amount of one payment.'], ['GROUP BY … HAVING COUNT(*) > 1', 'Only the duplicated ones, as before.']] } },

    { id: 'overpaid-total', title: 'The total damage',
      brief: 'Finance: "How much did we overpay in total? One number."',
      concept: 'A subquery is a query inside FROM: run the previous query, then SUM its overpaid column.',
      skeleton: 'SELECT SUM(________) FROM ( <the overpaid-per-duplicate query> );',
      solution: { cmd: `SELECT SUM(overpaid) FROM (
  ${DUPS}
);`, parts: [['FROM ( … )', 'The previous query, used as a table.'], ['SUM(overpaid)', 'Adds every overpaid amount.']] } },

    { id: 'overpaid-artist', title: 'Overpaid per artist',
      brief: 'Finance: "Now per artist: how much did we overpay each one? Show artist and overpaid."',
      concept: 'WITH name AS ( query ) gives a query a name (a CTE), so the main query can read from it like a table. Easier to read than a nested subquery.',
      skeleton: 'WITH dups AS ( <the overpaid-per-duplicate query> ) SELECT artist, SUM(overpaid) AS overpaid FROM ____ GROUP BY ______;',
      solution: { cmd: `WITH dups AS (
  ${DUPS}
)
SELECT artist, SUM(overpaid) AS overpaid
FROM dups
GROUP BY artist;`, parts: [['WITH dups AS ( … )', 'Names the duplicates result "dups".'], ['FROM dups GROUP BY artist', 'Groups it by artist…'], ['SUM(overpaid)', '…and adds each artist\'s overpaid amounts.']] } },

    { id: 'final-report', title: 'The report for the client', ordered: true,
      brief: 'Head of Operations: "I need the final list: artist name, country and overpaid amount, only artists overpaid more than 100, biggest first."',
      concept: 'Everything together: the CTE, a JOIN to artists for the country, GROUP BY, HAVING for the threshold and ORDER BY.',
      skeleton: 'WITH dups AS ( … ) SELECT a.name, a.country, SUM(d.overpaid) AS overpaid FROM dups d JOIN artists a ON a.____ = d.______ GROUP BY a.name, a.country HAVING ___(d.overpaid) > ___ ORDER BY ________ ____;',
      solution: { cmd: `WITH dups AS (
  ${DUPS}
)
SELECT a.name, a.country, SUM(d.overpaid) AS overpaid
FROM dups d
JOIN artists a ON a.name = d.artist
GROUP BY a.name, a.country
HAVING SUM(d.overpaid) > 100
ORDER BY overpaid DESC;`, parts: [['WITH dups AS ( … )', 'The duplicated August payments.'], ['JOIN artists a ON a.name = d.artist', 'Adds each artist\'s country.'], ['HAVING SUM(d.overpaid) > 100', 'Only above the threshold.'], ['ORDER BY overpaid DESC', 'Biggest first.']] },
      note: 'That is the SQL part of the Final Case: who was overpaid, where they are, and how much.' },
  ];

  /* ---- practice levels: mix earlier concepts back and forth, with a few traps ---- */
  const P1 = [
    { id: 'pa-long-songs', title: 'Long songs', ordered: true,
      brief: 'Editorial: "Which songs last more than 4 minutes (240 seconds)? Title and duration_sec, longest first."',
      concept: 'Back to WHERE and ORDER BY: filter the rows first, then sort them.',
      skeleton: 'SELECT title, duration_sec FROM songs WHERE ____________ > ___ ORDER BY ____________ ____;',
      solution: { cmd: 'SELECT title, duration_sec FROM songs WHERE duration_sec > 240 ORDER BY duration_sec DESC;', parts: [['WHERE duration_sec > 240', 'Longer than 4 minutes.'], ['ORDER BY duration_sec DESC', 'Longest first.']] } },
    { id: 'pa-count-where', title: 'Counting with a filter',
      brief: 'Marketing: "How many of our artists are from Chile? Just the number."',
      concept: 'COUNT(*) counts the rows that survive the WHERE.',
      skeleton: "SELECT COUNT(*) FROM ______ WHERE _______ = '_____';",
      solution: { cmd: "SELECT COUNT(*) FROM artists WHERE country = 'Chile';", parts: [["WHERE country = 'Chile'", 'Only Chilean artists.'], ['COUNT(*)', 'How many rows are left.']] } },
    { id: 'pa-count-distinct', title: 'How many countries?',
      brief: 'Marketing: "How many different countries do our artists come from? One number."',
      concept: 'COUNT(DISTINCT col) counts the different values of a column, ignoring repeats.',
      skeleton: 'SELECT COUNT(________ _______) FROM artists;',
      solution: { cmd: 'SELECT COUNT(DISTINCT country) FROM artists;', parts: [['COUNT(DISTINCT country)', 'Different countries, each counted once.']] } },
    { id: 'pa-smallest', title: 'The smallest real payment',
      brief: 'Finance: "Which payment had the smallest amount? Ignore payments with no amount. Show id, artist and amount, just that one row."',
      concept: 'ORDER BY amount puts NULLs first in SQLite, so take them out with WHERE … IS NOT NULL before sorting and keeping 1 row.',
      skeleton: 'SELECT id, artist, amount FROM payments WHERE ______ __ ___ ____ ORDER BY ______ LIMIT _;',
      solution: { cmd: 'SELECT id, artist, amount FROM payments WHERE amount IS NOT NULL ORDER BY amount LIMIT 1;', parts: [['WHERE amount IS NOT NULL', 'Skip the payment with no amount.'], ['ORDER BY amount LIMIT 1', 'The smallest one.']] },
      note: 'Its artist is empty too: one bad row can hide another problem.' },
    { id: 'pa-july-total', title: 'July in one number',
      brief: "Finance: \"How much did we pay in the July batch (payment_date = '2026-07-10')? One number.\"",
      concept: 'SUM adds up the rows that pass the WHERE.',
      skeleton: "SELECT ___(amount) FROM payments WHERE ____________ = '__________';",
      solution: { cmd: "SELECT SUM(amount) FROM payments WHERE payment_date = '2026-07-10';", parts: [["WHERE payment_date = '2026-07-10'", 'Only the July batch.'], ['SUM(amount)', 'Added up.']] } },
    { id: 'pa-date-summary', title: 'Every batch at a glance',
      brief: 'Finance: "For each payment date: how many payments and the total amount."',
      concept: 'Two aggregates in the same GROUP BY: COUNT(*) and SUM(amount), one row per date.',
      skeleton: 'SELECT payment_date, COUNT(_), SUM(______) FROM payments GROUP BY ____________;',
      solution: { cmd: 'SELECT payment_date, COUNT(*), SUM(amount) FROM payments GROUP BY payment_date;', parts: [['GROUP BY payment_date', 'One row per date.'], ['COUNT(*), SUM(amount)', 'How many and how much.']] },
      note: 'The empty date gets its own group: GROUP BY keeps NULL as a value.' },
    { id: 'pa-short-per-artist', title: 'Short songs per artist',
      brief: 'Label manager: "For each artist_id, how many songs are shorter than 4 minutes (under 240 seconds)?"',
      concept: 'WHERE drops the long songs first; then GROUP BY counts what is left per artist_id.',
      skeleton: 'SELECT artist_id, COUNT(*) FROM songs WHERE ____________ < ___ GROUP BY _________;',
      solution: { cmd: 'SELECT artist_id, COUNT(*) FROM songs WHERE duration_sec < 240 GROUP BY artist_id;', parts: [['WHERE duration_sec < 240', 'Short songs only.'], ['GROUP BY artist_id', 'Counted per artist.']] } },
    { id: 'pa-like-count', title: 'Songs starting with C',
      brief: 'Support: "How many payments are for songs whose title starts with C? One number."',
      concept: "LIKE 'C%' inside a WHERE, then COUNT(*).",
      skeleton: "SELECT COUNT(*) FROM payments WHERE ____ LIKE '__';",
      solution: { cmd: "SELECT COUNT(*) FROM payments WHERE song LIKE 'C%';", parts: [["WHERE song LIKE 'C%'", 'Song titles starting with C.'], ['COUNT(*)', 'How many payments.']] } },
  ];
  const P2 = [
    { id: 'pb-many-songs', title: 'Prolific artists',
      brief: 'Label manager: "Which artist_ids have 2 or more songs? Show artist_id and the number of songs."',
      concept: 'Count per group, then keep the groups that pass: that is HAVING.',
      skeleton: 'SELECT artist_id, COUNT(*) FROM songs GROUP BY _________ ______ COUNT(*) __ 2;',
      solution: { cmd: 'SELECT artist_id, COUNT(*) FROM songs GROUP BY artist_id HAVING COUNT(*) >= 2;', parts: [['GROUP BY artist_id', 'One row per artist.'], ['HAVING COUNT(*) >= 2', 'Only artists with 2 or more songs.']] } },
    { id: 'pb-avg-having', title: 'High average',
      brief: 'Finance: "Which artists (as written in payments) have an average payment above 100? Show artist and the average."',
      concept: 'Same mold as before with AVG instead of COUNT: GROUP BY, then HAVING on the aggregate.',
      skeleton: 'SELECT artist, AVG(______) FROM payments GROUP BY ______ HAVING ___(______) > ___;',
      solution: { cmd: 'SELECT artist, AVG(amount) FROM payments GROUP BY artist HAVING AVG(amount) > 100;', parts: [['AVG(amount)', 'Average per artist.'], ['HAVING AVG(amount) > 100', 'Only averages above 100.']] } },
    { id: 'pb-where-and-having', title: 'Both filters',
      brief: 'Finance: "Count only payments of 100 or more. Which artists have at least 2 of those? Show artist and the count."',
      concept: 'Two filters at two moments: WHERE on single payments (amount), HAVING on the groups (the count).',
      skeleton: 'SELECT artist, COUNT(*) FROM payments WHERE ______ >= ___ GROUP BY ______ HAVING ________ >= _;',
      solution: { cmd: 'SELECT artist, COUNT(*) FROM payments WHERE amount >= 100 GROUP BY artist HAVING COUNT(*) >= 2;', parts: [['WHERE amount >= 100', 'Rows: only big payments.'], ['HAVING COUNT(*) >= 2', 'Groups: at least two of them.']] } },
    { id: 'pb-song-paid', title: 'Songs paid many times',
      brief: 'Support: "Which songs were paid more than twice in total? Song and the number of payments."',
      concept: 'Group by song this time, not by artist.',
      skeleton: 'SELECT song, COUNT(*) FROM payments GROUP BY ____ HAVING ________ > _;',
      solution: { cmd: 'SELECT song, COUNT(*) FROM payments GROUP BY song HAVING COUNT(*) > 2;', parts: [['GROUP BY song', 'One row per song.'], ['HAVING COUNT(*) > 2', 'Paid more than twice.']] } },
    { id: 'pb-max-per-date', title: 'Biggest payment of each batch',
      brief: 'Finance: "What was the largest payment on each payment date?"',
      concept: 'MAX works per group too: GROUP BY the date.',
      skeleton: 'SELECT payment_date, ___(amount) FROM payments GROUP BY ____________;',
      solution: { cmd: 'SELECT payment_date, MAX(amount) FROM payments GROUP BY payment_date;', parts: [['MAX(amount)', 'The largest amount.'], ['GROUP BY payment_date', 'For each date.']] } },
    { id: 'pb-plays-ranking', title: 'Plays ranking', ordered: true,
      brief: 'Editorial: "Total plays per artist_id, only those above 50,000 plays, biggest first."',
      concept: 'GROUP BY, HAVING on the total, then ORDER BY the same total: all three together.',
      skeleton: 'SELECT artist_id, SUM(plays) FROM songs GROUP BY _________ HAVING ___(_____) > _____ ORDER BY ___(_____) ____;',
      solution: { cmd: 'SELECT artist_id, SUM(plays) FROM songs GROUP BY artist_id HAVING SUM(plays) > 50000 ORDER BY SUM(plays) DESC;', parts: [['HAVING SUM(plays) > 50000', 'Big totals only.'], ['ORDER BY SUM(plays) DESC', 'Biggest first.']] } },
    { id: 'pb-import-dates', title: 'Heavy import days',
      brief: 'Data team: "In import_log, which dates loaded more than 6 rows in total? Show the date, how many imports ran that day and the rows loaded."',
      concept: 'GROUP BY date with COUNT(*) and SUM(rows_loaded), and HAVING on the sum.',
      skeleton: 'SELECT date, COUNT(*), SUM(___________) FROM import_log GROUP BY ____ HAVING ___(___________) > _;',
      solution: { cmd: 'SELECT date, COUNT(*), SUM(rows_loaded) FROM import_log GROUP BY date HAVING SUM(rows_loaded) > 6;', parts: [['GROUP BY date', 'One row per day.'], ['HAVING SUM(rows_loaded) > 6', 'Days that loaded more than 6 rows.']] },
      note: 'Two imports on the same day: the double import again, seen from another table.' },
    { id: 'pb-spellings', title: 'Every spelling, once', ordered: true,
      brief: 'Data team: "List every different way the artist is written in payments, each exactly once, in alphabetical order."',
      concept: 'DISTINCT (or GROUP BY) plus ORDER BY. Watch the order: uppercase sorts before lowercase, and spaces before letters.',
      skeleton: 'SELECT ________ artist FROM payments ORDER BY ______;',
      solution: { cmd: 'SELECT DISTINCT artist FROM payments ORDER BY artist;', parts: [['SELECT DISTINCT artist', 'Each spelling once.'], ['ORDER BY artist', 'Alphabetical.']] },
      note: 'Eleven spellings for eight artists, plus an empty one. You will clean this up with TRIM and LOWER.' },
  ];
  const P3 = [
    { id: 'pc-chile-plays', title: 'Chilean plays',
      brief: 'Marketing: "How many plays do songs by Chilean artists have in total? One number."',
      concept: 'JOIN songs to artists, filter the country with WHERE, then SUM.',
      skeleton: "SELECT SUM(s.plays) FROM songs s JOIN artists a ON a.__ = s.________ WHERE a._______ = '_____';",
      solution: { cmd: "SELECT SUM(s.plays) FROM songs s JOIN artists a ON a.id = s.artist_id WHERE a.country = 'Chile';", parts: [['JOIN artists a ON a.id = s.artist_id', 'Each song with its artist.'], ["WHERE a.country = 'Chile'", 'Chilean artists only.'], ['SUM(s.plays)', 'Total plays.']] } },
    { id: 'pc-songs-country', title: 'Countries with a catalogue',
      brief: 'Marketing: "Which countries have 2 or more songs? Country and number of songs."',
      concept: 'JOIN, then GROUP BY country, then HAVING.',
      skeleton: 'SELECT a.country, COUNT(*) FROM songs s JOIN artists a ON … GROUP BY _________ HAVING ________ >= _;',
      solution: { cmd: 'SELECT a.country, COUNT(*) FROM songs s JOIN artists a ON a.id = s.artist_id GROUP BY a.country HAVING COUNT(*) >= 2;', parts: [['JOIN … ON a.id = s.artist_id', 'Songs with their artist.'], ['GROUP BY a.country', 'One row per country.'], ['HAVING COUNT(*) >= 2', 'At least two songs.']] } },
    { id: 'pc-longest', title: 'The longest song',
      brief: 'Editorial: "What is our longest song? Title, artist name and duration_sec, one row."',
      concept: 'JOIN for the name, ORDER BY … DESC and LIMIT 1 for the longest.',
      skeleton: 'SELECT s.title, a.name, s.duration_sec FROM songs s JOIN artists a ON … ORDER BY ______________ ____ LIMIT _;',
      solution: { cmd: 'SELECT s.title, a.name, s.duration_sec FROM songs s JOIN artists a ON a.id = s.artist_id ORDER BY s.duration_sec DESC LIMIT 1;', parts: [['JOIN artists a ON a.id = s.artist_id', 'The artist name.'], ['ORDER BY s.duration_sec DESC LIMIT 1', 'The longest one.']] } },
    { id: 'pc-no-songs', title: 'Artists with nothing released',
      brief: 'Label manager: "Which artists have no songs at all? Names only."',
      concept: 'The orphans mold the other way round: start FROM artists, LEFT JOIN songs, keep the rows where the song side is NULL.',
      skeleton: 'SELECT a.name FROM artists a LEFT JOIN songs s ON s.________ = a.__ WHERE s.__ __ ____;',
      solution: { cmd: 'SELECT a.name FROM artists a LEFT JOIN songs s ON s.artist_id = a.id WHERE s.id IS NULL;', parts: [['FROM artists a LEFT JOIN songs s', 'Every artist, with or without songs.'], ['WHERE s.id IS NULL', 'Only those with no match.']] } },
    { id: 'pc-unpaid-songs', title: 'Songs never paid',
      brief: 'Finance: "Which songs never appear in payments? Match on the title. Titles only."',
      concept: 'Same mold with other tables: songs LEFT JOIN payments ON the title, keep the rows with no payment.',
      skeleton: 'SELECT s.title FROM songs s LEFT JOIN payments p ON p.____ = s._____ WHERE p.__ __ ____;',
      solution: { cmd: 'SELECT s.title FROM songs s LEFT JOIN payments p ON p.song = s.title WHERE p.id IS NULL;', parts: [['LEFT JOIN payments p ON p.song = s.title', 'Each song with its payments, if any.'], ['WHERE p.id IS NULL', 'Songs with none.']] } },
    { id: 'pc-paid-country', title: 'Paid per country',
      brief: 'Finance: "Total paid per country. Match payments.artist to artists.name exactly as written."',
      concept: 'JOIN on the name, GROUP BY country, SUM the amount.',
      skeleton: 'SELECT a.country, SUM(p.amount) FROM payments p JOIN artists a ON a.____ = p.______ GROUP BY _________;',
      solution: { cmd: 'SELECT a.country, SUM(p.amount) FROM payments p JOIN artists a ON a.name = p.artist GROUP BY a.country;', parts: [['JOIN artists a ON a.name = p.artist', 'Payment to artist by name.'], ['GROUP BY a.country', 'One total per country.']] },
      note: 'Messy spellings ("luna ferreyra") do not match exactly, so those payments are missing here. Keep that in mind for the next practice.' },
    { id: 'pc-top-plays', title: 'Top 3 artists by plays', ordered: true,
      brief: 'Editorial: "The 3 artists with the most plays in total: name and total plays, biggest first."',
      concept: 'JOIN, GROUP BY the name, ORDER BY the sum and LIMIT: every piece you know, in one query.',
      skeleton: 'SELECT a.name, SUM(s.plays) FROM songs s JOIN artists a ON … GROUP BY ______ ORDER BY ___(_______) ____ LIMIT _;',
      solution: { cmd: 'SELECT a.name, SUM(s.plays) FROM songs s JOIN artists a ON a.id = s.artist_id GROUP BY a.name ORDER BY SUM(s.plays) DESC LIMIT 3;', parts: [['GROUP BY a.name', 'Total per artist.'], ['ORDER BY SUM(s.plays) DESC LIMIT 3', 'The top three.']] } },
    { id: 'pc-catalogue', title: 'The full catalogue list', ordered: true,
      brief: 'Label manager: "Every artist with their number of songs (0 included), most songs first; when tied, alphabetical by name."',
      concept: 'LEFT JOIN with COUNT(s.id) keeps the zeros. ORDER BY can take two columns: the second breaks ties.',
      skeleton: 'SELECT a.name, COUNT(s.__) FROM artists a LEFT JOIN songs s ON … GROUP BY a.name ORDER BY COUNT(s.id) ____, ______;',
      solution: { cmd: 'SELECT a.name, COUNT(s.id) FROM artists a LEFT JOIN songs s ON s.artist_id = a.id GROUP BY a.name ORDER BY COUNT(s.id) DESC, a.name;', parts: [['LEFT JOIN … COUNT(s.id)', 'Every artist, 0 when there are no songs.'], ['ORDER BY COUNT(s.id) DESC, a.name', 'Most songs first, ties by name.']] } },
  ];
  const P4 = [
    { id: 'pd-clean-count', title: 'Payments per real artist',
      brief: 'Data team: "How many payments does each artist have once the names are cleaned (no edge spaces, lowercase)? Skip the payment with no artist."',
      concept: 'GROUP BY an expression: LOWER(TRIM(artist)). WHERE … IS NOT NULL drops the empty one.',
      skeleton: 'SELECT LOWER(TRIM(artist)), COUNT(*) FROM payments WHERE ______ __ ___ ____ GROUP BY _____(____(______));',
      solution: { cmd: 'SELECT LOWER(TRIM(artist)), COUNT(*) FROM payments WHERE artist IS NOT NULL GROUP BY LOWER(TRIM(artist));', parts: [['LOWER(TRIM(artist))', 'The cleaned name.'], ['WHERE artist IS NOT NULL', 'Without the empty one.'], ['GROUP BY LOWER(TRIM(artist))', 'Grouped by the cleaned name.']] },
      note: 'Compare with "Every spelling, once": eleven spellings collapse into eight real artists.' },
    { id: 'pd-clean-country', title: 'Paid per country, done right',
      brief: 'Finance: "Total paid per country again, but this time match the names even when they are written differently."',
      concept: 'The join condition can clean both sides: ON LOWER(TRIM(p.artist)) = LOWER(a.name).',
      skeleton: 'SELECT a.country, SUM(p.amount) FROM payments p JOIN artists a ON _____(____(p.artist)) = _____(a.name) GROUP BY a.country;',
      solution: { cmd: 'SELECT a.country, SUM(p.amount) FROM payments p JOIN artists a ON LOWER(TRIM(p.artist)) = LOWER(a.name) GROUP BY a.country;', parts: [['ON LOWER(TRIM(p.artist)) = LOWER(a.name)', 'Match despite spaces and case.'], ['GROUP BY a.country', 'Total per country.']] },
      note: 'Argentina and Uruguay went up compared with the exact match: those were the messy rows.' },
    { id: 'pd-or-trap', title: 'The parentheses trap',
      brief: "Finance: \"Show the payments above 100 that belong to Nico Valdés or Andes Trío. All columns.\"",
      concept: 'AND binds tighter than OR: without parentheses, amount > 100 only applies to the first artist. Wrap the OR: amount > 100 AND (… OR …).',
      skeleton: "SELECT * FROM payments WHERE amount > ___ AND (______ = '___________' __ ______ = '__________');",
      solution: { cmd: "SELECT * FROM payments WHERE amount > 100 AND (artist = 'Nico Valdés' OR artist = 'Andes Trío');", parts: [['amount > 100', 'Big payments.'], ["AND ( … OR … )", 'Either artist, but both have to pass the amount filter.']] },
      note: "artist IN ('Nico Valdés', 'Andes Trío') avoids the trap altogether." },
    { id: 'pd-size-count', title: 'How many of each size',
      brief: "Finance: \"Label each payment 'missing' (no amount), 'big' (150 or more) or 'small', and count how many of each label there are.\"",
      concept: 'Give the CASE a name with AS, then GROUP BY that name.',
      skeleton: "SELECT CASE WHEN amount __ ____ THEN 'missing' WHEN amount >= ___ THEN 'big' ELSE 'small' END AS size, COUNT(*) FROM payments GROUP BY ____;",
      solution: { cmd: "SELECT CASE WHEN amount IS NULL THEN 'missing' WHEN amount >= 150 THEN 'big' ELSE 'small' END AS size, COUNT(*)\nFROM payments\nGROUP BY size;", parts: [['CASE … END AS size', 'The label of each payment.'], ['GROUP BY size', 'Counted per label.']] } },
    { id: 'pd-month-totals', title: 'Totals per month',
      brief: 'Finance: "Total paid per month, written like 2026-08."',
      concept: "SUBSTR(text, start, length) cuts text: SUBSTR(payment_date, 1, 7) turns '2026-08-14' into '2026-08'. Group by that.",
      skeleton: 'SELECT SUBSTR(payment_date, _, _) AS month, SUM(amount) FROM payments GROUP BY _____;',
      solution: { cmd: 'SELECT SUBSTR(payment_date, 1, 7) AS month, SUM(amount) FROM payments GROUP BY month;', parts: [['SUBSTR(payment_date, 1, 7)', 'The year and month.'], ['GROUP BY month', 'One total per month.']] },
      note: "Same as strftime('%Y-%m', payment_date) in SQLite or DATE_FORMAT in MySQL." },
    { id: 'pd-null-avg', title: 'Two averages',
      brief: 'Finance: "Give me two numbers in one row: the normal average amount, and the average if missing amounts counted as 0."',
      concept: 'AVG skips NULLs. COALESCE(amount, 0) turns them into 0, so they count.',
      skeleton: 'SELECT AVG(______), AVG(________(amount, _)) FROM payments;',
      solution: { cmd: 'SELECT AVG(amount), AVG(COALESCE(amount, 0)) FROM payments;', parts: [['AVG(amount)', 'Average of the 26 real amounts.'], ['AVG(COALESCE(amount, 0))', 'Average over all 27 rows.']] },
      note: 'A NULL is not a zero: deciding which one you mean changes the result.' },
    { id: 'pd-above-avg', title: 'Above average',
      brief: 'Finance: "Which payments are above the average amount? id, artist and amount."',
      concept: 'A subquery can sit inside WHERE: amount > (SELECT AVG(amount) FROM payments).',
      skeleton: 'SELECT id, artist, amount FROM payments WHERE amount > (SELECT ___(______) FROM ________);',
      solution: { cmd: 'SELECT id, artist, amount FROM payments WHERE amount > (SELECT AVG(amount) FROM payments);', parts: [['(SELECT AVG(amount) FROM payments)', 'The average, computed first.'], ['WHERE amount > ( … )', 'Compared with each payment.']] } },
    { id: 'pd-many-months', title: 'Paid in several months',
      brief: 'Support: "Which songs were paid in more than one different month? Song and number of months."',
      concept: 'COUNT(DISTINCT …) of the month (SUBSTR of the date) per song, and HAVING to keep more than one.',
      skeleton: 'SELECT song, COUNT(DISTINCT SUBSTR(payment_date, 1, 7)) FROM payments GROUP BY ____ HAVING COUNT(________ ______(payment_date, 1, 7)) > _;',
      solution: { cmd: 'SELECT song, COUNT(DISTINCT SUBSTR(payment_date, 1, 7)) AS months\nFROM payments\nGROUP BY song\nHAVING COUNT(DISTINCT SUBSTR(payment_date, 1, 7)) > 1;', parts: [['COUNT(DISTINCT SUBSTR(payment_date, 1, 7))', 'Different months per song.'], ['HAVING … > 1', 'More than one month.']] },
      note: 'Normal: royalties are paid every month. A song paid twice in the same month is the anomaly, which is what the August case is about.' },
  ];

  const LEVELS = [
    { id: 'select', title: 'SELECT basics', minutes: 14,
      intro: 'Read a table, pick columns, filter rows and sort them.',
      cheat: [['SELECT a, b FROM t', 'Columns a and b of table t'], ['SELECT *', 'Every column'], ['WHERE cond', 'Keep matching rows'], ["= 'text'", 'Text goes in single quotes'],
        ['AND / OR', 'Both / either condition'], ['IN (1, 2)', 'One of a list'], ['BETWEEN a AND b', 'Range, both ends included'], ["LIKE 'C%'", '% = anything'],
        ['IS NULL', 'Empty value (never = NULL)'], ['ORDER BY c DESC', 'Sort, biggest first'], ['LIMIT n', 'First n rows'], ['DISTINCT', 'No repeated rows'], ['expr AS name', 'Name a column']],
      missions: L1 },
    { id: 'aggregate', title: 'Counting and adding up', minutes: 12,
      intro: 'Turn many rows into one number, or one number per group.',
      cheat: [['COUNT(*)', 'Number of rows'], ['COUNT(col)', 'Rows where col is not NULL'], ['SUM / AVG / MIN / MAX (col)', 'Total / average / smallest / largest'],
        ['GROUP BY col', 'One row per value of col ("per X")']],
      missions: L2 },
    { id: 'practice-1', practice: true, title: 'Practice: rows and totals', minutes: 12,
      intro: 'No new clauses: mix filters, sorting and aggregates in new questions, with a NULL trap or two.',
      cheat: [['COUNT(DISTINCT col)', 'How many different values']], missions: P1 },
    { id: 'having', title: 'HAVING and duplicates', minutes: 12,
      intro: 'Filter groups, and catch the same record appearing twice.',
      cheat: [['HAVING cond', 'Filter groups (aggregates allowed)'], ['WHERE vs HAVING', 'WHERE = rows before grouping; HAVING = groups after'],
        ['GROUP BY a, b HAVING COUNT(*) > 1', 'Duplicates mold']],
      missions: L3 },
    { id: 'practice-2', practice: true, title: 'Practice: groups', minutes: 12,
      intro: 'GROUP BY, HAVING and WHERE again, on other tables and other questions.',
      cheat: [['WHERE … GROUP BY … HAVING …', 'Rows first, then groups']], missions: P2 },
    { id: 'joins', title: 'JOINs', minutes: 12,
      intro: 'Combine tables: songs with artists, payments with countries, and spot orphans.',
      cheat: [['t1 JOIN t2 ON t1.x = t2.y', 'Rows that match in both'], ['t1 LEFT JOIN t2 ON …', 'Every row of t1, NULL when no match'],
        ['LEFT JOIN … WHERE t2.id IS NULL', 'Orphans mold'], ['FROM songs s', 'Table alias']],
      missions: L4 },
    { id: 'practice-3', practice: true, title: 'Practice: joins', minutes: 14,
      intro: 'JOIN and LEFT JOIN combined with everything before: filters, groups, rankings.',
      cheat: [['ORDER BY a DESC, b', 'Second column breaks ties']], missions: P3 },
    { id: 'quality', title: 'Data quality and the August case', minutes: 15,
      intro: 'Clean messy values, handle NULLs, filter by month, then answer the client.',
      cheat: [['TRIM / LOWER / UPPER (x)', 'Clean text'], ['COALESCE(x, 0)', 'Replace NULL'], ["CASE WHEN … THEN … ELSE … END", 'Value by condition'],
        ["LIKE '2026-08%'", 'A month, as text'], ['FROM ( SELECT … )', 'Subquery'], ['WITH name AS ( SELECT … )', 'Named intermediate result (CTE)']],
      missions: L5 },
    { id: 'practice-4', practice: true, title: 'Practice: the whole toolbox', minutes: 15,
      intro: 'Messy names, NULLs, months and subqueries, mixed with all the rest.',
      cheat: [['SUBSTR(x, 1, 7)', "Cut text: '2026-08-14' → '2026-08'"], ['WHERE x > (SELECT AVG(x) …)', 'Subquery in WHERE'], ['A AND (B OR C)', 'Parentheses around OR']], missions: P4 },
  ];

  const flat = [];
  LEVELS.forEach((lv, li) => lv.missions.forEach((m, mi) => flat.push({ mission: m, li, mi, gi: flat.length })));

  /* ---- evaluation ---- */
  const cache = {};
  function expected(m) { return cache[m.id] || (cache[m.id] = DB.run(m.solution.cmd)); }
  function evaluate(m, sql) {
    const res = DB.run(sql);
    const cmp = DB.compare(res, expected(m), m);
    return { res, cmp };
  }

  /* ---- hint 1: which part is off (never names the clause or the answer) ---- */
  const TABLES = Object.keys(OT.data.schema);
  const COLUMNS = [...new Set([].concat(...Object.values(OT.data.schema)))];
  const KEYWORDS = /^(DESC|ASC|FROM|WHERE|BY|GROUP|ORDER|HAVING|LIMIT|SELECT|AND|OR|ON|JOIN|AS)$/i;
  function closest(word, options) {
    const dist = (a, b) => {
      const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
      for (let j = 1; j <= b.length; j++) d[0][j] = j;
      for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return d[a.length][b.length];
    };
    let best = null, bd = 3;
    for (const o of options) { const x = dist(word.toLowerCase(), o); if (x < bd) { bd = x; best = o; } }
    return best;
  }
  function explainError(err) {
    let m;
    if ((m = err.match(/no such table: (\S+)/))) {
      const c = closest(m[1], TABLES);
      return 'There is no table called "' + m[1] + '".' + (c ? ' Did you mean "' + c + '"?' : '') + ' The tables are: ' + TABLES.join(', ') + '.';
    }
    if ((m = err.match(/no such column: (\S+)/)) && KEYWORDS.test(m[1])) {
      return 'SQLite read the keyword ' + m[1].toUpperCase() + ' as if it were a column name: look at the punctuation and the words right before it.';
    }
    if ((m = err.match(/no such column: (\S+)/))) {
      const c = closest(m[1].split('.').pop(), COLUMNS);
      return 'There is no column "' + m[1] + '" in the tables you are reading.' + (c ? ' Did you mean "' + c + '"?' : '') + ' Check the schema above the editor; text values need single quotes.';
    }
    if ((m = err.match(/near "([^"]+)": syntax error/))) return 'SQLite got lost near "' + m[1] + '": something right around there is missing, misspelled or out of order.';
    if (/incomplete input/.test(err)) return 'The query ends too early: something is missing at the end (a closing parenthesis or quote?).';
    if (/misuse of aggregate/.test(err)) return 'An aggregate (COUNT, SUM…) is somewhere it cannot go: in the part that filters individual rows.';
    if ((m = err.match(/ambiguous column name: (\S+)/))) return '"' + m[1] + '" exists in more than one table: say which one, like a.' + m[1] + '.';
    if ((m = err.match(/no such function: (\w+)/))) return 'SQLite has no function called ' + m[1] + '. It may be MySQL-only or misspelled.';
    return 'SQLite returned an error: ' + err;
  }
  const PARTS = [
    ['leftJoin', 'how the tables are combined (some rows have no match on the other side)'],
    ['join', 'which tables you combine'],
    ['where', 'which rows you keep'],
    ['groupBy', 'how rows are grouped'],
    ['having', 'which groups you keep'],
    ['distinct', 'repeated values in the result'],
    ['limit', 'how many rows you show'],
    ['sub', 'an intermediate result you need to build first'],
  ];
  function missingPart(sql, m) {
    const u = DB.analyze(sql), s = DB.analyze(m.solution.cmd);
    const p = PARTS.find(([k]) => s[k] && !u[k]);
    return p ? p[1] : null;
  }
  function diagnose(m, sql, res, cmp) {
    if (res.error) return explainError(res.error);
    if (cmp.kind === 'noresult') return "Your query didn't return a table. A query that reads data starts with SELECT.";
    if (cmp.kind === 'cols') return 'Your result has ' + cmp.got + ' column' + (cmp.got === 1 ? '' : 's') + '; the answer has ' + cmp.want + '. Look at the list right after SELECT.';
    const part = missingPart(sql, m);
    if (cmp.kind === 'rows') {
      return 'You got ' + cmp.got + ' row' + (cmp.got === 1 ? '' : 's') + '; the answer has ' + cmp.want + '. ' +
        (part ? 'The part that is off: ' + part + '.' : 'Look at the part that decides which rows stay (your conditions).');
    }
    if (cmp.kind === 'order') return 'Right rows, wrong order. Look at the part that sorts the result, and its direction.';
    if (cmp.kind === 'names') return 'Right values. Now name the columns exactly as the task asks.';
    const u = DB.analyze(sql), s = DB.analyze(m.solution.cmd);
    if (s.limit && u.limit && u.orderBy) return 'Right shape, but different rows made it into the result. Look at how you sort before the limit cuts it (and the direction).';
    return 'Right shape, but some values differ. ' + (part ? 'The part that is off: ' + part + '.' : 'Check your conditions and any calculation inside SELECT.');
  }

  /* ---- typical SQL mistakes (the player's own list), one tip shown per attempt ---- */
  const DETECTORS = [
    { id: 'missing-from', label: 'Forgetting FROM',
      tip: 'Every query that reads a table needs FROM <table> after the column list.',
      test: c => /^\s*(SELECT)\b/.test(c.up) && !/\bFROM\b/.test(c.up) && /\bFROM\b/.test(c.sp) },
    { id: 'ord-by', label: 'Writing ORD BY instead of ORDER BY',
      tip: 'It is ORDER BY, written out in full.',
      test: c => /\bORD\s+BY\b/.test(c.up) },
    { id: 'order-by-no-column', label: 'ORDER BY without a column',
      tip: 'ORDER BY needs the column (or alias) to sort by, and then optionally DESC.',
      test: c => /\bORDER\s+BY\s*(DESC|ASC|LIMIT|;|$)/.test(c.up.trim()) },
    { id: 'comma-before-desc', label: 'A comma before DESC',
      tip: 'No comma before DESC or ASC: it goes right after the column it applies to.',
      test: c => /,\s*(DESC|ASC)\b/.test(c.up) },
    { id: 'join-in-where', style: true, label: 'Putting the join condition in WHERE instead of ON',
      tip: 'The join condition belongs in ON, right after the JOIN (… JOIN artists a ON a.id = s.artist_id), not in WHERE.',
      test: c => /\bJOIN\b/.test(c.up) && !/\bON\b/.test(c.up) && !/\bUSING\b/.test(c.up) },
    { id: 'table-typo', label: 'Misspelled table name',
      tip: 'Table names must be exact: ' + TABLES.join(', ') + '.',
      test: c => /no such table/.test(c.err) },
    { id: 'unquoted-text', label: 'Text value without quotes',
      tip: "Text values go in single quotes, like country = 'Argentina'. Without quotes SQL reads them as column names.",
      test: c => { const m = c.err.match(/no such column: (\w+)/); return !!m && !KEYWORDS.test(m[1]) && new RegExp("(=|<>|IN\\s*\\(|,)\\s*" + m[1] + '\\b', 'i').test(c.sql); } },
    { id: 'column-typo', label: 'Misspelled column name',
      tip: 'Column names must be exact; check the schema above the editor.',
      test: c => { const m = c.err.match(/no such column: (\S+)/); return !!m && !KEYWORDS.test(m[1]); } },
    { id: 'per-each-group-by', label: 'Blanking on "per each X" (GROUP BY + aggregate)',
      tip: '"Per X" or "for each X" is the GROUP BY mold: GROUP BY X, plus an aggregate like COUNT(*) or SUM(…).',
      test: c => c.s.groupBy && !c.u.groupBy && !c.err },
    { id: 'where-vs-having', label: 'Mixing up WHERE and HAVING',
      tip: 'WHERE filters rows before grouping; HAVING filters groups after it. Conditions on SUM or COUNT go in HAVING.',
      test: c => /misuse of aggregate/.test(c.err) || (c.u.having && !c.u.groupBy) || (c.s.having && !c.u.having && c.u.groupBy) },
    { id: 'bare-column-group', style: true, label: 'Plain columns in SELECT when grouping',
      tip: 'When you group, every column in SELECT must be in GROUP BY or inside an aggregate (SUM, COUNT…).',
      test: c => !c.err && DB.bareColumns(c.sql).length > 0 },
    { id: 'aggregate-no-parens', label: 'Aggregate without parentheses (SUM amount)',
      tip: 'Aggregates need parentheses: SUM(amount), COUNT(*).',
      test: c => /(?<!\bAS\s{1,9})\b(SUM|AVG|COUNT|MIN|MAX)\s+(?!AS\b|FROM\b)[A-Z_*]/.test(c.up) },
    { id: 'equals-null', label: 'Comparing with = NULL',
      tip: 'Nothing equals NULL, not even NULL: use IS NULL or IS NOT NULL.',
      test: c => /(=|<>|!=)\s*NULL\b/.test(c.up) },
    { id: 'mysql-function', label: 'Using a MySQL-only function',
      tip: "That function is MySQL. In SQLite use strftime('%Y-%m', payment_date), or compare the date text: payment_date LIKE '2026-08%'.",
      test: c => /no such function: (DATE_FORMAT|STR_TO_DATE|CURDATE|NOW|DATEDIFF|DAY)/i.test(c.err) },
  ];
  function detectMistakes(m, sql, res) {
    const c = { sql, up: DB.strip(sql), sp: DB.strip(m.solution.cmd), err: (res && res.error) || '',
      u: DB.analyze(sql), s: DB.analyze(m.solution.cmd) };
    return DETECTORS.filter(d => { try { return d.test(c); } catch (e) { return false; } });
  }

  function cheatUpTo(li) { return LEVELS.slice(0, li + 1).map(lv => ({ title: lv.title, rows: lv.cheat })); }

  OT.tracks = OT.tracks || {};
  OT.tracks.sql = {
    id: 'sql', title: 'SQL', levels: LEVELS, flat,
    expected, evaluate, diagnose, detectMistakes, cheatUpTo,
    notice: { title: 'This is SQLite, not MySQL.',
      text: "Your queries run on real SQLite inside the browser: almost the same SQL you'd write in MySQL. Where they differ: dates (SQLite: strftime('%Y-%m', d); MySQL: DATE_FORMAT(d, '%Y-%m'). MONTH() and YEAR() are added here so the MySQL style works too), integer division (SQLite: 215 / 60 = 3; MySQL: 3.5833) and joining text (|| here, CONCAT() in MySQL)." },
  };
})(typeof window !== 'undefined' ? window : globalThis);
