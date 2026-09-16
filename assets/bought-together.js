(() => {
  function bind(scope = document) {
    scope.querySelectorAll('[data-bought-together]').forEach(section => {
      if (section.dataset.bound) return;
      section.dataset.bound = 'true';
      const items = [...section.querySelectorAll('[data-bundle-item]')];
      const button = section.querySelector('[data-bundle-add]');
      const formatter = new Intl.NumberFormat(document.documentElement.lang, { style: 'currency', currency: section.dataset.currency || 'USD' });
      const money = cents => {
        const format = section.dataset.moneyFormat;
        const tokens = {
          amount: (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          amount_no_decimals: Math.round(cents / 100).toLocaleString('en-US'),
          amount_with_comma_separator: (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          amount_no_decimals_with_comma_separator: Math.round(cents / 100).toLocaleString('de-DE'),
          amount_with_space_separator: (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          amount_no_decimals_with_space_separator: Math.round(cents / 100).toLocaleString('fr-FR'),
          amount_with_apostrophe_separator: (cents / 100).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        };
        if (!format || !/\{\{\s*(\w+)\s*\}\}/.test(format)) return formatter.format(cents / 100);
        const html = format.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token) => tokens[token] ?? formatter.format(cents / 100));
        return new DOMParser().parseFromString(html, 'text/html').body.textContent;
      };
      const update = () => {
        let count = 0, total = 0;
        items.forEach(item => {
          const select = item.querySelector('[data-bundle-variant]');
          const option = select.selectedOptions[0];
          const checkbox = item.querySelector('[data-bundle-check]');
          checkbox.disabled = select.disabled || !option || option.disabled;
          if (checkbox.disabled) checkbox.checked = false;
          const price = Number(option?.dataset.price || 0) * Number(option?.dataset.min || 1);
          item.querySelector('[data-bundle-price]').textContent = money(price);
          if (checkbox.checked && !checkbox.disabled) { count += 1; total += price; }
        });
        section.querySelector('[data-bundle-total]').textContent = money(total);
        section.querySelector('[data-add-label]').textContent = count ? section.dataset.buttonLabel.replace('__count__', count) : section.dataset.emptyLabel;
        button.disabled = count === 0 || section.querySelector('form').getAttribute('aria-busy') === 'true';
      };
      section.addEventListener('change', update);
      const mainVariant = document.querySelector('.product-form [name="id"]');
      const current = section.querySelector('[data-bundle-current] [data-bundle-variant]');
      if (mainVariant && current) {
        mainVariant.addEventListener('change', () => { current.value = mainVariant.value; update(); });
      }
      update();
    });
  }
  bind();
  document.addEventListener('theme:product-variant', event => {
    const variant = event.detail;
    if (!variant) return;
    document.querySelectorAll('[data-bundle-current]').forEach(item => {
      if (item.dataset.productId !== String(variant.productId)) return;
      const select = item.querySelector('[data-bundle-variant]');
      let option = [...select.options].find(option => option.value === String(variant.variantId));
      if (!option) { option = document.createElement('option'); option.value = variant.variantId || ''; select.append(option); }
      option.textContent = variant.title || '';
      option.dataset.price = variant.price || '0';
      option.dataset.min = variant.minimum || '1';
      option.disabled = !variant.available;
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  document.addEventListener('shopify:section:load', event => bind(event.target));
})();
