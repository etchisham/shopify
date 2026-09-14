(function () {
  'use strict';

  function all(selector, scope) {
    return Array.from((scope || document).querySelectorAll(selector));
  }

  function initializeTheme() {
    var stored = localStorage.getItem('fl-theme') || 'light';
    applyTheme(stored);

    all('[data-theme-option]').forEach(function (button) {
      if (button.dataset.initialized) return;
      button.dataset.initialized = 'true';
      button.addEventListener('click', function () {
        applyTheme(button.dataset.themeOption);
      });
    });
  }

  function applyTheme(theme) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('fl-theme', 'system');
    } else {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('fl-theme', theme);
    }

    all('[data-theme-option]').forEach(function (button) {
      button.setAttribute('aria-checked', String(button.dataset.themeOption === theme));
    });
  }

  function initializeHeader() {
    all('[data-nav-drawer]').forEach(function (drawer) {
      if (drawer.dataset.initialized) return;
      drawer.dataset.initialized = 'true';
      var trigger = document.querySelector('[data-nav-open]');
      var closeButtons = all('[data-nav-close]', drawer);

      function setOpen(open) {
        drawer.setAttribute('aria-hidden', String(!open));
        if (trigger) trigger.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('fl-scroll-locked', open);
        if (open) {
          var close = drawer.querySelector('[data-nav-close]');
          if (close) close.focus();
        } else if (trigger) {
          trigger.focus();
        }
      }

      if (trigger) trigger.addEventListener('click', function () { setOpen(true); });
      closeButtons.forEach(function (button) {
        button.addEventListener('click', function () { setOpen(false); });
      });
      drawer.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') setOpen(false);
      });
    });

    all('[data-search-toggle]').forEach(function (trigger) {
      if (trigger.dataset.initialized) return;
      trigger.dataset.initialized = 'true';
      var panel = document.querySelector('[data-search-panel]');
      if (!panel) return;
      trigger.addEventListener('click', function () {
        var open = panel.getAttribute('aria-hidden') === 'true';
        panel.setAttribute('aria-hidden', String(!open));
        trigger.setAttribute('aria-expanded', String(open));
        if (open) {
          var input = panel.querySelector('input[type="search"]');
          if (input) input.focus();
        }
      });
      panel.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          panel.setAttribute('aria-hidden', 'true');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
        }
      });
    });
  }

  function initializeGalleries(scope) {
    all('[data-product-gallery]', scope).forEach(function (gallery) {
      if (gallery.dataset.initialized) return;
      gallery.dataset.initialized = 'true';
      all('[data-gallery-thumbnail]', gallery).forEach(function (thumbnail) {
        thumbnail.addEventListener('click', function () {
          selectMedia(gallery, thumbnail.dataset.mediaId);
        });
      });
    });
  }

  function selectMedia(gallery, mediaId) {
    all('[data-gallery-item]', gallery).forEach(function (item) {
      item.hidden = item.dataset.mediaId !== String(mediaId);
    });
    all('[data-gallery-thumbnail]', gallery).forEach(function (thumbnail) {
      thumbnail.setAttribute('aria-current', String(thumbnail.dataset.mediaId === String(mediaId)));
    });
  }

  function initializeQuantities(scope) {
    all('[data-quantity]', scope).forEach(function (quantity) {
      if (quantity.dataset.initialized) return;
      quantity.dataset.initialized = 'true';
      var input = quantity.querySelector('input');
      var minus = quantity.querySelector('[data-quantity-minus]');
      var plus = quantity.querySelector('[data-quantity-plus]');
      if (!input || !minus || !plus) return;

      function update(delta) {
        var minimum = Number(input.min || 1);
        var maximum = Number(input.max || 99);
        var value = Math.min(maximum, Math.max(minimum, Number(input.value || minimum) + delta));
        input.value = String(value);
        minus.disabled = value <= minimum;
        plus.disabled = value >= maximum;
      }

      minus.addEventListener('click', function () { update(-1); });
      plus.addEventListener('click', function () { update(1); });
      input.addEventListener('change', function () { update(0); });
      update(0);
    });
  }

  function money(cents, currency) {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: currency
      }).format(Number(cents) / 100);
    } catch (error) {
      return (Number(cents) / 100).toFixed(2) + ' ' + currency;
    }
  }

  function initializeProduct(scope) {
    all('[data-product-detail]', scope).forEach(function (root) {
      if (root.dataset.initialized) return;
      root.dataset.initialized = 'true';
      var form = root.querySelector('[data-product-form]');
      var dataNode = root.querySelector('[data-variants-json]');
      if (!form || !dataNode) return;

      var variants;
      try {
        variants = JSON.parse(dataNode.textContent);
      } catch (error) {
        return;
      }

      var currency = root.dataset.currency;
      var variantInput = form.querySelector('input[name="id"]');
      var submit = form.querySelector('[data-product-submit]');
      var sticky = document.querySelector('[data-sticky-buy="' + root.dataset.sectionId + '"]');
      var stickySubmit = sticky ? sticky.querySelector('[data-sticky-submit]') : null;
      var status = form.querySelector('[data-product-status]');
      var price = root.querySelector('[data-product-price]');
      var compare = root.querySelector('[data-product-compare-price]');
      var inventoryStatus = root.querySelector('[data-inventory-status]');
      var optionInputs = all('[data-option-input]', form);

      function selectedOptions() {
        var groups = all('[data-option-position]', form);
        return groups.map(function (group) {
          var checked = group.querySelector('input:checked');
          return checked ? checked.value : null;
        });
      }

      function findVariant() {
        var groups = all('[data-option-position]', form);
        if (groups.length === 0) return variants[0] || null;
        var selected = selectedOptions();
        if (selected.some(function (value) { return !value; })) return null;
        return variants.find(function (variant) {
          return variant.options.every(function (value, index) { return value === selected[index]; });
        }) || null;
      }

      function setButton(label, disabled) {
        submit.disabled = disabled;
        submit.textContent = label;
        if (stickySubmit) {
          stickySubmit.disabled = disabled;
          stickySubmit.textContent = label;
        }
      }

      function sync() {
        var variant = findVariant();
        var dynamicCheckout = form.querySelector('[data-dynamic-checkout]');
        all('[data-option-position]', form).forEach(function (group) {
          var output = group.querySelector('[data-selected-option]');
          var checked = group.querySelector('input:checked');
          if (output) output.textContent = checked ? checked.value : 'Choose an option';
        });

        if (!variant) {
          variantInput.value = '';
          setButton('Choose options', true);
          if (dynamicCheckout) dynamicCheckout.hidden = true;
          if (inventoryStatus) {
            inventoryStatus.classList.remove('fl-status--error');
            inventoryStatus.textContent = 'Choose options to check availability';
          }
          return;
        }

        variantInput.value = variant.id;
        if (dynamicCheckout) dynamicCheckout.hidden = !variant.available;
        if (price) price.textContent = money(variant.price, currency);
        if (compare) {
          compare.hidden = !(variant.compare_at_price > variant.price);
          compare.textContent = variant.compare_at_price ? money(variant.compare_at_price, currency) : '';
        }
        if (sticky) {
          var stickyPrice = sticky.querySelector('[data-sticky-price]');
          if (stickyPrice) stickyPrice.textContent = money(variant.price, currency);
        }

        if (inventoryStatus) {
          inventoryStatus.classList.toggle('fl-status--error', !variant.available);
          inventoryStatus.textContent = variant.available ? 'Available to order' : 'This option is currently unavailable';
        }

        setButton(variant.available ? submit.dataset.availableLabel : submit.dataset.soldLabel, !variant.available);
        if (variant.featured_media && variant.featured_media.id) {
          var gallery = root.querySelector('[data-product-gallery]');
          if (gallery) selectMedia(gallery, variant.featured_media.id);
        }
        var nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', nextUrl.toString());
      }

      optionInputs.forEach(function (input) { input.addEventListener('change', sync); });
      sync();

      form.addEventListener('submit', function (event) {
        if (event.submitter && event.submitter !== submit) return;
        if (!variantInput.value || submit.disabled) return;
        event.preventDefault();
        setButton('Adding…', true);
        if (status) status.textContent = 'Adding item to your cart.';

        var rootUrl = window.Shopify && window.Shopify.routes ? window.Shopify.routes.root : '/';
        fetch(rootUrl + 'cart/add.js', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form)
        })
          .then(function (response) {
            if (!response.ok) return response.json().then(function (body) { throw new Error(body.description || 'Item could not be added.'); });
            return response.json();
          })
          .then(function () {
            if (status) status.textContent = 'Added to cart.';
            setButton('Added', true);
            return fetch(rootUrl + 'cart.js', { headers: { Accept: 'application/json' } });
          })
          .then(function (response) { return response.json(); })
          .then(function (cart) {
            all('[data-cart-count]').forEach(function (count) {
              count.textContent = cart.item_count;
              count.hidden = cart.item_count === 0;
            });
            window.setTimeout(sync, 1000);
          })
          .catch(function (error) {
            if (status) status.textContent = error.message;
            sync();
          });
      });

      if (stickySubmit) {
        stickySubmit.addEventListener('click', function () { form.requestSubmit(submit); });
      }

      if (sticky && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            sticky.dataset.visible = String(!entry.isIntersecting && entry.boundingClientRect.top < 0);
          });
        });
        observer.observe(submit);
      }
    });
  }

  function initialize(scope) {
    initializeTheme();
    initializeHeader();
    initializeGalleries(scope || document);
    initializeQuantities(scope || document);
    initializeProduct(scope || document);
    initializeFaq(scope || document);
  }

  function initializeFaq(scope) {
    all('[data-faq-search]', scope).forEach(function (input) {
      if (input.dataset.initialized) return;
      input.dataset.initialized = 'true';
      var list = document.querySelector('[data-faq-list="' + input.dataset.faqSearch + '"]');
      if (!list) return;
      input.addEventListener('input', function () {
        var query = input.value.trim().toLowerCase();
        all('[data-faq-item]', list).forEach(function (item) {
          item.hidden = query.length > 0 && item.textContent.toLowerCase().indexOf(query) === -1;
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () { initialize(document); });
  document.addEventListener('shopify:section:load', function (event) { initialize(event.target); });
})();
