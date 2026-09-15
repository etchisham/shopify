const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.preview/node_modules/jsdom');
const { server, page, pageData, renderSection } = require('../scripts/preview.cjs');
const code = name => fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8');
let origin;
test.before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => new Promise(resolve => server.close(resolve)));
async function until(check) {
  for (let i = 0; i < 120; i++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Store interaction did not settle');
}
async function setup(t, route = '/product') {
  await fetch(origin + '/fixture-reset');
  const url = origin + route;
  const dom = new JSDOM(await page(new URL(url)), { url, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.matchMedia = () => ({ matches: true });
  window.AbortController = AbortController;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const calls = [];
  window.fetch = async (input, options = {}) => {
    const target = new URL(input, url);
    calls.push({ target, options });
    return fetch(target, options);
  };
  window.eval(code('cart-drawer'));
  window.eval(code('bought-together'));
  window.eval(code('newsletter'));
  window.eval(code('help-page'));
  const document = window.document;
  const find = selector => document.querySelector(selector);
  const submit = form => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const change = element => element.dispatchEvent(new window.Event('change', { bubbles: true }));
  return { window, document, find, submit, change, calls };
}

test('bundle sums selected variants, follows main product selection, excludes sold-out and adds once without navigation', async t => {
  const ui = await setup(t);
  const cards = [...ui.document.querySelectorAll('[data-bundle-item]')];
  assert.equal(cards.length, 4); // Current product was also in merchant picks; no duplicate card.
  assert.equal(ui.find('[data-bundle-total]').textContent, '$1,186.00');
  assert.equal(cards[3].querySelector('input').disabled, true);
  const variant = cards[0].querySelector('select');
  ui.find('.product-form [name="id"]').value = '101';
  ui.change(ui.find('.product-form [name="id"]'));
  assert.equal(variant.value, '101');
  assert.equal(ui.find('[data-bundle-total]').textContent, '$1,236.00');
  cards[1].querySelector('input').checked = false;
  ui.change(cards[1].querySelector('input'));
  assert.equal(ui.find('[data-bundle-total]').textContent, '$798.00');
  const form = ui.find('[data-bought-together-form]');
  const location = ui.window.location.href;
  ui.submit(form);
  ui.submit(form);
  assert.equal(form.getAttribute('aria-busy'), 'true');
  await until(() => !form.hasAttribute('aria-busy'));
  const additions = ui.calls.filter(call => call.target.pathname.endsWith('/cart/add.js'));
  assert.equal(additions.length, 1);
  assert.deepEqual(JSON.parse(additions[0].options.body).items, [{ id: 101, quantity: 1 }, { id: 3, quantity: 1 }]);
  assert.equal(ui.window.location.href, location);
  assert.equal(ui.find('[data-cart-drawer]').open, false);
  assert.equal(ui.find('[data-cart-toast-message]').textContent, 'Tell me I can, Frozen in time added to your cart');
  assert.equal(ui.find('[data-cart-count]').textContent, '4');
});

test('empty bundle selection blocks adding and Arabic uses translated labels and localized endpoint', async t => {
  const ui = await setup(t, '/ar/product');
  const checks = [...ui.document.querySelectorAll('[data-bundle-check]:not(:disabled)')];
  checks.forEach(check => { check.checked = false; ui.change(check); });
  assert.equal(ui.find('[data-bundle-add]').disabled, true);
  assert.match(ui.find('[data-add-label]').textContent, /اختر/);
  ui.submit(ui.find('[data-bought-together-form]'));
  assert.equal(ui.calls.length, 0);
  checks[2].checked = true;
  ui.change(checks[2]);
  ui.submit(ui.find('[data-bought-together-form]'));
  await until(() => !ui.find('[data-bought-together-form]').hasAttribute('aria-busy'));
  assert.equal(ui.calls[0].target.pathname, '/ar/cart/add.js');
  assert.match(ui.find('[data-cart-toast-message]').textContent, /تمت إضافة Frozen in time/);
});

test('bundle stock rejection restores controls without claiming success', async t => {
  const ui = await setup(t);
  const id = ui.find('[data-bundle-variant]');
  id.selectedOptions[0].dataset.min = '6';
  ui.change(id);
  const form = ui.find('[data-bought-together-form]');
  ui.submit(form);
  await until(() => !form.hasAttribute('aria-busy'));
  await until(() => !ui.find('[data-cart-feedback]').hidden);
  assert.match(ui.find('[data-cart-feedback]').textContent, /Only 5/);
  assert.equal(ui.find('[data-cart-toast]').hidden, true);
  assert.equal(ui.find('[data-bundle-add]').disabled, false);
  assert.equal((await (await fetch(origin + '/cart.js')).json()).item_count, 2);
});

async function newsletterResponse(ui, result) {
  const form = ui.find('[data-newsletter-form]');
  const frame = form.querySelector('iframe');
  const html = await page(new URL(origin + '/contact'), result);
  const response = new JSDOM(html, { url: origin + '/contact' });
  Object.defineProperty(frame, 'contentDocument', { configurable: true, value: response.window.document });
  frame.dispatchEvent(new ui.window.Event('load'));
  delete frame.contentDocument; // Restore the real about:blank document for subsequent frame loads.
  response.window.close();
}

test('newsletter preserves native form hooks, targets response frame, blocks duplicate and confirms server success', async t => {
  const ui = await setup(t, '/help');
  const form = ui.find('[data-newsletter-form]');
  const email = form.querySelector('input[type="email"]');
  email.value = 'shopper@example.test';
  const location = ui.window.location.href;
  let nativeSubmits = 0;
  form.addEventListener('submit', event => { if (!event.defaultPrevented) nativeSubmits++; });
  assert.equal(ui.submit(form), true); // Native Shopify CAPTCHA/submit handling remains available.
  assert.equal(ui.submit(form), false);
  assert.equal(nativeSubmits, 1);
  assert.equal(form.target, form.querySelector('iframe').name);
  assert.equal(form.querySelector('[data-newsletter-button]').disabled, true);
  assert.equal(form.querySelector('[data-newsletter-loading]').hidden, false);
  assert.equal(email.readOnly, true);
  assert.equal(ui.find('[data-cart-toast]').hidden, true);
  await newsletterResponse(ui, 'success');
  assert.equal(ui.window.location.href, location);
  assert.equal(email.value, '');
  assert.equal(email.readOnly, false);
  assert.equal(form.querySelector('[data-newsletter-button]').disabled, false);
  assert.equal(form.querySelector('[data-newsletter-loading]').hidden, true);
  assert.equal(ui.find('[data-cart-toast-message]').textContent, 'You have been subscribed successfully.');
});

test('newsletter error keeps email, clears loading, and allows retry; invalid email never submits', async t => {
  const ui = await setup(t);
  const form = ui.find('[data-newsletter-form]');
  const email = form.querySelector('input[type="email"]');
  email.value = 'invalid';
  assert.equal(ui.submit(form), false);
  assert.equal(form.hasAttribute('aria-busy'), false);
  email.value = 'shopper@example.test';
  ui.submit(form);
  await newsletterResponse(ui, 'error');
  assert.equal(email.value, 'shopper@example.test');
  assert.equal(form.querySelector('[data-newsletter-error]').hidden, false);
  assert.equal(form.querySelector('[data-newsletter-button]').disabled, false);
  assert.equal(ui.find('[data-cart-toast]').hidden, true);
  assert.equal(ui.submit(form), true);
  await newsletterResponse(ui, 'success');
  assert.equal(form.querySelector('[data-newsletter-error]').hidden, true);
});

test('newsletter challenge stays in response frame and can be cancelled for retry', async t => {
  const ui = await setup(t);
  const form = ui.find('[data-newsletter-form]');
  form.querySelector('input[type="email"]').value = 'shopper@example.test';
  ui.submit(form);
  const frame = form.querySelector('iframe');
  const challenge = new JSDOM('<p>Verification</p>', { url: origin + '/challenge' });
  Object.defineProperty(frame, 'contentDocument', { configurable: true, value: challenge.window.document });
  frame.dispatchEvent(new ui.window.Event('load'));
  assert.equal(frame.hidden, false);
  assert.equal(form.querySelector('[data-newsletter-verification]').hidden, false);
  form.querySelector('[data-newsletter-cancel]').click();
  assert.equal(frame.hidden, true);
  assert.equal(form.querySelector('[data-newsletter-button]').disabled, false);
  challenge.window.close();
});

test('help pages retain independent translated content and enhance H3 answers into keyboard-native accordions', async t => {
  const ui = await setup(t, '/ar/help');
  const details = [...ui.document.querySelectorAll('.help-page__question')];
  assert.equal(details.length, 3);
  assert.match(details[0].querySelector('summary').textContent, /كيف أتابع/);
  assert.match(details[0].querySelector('.help-page__answer').textContent, /تتبع الطلب/);
  assert.equal(ui.find('[data-help-topics]').hidden, false);
  assert.equal(ui.document.querySelectorAll('[data-help-topics] a').length, 2);
  const care = await page(new URL(origin + '/ar/care'));
  assert.match(care, /محتوى تجريبي مستقل لصفحة العناية/);
  assert.doesNotMatch(care, /كيف أتابع طلبي/);
  assert.match(care, /<h3>كيف أعتني/); // Without JS the complete page content remains readable.
});

test('help editor FAQ blocks use Arabic fields and social blocks preserve order, icons, safe links', async t => {
  const data = pageData(new URL(origin + '/ar/help'));
  data.page.content = '';
  const html = await renderSection('help', { type: 'help-page', settings: {}, blocks: { one: { type: 'question', settings: { question_en: 'Question', question_ar: 'سؤال مخصص', answer_ar: '<p>إجابة مخصصة</p>' } } }, block_order: ['one'] }, data);
  assert.match(html, /سؤال مخصص/);
  assert.match(html, /إجابة مخصصة/);
  assert.match(html, /<details/);
  const footer = await renderSection('footer', { type: 'footer', settings: {}, blocks: {
    one: { type: 'social', settings: { platform: 'whatsapp', url: 'https://wa.me/123' } },
    blank: { type: 'social', settings: { platform: 'x', url: '' } },
    two: { type: 'social', settings: { platform: 'instagram', url: 'https://instagram.com/store' } }
  }, block_order: ['two', 'blank', 'one'] }, data);
  const dom = new JSDOM(footer);
  t.after(() => dom.window.close());
  const links = [...dom.window.document.querySelectorAll('.site-footer__socials a')];
  assert.equal(links.length, 2);
  assert.equal(links[0].getAttribute('aria-label'), 'Instagram');
  links.forEach(link => { assert.ok(link.querySelector('svg')); assert.equal(link.target, '_blank'); assert.match(link.rel, /noopener/); });
});
