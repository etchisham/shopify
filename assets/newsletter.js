(() => {
  // Native posting keeps Shopify's customer form and CAPTCHA hooks intact.
  // Only the response frame navigates; the storefront stays on the current page.
  function bind(scope = document) {
    scope.querySelectorAll('[data-newsletter-form]').forEach(form => {
      if (form.dataset.newsletterBound) return;
      form.dataset.newsletterBound = 'true';
      const button = form.querySelector('[data-newsletter-button]');
      const loading = form.querySelector('[data-newsletter-loading]');
      const email = form.querySelector('[name="contact[email]"]');
      const error = form.querySelector('[data-newsletter-error]');
      const verification = form.querySelector('[data-newsletter-verification]');
      const cancel = form.querySelector('[data-newsletter-cancel]');
      const frame = document.createElement('iframe');
      frame.name = `${form.id}-response`;
      frame.title = verification.textContent;
      frame.className = 'site-footer__newsletter-frame';
      frame.hidden = true;
      frame.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin');
      form.append(frame);
      form.target = frame.name;
      let pending = false, timer;
      const finish = () => {
        pending = false;
        clearTimeout(timer);
        button.disabled = false;
        email.readOnly = false;
        loading.hidden = true;
        form.removeAttribute('aria-busy');
        verification.hidden = true;
        cancel.hidden = true;
        frame.hidden = true;
      };
      const fail = message => {
        finish();
        error.textContent = message || form.querySelector('[data-newsletter-error-message]').textContent;
        error.hidden = false;
        frame.src = 'about:blank';
      };
      const showVerification = () => {
        clearTimeout(timer);
        verification.hidden = false;
        cancel.hidden = false;
        frame.hidden = false;
      };
      cancel.addEventListener('click', () => { finish(); frame.src = 'about:blank'; });
      form.addEventListener('submit', event => {
        if (pending) { event.preventDefault(); return; }
        if (!form.checkValidity()) { event.preventDefault(); form.reportValidity(); return; }
        pending = true;
        error.hidden = true;
        verification.hidden = true;
        cancel.hidden = true;
        frame.hidden = true;
        button.disabled = true;
        email.readOnly = true;
        loading.hidden = false;
        form.setAttribute('aria-busy', 'true');
        timer = setTimeout(() => fail(), 30000);
      });
      frame.addEventListener('load', () => {
        if (!pending) return;
        try {
          const response = frame.contentDocument;
          if (!response || response.URL === 'about:blank') return;
          const result = response.getElementById(form.id);
          if (result?.querySelector('[data-newsletter-result="success"]')) {
            finish();
            email.value = '';
            document.dispatchEvent(new CustomEvent('theme:toast', { detail: { message: form.querySelector('[data-newsletter-success-message]').textContent } }));
            frame.src = 'about:blank';
          } else if (result?.querySelector('[data-newsletter-result="error"]')) {
            fail(result.querySelector('[data-newsletter-result="error"]').textContent);
          } else if (new URL(response.URL).pathname.includes('/challenge')) {
            showVerification();
          } else {
            fail();
          }
        } catch (_error) { showVerification(); }
      });
      frame.addEventListener('error', () => { if (pending) fail(); });
    });
  }
  bind();
  document.addEventListener('shopify:section:load', event => bind(event.target));
})();
