/* =========================================================
   HOME PAGE MOTION
   (loaded on the home page only, from theme.liquid)
   1) sections rise and fade in while scrolling
   2) rows can be dragged with the mouse (wide screens)
   ========================================================= */

/* ---------- 1) sections reveal ---------- */
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.Shopify && window.Shopify.designMode) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var sections = Array.prototype.filter.call(
    document.querySelectorAll('.shopify-section'),
    function (section) {
      return section.className.indexOf('shopify-section-group') === -1 &&
        !section.querySelector('.featured-collection, .custom-order, .hilya-social, .collection-list');
    }
  );

  /* the first section is the big hero image: it stays as it is */
  sections = sections.slice(1);

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0, rootMargin: '0px 0px -20% 0px' });

  sections.forEach(function (section) {
    section.classList.add('hilya-section-reveal');
    observer.observe(section);
  });

  /* after a refresh in the middle of the page: sections already passed show instantly */
  window.addEventListener('load', function () {
    setTimeout(function () {
      sections.forEach(function (section) {
        if (section.classList.contains('is-revealed')) return;
        if (section.getBoundingClientRect().bottom < 0) {
          section.classList.add('hilya-instant', 'is-revealed');
          observer.unobserve(section);
        }
      });
    }, 150);
  });
})();


/* ---------- 2) drag the rows with the mouse ---------- */
(function () {
  var wide = window.matchMedia('(min-width: 750px)');

  function enable(grid) {
    var drag = null;
    var suppressClick = false;

    grid.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !wide.matches) return;
      drag = { x: event.clientX, left: grid.scrollLeft, moved: false };
    });

    window.addEventListener('pointermove', function (event) {
      if (!drag) return;

      var dx = event.clientX - drag.x;

      if (!drag.moved && Math.abs(dx) < 5) return;

      if (!drag.moved) {
        drag.moved = true;
        grid.style.scrollSnapType = 'none';
        grid.style.scrollBehavior = 'auto';
        grid.classList.add('is-dragging');
      }

      grid.scrollLeft = drag.left - dx;
    });

    function end() {
      if (!drag) return;

      if (drag.moved) {
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 60);
        grid.style.scrollSnapType = '';
        grid.style.scrollBehavior = '';
        grid.classList.remove('is-dragging');
      }

      drag = null;
    }

    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    grid.addEventListener('click', function (event) {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    grid.addEventListener('dragstart', function (event) {
      event.preventDefault();
    });
  }

  document
    .querySelectorAll('.featured-collection__grid, .collection-list__grid')
    .forEach(enable);
})();
