const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const json = name => JSON.parse(read(name).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

class Element {
  constructor(dataset = {}) { this.dataset = dataset; this.attributes = {}; this.listeners = {}; this.one = {}; this.many = {}; this.hidden = false; this.children = []; this.clientWidth = 1000; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  removeEventListener(type, callback) { this.listeners[type] = (this.listeners[type] || []).filter(item => item !== callback); }
  emit(type, data = {}) { (this.listeners[type] || []).forEach(callback => callback({ type, target: this, isTrusted: true, ...data })); }
  querySelector(selector) { return this.one[selector] || null; }
  querySelectorAll(selector) { return this.many[selector] || []; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() { this.focused = true; }
  contains(element) { return this === element; }
  scrollBy(options) { this.lastScroll = options; }
}
function environment(storage = new Map(), blocked = false) {
  const document = new Element(), window = new Element(), motion = new Element();
  motion.matches = false;
  let now = 100000, id = 0;
  const timers = new Map();
  window.setTimeout = (callback, delay) => { timers.set(++id, { callback, at: now + delay }); return id; };
  window.clearTimeout = key => timers.delete(key);
  window.matchMedia = () => motion;
  window.sessionStorage = {
    getItem: key => { if (blocked) throw Error('blocked'); return storage.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw Error('blocked'); storage.set(key, value); }
  };
  const context = vm.createContext({ window, document, Date: { now: () => now }, getComputedStyle: element => ({ direction: element.direction || 'ltr' }), CustomEvent: class {} });
  return { document, window, motion, timers, storage,
    run: name => vm.runInContext(read(name), context),
    advance: amount => {
      const end = now + amount;
      for (;;) {
        const pending = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!pending) break;
        now = pending[1].at;
        timers.delete(pending[0]);
        pending[1].callback();
      }
      now = end;
    }
  };
}
function support(environment) {
  const widget = new Element({ delay: '15000' }), greeting = new Element(), message = new Element({ message: 'Hello, can we help you?' }), close = new Element(), link = new Element();
  greeting.hidden = true;
  widget.one = { '[data-support-greeting]': greeting, '[data-support-message]': message, '[data-support-close]': close, '.support-widget__bubble': link };
  widget.many['[data-support-link]'] = [link];
  environment.document.one['[data-support-widget]'] = widget;
  environment.run('assets/support-widget.js');
  return { widget, greeting, message, close, link };
}
test('support waits 15 seconds after a trusted first interaction; no page-load popup', () => {
  const env = environment(), ui = support(env);
  env.advance(60000);
  assert.equal(ui.greeting.hidden, true);
  env.window.emit('pointerdown', { isTrusted: false });
  assert.equal(env.timers.size, 0);
  env.window.emit('keydown');
  env.advance(14999);
  assert.equal(ui.greeting.hidden, true);
  env.window.emit('scroll'); // Subsequent interactions must not restart the clock.
  env.advance(1);
  assert.equal(ui.greeting.hidden, false);
  assert.equal(ui.message.textContent, 'Hello, can we help you?');
  assert.equal(env.storage.get('main-theme:support-seen'), 'true');
});
test('support countdown persists across pages; greeting appears once per session', () => {
  const env = environment();
  support(env);
  env.window.emit('pointerdown');
  env.advance(8000);
  env.timers.clear(); // The old page is gone; only the new page can show its popup.
  const next = support(env);
  env.advance(6999);
  assert.equal(next.greeting.hidden, true);
  env.advance(1);
  assert.equal(next.greeting.hidden, false);
  assert.equal(env.storage.get('main-theme:support-seen'), 'true');
  const later = support(env);
  env.advance(20000);
  assert.equal(later.greeting.hidden, true);
});
test('clicking WhatsApp before delay cancels the greeting', () => {
  const env = environment(), ui = support(env);
  env.window.emit('pointerdown');
  ui.link.emit('click');
  env.advance(30000);
  assert.equal(ui.greeting.hidden, true);
  assert.equal(env.timers.size, 0);
});
test('hidden tabs defer greeting; blocked storage still supports the timer', () => {
  const env = environment(new Map(), true), ui = support(env);
  env.window.emit('scroll');
  env.document.hidden = true;
  env.advance(20000);
  assert.equal(ui.greeting.hidden, true);
  env.document.hidden = false;
  env.document.emit('visibilitychange');
  env.advance(0);
  assert.equal(ui.greeting.hidden, false);
  ui.close.emit('click');
  assert.equal(ui.greeting.hidden, true);
});
function tabs(env, direction = 'ltr') {
  const section = new Element();
  section.direction = direction;
  const tabs = [0, 1, 2].map(i => { const tab = new Element({ blockId: String(i) }); tab.id = 'tab-' + i; return tab; });
  const panels = tabs.map(() => {
    const panel = new Element(), rail = new Element(), controls = new Element(), previous = new Element(), next = new Element();
    rail.children = [1, 2, 3, 4];
    panel.one = { '[data-product-rail]': rail, '[data-rail-controls]': controls, '[data-rail-previous]': previous, '[data-rail-next]': next };
    return panel;
  });
  section.one['[data-tab-list]'] = new Element();
  section.many = { '[data-collection-tab]': tabs, '[data-collection-panel]': panels };
  env.document.many['[data-collection-tabs]'] = [section];
  env.run('assets/home.js');
  return { tabs, panels, section };
}
test('collection tabs expose ARIA state, keyboard navigation, and reduced-motion rails', () => {
  const env = environment(), ui = tabs(env);
  assert.equal(ui.tabs[0].attributes['aria-selected'], 'true');
  assert.equal(ui.panels[1].hidden, true);
  let prevented = false;
  ui.tabs[0].emit('keydown', { key: 'ArrowRight', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(ui.tabs[1].focused, true);
  assert.equal(ui.tabs[1].tabIndex, 0);
  assert.equal(ui.panels[1].hidden, false);
  ui.tabs[1].emit('keydown', { key: 'End', preventDefault() {} });
  assert.equal(ui.tabs[2].attributes['aria-selected'], 'true');
  env.motion.matches = true;
  ui.panels[2].one['[data-rail-next]'].emit('click');
  assert.equal(ui.panels[2].one['[data-product-rail]'].lastScroll.behavior, 'auto');
});
test('RTL reverses arrow-key tab navigation and product scrolling', () => {
  const env = environment(), ui = tabs(env, 'rtl');
  ui.tabs[0].emit('keydown', { key: 'ArrowLeft', preventDefault() {} });
  assert.equal(ui.tabs[1].attributes['aria-selected'], 'true');
  ui.panels[1].one['[data-rail-next]'].emit('click');
  assert.ok(ui.panels[1].one['[data-product-rail]'].lastScroll.left < 0);
});
function slideshow(env) {
  const section = new Element({ autoplay: 'true', interval: '7000' });
  const slides = [new Element(), new Element(), new Element()], dots = slides.map(() => new Element());
  const controls = new Element(), pause = new Element({ playLabel: 'Play', pauseLabel: 'Pause' }), next = new Element(), previous = new Element();
  section.many = { '[data-home-slide]': slides, '[data-slide-dot]': dots };
  section.one = { '[data-slide-controls]': controls, '[data-slide-pause]': pause, '[data-slide-next]': next, '[data-slide-previous]': previous };
  env.document.many['[data-home-slideshow]'] = [section];
  env.run('assets/home.js');
  return { section, slides, dots, pause, next };
}
test('slideshow autoplays, manual navigation pauses, hover blocks autoplay', () => {
  const env = environment(), ui = slideshow(env);
  env.advance(7000);
  assert.equal(ui.slides[1].hidden, false);
  ui.section.emit('pointerenter');
  env.advance(20000);
  assert.equal(ui.slides[1].hidden, false);
  ui.section.emit('pointerleave');
  ui.next.emit('click');
  assert.equal(ui.slides[2].hidden, false);
  env.advance(20000);
  assert.equal(ui.slides[2].hidden, false);
  assert.equal(ui.pause.textContent, 'Play');
});
test('reduced motion starts slideshow paused', () => {
  const env = environment();
  env.motion.matches = true;
  const ui = slideshow(env);
  env.advance(30000);
  assert.equal(ui.slides[0].hidden, false);
  assert.equal(env.timers.size, 0);
});
test('homepage section flow excludes video; contact and widget use native safe links', () => {
  const homepage = json('templates/index.json');
  assert.deepEqual(homepage.order.map(id => homepage.sections[id].type), ['home-slideshow', 'home-statement', 'collection-tabs', 'home-statement', 'collection-tabs', 'home-category-links']);
  assert.match(read('sections/contact.liquid'), /form 'contact'/);
  assert.match(read('snippets/support-widget.liquid'), /target="_blank" rel="noopener noreferrer"/);
  for (const name of ['layout/theme.liquid', 'layout/password.liquid', 'templates/gift_card.liquid']) assert.match(read(name), /render 'support-widget'/);
  assert.doesNotMatch(read('assets/support-widget.js'), /window\.open/);
});
test('all new schemas and templates have English and Arabic editor translations', () => {
  const en = json('locales/en.default.schema.json'), ar = json('locales/ar.schema.json');
  const lookup = (object, key) => key.split('.').reduce((value, part) => value?.[part], object);
  for (const name of ['home-slideshow', 'home-statement', 'collection-tabs', 'home-category-links', 'contact']) {
    const schema = JSON.parse(read('sections/' + name + '.liquid').match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
    for (const match of JSON.stringify(schema).matchAll(/"t:([^"]+)"/g)) {
      assert.ok(lookup(en, match[1]), 'English: ' + match[1]);
      assert.ok(lookup(ar, match[1]), 'Arabic: ' + match[1]);
    }
    for (const setting of [...schema.settings, ...(schema.blocks || []).flatMap(block => block.settings)]) {
      if (setting.type === 'range') {
        assert.ok(setting.default >= setting.min && setting.default <= setting.max);
        assert.equal((setting.default - setting.min) % setting.step, 0, setting.id);
      }
    }
  }
});
test('header logo centering is direction-independent', () => {
  const source = read('sections/header.liquid');
  assert.match(source, /\.site-header__brand\s*\{[^}]*left: 50%;[^}]*translateX\(-50%\)/);
  assert.doesNotMatch(source, /translateX\(50%\)/);
});
