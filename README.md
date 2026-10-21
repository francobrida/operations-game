# Operations Trainer

A browser game for practicing the everyday toolkit of data operations work: Bash, SQL, Excel and
Python, all on one shared fictional dataset, building up to a real-world incident you have to
solve end to end.

**▶ Play it: [francobrida.github.io/operations-game](https://francobrida.github.io/operations-game/)** (works on mobile)

## The idea

Sonora Royalties is a made-up music royalties company. Its data has the kind of problems real
pipelines have: a payments file imported twice, NULLs, artist names written three different ways,
a song pointing to an artist that doesn't exist. Every track teaches its tool through short
missions written like requests from coworkers ("Support says this client was paid twice, can you
check?"), and every track stops exactly where the final case needs it:

> *"You paid us twice for the same song in August."*

Find the duplicates in SQL, trace the root cause in the import logs with Bash, build the summary
for the client in Excel, and write the Python check that stops it from happening again.

## Tracks

| Track | What you practice | Status |
|---|---|---|
| Bash | Navigation, files, grep/find, pipes, redirection, permissions, scripts, `$(…)`, log digging with `cut \| sort \| uniq -c` | ✅ 62 missions |
| SQL | SELECT to CTEs: filters, aggregates, GROUP BY/HAVING, duplicates, JOINs and orphans, data cleaning, date filters | ✅ 44 missions |
| Excel | Formulas, COUNTIF/SUMIF, $ references, VLOOKUP/XLOOKUP, sort/filter, duplicates, pivot tables | ✅ 30 missions |
| Python | Variables to functions, the csv module, sets and dicts for duplicates, an automation script that writes a report | ✅ 25 missions |
| MongoDB | find(), projections, a basic aggregation (optional) | planned |
| Final Case | One incident across all the tools, closed with a written report | planned |

## How it works

- **Answers are checked by their effect, not their text.** A Bash mission inspects the simulated
  disk or the output; an SQL mission compares result sets, ignoring column order, letter case and
  formatting. Any correct approach passes.
- **Real SQLite in the browser** via [sql.js](https://github.com/sql-js/sql.js) (WebAssembly),
  bundled locally so it works offline and from `file://`. Every query runs on a fresh copy of the
  data, so nothing can break.
- **Real Python 3.12 in the browser** via [Pyodide](https://pyodide.org), inside a Web Worker so a
  runaway loop is stopped after 5 seconds. Missions that read a CSV are tested twice, on two
  different files, so hard-coded answers fail.
- **A simulated Bash shell**: fake filesystem plus a small interpreter supporting pipes, `;`,
  `>`/`>>`, variables, command substitution, scripts and ~20 commands.
- **Progressive hints that don't spoil the answer**: hint 1 points at which part of *your* attempt
  is off, hint 2 gives the concept, hint 3 a skeleton with blanks; the full solution, explained
  piece by piece, only on request.
- **Mistake detection** for common slips (`ORD BY`, `= NULL`, WHERE vs HAVING, `>` instead of
  `>>`, a missing `./`…) with targeted tips, tracked over time.
- **Progress** saved in the browser, with a sync code to move it between phone and computer.
- **Plain JavaScript, no build step, no dependencies** besides sql.js and Pyodide. Tests run in Node and play
  every mission with its official solution, plus accepted alternatives and common wrong answers.

## Run it locally

Open `index.html` with a double click (the Python track downloads Pyodide from jsDelivr, so it needs
internet; everything else works offline). Or serve the folder:

```
python -m http.server 8000
```

Tests:

```
node tests/bash.test.js
node tests/sql.test.js
node tests/excel.test.js
node tests/python.test.js   # uses your local python
```

## Project layout

```
index.html              loads the scripts in order (no modules, so file:// works)
js/data.js              the shared dataset: artists, songs, payments, import_log, import logs
js/engine.js            mission runner shared by every track (hints, solution, scoring)
js/app.js               menu, level screens, cheat sheet, sync, routing
js/storage.js           progress, mistakes and sync codes in localStorage
js/tracks/bash/         simulated shell, missions, terminal view
js/tracks/sql/          SQLite wrapper and result comparison, missions, editor view
js/tracks/excel/        spreadsheet engine (formulas, fill, sort, filter, pivot), missions, grid view
js/tracks/python/       test harness (Python), Pyodide worker runner, missions, editor view
vendor/                 sql.js 1.10.3 (SQLite 3.45.2, MIT license)
tests/                  Node test suites
```

A new track registers `OT.tracks.<id>` with its levels and a `createView(pane, api)`; the view
evaluates attempts and reports them with `api.attempt({ ok, diagnosis, mistakes })`, and the shared
engine does the rest.
