(() => {
  function bind(scope = document) {
    scope.querySelectorAll('[data-help-page]').forEach(section => {
      if (section.dataset.helpBound) return;
      section.dataset.helpBound = 'true';
      const content = section.querySelector('[data-help-content]');
      // Each H3 in a page's translated content starts an answer, ending at H2/H3.
      [...content.children].filter(node => node.tagName === 'H3').forEach(heading => {
        const details = document.createElement('details');
        details.className = 'help-page__question';
        if (heading.id) details.id = heading.id;
        const summary = document.createElement('summary');
        summary.append(...heading.childNodes);
        const answer = document.createElement('div');
        answer.className = 'help-page__answer';
        let next = heading.nextSibling;
        while (next && !['H2', 'H3'].includes(next.nodeName)) {
          const following = next.nextSibling;
          answer.append(next);
          next = following;
        }
        details.append(summary, answer);
        heading.replaceWith(details);
      });
      const topics = section.querySelector('[data-help-topics]');
      if (!topics) return;
      const headings = [...content.children].filter(node => node.tagName === 'H2');
      headings.forEach((heading, index) => {
        heading.id ||= `HelpTopic-${section.dataset.sectionId}-${index}`;
        const link = document.createElement('a');
        link.href = '#' + heading.id;
        link.textContent = heading.textContent;
        topics.append(link);
      });
      topics.hidden = headings.length < 2;
    });
  }
  bind();
  document.addEventListener('shopify:section:load', event => bind(event.target));
})();
