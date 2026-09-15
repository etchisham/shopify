(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups = new WeakMap();
  function bindSlideshow(section) {
    if (section.dataset.ready === 'true') return;
    const slides = [...section.querySelectorAll('[data-home-slide]')];
    const dots = [...section.querySelectorAll('[data-slide-dot]')];
    const controls = section.querySelector('[data-slide-controls]');
    const pause = section.querySelector('[data-slide-pause]');
    if (slides.length < 2 || !controls || !pause) return;
    let current = 0, timer;
    let paused = motion.matches || section.dataset.autoplay !== 'true';
    let hovered = false, focused = false;
    const interval = Math.max(5000, Number(section.dataset.interval) || 7000);
    function schedule() {
      window.clearTimeout(timer);
      pause.textContent = paused ? pause.dataset.playLabel : pause.dataset.pauseLabel;
      pause.setAttribute('aria-label', pause.textContent);
      if (!paused && !hovered && !focused && !document.hidden) {
        timer = window.setTimeout(() => { show(current + 1); schedule(); }, interval);
      }
    }
    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => { slide.hidden = i !== current; });
      dots.forEach((dot, i) => {
        if (i === current) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }
    function select(index) { paused = true; show(index); schedule(); }
    section.querySelector('[data-slide-previous]').addEventListener('click', () => select(current - 1));
    section.querySelector('[data-slide-next]').addEventListener('click', () => select(current + 1));
    dots.forEach((dot, i) => dot.addEventListener('click', () => select(i)));
    pause.addEventListener('click', () => { paused = !paused; schedule(); });
    section.addEventListener('pointerenter', () => { hovered = true; schedule(); });
    section.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    section.addEventListener('focusin', () => { focused = true; schedule(); });
    section.addEventListener('focusout', event => { focused = section.contains(event.relatedTarget); schedule(); });
    section.addEventListener('home:select-slide', event => {
      const index = slides.findIndex(slide => slide.dataset.blockId === event.detail);
      if (index >= 0) select(index);
    });
    const onMotion = () => { if (motion.matches) paused = true; schedule(); };
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener('change', onMotion);
    cleanups.set(section, () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', schedule);
      motion.removeEventListener('change', onMotion);
    });
    section.dataset.ready = 'true';
    controls.hidden = false;
    show(0);
    schedule();
  }
  function bindTabs(section) {
    if (section.dataset.ready === 'true') return;
    const tabs = [...section.querySelectorAll('[data-collection-tab]')];
    const panels = [...section.querySelectorAll('[data-collection-panel]')];
    if (!tabs.length || tabs.length !== panels.length) return;
    const rtl = getComputedStyle(section).direction === 'rtl';
    section.querySelector('[data-tab-list]').setAttribute('role', 'tablist');
    function activate(index, focus = false) {
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        panels[i].hidden = i !== index;
      });
      if (focus) tabs[index].focus();
    }
    tabs.forEach((tab, i) => {
      tab.setAttribute('role', 'tab');
      panels[i].setAttribute('role', 'tabpanel');
      panels[i].setAttribute('aria-labelledby', tab.id);
      tab.addEventListener('click', () => activate(i));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = i + (rtl ? -1 : 1);
        else if (event.key === 'ArrowLeft') next = i + (rtl ? 1 : -1);
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        activate((next + tabs.length) % tabs.length, true);
      });
    });
    panels.forEach(panel => {
      const rail = panel.querySelector('[data-product-rail]');
      const controls = panel.querySelector('[data-rail-controls]');
      if (!rail || !controls) return;
      const scroll = direction => rail.scrollBy({ left: direction * (rtl ? -1 : 1) * rail.clientWidth * .9, behavior: motion.matches ? 'auto' : 'smooth' });
      panel.querySelector('[data-rail-previous]').addEventListener('click', () => scroll(-1));
      panel.querySelector('[data-rail-next]').addEventListener('click', () => scroll(1));
      controls.hidden = rail.children.length < 2;
    });
    section.addEventListener('home:select-tab', event => {
      const index = tabs.findIndex(tab => tab.dataset.blockId === event.detail);
      if (index >= 0) activate(index);
    });
    section.dataset.ready = 'true';
    activate(0);
  }
  function bind(root) {
    root.querySelectorAll('[data-home-slideshow]').forEach(bindSlideshow);
    root.querySelectorAll('[data-collection-tabs]').forEach(bindTabs);
  }
  bind(document);
  document.addEventListener('shopify:section:load', event => bind(event.target));
  document.addEventListener('shopify:section:unload', event => {
    event.target.querySelectorAll('[data-home-slideshow]').forEach(section => cleanups.get(section)?.());
  });
  document.addEventListener('shopify:block:select', event => {
    const slide = event.target.closest('[data-home-slide]');
    const panel = event.target.closest('[data-collection-panel]');
    if (slide) slide.closest('[data-home-slideshow]').dispatchEvent(new CustomEvent('home:select-slide', { detail: slide.dataset.blockId }));
    if (panel) panel.closest('[data-collection-tabs]').dispatchEvent(new CustomEvent('home:select-tab', { detail: panel.dataset.blockId }));
  });
})();
