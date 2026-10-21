/* Tiny spreadsheet engine: cells, formulas, fill down, sort, filter, pivot.
   Pure logic, no DOM (tested in Node). Only the functions the Excel track teaches are supported. */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};

  /* ---- addresses ---- */
  const colNum = s => s.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const colName = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const addr = (c, r) => colName(c) + r;
  function parseAddr(a) {
    const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(a);
    return m ? { c: colNum(m[1]), r: +m[2] } : null;
  }
  function rangeCells(spec) { // 'E2:E15' | 'C17' | ['C18', 'C19']
    if (Array.isArray(spec)) return [].concat(...spec.map(rangeCells));
    const [a, b] = spec.split(':');
    const p = parseAddr(a), q = b ? parseAddr(b) : p;
    const out = [];
    for (let r = p.r; r <= q.r; r++) for (let c = p.c; c <= q.c; c++) out.push(addr(c, r));
    return out;
  }

  /* ---- errors and values ---- */
  const E = code => ({ e: code });
  const isErr = v => v !== null && typeof v === 'object' && 'e' in v;
  const ALIASES = {
    SUMA: 'SUM', PROMEDIO: 'AVERAGE', CONTAR: 'COUNT', CONTARA: 'COUNTA', REDONDEAR: 'ROUND', SI: 'IF', 'SI.ERROR': 'IFERROR',
    'CONTAR.SI': 'COUNTIF', 'CONTAR.SI.CONJUNTO': 'COUNTIFS', 'SUMAR.SI': 'SUMIF', 'SUMAR.SI.CONJUNTO': 'SUMIFS',
    BUSCARV: 'VLOOKUP', BUSCARX: 'XLOOKUP', ESPACIOS: 'TRIM', MINUSC: 'LOWER', MAYUSC: 'UPPER',
  };
  const FUNCS = ['SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'MIN', 'MAX', 'ROUND', 'IF', 'IFERROR', 'TRIM', 'LOWER', 'UPPER',
    'COUNTIF', 'COUNTIFS', 'SUMIF', 'SUMIFS', 'VLOOKUP', 'XLOOKUP'];
  const canonical = name => ALIASES[name.toUpperCase()] || name.toUpperCase();

  function parseInput(raw) { // what a typed value means when it is not a formula
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') return raw;
    const s = String(raw);
    if (/^\s*-?\d+(\.\d+)?\s*$/.test(s)) return parseFloat(s);
    if (/^(TRUE|FALSE)$/i.test(s.trim())) return s.trim().toUpperCase() === 'TRUE';
    return s;
  }
  function toText(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10);
    if (isErr(v)) return v.e;
    return String(v);
  }
  function toNum(v) {
    if (v === null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (isErr(v)) return v;
    const t = String(v).trim();
    return t !== '' && !isNaN(+t) ? +t : E('#VALUE!');
  }

  /* ---- tokenizer + parser ---- */
  function tokenize(src) {
    const toks = []; let i = 0;
    while (i < src.length) {
      const rest = src.slice(i); let m;
      if (/^\s/.test(rest)) { i++; continue; }
      if ((m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(rest))) { toks.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if (rest[0] === '"') {
        let j = 1, s = '';
        while (j < rest.length) { if (rest[j] === '"') { if (rest[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += rest[j++]; }
        if (j >= rest.length) throw new Error('unclosed quote');
        toks.push({ t: 'str', v: s }); i += j + 1; continue;
      }
      if ((m = /^[A-Za-z_][A-Za-z0-9_.]*(?=\s*\()/.exec(rest))) { toks.push({ t: 'fn', v: m[0] }); i += m[0].length; continue; }
      if ((m = /^(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?![A-Za-z0-9_])/.exec(rest))) {
        toks.push(m[2] ? { t: 'range', a: m[1], b: m[2] } : { t: 'ref', a: m[1] }); i += m[0].length; continue;
      }
      if ((m = /^\$?([A-Za-z]{1,3}):\$?([A-Za-z]{1,3})(?![A-Za-z0-9_])/.exec(rest))) { toks.push({ t: 'cols', a: m[1], b: m[2] }); i += m[0].length; continue; }
      if ((m = /^(TRUE|FALSE)(?![A-Za-z0-9_])/i.exec(rest))) { toks.push({ t: 'bool', v: m[1].toUpperCase() === 'TRUE' }); i += m[0].length; continue; }
      if ((m = /^(<=|>=|<>|[-+*/^&=<>(),;])/.exec(rest))) { toks.push({ t: 'op', v: m[1] === ';' ? ',' : m[1] }); i += m[1].length; continue; }
      if ((m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest))) { toks.push({ t: 'name', v: m[0] }); i += m[0].length; continue; }
      throw new Error('unexpected "' + rest[0] + '"');
    }
    return toks;
  }
  function parse(src) {
    const toks = tokenize(src); let p = 0;
    const peek = () => toks[p], isOp = v => toks[p] && toks[p].t === 'op' && toks[p].v === v;
    const expect = v => { if (!isOp(v)) throw new Error('expected ' + v); p++; };
    function bin(next, ops) {
      return () => {
        let a = next();
        while (toks[p] && toks[p].t === 'op' && ops.includes(toks[p].v)) { const op = toks[p++].v; a = { t: 'bin', op, a, b: next() }; }
        return a;
      };
    }
    const primary = () => {
      const tk = toks[p++];
      if (!tk) throw new Error('formula ends too early');
      if (tk.t === 'num' || tk.t === 'str' || tk.t === 'bool') return { t: 'lit', v: tk.v };
      if (tk.t === 'ref') return { t: 'ref', ...parseAddr(tk.a) };
      if (tk.t === 'range') { const a = parseAddr(tk.a), b = parseAddr(tk.b); return { t: 'range', c1: Math.min(a.c, b.c), r1: Math.min(a.r, b.r), c2: Math.max(a.c, b.c), r2: Math.max(a.r, b.r) }; }
      if (tk.t === 'cols') return { t: 'range', c1: colNum(tk.a), r1: 1, c2: colNum(tk.b), r2: Infinity };
      if (tk.t === 'name') return { t: 'name', v: tk.v };
      if (tk.t === 'fn') {
        expect('('); const args = [];
        if (!isOp(')')) { do { args.push(isOp(',') || isOp(')') ? { t: 'lit', v: null } : expr()); } while (isOp(',') && ++p); }
        expect(')');
        return { t: 'fn', name: canonical(tk.v), raw: tk.v, args };
      }
      if (tk.t === 'op' && tk.v === '(') { const e = expr(); expect(')'); return e; }
      if (tk.t === 'op' && (tk.v === '-' || tk.v === '+')) { const a = unary(); return tk.v === '-' ? { t: 'neg', a } : a; }
      throw new Error('unexpected "' + tk.v + '"');
    };
    const unary = () => primary();
    const power = bin(unary, ['^']);
    const mult = bin(power, ['*', '/']);
    const add = bin(mult, ['+', '-']);
    const concat = bin(add, ['&']);
    const expr = bin(concat, ['=', '<>', '<', '>', '<=', '>=']);
    const tree = expr();
    if (p < toks.length) throw new Error('unexpected "' + (peek().v || peek().a) + '"');
    return tree;
  }

  /* ---- sheet ---- */
  // sheet: { cells: { A1: raw }, filter: { col, value } | null, pivot: { rows, values, agg } | null }
  function newSheet(cells) { return { cells: Object.assign({}, cells), filter: null, pivot: null }; }
  function clone(sh) { return { cells: Object.assign({}, sh.cells), filter: sh.filter && Object.assign({}, sh.filter), pivot: sh.pivot && Object.assign({}, sh.pivot) }; }
  function bounds(sh) {
    let maxR = 1, maxC = 1;
    for (const a of Object.keys(sh.cells)) { const p = parseAddr(a); if (p && sh.cells[a] !== '' && sh.cells[a] != null) { maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); } }
    return { rows: maxR, cols: maxC };
  }
  // The data table: contiguous headers in row 1 from column A, down to the last row with any data.
  function table(sh) {
    let cols = 0;
    while (sh.cells[addr(cols + 1, 1)] != null && sh.cells[addr(cols + 1, 1)] !== '') cols++;
    let rows = 1;
    for (const a of Object.keys(sh.cells)) { const p = parseAddr(a); if (p && p.c <= cols && sh.cells[a] !== '' && sh.cells[a] != null) rows = Math.max(rows, p.r); }
    return { cols, rows };
  }

  function evaluator(sh) {
    const memo = {}, busy = {};
    const maxRow = bounds(sh).rows;
    function cellValue(c, r) {
      const a = addr(c, r);
      if (a in memo) return memo[a];
      const raw = sh.cells[a];
      if (typeof raw !== 'string' || !raw.startsWith('=')) return (memo[a] = parseInput(raw));
      if (busy[a]) return E('#CIRC');
      busy[a] = true;
      let v;
      try { v = scalar(evalNode(parse(raw.slice(1)))); } catch (e) { v = E('#ERROR'); v.msg = e.message; }
      busy[a] = false;
      return (memo[a] = v);
    }
    function rangeValues(n) {
      const out = [];
      for (let r = n.r1; r <= Math.min(n.r2, maxRow); r++) { const row = []; for (let c = n.c1; c <= n.c2; c++) row.push(cellValue(c, r)); out.push(row); }
      return out;
    }
    const scalar = v => (v && v.range ? E('#VALUE!') : v);
    const flat = vs => [].concat(...vs.map(v => (v && v.range ? [].concat(...v.range) : [v])));
    function evalNode(n) {
      switch (n.t) {
        case 'lit': return n.v;
        case 'ref': return cellValue(n.c, n.r);
        case 'range': return { range: rangeValues(n) };
        case 'name': return E('#NAME?');
        case 'neg': { const v = toNum(scalar(evalNode(n.a))); return isErr(v) ? v : -v; }
        case 'bin': return binary(n.op, scalar(evalNode(n.a)), scalar(evalNode(n.b)));
        case 'fn': return call(n);
      }
      return E('#VALUE!');
    }
    function binary(op, a, b) {
      if (isErr(a)) return a;
      if (isErr(b)) return b;
      if (op === '&') return toText(a) + toText(b);
      if (['+', '-', '*', '/', '^'].includes(op)) {
        const x = toNum(a), y = toNum(b);
        if (isErr(x)) return x;
        if (isErr(y)) return y;
        if (op === '+') return x + y;
        if (op === '-') return x - y;
        if (op === '*') return x * y;
        if (op === '^') return Math.pow(x, y);
        return y === 0 ? E('#DIV/0!') : x / y;
      }
      const c = compare(a, b);
      return { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[op];
    }
    function compare(a, b) {
      if (a === null) a = typeof b === 'number' ? 0 : typeof b === 'boolean' ? false : '';
      if (b === null) b = typeof a === 'number' ? 0 : typeof a === 'boolean' ? false : '';
      const rank = v => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (typeof a === 'string') { a = a.toLowerCase(); b = b.toLowerCase(); }
      return a < b ? -1 : a > b ? 1 : 0;
    }
    function matcher(crit) {
      if (isErr(crit)) return () => false;
      if (typeof crit === 'number' || typeof crit === 'boolean') return v => v === crit;
      const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(String(crit ?? ''));
      const op = m[1] || '=', rhs = m[2];
      if (rhs.trim() !== '' && !isNaN(+rhs)) {
        const n = +rhs;
        if (op === '<>') return v => !(typeof v === 'number' && v === n);
        return v => typeof v === 'number' && binary(op, v, n) === true;
      }
      const re = new RegExp('^' + rhs.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
      if (op === '=') return v => re.test(toText(v)) && !(rhs !== '' && v === null);
      if (op === '<>') return v => !re.test(toText(v));
      return v => typeof v === 'string' && binary(op, v, rhs) === true;
    }
    const cells = v => (v && v.range ? [].concat(...v.range) : [v]);
    function call(n) {
      if (!FUNCS.includes(n.name)) { const e = E('#NAME?'); e.fn = n.raw; return e; }
      const lazy = n.name === 'IF' || n.name === 'IFERROR';
      const args = lazy ? null : n.args.map(evalNode);
      const nums = () => flat(args).filter(v => typeof v === 'number');
      const firstErr = () => flat(args).find(isErr);
      switch (n.name) {
        case 'SUM': return firstErr() || nums().reduce((s, x) => s + x, 0);
        case 'AVERAGE': { const e = firstErr(); if (e) return e; const xs = nums(); return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : E('#DIV/0!'); }
        case 'COUNT': return nums().length;
        case 'COUNTA': return flat(args).filter(v => v !== null && v !== '').length;
        case 'MIN': { const e = firstErr(); if (e) return e; const xs = nums(); return xs.length ? Math.min(...xs) : 0; }
        case 'MAX': { const e = firstErr(); if (e) return e; const xs = nums(); return xs.length ? Math.max(...xs) : 0; }
        case 'ROUND': { const x = toNum(scalar(args[0])), d = toNum(scalar(args[1] ?? 0)); if (isErr(x)) return x; const f = Math.pow(10, d); return Math.round(x * f) / f; }
        case 'TRIM': return toText(scalar(args[0])).trim().replace(/\s+/g, ' ');
        case 'LOWER': return toText(scalar(args[0])).toLowerCase();
        case 'UPPER': return toText(scalar(args[0])).toUpperCase();
        case 'IF': {
          const c = scalar(evalNode(n.args[0]));
          if (isErr(c)) return c;
          const truthy = typeof c === 'string' ? E('#VALUE!') : !!toNum(c);
          if (isErr(truthy)) return truthy;
          return truthy ? scalar(evalNode(n.args[1] || { t: 'lit', v: true })) : (n.args[2] ? scalar(evalNode(n.args[2])) : false);
        }
        case 'IFERROR': { const v = scalar(evalNode(n.args[0])); return isErr(v) ? scalar(evalNode(n.args[1] || { t: 'lit', v: '' })) : v; }
        case 'COUNTIF': { const t = matcher(scalar(args[1])); return cells(args[0]).filter(t).length; }
        case 'SUMIF': {
          const range = cells(args[0]), sums = args[2] ? cells(args[2]) : range, t = matcher(scalar(args[1]));
          return range.reduce((s, v, i) => s + (t(v) && typeof sums[i] === 'number' ? sums[i] : 0), 0);
        }
        case 'COUNTIFS': case 'SUMIFS': {
          const off = n.name === 'SUMIFS' ? 1 : 0;
          const pairs = [];
          for (let i = off; i + 1 < args.length; i += 2) pairs.push([cells(args[i]), matcher(scalar(args[i + 1]))]);
          if (!pairs.length) return E('#VALUE!');
          const len = pairs[0][0].length;
          if (pairs.some(([r]) => r.length !== len)) return E('#VALUE!');
          const sums = off ? cells(args[0]) : null;
          let out = 0;
          for (let i = 0; i < len; i++) if (pairs.every(([r, t]) => t(r[i]))) out += off ? (typeof sums[i] === 'number' ? sums[i] : 0) : 1;
          return out;
        }
        case 'VLOOKUP': {
          const v = scalar(args[0]), tbl = args[1] && args[1].range, col = toNum(scalar(args[2]));
          if (isErr(v)) return v;
          if (!tbl || isErr(col)) return E('#VALUE!');
          if (col < 1 || col > (tbl[0] || []).length) return E('#REF!');
          const approx = args[3] === undefined || args[3] === null ? true : !!toNum(scalar(args[3]));
          if (!approx) { const row = tbl.find(r => compare(r[0], v) === 0 && r[0] !== null); return row ? row[col - 1] ?? 0 : E('#N/A'); }
          let lo = 0, hi = tbl.length - 1, best = -1; // Excel-style binary search: wrong answers on unsorted data
          while (lo <= hi) { const mid = (lo + hi) >> 1; if (tbl[mid][0] !== null && compare(tbl[mid][0], v) <= 0) { best = mid; lo = mid + 1; } else hi = mid - 1; }
          return best === -1 ? E('#N/A') : tbl[best][col - 1] ?? 0;
        }
        case 'XLOOKUP': {
          const v = scalar(args[0]), keys = cells(args[1]), vals = cells(args[2]);
          if (isErr(v)) return v;
          if (keys.length !== vals.length) return E('#VALUE!');
          const i = keys.findIndex(k => k !== null && compare(k, v) === 0);
          if (i !== -1) return vals[i] ?? 0;
          return args[3] !== undefined ? scalar(args[3]) : E('#N/A');
        }
      }
      return E('#NAME?');
    }
    return {
      value: a => { const p = parseAddr(a); return p ? cellValue(p.c, p.r) : E('#REF!'); },
      at: (c, r) => cellValue(c, r),
    };
  }

  /* ---- editing operations ---- */
  // Shifts the relative parts of every reference in a formula (what Excel does when you fill or copy).
  function shift(raw, dr, dc) {
    if (typeof raw !== 'string' || !raw.startsWith('=')) return raw;
    let out = '', i = 0, s = raw;
    while (i < s.length) {
      if (s[i] === '"') { const j = s.indexOf('"', i + 1); const end = j === -1 ? s.length : j + 1; out += s.slice(i, end); i = end; continue; }
      const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/.exec(s.slice(i));
      const prev = i > 0 ? s[i - 1] : '';
      if (m && !/[A-Za-z0-9_.]/.test(prev)) {
        const c = m[1] ? colNum(m[2]) : colNum(m[2]) + dc;
        const r = m[3] ? +m[4] : +m[4] + dr;
        if (c < 1 || r < 1) return '=#REF!';
        out += m[1] + colName(c) + m[3] + r;
        i += m[0].length;
        continue;
      }
      out += s[i++];
    }
    return out;
  }
  function fillDown(sh, from, toRow) {
    const p = parseAddr(from);
    const raw = sh.cells[from];
    for (let r = p.r + 1; r <= toRow; r++) sh.cells[addr(p.c, r)] = shift(raw, r - p.r, 0);
  }
  function sortTable(sh, col, desc) {
    const t = table(sh), ev = evaluator(sh), c = colNum(col);
    const rows = [];
    for (let r = 2; r <= t.rows; r++) rows.push({ key: ev.at(c, r), raws: Array.from({ length: t.cols }, (_, i) => sh.cells[addr(i + 1, r)]) });
    const cmp = (a, b) => {
      const x = a.key, y = b.key;
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      const rank = v => (typeof v === 'number' ? 0 : 1);
      if (rank(x) !== rank(y)) return rank(x) - rank(y);
      const d = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: 'base' });
      return desc ? -d : d;
    };
    rows.sort(cmp);
    rows.forEach((row, i) => row.raws.forEach((raw, j) => { const a = addr(j + 1, i + 2); if (raw == null) delete sh.cells[a]; else sh.cells[a] = raw; }));
  }
  function visibleRows(sh) {
    const t = table(sh), ev = evaluator(sh), out = [];
    for (let r = 2; r <= t.rows; r++) {
      if (sh.filter && toText(ev.at(colNum(sh.filter.col), r)).toLowerCase() !== String(sh.filter.value).toLowerCase()) continue;
      out.push(r);
    }
    return out;
  }
  // Pivot: one row per distinct value of `rows`, aggregating `values` (SUM, COUNT or AVERAGE), A→Z.
  function pivot(sh, cfg) {
    const t = table(sh), ev = evaluator(sh), rc = colNum(cfg.rows), vc = colNum(cfg.values);
    const groups = new Map();
    for (let r = 2; r <= t.rows; r++) {
      const label = toText(ev.at(rc, r));
      const key = label.toLowerCase();
      if (!groups.has(key)) groups.set(key, { label, vals: [] });
      groups.get(key).vals.push(ev.at(vc, r));
    }
    const agg = vals => {
      if (cfg.agg === 'COUNT') return vals.filter(v => v !== null && v !== '').length;
      const xs = vals.filter(v => typeof v === 'number');
      const sum = xs.reduce((s, x) => s + x, 0);
      return cfg.agg === 'AVERAGE' ? (xs.length ? sum / xs.length : 0) : sum;
    };
    const rows = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
      .map(g => ({ label: g.label || '(blank)', value: agg(g.vals) }));
    return { rows, total: agg([].concat(...[...groups.values()].map(g => g.vals))) };
  }
  const headers = sh => { const t = table(sh); return Array.from({ length: t.cols }, (_, i) => ({ col: colName(i + 1), name: toText(parseInput(sh.cells[addr(i + 1, 1)])) })); };

  // Functions used in a formula, canonical names (aliases resolved).
  function functionsIn(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('=')) return [];
    try { return tokenize(raw.slice(1)).filter(t => t.t === 'fn').map(t => canonical(t.v)); } catch (e) { return []; }
  }
  function formulaError(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('=')) return null;
    try { parse(raw.slice(1)); return null; } catch (e) { return e.message; }
  }

  OT.sheet = {
    FUNCS, colNum, colName, addr, parseAddr, rangeCells, isErr, toText, parseInput,
    newSheet, clone, bounds, table, evaluator, shift, fillDown, sortTable, visibleRows, pivot, headers,
    functionsIn, formulaError,
  };
})(typeof window !== 'undefined' ? window : globalThis);
