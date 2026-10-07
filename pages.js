/* ------------------------------------------------------------------
   pages.js — one section at a time.

   Every <section class="page"> is its own page, chosen by the URL
   hash: #home, #currently, #projects, #dance, #contact. The browser's
   back and forward buttons work, each page has a shareable address,
   and the water keeps rolling underneath because nothing reloads.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));
  if (!pages.length) return;
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('header.top a[href^="#"]'));
  var siteTitle = document.title;
  var current = null;

  function pageFor(hash) {
    var id = (hash || '').replace(/^#/, '') || 'home';
    for (var i = 0; i < pages.length; i++) if (pages[i].id === id) return pages[i];
    return pages[0];
  }

  function show(page, firstTime) {
    if (page === current) return;
    pages.forEach(function (p) {
      var on = p === page;
      p.classList.toggle('active', on);
      p.hidden = !on;
    });
    navLinks.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + page.id;
      a.classList.toggle('current', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });

    var heading = page.querySelector('h2');
    document.title = heading ? heading.textContent.trim() + ' — ' + siteTitle : siteTitle;

    if (!firstTime) window.scrollTo(0, 0);
    current = page;
  }

  function route(firstTime) { show(pageFor(window.location.hash), firstTime); }

  window.addEventListener('hashchange', function () { route(false); });
  route(true);
})();
