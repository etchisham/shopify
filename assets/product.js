(() => {
  const controllers = new WeakMap();
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function gallery(root, signal) {
    const node = root.querySelector('[data-product-gallery]');
    const track = node.querySelector('[data-product-media-track]');
    const slides = [...node.querySelectorAll('[data-product-media]')];
    const thumbnails = [...node.querySelectorAll('[data-product-thumbnail]')];
    const previous = node.querySelector('[data-product-previous]');
    const next = node.querySelector('[data-product-next]');
    const rail = node.querySelector('[data-product-thumbnails]');
    let active = -1, scrollFrame;
    const revealThumbnail = thumbnail => {
      if (!thumbnail || !rail) return;
      const box = rail.getBoundingClientRect(), item = thumbnail.getBoundingClientRect();
      if (rail.scrollHeight > rail.clientHeight) {
        const top = item.top < box.top ? item.top - box.top : item.bottom > box.bottom ? item.bottom - box.bottom : 0;
        if (top) rail.scrollBy({ top, behavior: reducedMotion() ? 'auto' : 'smooth' });
      } else {
        const left = item.left < box.left ? item.left - box.left : item.right > box.right ? item.right - box.right : 0;
        if (left) rail.scrollBy({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    };
    const mark = index => {
      if (index < 0 || index >= slides.length || active === index) return;
      active = index;
      slides.forEach((slide, position) => {
        slide.inert = position !== index;
        slide.setAttribute('aria-hidden', String(position !== index));
        if (position === index) return;
        slide.querySelectorAll('video').forEach(video => video.pause());
        slide.querySelectorAll('iframe').forEach(frame => {
          try {
            const origin = new URL(frame.src).origin;
            const host = new URL(frame.src).hostname;
            if (/(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(host)) frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), origin);
            if (/(^|\.)vimeo\.com$/.test(host)) frame.contentWindow.postMessage({ method: 'pause' }, origin);
          } catch (_error) { /* Not an external player. */ }
        });
      });
      thumbnails.forEach((thumbnail, position) => {
        thumbnail.disabled = false;
        thumbnail.tabIndex = position === index ? 0 : -1;
        if (position === index) thumbnail.setAttribute('aria-current', 'true');
        else thumbnail.removeAttribute('aria-current');
      });
      if (previous) previous.disabled = index === 0;
      if (next) next.disabled = index === slides.length - 1;
      const counter = node.querySelector('[data-product-media-counter]');
      if (counter) counter.textContent = index + 1;
      node.querySelector('[data-product-media-status]').textContent = slides[index].getAttribute('aria-label');
      revealThumbnail(thumbnails[index]);
    };
    const go = (index, smooth = true) => {
      if (!slides.length) return;
      index = Math.max(0, Math.min(slides.length - 1, index));
      const target = slides[index].getBoundingClientRect(), box = track.getBoundingClientRect();
      const rtl = getComputedStyle(track).direction === 'rtl';
      const delta = rtl ? target.right - box.right : target.left - box.left;
      mark(index);
      track.scrollTo({ left: track.scrollLeft + delta, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
    };
    thumbnails.forEach((thumbnail, index) => thumbnail.addEventListener('click', () => go(index), { signal }));
    previous?.addEventListener('click', () => go(active - 1), { signal });
    next?.addEventListener('click', () => go(active + 1), { signal });
    node.addEventListener('keydown', event => {
      if (event.target !== track && !event.target.closest('[data-product-thumbnail]')) return;
      const rtl = getComputedStyle(track).direction === 'rtl';
      let index;
      if (event.key === 'ArrowRight') index = active + (rtl ? -1 : 1);
      if (event.key === 'ArrowLeft') index = active + (rtl ? 1 : -1);
      if (event.key === 'ArrowDown') index = active + 1;
      if (event.key === 'ArrowUp') index = active - 1;
      if (event.key === 'Home') index = 0;
      if (event.key === 'End') index = slides.length - 1;
      if (index === undefined) return;
      event.preventDefault();
      go(index);
      if (event.target.closest('[data-product-thumbnail]')) thumbnails[active]?.focus({ preventScroll: true });
    }, { signal });
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        const box = track.getBoundingClientRect(), center = (box.left + box.right) / 2;
        let closest = 0, distance = Infinity;
        slides.forEach((slide, index) => {
          const rect = slide.getBoundingClientRect(), gap = Math.abs((rect.left + rect.right) / 2 - center);
          if (gap < distance) { closest = index; distance = gap; }
        });
        mark(closest);
      });
    }, { passive: true, signal });
    const resize = new ResizeObserver(() => go(active, false));
    resize.observe(track);
    signal.addEventListener('abort', () => { resize.disconnect(); cancelAnimationFrame(scrollFrame); }, { once: true });
    go(Number(node.dataset.initialIndex) || 0, false);

    const dialog = node.querySelector('[data-product-zoom-dialog]');
    const images = slides.filter(slide => slide.dataset.mediaType === 'image');
    const canvas = dialog.querySelector('[data-product-zoom-canvas]');
    const toggle = dialog.querySelector('[data-product-zoom-toggle]');
    const zoomPrevious = dialog.querySelector('[data-product-zoom-previous]');
    const zoomNext = dialog.querySelector('[data-product-zoom-next]');
    let zoomIndex = 0, zoomOpener;
    const renderZoom = () => {
      const link = images[zoomIndex].querySelector('[data-product-zoom]');
      let image = canvas.querySelector('img');
      if (!image) { image = document.createElement('img'); image.width = 2400; image.height = 2400; canvas.append(image); }
      image.src = link.dataset.zoomSrc;
      image.alt = link.dataset.zoomAlt;
      dialog.querySelector('[data-product-zoom-counter]').textContent = images[zoomIndex].getAttribute('aria-label');
      zoomPrevious.disabled = zoomIndex === 0;
      zoomNext.disabled = zoomIndex === images.length - 1;
      canvas.classList.remove('is-zoomed');
      canvas.scrollTo({ top: 0, left: 0 });
      toggle.setAttribute('aria-pressed', 'false');
      toggle.textContent = toggle.dataset.zoomIn;
      go(Number(images[zoomIndex].dataset.mediaIndex), false);
    };
    node.addEventListener('click', event => {
      const link = event.target.closest('[data-product-zoom]');
      if (!link || typeof dialog.showModal !== 'function') return;
      event.preventDefault();
      zoomOpener = link;
      zoomIndex = images.indexOf(link.closest('[data-product-media]'));
      renderZoom();
      dialog.showModal();
    }, { signal });
    dialog.querySelector('[data-product-zoom-close]').addEventListener('click', () => dialog.close(), { signal });
    dialog.addEventListener('close', () => {
      const target = zoomOpener?.closest('[data-product-media]')?.inert ? track : zoomOpener;
      target?.focus({ preventScroll: true });
    }, { signal });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }, { signal });
    zoomPrevious.addEventListener('click', () => { if (zoomIndex > 0) { zoomIndex--; renderZoom(); } }, { signal });
    zoomNext.addEventListener('click', () => { if (zoomIndex < images.length - 1) { zoomIndex++; renderZoom(); } }, { signal });
    dialog.addEventListener('keydown', event => {
      const rtl = getComputedStyle(track).direction === 'rtl';
      if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) { event.preventDefault(); zoomNext.click(); }
      if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) { event.preventDefault(); zoomPrevious.click(); }
    }, { signal });
    toggle.addEventListener('click', () => {
      const zoomed = canvas.classList.toggle('is-zoomed');
      toggle.setAttribute('aria-pressed', String(zoomed));
      toggle.textContent = zoomed ? toggle.dataset.zoomOut : toggle.dataset.zoomIn;
    }, { signal });
    return { selectMedia: id => { const index = slides.findIndex(slide => slide.dataset.productMedia === String(id)); if (index >= 0) go(index); } };
  }

  function descriptions(root, signal) {
    root.querySelectorAll('[data-product-description][data-truncate]').forEach(node => {
      const text = node.querySelector('[data-description-text]'), button = node.querySelector('[data-description-more]');
      const measure = () => {
        if (button.getAttribute('aria-expanded') === 'true' || !node.closest('details').open) return;
        node.classList.add('is-collapsed');
        const overflows = text.scrollHeight > text.clientHeight + 2;
        button.hidden = !overflows;
        if (!overflows) node.classList.remove('is-collapsed');
      };
      button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(expanded));
        button.textContent = expanded ? button.dataset.less : button.dataset.more;
        node.classList.toggle('is-collapsed', !expanded);
      }, { signal });
      node.closest('details').addEventListener('toggle', measure, { signal });
      window.addEventListener('resize', measure, { passive: true, signal });
      text.querySelectorAll('img').forEach(image => image.addEventListener('load', measure, { signal }));
      measure();
    });
  }

  function savedProducts(root, signal) {
    if (root.dataset.saveEnabled === 'false') return;
    const buttons = [...root.querySelectorAll('[data-product-save]')];
    const key = 'theme:saved-products';
    let saved = false;
    const read = () => {
      const records = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(records) ? records : [];
    };
    const paint = () => buttons.forEach(button => {
      button.hidden = false;
      button.setAttribute('aria-pressed', String(saved));
      const text = button.querySelector('[data-save-text]');
      if (text) text.textContent = saved ? button.dataset.collectionRemove : button.dataset.collectionAdd;
      else button.setAttribute('aria-label', saved ? root.dataset.unsaveLabel : root.dataset.saveLabel);
    });
    try { saved = read().some(item => item.id === root.dataset.productId); } catch (_error) { /* Allow an explicit save attempt to expose an error. */ }
    paint();
    buttons.forEach(button => button.addEventListener('click', () => {
      const error = root.querySelector('[data-product-error]');
      try {
        const records = read().filter(item => item.id !== root.dataset.productId);
        if (!saved) records.push({ id: root.dataset.productId, title: root.dataset.productTitle, url: root.dataset.productUrl, image: root.dataset.productImage });
        localStorage.setItem(key, JSON.stringify(records.slice(-200)));
        saved = !saved;
        paint();
        error.hidden = true;
        document.dispatchEvent(new CustomEvent('theme:toast', { detail: { message: saved ? root.dataset.saveMessage : root.dataset.removeMessage } }));
      } catch (_error) { error.textContent = root.dataset.saveError; error.hidden = false; }
    }, { signal }));
    window.addEventListener('storage', event => {
      if (event.key !== key) return;
      try { saved = read().some(item => item.id === root.dataset.productId); paint(); } catch (_error) { /* Ignore malformed data from another tab. */ }
    }, { signal });
  }

  function options(root, media, signal) {
    let requestController, revision = 0;
    const error = root.querySelector('[data-product-error]');
    const reveal = () => root.querySelectorAll('[data-product-options]').forEach(node => { node.hidden = false; });
    const busy = value => {
      const form = root.querySelector('.product-form');
      if (value) form.setAttribute('data-variant-pending', 'true');
      else form.removeAttribute('data-variant-pending');
      root.querySelector('[data-product-actions]').inert = value;
      root.querySelector('[data-product-add]').disabled = value || !root.querySelector('[data-product-variant-content]').dataset.variantId || root.querySelector('[data-product-add]').dataset.unavailable === 'true';
      root.querySelector('[data-product-options]')?.setAttribute('aria-busy', String(value));
    };
    root.addEventListener('submit', event => {
      if (event.target.matches('.product-form') && event.target.hasAttribute('data-variant-pending')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, { capture: true, signal });
    root.addEventListener('invalid', event => {
      const personalization = event.target.closest('.product-personalization');
      if (personalization) personalization.open = true;
    }, { capture: true, signal });
    root.addEventListener('change', async event => {
      if (!event.target.matches('[data-product-option]')) return;
      const selected = [...root.querySelectorAll('[data-product-option]')].map(select => select.value);
      const sibling = event.target.selectedOptions[0]?.dataset.productUrl;
      const target = new URL(sibling || root.dataset.productUrl, location.origin);
      target.searchParams.set('option_values', selected.join(','));
      if (target.pathname !== new URL(root.dataset.productUrl, location.origin).pathname) { location.assign(target.href); return; }
      requestController?.abort();
      requestController = new AbortController();
      const request = requestController;
      const version = ++revision;
      const focusId = event.target.id;
      busy(true);
      error.hidden = true;
      const timer = setTimeout(() => request.abort(), 15000);
      try {
        target.searchParams.set('section_id', root.dataset.sectionId);
        const response = await fetch(target.href, { signal: request.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error('Option request failed');
        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        const replacement = html.querySelector('[data-product-variant-content]');
        if (!replacement) throw new Error('Option content missing');
        if (version !== revision || signal.aborted) return;
        const values = new Map([...root.querySelectorAll('.product-form input, .product-form textarea')].filter(input => input.name !== 'id' && input.type !== 'hidden').map(input => [input.name, input.value]));
        const personalizationOpen = root.querySelector('.product-personalization')?.open;
        root.querySelector('[data-product-variant-content]').replaceWith(replacement);
        reveal();
        values.forEach((value, name) => {
          const input = [...root.querySelectorAll('.product-form input, .product-form textarea')].find(input => input.name === name);
          if (input) input.value = value;
        });
        const quantity = root.querySelector('input[type="number"][name="quantity"]');
        if (quantity) {
          const minimum = Number(quantity.min) || 1, step = Number(quantity.step) || 1;
          const maximum = quantity.max ? Number(quantity.max) : Infinity;
          quantity.value = Math.min(maximum, minimum + Math.max(0, Math.floor((Number(quantity.value) - minimum) / step)) * step);
        }
        if (root.querySelector('.product-personalization') && personalizationOpen !== undefined) root.querySelector('.product-personalization').open = personalizationOpen;
        const url = new URL(location.href);
        if (replacement.dataset.variantId) { url.searchParams.set('variant', replacement.dataset.variantId); url.searchParams.delete('option_values'); }
        else { url.searchParams.delete('variant'); url.searchParams.set('option_values', selected.join(',')); }
        history.replaceState(history.state, '', url.href);
        media.selectMedia(replacement.dataset.featuredMediaId);
        document.dispatchEvent(new CustomEvent('theme:product-variant', { detail: { productId: root.dataset.productId, variantId: replacement.dataset.variantId, title: replacement.dataset.variantTitle, price: replacement.dataset.variantPrice, minimum: replacement.dataset.variantMinimum, available: replacement.dataset.variantAvailable === 'true' } }));
        window.Shopify?.PaymentButton?.init?.();
        root.querySelector('#' + CSS.escape(focusId))?.focus({ preventScroll: true });
      } catch (_error) {
        if (version !== revision || signal.aborted) return;
        root.querySelectorAll('[data-product-option]').forEach(select => { select.value = select.querySelector('[data-selected]')?.value || ''; });
        error.textContent = root.dataset.optionError;
        error.hidden = false;
      } finally {
        clearTimeout(timer);
        if (version === revision && !signal.aborted) busy(false);
      }
    }, { signal });
    signal.addEventListener('abort', () => requestController?.abort(), { once: true });
    reveal();
  }

  function bind(scope = document) {
    scope.querySelectorAll('[data-product-page]').forEach(root => {
      if (controllers.has(root)) return;
      const controller = new AbortController();
      controllers.set(root, controller);
      const { signal } = controller;
      const media = gallery(root, signal);
      options(root, media, signal);
      descriptions(root, signal);
      savedProducts(root, signal);
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin === location.origin && /\/(search|collections)(\/|$)/.test(referrer.pathname)) {
          root.querySelector('[data-product-back]').href = referrer.href;
          root.querySelector('[data-product-back-label]').textContent = root.dataset.backLabel;
        }
      } catch (_error) { /* Direct product visits use the collection fallback. */ }
    });
  }
  bind();
  document.addEventListener('shopify:section:load', event => bind(event.target));
  document.addEventListener('shopify:section:unload', event => event.target.querySelectorAll('[data-product-page]').forEach(root => controllers.get(root)?.abort()));
})();
