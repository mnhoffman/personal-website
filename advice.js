/* ------------------------------------------------------------------
   advice.js — the green notebook.

   advice/entries.json lists the pages in pile order. The pile is a
   masonry of N columns: each page goes to the shortest column, a bit
   wider than the column and tucked up under the page above, tilted a
   touch (each page's tilt is fixed, derived from its filename, so
   adding or removing pages doesn't disturb its neighbours). Positions
   are absolute, laid out here from the sizes in entries.json, so the
   layout is settled before any image loads. Clicking a page opens it
   large; arrow keys move between pages, Escape closes.

   window.advicePile.layout() is shared with the editor at
   /edit/advice.html so its preview matches the site exactly.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  // A small stable hash → [0, 1), so a page keeps its tilt for good.
  function unit(str, salt) {
    var h = 2166136261 ^ (salt || 0);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10007) / 10007;
  }

  // entries: [{src, w, h}], W: pile width in px, rem: px per rem.
  // Returns {items: [{left, top, width, height, tilt, z}], height}.
  function layout(entries, W, rem) {
    var cols = W > 760 ? 5 : W > 520 ? 4 : 2;
    var colW = W / cols;
    var pageW = colW * 1.18;
    var tuck = 1.8 * rem;
    var heights = [];
    for (var k = 0; k < cols; k++) heights.push(unit('col' + k, 7) * pageW * 0.45);
    var items = entries.map(function (e) {
      var c = 0;
      for (var k = 1; k < cols; k++) if (heights[k] < heights[c]) c = k;
      var first = heights[c] < pageW * 0.5;
      var h = pageW * e.h / e.w;
      var item = {
        left: c * colW - colW * 0.09 + (unit(e.src, 1) - 0.5) * 1.6 * rem,
        top: heights[c] - (first ? 0 : tuck),
        width: pageW, height: h,
        tilt: (unit(e.src, 2) - 0.5) * 12,
        z: 1 + Math.floor(unit(e.src, 3) * 9)
      };
      heights[c] += h - (first ? 0 : tuck);
      return item;
    });
    return { items: items, height: Math.max.apply(null, heights) + 1.5 * rem };
  }
  window.advicePile = { layout: layout };

  var pile = document.getElementById('pile');
  var box = document.getElementById('lightbox');
  if (!pile || !box) return;
  var img = document.getElementById('lb-img');
  var entries = [];
  var current = -1;
  var laidOutWidth = 0;

  function build() {
    if (!entries.length) return;
    var W = pile.clientWidth;
    if (!W || W === laidOutWidth) return;
    laidOutWidth = W;
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var L = layout(entries, W, rem);
    pile.innerHTML = '';
    var frag = document.createDocumentFragment();
    entries.forEach(function (e, i) {
      var it = L.items[i];
      var a = document.createElement('a');
      a.className = 'entry';
      a.href = 'advice/' + e.src;
      a.setAttribute('aria-label', 'Open this page');
      a.dataset.index = i;
      a.style.width = it.width + 'px';
      a.style.left = it.left + 'px';
      a.style.top = it.top + 'px';
      a.style.setProperty('--tilt', it.tilt.toFixed(1) + 'deg');
      a.style.zIndex = it.z;
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
    pile.style.height = L.height + 'px';
  }
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (window.location.hash === '#advice') build(); }, 150);
  });

  function open(i) {
    current = (i + entries.length) % entries.length;
    img.src = 'advice/' + entries[current].src;
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

  function maybeBuild() {
    if (window.location.hash === '#advice') requestAnimationFrame(build);
  }
  window.addEventListener('hashchange', maybeBuild);

  fetch('advice/entries.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (data) { entries = data.entries || []; maybeBuild(); })
    .catch(function (e) { console.error('advice.js: could not read entries.json', e); });
})();
