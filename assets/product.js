(() => {
  const controllers = new WeakMap();

  const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function gallery(root, signal) {
    const node = root.querySelector('[data-product-gallery]');
    if (!node) return { selectMedia: () => {} };

    const track = node.querySelector('[data-product-media-track]');
    const slides = [...node.querySelectorAll('[data-product-media]')];
    const thumbnails = [...node.querySelectorAll('[data-product-thumbnail]')];
    const previous = node.querySelector('[data-product-previous]');
    const next = node.querySelector('[data-product-next]');
    const rail = node.querySelector('[data-product-thumbnails]');

    let active = -1;
    let scrollFrame;

    const revealThumbnail = thumbnail => {
      if (!thumbnail || !rail) return;

      const box = rail.getBoundingClientRect();
      const item = thumbnail.getBoundingClientRect();

      if (rail.scrollHeight > rail.clientHeight) {
        const top =
          item.top < box.top
            ? item.top - box.top
            : item.bottom > box.bottom
              ? item.bottom - box.bottom
              : 0;

        if (top) {
          rail.scrollBy({
            top,
            behavior: reducedMotion() ? 'auto' : 'smooth'
          });
        }
      } else {
        const left =
          item.left < box.left
            ? item.left - box.left
            : item.right > box.right
              ? item.right - box.right
              : 0;

        if (left) {
          rail.scrollBy({
            left,
            behavior: reducedMotion() ? 'auto' : 'smooth'
          });
        }
      }
    };

    const mark = index => {
      if (index < 0 || index >= slides.length || active === index) return;

      active = index;

      slides.forEach((slide, position) => {
        slide.inert = position !== index;
        slide.setAttribute(
          'aria-hidden',
          String(position !== index)
        );

        if (position === index) return;

        slide.querySelectorAll('video').forEach(video => video.pause());

        slide.querySelectorAll('iframe').forEach(frame => {
          try {
            const origin = new URL(frame.src).origin;
            const host = new URL(frame.src).hostname;

            if (
              /(^|\.)(
                youtube\.com|
                youtube-nocookie\.com
              )$/x.test(host)
            ) {
              frame.contentWindow.postMessage(
                JSON.stringify({
                  event: 'command',
                  func: 'pauseVideo',
                  args: []
                }),
                origin
              );
            }

            if (/(^|\.)vimeo\.com$/.test(host)) {
              frame.contentWindow.postMessage(
                { method: 'pause' },
                origin
              );
            }
          } catch (_error) {}
        });
      });

      thumbnails.forEach((thumbnail, position) => {
        thumbnail.disabled = false;
        thumbnail.tabIndex = position === index ? 0 : -1;

        if (position === index) {
          thumbnail.setAttribute('aria-current', 'true');
        } else {
          thumbnail.removeAttribute('aria-current');
        }
      });

      if (previous) previous.disabled = index === 0;
      if (next) next.disabled = index === slides.length - 1;

      const counter = node.querySelector(
        '[data-product-media-counter]'
      );

      if (counter) counter.textContent = index + 1;

      const status = node.querySelector(
        '[data-product-media-status]'
      );

      if (status) {
        status.textContent =
          slides[index].getAttribute('aria-label') || '';
      }

      revealThumbnail(thumbnails[index]);
    };

    const go = (index, smooth = true) => {
      if (!slides.length) return;

      index = Math.max(
        0,
        Math.min(slides.length - 1, index)
      );

      const target = slides[index].getBoundingClientRect();
      const box = track.getBoundingClientRect();

      const rtl =
        getComputedStyle(track).direction === 'rtl';

      const delta = rtl
        ? target.right - box.right
        : target.left - box.left;

      mark(index);

      track.scrollTo({
        left: track.scrollLeft + delta,
        behavior:
          smooth && !reducedMotion()
            ? 'smooth'
            : 'auto'
      });
    };

    thumbnails.forEach((thumbnail, index) => {
      thumbnail.addEventListener(
        'click',
        () => go(index),
        { signal }
      );
    });

    previous?.addEventListener(
      'click',
      () => go(active - 1),
      { signal }
    );

    next?.addEventListener(
      'click',
      () => go(active + 1),
      { signal }
    );

    node.addEventListener(
      'keydown',
      event => {
        if (
          event.target !== track &&
          !event.target.closest('[data-product-thumbnail]')
        ) {
          return;
        }

        const rtl =
          getComputedStyle(track).direction === 'rtl';

        let index;

        if (event.key === 'ArrowRight') {
          index = active + (rtl ? -1 : 1);
        }

        if (event.key === 'ArrowLeft') {
          index = active + (rtl ? 1 : -1);
        }

        if (event.key === 'ArrowDown') {
          index = active + 1;
        }

        if (event.key === 'ArrowUp') {
          index = active - 1;
        }

        if (event.key === 'Home') {
          index = 0;
        }

        if (event.key === 'End') {
          index = slides.length - 1;
        }

        if (index === undefined) return;

        event.preventDefault();

        go(index);

        if (
          event.target.closest('[data-product-thumbnail]')
        ) {
          thumbnails[active]?.focus({
            preventScroll: true
          });
        }
      },
      { signal }
    );

    track.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(scrollFrame);

        scrollFrame = requestAnimationFrame(() => {
          const box = track.getBoundingClientRect();
          const center = (box.left + box.right) / 2;

          let closest = 0;
          let distance = Infinity;

          slides.forEach((slide, index) => {
            const rect = slide.getBoundingClientRect();

            const gap = Math.abs(
              (rect.left + rect.right) / 2 - center
            );

            if (gap < distance) {
              closest = index;
              distance = gap;
            }
          });

          mark(closest);
        });
      },
      {
        passive: true,
        signal
      }
    );

    const resize = new ResizeObserver(() =>
      go(active, false)
    );

    resize.observe(track);

    signal.addEventListener(
      'abort',
      () => {
        resize.disconnect();
        cancelAnimationFrame(scrollFrame);
      },
      { once: true }
    );

    go(
      Number(node.dataset.initialIndex) || 0,
      false
    );

    const dialog = node.querySelector(
      '[data-product-zoom-dialog]'
    );

    if (!dialog) {
      return {
        selectMedia: id => {
          const index = slides.findIndex(
            slide =>
              slide.dataset.productMedia === String(id)
          );

          if (index >= 0) go(index);
        }
      };
    }

    const images = slides.filter(
      slide => slide.dataset.mediaType === 'image'
    );

    const canvas = dialog.querySelector(
      '[data-product-zoom-canvas]'
    );

    const toggle = dialog.querySelector(
      '[data-product-zoom-toggle]'
    );

    const zoomPrevious = dialog.querySelector(
      '[data-product-zoom-previous]'
    );

    const zoomNext = dialog.querySelector(
      '[data-product-zoom-next]'
    );

    let zoomIndex = 0;
    let zoomOpener;

    const renderZoom = () => {
      if (!images.length) return;

      const link =
        images[zoomIndex].querySelector(
          '[data-product-zoom]'
        );

      if (!link) return;

      let image = canvas.querySelector('img');

      if (!image) {
        image = document.createElement('img');
        image.width = 2400;
        image.height = 2400;
        canvas.append(image);
      }

      image.src = link.dataset.zoomSrc;
      image.alt = link.dataset.zoomAlt;

      const counter = dialog.querySelector(
        '[data-product-zoom-counter]'
      );

      if (counter) {
        counter.textContent =
          images[zoomIndex].getAttribute('aria-label');
      }

      zoomPrevious.disabled = zoomIndex === 0;
      zoomNext.disabled =
        zoomIndex === images.length - 1;

      canvas.classList.remove('is-zoomed');
      canvas.scrollTo({
        top: 0,
        left: 0
      });

      toggle.setAttribute(
        'aria-pressed',
        'false'
      );

      toggle.textContent =
        toggle.dataset.zoomIn;

      go(
        Number(images[zoomIndex].dataset.mediaIndex),
        false
      );
    };

    node.addEventListener(
      'click',
      event => {
        const link =
          event.target.closest('[data-product-zoom]');

        if (
          !link ||
          typeof dialog.showModal !== 'function'
        ) {
          return;
        }

        event.preventDefault();

        zoomOpener = link;

        zoomIndex = images.indexOf(
          link.closest('[data-product-media]')
        );

        renderZoom();

        dialog.showModal();
      },
      { signal }
    );

    dialog
      .querySelector('[data-product-zoom-close]')
      ?.addEventListener(
        'click',
        () => dialog.close(),
        { signal }
      );

    dialog.addEventListener(
      'close',
      () => {
        const target =
          zoomOpener?.closest('[data-product-media]')
            ?.inert
            ? track
            : zoomOpener;

        target?.focus({
          preventScroll: true
        });
      },
      { signal }
    );

    dialog.addEventListener(
      'click',
      event => {
        if (event.target === dialog) {
          dialog.close();
        }
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
      event => {
        const rtl =
          getComputedStyle(track).direction === 'rtl';

        if (
          event.key ===
          (rtl ? 'ArrowLeft' : 'ArrowRight')
        ) {
          event.preventDefault();
          zoomNext?.click();
        }

        if (
          event.key ===
          (rtl ? 'ArrowRight' : 'ArrowLeft')
        ) {
          event.preventDefault();
          zoomPrevious?.click();
        }
      },
      { signal }
    );

    toggle?.addEventListener(
      'click',
      () => {
        const zoomed =
          canvas.classList.toggle('is-zoomed');

        toggle.setAttribute(
          'aria-pressed',
          String(zoomed)
        );

        toggle.textContent =
          zoomed
            ? toggle.dataset.zoomOut
            : toggle.dataset.zoomIn;
      },
      { signal }
    );

    return {
      selectMedia: id => {
        const index = slides.findIndex(
          slide =>
            slide.dataset.productMedia === String(id)
        );

        if (index >= 0) go(index);
      }
    };
  }

  function descriptions(root, signal) {
    root
      .querySelectorAll(
        '[data-product-description][data-truncate]'
      )
      .forEach(node => {
        const text = node.querySelector(
          '[data-description-text]'
        );

        const button = node.querySelector(
          '[data-description-more]'
        );

        if (!text || !button) return;

        const details = node.closest('details');

        if (!details) return;

        const measure = () => {
          if (
            button.getAttribute('aria-expanded') ===
              'true' ||
            !details.open
          ) {
            return;
          }

          node.classList.add('is-collapsed');

          const overflows =
            text.scrollHeight >
            text.clientHeight + 2;

          button.hidden = !overflows;

          if (!overflows) {
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

            button.textContent =
              expanded
                ? button.dataset.less
                : button.dataset.more;

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

        text
          .querySelectorAll('img')
          .forEach(image =>
            image.addEventListener(
              'load',
              measure,
              { signal }
            )
          );

        measure();
      });
  }

  function options(root, media, signal) {
    let requestController;
    let revision = 0;

    const error =
      root.querySelector('[data-product-error]');

    const reveal = () => {
      root
        .querySelectorAll('[data-product-options]')
        .forEach(node => {
          node.hidden = false;
        });
    };

    const busy = value => {
      const form =
        root.querySelector('.product-form');

      if (!form) return;

      if (value) {
        form.setAttribute(
          'data-variant-pending',
          'true'
        );
      } else {
        form.removeAttribute(
          'data-variant-pending'
        );
      }

      const actions =
        root.querySelector(
          '[data-product-actions]'
        );

      const add =
        root.querySelector(
          '[data-product-add]'
        );

      const variantContent =
        root.querySelector(
          '[data-product-variant-content]'
        );

      if (actions) {
        actions.inert = value;
      }

      if (add) {
        add.disabled =
          value ||
          !variantContent?.dataset.variantId ||
          add.dataset.unavailable === 'true';
      }

      const buy =
        root.querySelector(
          '[data-product-buy]'
        );

      if (buy) {
        buy.disabled =
          add?.disabled ?? value;
      }

      root
        .querySelector('[data-product-options]')
        ?.setAttribute(
          'aria-busy',
          String(value)
        );
    };

    root.addEventListener(
      'submit',
      event => {
        if (
          event.target.matches('.product-form') &&
          event.target.hasAttribute(
            'data-variant-pending'
          )
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      {
        capture: true,
        signal
      }
    );

    root.addEventListener(
      'invalid',
      event => {
        const field =
          event.target.closest(
            '[data-personalization-field]'
          );

        if (!field) return;

        const errorMessage =
          root.querySelector(
            '[data-product-error]'
          );

        if (errorMessage) {
          errorMessage.textContent =
            root.dataset.personalizationError ||
            'Please complete the required personalization fields.';

          errorMessage.hidden = false;
        }
      },
      {
        capture: true,
        signal
      }
    );

    root.addEventListener(
      'change',
      async event => {
        if (
          !event.target.matches(
            '[data-product-option]'
          )
        ) {
          return;
        }

        const selected = [
          ...root.querySelectorAll(
            '[data-product-option]'
          )
        ].map(select => select.value);

        const sibling =
          event.target.selectedOptions[0]
            ?.dataset.productUrl;

        const target = new URL(
          sibling || root.dataset.productUrl,
          location.origin
        );

        target.searchParams.set(
          'option_values',
          selected.join(',')
        );

        if (
          target.pathname !==
          new URL(
            root.dataset.productUrl,
            location.origin
          ).pathname
        ) {
          location.assign(target.href);
          return;
        }

        requestController?.abort();

        requestController =
          new AbortController();

        const request =
          requestController;

        const version = ++revision;

        const focusId =
          event.target.id;

        busy(true);

        if (error) {
          error.hidden = true;
        }

        const timer = setTimeout(
          () => request.abort(),
          15000
        );

        try {
          target.searchParams.set(
            'section_id',
            root.dataset.sectionId
          );

          const response =
            await fetch(target.href, {
              signal: request.signal,
              credentials: 'same-origin'
            });

          if (!response.ok) {
            throw new Error(
              'Option request failed'
            );
          }

          const html =
            new DOMParser().parseFromString(
              await response.text(),
              'text/html'
            );

          const replacement =
            html.querySelector(
              '[data-product-variant-content]'
            );

          if (!replacement) {
            throw new Error(
              'Option content missing'
            );
          }

          if (
            version !== revision ||
            signal.aborted
          ) {
            return;
          }

          const values = new Map(
            [
              ...root.querySelectorAll(
                '.product-form input, .product-form textarea'
              )
            ]
              .filter(
                input =>
                  input.name !== 'id' &&
                  input.type !== 'hidden'
              )
              .map(input => [
                input.name,
                input.value
              ])
          );

          const quantity =
            root.querySelector(
              'input[type="number"][name="quantity"]'
            );

          const quantityValue =
            quantity?.value;

          root
            .querySelector(
              '[data-product-variant-content]'
            )
            .replaceWith(replacement);

          root.dataset.productPrice =
            replacement.dataset
              .variantPriceLabel ||
            root.dataset.productPrice;

          reveal();

          values.forEach(
            (value, name) => {
              const input = [
                ...root.querySelectorAll(
                  '.product-form input, .product-form textarea'
                )
              ].find(
                input =>
                  input.name === name
              );

              if (input) {
                input.value = value;
              }
            }
          );

          const newQuantity =
            root.querySelector(
              'input[type="number"][name="quantity"]'
            );

          if (newQuantity) {
            const minimum =
              Number(newQuantity.min) || 1;

            const step =
              Number(newQuantity.step) || 1;

            const maximum =
              newQuantity.max
                ? Number(newQuantity.max)
                : Infinity;

            const requested =
              Number(quantityValue) ||
              minimum;

            const steps = Math.max(
              0,
              Math.floor(
                (requested - minimum) /
                  step
              )
            );

            newQuantity.value =
              Math.min(
                maximum,
                minimum +
                  steps * step
              );
          }

          const url =
            new URL(location.href);

          if (replacement.dataset.variantId) {
            url.searchParams.set(
              'variant',
              replacement.dataset.variantId
            );

            url.searchParams.delete(
              'option_values'
            );
          } else {
            url.searchParams.delete(
              'variant'
            );

            url.searchParams.set(
              'option_values',
              selected.join(',')
            );
          }

          history.replaceState(
            history.state,
            '',
            url.href
          );

          media.selectMedia(
            replacement.dataset
              .featuredMediaId
          );

          document.dispatchEvent(
            new CustomEvent(
              'theme:product-variant',
              {
                detail: {
                  productId:
                    root.dataset.productId,

                  variantId:
                    replacement.dataset
                      .variantId,

                  title:
                    replacement.dataset
                      .variantTitle,

                  price:
                    replacement.dataset
                      .variantPrice,

                  minimum:
                    replacement.dataset
                      .variantMinimum,

                  available:
                    replacement.dataset
                      .variantAvailable ===
                    'true'
                }
              }
            )
          );

          window.Shopify
            ?.PaymentButton
            ?.init?.();

          root
            .querySelector(
              '#' +
                CSS.escape(focusId)
            )
            ?.focus({
              preventScroll: true
            });

        } catch (_error) {
          root
            .querySelectorAll(
              '[data-product-option]'
            )
            .forEach(select => {
              select.value =
                select.querySelector(
                  '[data-selected]'
                )?.value || '';
            });

          if (error) {
            error.textContent =
              root.dataset.optionError;

            error.hidden = false;
          }
        } finally {
          clearTimeout(timer);

          if (
            version === revision &&
            !signal.aborted
          ) {
            busy(false);
          }
        }
      },
      { signal }
    );

    signal.addEventListener(
      'abort',
      () =>
        requestController?.abort(),
      { once: true }
    );

    reveal();
  }

  function personalization(root, signal) {
    const form =
      root.querySelector('.product-form');

    if (!form) return;

    const validate = () => {
      const fields = [
        ...form.querySelectorAll(
          '[data-personalization-field]'
        )
      ];

      let valid = true;
      let firstInvalid = null;

      fields.forEach(field => {
        const value =
          field.value.trim();

        field.value = value;

        if (!value) {
          valid = false;

          if (!firstInvalid) {
            firstInvalid = field;
          }
        }
      });

      if (!valid) {
        const error =
          root.querySelector(
            '[data-product-error]'
          );

        if (error) {
          error.textContent =
            root.dataset.personalizationError ||
            'Please complete the required personalization fields.';

          error.hidden = false;
        }

        firstInvalid?.focus();

        return false;
      }

      const error =
        root.querySelector(
          '[data-product-error]'
        );

      if (error) {
        error.hidden = true;
      }

      return true;
    };

    form.addEventListener(
      'submit',
      event => {
        if (!validate()) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      {
        capture: true,
        signal
      }
    );

    form.addEventListener(
      'input',
      event => {
        if (
          event.target.matches(
            '[data-personalization-field]'
          )
        ) {
          const error =
            root.querySelector(
              '[data-product-error]'
            );

          if (error) {
            error.hidden = true;
          }
        }
      },
      { signal }
    );
  }

  function quantity(root, signal) {
    root.addEventListener(
      'click',
      event => {
        const decrease =
          event.target.closest(
            '[data-quantity-decrease]'
          );

        const increase =
          event.target.closest(
            '[data-quantity-increase]'
          );

        if (!decrease && !increase) {
          return;
        }

        const wrapper =
          event.target.closest(
            '.quantity-selector'
          );

        const input =
          wrapper?.querySelector(
            '[data-quantity-input]'
          );

        if (!input) return;

        const min =
          Number(input.min) || 1;

        const max =
          input.max
            ? Number(input.max)
            : Infinity;

        const step =
          Number(input.step) || 1;

        let value =
          Number(input.value) || min;

        if (increase) {
          value += step;
        }

        if (decrease) {
          value -= step;
        }

        value = Math.max(
          min,
          Math.min(max, value)
        );

        input.value = value;

        input.dispatchEvent(
          new Event('change', {
            bubbles: true
          })
        );
      },
      { signal }
    );
  }

  function bind(scope = document) {
    scope
      .querySelectorAll('[data-product-page]')
      .forEach(root => {
        if (controllers.has(root)) return;

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

        options(
          root,
          media,
          signal
        );

        descriptions(
          root,
          signal
        );

        personalization(
          root,
          signal
        );

        quantity(
          root,
          signal
        );

        try {
          const referrer =
            new URL(
              document.referrer
            );

          if (
            referrer.origin ===
              location.origin &&
            /\/(search|collections)(\/|$)/
              .test(
                referrer.pathname
              )
          ) {
            const back =
              root.querySelector(
                '[data-product-back]'
              );

            const label =
              root.querySelector(
                '[data-product-back-label]'
              );

            if (back) {
              back.href =
                referrer.href;
            }

            if (label) {
              label.textContent =
                root.dataset.backLabel;
            }
          }
        } catch (_error) {}
      });
  }

  bind();

  document.addEventListener(
    'shopify:section:load',
    event => bind(event.target)
  );

  document.addEventListener(
    'shopify:section:unload',
    event => {
      event.target
        .querySelectorAll(
          '[data-product-page]'
        )
        .forEach(root =>
          controllers
            .get(root)
            ?.abort()
        );
    }
  );
})();