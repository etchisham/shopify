const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('../.preview/node_modules/jsdom');
const { server, page } = require('../scripts/preview.cjs');
const source = name => fs.readFileSync(path.join(__dirname, '../assets', name + '.js'), 'utf8');
let origin;

test.before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => new Promise(resolve => server.close(resolve)));

async function setup(t, route = '/pages/wishlist', records = []) {
  const url = origin + route;
  const dom = new JSDOM(await page(new URL(url)), { url, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {} });
  dom.window.localStorage.setItem('theme:saved-products', JSON.stringify(records));
  dom.window.eval(source('theme'));
  dom.window.eval(source('wishlist'));
  return dom.window.document;
}

test('header renders all-products, every category, AR/EN switcher, and wishlist count', async t => {
  const records = [{ id: '1', title: 'Tell me I can', url: '/products/example-1', image: '/fixture-art.svg', price: '$559.00', vendor: 'Example Studio' }];
  const document = await setup(t, '/pages/wishlist', records);
  assert.equal(document.querySelector('.drawer-navigation__all').textContent.trim(), 'All products');
  assert.deepEqual([...document.querySelectorAll('.drawer-navigation__categories a')].map(link => link.textContent.trim().replace(/\s+\d+$/, '')), ['Wall art', 'Sports', 'Motivational']);
  assert.deepEqual([...document.querySelectorAll('.header-language button')].map(button => button.textContent), ['EN', 'AR']);
  assert.equal(document.querySelector('.site-header__wishlist').getAttribute('href'), '/pages/wishlist');
  assert.equal(document.querySelector('[data-wishlist-count]').textContent, '1');
  assert.equal(document.querySelector('[data-wishlist-count]').hidden, false);
});

test('wishlist renders saved product data and removal updates empty state and global count', async t => {
  const records = [{ id: '1', title: 'Tell me I can', url: '/products/example-1', image: '/fixture-art.svg', price: '$559.00', vendor: 'Example Studio' }];
  const document = await setup(t, '/pages/wishlist', records);
  assert.equal(document.querySelector('.wishlist-card h2').textContent, 'Tell me I can');
  assert.equal(document.querySelector('.wishlist-card__vendor').textContent, 'Example Studio');
  assert.equal(document.querySelector('.wishlist-card__price').textContent, '$559.00');
  document.querySelector('.wishlist-card__remove').click();
  assert.equal(document.querySelector('[data-wishlist-grid]').hidden, true);
  assert.equal(document.querySelector('[data-wishlist-empty]').hidden, false);
  assert.equal(document.querySelector('[data-wishlist-count]').hidden, true);
  assert.deepEqual(JSON.parse(document.defaultView.localStorage.getItem('theme:saved-products')), []);
});

test('Arabic wishlist uses localized labels and localized catalog links', async t => {
  const document = await setup(t, '/ar/pages/wishlist');
  assert.equal(document.documentElement.dir, 'rtl');
  assert.match(document.querySelector('.wishlist-page__header h1').textContent, /المفضلة/);
  assert.equal(document.querySelector('.drawer-navigation__all').getAttribute('href'), '/ar/home#shop');
  assert.equal(document.querySelector('.site-header__wishlist').getAttribute('href'), '/ar/pages/wishlist');
});
