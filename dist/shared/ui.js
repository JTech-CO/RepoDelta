/* DOM-only rendering: repository text is never interpreted as HTML. */
(() => {
  'use strict';
  const R = globalThis.RepoDelta;
  R.el = (tag, attrs = {}, children = []) => {
    const e = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      if (key === 'class') e.className = value;
      else if (key === 'onClick') e.addEventListener('click', value);
      else if (key === 'onChange') e.addEventListener('change', value);
      else if (key === 'onInput') e.addEventListener('input', value);
      else if (key === 'value') e.value = value;
      else if (key === 'checked' || key === 'disabled' || key === 'hidden') e[key] = Boolean(value);
      else e.setAttribute(key, String(value));
    }
    for (const child of Array.isArray(children) ? children : [children]) if (child !== null && child !== undefined) e.append(child instanceof Node ? child : document.createTextNode(String(child)));
    return e;
  };
  // Decorative brand image; adjacent RepoDelta/Delta text is the accessible label.
  // Only this static SVG is web-accessible to github.com. No API data is exposed.
  R.logo = (className = 'rd-logo', size = 28) => R.el('img', {
    class: className, src: chrome.runtime.getURL('icons/logo.svg'),
    width: size, height: size, alt: '', 'aria-hidden': 'true', draggable: 'false'
  });
  R.button = (text, handler, classes = '', attrs = {}) => R.el('button', { type: 'button', class: `rd-button ${classes}`, onClick: handler, ...attrs }, [text]);
  R.link = (text, href, attrs = {}) => R.el('a', { href, target: '_blank', rel: 'noopener noreferrer', ...attrs }, [text]);
  R.rpc = async message => {
    let result;
    try { result = await chrome.runtime.sendMessage({ namespace: 'RepoDelta', ...message }); }
    catch { R.fail('EXTENSION_RELOADED'); }
    if (!result?.ok) {
      const err = result?.error || { code: 'EXTENSION_RELOADED' };
      throw new R.DeltaError(err.code, err.status, err.retryAt, err.detail || '');
    }
    return result.data;
  };
  R.download = (filename, text, type = 'application/json') => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = R.el('a', { href: url, download: filename }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
})();
