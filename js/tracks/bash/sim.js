/* Fake filesystem + mini Bash interpreter. Pure logic, no DOM (tested in Node). */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  const D = OT.data;

  function f(content, exec) { return { type: 'file', content, exec: !!exec }; }
  function dir(children) { return { type: 'dir', children }; }
  const FAKE_DATE = D.storyDate;

  function makeWorld() {
    const logs = {};
    for (const name of Object.keys(D.logs)) logs[name] = f(D.logs[name]);
    return dir({
      'notes.txt': f('Buy milk\nCall Sam\n'),
      'old.log': f('2023-01-01 startup ok\n'),
      'readme.txt': f('Welcome to the team drive!\nEverything you need is somewhere in here.\n'),
      'run.sh': f('#!/bin/bash\necho "Deploy complete."\n'),
      'setup.sh': f('#!/bin/bash\necho "Setup done."\n'),
      'cleanup.sh': f('#!/bin/bash\necho "Cleanup done."\n'),
      'log.txt': f('System boot at 08:00\n'),
      'photos': dir({
        'beach.jpg': f('[binary]'),
        '2024_trip.jpg': f('[binary]'),
      }),
      'notes': dir({
        'todo.txt': f('finish onboarding\nask about parking\n'),
      }),
      'reports': dir({
        'q1.txt': f('Q1 was steady. invoice #221 attached separately.\n'),
        'q2.txt': f('Q2 numbers pending. Urgent: chase Vendor.\n'),
        'alerts.txt': f('URGENT: renew the vendor contract by Friday.\n'),
        'archive': dir({
          'budget.csv': f('month,amount\njan,200\nfeb,180\n'),
        }),
      }),
      'logs': dir(logs),
      'exports': dir({
        'payments.csv': f(D.toCSV('payments')),
        'artists.csv': f(D.toCSV('artists')),
        'songs.csv': f(D.toCSV('songs')),
        'import_log.csv': f(D.toCSV('import_log')),
      }),
      'scripts': dir({
        'check_logs.sh': f('#!/bin/bash\necho "Error count per log:"\ngrep -rc ERROR logs\n'),
      }),
    });
  }

  function freshState() { return { fs: makeWorld(), cwd: [], env: {} }; }
  function cloneState(st) {
    return { fs: JSON.parse(JSON.stringify(st.fs)), cwd: st.cwd.slice(), env: Object.assign({}, st.env) };
  }

  /* ---- paths ---- */
  function resolvePath(cwd, pathStr) {
    if (pathStr == null) pathStr = '.';
    const segs = (pathStr.startsWith('/') || pathStr === '~' || pathStr.startsWith('~/')) ? [] : cwd.slice();
    const rest = pathStr.replace(/^~\/?/, '').replace(/^\/+/, '');
    for (const part of rest.split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') { segs.pop(); continue; }
      segs.push(part);
    }
    return segs;
  }
  function getNode(fs, segs) {
    let node = fs;
    for (const s of segs) {
      if (!node || node.type !== 'dir' || !node.children[s]) return null;
      node = node.children[s];
    }
    return node;
  }
  function getParent(fs, segs) { return segs.length ? getNode(fs, segs.slice(0, -1)) : null; }
  function basename(segs) { return segs[segs.length - 1] || ''; }
  function displayPath(cwd) { return '/home/yury' + (cwd.length ? '/' + cwd.join('/') : ''); }
  function promptPath(cwd) { return cwd.length ? '~/' + cwd.join('/') : '~'; }

  function walkAll(node, prefix) {
    let out = [];
    for (const name of Object.keys(node.children).sort()) {
      const child = node.children[name];
      const p = prefix.concat([name]);
      out.push({ segs: p, node: child });
      if (child.type === 'dir') out = out.concat(walkAll(child, p));
    }
    return out;
  }
  function globToRegex(glob) {
    const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp('^' + esc + '$');
  }
  function contentLines(content) {
    if (!content) return [];
    const s = content.endsWith('\n') ? content.slice(0, -1) : content;
    return s.split('\n');
  }

  /* ---- parsing ---- */
  function scanTopLevel(str) {
    const res = []; let q = null; let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (q) { if (c === q) q = null; continue; }
      if (depth > 0) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
        continue;
      }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '$' && str[i + 1] === '(') { depth = 1; i++; continue; }
      if (c === '|') { res.push({ i, tok: '|' }); continue; }
      if (c === ';') { res.push({ i, tok: ';' }); continue; }
      if (c === '>') {
        if (str[i + 1] === '>') { res.push({ i, tok: '>>' }); i++; } else res.push({ i, tok: '>' });
      }
    }
    return res;
  }
  function tokenize(str) {
    const tokens = []; let cur = ''; let q = null; let has = false; let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (q) { if (c === q) { q = null; } else { cur += c; } continue; }
      if (depth > 0) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
        cur += c; has = true;
        continue;
      }
      if (c === '"' || c === "'") { q = c; has = true; continue; }
      if (c === '$' && str[i + 1] === '(') { cur += '$('; has = true; i++; depth = 1; continue; }
      if (/\s/.test(c)) { if (has || cur.length) { tokens.push(cur); cur = ''; has = false; } continue; }
      cur += c; has = true;
    }
    if (q) throw new Error('unclosed quote');
    if (has || cur.length) tokens.push(cur);
    return tokens;
  }
  function splitByIndices(str, indices) {
    const parts = []; let start = 0;
    for (const idx of indices) { parts.push(str.slice(start, idx)); start = idx + 1; }
    parts.push(str.slice(start));
    return parts;
  }
  function parseStatement(stmt) {
    const marks = scanTopLevel(stmt);
    const redirMark = marks.find(m => m.tok === '>' || m.tok === '>>');
    let body = stmt, redir = null;
    if (redirMark) {
      const targetRaw = stmt.slice(redirMark.i + redirMark.tok.length);
      redir = { append: redirMark.tok === '>>', target: tokenize(targetRaw)[0] };
      body = stmt.slice(0, redirMark.i);
    }
    const pipeIdx = scanTopLevel(body).filter(m => m.tok === '|').map(m => m.i);
    const stages = splitByIndices(body, pipeIdx).map(tokenize).filter(s => s.length);
    return { stages, redir };
  }
  function parseInput(raw) {
    const semiIdx = scanTopLevel(raw).filter(m => m.tok === ';').map(m => m.i);
    return splitByIndices(raw, semiIdx).map(s => s.trim()).filter(Boolean).map(parseStatement);
  }

  /* ---- commands ---- */
  function readFileArg(fs, cwd, target) {
    const node = getNode(fs, resolvePath(cwd, target));
    if (!node) return { error: `${target}: No such file or directory` };
    if (node.type === 'dir') return { error: `${target}: Is a directory` };
    return { content: node.content };
  }
  // Lines from the named files, or from the pipe when there are none.
  function inputLines(files, ctx, cmd) {
    if (files.length === 0) return { lines: ctx.stdin || [] };
    let all = [];
    for (const t of files) {
      const r = readFileArg(ctx.fs, ctx.cwd, t);
      if (r.error) return { error: `${cmd}: ${r.error}` };
      all = all.concat(contentLines(r.content));
    }
    return { lines: all };
  }
  const isFlag = x => /^-[a-zA-Z]+$/.test(x);

  function cmd_pwd(a, ctx) { return { stdout: displayPath(ctx.cwd) }; }
  function cmd_ls(a, ctx) {
    const target = a.filter(x => !x.startsWith('-'))[0];
    const segs = resolvePath(ctx.cwd, target || '.');
    const node = getNode(ctx.fs, segs);
    if (!node) return { error: `ls: cannot access '${target}': No such file or directory` };
    if (node.type === 'file') return { stdout: basename(segs) };
    const names = Object.keys(node.children).sort();
    return { stdout: names.map(n => node.children[n].type === 'dir' ? n + '/' : n).join('\n') };
  }
  function cmd_cd(a, ctx) {
    const target = a.filter(x => !x.startsWith('-'))[0];
    const segs = target ? resolvePath(ctx.cwd, target) : [];
    const node = getNode(ctx.fs, segs);
    if (!node) return { error: `bash: cd: ${target}: No such file or directory` };
    if (node.type !== 'dir') return { error: `bash: cd: ${target}: Not a directory` };
    return { stdout: '', cwdNew: segs };
  }
  function cmd_mkdir(a, ctx) {
    const target = a.filter(x => !x.startsWith('-'))[0];
    if (!target) return { error: 'mkdir: missing operand' };
    const segs = resolvePath(ctx.cwd, target);
    const parent = getParent(ctx.fs, segs); const name = basename(segs);
    if (!parent || parent.type !== 'dir') return { error: `mkdir: cannot create directory '${target}': No such file or directory` };
    if (parent.children[name]) return { error: `mkdir: cannot create directory '${target}': File exists` };
    parent.children[name] = dir({});
    return { stdout: '' };
  }
  function cmd_touch(a, ctx) {
    const target = a.filter(x => !x.startsWith('-'))[0];
    if (!target) return { error: 'touch: missing file operand' };
    const segs = resolvePath(ctx.cwd, target);
    const parent = getParent(ctx.fs, segs); const name = basename(segs);
    if (!parent || parent.type !== 'dir') return { error: `touch: cannot touch '${target}': No such file or directory` };
    if (!parent.children[name]) parent.children[name] = f('');
    return { stdout: '' };
  }
  function copyOrMove(a, ctx, cmd) {
    const [src, dstArg] = a.filter(x => !x.startsWith('-'));
    if (!src || !dstArg) return { error: `${cmd}: missing file operand` };
    const srcSegs = resolvePath(ctx.cwd, src);
    const srcNode = getNode(ctx.fs, srcSegs);
    if (!srcNode) return { error: `${cmd}: cannot stat '${src}': No such file or directory` };
    if (cmd === 'cp' && srcNode.type === 'dir') return { error: `cp: -r not specified; omitting directory '${src}'` };
    let dstSegs = resolvePath(ctx.cwd, dstArg);
    const dstNode = getNode(ctx.fs, dstSegs);
    if (dstNode && dstNode.type === 'dir') dstSegs = dstSegs.concat([basename(srcSegs)]);
    const parent = getParent(ctx.fs, dstSegs);
    if (!parent || parent.type !== 'dir') return { error: `${cmd}: cannot create '${dstArg}': No such file or directory` };
    if (cmd === 'cp') {
      parent.children[basename(dstSegs)] = f(srcNode.content, srcNode.exec);
    } else {
      parent.children[basename(dstSegs)] = srcNode;
      delete getParent(ctx.fs, srcSegs).children[basename(srcSegs)];
    }
    return { stdout: '' };
  }
  function cmd_rm(a, ctx) {
    const flags = a.filter(x => x.startsWith('-')).join('');
    const target = a.filter(x => !x.startsWith('-'))[0];
    if (!target) return { error: 'rm: missing operand' };
    const segs = resolvePath(ctx.cwd, target);
    const node = getNode(ctx.fs, segs);
    if (!node) return { error: `rm: cannot remove '${target}': No such file or directory` };
    if (node.type === 'dir' && !flags.includes('r')) return { error: `rm: cannot remove '${target}': Is a directory` };
    delete getParent(ctx.fs, segs).children[basename(segs)];
    return { stdout: '' };
  }
  function cmd_cat(a, ctx) {
    const targets = a.filter(x => !x.startsWith('-'));
    if (targets.length === 0) {
      if (ctx.stdin) return { stdout: ctx.stdin.join('\n') };
      return { error: 'cat: missing operand' };
    }
    const parts = [];
    for (const t of targets) {
      const r = readFileArg(ctx.fs, ctx.cwd, t);
      if (r.error) return { error: `cat: ${r.error}` };
      parts.push(r.content.replace(/\n$/, ''));
    }
    return { stdout: parts.join('\n') };
  }
  function matchPattern(line, pattern, insensitive) {
    return insensitive ? line.toLowerCase().includes(pattern.toLowerCase()) : line.includes(pattern);
  }
  function cmd_grep(a, ctx) {
    let flags = ''; const rest = [];
    for (const x of a) { if (isFlag(x)) flags += x.slice(1); else rest.push(x); }
    const recursive = /[rR]/.test(flags), insensitive = flags.includes('i');
    const countOnly = flags.includes('c'), numbered = flags.includes('n');
    const pattern = rest[0];
    let fileArgs = rest.slice(1);
    if (pattern === undefined) return { error: 'grep: missing pattern' };
    const sources = []; let dirArg = false;
    if (fileArgs.length === 0 && recursive) fileArgs = ['.'];
    if (fileArgs.length === 0) {
      sources.push({ label: null, lines: ctx.stdin || [] });
    }
    for (const fa of fileArgs) {
      if (fa.includes('*') || fa.includes('?')) {
        const cwdNode = getNode(ctx.fs, ctx.cwd);
        const re = globToRegex(fa);
        for (const name of Object.keys(cwdNode.children).sort()) {
          const child = cwdNode.children[name];
          if (child.type === 'file' && re.test(name)) sources.push({ label: name, lines: contentLines(child.content) });
        }
        continue;
      }
      const node = getNode(ctx.fs, resolvePath(ctx.cwd, fa));
      if (!node) return { error: `grep: ${fa}: No such file or directory` };
      if (node.type === 'dir') {
        if (!recursive) return { error: `grep: ${fa}: Is a directory` };
        dirArg = true;
        const prefix = fa.replace(/\/+$/, '');
        for (const entry of walkAll(node, [])) {
          if (entry.node.type === 'file') sources.push({ label: prefix + '/' + entry.segs.join('/'), lines: contentLines(entry.node.content) });
        }
      } else {
        sources.push({ label: fa, lines: contentLines(node.content) });
      }
    }
    const multi = sources.length > 1 || dirArg;
    const out = [];
    for (const src of sources) {
      const head = multi && src.label ? src.label + ':' : '';
      let count = 0;
      src.lines.forEach((text, idx) => {
        if (!matchPattern(text, pattern, insensitive)) return;
        count++;
        if (!countOnly) out.push(head + (numbered ? (idx + 1) + ':' : '') + text);
      });
      if (countOnly) out.push(head + count);
    }
    return { stdout: out.join('\n') };
  }
  function cmd_find(a, ctx) {
    let path = '.', rest = a;
    if (a.length && a[0] !== '-name') { path = a[0]; rest = a.slice(1); }
    const nameIdx = rest.indexOf('-name');
    if (nameIdx === -1 || rest[nameIdx + 1] === undefined) return { error: 'find: missing -name pattern' };
    const startNode = getNode(ctx.fs, resolvePath(ctx.cwd, path));
    if (!startNode) return { error: `find: '${path}': No such file or directory` };
    const re = globToRegex(rest[nameIdx + 1]);
    const results = [];
    for (const entry of walkAll(startNode, [])) {
      if (re.test(basename(entry.segs))) results.push(path.replace(/\/$/, '') + '/' + entry.segs.join('/'));
    }
    return { stdout: results.join('\n') };
  }
  function cmd_chmod(a, ctx) {
    const [mode, target] = a;
    if (!mode || !target) return { error: 'chmod: missing operand' };
    const node = getNode(ctx.fs, resolvePath(ctx.cwd, target));
    if (!node) return { error: `chmod: cannot access '${target}': No such file or directory` };
    let setExec = null;
    if (mode.includes('+x')) setExec = true;
    else if (mode.includes('-x')) setExec = false;
    else if (/^[0-7]{3}$/.test(mode)) setExec = [...mode].some(d => parseInt(d, 8) % 2 === 1);
    if (setExec === null) return { error: `chmod: invalid mode: '${mode}'` };
    node.exec = setExec;
    return { stdout: '' };
  }
  function cmd_export(a, ctx) {
    const m = (a[0] || '').match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) return { error: 'export: usage: export NAME=value' };
    ctx.env[m[1]] = m[2];
    return { stdout: '' };
  }
  function cmd_echo(a) { return { stdout: a.join(' ') }; }

  function countLines(content) { return contentLines(content).length; }
  function cmd_wc(a, ctx) {
    const targets = a.filter(x => !x.startsWith('-'));
    if (targets.length === 0) return { stdout: String((ctx.stdin || []).length) };
    let total = 0;
    for (const t of targets) {
      const r = readFileArg(ctx.fs, ctx.cwd, t);
      if (r.error) return { error: `wc: ${r.error}` };
      total += countLines(r.content);
    }
    return { stdout: targets.length === 1 ? total + ' ' + targets[0] : total + ' total' };
  }
  function cmd_date(a) {
    const fmt = a[0];
    if (fmt && fmt.startsWith('+')) {
      return { stdout: fmt.slice(1)
        .replace(/%F/g, FAKE_DATE)
        .replace(/%Y/g, FAKE_DATE.slice(0, 4))
        .replace(/%m/g, FAKE_DATE.slice(5, 7))
        .replace(/%d/g, FAKE_DATE.slice(8, 10)) };
    }
    return { stdout: FAKE_DATE };
  }
  function cmd_sort(a, ctx) {
    const flags = a.filter(isFlag).join('');
    const r = inputLines(a.filter(x => !x.startsWith('-')), ctx, 'sort');
    if (r.error) return r;
    const numeric = flags.includes('n');
    const lead = s => { const m = s.trim().match(/^-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; };
    const sorted = r.lines.slice().sort((x, y) => {
      if (numeric) { const d = lead(x) - lead(y); if (d) return d; }
      return x < y ? -1 : x > y ? 1 : 0;
    });
    if (flags.includes('r')) sorted.reverse();
    return { stdout: sorted.join('\n') };
  }
  function cmd_uniq(a, ctx) {
    const withCount = a.filter(isFlag).join('').includes('c');
    const r = inputLines(a.filter(x => !x.startsWith('-')), ctx, 'uniq');
    if (r.error) return r;
    const out = []; let prev = null, n = 0;
    const flush = () => { if (prev !== null) out.push(withCount ? String(n).padStart(7) + ' ' + prev : prev); };
    for (const line of r.lines) {
      if (line === prev) { n++; continue; }
      flush(); prev = line; n = 1;
    }
    flush();
    return { stdout: out.join('\n') };
  }
  function cmd_cut(a, ctx) {
    let delim = '\t', fields = null; const files = [];
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (x === '-d') delim = a[++i] ?? '';
      else if (x.startsWith('-d')) delim = x.slice(2);
      else if (x === '-f') fields = a[++i];
      else if (x.startsWith('-f')) fields = x.slice(2);
      else if (x.startsWith('-') && x.length > 1) return { error: `cut: invalid option -- '${x.slice(1)}'` };
      else files.push(x);
    }
    if (!fields) return { error: 'cut: you must specify a list of bytes, characters, or fields' };
    if (delim.length !== 1) return { error: 'cut: the delimiter must be a single character' };
    const ranges = [];
    for (const part of fields.split(',')) {
      const m = part.match(/^(\d*)(-?)(\d*)$/);
      if (!m || (!m[1] && !m[3])) return { error: `cut: invalid field value '${part}'` };
      const from = m[1] ? +m[1] : 1;
      const to = m[2] ? (m[3] ? +m[3] : Infinity) : from;
      ranges.push([from, to]);
    }
    const r = inputLines(files, ctx, 'cut');
    if (r.error) return r;
    const out = r.lines.map(line => {
      if (!line.includes(delim)) return line;
      const parts = line.split(delim);
      return parts.filter((_, i) => ranges.some(([lo, hi]) => i + 1 >= lo && i + 1 <= hi)).join(delim);
    });
    return { stdout: out.join('\n') };
  }
  function lineCountArg(a) {
    let n = 10, fromStart = false; const files = [];
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      const v = x === '-n' ? a[++i] : /^-n.+/.test(x) ? x.slice(2) : /^-\d+$/.test(x) ? x.slice(1) : null;
      if (v !== null) { fromStart = String(v).startsWith('+'); n = parseInt(v, 10); }
      else if (!x.startsWith('-')) files.push(x);
    }
    return { n: Number.isFinite(n) ? Math.abs(n) : 10, fromStart, files };
  }
  function cmd_head(a, ctx) {
    const o = lineCountArg(a);
    const r = inputLines(o.files, ctx, 'head');
    if (r.error) return r;
    return { stdout: r.lines.slice(0, o.n).join('\n') };
  }
  function cmd_tail(a, ctx) {
    const o = lineCountArg(a);
    const r = inputLines(o.files, ctx, 'tail');
    if (r.error) return r;
    const lines = o.fromStart ? r.lines.slice(Math.max(o.n - 1, 0)) : r.lines.slice(Math.max(r.lines.length - o.n, 0));
    return { stdout: lines.join('\n') };
  }

  const BUILTINS = {
    pwd: cmd_pwd, ls: cmd_ls, cd: cmd_cd, mkdir: cmd_mkdir, touch: cmd_touch,
    cp: (a, c) => copyOrMove(a, c, 'cp'), mv: (a, c) => copyOrMove(a, c, 'mv'), rm: cmd_rm,
    cat: cmd_cat, less: cmd_cat, grep: cmd_grep, find: cmd_find, chmod: cmd_chmod,
    export: cmd_export, echo: cmd_echo, wc: cmd_wc, date: cmd_date,
    sort: cmd_sort, uniq: cmd_uniq, cut: cmd_cut, head: cmd_head, tail: cmd_tail,
  };

  /* ---- expansion & execution ---- */
  function runSub(cmdStr, ctx) {
    try {
      const r = execStatements(parseInput(cmdStr), { fs: ctx.fs, cwd: ctx.cwd, env: ctx.env });
      return (r.stdout || '').trim();
    } catch (e) { return ''; }
  }
  function expandToken(tok, ctx) {
    let out = ''; let i = 0;
    while (i < tok.length) {
      if (tok[i] === '$' && tok[i + 1] === '(') {
        let depth = 1, j = i + 2;
        while (j < tok.length && depth > 0) {
          if (tok[j] === '(') depth++;
          else if (tok[j] === ')') depth--;
          j++;
        }
        out += runSub(tok.slice(i + 2, j - 1), ctx);
        i = j;
      } else if (tok[i] === '$' && /[A-Za-z_]/.test(tok[i + 1] || '')) {
        let j = i + 1;
        while (j < tok.length && /[A-Za-z0-9_]/.test(tok[j])) j++;
        out += ctx.env[tok.slice(i + 1, j)] ?? '';
        i = j;
      } else { out += tok[i]; i++; }
    }
    return out;
  }
  function runScript(content, ctx) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const outputs = [];
    for (const line of lines) {
      const r = execStatements(parseInput(line), ctx);
      if (r.error) return r;
      if (r.stdout) outputs.push(r.stdout);
    }
    return { stdout: outputs.join('\n') };
  }
  function dispatch(argv, ctx) {
    const cmdName = argv[0], args = argv.slice(1);
    if (cmdName.startsWith('./') || cmdName.startsWith('../') || cmdName.startsWith('/')) {
      const node = getNode(ctx.fs, resolvePath(ctx.cwd, cmdName));
      if (!node) return { error: `bash: ${cmdName}: No such file or directory` };
      if (node.type === 'dir') return { error: `bash: ${cmdName}: Is a directory` };
      if (!node.exec) return { error: `bash: ${cmdName}: Permission denied` };
      return runScript(node.content, ctx);
    }
    if (cmdName === 'bash' || cmdName === 'sh') {
      const node = getNode(ctx.fs, resolvePath(ctx.cwd, args[0]));
      if (!node || node.type !== 'file') return { error: `${cmdName}: ${args[0]}: No such file or directory` };
      return runScript(node.content, ctx);
    }
    if (BUILTINS[cmdName]) return BUILTINS[cmdName](args, ctx);
    return { error: `${cmdName}: command not found` };
  }
  function execOneStatement(parsed, ctx) {
    let stdin = null, out = '', err = null;
    for (const rawArgv of parsed.stages) {
      const argv = rawArgv.map(t => expandToken(t, ctx));
      const res = dispatch(argv, Object.assign({}, ctx, { stdin }));
      if (res.error) { err = res.error; out = ''; break; }
      if (res.cwdNew) ctx.cwd = res.cwdNew;
      out = res.stdout ?? '';
      stdin = out === '' ? [] : out.split('\n');
    }
    if (!err && parsed.redir) {
      const target = parsed.redir.target === undefined ? '' : expandToken(parsed.redir.target, ctx);
      const segs = resolvePath(ctx.cwd, target);
      const parent = getParent(ctx.fs, segs);
      if (!target) {
        err = 'bash: syntax error near unexpected token `newline\'';
      } else if (!parent || parent.type !== 'dir') {
        err = `bash: ${target}: No such file or directory`;
      } else {
        const name = basename(segs);
        const existing = parent.children[name];
        const newContent = out + (out.length ? '\n' : '');
        parent.children[name] = (parsed.redir.append && existing && existing.type === 'file')
          ? f(existing.content + newContent) : f(newContent);
        out = '';
      }
    }
    return { stdout: err ? '' : out, error: err };
  }
  function execStatements(statements, ctx) {
    const outs = [];
    for (const st of statements) {
      const r = execOneStatement(st, ctx);
      if (r.error) return { stdout: outs.join('\n'), error: r.error };
      if (r.stdout) outs.push(r.stdout);
    }
    return { stdout: outs.join('\n'), error: null };
  }
  function runLine(raw, state) {
    let statements;
    try { statements = parseInput(raw); } catch (e) { return { stdout: '', error: 'bash: syntax error: unexpected end of file (unclosed quote?)' }; }
    if (!statements.length) return { stdout: '', error: null };
    const ctx = { fs: state.fs, cwd: state.cwd, env: state.env };
    const r = execStatements(statements, ctx);
    state.cwd = ctx.cwd;
    return r;
  }

  OT.bashSim = {
    FAKE_DATE, BUILTINS, f, dir, makeWorld, freshState, cloneState,
    resolvePath, getNode, walkAll, basename, displayPath, promptPath, contentLines,
    parseInput, tokenize, runLine,
  };
})(typeof window !== 'undefined' ? window : globalThis);
