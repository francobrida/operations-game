# Operations Trainer

A practice game for an Operations internship: Bash, SQL, Excel, Python and MongoDB on one shared
fictional dataset (Sonora Royalties, a music royalties company), ending in a Final Case.

## How to open it

Double-click `index.html`. Nothing to install, and it works offline (SQLite is bundled in `vendor/`).

From the Python phase on (Pyodide) a local server will be needed. From this folder:

```
python -m http.server 8000
```

then open http://localhost:8000

Progress is saved in the browser (`localStorage`). Double-click and local server are different
origins, so each keeps its own progress.

## Status

| Phase | Content | Status |
|---|---|---|
| 1 | Menu, shared dataset, progress, Bash track (5 levels, 62 missions) | done |
| 2 | SQL track on real SQLite (5 levels, 44 missions) | done |
| 3 | Excel | to do |
| 4 | Python | to do |
| 5 | MongoDB | to do |
| 6 | The Final Case | to do |
| 7 | Review mode, cheat sheets for the other tracks, polish | to do |

## Layout

```
index.html              loads the scripts in order (no modules, so double-click works)
css/style.css
js/data.js              shared dataset: artists, songs, payments, import_log, import logs
js/storage.js           progress, scores and frequent mistakes in localStorage
js/ui.js                DOM helpers
js/engine.js            mission runner shared by every track (hints, solution, scoring)
js/app.js               menu, level screen, cheat sheet, routes (#/t/sql, #/p/sql/2/5)
js/tracks/bash/         sim.js (fake disk + interpreter), missions.js, view.js (terminal)
js/tracks/sql/          db.js (SQLite + result comparison), missions.js, view.js (editor + table)
vendor/                 sql.js 1.10.3 (SQLite 3.45.2, MIT): sql-wasm.js, the wasm binary as base64 for
                        file://, and the raw .wasm used by the tests
tests/                  node tests/bash.test.js · node tests/sql.test.js
legacy/                 the previous game (Bash Camp), kept as a backup
```

## Adding a track

Register `OT.tracks.<id>` with `levels` (each: `title`, `minutes`, `intro`, `cheat`, `missions`),
`flat`, `cheatUpTo(level)` and `createView(pane, api)`. The view evaluates each attempt and calls
`api.attempt({ ok, diagnosis, mistakes })`; the engine handles hints, solution, score, progress and
the level summary. Each mission has `concept` (hint 2), `skeleton` (hint 3) and
`solution: { cmd, parts }` (the solution explained piece by piece).
