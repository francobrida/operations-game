/* A tiny MongoDB shell: db.<collection>.find / countDocuments / aggregate, .sort(), .limit().
   Only what the MongoDB track teaches; pure logic, no DOM (tested in Node). */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  const D = OT.data;

  /* ---- collections built from the shared dataset ---- */
  const strip = o => { const out = {}; for (const k of Object.keys(o)) if (o[k] !== undefined) out[k] = o[k]; return out; };
  function collections() {
    const byId = Object.fromEntries(D.artists.map(a => [a.id, a]));
    return {
      payments: D.payments.map(p => strip({ _id: p.id, artist: p.artist, song: p.song, amount: p.amount === null ? undefined : p.amount, payment_date: p.payment_date || undefined })),
      songs: D.songs.map(s => strip({ _id: s.id, title: s.title, plays: s.plays, duration_sec: s.duration_sec,
        artist: byId[s.artist_id] ? { name: byId[s.artist_id].name, country: byId[s.artist_id].country } : undefined })),
      artists: D.artists.map(a => ({ _id: a.id, name: a.name, country: a.country })),
      import_log: D.import_log.map(r => ({ _id: r.id, file: r.file, date: r.date, rows_loaded: r.rows_loaded })),
    };
  }

  /* ---- parser for the shell syntax: JS-like object literals with unquoted keys ---- */
  function parseValue(src, pos) {
    let i = pos;
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const fail = what => { const e = new SyntaxError(what + ' at position ' + (i + 1)); e.pos = i; throw e; };
    function value() {
      ws();
      const c = src[i];
      if (c === '{') {
        i++; const obj = {};
        ws();
        if (src[i] === '}') { i++; return obj; }
        for (;;) {
          ws();
          let key;
          if (src[i] === '"' || src[i] === "'") key = string();
          else { const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i)); if (!m) fail('Expected a field name'); key = m[0]; i += key.length; }
          ws();
          if (src[i] !== ':') fail(src[i] === '.' ? 'A field with a dot must be in quotes' : 'Expected ":" after ' + key);
          i++;
          obj[key] = value();
          ws();
          if (src[i] === ',') { i++; ws(); if (src[i] === '}') { i++; return obj; } continue; }
          if (src[i] === '}') { i++; return obj; }
          fail('Expected "," or "}"');
        }
      }
      if (c === '[') {
        i++; const arr = [];
        ws();
        if (src[i] === ']') { i++; return arr; }
        for (;;) {
          arr.push(value());
          ws();
          if (src[i] === ',') { i++; ws(); if (src[i] === ']') { i++; return arr; } continue; }
          if (src[i] === ']') { i++; return arr; }
          fail('Expected "," or "]"');
        }
      }
      if (c === '"' || c === "'") return string();
      const m = /^-?\d+(\.\d+)?/.exec(src.slice(i));
      if (m) { i += m[0].length; return parseFloat(m[0]); }
      for (const [w, v] of [['true', true], ['false', false], ['null', null]]) {
        if (src.startsWith(w, i) && !/[\w$]/.test(src[i + w.length] || '')) { i += w.length; return v; }
      }
      fail(c === undefined ? 'The query ends too early' : 'Unexpected "' + c + '"');
    }
    function string() {
      const q = src[i++]; let s = '';
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; s += src[i++]; }
      if (src[i] !== q) fail('A text is missing its closing quote');
      i++;
      return s;
    }
    const v = value();
    return { value: v, pos: i };
  }
  function parseArgs(src, pos) { // src[pos] is just after "("
    const args = []; let i = pos;
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    ws();
    if (src[i] === ')') return { args, pos: i + 1 };
    for (;;) {
      const r = parseValue(src, i); args.push(r.value); i = r.pos; ws();
      if (src[i] === ',') { i++; continue; }
      if (src[i] === ')') return { args, pos: i + 1 };
      const e = new SyntaxError((src[i] === undefined ? 'Missing ")"' : 'Expected "," or ")"') + ' at position ' + (i + 1)); throw e;
    }
  }
  function parseCommand(input) {
    const src = input.trim().replace(/;\s*$/, '');
    const head = /^db\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(/.exec(src);
    if (!head) throw new SyntaxError('A query starts like db.payments.find(…)');
    const calls = [];
    let i = head[0].length;
    let r = parseArgs(src, i); calls.push({ name: head[2], args: r.args }); i = r.pos;
    while (i < src.length) {
      while (/\s/.test(src[i])) i++;
      if (i >= src.length) break;
      const m = /^\.\s*([A-Za-z_]\w*)\s*\(/.exec(src.slice(i));
      if (!m) throw new SyntaxError('Unexpected "' + src[i] + '" at position ' + (i + 1));
      i += m[0].length;
      r = parseArgs(src, i); calls.push({ name: m[1], args: r.args }); i = r.pos;
    }
    return { collection: head[1], calls };
  }

  /* ---- query engine ---- */
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const get = (doc, path) => path.split('.').reduce((v, k) => (isObj(v) ? v[k] : undefined), doc);
  const OPS = ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists'];
  function cmp(a, b) {
    if (typeof a !== typeof b || a === null || b === null) return null;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function matches(doc, filter) {
    for (const key of Object.keys(filter || {})) {
      const cond = filter[key];
      if (key === '$and') { if (!cond.every(f => matches(doc, f))) return false; continue; }
      if (key === '$or') { if (!cond.some(f => matches(doc, f))) return false; continue; }
      if (key.startsWith('$')) throw new Error('unknown top level operator: ' + key);
      const v = get(doc, key);
      if (isObj(cond) && Object.keys(cond).length && Object.keys(cond).every(k => k.startsWith('$'))) {
        for (const op of Object.keys(cond)) {
          const x = cond[op];
          if (!OPS.includes(op)) throw new Error('unknown operator: ' + op);
          const c = cmp(v, x);
          const ok = op === '$eq' ? (same(v, x) || (x === null && v === undefined))
            : op === '$ne' ? !(same(v, x) || (x === null && v === undefined))
            : op === '$in' ? x.some(y => same(v, y)) : op === '$nin' ? !x.some(y => same(v, y))
            : op === '$exists' ? (v !== undefined) === !!x
            : c !== null && ({ $gt: c > 0, $gte: c >= 0, $lt: c < 0, $lte: c <= 0 })[op];
          if (!ok) return false;
        }
      } else if (!(same(v, cond) || (cond === null && v === undefined))) return false;
    }
    return true;
  }
  function project(docs, proj) {
    const keys = Object.keys(proj || {});
    if (!keys.length) return docs;
    const nonId = keys.filter(k => k !== '_id');
    const incl = nonId.filter(k => proj[k]), excl = nonId.filter(k => !proj[k]);
    if (incl.length && excl.length) throw new Error('Cannot do exclusion on field ' + excl[0] + ' in inclusion projection');
    return docs.map(d => {
      let out;
      if (incl.length) {
        out = {};
        if (proj._id !== 0 && proj._id !== false && d._id !== undefined) out._id = d._id;
        for (const k of incl) { const v = get(d, k); if (v !== undefined) setPath(out, k, v); }
      } else {
        out = JSON.parse(JSON.stringify(d));
        for (const k of excl.concat(proj._id === 0 || proj._id === false ? ['_id'] : [])) delete out[k];
      }
      return out;
    });
  }
  function setPath(o, path, v) { const ks = path.split('.'); let cur = o; ks.slice(0, -1).forEach(k => { cur = cur[k] = cur[k] || {}; }); cur[ks[ks.length - 1]] = v; }
  function sortDocs(docs, spec) {
    const keys = Object.keys(spec || {});
    const rank = v => (v === undefined || v === null ? 0 : typeof v === 'number' ? 1 : 2);
    return docs.slice().sort((a, b) => {
      for (const k of keys) {
        const x = get(a, k), y = get(b, k);
        let d = rank(x) - rank(y);
        if (!d && rank(x)) d = x < y ? -1 : x > y ? 1 : 0;
        if (d) return spec[k] < 0 ? -d : d;
      }
      return 0;
    });
  }
  function expr(doc, e) {
    if (typeof e === 'string' && e.startsWith('$')) return get(doc, e.slice(1));
    if (isObj(e)) { const o = {}; for (const k of Object.keys(e)) o[k] = expr(doc, e[k]); return o; }
    return e;
  }
  function group(docs, spec) {
    if (!('_id' in spec)) throw new Error("a group specification must include an _id");
    const groups = new Map();
    for (const d of docs) {
      const id = expr(d, spec._id);
      const k = JSON.stringify(id === undefined ? null : id);
      if (!groups.has(k)) groups.set(k, { _id: id === undefined ? null : id, docs: [] });
      groups.get(k).docs.push(d);
    }
    return [...groups.values()].map(g => {
      const out = { _id: g._id };
      for (const f of Object.keys(spec)) {
        if (f === '_id') continue;
        const acc = spec[f];
        if (!isObj(acc) || Object.keys(acc).length !== 1) throw new Error('the field ' + f + ' must be an accumulator object, like { $sum: "$amount" }');
        const op = Object.keys(acc)[0], vals = g.docs.map(d => expr(d, acc[op])).filter(v => typeof v === 'number');
        if (op === '$sum') out[f] = vals.reduce((s, x) => s + x, 0);
        else if (op === '$avg') out[f] = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
        else if (op === '$min') out[f] = vals.length ? Math.min(...vals) : null;
        else if (op === '$max') out[f] = vals.length ? Math.max(...vals) : null;
        else throw new Error('unknown group operator: ' + op);
      }
      return out;
    });
  }
  function aggregate(docs, pipeline) {
    if (!Array.isArray(pipeline)) throw new Error('aggregate() takes a list of stages: [ { $match: … }, { $group: … } ]');
    let cur = docs;
    for (const stage of pipeline) {
      const name = Object.keys(stage || {})[0];
      const arg = stage[name];
      if (name === '$match') cur = cur.filter(d => matches(d, arg));
      else if (name === '$group') cur = group(cur, arg);
      else if (name === '$sort') cur = sortDocs(cur, arg);
      else if (name === '$limit') cur = cur.slice(0, arg);
      else if (name === '$project') cur = project(cur, arg);
      else throw new Error("Unrecognized pipeline stage name: '" + name + "'");
    }
    return cur;
  }

  // Runs one shell command. Returns { docs } or { count } or { error }, plus a warning for unknown collections.
  function run(input) {
    let cmd;
    try { cmd = parseCommand(input); } catch (e) { return { error: e.message, parse: true }; }
    const cols = collections();
    const docs = cols[cmd.collection];
    const warning = docs ? null : 'There is no collection called "' + cmd.collection + '" (collections: ' + Object.keys(cols).join(', ') + ').';
    let cur = docs || [], count = null;
    try {
      for (const [i, c] of cmd.calls.entries()) {
        if (i === 0) {
          if (c.name === 'find') cur = project(cur.filter(d => matches(d, c.args[0] || {})), c.args[1]);
          else if (c.name === 'findOne') cur = project(cur.filter(d => matches(d, c.args[0] || {})).slice(0, 1), c.args[1]);
          else if (c.name === 'countDocuments') count = cur.filter(d => matches(d, c.args[0] || {})).length;
          else if (c.name === 'aggregate') cur = aggregate(cur, c.args[0]);
          else throw new Error('db.' + cmd.collection + '.' + c.name + ' is not a function');
        } else if (count === null && c.name === 'sort') cur = sortDocs(cur, c.args[0]);
        else if (count === null && c.name === 'limit') cur = cur.slice(0, c.args[0]);
        else if (c.name === 'count' && count === null) count = cur.length;
        else throw new Error('.' + c.name + '() is not available here');
      }
    } catch (e) { return { error: e.message, warning }; }
    return count !== null ? { count, warning } : { docs: cur, warning };
  }

  /* ---- display like mongosh ---- */
  function show(v, indent) {
    indent = indent || '';
    if (v === null) return 'null';
    if (typeof v === 'string') return "'" + v + "'";
    if (typeof v !== 'object') return String(v);
    const keys = Object.keys(v);
    if (!keys.length) return '{}';
    const inner = keys.map(k => indent + '  ' + (/^[A-Za-z_$][\w$]*$/.test(k) ? k : "'" + k + "'") + ': ' + show(v[k], indent + '  '));
    return '{\n' + inner.join(',\n') + '\n' + indent + '}';
  }

  /* ---- comparison: documents as multisets of their values (names too when asked) ---- */
  function leaves(v, path, out) {
    if (isObj(v)) { for (const k of Object.keys(v)) leaves(v[k], path ? path + '.' + k : k, out); }
    else out.push([path, typeof v === 'number' ? String(Math.round(v * 100) / 100) : JSON.stringify(v)]);
    return out;
  }
  const docKey = (d, names) => leaves(d, '', []).map(([p, v]) => (names ? p + '=' : '') + v).sort().join('|');
  function compare(user, exp, opts) {
    opts = opts || {};
    if (user.error) return { ok: false, kind: 'error' };
    if (exp.count !== undefined && exp.count !== null) {
      if (user.count === undefined || user.count === null) return { ok: false, kind: 'wantCount' };
      return user.count === exp.count ? { ok: true } : { ok: false, kind: 'countValue' };
    }
    if (!user.docs) return { ok: false, kind: 'wantDocs' };
    if (user.docs.length !== exp.docs.length) return { ok: false, kind: 'docs', got: user.docs.length, want: exp.docs.length };
    const fields = d => leaves(d, '', []).length;
    const uf = user.docs.length ? fields(user.docs[0]) : 0, ef = exp.docs.length ? fields(exp.docs[0]) : 0;
    if (uf !== ef) return { ok: false, kind: 'fields', got: uf, want: ef };
    const u = user.docs.map(d => docKey(d, opts.names)), e = exp.docs.map(d => docKey(d, opts.names));
    if (u.slice().sort().join('\n') !== e.slice().sort().join('\n')) return { ok: false, kind: opts.names && sameValues(user.docs, exp.docs) ? 'names' : 'values' };
    if (opts.ordered && u.join('\n') !== e.join('\n')) return { ok: false, kind: 'order' };
    return { ok: true };
  }
  const sameValues = (a, b) => a.map(d => docKey(d, false)).sort().join('\n') === b.map(d => docKey(d, false)).sort().join('\n');

  OT.mongo = { collections, parseCommand, run, show, compare };
})(typeof window !== 'undefined' ? window : globalThis);
