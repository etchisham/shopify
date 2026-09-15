// One-time structured locale update; preserve Shopify's generated-file header.
const fs = require('node:fs');
const path = require('node:path');
function update(file, change) {
  const target = path.join(__dirname, '..', file);
  const source = fs.readFileSync(target, 'utf8');
  const prefix = source.match(/^\s*\/\*[\s\S]*?\*\/\s*/)?.[0] || '';
  const value = JSON.parse(source.slice(prefix.length));
  change(value);
  fs.writeFileSync(target, prefix + JSON.stringify(value, null, 2) + '\n');
}
for (const ar of [false, true]) {
  update(ar ? 'locales/ar.json' : 'locales/en.default.json', value => {
    value.accessibility.opens_in_new_tab = ar ? 'يفتح في علامة تبويب جديدة' : 'Opens in a new tab';
    Object.assign(value.newsletter, ar ? {
      success: 'تم اشتراكك بنجاح.', loading: 'جارٍ الاشتراك…',
      request_error: 'تعذر تأكيد الاشتراك. تحقق من اتصالك وحاول مرة أخرى.',
      verification: 'أكمل التحقق أدناه لتأكيد اشتراكك.', cancel: 'إلغاء التحقق'
    } : {
      success: 'You have been subscribed successfully.', loading: 'Subscribing…',
      request_error: 'Unable to confirm your subscription. Check your connection and try again.',
      verification: 'Complete the verification below to confirm your subscription.', cancel: 'Cancel verification'
    });
    value.cart.added_multiple = ar ? 'تمت إضافة {{ titles }} إلى سلتك' : '{{ titles }} added to your cart';
    value.products.bundle = ar ? {
      heading: 'منتجات تُشترى معًا', include: 'تضمين {{ title }}', variant: 'اختر خيار {{ title }}',
      this_item: 'هذا المنتج', total: 'السعر الإجمالي', add_selected: 'أضف المنتجات المحددة ({{ count }}) إلى السلة',
      select_products: 'اختر منتجًا واحدًا على الأقل', adding: 'جارٍ الإضافة…',
      price_note: 'الضرائب والشحن والخصومات المتاحة تُحسب عند إتمام الشراء.',
      no_javascript: 'افتح كل منتج لإضافته إلى السلة.', subscription_options: 'افتح المنتج لاختيار الاشتراك.',
      editor_setup: 'اختر المنتجات في إعدادات القسم أو في الحقل المخصص custom.frequently_bought_together لكل منتج.'
    } : {
      heading: 'Frequently bought together', include: 'Include {{ title }}', variant: 'Choose an option for {{ title }}',
      this_item: 'This item', total: 'Total price', add_selected: 'Add selected products ({{ count }}) to cart',
      select_products: 'Select at least one product', adding: 'Adding…',
      price_note: 'Taxes, shipping and eligible discounts calculated at checkout.',
      no_javascript: 'Open each product to add it to your cart.', subscription_options: 'Open this product to choose subscription options.',
      editor_setup: 'Choose products in this section or the custom.frequently_bought_together product metafield.'
    };
    value.help = ar ? { eyebrow: 'مركز المساعدة', heading: 'الأسئلة الشائعة', topics: 'مواضيع المساعدة' }
      : { eyebrow: 'Help center', heading: 'Frequently asked questions', topics: 'Help topics' };
  });
  update(ar ? 'locales/ar.schema.json' : 'locales/en.default.schema.json', value => {
    value.bought_together = ar ? {
      name: 'منتجات تُشترى معًا', products: 'المنتجات المصاحبة',
      products_info: 'منتجات افتراضية للقالب. لتخصيص كل منتج، أنشئ حقل المنتجات المخصص custom.frequently_bought_together من نوع قائمة منتجات.'
    } : {
      name: 'Bought together', products: 'Companion products',
      products_info: 'Template fallback. For individual products, define custom.frequently_bought_together as a list of product references.'
    };
    value.footer_social = ar ? { name: 'رابط تواصل اجتماعي', platform: 'المنصة', url: 'الرابط' }
      : { name: 'Social link', platform: 'Platform', url: 'Link' };
    value.help_page = ar ? {
      name: 'صفحة مساعدة', eyebrow_en: 'عنوان صغير — الإنجليزية', eyebrow_ar: 'عنوان صغير — العربية',
      heading_info: 'اتركه فارغًا لاستخدام عنوان كل صفحة وترجمته.',
      introduction_en: 'المقدمة — الإنجليزية', introduction_ar: 'المقدمة — العربية',
      topic_navigation: 'عرض روابط المواضيع', page_content: 'استخدام محتوى الصفحة',
      page_content_info: 'محتوى مستقل لكل صفحة من المتجر > الصفحات. استخدم H2 للمواضيع وH3 للأسئلة، ثم ترجم الصفحة. إذا كان فارغًا، تُعرض كتل الأسئلة أدناه.',
      question: 'سؤال', category_en: 'الموضوع — الإنجليزية', category_ar: 'الموضوع — العربية',
      question_en: 'السؤال — الإنجليزية', question_ar: 'السؤال — العربية', answer_en: 'الإجابة — الإنجليزية', answer_ar: 'الإجابة — العربية'
    } : {
      name: 'Help page', eyebrow_en: 'Eyebrow — English', eyebrow_ar: 'Eyebrow — Arabic',
      heading_info: 'Leave blank to use each page’s translated title.',
      introduction_en: 'Introduction — English', introduction_ar: 'Introduction — Arabic',
      topic_navigation: 'Show topic links', page_content: 'Use page content',
      page_content_info: 'Unique content per page from Online Store > Pages. Use H2 for topics and H3 for questions, then translate the page. Empty content uses the FAQ blocks below.',
      question: 'Question', category_en: 'Topic — English', category_ar: 'Topic — Arabic',
      question_en: 'Question — English', question_ar: 'Question — Arabic', answer_en: 'Answer — English', answer_ar: 'Answer — Arabic'
    };
  });
}
