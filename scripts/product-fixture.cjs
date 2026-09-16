// Sample product content and media, only for the local preview/test server.
const { products } = require('./cart-fixture.cjs');
function productFor(url, locale) {
  const id = Number(url.pathname.match(/example-(\d+)/)?.[1] || 1);
  const base = products.find(product => product.id === id) || products[0];
  const ar = locale === 'ar', prefix = ar ? '/ar' : '';
  const media = Array.from({ length: 9 }, (_, index) => ({ id: base.id * 10 + index + 1, media_type: 'image', alt: `${base.title} — sample view ${index + 1}`, preview_image: { src: `/fixture-art.svg?view=${index + 1}`, alt: base.title } }));
  const variants = base.variants.map((variant, index) => ({ ...variant, compare_at_price: variant.price + 14000, featured_media: media[index] }));
  let selected = variants[0];
  if (url.searchParams.has('variant')) selected = variants.find(variant => variant.id === Number(url.searchParams.get('variant'))) || null;
  const finishIds = [id * 1000 + 101, id * 1000 + 102], sizeIds = [id * 1000 + 201, id * 1000 + 202];
  let selectedOptions = selected?.options || [];
  if (url.searchParams.has('option_values')) {
    const values = url.searchParams.get('option_values').split(',').map(Number);
    selectedOptions = [['Canvas', 'Framed canvas'][finishIds.indexOf(values[0])], ['48 × 24', '24 × 12'][sizeIds.indexOf(values[1])]];
    selected = variants.find(variant => variant.options.every((value, index) => value === selectedOptions[index])) || null;
  }
  const options = [
    { position: 1, name: ar ? 'التشطيب' : 'Finish', values: ['Canvas', 'Framed canvas'].map((name, index) => ({ id: finishIds[index], name, selected: selectedOptions[0] === name, available: variants.some(variant => variant.options[0] === name && variant.available) })) },
    { position: 2, name: ar ? 'المقاس' : 'Size', values: ['48 × 24', '24 × 12'].map((name, index) => ({ id: sizeIds[index], name, selected: selectedOptions[1] === name, available: variants.some(variant => variant.options[0] === selectedOptions[0] && variant.options[1] === name && variant.available) })) }
  ];
  const field = text => ({ type: 'single_line_text_field', value: text, fixture_html: `<span>${text}</span>` });
  const rich = html => ({ type: 'rich_text_field', fixture_html: html });
  const description = ar ? '<p>حوّل مساحتك إلى قصة تُعبّر عنك.</p><p>هذا وصف منتج تجريبي، قابل للتعديل من صفحة إنشاء المنتج.</p><p>أضف تفاصيل التصميم والخامات والمقاسات الحقيقية هنا. تتغير الصور وخيارات المنتج حسب بيانات المتجر.</p><p>استخدم محتوى كل منتج للإجابة عن أسئلة المشتري حول التركيب والعناية والتخصيص.</p><p>لا يمثل هذا المحتوى سياسة بيع أو وعدًا فعليًا.</p>' : '<p>Make your space tell your story.</p><p>This is sample product content, editable on the product creation page.</p><p>Add your actual design, materials, dimensions, and finish information here. Product photos and purchase options come from your catalog.</p><p>Explain the details shoppers need to choose confidently: installation, care, packaging, personalization, and what is included.</p><p>Each product can carry its own description and information fields.</p><p>This local sample does not represent an actual sales policy.</p>';
  return { ...base, url: prefix + base.url, vendor: 'Example Studio', media, featured_media: media[0], featured_image: media[0].preview_image, variants, selected_or_first_available_variant: selected, selected_variant: selected, options_with_values: options, collections: [{ title: ar ? 'اللوحات الفنية' : 'Wall art', url: prefix + '/collections/wall-art' }], description, metafields: { custom: {
    frequently_bought_together: { value: [base, products[1], products[2], products[8]] },
    materials: field(ar ? 'خامات تجريبية: قماش وإطار' : 'Sample materials: canvas and frame'),
    personalization_prompt: field(ar ? 'مثال: أدخل النص الذي تود تخصيصه.' : 'Example: enter the text you would like personalized.'),
    personalization_required: { type: 'boolean', value: url.searchParams.get('personalization') === 'required' },
    shipping_returns: rich(ar ? '<p>محتوى تجريبي لسياسة الشحن والإرجاع لهذا المنتج.</p><p>أضف المواعيد والتكلفة وشروط الإرجاع المعتمدة من صفحة المنتج.</p>' : '<p>Sample shipping and return content for this product.</p><p>Add your verified delivery, cost, and return terms on the product admin page.</p>'),
    material_care: rich(ar ? '<p>أضف تعليمات العناية المعتمدة الخاصة بخامات هذا المنتج هنا.</p>' : '<p>Add the verified care instructions for this product’s materials here.</p>'),
    did_you_know: rich(ar ? '<p>يمكن تغيير عنوان كل قسم ومصدر محتواه من محرر القالب.</p>' : '<p>Each accordion label and content source can be changed in the theme editor.</p>'),
    about_seller: rich(ar ? '<p>أضف قصة علامتك التجارية وتفاصيل التواصل الفعلية هنا.</p>' : '<p>Add your brand story and actual contact details here.</p>')
  } } };
}
module.exports = { productFor };
