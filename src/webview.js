/* global webviewApi */
// Runs inside the panel. The plugin replaces the panel HTML on every refresh, so the open branches
// and the filter text are kept here and put back after each replacement.

(function () {
  const open = new Set();
  let filterText = '';

  function applyFilter(root) {
    const query = filterText.trim().toLocaleLowerCase();
    const nodes = root.querySelectorAll('li.tt-node');
    if (!query) {
      for (const li of nodes) li.hidden = false;
      return;
    }
    for (const li of nodes) li.hidden = true;
    for (const li of nodes) {
      const path = (li.getAttribute('data-path') || '').toLocaleLowerCase();
      if (!path.includes(query)) continue;
      li.hidden = false;
      for (const below of li.querySelectorAll('li.tt-node')) below.hidden = false;
      let up = li.parentElement;
      while (up && up !== root) {
        if (up.matches('li.tt-node')) up.hidden = false;
        if (up.matches('details')) up.open = true;
        up = up.parentElement;
      }
    }
  }

  function restore() {
    for (const details of document.querySelectorAll('details[data-path]')) {
      if (open.has(details.getAttribute('data-path'))) details.open = true;
    }
    const input = document.querySelector('.tt-filter');
    if (input && input.value !== filterText) input.value = filterText;
    const tree = document.querySelector('.tt-tree');
    if (tree) applyFilter(tree);
  }

  document.addEventListener('toggle', (event) => {
    const details = event.target;
    if (!details || !details.matches || !details.matches('details[data-path]')) return;
    if (filterText) return;
    const path = details.getAttribute('data-path');
    if (details.open) open.add(path);
    else open.delete(path);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target && event.target.closest ? event.target : null;
    if (!target) return;
    const tag = target.closest('[data-tag-id]');
    if (tag) {
      event.preventDefault();
      event.stopPropagation();
      webviewApi.postMessage({ name: 'open', id: tag.getAttribute('data-tag-id') });
      return;
    }
    if (target.closest('.tt-refresh')) {
      event.preventDefault();
      webviewApi.postMessage({ name: 'refresh' });
    }
  });

  document.addEventListener('input', (event) => {
    if (!event.target || !event.target.matches || !event.target.matches('.tt-filter')) return;
    filterText = event.target.value;
    const tree = document.querySelector('.tt-tree');
    if (tree) applyFilter(tree);
  });

  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(() => {
      scheduled = false;
      restore();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  restore();
})();
