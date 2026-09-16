// Local visual fixtures, not a Shopify storefront. Forms stay on this local server.
// npm install --prefix .preview --no-save --package-lock=false liquidjs
// node scripts/preview.cjs
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { Liquid } = require('../.preview/node_modules/liquidjs');
const cartFixture = require('./cart-fixture.cjs');
const { productFor } = require('./product-fixture.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const named = args => Object.fromEntries(args.filter(Array.isArray));
const defaults = settings => Object.fromEntries(settings.filter(setting => setting.id).map(setting => [setting.id, setting.default ?? '']));
const engine = new Liquid({ root: path.join(root, 'snippets'), extname: '.liquid' });
engine.registerTag('doc', { parse(_token, tokens) { let token; while ((token = tokens.shift())) { if (token.name === 'enddoc') break; } }, render() { return ''; } });
engine.registerTag('stylesheet', { parse(_token, tokens) { let token; while ((token = tokens.shift())) { if (token.name === 'endstylesheet') break; } }, render() { return ''; } });
const schemaOf = file => JSON.parse(read(file).match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
const strip = source => source.replace(/{% (schema|stylesheet) %}[\s\S]*?{% end\1 %}/g, '').replace(/{% style %}/g, '<style>').replace(/{% endstyle %}/g, '</style>').replace(/{% form ([\s\S]*?)%}/g, (_tag, arguments) => {
  if (arguments.trim().startsWith("'customer'")) return '<form action="{{ routes.root_url }}contact" method="post" id="FooterNewsletter-{{ section.id }}" class="site-footer__newsletter-form" data-newsletter-form><input type="hidden" name="form_type" value="customer">';
  if (arguments.trim().startsWith("'product'")) return '<form action="{{ routes.cart_add_url }}" method="post" id="ProductForm-{{ section.id }}" class="product-form" data-product-title="{{ product.title | escape }}">';
  if (arguments.trim().startsWith("'localization'")) return '<form action="/fixture-submit" method="get" id="HeaderLanguageForm" class="header-language">';
  return '<form action="/fixture-submit" method="get">';
}).replace(/{% endform %}/g, '</form>');
const fonts = { family: 'Arial', fallback_families: 'sans-serif', style: 'normal', weight: 400 };
const settings = Object.assign({}, ...json('config/settings_schema.json').filter(group => group.settings).map(group => defaults(group.settings)), json('config/settings_data.json').current);
Object.assign(settings, { type_body_font: fonts, type_heading_font: fonts, support_whatsapp_url: 'https://wa.me/', support_email: 'support@example.test', support_phone: '+00 000 000 000' });
engine.registerFilter('asset_url', value => '/assets/' + value);
engine.registerFilter('stylesheet_tag', value => `<link rel="stylesheet" href="${escape(value)}">`);
engine.registerFilter('image_url', value => value?.src || value);
engine.registerFilter('image_tag', (value, ...args) => { const options = named(args); return `<img src="${escape(value)}" width="1600" height="1000" alt="${escape(options.alt)}" loading="${options.loading || 'lazy'}">`; });
engine.registerFilter('placeholder_svg_tag', (value, className = '') => `<svg class="${escape(className)}" viewBox="0 0 600 480" role="img" aria-label="Preview placeholder"><rect width="600" height="480" fill="#e8e8e8"/><rect x="120" y="70" width="360" height="330" fill="#fff" stroke="#bbb" stroke-width="8"/><text x="300" y="220" text-anchor="middle" font-size="34" font-family="Arial" fill="#222">YOUR ART</text><text x="300" y="260" text-anchor="middle" font-size="16" font-family="Arial" fill="#555">Image placeholder</text></svg>`);
engine.registerFilter('font_face', () => '');
engine.registerFilter('font_modify', value => value);
engine.registerFilter('money', value => '$' + (Number(value || 0) / 100).toFixed(2));
engine.registerFilter('money_with_currency', value => '$' + (Number(value || 0) / 100).toFixed(2) + ' USD');
engine.registerFilter('metafield_tag', value => value?.fixture_html || escape(value?.value || ''));
engine.registerFilter('t', function (key, ...args) {
  const locale = this.context.get(['request', 'locale', 'iso_code']);
  const dictionary = json(locale === 'ar' ? 'locales/ar.json' : 'locales/en.default.json');
  const values = named(args);
  return String(key.split('.').reduce((value, part) => value?.[part], dictionary) || key).replace(/{{\s*(\w+)\s*}}/g, (_, name) => escape(values[name]));
});
function sectionData(id, entry) {
  const schema = schemaOf('sections/' + entry.type + '.liquid');
  return { id, settings: { ...defaults(schema.settings || []), ...entry.settings }, blocks: (entry.block_order || []).map(blockId => {
    const block = entry.blocks[blockId], definition = schema.blocks.find(item => item.type === block.type);
    return { id: blockId, type: block.type, settings: { ...defaults(definition.settings), ...block.settings }, shopify_attributes: '' };
  }) };
}
async function renderSection(id, entry, data) {
  const section = sectionData(id, entry);
  if (entry.type === 'home-slideshow') section.blocks.forEach(block => { block.settings.image = { src: '/fixture-art.svg' }; });
  if (entry.type === 'collection-tabs') section.blocks.forEach(block => { block.settings.collection = ''; });
  if (entry.type === 'header') {
    const ar = data.request.locale.iso_code === 'ar';
    section.settings.desktop_menu = { links: [{ title: ar ? 'الرئيسية' : 'Home', url: '/home' }, { title: ar ? 'المنتجات' : 'Catalog', url: '/home#shop' }, { title: ar ? 'تواصل معنا' : 'Contact', url: '/contact' }] };
    section.settings.mobile_menu = section.settings.desktop_menu;
  }
  return `<div class="shopify-section" id="shopify-section-${id}">${await engine.parseAndRender(strip(read('sections/' + entry.type + '.liquid')), { ...data, section }, { globals: data })}</div>`;
}
function pageData(url, newsletterResult) {
  const locale = url.searchParams.get('lang') === 'ar' || url.pathname.startsWith('/ar/') ? 'ar' : 'en';
  const prefix = locale === 'ar' ? '/ar' : '';
  const product = productFor(url, locale);
  const isProduct = /\/product(?:s\/|$)/.test(url.pathname);
  const isHelp = /\/(help|shipping|returns|care)$/.test(url.pathname);
  const isWishlist = url.pathname.endsWith('/pages/wishlist') || url.pathname.endsWith('/wishlist');
  const care = url.pathname.endsWith('/care');
  const content = care ? (locale === 'ar' ? '<h2>العناية بالخامات</h2><h3>كيف أعتني بالمنتج؟</h3><p>محتوى تجريبي مستقل لصفحة العناية بالخامات.</p>' : '<h2>Material care</h2><h3>How do I care for my art?</h3><p>Independent sample content for the material care page.</p>') : (locale === 'ar' ? '<h2>الطلبات</h2><h3>كيف أتابع طلبي؟</h3><p>أضف معلومات تتبع الطلب المعتمدة هنا.</p><h3>هل يمكنني تعديل طلبي؟</h3><p>أضف تفاصيل التواصل وسياسة تعديل الطلب هنا.</p><h2>الشحن والإرجاع</h2><h3>أين أجد معلومات الشحن؟</h3><p>أضف معلومات الشحن والإرجاع الفعلية هنا.</p>' : '<h2>Orders</h2><h3>How do I track my order?</h3><p>Add your verified order tracking information here.</p><h3>Can I change my order?</h3><p>Add your contact details and actual order change policy here.</p><h2>Shipping and returns</h2><h3>Where can I find shipping information?</h3><p>Add your actual shipping and return information here.</p>');
  const categoryList = [
    { handle: 'wall-art', title: locale === 'ar' ? 'لوحات جدارية' : 'Wall art', url: prefix + '/collections/wall-art', all_products_count: 12 },
    { handle: 'sports', title: locale === 'ar' ? 'الرياضة' : 'Sports', url: prefix + '/collections/sports', all_products_count: 8 },
    { handle: 'motivational', title: locale === 'ar' ? 'تحفيزية' : 'Motivational', url: prefix + '/collections/motivational', all_products_count: 6 }
  ];
  categoryList.all = { products: cartFixture.products };
  return { settings, product, page: { title: care ? (locale === 'ar' ? 'العناية بالخامات' : 'Material care') : (locale === 'ar' ? 'الأسئلة الشائعة' : 'Frequently asked questions'), content }, request: { locale: { iso_code: locale }, design_mode: false, page_type: url.pathname.endsWith('/cart') ? 'cart' : isProduct ? 'product' : isHelp || isWishlist ? 'page' : 'index' }, localization: { available_languages: [{ iso_code: 'en' }, { iso_code: 'ar' }] }, pages: { wishlist: { url: prefix + '/pages/wishlist' } }, shop: { name: 'My Store', currency: 'USD', money_format: '${{amount}}', customer_accounts_enabled: false }, cart: cartFixture.cart(), collections: categoryList, recommendations: { performed: true, products_count: cartFixture.products.length, products: cartFixture.products }, form: newsletterResult === 'success' ? { 'posted_successfully?': true } : newsletterResult === 'error' ? { errors: true } : {}, customer: {}, routes: { root_url: prefix + '/', search_url: prefix + '/home#search', cart_url: prefix + '/cart', cart_add_url: prefix + '/cart/add', all_products_collection_url: prefix + '/home#shop' } };
}
const drawer = data => renderSection('cart-drawer', { type: 'cart-drawer', settings: {} }, data);
async function page(url, newsletterResult) {
  const data = pageData(url, newsletterResult);
  const locale = data.request.locale.iso_code;
  const contact = url.pathname.endsWith('/contact');
  const isProduct = data.request.page_type === 'product';
  const isHelp = data.request.page_type === 'page';
  const isWishlist = url.pathname.endsWith('/pages/wishlist') || url.pathname.endsWith('/wishlist');
  const productTemplate = json('templates/product.json');
  const template = isProduct ? { sections: { main: { ...productTemplate.sections.main, settings: { ...productTemplate.sections.main.settings, show_dynamic_checkout: false } }, bought_together: productTemplate.sections.bought_together }, order: ['main', 'bought_together'] } : json(isWishlist ? 'templates/page.wishlist.json' : isHelp ? 'templates/page.help.json' : contact ? 'templates/page.contact.json' : 'templates/index.json');
  const group = json('sections/header-group.json');
  const header = await Promise.all(group.order.map(id => renderSection(id, group.sections[id], data)));
  const sections = await Promise.all(template.order.map(id => renderSection(id, template.sections[id], data)));
  const variables = await engine.parseAndRender(strip(read('snippets/css-variables.liquid')), data);
  const widget = await engine.parseAndRender(read('snippets/support-widget.liquid'), data);
  const cart = await drawer(data);
  const footerGroup = json('sections/footer-group.json');
  const platforms = ['facebook', 'instagram', 'youtube', 'tiktok', ...(url.searchParams.has('socials') ? ['pinterest', 'linkedin', 'x', 'whatsapp'] : [])];
  const socialBlocks = Object.fromEntries(platforms.map(platform => [platform, { type: 'social', settings: { platform, url: `https://${platform === 'whatsapp' ? 'wa.me' : platform + '.com'}/` } }]));
  const footer = await Promise.all(footerGroup.order.map(id => renderSection(id, { ...footerGroup.sections[id], blocks: socialBlocks, block_order: platforms }, data)));
  const addForm = `<form action="${locale === 'ar' ? '/ar' : ''}/cart/add" method="post" data-product-title="Frozen in time" style="padding:24px"><h2>Local cart fixture</h2><input type="hidden" name="id" value="3"><input type="hidden" name="quantity" value="1"><button class="button" name="add" type="submit">${locale === 'ar' ? 'أضف إلى السلة' : 'Add Frozen in time to cart'}</button></form>`;
  const sectionStyles = ['sections/header.liquid', 'sections/announcement-bar.liquid', 'sections/contact.liquid', 'sections/footer.liquid', 'sections/product.liquid', 'snippets/price.liquid', 'snippets/image.liquid', 'snippets/product-card.liquid'].map(file => read(file).match(/{% stylesheet %}([\s\S]*?){% endstylesheet %}/)?.[1] || '').join('\n');
  return `<!doctype html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Local ${isProduct ? 'product' : isWishlist ? 'wishlist' : isHelp ? 'help' : contact ? 'contact' : 'home'} fixture</title>${variables}<link rel="stylesheet" href="/assets/critical.css"><link rel="stylesheet" href="/assets/home.css"><link rel="stylesheet" href="/assets/cart-drawer.css">${isProduct ? '<link rel="stylesheet" href="/assets/product.css"><script src="/assets/product.js" defer></script><link rel="stylesheet" href="/assets/bought-together.css"><script src="/assets/bought-together.js" defer></script>' : ''}${isWishlist ? '<link rel="stylesheet" href="/assets/wishlist.css"><script src="/assets/wishlist.js" defer></script>' : ''}<style>${sectionStyles}</style><script src="/assets/theme.js" defer></script><script src="/assets/home.js" defer></script><script src="/assets/cart-drawer.js" defer></script><script src="/assets/newsletter.js" defer></script></head><body><p style="margin:0;padding:4px 16px;background:#fff5c5;color:#333;font-size:12px">LOCAL FIXTURE — sample content/images/links; cart and subscriptions stay local; checkout does not send.</p>${header.join('')}<main id="MainContent" class="main-content">${isProduct || isHelp ? '' : addForm}${sections.join('')}</main>${footer.join('')}${cart}<p role="status" data-live-region class="visually-hidden"></p>${widget}</body></html>`;
}
let checkoutPreview = {};
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1:4173');
    if (request.method === 'POST' && url.pathname.endsWith('/cart/add')) {
      const body = await cartFixture.bodyOf(request);
      const target = new URL(body.return_to || '/product', url);
      if (target.origin !== url.origin || !/^\/(?:ar\/)?checkout$/.test(target.pathname)) { response.writeHead(400); return response.end('Invalid local checkout target'); }
      checkoutPreview = body;
      response.writeHead(303, { Location: target.pathname });
      return response.end();
    }
    if (url.pathname.endsWith('/checkout')) {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      return response.end(`<!doctype html><html lang="${url.pathname.startsWith('/ar/') ? 'ar' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Local checkout preview</title></head><body><h1>Local checkout preview</h1><p>LOCAL FIXTURE — no orders or payments are created. Native product form values received:</p><dl>${Object.entries(checkoutPreview).map(([name, value]) => `<dt>${escape(name)}</dt><dd>${escape(value)}</dd>`).join('')}</dl><a href="${url.pathname.startsWith('/ar/') ? '/ar/product' : '/product'}">Back to product</a></body></html>`);
    }
    if (await cartFixture.handle(request, response, url, () => drawer(pageData(url)), () => renderSection('cart-recommendations', { type: 'cart-recommendations', settings: {} }, pageData(url)))) return;
    if (url.searchParams.has('section_id') && /\/product(?:s\/|$)/.test(url.pathname)) {
      const template = json('templates/product.json');
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(await renderSection(url.searchParams.get('section_id'), { ...template.sections.main, settings: { ...template.sections.main.settings, show_dynamic_checkout: false } }, pageData(url)));
      return;
    }
    if (request.method === 'POST' && url.pathname.endsWith('/contact')) {
      const body = await cartFixture.bodyOf(request);
      await new Promise(resolve => setTimeout(resolve, 300));
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(await page(url, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body['contact[email]'] || '') ? 'success' : 'error'));
      return;
    }
    if (url.pathname.startsWith('/assets/')) {
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(path.join(root, 'assets') + path.sep)) { response.writeHead(403); return response.end(); }
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'image/svg+xml');
      return response.end(fs.readFileSync(file));
    }
    if (url.pathname === '/fixture-art.svg') {
      response.setHeader('Content-Type', 'image/svg+xml');
      if (url.searchParams.has('view')) {
        const view = Math.max(1, Math.min(9, Number(url.searchParams.get('view')) || 1));
        const background = ['#ddd6c7', '#ddd0c0', '#d2d9d2', '#d4d6e0', '#e0d5d4', '#d2dfdf', '#e2ddcb', '#d9d1de', '#d8d8d8'][view - 1];
        return response.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200"><rect width="1200" height="1200" fill="${background}"/><rect x="300" y="150" width="600" height="900" fill="#1c2622" stroke="#fff" stroke-width="20"/><text x="600" y="505" text-anchor="middle" font-family="Arial" font-size="100" font-weight="bold" fill="#fff">MAKE</text><text x="600" y="630" text-anchor="middle" font-family="Arial" font-size="86" font-weight="bold" fill="#fff">IT YOURS</text><text x="600" y="930" text-anchor="middle" font-family="Arial" font-size="24" fill="#ccc">SAMPLE VIEW ${view}</text></svg>`);
      }
      return response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#d9d4c9"/><rect x="400" y="100" width="700" height="750" fill="#1c2622" stroke="#fff" stroke-width="20"/><text x="750" y="450" text-anchor="middle" font-family="Arial" font-size="110" font-weight="bold" fill="#fff">MAKE</text><text x="750" y="570" text-anchor="middle" font-family="Arial" font-size="110" font-weight="bold" fill="#fff">IT YOURS</text></svg>');
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(await page(url));
  } catch (error) { response.writeHead(500); response.end(String(error)); }
});
if (require.main === module) server.listen(4173, '127.0.0.1', () => console.log('Local fixtures: http://127.0.0.1:4173/product, /help, /care, /home and /contact; add ?lang=ar'));
module.exports = { server, page, renderSection, pageData };
