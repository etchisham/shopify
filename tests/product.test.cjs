const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.preview/node_modules/jsdom');
const { server, page, pageData, renderSection } = require('../scripts/preview.cjs');
const source = name => fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8');
let origin;
test.before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => new Promise(resolve => server.close(resolve)));
async function until(check) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Product interaction did not settle');
}
async function setup(t, route = '/product', intercept) {
  await fetch(origin + '/fixture-reset');
  const url = origin + route;
  const dom = new JSDOM(await page(new URL(url)), { url, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom, document = window.document;
  const find = selector => document.querySelector(selector);
  const calls = [];
  window.matchMedia = () => ({ matches: true });
  window.ResizeObserver = class { observe() {} disconnect() {} };
  window.CSS = { escape: value => value.replace(/[^\w-]/g, '\\$&') };
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('[autofocus]').focus(); };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  window.HTMLElement.prototype.scrollTo = function ({ left = this.scrollLeft, top = this.scrollTop }) { this.scrollLeft = left; this.scrollTop = top; this.dispatchEvent(new window.Event('scroll')); };
  window.HTMLElement.prototype.scrollBy = function ({ left = 0, top = 0 }) { this.scrollTo({ left: this.scrollLeft + left, top: this.scrollTop + top }); };
  const rtl = route.startsWith('/ar/');
  const track = find('[data-product-media-track]');
  window.getComputedStyle = element => ({ direction: element === track && rtl ? 'rtl' : 'ltr' });
  track.getBoundingClientRect = () => ({ left: 100, right: 700, top: 0, bottom: 600, width: 600, height: 600 });
  [...document.querySelectorAll('[data-product-media]')].forEach((slide, index) => {
    slide.getBoundingClientRect = () => { const left = 100 + (rtl ? -1 : 1) * index * 600 - track.scrollLeft; return { left, right: left + 600, top: 0, bottom: 600, width: 600, height: 600 }; };
  });
  const preview = find('[data-description-text]');
  Object.defineProperty(preview, 'scrollHeight', { configurable: true, get: () => 300 });
  Object.defineProperty(preview, 'clientHeight', { configurable: true, get: () => preview.parentElement.classList.contains('is-collapsed') ? 144 : 300 });
  window.fetch = async (input, options = {}) => {
    const target = new URL(input, url);
    calls.push({ target, options });
    if (intercept) { const result = await intercept(target, options, calls); if (result) return result; }
    if (options.body instanceof window.FormData) {
      const body = new FormData();
      for (const [key, value] of options.body.entries()) body.append(key, value);
      options = { ...options, body };
    }
    const controller = new AbortController();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener('abort', () => controller.abort(), { once: true });
    return fetch(target, { ...options, signal: controller.signal });
  };
  window.eval(source('cart-drawer'));
  window.eval(source('product'));
  window.eval(source('bought-together'));
  const change = element => element.dispatchEvent(new window.Event('change', { bubbles: true }));
  const submit = (form, submitter) => form.dispatchEvent(new window.SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: submitter || null }));
  const choose = async (position, value) => {
    const select = find(`[data-option-position="${position}"]`);
    select.value = value;
    change(select);
    await until(() => !find('.product-form').hasAttribute('data-variant-pending'));
  };
  return { window, document, find, track, calls, change, submit, choose };
}

test('gallery thumbnails, arrows, keyboard and scroll update selection and media accessibility', async t => {
  const ui = await setup(t);
  assert.equal(ui.find('[data-product-previous]').disabled, true);
  ui.find('[data-product-thumbnail="3"]').click();
  assert.equal(ui.find('[data-product-media-counter]').textContent, '4');
  assert.equal(ui.track.scrollLeft, 1800);
  assert.equal(ui.find('[data-product-thumbnail="3"]').getAttribute('aria-current'), 'true');
  assert.equal(ui.find('[data-product-media="11"]').inert, true);
  ui.find('[data-product-next]').click();
  assert.equal(ui.find('[data-product-media-counter]').textContent, '5');
  ui.track.dispatchEvent(new ui.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  assert.equal(ui.find('[data-product-next]').disabled, true);
  assert.equal(ui.find('[data-product-media-counter]').textContent, '9');
  ui.track.scrollLeft = 600;
  ui.track.dispatchEvent(new ui.window.Event('scroll'));
  await until(() => ui.find('[data-product-media-counter]').textContent === '2');
  assert.equal(ui.find('[data-product-media-status]').textContent, '2 of 9');
});

test('RTL left arrow advances to next media and scrolling uses negative offsets', async t => {
  const ui = await setup(t, '/ar/product');
  ui.track.dispatchEvent(new ui.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  assert.equal(ui.track.scrollLeft, -600);
  assert.equal(ui.find('[data-product-media-counter]').textContent, '2');
  ui.track.dispatchEvent(new ui.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(ui.track.scrollLeft, 0);
  assert.equal(ui.find('[data-product-media-counter]').textContent, '1');
});

test('image lightbox loads full-size media only when opened; navigation, zoom toggle, close focus work', async t => {
  const ui = await setup(t);
  assert.equal(ui.find('[data-product-zoom-canvas] img'), null);
  const link = ui.find('[data-product-media="11"] [data-product-zoom]');
  link.click();
  assert.equal(ui.find('[data-product-zoom-dialog]').open, true);
  assert.match(ui.find('[data-product-zoom-canvas] img').src, /view=1/);
  ui.find('[data-product-zoom-next]').click();
  assert.match(ui.find('[data-product-zoom-canvas] img').src, /view=2/);
  ui.find('[data-product-zoom-toggle]').click();
  assert.equal(ui.find('[data-product-zoom-canvas]').classList.contains('is-zoomed'), true);
  assert.equal(ui.find('[data-product-zoom-toggle]').textContent, 'Zoom out');
  ui.find('[data-product-zoom-close]').click();
  assert.equal(ui.find('[data-product-zoom-dialog]').open, false);
  assert.equal(ui.document.activeElement, ui.track);
});

test('separate option dropdowns refresh price, stock, featured image, URL and bundle; preserve personalization', async t => {
  const ui = await setup(t);
  const personalization = ui.find('[name="properties[Personalization]"]');
  personalization.value = 'Our family';
  ui.find('.product-personalization').open = true;
  ui.find('[name="quantity"]').value = '3';
  const select = ui.find('[data-option-position="1"]');
  select.value = '1102';
  ui.change(select);
  assert.equal(ui.find('[data-product-add]').disabled, true);
  assert.equal(ui.submit(ui.find('.product-form')), false);
  assert.equal(ui.find('[data-product-buy]').disabled, true);
  assert.equal(ui.submit(ui.find('.product-form'), ui.find('[data-product-buy]')), false);
  personalization.value = 'Updated while loading';
  await until(() => !ui.find('.product-form').hasAttribute('data-variant-pending'));
  assert.equal(ui.find('.product-form [name="id"]').value, '101');
  assert.equal(ui.find('.product-page__price .price__current').textContent, '$609.00');
  assert.equal(ui.find('[data-product-media-counter]').textContent, '2');
  assert.equal(ui.find('[name="properties[Personalization]"]').value, 'Updated while loading');
  assert.equal(ui.find('.product-personalization').open, true);
  assert.equal(ui.find('[name="quantity"]').value, '3');
  assert.match(ui.window.location.search, /variant=101/);
  assert.equal(ui.find('[data-bundle-current] select').value, '101');
  assert.equal(ui.find('[data-bundle-total]').textContent, '$1,236.00');
  assert.equal(ui.calls[0].target.pathname, '/products/example-1');
  assert.equal(ui.calls[0].target.searchParams.get('section_id'), 'main');
  assert.equal(ui.document.activeElement.id, 'ProductOption-main-1');
});

test('quantity rules update after option selection; selecting a sold-out URL keeps add disabled', async t => {
  const ui = await setup(t);
  ui.find('[name="quantity"]').value = '3';
  await ui.choose(2, '1202');
  assert.equal(ui.find('.product-form [name="id"]').value, '201');
  assert.equal(ui.find('[name="quantity"]').min, '2');
  assert.equal(ui.find('[name="quantity"]').step, '2');
  assert.equal(ui.find('[name="quantity"]').value, '2');
  const soldOut = await setup(t, '/product?variant=301');
  assert.equal(soldOut.find('[data-product-add]').disabled, true);
  assert.equal(soldOut.find('[data-product-buy]').disabled, true);
  assert.match(soldOut.find('[data-product-add-label]').textContent, /Sold out/);
});

test('failed option refresh restores selection and leaves previous valid purchase ready to retry', async t => {
  let fail = true;
  const ui = await setup(t, '/product', async url => {
    if (url.searchParams.has('section_id') && fail) return new Response('Unavailable', { status: 503 });
  });
  await ui.choose(1, '1102');
  assert.equal(ui.find('[data-option-position="1"]').value, '1101');
  assert.equal(ui.find('.product-form [name="id"]').value, '1');
  assert.equal(ui.find('[data-product-add]').disabled, false);
  assert.equal(ui.find('[data-product-error]').hidden, false);
  assert.doesNotMatch(ui.window.location.search, /variant=/);
  fail = false;
  await ui.choose(1, '1102');
  assert.equal(ui.find('[data-product-error]').hidden, true);
  assert.equal(ui.find('.product-form [name="id"]').value, '101');
});

test('late option responses cannot overwrite newer selection; Arabic requests retain locale', async t => {
  let release;
  const ui = await setup(t, '/ar/product', async url => {
    if (url.searchParams.get('option_values') === '1102,1201') {
      const html = await (await fetch(url)).text();
      return new Promise(resolve => { release = () => resolve(new Response(html)); });
    }
  });
  const finish = ui.find('[data-option-position="1"]');
  finish.value = '1102'; ui.change(finish);
  await until(() => release);
  finish.value = '1101'; ui.change(finish);
  await until(() => !ui.find('.product-form').hasAttribute('data-variant-pending'));
  release();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(ui.find('.product-form [name="id"]').value, '1');
  assert.equal(ui.calls[0].target.pathname, '/ar/products/example-1');
});

test('product add retains toast-only cart behavior and personalization property', async t => {
  const ui = await setup(t);
  ui.find('[name="properties[Personalization]"]').value = 'Name';
  const url = ui.window.location.href;
  ui.submit(ui.find('.product-form'));
  assert.equal(ui.find('[data-product-options]').inert, true);
  assert.equal(ui.find('[data-product-buy]').disabled, true);
  await until(() => !ui.find('.product-form').hasAttribute('aria-busy'));
  assert.equal(ui.window.location.href, url);
  assert.equal(ui.find('[data-cart-drawer]').open, false);
  assert.equal(ui.find('[data-cart-toast-message]').textContent, 'Tell me I can added to your cart');
  const request = ui.calls.find(call => call.target.pathname.endsWith('/cart/add.js'));
  assert.equal(request.options.body.get('properties[Personalization]'), 'Name');
  assert.equal(ui.find('[data-product-options]').inert, false);
});

test('Buy it now submits selected variant, quantity and personalization natively to localized checkout', async t => {
  for (const route of ['/product', '/ar/product']) {
    const ui = await setup(t, route);
    await ui.choose(1, '1102');
    const form = ui.find('.product-form'), buy = ui.find('[data-product-buy]');
    ui.find('[name="quantity"]').value = '2';
    ui.find('[name="properties[Personalization]"]').value = 'Family & name';
    assert.equal(buy.disabled, false);
    assert.equal(buy.textContent, route.startsWith('/ar/') ? 'اشترِ الآن' : 'Buy it now');
    assert.equal(form.reportValidity(), true);
    assert.equal(ui.submit(form, buy), true); // The Ajax add handler leaves native checkout submission intact.
    assert.equal(ui.calls.filter(call => call.target.pathname.endsWith('/cart/add.js')).length, 0);
    const values = new ui.window.FormData(form, buy);
    assert.equal(values.get('id'), '101');
    assert.equal(values.get('quantity'), '2');
    assert.equal(values.get('properties[Personalization]'), 'Family & name');
    assert.equal(values.get('return_to'), route.startsWith('/ar/') ? '/ar/checkout' : '/checkout');
    const response = await fetch(form.action, { method: 'POST', body: new URLSearchParams([...values]), redirect: 'manual' });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), values.get('return_to'));
    const checkout = await (await fetch(origin + values.get('return_to'))).text();
    assert.match(checkout, /Local checkout preview/);
    assert.match(checkout, /Family &amp; name/);
    assert.equal(ui.find('[data-cart-drawer]').open, false);
  }
  const data = pageData(new URL(origin + '/product'));
  const hidden = await renderSection('main', { type: 'product', settings: { show_buy_now: false, show_dynamic_checkout: false } }, data);
  assert.doesNotMatch(hidden, /data-product-buy/);
});

test('invalid required personalization opens its disclosure so native validation can focus the field', async t => {
  const ui = await setup(t, '/product?personalization=required');
  const text = ui.find('[name="properties[Personalization]"]');
  assert.equal(text.required, true);
  ui.find('.product-personalization').open = false;
  assert.equal(ui.find('.product-form').reportValidity(), false);
  assert.equal(ui.find('.product-personalization').open, true);
  assert.equal(ui.calls.length, 0);
});

test('bundle add validates current-product personalization and sends it only on that item', async t => {
  const ui = await setup(t, '/product?personalization=required');
  const text = ui.find('[name="properties[Personalization]"]');
  assert.equal(text.required, true);
  ui.find('.product-personalization').open = false;
  ui.submit(ui.find('[data-bought-together-form]'));
  assert.equal(ui.calls.length, 0);
  assert.equal(ui.find('.product-personalization').open, true);
  text.value = 'Family name';
  ui.submit(ui.find('[data-bought-together-form]'));
  await until(() => !ui.find('[data-bought-together-form]').hasAttribute('aria-busy'));
  const request = ui.calls.find(call => call.target.pathname.endsWith('/cart/add.js'));
  const items = JSON.parse(request.options.body).items;
  assert.deepEqual(items[0].properties, { Personalization: 'Family name' });
  assert.equal(items[1].properties, undefined);
  assert.equal(ui.find('[data-cart-drawer]').open, false);
});

test('description preview expands and native information accordions remain independent', async t => {
  const ui = await setup(t);
  const button = ui.find('[data-description-more]');
  assert.equal(button.hidden, false);
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(button.textContent, 'Show less');
  assert.equal(ui.find('[data-product-description]').classList.contains('is-collapsed'), false);
  assert.equal(ui.document.querySelectorAll('[data-product-accordion][open]').length, 2);
});

test('save buttons share state and persist a real device collection; storage failure shows error', async t => {
  const ui = await setup(t);
  ui.find('[data-save-icon]').click();
  assert.equal(ui.find('[data-save-text]').textContent, 'Remove from wishlist');
  assert.equal(ui.find('[data-save-icon]').getAttribute('aria-pressed'), 'true');
  const stored = JSON.parse(ui.window.localStorage.getItem('theme:saved-products'));
  assert.equal(stored[0].id, '1');
  assert.equal(stored[0].url, '/products/example-1');
  assert.equal(stored[0].price, '$559.00');
  assert.equal(stored[0].vendor, 'Example Studio');
  ui.find('[data-save-text]').parentElement.click();
  assert.deepEqual(JSON.parse(ui.window.localStorage.getItem('theme:saved-products')), []);
  ui.window.Storage.prototype.setItem = () => { throw new Error('Storage disabled'); };
  ui.find('[data-save-icon]').click();
  assert.equal(ui.find('[data-product-error]').hidden, false);
  assert.equal(ui.find('[data-save-icon]').getAttribute('aria-pressed'), 'false');
});

test('editor accordion sources prioritize product fields and Arabic override keys; blank content stays hidden', async t => {
  const data = pageData(new URL(origin + '/ar/product'));
  data.product.metafields.custom.shipping_returns_ar = { type: 'rich_text_field', fixture_html: '<p>إجابة خاصة بهذا المنتج</p>' };
  const settings = { heading_en: 'Shipping', heading_ar: 'الشحن', source: 'metafield', metafield_namespace: 'custom', metafield_key: 'shipping_returns', metafield_key_ar: 'shipping_returns_ar', content_ar: '<p>Fallback</p>' };
  const html = await renderSection('main', { type: 'product', settings: { show_dynamic_checkout: false }, blocks: { shipping: { type: 'accordion', settings }, blank: { type: 'accordion', settings: { heading_en: 'Empty', source: 'editor', content_en: '', content_ar: '' } } }, block_order: ['shipping', 'blank'] }, data);
  assert.match(html, /إجابة خاصة بهذا المنتج/);
  assert.doesNotMatch(html, /Fallback|<summary>Empty/);
  assert.match(html, /اللوحات الفنية/);
  delete data.product.metafields.custom.shipping_returns_ar;
  const baseField = await renderSection('main', { type: 'product', blocks: { shipping: { type: 'accordion', settings } }, block_order: ['shipping'] }, data);
  assert.match(baseField, /محتوى تجريبي لسياسة الشحن والإرجاع/);
  assert.doesNotMatch(baseField, /Fallback/);
  const companions = data.product.metafields.custom.frequently_bought_together.value;
  companions[1] = { ...companions[1], metafields: { custom: { personalization_required: { value: true } } } };
  const bundle = new JSDOM(await renderSection('bundle', { type: 'bought-together' }, data));
  t.after(() => bundle.window.close());
  assert.equal(bundle.window.document.querySelector('[data-product-id="2"] [data-bundle-check]').disabled, true);
  assert.match(bundle.window.document.querySelector('[data-product-id="2"]').textContent, /افتح المنتج لإضافة التخصيص المطلوب/);
  const fallback = await page(new URL(origin + '/product'));
  assert.match(fallback, /product-options-native/);
  assert.match(fallback, /option_values=/);
});

test('all default accordions show editable bilingual fallbacks for missing product answers; new blocks get a default', async t => {
  const template = JSON.parse(fs.readFileSync(path.join(__dirname, '../templates/product.json'), 'utf8').replace(/^\/\*[\s\S]*?\*\//, ''));
  for (const locale of ['en', 'ar']) {
    const data = pageData(new URL(origin + (locale === 'ar' ? '/ar/product' : '/product')));
    data.product.description = '<p> </p>';
    data.product.metafields = { custom: { shipping_returns: { type: 'rich_text_field', fixture_html: '<div><p></p></div>' } } };
    const dom = new JSDOM(await renderSection('main', template.sections.main, data));
    t.after(() => dom.window.close());
    assert.equal(dom.window.document.querySelectorAll('[data-product-accordion]').length, 5);
    for (const id of template.sections.main.block_order) {
      const expected = template.sections.main.blocks[id].settings['content_' + locale];
      assert.ok(expected);
      assert.equal(dom.window.document.getElementById('ProductDetail-main-' + id).innerHTML, expected);
    }
    const added = await renderSection('main', { type: 'product', blocks: { new: { type: 'accordion', settings: {} } }, block_order: ['new'] }, data);
    assert.match(added, locale === 'ar' ? /تواصل معنا إذا كانت لديك أسئلة عن هذا المنتج/ : /Contact us if you have questions about this product/);
    data.product.description = '<p><img src="/fixture-art.svg" alt="Product detail"></p>';
    const imageOnly = await renderSection('main', template.sections.main, data);
    assert.match(imageOnly, /alt="Product detail"/);
  }
});
