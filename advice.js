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
  var built = false;

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

  // Pages flow down columns (CSS multi-column), each tilted a little and
  // tucked slightly under the one above, so the sheet fills edge to edge
  // with no open patches.
  function build() {
    if (built || !entries.length) return;
    built = true;
    var rand = rng(20231101);
    order = shuffle(entries.slice(), rand);
    var frag = document.createDocumentFragment();
    order.forEach(function (name, i) {
      var a = document.createElement('a');
      a.className = 'entry';
      a.href = 'advice/' + name;
      a.setAttribute('aria-label', 'Open this page');
      a.dataset.index = i;
      a.style.setProperty('--tilt', ((rand() - 0.5) * 6).toFixed(1) + 'deg');
      a.style.setProperty('--dx', ((rand() - 0.5) * 0.8).toFixed(2) + 'rem');
      a.style.zIndex = 1 + Math.floor(rand() * 9);
      var im = document.createElement('img');
      im.src = 'advice/' + name;
      im.alt = '';
      im.loading = i < 24 ? 'eager' : 'lazy';
      a.appendChild(im);
      a.addEventListener('click', function (ev) { ev.preventDefault(); open(i); });
      frag.appendChild(a);
    });
    pile.appendChild(frag);
  }

  function open(i) {
    current = (i + order.length) % order.length;
    img.src = 'advice/' + order[current];
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
