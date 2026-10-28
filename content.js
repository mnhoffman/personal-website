/* ------------------------------------------------------------------
   content.js — the site's words come from content.json.

   Elements marked data-content="section.field" are filled from the
   file: Markdown fields are rendered with marked, data-inline fields
   are rendered without paragraph wrappers, and "contact.links" becomes
   the list of handwritten links. The text baked into index.html is the
   fallback shown until the file loads (or if it can't). Edit the words
   at /edit/.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  if (typeof marked === 'undefined') return;

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function escape(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function externalise(root) {
    root.querySelectorAll('a[href^="http"]').forEach(function (a) {
      a.target = '_blank'; a.rel = 'noopener';
    });
  }

  fetch('content.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (content) {
      document.querySelectorAll('[data-content]').forEach(function (el) {
        var value = get(content, el.dataset.content);
        if (value == null) return;
        if (el.dataset.content === 'contact.links' && Array.isArray(value)) {
          el.innerHTML = value.map(function (l) {
            return '<li><a class="hand" href="' + escape(l.url) + '">' + escape(l.label) + '</a></li>';
          }).join('');
        } else if (el.hasAttribute('data-text')) {
          el.textContent = value;
        } else if (el.hasAttribute('data-inline')) {
          el.innerHTML = marked.parseInline(value);
        } else {
          // keep anything after the text (e.g. pinned charts) when re-rendering a note
          var keep = Array.prototype.slice.call(el.querySelectorAll(':scope > figure'));
          el.innerHTML = marked.parse(value);
          keep.forEach(function (k) { el.appendChild(k); });
        }
        externalise(el);
      });
      document.documentElement.classList.add('content-ready');
    })
    .catch(function (e) { console.error('content.js: could not load content.json', e); });
})();
