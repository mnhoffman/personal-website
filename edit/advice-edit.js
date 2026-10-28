/* ------------------------------------------------------------------
   advice-edit.js — arrange, crop, add and remove pages in the pile.

   The preview uses the site's own layout (advice.js), so what you see
   is what the page shows. Drag a page to move it; its neighbours flow
   around it. Crop opens the four-corner tool. Publish commits changed
   images and advice/entries.json to GitHub.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var MANIFEST = 'advice/entries.json';
  var $ = function (id) { return document.getElementById(id); };
  var status = $('status'), msg = $('msg'), publishBtn = $('publish'), pileEl = $('pile'), countEl = $('count');
  var entries = [], originalJSON = '', manifestSha = null;
  var pending = {};      // src -> {blob, w, h}  (new or re-cropped image bytes)
  var removed = [];      // srcs to delete from the repo
  var previews = {};     // src -> object URL for pending blobs
  var token = gh.token;

  function setStatus(t, c) { status.textContent = t; status.className = 'status ' + (c || ''); }
  function setMsg(t, c) { msg.textContent = t; msg.className = 'msg ' + (c || ''); }

  // ---------- load ----------
  function load() {
    setStatus('Loading the pile from GitHub…');
    gh.read(MANIFEST).then(function (f) {
      manifestSha = f.sha;
      var data = JSON.parse(f.text);
      entries = data.entries || [];
      originalJSON = JSON.stringify(entries);
      pending = {}; removed = [];
      render();
      setStatus(token() ? 'Connected to GitHub. Ready to publish.' : 'Loaded (read-only until you connect a token).', token() ? 'ok' : '');
      $('setup').open = !token();
      $('forget').hidden = !token();
      markDirty();
    }).catch(function (e) { setStatus(e.message, 'bad'); $('setup').open = true; });
  }

  // ---------- render the pile ----------
  function srcFor(e) { return previews[e.src] || ('../advice/' + e.src + '?v=' + encodeURIComponent(manifestSha || '')); }
  function render() {
    var W = pileEl.clientWidth, rem = 16;
    var L = advicePile.layout(entries, W, rem);
    var existing = {};
    Array.prototype.slice.call(pileEl.children).forEach(function (c) { existing[c.dataset.src] = c; });
    entries.forEach(function (e, i) {
      var it = L.items[i];
      var card = existing[e.src];
      if (!card) {
        card = document.createElement('div'); card.className = 'card'; card.dataset.src = e.src;
        card.innerHTML = '<img alt="" draggable="false"><div class="tools"><button type="button" class="small" data-act="crop">crop</button><button type="button" class="small" data-act="remove">remove</button></div>';
        card.querySelector('img').src = srcFor(e);
        pileEl.appendChild(card);
      } else delete existing[e.src];
      card.style.width = it.width + 'px'; card.style.left = it.left + 'px'; card.style.top = it.top + 'px';
      card.style.setProperty('--tilt', it.tilt.toFixed(1) + 'deg'); card.style.zIndex = it.z;
      card.dataset.index = i;
    });
    Object.keys(existing).forEach(function (k) { existing[k].remove(); });
    pileEl.style.height = L.height + 'px';
    countEl.textContent = entries.length + ' pages';
  }
  window.addEventListener('resize', function () { if (entries.length) render(); });

  // ---------- drag to rearrange ----------
  var drag = null;
  pileEl.addEventListener('pointerdown', function (ev) {
    if (ev.target.closest('button')) return;
    var card = ev.target.closest('.card'); if (!card) return;
    ev.preventDefault();
    drag = { card: card, src: card.dataset.src, startX: ev.clientX, startY: ev.clientY, moved: false, ox: ev.clientX - card.getBoundingClientRect().left, oy: ev.clientY - card.getBoundingClientRect().top };
    card.setPointerCapture(ev.pointerId);
  });
  pileEl.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 4) return;
    drag.moved = true;
    drag.card.classList.add('dragging');
    var pr = pileEl.getBoundingClientRect();
    drag.card.style.left = (ev.clientX - pr.left - drag.ox) + 'px';
    drag.card.style.top = (ev.clientY - pr.top - drag.oy) + 'px';
    // which page is under the pointer?
    drag.card.style.pointerEvents = 'none';
    var under = document.elementFromPoint(ev.clientX, ev.clientY);
    drag.card.style.pointerEvents = '';
    var over = under && under.closest && under.closest('.card');
    if (over && over !== drag.card) {
      var from = entries.findIndex(function (e) { return e.src === drag.src; });
      var to = +over.dataset.index;
      if (from !== to) {
        var item = entries.splice(from, 1)[0]; entries.splice(to, 0, item);
        render();
        drag.card.style.left = (ev.clientX - pr.left - drag.ox) + 'px';
        drag.card.style.top = (ev.clientY - pr.top - drag.oy) + 'px';
        markDirty();
      }
    }
  });
  function endDrag() {
    if (!drag) return;
    drag.card.classList.remove('dragging');
    drag = null; render();
  }
  pileEl.addEventListener('pointerup', endDrag);
  pileEl.addEventListener('pointercancel', endDrag);

  // ---------- crop / remove ----------
  pileEl.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-act]'); if (!btn) return;
    var card = btn.closest('.card'), src = card.dataset.src;
    var e = entries.find(function (x) { return x.src === src; });
    if (btn.dataset.act === 'remove') {
      if (!window.confirm('Remove this page from the pile? (It is deleted from the site when you publish.)')) return;
      entries = entries.filter(function (x) { return x.src !== src; });
      if (pending[src]) delete pending[src]; else removed.push(src);
      render(); markDirty();
    } else if (btn.dataset.act === 'crop') {
      var source = pending[src] ? pending[src].blob : srcFor(e);
      cropTool.open(source).then(function (r) { setPending(e, r); }).catch(function (err) { if (err.message !== 'cancelled') setMsg(err.message, 'bad'); });
    }
  });
  function setPending(e, r) {
    pending[e.src] = r; e.w = r.w; e.h = r.h;
    if (previews[e.src]) URL.revokeObjectURL(previews[e.src]);
    previews[e.src] = URL.createObjectURL(r.blob);
    var card = pileEl.querySelector('.card[data-src="' + e.src + '"]'); if (card) card.querySelector('img').src = previews[e.src];
    render(); markDirty();
  }

  // ---------- add pages ----------
  $('add').addEventListener('click', function () { $('files').click(); });
  $('files').addEventListener('change', function () {
    var files = Array.prototype.slice.call($('files').files); $('files').value = '';
    (function next() {
      var f = files.shift(); if (!f) return;
      cropTool.open(f).then(function (r) {
        var e = { src: nextName(), w: r.w, h: r.h };
        entries.unshift(e);
        setPending(e, r);
        next();
      }).catch(function (err) { if (err.message !== 'cancelled') setMsg(err.message, 'bad'); next(); });
    })();
  });
  function nextName() {
    var n = 0;
    entries.concat(removed.map(function (s) { return { src: s }; })).forEach(function (e) { var m = /^entry-(\d+)/.exec(e.src); if (m) n = Math.max(n, +m[1]); });
    Object.keys(pending).forEach(function (s) { var m = /^entry-(\d+)/.exec(s); if (m) n = Math.max(n, +m[1]); });
    return 'entry-' + String(n + 1).padStart(3, '0') + '.jpg';
  }

  // ---------- publish ----------
  function dirty() { return JSON.stringify(entries) !== originalJSON || Object.keys(pending).length || removed.length; }
  function markDirty() {
    var d = dirty();
    publishBtn.disabled = !d || !token();
    if (!d) setMsg('Nothing changed yet.');
    else {
      var parts = [];
      var n = Object.keys(pending).filter(function (s) { return originalJSON.indexOf('"' + s + '"') !== -1; }).length;
      var a = Object.keys(pending).length - n;
      if (n) parts.push(n + ' re-cropped'); if (a) parts.push(a + ' new'); if (removed.length) parts.push(removed.length + ' removed');
      var sameOrder = JSON.stringify(entries.map(function (e) { return e.src; })) === JSON.stringify(JSON.parse(originalJSON).map(function (e) { return e.src; }).filter(function (s) { return removed.indexOf(s) === -1; }).filter(function (s) { return entries.some(function (e) { return e.src === s; }); }));
      if (!sameOrder) parts.push('rearranged');
      setMsg((token() ? 'Unpublished: ' : 'Connect a token to publish: ') + parts.join(', ') + '.', token() ? '' : 'bad');
    }
  }
  publishBtn.addEventListener('click', function () {
    publishBtn.disabled = true;
    var steps = [];
    Object.keys(pending).forEach(function (src) {
      steps.push(function () {
        return pending[src].blob.arrayBuffer().then(function (buf) {
          return gh.sha('advice/' + src).then(function (s) { return gh.write('advice/' + src, new Uint8Array(buf), (s ? 'Re-crop ' : 'Add ') + src + ' (via /edit/)', s); });
        }).then(function () { delete pending[src]; });
      });
    });
    removed.slice().forEach(function (src) {
      steps.push(function () {
        return gh.sha('advice/' + src).then(function (s) { return s ? gh.remove('advice/' + src, 'Remove ' + src + ' (via /edit/)', s) : null; })
          .then(function () { removed.splice(removed.indexOf(src), 1); });
      });
    });
    steps.push(function () {
      return gh.read(MANIFEST).then(function (f) {
        var data = JSON.parse(f.text); data.entries = entries;
        return gh.write(MANIFEST, JSON.stringify(data, null, 1) + '\n', 'Arrange the advice pile (via /edit/)', f.sha);
      }).then(function (s) { manifestSha = s; originalJSON = JSON.stringify(entries); });
    });
    var total = steps.length, done = 0;
    (function run() {
      var step = steps.shift();
      if (!step) { markDirty(); setMsg('Published. Live in a minute or two.', 'ok'); return; }
      setMsg('Publishing… ' + (++done) + ' of ' + total);
      step().then(run).catch(function (e) { setMsg(e.message + ' (stopped at step ' + done + ' of ' + total + '; press Publish to continue)', 'bad'); publishBtn.disabled = false; });
    })();
  });

  gh.tokenUI(load);
  $('reload').addEventListener('click', function () { if (dirty() && !window.confirm('You have unpublished changes. Reload and lose them?')) return; load(); });
  window.addEventListener('beforeunload', function (ev) { if (dirty()) { ev.preventDefault(); ev.returnValue = ''; } });
  load();
})();
