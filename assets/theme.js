(() => {
  const facetOpeners = new WeakMap();

  document.addEventListener('click', (event) => {
    const facetsOpen = event.target.closest('[data-facets-open]');
    if (facetsOpen) {
      const dialog = document.getElementById(facetsOpen.getAttribute('aria-controls'));
      if (dialog && !dialog.open) {
        facetOpeners.set(dialog, facetsOpen);
        dialog.showModal();
      }
      return;
    }

    const facetsClose = event.target.closest('[data-facets-close]');
    if (facetsClose) {
      facetsClose.closest('[data-facets-dialog]')?.close();
      return;
    }

    const footerSummary = event.target.closest('[data-footer-menu] > summary');
    if (footerSummary && footerDesktop.matches) {
      event.preventDefault();
      return;
    }

    const drawerLink = event.target.closest('[data-menu-drawer] a');
    if (drawerLink) drawerLink.closest('[data-menu-drawer]').open = false;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const openDrawer = document.querySelector('[data-menu-drawer][open]');
    if (!openDrawer) return;

    openDrawer.open = false;
    openDrawer.querySelector('summary')?.focus();
  });

  const footerDesktop = window.matchMedia('(min-width: 750px)');

  function syncFooterMenus() {
    document.querySelectorAll('[data-footer-menu]').forEach((menu) => {
      if (footerDesktop.matches) {
        if (!menu.open) menu.dataset.desktopOpened = 'true';
        menu.open = true;
      } else if (menu.dataset.desktopOpened === 'true') {
        menu.open = false;
        delete menu.dataset.desktopOpened;
      }
    });
  }

  function bindFacetDialogs(scope = document) {
    scope.querySelectorAll('[data-facets-dialog]').forEach((dialog) => {
      if (dialog.dataset.bound === 'true') return;
      dialog.dataset.bound = 'true';

      dialog.addEventListener('close', () => {
        const opener = facetOpeners.get(dialog);
        if (opener?.isConnected) opener.focus();
      });

      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const panel = dialog.querySelector('.facets-drawer__panel');
        const bounds = panel?.getBoundingClientRect();
        const outsidePanel = !bounds || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (outsidePanel) dialog.close();
      });
    });
  }

  footerDesktop.addEventListener('change', syncFooterMenus);
  document.addEventListener('shopify:section:load', (event) => {
    syncFooterMenus();
    bindFacetDialogs(event.target);
  });

  syncFooterMenus();
  bindFacetDialogs();
})();
