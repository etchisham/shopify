(() => {
  const root = document.documentElement;
  const modes = ['system', 'light', 'dark'];

  function applyTheme(mode) {
    root.dataset.themePreference = mode;

    if (mode === 'light' || mode === 'dark') {
      root.dataset.theme = mode;
    } else {
      delete root.dataset.theme;
    }

    try {
      localStorage.setItem('theme-preference', mode);
    } catch (error) {
      // Storage can be unavailable in strict privacy modes. Theme still works for this page.
    }

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const key = `label${mode[0].toUpperCase()}${mode.slice(1)}`;
      const label = button.dataset[key];
      button.dataset.mode = mode;
      button.setAttribute('aria-label', label);
      const current = button.querySelector('[data-theme-label]');
      if (current) current.textContent = label;
    });
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-toggle]');
    if (button) {
      const currentMode = root.dataset.themePreference || 'system';
      const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
      applyTheme(nextMode);
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

  footerDesktop.addEventListener('change', syncFooterMenus);
  document.addEventListener('shopify:section:load', syncFooterMenus);

  applyTheme(root.dataset.themePreference || 'system');
  syncFooterMenus();
})();
