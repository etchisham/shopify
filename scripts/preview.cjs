// Local visual fixtures, not a Shopify storefront. No form submission or external messages.
// npm install --prefix .preview --no-save --package-lock=false liquidjs
// node scripts/preview.cjs
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { Liquid } = require('../.preview/node_modules/liquidjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const named = args => Object.fromEntries(args.filter(Array.isArray));
const defaults = settings => Object.fromEntries(settings.filter(setting => setting.id).map(setting => [setting.id, setting.default ?? '']));
const engine = new Liquid({ root: path.join(root, 'snippets'), extname: '.liquid' });
engine.registerTag('doc', { parse(_token, tokens) { let token; while ((token = tokens.shift())) { if (token.name === 'enddoc') break; } }, render() { return ''; } });
const schemaOf = file => JSON.parse(read(file).match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
const strip = source => source.replace(/{% (schema|stylesheet) %}[\s\S]*?{% end\1 %}/g, '').replace(/{% style %}/g, '<style>').replace(/{% endstyle %}/g, '</style>').replace(/{% form [\s\S]*?%}/g, '<form action="/fixture-submit" method="get">').replace(/{% endform %}/g, '</form>');
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
  return `<div class="shopify-section" id="shopify-section-${id}">${await engine.parseAndRender(strip(read('sections/' + entry.type + '.liquid')), { ...data, section })}</div>`;
}
async function page(url) {
  const locale = url.searchParams.get('lang') === 'ar' ? 'ar' : 'en';
  const data = { settings, request: { locale: { iso_code: locale }, design_mode: false }, shop: { name: 'My Store', customer_accounts_enabled: false }, cart: { item_count: 0 }, form: {}, customer: {}, routes: { root_url: '/home', search_url: '/home#search', cart_url: '/home#cart', all_products_collection_url: '/home#shop' } };
  const contact = url.pathname === '/contact';
  const template = json(contact ? 'templates/page.contact.json' : 'templates/index.json');
  const group = json('sections/header-group.json');
  const header = await Promise.all(group.order.map(id => renderSection(id, group.sections[id], data)));
  const sections = await Promise.all(template.order.map(id => renderSection(id, template.sections[id], data)));
  const variables = await engine.parseAndRender(strip(read('snippets/css-variables.liquid')), data);
  const widget = await engine.parseAndRender(read('snippets/support-widget.liquid'), data);
  const sectionStyles = ['sections/header.liquid', 'sections/announcement-bar.liquid', 'sections/contact.liquid', 'snippets/product-card.liquid'].map(file => read(file).match(/{% stylesheet %}([\s\S]*?){% endstylesheet %}/)?.[1] || '').join('\n');
  return `<!doctype html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Local ${contact ? 'contact' : 'home'} fixture</title>${variables}<link rel="stylesheet" href="/assets/critical.css"><link rel="stylesheet" href="/assets/home.css"><style>${sectionStyles}</style><script src="/assets/theme.js" defer></script><script src="/assets/home.js" defer></script></head><body><p style="margin:0;padding:4px 16px;background:#fff5c5;color:#333;font-size:12px">LOCAL FIXTURE — placeholder images/contact details; forms do not send.</p>${header.join('')}<main id="MainContent" class="main-content">${sections.join('')}</main><footer style="background:#111;color:#fff;padding:48px 20px;text-align:center">Existing storefront footer</footer>${widget}</body></html>`;
}
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1:4173');
    if (url.pathname.startsWith('/assets/')) {
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(path.join(root, 'assets') + path.sep)) { response.writeHead(403); return response.end(); }
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'image/svg+xml');
      return response.end(fs.readFileSync(file));
    }
    if (url.pathname === '/fixture-art.svg') {
      response.setHeader('Content-Type', 'image/svg+xml');
      return response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#d9d4c9"/><rect x="400" y="100" width="700" height="750" fill="#1c2622" stroke="#fff" stroke-width="20"/><text x="750" y="450" text-anchor="middle" font-family="Arial" font-size="110" font-weight="bold" fill="#fff">MAKE</text><text x="750" y="570" text-anchor="middle" font-family="Arial" font-size="110" font-weight="bold" fill="#fff">IT YOURS</text></svg>');
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(await page(url));
  } catch (error) { response.writeHead(500); response.end(String(error)); }
});
server.listen(4173, '127.0.0.1', () => console.log('Local fixtures: http://127.0.0.1:4173/home and /contact; add ?lang=ar'));
