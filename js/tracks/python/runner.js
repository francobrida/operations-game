/* Runs Python (Pyodide from the jsDelivr CDN) inside a Web Worker, so a loop that never ends
   can be stopped with a timeout instead of freezing the page. */
(function (root) {
  'use strict';
  const OT = root.OT;
  const INDEX = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const SRC = `
let ready = null;
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (!ready) ready = (async () => {
      importScripts(m.indexURL + 'pyodide.js');
      const py = await loadPyodide({ indexURL: m.indexURL });
      py.runPython(m.harness);
      return py;
    })();
    const py = await ready;
    if (m.type === 'run') {
      py.globals.set('__code', m.code);
      py.globals.set('__spec', m.spec);
      self.postMessage({ id: m.id, ok: true, result: py.runPython('run_mission(__code, __spec)') });
    } else self.postMessage({ id: m.id, ok: true });
  } catch (err) {
    ready = null;
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};`;
  let worker = null, warm = null, seq = 0;
  const listeners = new Set();
  const status = s => listeners.forEach(f => f(s));

  function spawn() {
    worker = new Worker(URL.createObjectURL(new Blob([SRC], { type: 'text/javascript' })));
    warm = null;
  }
  function send(msg, timeout) {
    return new Promise(resolve => {
      const id = ++seq, w = worker;
      const timer = setTimeout(() => {
        w.terminate();
        if (worker === w) { worker = null; warm = null; }
        resolve({ timeout: true });
      }, timeout);
      const onMsg = e => {
        if (e.data.id !== id) return;
        w.removeEventListener('message', onMsg);
        clearTimeout(timer);
        resolve(e.data);
      };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', ev => { clearTimeout(timer); resolve({ ok: false, error: ev.message || 'The Python worker failed to start.' }); }, { once: true });
      w.postMessage(Object.assign({ id, indexURL: INDEX, harness: OT.pyHarness }, msg));
    });
  }
  function ready() {
    if (!worker) spawn();
    if (!warm) {
      status('loading');
      warm = send({ type: 'warmup' }, 120000).then(r => {
        if (!r.ok) {
          warm = null;
          if (worker) { worker.terminate(); worker = null; }
          status('failed');
          throw new Error(r.timeout ? 'Loading Python took too long. Check your internet connection.' : r.error);
        }
        status('ready');
        return true;
      });
    }
    return warm;
  }
  async function run(code, spec, timeoutMs) {
    await ready();
    status('running');
    const r = await send({ type: 'run', code, spec: JSON.stringify(spec) }, timeoutMs || 5000);
    if (r.timeout) { status('stopped'); return { timeout: true }; }
    status('ready');
    if (!r.ok) return { crash: r.error };
    return JSON.parse(r.result);
  }

  OT.pyRunner = { ready, run, onStatus(f) { listeners.add(f); return () => listeners.delete(f); } };
})(window);
