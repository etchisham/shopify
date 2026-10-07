(() => {
  const controllers = new WeakMap();

  const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isRtl = () =>
    (document.documentElement.getAttribute('dir') || '').toLowerCase() === 'rtl';

  /* =========================================================
     GALLERY
  ========================================================= */

  function gallery(root, signal) {
    const noop = { selectMedia: () => {} };

    const node = root.querySelector('[data-product-gallery]');
    if (!node) return noop;

    const track = node.querySelector('[data-product-media-track]');
    const slides = [...node.querySelectorAll('[data-product-media]')];
    const thumbnails = [...node.querySelectorAll('[data-product-thumbnail]')];
    const previous = node.querySelector('[data-product-previous]');
    const next = node.querySelector('[data-product-next]');
    const status = node.querySelector('[data-product-media-status]');
    const counter = node.querySelector('[data-product-media-counter]');

    if (!track || !slides.length) return noop;

    let active = -1;
    let settleTimer = null;

    const mark = (index) => {
      if (index < 0 || index >= slides.length) return;

      active = index;

      slides.forEach((slide, i) => {
        const isActive = i === index;
        slide.inert = !isActive;
        slide.setAttribute('aria-hidden', String(!isActive));
      });

      thumbnails.forEach((thumbnail, i) => {
        thumbnail.disabled = false;
        thumbnail.tabIndex = i === index ? 0 : -1;

        if (i === index) {
          thumbnail.setAttribute('aria-current', 'true');
        } else {
          thumbnail.removeAttribute('aria-current');
        }
      });

      if (previous) previous.disabled = index <= 0;
      if (next) next.disabled = index >= slides.length - 1;
      if (counter) counter.textContent = String(index + 1);

      if (status) {
        status.textContent = slides[index].getAttribute('aria-label') || '';
      }
    };

    const go = (index, smooth = true) => {
      index = Math.max(0, Math.min(slides.length - 1, index));

      mark(index);

      /* Works for both LTR and RTL tracks */
      const left =
        track.scrollLeft +
        slides[index].getBoundingClientRect().left -
        track.getBoundingClientRect().left;

      track.scrollTo({
        left,
        behavior: smooth && !reducedMotion() ? 'smooth' : 'auto'
      });
    };

    thumbnails.forEach((thumbnail, index) => {
      thumbnail.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          go(index);
        },
        { signal }
      );
    });

    previous?.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        go(active - 1);
      },
      { signal }
    );

    next?.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        go(active + 1);
      },
      { signal }
    );

    /* Keyboard support on the track itself */
    track.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

        event.preventDefault();

        const forward = event.key === 'ArrowRight' ? !isRtl() : isRtl();
        go(active + (forward ? 1 : -1));
      },
      { signal }
    );

    /*
      Sync the active slide only after manual scrolling/swiping settles.
      This avoids fighting with smooth scrolling started by the arrows.
    */
    track.addEventListener(
      'scroll',
      () => {
        clearTimeout(settleTimer);

        settleTimer = setTimeout(() => {
          const trackRect = track.getBoundingClientRect();
          const center = (trackRect.left + trackRect.right) / 2;

          let closest = 0;
          let distance = Infinity;

          slides.forEach((slide, index) => {
            const rect = slide.getBoundingClientRect();
            const slideCenter = (rect.left + rect.right) / 2;
            const currentDistance = Math.abs(slideCenter - center);

            if (currentDistance < distance) {
              distance = currentDistance;
              closest = index;
            }
          });

          if (closest !== active) mark(closest);
        }, 90);
      },
      { passive: true, signal }
    );

    signal.addEventListener('abort', () => clearTimeout(settleTimer), {
      once: true
    });

    go(Number(node.dataset.initialIndex) || 0, false);

    /* -------------------------
       ZOOM
    ------------------------- */

    const dialog = node.querySelector('[data-product-zoom-dialog]');

    if (dialog) {
      const images = slides.filter(
        (slide) => slide.dataset.mediaType === 'image'
      );

      const canvas = dialog.querySelector('[data-product-zoom-canvas]');
      const closeButton = dialog.querySelector('[data-product-zoom-close]');
      const zoomPrevious = dialog.querySelector('[data-product-zoom-previous]');
      const zoomNext = dialog.querySelector('[data-product-zoom-next]');
      const zoomToggle = dialog.querySelector('[data-product-zoom-toggle]');
      const zoomCounter = dialog.querySelector('[data-product-zoom-counter]');

      let zoomIndex = 0;
      let zoomOpener = null;

      const closeDialog = () => {
        if (!dialog.open) return;

        if (typeof dialog.close === 'function') {
          dialog.close();
        } else {
          dialog.removeAttribute('open');
        }
      };

      const setZoomed = (on) => {
        if (!canvas) return;

        canvas.classList.toggle('is-zoomed', on);

        if (zoomToggle) {
          zoomToggle.setAttribute('aria-pressed', String(on));
          zoomToggle.textContent = on ? '−' : '+';
          zoomToggle.setAttribute(
            'aria-label',
            (on ? zoomToggle.dataset.labelOut : zoomToggle.dataset.labelIn) ||
              (on ? 'Zoom out' : 'Zoom in')
          );
        }

        if (on) {
          requestAnimationFrame(() => {
            canvas.scrollLeft = (canvas.scrollWidth - canvas.clientWidth) / 2;
            canvas.scrollTop = (canvas.scrollHeight - canvas.clientHeight) / 2;
          });
        } else {
          canvas.scrollLeft = 0;
          canvas.scrollTop = 0;
        }
      };

      const renderZoom = () => {
        if (!images.length || !canvas) return;

        const slide = images[zoomIndex];
        const link = slide.querySelector('[data-product-zoom]');

        if (!link) return;

        let image = canvas.querySelector('img');

        if (!image) {
          image = document.createElement('img');
          canvas.appendChild(image);
        }

        image.src = link.dataset.zoomSrc || link.getAttribute('href') || '';
        image.alt = link.dataset.zoomAlt || '';

        setZoomed(false);

        if (zoomCounter) {
          zoomCounter.textContent =
            `${zoomIndex + 1} / ${images.length}`;
        }

        if (zoomPrevious) zoomPrevious.disabled = zoomIndex === 0;
        if (zoomNext) zoomNext.disabled = zoomIndex === images.length - 1;
      };

      /* Open from any zoom link in the gallery */
      node.addEventListener(
        'click',
        (event) => {
          const link = event.target.closest('[data-product-zoom]');

          if (!link || !node.contains(link)) return;

          event.preventDefault();

          const slide = link.closest('[data-product-media]');
          const index = images.indexOf(slide);

          zoomIndex = index >= 0 ? index : 0;
          zoomOpener = link;

          renderZoom();

          if (dialog.open) return;

          if (typeof dialog.showModal === 'function') {
            dialog.showModal();
          } else {
            dialog.setAttribute('open', '');
          }
        },
        { signal }
      );

      closeButton?.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          closeDialog();
        },
        { signal }
      );

      /* Click on the image toggles zoom in / zoom out */
      canvas?.addEventListener(
        'click',
        () => setZoomed(!canvas.classList.contains('is-zoomed')),
        { signal }
      );

      zoomToggle?.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          setZoomed(!canvas.classList.contains('is-zoomed'));
        },
        { signal }
      );

      /* Click on the backdrop closes the dialog */
      dialog.addEventListener(
        'click',
        (event) => {
          if (event.target === dialog) closeDialog();
        },
        { signal }
      );

      dialog.addEventListener(
        'close',
        () => {
          setZoomed(false);

          /* Keep the main gallery on the image that was being viewed */
          const viewed = images[zoomIndex];
          const viewedIndex = viewed ? slides.indexOf(viewed) : -1;

          if (viewedIndex >= 0 && viewedIndex !== active) {
            go(viewedIndex, false);
          }

          zoomOpener?.focus({ preventScroll: true });
          zoomOpener = null;
        },
        { signal }
      );

      zoomPrevious?.addEventListener(
        'click',
        () => {
          if (zoomIndex > 0) {
            zoomIndex--;  
            renderZoom();
          }
        },
        { signal }
      );

      zoomNext?.addEventListener(
        'click',
        () => {
          if (zoomIndex < images.length - 1) {
            zoomIndex++;
            renderZoom();
          }
        },
        { signal }
      );

        const SLIDE_MS = 260;   /* speed of the slide after you let go */
      const SLIDE_GAP = 0;   /* space between two images while sliding (px) */
      const SWIPE_DISTANCE = 0.25; /* how far (share of the width) counts as a swipe */

      let swipe = null;
      let swipeBusy = false;

      const zoomSource = (index) => {
        const slide = images[index];
        const link = slide && slide.querySelector('[data-product-zoom]');

        if (!link) return null;

        return {
          src: link.dataset.zoomSrc || link.getAttribute('href') || '',
          alt: link.dataset.zoomAlt || ''
        };
      };

      const targetFor = (dx) => {
        /* Swipe left shows the next image (the opposite on the Arabic version) */
        const goNext = (dx < 0) !== isRtl();
        const index = zoomIndex + (goNext ? 1 : -1);

        return {
          index,
          valid: index >= 0 && index < images.length
        };
      };

      const setNeighbour = (state, side, index) => {
        if (state.neighbour && state.neighbour.dataset.target === String(index)) return;

        state.neighbour?.remove();
        state.neighbour = null;

        const source = zoomSource(index);

        if (!source) return;

        const neighbour = state.image.cloneNode(false);

        neighbour.src = source.src;
        neighbour.alt = source.alt;
        neighbour.removeAttribute('srcset');
        neighbour.removeAttribute('sizes');
        neighbour.setAttribute('aria-hidden', 'true');
        neighbour.dataset.target = String(index);

        Object.assign(neighbour.style, {
          position: 'absolute',
          left: state.image.offsetLeft + 'px',
          top: state.image.offsetTop + 'px',
          width: state.image.offsetWidth + 'px',
          height: state.image.offsetHeight + 'px',
          objectFit: 'contain',
          pointerEvents: 'none',
          transition: 'none'
        });

        canvas.appendChild(neighbour);

        state.neighbour = neighbour;
        state.side = side;
      };

      canvas?.addEventListener(
        'touchstart',
        (event) => {
          const image = canvas.querySelector('img');

          if (
            swipeBusy ||
            !image ||
            event.touches.length !== 1 ||
            canvas.classList.contains('is-zoomed')
          ) {
            swipe = null;
            return;
          }

          swipe = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
            time: Date.now(),
            dx: 0,
            started: false,
            image,
            neighbour: null,
            side: 0,
            width: canvas.clientWidth
          };
        },
        { passive: true, signal }
      );

      canvas?.addEventListener(
        'touchmove',
        (event) => {
          if (!swipe) return;

          const dx = event.touches[0].clientX - swipe.x;
          const dy = event.touches[0].clientY - swipe.y;

          if (!swipe.started) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;

            /* Mostly vertical: not a swipe */
            if (Math.abs(dy) > Math.abs(dx)) {
              swipe = null;
              return;
            }

            swipe.started = true;
            swipe.previousOverflow = canvas.style.overflow;
            swipe.previousPosition = canvas.style.position;

            if (window.getComputedStyle(canvas).position === 'static') {
              canvas.style.position = 'relative';
            }

            canvas.style.overflow = 'hidden';

            swipe.image.style.transition = 'none';
            swipe.image.style.willChange = 'transform';
          }

          swipe.dx = dx;

          const side = dx < 0 ? 1 : -1;
          const target = targetFor(dx);

          if (target.valid) {
            setNeighbour(swipe, side, target.index);
          } else if (swipe.neighbour) {
            swipe.neighbour.remove();
            swipe.neighbour = null;
          }

          /* First / last image: pull is harder, like a rubber band */
          const move = target.valid ? dx : dx * 0.3;

          swipe.image.style.transform = 'translateX(' + move + 'px)';

          if (swipe.neighbour) {
            swipe.neighbour.style.transform =
              'translateX(' + (move + side * (swipe.width + SLIDE_GAP)) + 'px)';
          }
        },
        { passive: true, signal }
      );

      const finishSwipe = () => {
        if (!swipe) return;

        const current = swipe;

        swipe = null;

        if (!current.started) return;

        const elapsed = Math.max(1, Date.now() - current.time);
        const velocity = Math.abs(current.dx) / elapsed;
        const target = targetFor(current.dx);
        const side = current.dx < 0 ? 1 : -1;

        const passed =
          Math.abs(current.dx) > current.width * SWIPE_DISTANCE ||
          (velocity > 0.45 && Math.abs(current.dx) > 30);

        const moves = target.valid && passed && Boolean(current.neighbour);
        const ease = 'transform ' + SLIDE_MS + 'ms cubic-bezier(0.22, 0.61, 0.36, 1)';

        swipeBusy = true;

        current.image.style.transition = ease;

        if (current.neighbour) {
          current.neighbour.style.transition = ease;
        }

        if (moves) {
          /* Finish the slide: the old image leaves, the new one lands in the middle */
          current.image.style.transform =
            'translateX(' + -side * (current.width + SLIDE_GAP) + 'px)';
          current.neighbour.style.transform = 'translateX(0)';
        } else {
          /* Not far enough: everything goes back */
          current.image.style.transform = 'translateX(0)';

          if (current.neighbour) {
            current.neighbour.style.transform =
              'translateX(' + side * (current.width + SLIDE_GAP) + 'px)';
          }
        }

        window.setTimeout(() => {
          if (moves) {
            const shown = current.neighbour;

            current.image.remove();

            shown.removeAttribute('style');
            shown.removeAttribute('aria-hidden');
            delete shown.dataset.target;

            zoomIndex = target.index;

            /* Updates the counter, the buttons and the alt text. The picture is already loaded. */
            renderZoom();
          } else {
            current.neighbour?.remove();

            current.image.style.transition = '';
            current.image.style.transform = '';
            current.image.style.willChange = '';
          }

          canvas.style.overflow = current.previousOverflow;
          canvas.style.position = current.previousPosition;

          swipeBusy = false;
        }, SLIDE_MS + 20);
      };

      canvas?.addEventListener('touchend', finishSwipe, { passive: true, signal });
      canvas?.addEventListener('touchcancel', finishSwipe, { passive: true, signal });

      dialog.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Escape') {
            closeDialog();
            return;
          }

          if (event.key === 'ArrowRight') {
            event.preventDefault();
            (isRtl() ? zoomPrevious : zoomNext)?.click();
          }

          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            (isRtl() ? zoomNext : zoomPrevious)?.click();
          }
        },
        { signal }
      );
    }

    return {
      selectMedia: (id) => {
        const index = slides.findIndex(
          (slide) => String(slide.dataset.productMedia) === String(id)
        );

        if (index >= 0) go(index);
      }
    };
  }

  /* =========================================================
     QUANTITY
  ========================================================= */

  function quantity(root, signal) {
    const getInput = (button) =>
      button.closest('.quantity-selector')?.querySelector(
        '[data-quantity-input]'
      );

    /*
      `emit` is false when called from the input's own "change" handler.
      Dispatching "change" from inside a "change" handler caused an
      infinite loop in the previous version.
    */
    const normalize = (input, value, emit = true) => {
      const min = Number(input.min) || 1;
      const step = Number(input.step) || 1;
      const max = input.max !== '' ? Number(input.max) : Infinity;

      value = Number(value);

      if (!Number.isFinite(value)) value = min;

      value = Math.max(min, value);
      value = Math.min(max, value);

      const steps = Math.round((value - min) / step);
      value = min + steps * step;

      if (value > max) value = min + Math.floor((max - min) / step) * step;
      value = Math.max(min, value);

      const nextValue = String(value);
      const changed = input.value !== nextValue;

      input.value = nextValue;

      if (emit && changed) {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    root.addEventListener(
      'click',
      (event) => {
        const plus = event.target.closest('[data-quantity-plus]');
        const minus = event.target.closest('[data-quantity-minus]');

        if (!plus && !minus) return;

        event.preventDefault();

        const input = getInput(plus || minus);
        if (!input) return;

        const step = Number(input.step) || 1;
        const current = Number(input.value) || Number(input.min) || 1;

        normalize(input, plus ? current + step : current - step);
      },
      { signal }
    );

    root.addEventListener(
      'change',
      (event) => {
        if (!event.target.matches('[data-quantity-input]')) return;

        normalize(event.target, event.target.value, false);
      },
      { signal }
    );
  }

  /* =========================================================
     VARIANTS
  ========================================================= */

  function variants(root, media, signal) {
    const form = root.querySelector('.product-form');
    if (!form) return;

    const selects = [...root.querySelectorAll('[data-product-option]')].sort(
      (a, b) =>
        Number(a.dataset.optionPosition) - Number(b.dataset.optionPosition)
    );

    if (!selects.length) return;

    const variantData = root.querySelector('[data-product-variants-json]');

    if (!variantData) {
      console.error('Hilya: variant JSON is missing.');
      return;
    }

    let variantsList = [];

    try {
      const parsed = JSON.parse(variantData.textContent);
      variantsList = Array.isArray(parsed) ? parsed : parsed.variants || [];
    } catch (error) {
      console.error('Hilya: invalid variant JSON.', error);
      return;
    }

    if (!variantsList.length) return;

    const variantInput = form.querySelector('input[name="id"]');

    const currentValues = () => selects.map((select) => select.value);

    const sameOptions = (variant, values) =>
      Array.isArray(variant.options) &&
      variant.options.every(
        (optionValue, index) => String(optionValue) === String(values[index])
      );

    const findExact = () => {
      const values = currentValues();
      return variantsList.find((variant) => sameOptions(variant, values));
    };

    /*
      If the exact combination does not exist (for example Gold Plated
      + a size that only exists in Silver Plated), pick the closest
      variant that has the option the shopper just changed.
    */
    const findClosest = (changedIndex) => {
      const values = currentValues();

      const candidates = variantsList.filter(
        (variant) =>
          Array.isArray(variant.options) &&
          String(variant.options[changedIndex]) === String(values[changedIndex])
      );

      if (!candidates.length) return undefined;

      const score = (variant) =>
        variant.options.reduce(
          (total, optionValue, index) =>
            total +
            (index !== changedIndex &&
            String(optionValue) === String(values[index])
              ? 1
              : 0),
          0
        );

      return candidates.sort(
        (a, b) =>
          score(b) - score(a) || Number(b.available) - Number(a.available)
      )[0];
    };

    let fetchController = null;

    signal.addEventListener('abort', () => fetchController?.abort(), {
      once: true
    });

    /* Re-render price / discount / stock note from the server */
    const refreshFromServer = async (variant) => {
      const sectionId = root.dataset.sectionId;
      const base = root.dataset.productUrl;

      if (!sectionId || !base) return;

      fetchController?.abort();

      const controller = new AbortController();
      fetchController = controller;

      const priceBlock = root.querySelector('[data-product-price-block]');
      priceBlock?.classList.add('is-updating');

      try {
        const response = await fetch(
          `${base}?variant=${variant.id}&section_id=${encodeURIComponent(sectionId)}`,
          {
            signal: controller.signal,
            headers: { Accept: 'text/html' }
          }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        ['[data-product-price-block]', '[data-product-inventory]'].forEach(
          (selector) => {
            const fresh = doc.querySelector(selector);
            const current = root.querySelector(selector);

            if (fresh && current) current.innerHTML = fresh.innerHTML;
          }
        );
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('Hilya: could not refresh price.', error);
        }
      } finally {
        if (fetchController === controller) {
          root
            .querySelector('[data-product-price-block]')
            ?.classList.remove('is-updating');
        }
      }
    };

    const apply = (variant, { updateUrl = true } = {}) => {
      /* Keep the selects in sync with the chosen variant */
      selects.forEach((select, index) => {
        const wanted = variant.options[index];

        if (wanted !== undefined && select.value !== String(wanted)) {
          select.value = String(wanted);
        }
      });

      /* Variant id sent to the cart */
      if (variantInput) variantInput.value = variant.id;

      root.dataset.productPrice = variant.price_formatted || variant.price;

      /*
        Price and compare-at price are rendered by the server through the
        theme's own price snippet (see refreshFromServer), so the currency
        format always matches the rest of the page.
      */

      /* Availability */
      const add = root.querySelector('[data-product-add]');
      const buy = root.querySelector('[data-product-buy]');

      if (add) {
        add.disabled = !variant.available;

        if (variant.available) {
          add.removeAttribute('data-unavailable');
        } else {
          add.dataset.unavailable = 'true';
        }

        const label = add.querySelector('[data-product-add-label]');

        if (label) {
          label.textContent = variant.available
            ? root.dataset.addLabel || 'Add to cart'
            : root.dataset.soldOutLabel || 'Sold out';
        }
      }

      if (buy) buy.disabled = !variant.available;

      /* Quantity rules */
      const quantityInput = root.querySelector('[data-quantity-input]');

      if (quantityInput) {
        const min = variant.quantity_rule?.min || 1;
        const step = variant.quantity_rule?.increment || 1;
        const max = variant.quantity_rule?.max;

        quantityInput.min = String(min);
        quantityInput.step = String(step);

        if (max) {
          quantityInput.max = String(max);
        } else {
          quantityInput.removeAttribute('max');
        }

        const current = Number(quantityInput.value) || min;

        quantityInput.value = String(
          Math.max(min, max ? Math.min(max, current) : current)
        );
      }

      /* Variant image */
      if (variant.featured_media_id) {
        media.selectMedia(variant.featured_media_id);
      }

      /* URL */
      if (updateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);

        history.replaceState(history.state, '', url.href);
      }

      refreshFromServer(variant);

      document.dispatchEvent(
        new CustomEvent('theme:product-variant', { detail: variant })
      );
    };

    const onChange = (select) => {
      const index = selects.indexOf(select);

      let variant = findExact();

      if (!variant) variant = findClosest(index);
      if (!variant) return;

      apply(variant);
    };

    selects.forEach((select) => {
      select.addEventListener('change', () => onChange(select), { signal });
    });

    /* Browser form restore can leave selects out of sync with the hidden id */
    const initial = findExact();

    if (
      initial &&
      variantInput &&
      String(initial.id) !== String(variantInput.value)
    ) {
      apply(initial, { updateUrl: false });
    }
  }

  /* =========================================================
     OPTION PILLS (visual layer over the hidden <select>s)
  ========================================================= */

  function optionPills(root, signal) {
    const groups = [...root.querySelectorAll('[data-option-pills]')];
    if (!groups.length) return;

    const selectFor = (group) =>
      root.querySelector(
        `[data-product-option][data-option-position="${group.dataset.optionPosition}"]`
      );

    const sync = () => {
      groups.forEach((group) => {
        const select = selectFor(group);
        if (!select) return;

        group.querySelectorAll('[data-option-value]').forEach((pill) => {
          const on = pill.dataset.optionValue === select.value;

          pill.setAttribute('aria-checked', String(on));
          pill.tabIndex = on ? 0 : -1;
        });
      });
    };

    const choose = (pill) => {
      const group = pill.closest('[data-option-pills]');
      const select = group && selectFor(group);

      if (!select || select.value === pill.dataset.optionValue) return;

      select.value = pill.dataset.optionValue;
      select.dispatchEvent(new Event('change', { bubbles: true }));

      sync();
    };

    root.addEventListener(
      'click',
      (event) => {
        const pill = event.target.closest('[data-option-value]');
        if (pill) choose(pill);
      },
      { signal }
    );

    root.addEventListener(
      'keydown',
      (event) => {
        const pill = event.target.closest('[data-option-value]');
        if (!pill) return;

        const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
        if (!keys.includes(event.key)) return;

        event.preventDefault();

        const list = [...pill.closest('[data-option-pills]').children];
        const forward =
          event.key === 'ArrowDown' ||
          (event.key === 'ArrowRight' ? !isRtl() : event.key === 'ArrowLeft' && isRtl());

        const target =
          list[(list.indexOf(pill) + (forward ? 1 : -1) + list.length) % list.length];

        target.focus();
        choose(target);
      },
      { signal }
    );

    /* Runs after variants() has finished adjusting the selects */
    root.addEventListener(
      'change',
      (event) => {
        if (event.target.matches('[data-product-option]')) sync();
      },
      { signal }
    );

    sync();
  }

  /* =========================================================
     PERSONALIZATION
  ========================================================= */

  function personalization(root, signal) {
    const form = root.querySelector('.product-form');
    if (!form) return;

    const letterError = 'Please enter one letter (Arabic or English).';

    const isOneLetter = (value) => /^\p{L}$/u.test(value);

    /* Keep only the first letter while typing */
    const cleanLetter = (input) => {
      const first = Array.from(input.value.replace(/[^\p{L}]/gu, ''))[0] || '';

      if (input.value !== first) input.value = first;

      input.setCustomValidity('');
    };

    form.addEventListener(
      'submit',
      (event) => {
        const nameRequired = root.dataset.nameRequired === 'true';
        const dateRequired = root.dataset.dateRequired === 'true';
        const letterRequired = root.dataset.letterRequired === 'true';

        const name = form.querySelector('[data-personalization-name]');
        const date = form.querySelector('[data-personalization-date]');
        const letter = form.querySelector('[data-personalization-letter]');

        if (nameRequired && name && !name.value.trim()) {
          event.preventDefault();
          name.setCustomValidity('Please enter the name.');
          name.reportValidity();
          return;
        }

        if (name) name.setCustomValidity('');

        if (dateRequired && date && !date.value) {
          event.preventDefault();
          date.setCustomValidity('Please select the date.');
          date.reportValidity();
          return;
        }

        if (date) date.setCustomValidity('');

        if (letterRequired && letter && !isOneLetter(letter.value.trim())) {
          event.preventDefault();
          letter.setCustomValidity(letterError);
          letter.reportValidity();
          return;
        }

        if (letter) letter.setCustomValidity('');
      },
      { capture: true, signal }
    );

    form.addEventListener(
      'input',
      (event) => {
        if (event.target.matches('[data-personalization-letter]')) {
          /* Do not touch the text while an Arabic keyboard is still composing it */
          if (!event.isComposing) cleanLetter(event.target);
          return;
        }

        if (
          event.target.matches(
            '[data-personalization-name], [data-personalization-date]'
          )
        ) {
          event.target.setCustomValidity('');
        }
      },
      { signal }
    );

    form.addEventListener(
      'compositionend',
      (event) => {
        if (event.target.matches('[data-personalization-letter]')) {
          cleanLetter(event.target);
        }
      },
      { signal }
    );
  }


  /* =========================================================
     DESCRIPTION
  ========================================================= */

  function descriptions(root, signal) {
    root
      .querySelectorAll('[data-product-description][data-truncate]')
      .forEach((node) => {
        const text = node.querySelector('[data-description-text]');
        const button = node.querySelector('[data-description-more]');
        const details = node.closest('details');

        if (!text || !button || !details) return;

        const measure = () => {
          if (button.getAttribute('aria-expanded') === 'true' || !details.open) {
            return;
          }

          node.classList.add('is-collapsed');

          const overflow = text.scrollHeight > text.clientHeight + 2;

          button.hidden = !overflow;

          if (!overflow) node.classList.remove('is-collapsed');
        };

        button.addEventListener(
          'click',
          () => {
            const expanded = button.getAttribute('aria-expanded') !== 'true';

            button.setAttribute('aria-expanded', String(expanded));
            button.textContent = expanded
              ? button.dataset.less
              : button.dataset.more;
            node.classList.toggle('is-collapsed', !expanded);
          },
          { signal }
        );

        details.addEventListener('toggle', measure, { signal });

        window.addEventListener('resize', measure, {
          passive: true,
          signal
        });

        measure();
      });
  }

  /* =========================================================
     BACK NAVIGATION
     Returns the shopper to the listing page they actually came
     from (collection / all products / search), not to the first
     collection the product happens to belong to.
  ========================================================= */

  const BACK_TO = 'Back to';
  const BACK_TO_SEARCH = 'Back to search results';

  function backNavigation(root, signal) {
  const ready = () => root.removeAttribute('data-back-pending');

  if (!document.referrer) return ready();

  let ref;
  try {
    ref = new URL(document.referrer);
  } catch (error) {
    return ready();
  }

  if (ref.origin !== window.location.origin) return ready();

  const isCollection = /\/collections\/[^/]+\/?$/.test(ref.pathname);
  const isSearch = /\/search\/?$/.test(ref.pathname);

  if (!isCollection && !isSearch) return ready();

  const href = ref.pathname + ref.search;

  const back = root.querySelector('[data-product-back]');
  const backLabel = root.querySelector('[data-product-back-label]');
  const crumb = root.querySelector('.product-breadcrumbs a[href*="/collections/"]');

  if (back) back.setAttribute('href', href);
  if (crumb) crumb.setAttribute('href', href);

  const apply = (title) => {
    if (title) {
      if (backLabel) backLabel.textContent = `${BACK_TO} ${title}`;
      if (crumb) crumb.textContent = title;
    }
    ready();
  };

  if (isSearch) {
    if (backLabel) backLabel.textContent = BACK_TO_SEARCH;
    if (crumb) crumb.textContent = BACK_TO_SEARCH.replace(/^Back to /, '');
    return ready();
  }

  const cacheKey = `back-title:${ref.pathname}`;

  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return apply(cached);
  } catch (error) {}

  /* لو الـ fetch اتأخر، اظهر النص الافتراضي بدل ما يفضل مخفي */
  const timer = setTimeout(ready, 1500);

  fetch(href, { signal, credentials: 'same-origin' })
    .then((response) => (response.ok ? response.text() : ''))
    .then((html) => {
      let title = '';

      if (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const heading = doc.querySelector('h1')?.textContent?.trim();
        const fromTitle = doc.title?.split(/\s[–|\-—]\s/)[0]?.trim();
        title = heading || fromTitle || '';
      }

      if (title) {
        try { sessionStorage.setItem(cacheKey, title); } catch (error) {}
      }

      clearTimeout(timer);
      apply(title);
    })
    .catch(() => {
      clearTimeout(timer);
      ready();
    });
}

  /* =========================================================
     INIT
  ========================================================= */

  function bind(scope = document) {
    scope.querySelectorAll('[data-product-page]').forEach((root) => {
      if (controllers.has(root)) return;

      const controller = new AbortController();
      controllers.set(root, controller);

      const { signal } = controller;

      /* One failing module must not break the others */
      const safely = (name, fn) => {
        try {
          return fn();
        } catch (error) {
          console.error(`Hilya: ${name} failed.`, error);
        }
      };

      const media =
        safely('gallery', () => gallery(root, signal)) ||
        { selectMedia: () => {} };

      safely('quantity', () => quantity(root, signal));
      safely('variants', () => variants(root, media, signal));
      safely('optionPills', () => optionPills(root, signal));
      safely('backNavigation', () => backNavigation(root, signal));
      safely('personalization', () => personalization(root, signal));
      safely('descriptions', () => descriptions(root, signal));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bind(), { once: true });
  } else {
    bind();
  }

  document.addEventListener('shopify:section:load', (event) => {
    bind(event.target);
  });

  document.addEventListener('shopify:section:unload', (event) => {
    event.target.querySelectorAll('[data-product-page]').forEach((root) => {
      controllers.get(root)?.abort();
      controllers.delete(root);
    });
  });
})();
