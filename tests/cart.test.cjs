const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.preview/node_modules/jsdom');
const { server } = require('../scripts/preview.cjs');
const source = fs.readFileSync(path.join(__dirname, '../assets/cart-drawer.js'), 'utf8');
let origin;

test.before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => { await new Promise(resolve => server.close(resolve)); });

async function until(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Cart interaction did not settle');
}

async function setup(t, locale = 'en', intercept) {
  await fetch(origin + '/fixture-reset');
  const url = origin + (locale === 'ar' ? '/ar/home' : '/home');
  const dom = new JSDOM(await (await fetch(url)).text(), { url, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom;
  const calls = [];
  window.matchMedia = () => ({ matches: true });
  window.AbortController = AbortController;
  window.getComputedStyle = () => ({ direction: locale === 'ar' ? 'rtl' : 'ltr' });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('[autofocus]').focus(); };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  window.fetch = async (input, options = {}) => {
    const target = new URL(input, url);
    calls.push({ url: target, options });
    if (intercept) {
      const result = await intercept(target, options, calls);
      if (result) return result;
    }
    if (options.body instanceof window.FormData) {
      const body = new FormData();
      for (const [key, value] of options.body.entries()) body.append(key, value);
      options = { ...options, body };
    }
    return fetch(target, options);
  };
  window.eval(source);
  const document = window.document;
  const find = selector => document.querySelector(selector);
  const settled = () => until(() => find('[data-cart-content]').getAttribute('aria-busy') === 'false');
  const submit = form => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const open = async () => { find('[data-cart-open]').click(); await settled(); };
  return { window, document, find, calls, settled, submit, open };
}

test('add stays on page, keeps drawer closed, shows named toast, updates count; double submit adds once', async t => {
  const ui = await setup(t);
  const form = ui.find('form[action$="/cart/add"]');
  const url = ui.window.location.href;
  ui.submit(form);
  ui.submit(form);
  assert.equal(form.querySelector('button').disabled, true);
  await ui.settled();
  assert.equal(ui.window.location.href, url);
  assert.equal(ui.find('[data-cart-drawer]').open, false);
  assert.equal(ui.find('[data-cart-toast]').hidden, false);
  assert.equal(ui.find('[data-cart-toast-message]').textContent, 'Frozen in time added to your cart');
  assert.equal(ui.find('[data-cart-count]').textContent, '3');
  assert.equal(ui.calls.filter(call => call.url.pathname.endsWith('/cart/add.js')).length, 1);
  assert.equal(form.querySelector('button').disabled, false);
});

test('quantity updates total, removal reaches empty state, closing restores opener focus', async t => {
  const ui = await setup(t);
  await ui.open();
  const input = ui.find('[data-cart-quantity]');
  input.focus();
  ui.find('[data-cart-increase]').click();
  assert.equal(ui.find('[name="checkout"]').disabled, true);
  await ui.settled();
  await until(() => ui.document.activeElement.matches('[data-cart-quantity]'));
  assert.equal(ui.find('[data-cart-quantity]').value, '2');
  assert.match(ui.find('.cart-drawer__total').textContent, /1556\.00/);
  ui.find('[data-cart-remove]').click();
  await ui.settled();
  ui.find('[data-cart-decrease]').click();
  await ui.settled();
  assert.ok(ui.find('.cart-drawer__empty'));
  assert.equal(ui.find('[data-cart-count]').hidden, true);
  assert.equal(ui.find('[name="checkout"]'), null);
  ui.find('[data-cart-close]').click();
  assert.equal(ui.document.activeElement, ui.find('[data-cart-open]'));
  assert.equal(ui.find('[data-cart-open]').getAttribute('aria-expanded'), 'false');
});

test('recommendations exclude cart products and sold-out products; RTL next scroll is negative', async t => {
  const ui = await setup(t, 'ar');
  await ui.open();
  const titles = [...ui.document.querySelectorAll('.cart-recommendation h3')].map(node => node.textContent.trim());
  assert.equal(titles.includes('Tell me I can'), false);
  assert.equal(titles.includes('Elevation'), false);
  assert.equal(titles.includes('Stay focused'), false);
  const rail = ui.find('[data-cart-rail]');
  let scroll;
  rail.scrollBy = options => { scroll = options; };
  Object.defineProperty(rail, 'scrollWidth', { value: 2000 });
  Object.defineProperty(rail, 'clientWidth', { value: 350 });
  rail.dispatchEvent(new ui.window.Event('scroll'));
  ui.find('[data-cart-next]').click();
  assert.ok(scroll.left < 0);
  assert.equal(scroll.behavior, 'auto');
});

test('Arabic add and cart requests retain localized root', async t => {
  const ui = await setup(t, 'ar');
  ui.submit(ui.find('form[action$="/cart/add"]'));
  await ui.settled();
  assert.equal(ui.find('[data-cart-toast-message]').textContent, 'تمت إضافة Frozen in time إلى سلة التسوق');
  assert.ok(ui.calls.some(call => call.url.pathname === '/ar/cart/add.js'));
  await ui.open();
  assert.ok(ui.calls.some(call => call.url.pathname === '/ar/cart'));
  assert.match(ui.find('[data-cart-title]').textContent, /السلة/);
});

test('discount updates platform total; inapplicable code shows error', async t => {
  const ui = await setup(t);
  await ui.open();
  ui.find('#CartDiscount').value = 'SAVE10';
  ui.submit(ui.find('[data-cart-discount]'));
  await ui.settled();
  assert.match(ui.find('.cart-drawer__total').textContent, /897\.30/);
  assert.match(ui.find('.cart-offer').textContent, /99\.70/);
  ui.find('#CartDiscount').value = 'BADCODE';
  ui.submit(ui.find('[data-cart-discount]'));
  await ui.settled();
  assert.equal(ui.find('[data-cart-error]').hidden, false);
  assert.match(ui.find('[data-cart-error]').textContent, /not applicable/);
});

test('null bundled section uses read-only fallback without repeating add', async t => {
  const ui = await setup(t, 'en', async (url, options) => {
    if (!url.pathname.endsWith('/cart/add.js')) return;
    const body = new FormData();
    for (const [key, value] of options.body.entries()) body.append(key, value);
    const response = await fetch(url, { ...options, body });
    const data = await response.json();
    data.sections['cart-drawer'] = null;
    return Response.json(data);
  });
  ui.submit(ui.find('form[action$="/cart/add"]'));
  await ui.settled();
  assert.equal(ui.find('[data-cart-count]').textContent, '3');
  assert.equal(ui.calls.filter(call => call.url.pathname.endsWith('/cart/add.js')).length, 1);
  assert.ok(ui.calls.some(call => call.url.searchParams.has('sections')));
});

test('failed refresh blocks checkout until retry; a successful add retains success toast', async t => {
  let fail = false;
  const ui = await setup(t, 'en', async (url, options) => {
    if (url.pathname.endsWith('/cart/add.js')) {
      const body = new FormData();
      for (const [key, value] of options.body.entries()) body.append(key, value);
      const data = await (await fetch(url, { ...options, body })).json();
      fail = true;
      data.sections['cart-drawer'] = null;
      return Response.json(data);
    }
    if (fail && url.searchParams.has('sections')) return Response.json({ 'cart-drawer': null });
  });
  ui.submit(ui.find('form[action$="/cart/add"]'));
  await ui.settled();
  assert.equal(ui.find('[data-cart-toast]').hidden, false);
  assert.equal(ui.find('[name="checkout"]').disabled, true);
  await ui.open();
  assert.equal(ui.find('[data-cart-retry]').hidden, false);
  fail = false;
  ui.find('[data-cart-retry]').click();
  await ui.settled();
  assert.equal(ui.find('[name="checkout"]').disabled, false);
  assert.equal(ui.find('[data-cart-count]').textContent, '3');
});

test('stock failure shows platform message, restores add button, shows no success toast', async t => {
  const ui = await setup(t);
  const form = ui.find('form[action$="/cart/add"]');
  form.querySelector('[name="quantity"]').value = '6';
  ui.submit(form);
  await ui.settled();
  assert.equal(ui.find('[data-cart-toast]').hidden, true);
  assert.equal(ui.find('[data-cart-feedback]').textContent, 'Only 5 items are available.');
  assert.equal(form.querySelector('button').disabled, false);
});

test('invalid quantity preserves platform quantity and sends no write', async t => {
  const ui = await setup(t);
  await ui.open();
  const input = ui.find('[data-cart-quantity]');
  input.value = '8';
  input.dispatchEvent(new ui.window.Event('change', { bubbles: true }));
  assert.equal(input.value, '1');
  assert.equal(ui.calls.some(call => call.url.pathname.endsWith('/cart/change.js')), false);
  assert.equal(ui.find('[data-cart-error]').hidden, false);
});

test('Theme Editor reload preserves working drawer controller', async t => {
  const ui = await setup(t);
  await ui.open();
  const wrapper = ui.find('#shopify-section-cart-drawer');
  const markup = wrapper.innerHTML;
  wrapper.innerHTML = markup;
  wrapper.dispatchEvent(new ui.window.Event('shopify:section:load', { bubbles: true }));
  await ui.settled();
  assert.equal(ui.document.querySelectorAll('[data-cart-drawer]').length, 1);
  assert.equal(ui.find('[data-cart-drawer]').open, true);
  ui.find('[data-cart-increase]').click();
  await ui.settled();
  assert.equal(ui.find('[data-cart-quantity]').value, '2');
  assert.equal(ui.find('[data-cart-count]').textContent, '3');
});
