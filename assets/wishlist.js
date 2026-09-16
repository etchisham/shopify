(() => {
  const key = 'theme:saved-products';

  function safeUrl(value, image = false) {
    try {
      const url = new URL(value, location.origin);
      if (!image && url.origin !== location.origin) return '';
      if (image && url.protocol !== 'https:' && url.origin !== location.origin) return '';
      return url.href;
    } catch (_error) { return ''; }
  }

  function bind(root) {
    if (root.dataset.bound === 'true') return;
    root.dataset.bound = 'true';
    const grid = root.querySelector('[data-wishlist-grid]');
    const empty = root.querySelector('[data-wishlist-empty]');
    const error = root.querySelector('[data-wishlist-error]');
    const status = root.querySelector('[data-wishlist-status]');

    const read = () => {
      const records = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(records) ? records.filter(item => item && item.id && item.title) : [];
    };

    const render = () => {
      let records;
      try { records = read(); error.hidden = true; }
      catch (_error) { records = []; error.textContent = root.dataset.storageError; error.hidden = false; }
      grid.replaceChildren();
      empty.hidden = records.length > 0;
      grid.hidden = records.length === 0;
      records.slice().reverse().forEach(item => {
        const article = document.createElement('article');
        article.className = 'wishlist-card';
        const link = document.createElement('a');
        link.className = 'wishlist-card__media';
        link.href = safeUrl(item.url) || location.origin;
        const imageUrl = safeUrl(item.image, true);
        if (imageUrl) {
          const image = document.createElement('img');
          image.src = imageUrl;
          image.alt = item.title;
          image.loading = 'lazy';
          link.append(image);
        } else {
          const placeholder = document.createElement('span');
          placeholder.className = 'wishlist-card__placeholder';
          placeholder.textContent = item.title.slice(0, 1);
          link.append(placeholder);
        }
        const body = document.createElement('div');
        body.className = 'wishlist-card__body';
        if (item.vendor) {
          const vendor = document.createElement('p');
          vendor.className = 'wishlist-card__vendor';
          vendor.textContent = item.vendor;
          body.append(vendor);
        }
        const heading = document.createElement('h2');
        const title = document.createElement('a');
        title.href = link.href;
        title.textContent = item.title;
        heading.append(title);
        body.append(heading);
        if (item.price) {
          const price = document.createElement('p');
          price.className = 'wishlist-card__price';
          price.textContent = item.price;
          body.append(price);
        }
        const remove = document.createElement('button');
        remove.className = 'wishlist-card__remove';
        remove.type = 'button';
        remove.textContent = root.dataset.removeLabel;
        remove.addEventListener('click', () => {
          try {
            localStorage.setItem(key, JSON.stringify(read().filter(record => record.id !== item.id)));
            status.textContent = root.dataset.removedMessage.replace('__TITLE__', item.title);
            document.dispatchEvent(new CustomEvent('theme:wishlist-change'));
            render();
          } catch (_error) { error.textContent = root.dataset.storageError; error.hidden = false; }
        });
        article.append(link, body, remove);
        grid.append(article);
      });
    };

    render();
    window.addEventListener('storage', event => { if (event.key === key) render(); });
  }

  document.querySelectorAll('[data-wishlist-page]').forEach(bind);
  document.addEventListener('shopify:section:load', event => event.target.querySelectorAll('[data-wishlist-page]').forEach(bind));
})();
