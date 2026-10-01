```javascript
(() => {
  const controllers = new WeakMap();

  const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =========================================================
     GALLERY
  ========================================================= */

  function gallery(root, signal) {
    const node = root.querySelector('[data-product-gallery]');
    if (!node) return { selectMedia: () => {} };

    const track = node.querySelector('[data-product-media-track]');
    const slides = [...node.querySelectorAll('[data-product-media]')];
    const thumbnails = [...node.querySelectorAll('[data-product-thumbnail]')];
    const previous = node.querySelector('[data-product-previous]');
    const next = node.querySelector('[data-product-next]');
    const status = node.querySelector('[data-product-media-status]');

    if (!track || !slides.length) {
      return { selectMedia: () => {} };
    }

    let active = -1;
    let scrollFrame = null;

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

      if (previous) {
        previous.disabled = index <= 0;
      }

      if (next) {
        next.disabled = index >= slides.length - 1;
      }

      const counter = node.querySelector(
        '[data-product-media-counter]'
      );

      if (counter) {
        counter.textContent = String(index + 1);
      }

      if (status) {
        status.textContent =
          slides[index].getAttribute('aria-label') || '';
      }
    };

    const go = (index, smooth = true) => {
      if (!slides.length) return;

      index = Math.max(
        0,
        Math.min(slides.length - 1, index)
      );

      const slide = slides[index];

      mark(index);

      track.scrollTo({
        left: slide.offsetLeft,
        behavior:
          smooth && !reducedMotion()
            ? 'smooth'
            : 'auto'
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

    track.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(scrollFrame);

        scrollFrame = requestAnimationFrame(() => {
          const trackRect =
            track.getBoundingClientRect();

          const center =
            (trackRect.left + trackRect.right) / 2;

          let closest = 0;
          let distance = Infinity;

          slides.forEach((slide, index) => {
            const rect =
              slide.getBoundingClientRect();

            const slideCenter =
              (rect.left + rect.right) / 2;

            const currentDistance =
              Math.abs(slideCenter - center);

            if (currentDistance < distance) {
              distance = currentDistance;
              closest = index;
            }
          });

          if (closest !== active) {
            mark(closest);
          }
        });
      },
      {
        passive: true,
        signal
      }
    );

    signal.addEventListener(
      'abort',
      () => {
        cancelAnimationFrame(scrollFrame);
      },
      { once: true }
    );

    const initialIndex =
      Number(node.dataset.initialIndex) || 0;

    go(initialIndex, false);

    /* -------------------------
       ZOOM
    ------------------------- */

    const dialog = node.querySelector(
      '[data-product-zoom-dialog]'
    );

    if (dialog) {
      const images = slides.filter(
        (slide) =>
          slide.dataset.mediaType === 'image'
      );

      const canvas = dialog.querySelector(
        '[data-product-zoom-canvas]'
      );

      const closeButton = dialog.querySelector(
        '[data-product-zoom-close]'
      );

      const zoomPrevious = dialog.querySelector(
        '[data-product-zoom-previous]'
      );

      const zoomNext = dialog.querySelector(
        '[data-product-zoom-next]'
      );

      let zoomIndex = 0;
      let zoomOpener = null;

      const renderZoom = () => {
        if (!images.length || !canvas) return;

        const slide = images[zoomIndex];

        const link = slide.querySelector(
          '[data-product-zoom]'
        );

        if (!link) return;

        let image = canvas.querySelector('img');

        if (!image) {
          image = document.createElement('img');
          canvas.appendChild(image);
        }

        image.src = link.dataset.zoomSrc || '';
        image.alt = link.dataset.zoomAlt || '';

        const counter = dialog.querySelector(
          '[data-product-zoom-counter]'
        );

        if (counter) {
          counter.textContent =
            slide.getAttribute('aria-label') || '';
        }

        if (zoomPrevious) {
          zoomPrevious.disabled =
            zoomIndex === 0;
        }

        if (zoomNext) {
          zoomNext.disabled =
            zoomIndex === images.length - 1;
        }
      };

      node.addEventListener(
        'click',
        (event) => {
          const link =
            event.target.closest(
              '[data-product-zoom]'
            );

          if (!link) return;

          event.preventDefault();

          const slide =
            link.closest(
              '[data-product-media]'
            );

          const index =
            images.indexOf(slide);

          zoomIndex =
            index >= 0 ? index : 0;

          zoomOpener = link;

          renderZoom();

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

          if (typeof dialog.close === 'function') {
            dialog.close();
          } else {
            dialog.removeAttribute('open');
          }
        },
        { signal }
      );

      dialog.addEventListener(
        'cancel',
        (event) => {
          event.preventDefault();

          if (typeof dialog.close === 'function') {
            dialog.close();
          } else {
            dialog.removeAttribute('open');
          }
        },
        { signal }
      );

      dialog.addEventListener(
        'click',
        (event) => {
          if (event.target === dialog) {
            if (typeof dialog.close === 'function') {
              dialog.close();
            } else {
              dialog.removeAttribute('open');
            }
          }
        },
        { signal }
      );

      dialog.addEventListener(
        'close',
        () => {
          zoomOpener?.focus({
            preventScroll: true
          });

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

      dialog.addEventListener(
        'keydown',
        (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();

            if (typeof dialog.close === 'function') {
              dialog.close();
            } else {
              dialog.removeAttribute('open');
            }

            return;
          }

          if (event.key === 'ArrowRight') {
            event.preventDefault();
            zoomNext?.click();
          }

          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            zoomPrevious?.click();
          }
        },
        { signal }
      );
    }

    return {
      selectMedia: (id) => {
        const index =
          slides.findIndex(
            (slide) =>
              String(slide.dataset.productMedia) ===
              String(id)
          );

        if (index >= 0) {
          go(index);
        }
      }
    };
  }

  /* =========================================================
     QUANTITY
  ========================================================= */

  function quantity(root, signal) {
    const getInput = (button) => {
      const wrapper =
        button.closest('.quantity-selector');

      return wrapper?.querySelector(
        '[data-quantity-input]'
      );
    };

    const normalize = (input, value) => {
      const min =
        Number(input.min) || 1;

      const step =
        Number(input.step) || 1;

      const max =
        input.max !== ''
          ? Number(input.max)
          : Infinity;

      value = Number(value);

      if (!Number.isFinite(value)) {
        value = min;
      }

      value = Math.max(min, value);
      value = Math.min(max, value);

      const steps =
        Math.round((value - min) / step);

      value =
        min + steps * step;

      value = Math.max(min, value);
      value = Math.min(max, value);

      input.value = String(value);

      input.dispatchEvent(
        new Event('change', {
          bubbles: true
        })
      );
    };

    root.addEventListener(
      'click',
      (event) => {
        const plus =
          event.target.closest(
            '[data-quantity-plus]'
          );

        const minus =
          event.target.closest(
            '[data-quantity-minus]'
          );

        if (!plus && !minus) return;

        event.preventDefault();

        const input =
          getInput(plus || minus);

        if (!input) return;

        const step =
          Number(input.step) || 1;

        const current =
          Number(input.value) ||
          Number(input.min) ||
          1;

        if (plus) {
          normalize(
            input,
            current + step
          );
        } else {
          normalize(
            input,
            current - step
          );
        }
      },
      { signal }
    );

    root.addEventListener(
      'change',
      (event) => {
        if (
          !event.target.matches(
            '[data-quantity-input]'
          )
        ) {
          return;
        }

        normalize(
          event.target,
          event.target.value
        );
      },
      { signal }
    );
  }

  /* =========================================================
     VARIANTS
  ========================================================= */

  function variants(root, media, signal) {
    const form =
      root.querySelector('.product-form');

    if (!form) return;

    const selects = [
      ...root.querySelectorAll(
        '[data-product-option]'
      )
    ];

    if (!selects.length) return;

    const variantData =
      root.querySelector(
        '[data-product-variants-json]'
      );

    if (!variantData) {
      console.error(
        'Hilya: variant JSON is missing.'
      );
      return;
    }

    let variantsList = [];

    try {
      variantsList =
        JSON.parse(
          variantData.textContent
        );
    } catch (error) {
      console.error(
        'Hilya: invalid variant JSON.',
        error
      );
      return;
    }

    const findVariant = () => {
      const selectedValues =
        selects.map(
          (select) => select.value
        );

      return variantsList.find(
        (variant) => {
          if (!variant.options) {
            return false;
          }

          return variant.options.every(
            (optionValue, index) =>
              String(optionValue) ===
              String(selectedValues[index])
          );
        }
      );
    };

    const update = () => {
      const variant =
        findVariant();

      if (!variant) {
        return;
      }

      const variantId =
        root.querySelector(
          '[data-product-variant-id]'
        );

      const variantInput =
        form.querySelector(
          'input[name="id"]'
        );

      if (variantInput) {
        variantInput.value =
          variant.id;
      }

      if (variantId) {
        variantId.textContent =
          variant.id;
      }

      root.dataset.productPrice =
        variant.price;

      /* Price */

      const priceCurrent =
        root.querySelector(
          '.product-page__price .price__current'
        );

      if (priceCurrent) {
        priceCurrent.textContent =
          variant.price_formatted;
      }

      /* Compare at price */

      const compare =
        root.querySelector(
          '[data-variant-compare-price]'
        );

      if (compare) {
        if (
          variant.compare_at_price &&
          Number(variant.compare_at_price) >
            Number(variant.price)
        ) {
          compare.textContent =
            variant.compare_at_price_formatted;

          compare.hidden = false;
        } else {
          compare.hidden = true;
        }
      }

      /* Availability */

      const add =
        root.querySelector(
          '[data-product-add]'
        );

      const buy =
        root.querySelector(
          '[data-product-buy]'
        );

      if (add) {
        add.disabled =
          !variant.available;

        if (variant.available) {
          add.removeAttribute(
            'data-unavailable'
          );
        } else {
          add.dataset.unavailable =
            'true';
        }

        const label =
          add.querySelector(
            '[data-product-add-label]'
          );

        if (label) {
          label.textContent =
            variant.available
              ? 'Add to cart'
              : 'Sold out';
        }
      }

      if (buy) {
        buy.disabled =
          !variant.available;
      }

      /* Quantity */

      const quantityInput =
        root.querySelector(
          '[data-quantity-input]'
        );

      if (quantityInput) {
        const min =
          variant.quantity_rule?.min || 1;

        const step =
          variant.quantity_rule?.increment || 1;

        const max =
          variant.quantity_rule?.max;

        quantityInput.min =
          String(min);

        quantityInput.step =
          String(step);

        if (max) {
          quantityInput.max =
            String(max);
        } else {
          quantityInput.removeAttribute(
            'max'
          );
        }

        const current =
          Number(quantityInput.value) ||
          min;

        quantityInput.value =
          String(
            Math.max(
              min,
              max
                ? Math.min(max, current)
                : current
            )
          );
      }

      /* Featured image */

      if (variant.featured_media_id) {
        media.selectMedia(
          variant.featured_media_id
        );
      }

      /* URL */

      const url =
        new URL(
          window.location.href
        );

      url.searchParams.set(
        'variant',
        variant.id
      );

      history.replaceState(
        history.state,
        '',
        url.href
      );

      document.dispatchEvent(
        new CustomEvent(
          'theme:product-variant',
          {
            detail: variant
          }
        )
      );
    };

    selects.forEach((select) => {
      select.addEventListener(
        'change',
        update,
        { signal }
      );
    });

    update();
  }

  /* =========================================================
     PERSONALIZATION
  ========================================================= */

  function personalization(root, signal) {
    const form =
      root.querySelector('.product-form');

    if (!form) return;

    form.addEventListener(
      'submit',
      (event) => {
        const nameRequired =
          root.dataset.nameRequired ===
          'true';

        const dateRequired =
          root.dataset.dateRequired ===
          'true';

        const name =
          form.querySelector(
            '[data-personalization-name]'
          );

        const date =
          form.querySelector(
            '[data-personalization-date]'
          );

        if (
          nameRequired &&
          name &&
          !name.value.trim()
        ) {
          event.preventDefault();

          name.setCustomValidity(
            'Please enter the name.'
          );

          name.reportValidity();

          return;
        }

        if (name) {
          name.setCustomValidity('');
        }

        if (
          dateRequired &&
          date &&
          !date.value
        ) {
          event.preventDefault();

          date.setCustomValidity(
            'Please select the date.'
          );

          date.reportValidity();

          return;
        }

        if (date) {
          date.setCustomValidity('');
        }
      },
      {
        capture: true,
        signal
      }
    );

    form.addEventListener(
      'input',
      (event) => {
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
  }

  /* =========================================================
     DESCRIPTION
  ========================================================= */

  function descriptions(root, signal) {
    root
      .querySelectorAll(
        '[data-product-description][data-truncate]'
      )
      .forEach((node) => {
        const text =
          node.querySelector(
            '[data-description-text]'
          );

        const button =
          node.querySelector(
            '[data-description-more]'
          );

        const details =
          node.closest('details');

        if (!text || !button || !details) {
          return;
        }

        const measure = () => {
          if (
            button.getAttribute(
              'aria-expanded'
            ) === 'true' ||
            !details.open
          ) {
            return;
          }

          node.classList.add(
            'is-collapsed'
          );

          const overflow =
            text.scrollHeight >
            text.clientHeight + 2;

          button.hidden =
            !overflow;

          if (!overflow) {
            node.classList.remove(
              'is-collapsed'
            );
          }
        };

        button.addEventListener(
          'click',
          () => {
            const expanded =
              button.getAttribute(
                'aria-expanded'
              ) !== 'true';

            button.setAttribute(
              'aria-expanded',
              String(expanded)
            );

            node.classList.toggle(
              'is-collapsed',
              !expanded
            );
          },
          { signal }
        );

        details.addEventListener(
          'toggle',
          measure,
          { signal }
        );

        window.addEventListener(
          'resize',
          measure,
          {
            passive: true,
            signal
          }
        );

        measure();
      });
  }

  /* =========================================================
     INIT
  ========================================================= */

  function bind(scope = document) {
    scope
      .querySelectorAll(
        '[data-product-page]'
      )
      .forEach((root) => {
        if (controllers.has(root)) {
          return;
        }

        const controller =
          new AbortController();

        controllers.set(
          root,
          controller
        );

        const { signal } =
          controller;

        const media =
          gallery(root, signal);

        quantity(
          root,
          signal
        );

        variants(
          root,
          media,
          signal
        );

        personalization(
          root,
          signal
        );

        descriptions(
          root,
          signal
        );
      });
  }

  bind();

  document.addEventListener(
    'shopify:section:load',
    (event) => {
      bind(event.target);
    }
  );

  document.addEventListener(
    'shopify:section:unload',
    (event) => {
      event.target
        .querySelectorAll(
          '[data-product-page]'
        )
        .forEach((root) => {
          controllers
            .get(root)
            ?.abort();
        });
    }
  );
})();
```
