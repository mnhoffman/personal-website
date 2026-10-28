/* ------------------------------------------------------------------
   crop.js — a four-corner crop.

   Drag the corners of a quadrilateral over the photo; "Use this crop"
   maps that quadrilateral onto a flat rectangle (a perspective warp,
   so a page photographed at an angle comes out square-on), evens out
   the lighting a little, and hands back a JPEG.

   window.cropTool.open(imageSource, options) → Promise<{blob, w, h}>,
   rejects if cancelled. imageSource: a File/Blob or an image URL.
   ------------------------------------------------------------------ */
window.cropTool = (function () {
  'use strict';

  var overlay, canvas, ctx, img, quad, handles, drag = null, resolveFn, rejectFn, scale = 1;
  var whiteout = false, marq = null, history = [];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function ensure() {
    if (overlay) return;
    overlay = el('div', 'crop-overlay');
    overlay.innerHTML =
      '<div class="crop-panel">' +
      '  <div class="crop-head"><strong>Crop</strong> <span class="crop-hint">Drag the four corners to the corners of the page. The crop is straightened from there.</span></div>' +
      '  <div class="crop-stage"><div class="crop-box"><canvas></canvas>' +
      '    <div class="crop-handle" data-i="0"></div><div class="crop-handle" data-i="1"></div><div class="crop-handle" data-i="2"></div><div class="crop-handle" data-i="3"></div>' +
      '    <svg class="crop-quad"><polygon points="0,0 0,0 0,0 0,0"></polygon></svg>' +
      '    <div class="crop-marquee"></div>' +
      '  </div></div>' +
      '  <div class="crop-actions">' +
      '    <button type="button" class="small" data-act="reset">Reset corners</button>' +
      '    <button type="button" class="small" data-act="rotate">Rotate 90°</button>' +
      '    <button type="button" class="small" data-act="whiteout" title="Drag a box over anything to cover; it is filled with the paper colour around it">White-out</button>' +
      '    <button type="button" class="small" data-act="undo" disabled>Undo white-out</button>' +
      '    <label class="crop-check"><input type="checkbox" data-act="even" checked> even out lighting</label>' +
      '    <span class="crop-spacer"></span>' +
      '    <button type="button" class="small" data-act="cancel">Cancel</button>' +
      '    <button type="button" class="primary" data-act="apply">Use this crop</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(overlay);
    canvas = overlay.querySelector('canvas'); ctx = canvas.getContext('2d');
    handles = Array.prototype.slice.call(overlay.querySelectorAll('.crop-handle'));
    handles.forEach(function (h) {
      h.addEventListener('pointerdown', function (ev) { drag = +h.dataset.i; h.setPointerCapture(ev.pointerId); ev.preventDefault(); });
      h.addEventListener('pointermove', function (ev) {
        if (drag !== +h.dataset.i) return;
        var r = canvas.getBoundingClientRect();
        quad[drag] = [clamp((ev.clientX - r.left) / scale, 0, img.width), clamp((ev.clientY - r.top) / scale, 0, img.height)];
        draw();
      });
      h.addEventListener('pointerup', function () { drag = null; });
    });
    overlay.addEventListener('click', function (ev) {
      var act = ev.target.dataset && ev.target.dataset.act;
      if (act === 'cancel') finish(null);
      else if (act === 'reset') { resetQuad(); draw(); }
      else if (act === 'rotate') { rotate(); }
      else if (act === 'apply') apply();
      else if (act === 'whiteout') setWhiteout(!whiteout);
      else if (act === 'undo') undo();
    });
    // white-out: drag a rectangle on the canvas
    canvas.addEventListener('pointerdown', function (ev) {
      if (!whiteout) return;
      var r = canvas.getBoundingClientRect();
      marq = { x0: (ev.clientX - r.left) / scale, y0: (ev.clientY - r.top) / scale, x1: 0, y1: 0 };
      marq.x1 = marq.x0; marq.y1 = marq.y0;
      canvas.setPointerCapture(ev.pointerId); ev.preventDefault(); drawMarquee();
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!whiteout || !marq) return;
      var r = canvas.getBoundingClientRect();
      marq.x1 = clamp((ev.clientX - r.left) / scale, 0, img.width); marq.y1 = clamp((ev.clientY - r.top) / scale, 0, img.height);
      drawMarquee();
    });
    canvas.addEventListener('pointerup', function () {
      if (!whiteout || !marq) return;
      var x = Math.round(Math.min(marq.x0, marq.x1)), y = Math.round(Math.min(marq.y0, marq.y1));
      var w = Math.round(Math.abs(marq.x1 - marq.x0)), h = Math.round(Math.abs(marq.y1 - marq.y0));
      marq = null; drawMarquee();
      if (w > 2 && h > 2) paintOut(x, y, w, h);
    });
    document.addEventListener('keydown', function (ev) { if (overlay.classList.contains('on') && ev.key === 'Escape') finish(null); });
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function resetQuad() {
    var w = img.width, h = img.height;
    quad = [[0, 0], [w, 0], [w, h], [0, h]];
  }
  function fit() {
    var stage = overlay.querySelector('.crop-stage');
    var maxW = stage.clientWidth, maxH = Math.max(320, window.innerHeight - 220);
    scale = Math.min(maxW / img.width, maxH / img.height, 1);
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.style.width = canvas.width + 'px'; canvas.style.height = canvas.height + 'px';
    var svg = overlay.querySelector('.crop-quad');
    svg.setAttribute('width', canvas.width); svg.setAttribute('height', canvas.height);
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // dim everything outside the quad
    ctx.save();
    ctx.fillStyle = 'rgba(20, 14, 30, 0.55)';
    ctx.beginPath(); ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.moveTo(quad[0][0] * scale, quad[0][1] * scale);
    for (var i = 3; i >= 1; i--) ctx.lineTo(quad[i][0] * scale, quad[i][1] * scale);
    ctx.closePath(); ctx.fill('evenodd'); ctx.restore();
    overlay.querySelector('polygon').setAttribute('points', quad.map(function (p) { return (p[0] * scale) + ',' + (p[1] * scale); }).join(' '));
    handles.forEach(function (h, i) { h.style.left = (quad[i][0] * scale) + 'px'; h.style.top = (quad[i][1] * scale) + 'px'; });
  }
  function rotate() {
    var c = document.createElement('canvas'); c.width = img.height; c.height = img.width;
    var x = c.getContext('2d'); x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(img, 0, 0);
    img = c; resetQuad(); fit(); draw();
  }

  // Homography from the unit-rectangle destination (W×H) back to the source quad.
  function homography(W, H, q) {
    // Solve for H such that H * [x y 1]ᵀ(dest) ~ source. 8 unknowns.
    var src = [[0, 0], [W, 0], [W, H], [0, H]], A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = q[i][0], v = q[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    // Gaussian elimination
    var n = 8;
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      var t = A[c]; A[c] = A[p]; A[p] = t; t = b[c]; b[c] = b[p]; b[p] = t;
      for (var r2 = c + 1; r2 < n; r2++) { var f = A[r2][c] / A[c][c]; for (var k = c; k < n; k++) A[r2][k] -= f * A[c][k]; b[r2] -= f * b[c]; }
    }
    var h = new Array(n);
    for (var i2 = n - 1; i2 >= 0; i2--) { var s = b[i2]; for (var k2 = i2 + 1; k2 < n; k2++) s -= A[i2][k2] * h[k2]; h[i2] = s / A[i2][i2]; }
    h.push(1);
    return h;
  }

  function apply() {
    var q = quad;
    var untouched = q[0][0] === 0 && q[0][1] === 0 && q[1][0] === img.width && q[1][1] === 0 && q[2][0] === img.width && q[2][1] === img.height && q[3][0] === 0 && q[3][1] === img.height;
    if (untouched) {
      // no crop: just export the (possibly whited-out, rotated) image as is
      var oc0 = document.createElement('canvas'); var W0 = img.width, H0 = img.height, cap0 = 1400 / Math.max(W0, H0);
      if (cap0 < 1) { W0 = Math.round(W0 * cap0); H0 = Math.round(H0 * cap0); }
      oc0.width = W0; oc0.height = H0; oc0.getContext('2d').drawImage(img, 0, 0, W0, H0);
      oc0.toBlob(function (blob) { finish({ blob: blob, w: W0, h: H0 }); }, 'image/jpeg', 0.85);
      return;
    }
    var dist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    var W = Math.round((dist(q[0], q[1]) + dist(q[3], q[2])) / 2);
    var H = Math.round((dist(q[0], q[3]) + dist(q[1], q[2])) / 2);
    var cap = 1400 / Math.max(W, H); if (cap < 1) { W = Math.round(W * cap); H = Math.round(H * cap); }
    if (W < 20 || H < 20) return;
    var Hm = homography(W, H, q);
    var sc = document.createElement('canvas'); sc.width = img.width; sc.height = img.height;
    sc.getContext('2d').drawImage(img, 0, 0);
    var src = sc.getContext('2d').getImageData(0, 0, sc.width, sc.height), sd = src.data, sw = sc.width, sh = sc.height;
    var out = ctx.createImageData(W, H), od = out.data;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var d = Hm[6] * x + Hm[7] * y + 1;
        var u = (Hm[0] * x + Hm[1] * y + Hm[2]) / d, v = (Hm[3] * x + Hm[4] * y + Hm[5]) / d;
        var o = (y * W + x) * 4;
        if (u < 0 || v < 0 || u >= sw - 1 || v >= sh - 1) { od[o] = od[o + 1] = od[o + 2] = 240; od[o + 3] = 255; continue; }
        var x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
        var i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
        for (var ch = 0; ch < 3; ch++) {
          od[o + ch] = (sd[i00 + ch] * (1 - fx) + sd[i10 + ch] * fx) * (1 - fy) + (sd[i01 + ch] * (1 - fx) + sd[i11 + ch] * fx) * fy;
        }
        od[o + 3] = 255;
      }
    }
    if (overlay.querySelector('[data-act="even"]').checked) evenOut(od, W, H);
    var oc = document.createElement('canvas'); oc.width = W; oc.height = H;
    oc.getContext('2d').putImageData(out, 0, 0);
    oc.toBlob(function (blob) { finish({ blob: blob, w: W, h: H }); }, 'image/jpeg', 0.85);
  }

  // Lift uneven lighting: divide by a heavily blurred copy of the luminance.
  function evenOut(d, W, H) {
    var step = Math.max(1, Math.round(Math.min(W, H) / 60)), gw = Math.ceil(W / step), gh = Math.ceil(H / step);
    var grid = new Float32Array(gw * gh), cnt = new Float32Array(gw * gh);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var i = (y * W + x) * 4, g = (y / step | 0) * gw + (x / step | 0); grid[g] += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; cnt[g]++; }
    for (var k = 0; k < grid.length; k++) grid[k] /= cnt[k] || 1;
    // a few box blurs over the coarse grid ≈ gaussian
    for (var pass = 0; pass < 3; pass++) {
      var tmp = new Float32Array(grid.length);
      for (var gy = 0; gy < gh; gy++) for (var gx = 0; gx < gw; gx++) {
        var s = 0, n = 0;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) { var yy = gy + dy, xx = gx + dx; if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) { s += grid[yy * gw + xx]; n++; } }
        tmp[gy * gw + gx] = s / n;
      }
      grid = tmp;
    }
    var target = 0; for (var k2 = 0; k2 < grid.length; k2++) target = Math.max(target, grid[k2]); target = Math.min(target, 235);
    for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) {
      var i2 = (y2 * W + x2) * 4, bg = grid[(y2 / step | 0) * gw + (x2 / step | 0)] || 1, gain = Math.min(1.6, target / bg);
      d[i2] = Math.min(255, d[i2] * gain); d[i2 + 1] = Math.min(255, d[i2 + 1] * gain); d[i2 + 2] = Math.min(255, d[i2 + 2] * gain);
    }
  }

  // ---------- white-out ----------
  function setWhiteout(on) {
    whiteout = on;
    overlay.querySelector('.crop-box').classList.toggle('whiteout', on);
    overlay.querySelector('[data-act="whiteout"]').classList.toggle('on', on);
    overlay.querySelector('.crop-hint').textContent = on
      ? 'Drag a box over anything to cover. It is filled with the paper colour around it. Press White-out again to go back to the corners.'
      : 'Drag the four corners to the corners of the page. The crop is straightened from there.';
  }
  function updateUndo() { overlay.querySelector('[data-act="undo"]').disabled = !history.length; }
  function drawMarquee() {
    var m = overlay.querySelector('.crop-marquee');
    if (!marq) { m.style.display = 'none'; return; }
    m.style.display = 'block';
    m.style.left = (Math.min(marq.x0, marq.x1) * scale) + 'px'; m.style.top = (Math.min(marq.y0, marq.y1) * scale) + 'px';
    m.style.width = (Math.abs(marq.x1 - marq.x0) * scale) + 'px'; m.style.height = (Math.abs(marq.y1 - marq.y0) * scale) + 'px';
  }
  function toCanvas() {
    if (img instanceof HTMLCanvasElement) return img;
    var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0); img = c; return c;
  }
  // Fill the box with the paper colour sampled from a ring just outside it,
  // with a little grain and a soft edge so it disappears into the page.
  function paintOut(x, y, w, h) {
    var c = toCanvas(), x2 = c.getContext('2d');
    history.push(x2.getImageData(x, y, w, h)); history.length > 20 && history.shift(); updateUndo();
    history[history.length - 1].at = [x, y];
    var ring = 6, rx = Math.max(0, x - ring), ry = Math.max(0, y - ring);
    var rw = Math.min(c.width, x + w + ring) - rx, rh = Math.min(c.height, y + h + ring) - ry;
    var d = x2.getImageData(rx, ry, rw, rh).data, R = [], G = [], B = [];
    for (var yy = 0; yy < rh; yy++) for (var xx = 0; xx < rw; xx++) {
      var inside = xx + rx >= x && xx + rx < x + w && yy + ry >= y && yy + ry < y + h;
      if (inside) continue;
      var i = (yy * rw + xx) * 4; R.push(d[i]); G.push(d[i + 1]); B.push(d[i + 2]);
    }
    var med = function (a) { a.sort(function (p, q) { return p - q; }); return a[a.length >> 1] || 240; };
    // use the brighter half of the ring so stray ink around the box doesn't darken the fill
    var lum = R.map(function (r, i) { return 0.299 * r + 0.587 * G[i] + 0.114 * B[i]; });
    var cut = lum.slice().sort(function (p, q) { return p - q; })[lum.length >> 1];
    var keep = lum.map(function (l) { return l >= cut; });
    var col = [med(R.filter(function (_, i) { return keep[i]; })), med(G.filter(function (_, i) { return keep[i]; })), med(B.filter(function (_, i) { return keep[i]; }))];
    var patch = x2.createImageData(w, h), p = patch.data;
    for (var k = 0; k < w * h; k++) {
      var n = (Math.random() - 0.5) * 6;
      p[k * 4] = col[0] + n; p[k * 4 + 1] = col[1] + n; p[k * 4 + 2] = col[2] + n; p[k * 4 + 3] = 255;
    }
    x2.putImageData(patch, x, y);
    // soft edge: blend a 2px border back toward the original
    var edge = x2.getImageData(x, y, w, h), e = edge.data, o = history[history.length - 1].data;
    for (var yy2 = 0; yy2 < h; yy2++) for (var xx2 = 0; xx2 < w; xx2++) {
      var dist = Math.min(xx2, yy2, w - 1 - xx2, h - 1 - yy2);
      if (dist >= 2) continue;
      var t = (dist + 1) / 3, j = (yy2 * w + xx2) * 4;
      for (var ch = 0; ch < 3; ch++) e[j + ch] = o[j + ch] * (1 - t) + e[j + ch] * t;
    }
    x2.putImageData(edge, x, y);
    draw();
  }
  function undo() {
    var last = history.pop(); if (!last) return;
    toCanvas().getContext('2d').putImageData(last, last.at[0], last.at[1]);
    updateUndo(); draw();
  }

  function finish(result) {
    overlay.classList.remove('on');
    if (result) resolveFn(result); else rejectFn(new Error('cancelled'));
  }

  function open(source) {
    ensure();
    return new Promise(function (resolve, reject) {
      resolveFn = resolve; rejectFn = reject;
      var p = source instanceof Blob ? createImageBitmap(source, { imageOrientation: 'from-image' }) : new Promise(function (res, rej) { var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { res(i); }; i.onerror = rej; i.src = source; });
      p.then(function (bitmap) {
        img = bitmap; history = []; setWhiteout(false); updateUndo();
        overlay.classList.add('on');
        resetQuad(); fit(); draw();
      }).catch(function () { reject(new Error('Could not load that image.')); });
    });
  }

  return { open: open };
})();
