(() => {
  const dialog = document.querySelector('[data-cart-drawer]');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const root = dialog.dataset.rootUrl.replace(/\/?$/, '/');
  const sectionId = dialog.dataset.sectionId;
  const toast = document.querySelector('[data-cart-toast]');
  const feedback = document.querySelector('[data-cart-feedback]');
  const activeForms = new WeakSet();
  let queue = Promise.resolve();
  let pending = 0;
  let stale = false;
  let opener;
  let toastTimer;
  let feedbackTimer;
  let recommendationsRequest;
  let railObservers = [];

  function content() { return dialog.querySelector('[data-cart-content]'); }

  function setBusy() {
    const node = content();
    node.inert = pending > 0 || stale;
    node.setAttribute('aria-busy', String(pending > 0));
    const checkout = node.querySelector('[name="checkout"]');
    if (checkout) checkout.disabled = pending > 0 || stale;
  }

  function showError(message, retry = false) {
    if (dialog.open) {
      const error = dialog.querySelector('[data-cart-error]');
      error.hidden = false;
      error.textContent = message;
      dialog.querySelector('[data-cart-retry]').hidden = !retry;
    } else {
      feedback.hidden = false;
      feedback.textContent = message;
      window.clearTimeout(feedbackTimer);
      feedbackTimer = window.setTimeout(() => { feedback.hidden = true; }, 8000);
    }
  }

  function clearError() {
    dialog.querySelector('[data-cart-error]').hidden = true;
    dialog.querySelector('[data-cart-retry]').hidden = true;
    feedback.hidden = true;
  }

  function showToast(title) {
    showNotification(dialog.dataset.addedMessage.replace('__product__', title));
  }

  function showNotification(message) {
    window.clearTimeout(toastTimer);
    toast.hidden = false;
    toast.querySelector('[data-cart-toast-message]').textContent = message;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 6000);
  }
  document.addEventListener('theme:toast', event => {
    if (typeof event.detail?.message === 'string') showNotification(event.detail.message);
  });

  // Serialize writes and refreshes so late responses cannot overwrite newer cart state.
  function enqueue(operation) {
    pending += 1;
    setBusy();
    queue = queue.then(operation).catch(error => {
      showError(error.message || dialog.dataset.errorMessage, stale);
    }).finally(() => {
      pending -= 1;
      setBusy();
    });
    return queue;
  }

  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { credentials: 'same-origin', ...options, signal: controller.signal });
      const data = await response.json();
      if (!response.ok || data.status >= 400) {
        throw new Error(typeof data.description === 'string' ? data.description : dialog.dataset.errorMessage);
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error(dialog.dataset.errorMessage);
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function focusSnapshot() {
    const focused = document.activeElement;
    if (!content().contains(focused)) return null;
    const item = focused.closest('[data-cart-item]');
    return { key: item?.dataset.key, index: item ? [...dialog.querySelectorAll('[data-cart-item]')].indexOf(item) : -1, control: focused.dataset.focus };
  }

  function render(html, snapshot) {
    const parsed = new DOMParser().parseFromString(html || '', 'text/html');
    const replacement = parsed.querySelector('[data-cart-content]');
    if (!replacement) return false;
    const scrollTop = dialog.querySelector('[data-cart-scroll]').scrollTop;
    recommendationsRequest?.abort();
    railObservers.forEach(observer => observer.disconnect());
    railObservers = [];
    content().replaceWith(replacement);
    dialog.querySelector('[data-cart-scroll]').scrollTop = scrollTop;
    dialog.querySelector('[data-cart-title]').textContent = replacement.dataset.cartLabel;
    document.querySelectorAll('[data-cart-open]').forEach(link => link.setAttribute('aria-label', replacement.dataset.cartLabel));
    document.querySelectorAll('[data-cart-count]').forEach(count => {
      count.textContent = replacement.dataset.count;
      count.hidden = Number(replacement.dataset.count) === 0;
    });
    stale = false;
    setBusy();
    bindRails();
    // Restore after the serialized request releases inert, including removal/key changes.
    if (snapshot && dialog.open) {
      queueMicrotask(() => {
        queue.then(() => {
          if (!dialog.open || pending > 0) return;
          const items = [...dialog.querySelectorAll('[data-cart-item]')];
          const item = items.find(node => node.dataset.key === snapshot.key) || items[Math.min(snapshot.index, items.length - 1)];
          const scope = snapshot.key ? item : content();
          const target = snapshot.control && scope?.querySelector(`[data-focus="${snapshot.control}"]`);
          (target || dialog.querySelector('[data-cart-close]')).focus({ preventScroll: true });
        });
      });
    }
    if (dialog.open) loadRecommendations();
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { itemCount: Number(replacement.dataset.count) } }));
    return true;
  }

  async function refresh(data, snapshot) {
    if (render(data?.sections?.[sectionId], snapshot)) return;
    const url = new URL(dialog.dataset.cartUrl, window.location.origin);
    url.searchParams.set('sections', sectionId);
    try {
      const sections = await request(url.href, { cache: 'no-store' });
      if (!render(sections[sectionId], snapshot)) throw new Error();
    } catch {
      stale = true;
      setBusy();
      throw new Error(dialog.dataset.refreshMessage);
    }
  }

  function bundle() { return { sections: [sectionId], sections_url: dialog.dataset.cartUrl }; }

  async function mutate(endpoint, values, snapshot) {
    clearError();
    const data = await request(root + 'cart/' + endpoint + '.js', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...values, ...bundle() })
    });
    await refresh(data, snapshot);
    const live = document.querySelector('[data-live-region]');
    if (live) live.textContent = dialog.dataset.updatedMessage;
    return data;
  }

  function openCart(target) {
    opener = target;
    document.querySelector('[data-menu-drawer][open]')?.removeAttribute('open');
    if (!dialog.open) dialog.showModal();
    document.querySelectorAll('[data-cart-open]').forEach(link => link.setAttribute('aria-expanded', 'true'));
    enqueue(async () => { clearError(); await refresh(); });
  }

  dialog.addEventListener('close', () => {
    recommendationsRequest?.abort();
    document.querySelectorAll('[data-cart-open]').forEach(link => link.setAttribute('aria-expanded', 'false'));
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });

  function changeQuantity(item, quantity, snapshot) {
    const input = item.querySelector('[data-cart-quantity]');
    const min = Number(input.min) || 1;
    const step = Number(input.step) || 1;
    const max = input.max ? Number(input.max) : Infinity;
    if (!Number.isInteger(quantity) || quantity < 0 || (quantity !== 0 && (quantity < min || quantity > max || (quantity - min) % step !== 0))) {
      input.reportValidity();
      showError(input.validationMessage || dialog.dataset.errorMessage);
      input.value = input.defaultValue;
      return;
    }
    enqueue(async () => {
      try { await mutate('change', { id: item.dataset.key, quantity }, snapshot); }
      catch (error) {
        // Shopify may clamp stock while reporting an error; reconcile without repeating the write.
        await refresh(undefined, snapshot);
        throw error;
      }
    });
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('a, button');
    if (!target) return;
    const href = target.getAttribute('href');
    const url = href ? new URL(href, window.location.href) : null;
    const cartPath = new URL(dialog.dataset.cartUrl, window.location.origin).pathname.replace(/\/$/, '');
    if (target.matches('[data-cart-open]') || (url?.origin === window.location.origin && url.pathname.replace(/\/$/, '') === cartPath)) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openCart(target);
      return;
    }
    if (target.matches('[data-cart-close]')) dialog.close();
    if (target.matches('[data-cart-toast-close]')) { toast.hidden = true; window.clearTimeout(toastTimer); }
    if (target.matches('[data-cart-retry]')) enqueue(async () => { clearError(); await refresh(); });
    if (!target.matches('[data-cart-decrease], [data-cart-increase], [data-cart-remove]') || pending > 0 || stale) return;
    const item = target.closest('[data-cart-item]');
    const input = item.querySelector('[data-cart-quantity]');
    const current = Number(input.value);
    const min = Number(input.min) || 1;
    const step = Number(input.step) || 1;
    const quantity = target.matches('[data-cart-remove]') ? 0 : target.matches('[data-cart-increase]') ? current + step : current <= min ? 0 : Math.max(min, current - step);
    const snapshot = { ...focusSnapshot(), key: item.dataset.key, index: [...dialog.querySelectorAll('[data-cart-item]')].indexOf(item), control: 'quantity' };
    changeQuantity(item, quantity, snapshot);
  });

  document.addEventListener('change', event => {
    if (!event.target.matches('[data-cart-quantity]') || pending > 0 || stale) return;
    changeQuantity(event.target.closest('[data-cart-item]'), Number(event.target.value), focusSnapshot());
  });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.matches('[data-cart-checkout]')) {
      if (pending > 0 || stale) event.preventDefault();
      return;
    }
    if (form.matches('[data-cart-discount]')) {
      event.preventDefault();
      if (pending > 0 || stale) return;
      const discount = new FormData(form).get('discount').trim();
      if (!discount) return;
      const snapshot = focusSnapshot();
      enqueue(async () => {
        const data = await mutate('update', { discount }, snapshot);
        const applicable = data.discount_codes?.some(code => code.code.toLowerCase() === discount.toLowerCase() && code.applicable);
        const applied = applicable || data.cart_level_discount_applications?.some(application => application.title.toLowerCase() === discount.toLowerCase()) || data.items?.some(item => item.line_level_discount_allocations?.some(allocation => allocation.discount_application?.title?.toLowerCase() === discount.toLowerCase()));
        const error = dialog.querySelector('[data-cart-error]');
        if (applied) {
          const live = document.querySelector('[data-live-region]');
          if (live) live.textContent = dialog.dataset.discountApplied;
        } else {
          error.hidden = false;
          error.textContent = dialog.dataset.discountInvalid;
        }
      });
      return;
    }
    const action = new URL(form.action, window.location.href);
    if (action.origin !== window.location.origin || !/\/cart\/add(?:\.js)?\/?$/.test(action.pathname) || (event.submitter?.name && event.submitter.name !== 'add')) return;
    event.preventDefault();
    if (activeForms.has(form)) return;
    const bundled = form.matches('[data-bought-together-form]');
    const selectedItems = bundled ? [...form.querySelectorAll('[data-bundle-item]')].filter(item => item.querySelector('[data-bundle-check]').checked && !item.querySelector('[data-bundle-variant]').disabled).map(item => {
      const select = item.querySelector('[data-bundle-variant]');
      return { id: Number(select.value), quantity: Number(select.selectedOptions[0].dataset.min || 1) };
    }) : null;
    if (bundled && !selectedItems.length) return;
    const body = bundled ? JSON.stringify({ items: selectedItems, ...bundle() }) : new FormData(form);
    if (!bundled) { body.set('sections', sectionId); body.set('sections_url', dialog.dataset.cartUrl); }
    activeForms.add(form);
    const buttons = [...form.querySelectorAll('[type="submit"]')].filter(button => !button.disabled);
    buttons.forEach(button => { button.disabled = true; });
    form.setAttribute('aria-busy', 'true');
    const bundleCards = form.querySelector('[data-bundle-cards]');
    if (bundleCards) bundleCards.inert = true;
    enqueue(async () => {
      try {
        clearError();
        const data = await request(root + 'cart/add.js', { method: 'POST', headers: { Accept: 'application/json', ...(bundled ? { 'Content-Type': 'application/json' } : {}) }, body });
        const added = data.items?.[0] || data;
        if (data.items?.length > 1) showNotification(dialog.dataset.addedMultipleMessage.replace('__products__', data.items.map(item => item.product_title || item.title).join(', ')));
        else showToast(added.product_title || form.dataset.productTitle || added.title || '');
        await refresh(data);
      } catch (error) {
        if (!stale) await refresh();
        throw error;
      } finally {
        activeForms.delete(form);
        buttons.forEach(button => { button.disabled = false; });
        form.removeAttribute('aria-busy');
        if (bundleCards) bundleCards.inert = false;
      }
    });
  });

  function bindRails() {
    dialog.querySelectorAll('[data-cart-recommendations]').forEach(section => {
      const rail = section.querySelector('[data-cart-rail]');
      if (!rail || rail.dataset.bound) return;
      rail.dataset.bound = 'true';
      const previous = section.querySelector('[data-cart-previous]');
      const next = section.querySelector('[data-cart-next]');
      const update = () => {
        const position = Math.abs(rail.scrollLeft);
        previous.disabled = position <= 2;
        next.disabled = position >= rail.scrollWidth - rail.clientWidth - 2;
      };
      const scroll = direction => {
        const rtl = getComputedStyle(rail).direction === 'rtl';
        rail.scrollBy({ left: direction * (rtl ? -1 : 1) * (rail.firstElementChild?.getBoundingClientRect().width + 24 || rail.clientWidth * 0.8), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      };
      previous.addEventListener('click', () => scroll(-1));
      next.addEventListener('click', () => scroll(1));
      rail.addEventListener('scroll', update, { passive: true });
      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(() => { if (rail.isConnected) update(); else observer.disconnect(); });
        observer.observe(rail);
        railObservers.push(observer);
      }
      update();
    });
  }

  async function loadRecommendations() {
    const productId = content().dataset.productId;
    if (!productId) return;
    recommendationsRequest?.abort();
    const controller = new AbortController();
    recommendationsRequest = controller;
    const node = content();
    const url = new URL(root + 'recommendations/products', window.location.origin);
    url.search = new URLSearchParams({ section_id: 'cart-recommendations', product_id: productId, limit: '6', intent: 'related' });
    try {
      const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) return;
      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      const section = parsed.querySelector('[data-cart-recommendations]');
      if (controller.signal.aborted || !node.isConnected || !section?.querySelector('.cart-recommendation')) return;
      node.querySelector('[data-cart-recommendations]')?.replaceWith(section);
      bindRails();
    } catch { /* Keep the server-rendered collection fallback. */ }
  }

  bindRails();
  document.addEventListener('shopify:section:load', event => {
    const replacement = event.target.querySelector('[data-cart-drawer]');
    if (!replacement || replacement === dialog || replacement.dataset.sectionId !== sectionId) return;
    const wasOpen = dialog.open;
    if (wasOpen) dialog.close();
    Object.assign(dialog.dataset, replacement.dataset);
    replacement.replaceWith(dialog);
    event.target.querySelector('[data-cart-toast]')?.replaceWith(toast);
    event.target.querySelector('[data-cart-feedback]')?.replaceWith(feedback);
    clearError();
    render(replacement.outerHTML);
    if (wasOpen) openCart(document.querySelector('[data-cart-open]'));
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) enqueue(async () => { clearError(); await refresh(); });
  });
  if (dialog.dataset.cartPage === 'true') {
    const url = new URL(dialog.dataset.rootUrl, window.location.origin);
    url.searchParams.set('cart', 'open');
    window.location.replace(url.href);
  } else {
    const url = new URL(window.location.href);
    if (url.searchParams.get('cart') === 'open') {
      url.searchParams.delete('cart');
      window.history.replaceState(window.history.state, '', url.href);
      openCart(document.querySelector('[data-cart-open]'));
    }
  }
})();
