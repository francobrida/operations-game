/* Tiny DOM helpers shared by every screen. */
(function (root) {
  'use strict';
  const OT = root.OT = root.OT || {};

  // h('button', { class: 'x', onclick: fn, disabled: true }, 'text', childNode, [more])
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'hidden') el.hidden = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  // Button that asks for a second click before acting (native confirm() is blocked in some embeds).
  function confirmButton(label, armedLabel, onConfirm, props) {
    let timer = null;
    const btn = h('button', Object.assign({ type: 'button' }, props), label);
    btn.addEventListener('click', () => {
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1';
        btn.textContent = armedLabel;
        timer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = label; }, 5000);
        return;
      }
      clearTimeout(timer);
      delete btn.dataset.armed;
      btn.textContent = label;
      onConfirm();
    });
    return btn;
  }

  function progressBar(done, total) {
    const pct = total ? Math.round(done / total * 100) : 0;
    return h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done },
      h('div', { class: 'bar-fill', style: 'width:' + pct + '%' }));
  }

  OT.ui = { h, confirmButton, progressBar };
})(typeof window !== 'undefined' ? window : globalThis);
