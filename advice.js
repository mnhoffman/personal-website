/* ------------------------------------------------------------------
   advice.js — the green notebook.

   Reads advice/entries.json, scatters each page across the pile at a
   random spot and angle (a fresh arrangement every visit), and opens a
   page large when it is clicked. Arrow keys move between pages, Escape
   or a click on the backdrop closes.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var pile = document.getElementById('pile');
  var box = document.getElementById('lightbox');
  if (!pile || !box) return;
  var img = document.getElementById('lb-img');
  var entries = [];
  var order = [];
  var current = -1;

  // A fixed arrangement: the same shuffle every visit, from a seeded
  // generator, so the pile looks considered rather than re-rolled.
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, rand) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Lay the pile out ourselves: a masonry of N columns, each page a bit
  // wider than its column and tucked up under the page above, tilted a
  // touch. Positions are absolute, so nothing depends on the browser's
  // multi-column fragmentation (which drops rotated pages at column
  // tops in some browsers). Sizes come from entries.json so the layout
  // is settled before a single image has loaded.
  var laidOutWidth = 0;
  function build() {
    if (!entries.length) return;
    var W = pile.clientWidth;
    if (!W || W === laidOutWidth) return;
    laidOutWidth = W;
    var rand = rng(20231101);
    if (!order.length) order = shuffle(entries.slice(), rand); else rand = rng(20231102);
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var cols = W > 760 ? 5 : W > 520 ? 4 : 2;
    var colW = W / cols;
    var pageW = colW * 1.18;
    var tuck = 1.8 * rem;              // how far each page slides under the one above
    // columns start at staggered heights so the top edge isn't a straight line
    var heights = []; for (var k = 0; k < cols; k++) heights.push(rand() * pageW * 0.45);
    pile.innerHTML = '';
    var frag = document.createDocumentFragment();
    order.forEach(function (e, i) {
      // the shortest column, so the bottom edge stays even
      var c = 0; for (var k = 1; k < cols; k++) if (heights[k] < heights[c]) c = k;
      var h = pageW * e.h / e.w;
      var a = document.createElement('a');
      a.className = 'entry';
      a.href = 'advice/' + e.src;
      a.setAttribute('aria-label', 'Open this page');
      a.dataset.index = i;
      a.style.width = pageW + 'px';
      a.style.left = (c * colW - colW * 0.09 + (rand() - 0.5) * 1.6 * rem) + 'px';
      var first = heights[c] < pageW * 0.5;      // nothing above this page yet
      a.style.top = (heights[c] - (first ? 0 : tuck)) + 'px';
      a.style.setProperty('--tilt', ((rand() - 0.5) * 12).toFixed(1) + 'deg');
      a.style.zIndex = 1 + Math.floor(rand() * 9);
      heights[c] += h - (first ? 0 : tuck);
      var im = document.createElement('img');
      im.src = 'advice/' + e.src;
      im.alt = '';
      im.width = e.w; im.height = e.h;
      im.loading = i < 24 ? 'eager' : 'lazy';
      a.appendChild(im);
      a.addEventListener('click', function (ev) { ev.preventDefault(); open(i); });
      frag.appendChild(a);
    });
    pile.appendChild(frag);
    pile.style.height = (Math.max.apply(null, heights) + 1.5 * rem) + 'px';
  }
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (window.location.hash === '#advice') build(); }, 150);
  });

  function open(i) {
    current = (i + order.length) % order.length;
    img.src = 'advice/' + order[current].src;
    box.hidden = false;
    document.body.classList.add('lb-open');
  }
  function close() {
    box.hidden = true;
    document.body.classList.remove('lb-open');
  }

  box.querySelector('.lb-close').addEventListener('click', close);
  box.querySelector('.lb-prev').addEventListener('click', function () { open(current - 1); });
  box.querySelector('.lb-next').addEventListener('click', function () { open(current + 1); });
  box.addEventListener('click', function (ev) { if (ev.target === box) close(); });
  document.addEventListener('keydown', function (ev) {
    if (box.hidden) return;
    if (ev.key === 'Escape') close();
    else if (ev.key === 'ArrowLeft') open(current - 1);
    else if (ev.key === 'ArrowRight') open(current + 1);
  });

  // Build the pile the first time the page is shown (its width isn't
  // known while hidden), and whenever the hash lands on it.
  function maybeBuild() {
    if (window.location.hash === '#advice') requestAnimationFrame(build);
  }
  window.addEventListener('hashchange', maybeBuild);

  fetch('advice/entries.json')
    .then(function (r) { return r.json(); })
    .then(function (data) { entries = data.entries || []; maybeBuild(); })
    .catch(function (e) { console.error('advice.js: could not read entries.json', e); });
})();
