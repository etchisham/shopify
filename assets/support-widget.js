(() => {
  const widget = document.querySelector('[data-support-widget]');
  if (!widget) return;
  const greeting = widget.querySelector('[data-support-greeting]');
  const message = widget.querySelector('[data-support-message]');
  const startKey = 'main-theme:support-start';
  const seenKey = 'main-theme:support-seen';
  const delay = Math.max(0, Number(widget.dataset.delay) || 15000);
  let timer, started = false, seen = false;
  function read(key) { try { return window.sessionStorage.getItem(key); } catch { return null; } }
  function write(key, value) { try { window.sessionStorage.setItem(key, value); } catch { /* The widget still works when storage is blocked. */ } }
  const events = ['pointerdown', 'keydown', 'scroll'];
  function removeListeners() { events.forEach(type => window.removeEventListener(type, interact)); }
  function show() {
    if (seen || read(seenKey) === 'true') return;
    if (document.hidden) return;
    seen = true;
    write(seenKey, 'true');
    greeting.hidden = false;
    message.textContent = message.dataset.message;
    document.removeEventListener('visibilitychange', resume);
  }
  function schedule(start) {
    window.clearTimeout(timer);
    timer = window.setTimeout(show, Math.max(0, delay - (Date.now() - start)));
  }
  function interact(event) {
    if (!event.isTrusted || started || seen) return;
    started = true;
    const start = Date.now();
    initialStart = start;
    write(startKey, String(start));
    removeListeners();
    schedule(start);
  }
  function resume() {
    if (!document.hidden && started && !seen) schedule(Number(read(startKey)) || initialStart);
  }
  function dismiss() {
    seen = true;
    write(seenKey, 'true');
    greeting.hidden = true;
    window.clearTimeout(timer);
    removeListeners();
    document.removeEventListener('visibilitychange', resume);
  }
  widget.querySelector('[data-support-close]').addEventListener('click', () => {
    dismiss();
    widget.querySelector('.support-widget__bubble').focus();
  });
  widget.querySelectorAll('[data-support-link]').forEach(link => link.addEventListener('click', dismiss));
  widget.addEventListener('keydown', event => { if (event.key === 'Escape' && !greeting.hidden) { dismiss(); widget.querySelector('.support-widget__bubble').focus(); } });
  seen = read(seenKey) === 'true';
  let initialStart = Number(read(startKey)) || 0;
  if (!seen) {
    document.addEventListener('visibilitychange', resume);
    if (initialStart > 0) { started = true; schedule(initialStart); }
    else events.forEach(type => window.addEventListener(type, interact, { passive: true }));
  }
})();
