/* SQL engine: real SQLite (sql.js) loaded from vendor/, a fresh copy of the shared dataset
   for every query, and a result comparison that accepts any equivalent query.
   Pure logic, no DOM (tested in Node). */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  const D = OT.data;
  let SQL = null, template = null, pending = null;

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function init(initSqlJs, wasmBinary) {
    if (!pending) pending = initSqlJs({ wasmBinary }).then(lib => { SQL = lib; template = build(); });
    return pending;
  }
  function ready() {
    if (pending) return pending;
    if (typeof root.initSqlJs !== 'function' || !root.OT_SQL_WASM_B64) {
      return Promise.reject(new Error('SQL engine files are missing (vendor/sql-wasm.js).'));
    }
    return init(root.initSqlJs, b64ToBytes(root.OT_SQL_WASM_B64));
  }

  function build() {
    const db = new SQL.Database();
    for (const t of Object.keys(D.schema)) {
      const cols = D.schema[t];
      db.run('CREATE TABLE ' + t + ' (' + cols.map((c, i) => c + ' ' + D.types[t][i]).join(', ') + ')');
      const stmt = db.prepare('INSERT INTO ' + t + ' VALUES (' + cols.map(() => '?').join(', ') + ')');
      for (const row of D.tables[t]) stmt.run(cols.map(c => row[c] === undefined ? null : row[c]));
      stmt.free();
    }
    const bytes = db.export();
    db.close();
    return bytes;
  }
  // MySQL habits: MONTH() and YEAR() are not SQLite built-ins, so they are added here.
  function addFunctions(db) {
    const part = (d, a, b) => (typeof d === 'string' && /^\d{4}-\d{2}/.test(d)) ? parseInt(d.slice(a, b), 10) : null;
    db.create_function('YEAR', d => part(d, 0, 4));
    db.create_function('MONTH', d => part(d, 5, 7));
  }

  // Runs the query on a fresh database and returns the last result table.
  function run(sql) {
    if (!SQL) return { error: 'The SQL engine is still loading.' };
    if (!sql || !sql.trim()) return { error: 'The query is empty.' };
    if (/\bRECURSIVE\b/i.test(sql)) return { error: 'WITH RECURSIVE is out of scope in this trainer.' };
    const db = new SQL.Database(template);
    try {
      addFunctions(db);
      let last = null;
      for (const stmt of db.iterateStatements(sql)) {
        const columns = stmt.getColumnNames();
        const rows = [];
        while (stmt.step()) rows.push(stmt.get());
        if (columns.length) last = { columns, rows };
      }
      return last || { columns: [], rows: [] };
    } catch (e) {
      return { error: String((e && e.message) || e) };
    } finally {
      db.close();
    }
  }

  /* ---- comparison ---- */
  function cell(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
    return String(v);
  }
  // Cells sorted inside each row: column order does not matter.
  const rowKey = row => row.map(cell).sort().join('␟');
  const sortedKeys = rows => rows.map(rowKey).sort();

  // opts: { ordered, names }  ->  { ok } or { ok:false, kind: error|noresult|cols|rows|values|order|names }
  function compare(user, exp, opts) {
    opts = opts || {};
    if (user.error) return { ok: false, kind: 'error' };
    if (!user.columns.length) return { ok: false, kind: 'noresult' };
    if (user.columns.length !== exp.columns.length) return { ok: false, kind: 'cols', got: user.columns.length, want: exp.columns.length };
    if (user.rows.length !== exp.rows.length) return { ok: false, kind: 'rows', got: user.rows.length, want: exp.rows.length };
    const same = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);
    if (!same(sortedKeys(user.rows), sortedKeys(exp.rows))) return { ok: false, kind: 'values' };
    if (opts.ordered && !same(user.rows.map(rowKey), exp.rows.map(rowKey))) return { ok: false, kind: 'order' };
    if (opts.names) {
      const n = cols => cols.map(c => c.toLowerCase()).sort();
      if (!same(n(user.columns), n(exp.columns))) return { ok: false, kind: 'names' };
    }
    return { ok: true };
  }

  /* ---- light query analysis for hints and mistake detection ---- */
  // Uppercase text with string literals and comments blanked out.
  function strip(sql) {
    return (sql || '').replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''").toUpperCase();
  }
  function analyze(sql) {
    const u = strip(sql);
    return {
      join: /\bJOIN\b/.test(u), leftJoin: /\bLEFT\s+(OUTER\s+)?JOIN\b/.test(u),
      where: /\bWHERE\b/.test(u), groupBy: /\bGROUP\s+BY\b/.test(u), having: /\bHAVING\b/.test(u),
      orderBy: /\bORDER\s+BY\b/.test(u), limit: /\bLIMIT\b/.test(u), distinct: /\bDISTINCT\b/.test(u),
      sub: /\bWITH\b/.test(u) || /\(\s*SELECT\b/.test(u), aggregate: /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/.test(u),
    };
  }
  // Plain columns in the SELECT list that are neither grouped nor aggregated.
  function bareColumns(sql) {
    const u = strip(sql);
    if (/^\s*WITH\b/.test(u) || !/\bGROUP\s+BY\b/.test(u)) return [];
    const sel = u.match(/^\s*SELECT\s+(?:DISTINCT\s+)?([\s\S]*?)\bFROM\b/);
    const grp = u.match(/\bGROUP\s+BY\s+([\s\S]*?)(\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|;|$)/);
    if (!sel || !grp) return [];
    const split = s => { const out = []; let depth = 0, cur = ''; for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); };
    const leaf = x => x.split('.').pop();
    const grouped = split(grp[1]).map(leaf);
    const aliases = [];
    const bare = [];
    for (const item of split(sel[1])) {
      const m = item.match(/^([A-Z_][\w.]*)(?:\s+(?:AS\s+)?([A-Z_]\w*))?$/);
      if (!m) continue;
      if (m[2]) aliases.push(m[2]);
      if (!grouped.includes(leaf(m[1])) && !grouped.includes(m[2])) bare.push(m[1].toLowerCase());
    }
    return bare;
  }

  OT.sqlDB = { init, ready, run, compare, analyze, bareColumns, strip, isReady: () => !!SQL };
})(typeof window !== 'undefined' ? window : globalThis);
