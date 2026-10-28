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

  var overlay, canvas, ctx, img, quad, handles, drag = null, resolveFn, rejectFn, scale = 1, ox = 0, oy = 0;

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
      '  </div></div>' +
      '  <div class="crop-actions">' +
      '    <button type="button" class="small" data-act="reset">Reset corners</button>' +
      '    <button type="button" class="small" data-act="rotate">Rotate 90°</button>' +
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
    });
    document.addEventListener('keydown', function (ev) { if (overlay.classList.contains('on') && ev.key === 'Escape') finish(null); });
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function resetQuad() {
    var w = img.width, h = img.height, m = 0.04;
    quad = [[w * m, h * m], [w * (1 - m), h * m], [w * (1 - m), h * (1 - m)], [w * m, h * (1 - m)]];
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
        img = bitmap;
        overlay.classList.add('on');
        resetQuad(); fit(); draw();
      }).catch(function () { reject(new Error('Could not load that image.')); });
    });
  }

  return { open: open };
})();
