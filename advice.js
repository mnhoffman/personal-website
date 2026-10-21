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

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Lay the pages out on a loose grid, then nudge and tilt each one so
  // they overlap like a pile on a desk. Every page stays at least
  // partly visible because each has its own cell.
  function build() {
    if (built || !entries.length) return;
    built = true;
    order = shuffle(entries.slice());
    var cols = pile.clientWidth > 760 ? 6 : pile.clientWidth > 520 ? 4 : 3;
    var rows = Math.ceil(order.length / cols);
    var cellW = 100 / cols;
    var cellH = 100 / rows;
    pile.style.setProperty('--rows', rows);
    pile.style.setProperty('--cols', cols);
    var frag = document.createDocumentFragment();
    order.forEach(function (name, i) {
      var r = Math.floor(i / cols), c = i % cols;
      var a = document.createElement('a');
      a.className = 'entry';
      a.href = 'advice/' + name;
      a.setAttribute('aria-label', 'Open this page');
      a.dataset.index = i;
      var left = (c + 0.5) * cellW + (Math.random() - 0.5) * cellW * 0.8;
      var top = (r + 0.5) * cellH + (Math.random() - 0.5) * cellH * 0.5;
      a.style.left = left + '%';
      a.style.top = top + '%';
      a.style.setProperty('--tilt', ((Math.random() - 0.5) * 22).toFixed(1) + 'deg');
      a.style.setProperty('--w', (0.85 + Math.random() * 0.4).toFixed(2));
      a.style.zIndex = 1 + Math.floor(Math.random() * 9);
      var im = document.createElement('img');
      im.src = 'advice/' + name;
      im.alt = '';
      im.loading = i < 18 ? 'eager' : 'lazy';
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
