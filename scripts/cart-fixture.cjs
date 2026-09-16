// In-memory cart for local visual checks. No Shopify writes or checkout requests.
const products = Array.from({ length: 9 }, (_, index) => ({
  id: index + 1,
  title: ['Tell me I can', 'Elevation', 'Frozen in time', 'Own your moment', 'Make it happen', 'Keep moving', 'The next chapter', 'Dream bigger', 'Stay focused'][index],
  url: '/products/example-' + (index + 1),
  available: index !== 8,
  price: index === 0 ? 55900 : index === 1 ? 43800 : 18900,
  price_varies: index > 1,
  featured_image: { src: '/fixture-art.svg', alt: 'Local example art' },
  has_only_default_variant: false
}));
products.forEach(product => {
  product.requires_selling_plan = false;
  product.metafields = {};
  product.variants = [
    { id: product.id, title: 'Canvas / 48 × 24', price: product.price, available: product.available, quantity_rule: { min: 1, increment: 1, max: 5 } },
    { id: product.id + 100, title: 'Framed canvas / 48 × 24', price: product.price + 5000, available: product.available, quantity_rule: { min: 1, increment: 1, max: 5 } }
  ];
  product.variants[0].options = ['Canvas', '48 × 24'];
  product.variants[1].options = ['Framed canvas', '48 × 24'];
  product.variants.push(
    { id: product.id + 200, title: 'Canvas / 24 × 12', options: ['Canvas', '24 × 12'], price: product.price - 10000, available: product.available, quantity_rule: { min: 2, increment: 2, max: 4 } },
    { id: product.id + 300, title: 'Framed canvas / 24 × 12', options: ['Framed canvas', '24 × 12'], price: product.price - 5000, available: product.available && product.id !== 1, quantity_rule: { min: 1, increment: 1, max: 5 } }
  );
  product.selected_or_first_available_variant = product.variants[0];
});
let items;
let discount;
function line(product, quantity = 1, variant = product.variants[0]) {
  return {
    key: variant.id + ':fixture', product_id: product.id, product,
    product_title: product.title, title: product.title, url: product.url, image: product.featured_image,
    variant,
    quantity, properties: {}, original_line_price: variant.price * quantity,
    final_line_price: variant.price * quantity, line_level_discount_allocations: []
  };
}
function reset() { items = [line(products[0]), line(products[1])]; discount = ''; }
reset();
function cart() {
  const original = items.reduce((total, item) => total + item.original_line_price, 0);
  const saved = discount === 'SAVE10' ? Math.round(original * 0.1) : 0;
  return {
    items, item_count: items.reduce((total, item) => total + item.quantity, 0),
    original_total_price: original, total_price: original - saved, total_discount: saved,
    cart_level_discount_applications: saved ? [{ title: discount, total_allocated_amount: saved }] : [],
    discount_codes: discount ? [{ code: discount, applicable: saved > 0 }] : [], currency: 'USD'
  };
}
async function bodyOf(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  if (request.headers['content-type']?.includes('application/json')) return JSON.parse(body.toString());
  const form = await new Request('http://127.0.0.1', { method: 'POST', headers: request.headers, body }).formData();
  return Object.fromEntries(form);
}
async function handle(request, response, url, renderDrawer, renderRecommendations) {
  const pathname = url.pathname.replace(/^\/ar(?=\/)/, '');
  const send = data => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(data)); };
  if (pathname === '/fixture-reset') { reset(); send(cart()); return true; }
  if (pathname === '/cart.js') { send(cart()); return true; }
  if (pathname === '/cart' && url.searchParams.has('sections')) {
    send({ 'cart-drawer': await renderDrawer() }); return true;
  }
  if (pathname === '/recommendations/products') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(await renderRecommendations()); return true;
  }
  if (!/^\/cart\/(add|change|update)\.js$/.test(pathname)) return false;
  const body = await bodyOf(request);
  let added;
  if (pathname.includes('/add.')) {
    const staged = new Map(items.map(item => [item.variant.id, item]));
    const additions = [];
    for (const entry of body.items || [body]) {
      const product = products.find(product => product.variants.some(variant => variant.id === Number(entry.id)));
      const variant = product?.variants.find(variant => variant.id === Number(entry.id));
      const quantity = Number(entry.quantity || 1);
      const existing = staged.get(variant?.id);
      if (!variant?.available || !Number.isInteger(quantity) || quantity < 1 || (existing?.quantity || 0) + quantity > 5) {
        response.statusCode = 422; send({ status: 422, description: 'Only 5 items are available.' }); return true;
      }
      added = line(product, (existing?.quantity || 0) + quantity, variant);
      staged.set(variant.id, added);
      additions.push(added);
    }
    items = [...staged.values()];
    if (body.items) added = { items: additions };
  } else if (pathname.includes('/change.')) {
    const item = items.find(item => item.key === body.id);
    if (!item || body.quantity > 5) {
      response.statusCode = 422; send({ status: 422, description: 'Only 5 items are available.' }); return true;
    }
    if (body.quantity === 0) items = items.filter(candidate => candidate !== item);
    else items[items.indexOf(item)] = line(item.product, body.quantity, item.variant);
  } else {
    discount = body.discount.toUpperCase();
  }
  const result = added ? { ...added } : cart();
  if (body.sections) result.sections = { 'cart-drawer': await renderDrawer() };
  send(result);
  return true;
}
module.exports = { products, cart, handle, bodyOf };
