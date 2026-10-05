/*
  Hilya quick view
  ----------------
  1. The "Add to cart" button on every card (any link with data-quick-view)
     opens a drawer with the
     options, the personalization fields (Name / Date / Letter) and Add to cart.
  2. Fixes the hover button that stayed visible after coming back to a page.

  Needs the window.hilyaQuickView settings from theme.liquid.
*/
(() => {
  if (window.hilyaQuickViewLoaded) return;
  window.hilyaQuickViewLoaded = true;

  const config = window.hilyaQuickView || {};
  const root = String(config.root || '/').replace(/\/?$/, '/');

  const text = Object.assign(
    {
      title: 'Choose options',
      close: 'Close',
      addToCart: 'Add to cart',
      soldOut: 'Sold out',
      viewDetails: 'View details',
      quantity: 'Quantity',
      decrease: 'Decrease quantity',
      increase: 'Increase quantity',
      personalization: 'Personalization',
      required: 'Required',
      name: 'Name',
      namePlaceholder: 'Enter the name',
      date: 'Date',
      letter: 'Letter',
      letterPlaceholder: 'One letter',
      letterError: 'Please enter one letter (Arabic or English).',
      loading: 'Loading...'
    },
    config.text || {}
  );


  /* =========================================
     HELPERS
  ========================================= */

  const el = (tag, attributes = {}, children = []) => {
    const node = document.createElement(tag);

    Object.entries(attributes).forEach(([name, value]) => {
      if (value === false || value === null || value === undefined) return;

      if (name === 'class') node.className = value;
      else if (name === 'text') node.textContent = value;
      else node.setAttribute(name, value === true ? '' : String(value));
    });

    [].concat(children).forEach((child) => {
      if (child !== null && child !== undefined && child !== false) node.append(child);
    });

    return node;
  };

  const icon = (markup) => {
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    return template.content.firstChild;
  };

  const group = (number, decimals = 2, thousands = ',', decimal = '.') => {
    const [whole, fraction = ''] = number.toFixed(decimals).split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);

    return decimals ? grouped + decimal + fraction : grouped;
  };

  const formatMoney = (cents) => {
    const value = Number(cents) / 100;
    const format = config.moneyFormat || '{{amount}}';

    return format.replace(/\{\{\s*(\w+)\s*\}\}/, (match, name) => {
      switch (name) {
        case 'amount_no_decimals':
          return group(value, 0);
        case 'amount_with_comma_separator':
          return group(value, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator':
          return group(value, 0, '.', ',');
        case 'amount_with_apostrophe_separator':
          return group(value, 2, "'", '.');
        default:
          return group(value);
      }
    });
  };

  const sizeImage = (src, width) => {
    if (!src) return '';

    try {
      const url = new URL(src, window.location.href);
      url.searchParams.set('width', width);
      return url.href;
    } catch (error) {
      return src;
    }
  };

  const priceNode = (price, compare) => {
    const wrapper = el('div', { class: 'price' }, [
      el('span', { class: 'price__current', text: formatMoney(price) })
    ]);

    if (Number(compare) > Number(price)) {
      wrapper.append(el('s', { class: 'price__compare', text: formatMoney(compare) }));
    }

    return wrapper;
  };

  const variantOptions = (variant) =>
    Array.isArray(variant.options)
      ? variant.options
      : [variant.option1, variant.option2, variant.option3].filter(
          (value) => value !== null && value !== undefined
        );

  const sameOptions = (variant, values) =>
    variantOptions(variant).every((value, index) => String(value) === String(values[index]));

  const optionName = (option) =>
    (typeof option === 'string' ? option : option && option.name) || '';


  /* =========================================
     DRAWER (built once)
  ========================================= */

  const closeIcon =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  const titleNode = el('h2', { class: 'quick-view__title', id: 'QuickViewTitle', text: text.title });

  const closeButton = el(
    'button',
    { type: 'button', class: 'quick-view__close', 'aria-label': text.close },
    icon(closeIcon)
  );

  const body = el('div', { class: 'quick-view__body' });

  const dialog = el(
    'dialog',
    { class: 'quick-view', 'aria-labelledby': 'QuickViewTitle' },
    [el('div', { class: 'quick-view__header' }, [titleNode, closeButton]), body]
  );

  document.body.append(dialog);

  let product = null;
  let variants = [];
  let selected = [];
  let opener = null;
  let requestId = 0;
  let ui = {};

  const lock = (on) => document.documentElement.classList.toggle('quick-view-lock', on);

  closeButton.addEventListener('click', () => dialog.close());

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', () => {
    requestId += 1;
    lock(false);

    if (opener && opener.isConnected) {
      opener.focus({ preventScroll: true });
    }

    opener = null;
  });

  /* The cart drawer finished adding the product: close this drawer */
  document.addEventListener('cart:updated', () => {
    if (dialog.open) dialog.close();
  });


  /* =========================================
     UPDATE THE DRAWER FOR THE CHOSEN VARIANT
  ========================================= */

  function update() {
    const variant = variants.find((item) => sameOptions(item, selected)) || variants[0];

    ui.id.value = variant.id;

    ui.pills.forEach((pill) => {
      const index = Number(pill.dataset.optionIndex);
      const value = pill.dataset.optionValue;
      const trial = selected.map((current, position) => (position === index ? value : current));
      const match = variants.find((item) => sameOptions(item, trial));
      const isSelected = String(selected[index]) === String(value);

      pill.classList.toggle('is-selected', isSelected);
      pill.classList.toggle('is-unavailable', !match || !match.available);
      pill.setAttribute('aria-pressed', String(isSelected));
    });

    ui.legends.forEach((legend, index) => {
      if (legend) legend.textContent = selected[index];
    });

    ui.price.replaceChildren(priceNode(variant.price, variant.compare_at_price));

    const image =
      variant.featured_image && variant.featured_image.src
        ? variant.featured_image.src
        : product.featured_image || '';

    if (image) ui.image.src = sizeImage(image, 400);

    ui.add.disabled = !variant.available;
    ui.add.textContent = variant.available ? text.addToCart : text.soldOut;

    ui.details.href = root + 'products/' + product.handle + '?variant=' + variant.id;
  }

  function choose(index, value) {
    const next = selected.slice();
    next[index] = value;

    let variant = variants.find((item) => sameOptions(item, next));

    /* That exact combination does not exist: take the closest variant */
    if (!variant) {
      const score = (item) =>
        variantOptions(item).reduce(
          (total, current, position) =>
            total + (position !== index && String(current) === String(selected[position]) ? 1 : 0),
          0
        );

      variant = variants
        .filter((item) => String(variantOptions(item)[index]) === String(value))
        .sort((a, b) => score(b) - score(a) || Number(b.available) - Number(a.available))[0];
    }

    if (!variant) return;

    selected = variantOptions(variant).slice();
    update();
  }


  /* =========================================
     BUILD THE DRAWER CONTENT
  ========================================= */

  function render(data, wantedVariantId) {
    product = data;
    variants = data.variants || [];
    ui = { pills: [], legends: [] };

    const tags = data.tags || [];
    const names = (data.options || []).map(optionName);

    const values = names.map((name, index) => [
      ...new Set(variants.map((variant) => variantOptions(variant)[index]))
    ]);

    const defaultOnly =
      variants.length === 1 &&
      (names.length === 0 || (names.length === 1 && values[0][0] === 'Default Title'));

    const current =
      variants.find((variant) => String(variant.id) === String(wantedVariantId)) ||
      variants.find((variant) => variant.available) ||
      variants[0];

    selected = variantOptions(current).slice();


    /* Summary */

    ui.image = el('img', { class: 'quick-view__image', alt: data.title, width: 160, height: 200 });
    ui.price = el('div', { class: 'quick-view__price' });

    const summary = el('div', { class: 'quick-view__summary' }, [
      el('div', { class: 'quick-view__image-wrap' }, ui.image),
      el('div', { class: 'quick-view__info' }, [
        data.vendor ? el('p', { class: 'quick-view__vendor', text: data.vendor }) : null,
        el('h3', { class: 'quick-view__product-title', text: data.title }),
        ui.price
      ])
    ]);


    /* Form */

    ui.id = el('input', { type: 'hidden', name: 'id', value: current.id });

    const form = el(
      'form',
      {
        class: 'quick-view__form',
        method: 'post',
        action: config.cartAddUrl || root + 'cart/add',
        'data-product-title': data.title
      },
      ui.id
    );


    /* Options */

    if (!defaultOnly) {
      names.forEach((name, index) => {
        const legend = el('span', { class: 'quick-view__legend-value' });
        ui.legends[index] = legend;

        const pills = el(
          'div',
          { class: 'quick-view__pills', role: 'group', 'aria-label': name },
          values[index].map((value) => {
            const pill = el('button', {
              type: 'button',
              class: 'quick-view__pill',
              'data-option-index': index,
              'data-option-value': value,
              text: value
            });

            ui.pills.push(pill);
            return pill;
          })
        );

        form.append(
          el('div', { class: 'quick-view__group' }, [
            el('p', { class: 'quick-view__legend' }, [name + ': ', legend]),
            pills
          ])
        );
      });
    }

    form.addEventListener('click', (event) => {
      const pill = event.target.closest('.quick-view__pill');
      if (pill) choose(Number(pill.dataset.optionIndex), pill.dataset.optionValue);
    });


    /* Personalization (tags: Name, Date, Letter) */

    const makeField = (label, input) => {
      const id = 'QuickViewField-' + input.getAttribute('name').replace(/\W+/g, '');
      input.id = id;

      return el('div', { class: 'quick-view__field' }, [el('label', { for: id, text: label }), input]);
    };

    const fields = [];

    if (tags.includes('Name')) {
      fields.push(
        makeField(
          text.name,
          el('input', {
            type: 'text',
            name: 'properties[Name]',
            maxlength: 100,
            required: true,
            autocomplete: 'off',
            placeholder: text.namePlaceholder
          })
        )
      );
    }

    if (tags.includes('Date')) {
      fields.push(
        makeField(
          text.date,
          el('input', { type: 'date', name: 'properties[Date]', required: true })
        )
      );
    }

    if (tags.includes('Letter')) {
      const letter = el('input', {
        type: 'text',
        name: 'properties[Letter]',
        class: 'quick-view__letter',
        maxlength: 1,
        required: true,
        autocomplete: 'off',
        placeholder: text.letterPlaceholder
      });

      const check = () =>
        letter.setCustomValidity(
          letter.value === '' || /^\p{L}$/u.test(letter.value) ? '' : text.letterError
        );

      /* One letter only: Arabic or English */
      const clean = (event) => {
        if (event && event.isComposing) return;

        const first = Array.from(letter.value.replace(/[^\p{L}]/gu, ''))[0] || '';

        if (letter.value !== first) letter.value = first;
        check();
      };

      letter.addEventListener('input', clean);
      letter.addEventListener('compositionend', () => clean());

      fields.push(makeField(text.letter, letter));
    }

    if (fields.length) {
      form.append(
        el('div', { class: 'quick-view__personalization' }, [
          el('div', { class: 'quick-view__personalization-heading' }, [
            el('span', { text: text.personalization }),
            el('span', { class: 'quick-view__required', text: text.required })
          ]),
          ...fields
        ])
      );
    }


    /* Quantity */

    ui.quantity = el('input', {
      class: 'quick-view__qty-input',
      id: 'QuickViewQuantity',
      type: 'number',
      name: 'quantity',
      value: 1,
      min: 1,
      inputmode: 'numeric',
      'aria-label': text.quantity
    });

    const step = (amount) => {
      const next = (Number(ui.quantity.value) || 1) + amount;
      ui.quantity.value = Math.max(1, Math.round(next));
    };

    const minus = el('button', {
      type: 'button',
      class: 'quick-view__qty-button',
      'aria-label': text.decrease,
      text: '−'
    });

    const plus = el('button', {
      type: 'button',
      class: 'quick-view__qty-button',
      'aria-label': text.increase,
      text: '+'
    });

    minus.addEventListener('click', () => step(-1));
    plus.addEventListener('click', () => step(1));
    ui.quantity.addEventListener('change', () => step(0));

    form.append(
      el('div', { class: 'quick-view__field' }, [
        el('label', { for: 'QuickViewQuantity', text: text.quantity }),
        el('div', { class: 'quick-view__qty' }, [minus, ui.quantity, plus])
      ])
    );


    /* Footer: Add to cart + View details */

    ui.add = el('button', {
      type: 'submit',
      name: 'add',
      class: 'quick-view__add',
      text: text.addToCart
    });

    ui.details = el('a', { class: 'quick-view__details', href: '#', text: text.viewDetails });

    form.append(el('div', { class: 'quick-view__footer' }, [ui.add, ui.details]));

    body.replaceChildren(summary, form);
    update();
  }


  /* =========================================
     OPEN
  ========================================= */

  async function open(link) {
    const url = new URL(link.href, window.location.href);
    const match = url.pathname.match(/\/products\/([^/]+)/);

    if (!match) {
      window.location.href = link.href;
      return;
    }

    const handle = decodeURIComponent(match[1]);
    let variantId = url.searchParams.get('variant');

    /* A card that the color filter switched to Silver / Gold: open that variant */
    const card = link.closest('[data-product-card]');
    const cardLink = card && card.querySelector('[data-product-link]');

    if (cardLink) {
      try {
        const cardVariant = new URL(cardLink.href, window.location.href).searchParams.get('variant');
        if (cardVariant) variantId = cardVariant;
      } catch (error) {}
    }

    opener = link;
    requestId += 1;

    const thisRequest = requestId;

    body.replaceChildren(el('p', { class: 'quick-view__loading', text: text.loading }));

    if (!dialog.open) {
      dialog.showModal();
      lock(true);
    }

    try {
      const response = await fetch(root + 'products/' + encodeURIComponent(handle) + '.js', {
        credentials: 'same-origin'
      });

      if (!response.ok) throw new Error('Product request failed');

      const data = await response.json();

      if (thisRequest !== requestId) return;

      render(data, variantId);
    } catch (error) {
      if (thisRequest !== requestId) return;

      /* Anything went wrong: go to the product page like before */
      dialog.close();
      window.location.href = link.href;
    }
  }


  /* =========================================
     OPEN FROM ANY CARD
  ========================================= */

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;

    const trigger = event.target.closest('[data-quick-view]');

    if (
      !trigger ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    open(trigger);
  });


  /* =========================================
     COMING BACK TO A PAGE (back button)
     The link you clicked stayed focused, which kept the hover
     button visible until you clicked somewhere else.
  ========================================= */

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;

    const active = document.activeElement;

    if (active && active !== document.body && typeof active.blur === 'function') {
      active.blur();
    }
  });
})();
