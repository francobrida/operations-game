/* The Python side of the Python track: runs the player's code and the mission tests.
   Shared by the browser (Pyodide in a worker) and the Node tests (local CPython). */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};
  OT.pyHarness = String.raw`
import ast, builtins, csv, io, json, os, sys, tempfile, traceback

def _no_input(*a, **k):
    raise RuntimeError("input() is not available here: put the values directly in your code")

class _Fail(AssertionError):
    pass

def _user_error(e):
    tb = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == 'main.py']
    line = tb[-1].lineno if tb else getattr(e, 'lineno', None)
    return {'type': type(e).__name__, 'msg': str(e), 'line': line}

def _make_helpers(ns, out, tree, files):
    def var(name):
        if name not in ns:
            raise _Fail(f"There is no variable called {name}")
        return ns[name]
    def call(fname, *args):
        f = ns.get(fname)
        if not callable(f):
            raise _Fail(f"There is no function called {fname}")
        buf = io.StringIO(); old = sys.stdout; sys.stdout = buf
        try:
            res = f(*args)
        except Exception as e:
            raise _Fail(f"{fname}({', '.join(repr(a) for a in args)}) crashed: {type(e).__name__}: {e}")
        finally:
            sys.stdout = old
        if res is None and buf.getvalue().strip():
            raise _Fail(f"{fname} printed its answer but returned None: use return instead of print")
        return res
    def uses(kind):
        return any(type(n).__name__ == kind for n in ast.walk(tree))
    def calls(name):
        return any(isinstance(n, ast.Call) and getattr(n.func, 'id', getattr(n.func, 'attr', None)) == name for n in ast.walk(tree))
    def lines(text=None):
        return [l.strip() for l in (out if text is None else text).splitlines() if l.strip()]
    def read(path):
        return open(path, encoding='utf-8').read() if os.path.exists(path) else None
    def approx(a, b):
        return abs(float(a) - float(b)) < 0.005
    def ref_rows(path='payments.csv'):
        with open(path, encoding='utf-8', newline='') as f:
            return list(csv.DictReader(f))
    def key(r):
        return (r['artist'], r['song'], (r['payment_date'] or '')[:7])
    def ref_extra(rows):
        seen, extra = set(), []
        for r in rows:
            k = key(r)
            if k in seen:
                extra.append(r)
            seen.add(k)
        return extra
    def ref_overpaid(rows):
        res = {}
        for r in ref_extra(rows):
            res[r['artist']] = res.get(r['artist'], 0) + float(r['amount'] or 0)
        return res
    def same_dict(got, exp):
        if not isinstance(got, dict):
            return False
        return set(got) == set(exp) and all(approx(got[k], exp[k]) for k in exp)
    return dict(var=var, call=call, uses=uses, calls=calls, lines=lines, read=read, approx=approx,
                ref_rows=ref_rows, key=key, ref_extra=ref_extra, ref_overpaid=ref_overpaid, same_dict=same_dict,
                ns=ns, out=out, tree=tree, files=files, ast=ast, csv=csv, io=io)

def run_mission(user_code, spec_json):
    spec = json.loads(spec_json)
    result = {'stdout': '', 'error': None, 'tests': []}
    try:
        tree = ast.parse(user_code, 'main.py')
    except SyntaxError as e:
        result['error'] = {'type': type(e).__name__, 'msg': e.msg, 'line': e.lineno, 'text': (e.text or '').rstrip()}
        return json.dumps(result)
    datasets = spec.get('datasets') or [{}]
    status = {t['name']: None for t in spec['tests']}
    home = os.getcwd()
    work = tempfile.mkdtemp()
    os.chdir(work)
    old_input = builtins.input
    builtins.input = _no_input
    try:
        for di, files in enumerate(datasets):
            for name in os.listdir('.'):
                try:
                    os.remove(name)
                except OSError:
                    pass
            for name, text in files.items():
                with open(name, 'w', encoding='utf-8', newline='') as fh:
                    fh.write(text)
            ns = {'__name__': '__main__'}
            buf = io.StringIO(); old = sys.stdout; sys.stdout = buf
            err = None
            try:
                exec(compile(tree, 'main.py', 'exec'), ns)
            except BaseException as e:
                err = _user_error(e)
            finally:
                sys.stdout = old
            out = buf.getvalue()
            if di == 0:
                result['stdout'] = out[-6000:]
            if err:
                err['dataset'] = di
                result['error'] = err
                break
            helpers = _make_helpers(ns, out, tree, files)
            for t in spec['tests']:
                if status[t['name']] is not None:
                    continue
                if t.get('first') and di > 0:
                    continue
                try:
                    exec(t['code'], dict(helpers))
                except AssertionError as e:
                    note = ' (with a different payments.csv)' if di > 0 else ''
                    status[t['name']] = (str(e) or 'Not quite') + note
                except Exception as e:
                    status[t['name']] = f"{type(e).__name__}: {e}"
    finally:
        builtins.input = old_input
        os.chdir(home)
    result['tests'] = [{'name': t['name'], 'ok': status[t['name']] is None and not result['error'], 'msg': status[t['name']]} for t in spec['tests']]
    return json.dumps(result)
`;
})(typeof window !== 'undefined' ? window : globalThis);
