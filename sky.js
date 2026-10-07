/* ------------------------------------------------------------------
   sky.js — a grainy film sky that follows the time of day.

   A full-screen WebGL fragment shader paints a soft, blended sky:
   colour bands pulled from a 24-hour palette (dusk oranges, blue-hour
   indigo, hazy daylight, starry night), drifted very slowly by noise so
   nothing is ever quite still but nothing is ever a shape you could
   name. A low silhouette of rooftops and trees sits along the bottom,
   and the whole thing is finished like a photograph: lifted blacks,
   cool shadows, a vignette, and film grain that flickers at about
   twelve frames a second.

   The page's text colour follows the sky: ivory at dusk and night,
   dark ink when the sky is bright (see data-sky on <html>).

   Preview tricks (add to the URL):
     ?hour=19       freeze the sky at a given hour (0-24, decimals ok)
     ?cycle=120     run the whole day on a loop, this many seconds long

   Falls back to a CSS gradient if WebGL isn't available.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var canvas = document.getElementById('sky');
  if (!canvas) return;

  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false })
        || canvas.getContext('experimental-webgl');
  if (!gl) { canvas.style.display = 'none'; return; }

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --------------------------------------------------------------
  // Palette through the day: [hour, horizon, middle, zenith, glow, night]
  // Colours are 0-1 RGB. "glow" tints the haze near the horizon;
  // "night" (0-1) fades the stars in.
  // --------------------------------------------------------------
  var KEYS = [
    [ 0,   [0.10, 0.10, 0.17], [0.05, 0.07, 0.14], [0.02, 0.03, 0.08], [0.50, 0.55, 0.70], 1.0],
    [ 4.5, [0.30, 0.18, 0.24], [0.14, 0.12, 0.26], [0.04, 0.05, 0.12], [0.85, 0.60, 0.50], 0.7],
    [ 6.5, [0.92, 0.58, 0.38], [0.70, 0.42, 0.48], [0.24, 0.24, 0.42], [1.00, 0.80, 0.60], 0.1],
    [ 9,   [0.86, 0.74, 0.60], [0.62, 0.66, 0.70], [0.34, 0.46, 0.60], [1.00, 0.95, 0.85], 0.0],
    [13,   [0.80, 0.76, 0.68], [0.52, 0.63, 0.70], [0.26, 0.42, 0.60], [1.00, 1.00, 0.95], 0.0],
    [16.5, [0.90, 0.68, 0.48], [0.68, 0.56, 0.58], [0.30, 0.36, 0.54], [1.00, 0.85, 0.65], 0.0],
    [18.5, [0.92, 0.48, 0.30], [0.62, 0.30, 0.40], [0.16, 0.14, 0.32], [1.00, 0.65, 0.45], 0.2],
    [20,   [0.48, 0.24, 0.32], [0.22, 0.15, 0.32], [0.07, 0.07, 0.17], [0.85, 0.50, 0.55], 0.7],
    [22,   [0.18, 0.13, 0.22], [0.08, 0.08, 0.18], [0.03, 0.04, 0.10], [0.60, 0.55, 0.70], 1.0],
    [24,   [0.10, 0.10, 0.17], [0.05, 0.07, 0.14], [0.02, 0.03, 0.08], [0.50, 0.55, 0.70], 1.0]
  ];

  function smooth(x) { return x * x * (3 - 2 * x); }
  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  function paletteAt(hour) {
    hour = ((hour % 24) + 24) % 24;
    for (var i = 0; i < KEYS.length - 1; i++) {
      var a = KEYS[i], b = KEYS[i + 1];
      if (hour >= a[0] && hour <= b[0]) {
        var t = smooth((hour - a[0]) / (b[0] - a[0]));
        return {
          hor: lerp3(a[1], b[1], t), mid: lerp3(a[2], b[2], t), zen: lerp3(a[3], b[3], t),
          glow: lerp3(a[4], b[4], t), night: a[5] + (b[5] - a[5]) * t
        };
      }
    }
    var k = KEYS[0];
    return { hor: k[1], mid: k[2], zen: k[3], glow: k[4], night: k[5] };
  }

  var params = new URLSearchParams(window.location.search);
  var fixedHour = params.has('hour') ? parseFloat(params.get('hour')) : NaN;
  var cycleSecs = params.has('cycle') ? parseFloat(params.get('cycle')) : NaN;

  // Which hour the sky thinks it is: real local time, with a wander of
  // about twenty minutes either way so the colour keeps shifting.
  function currentHour(t) {
    if (cycleSecs > 0) return (t / cycleSecs) * 24;
    if (!isNaN(fixedHour)) return fixedHour;
    var d = new Date();
    var h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    return h + 0.3 * Math.sin(t / 160);
  }

  // --------------------------------------------------------------
  // Shaders
  // --------------------------------------------------------------
  var VERT = 'attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }';

  var FRAG = [
    'precision highp float;',
    'uniform vec2  u_res;',
    'uniform float u_time;',
    'uniform vec3  u_hor;',
    'uniform vec3  u_mid;',
    'uniform vec3  u_zen;',
    'uniform vec3  u_glow;',
    'uniform float u_night;',
    '',
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }',
    '  return v;',
    '}',
    '',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / u_res;',
    '  float aspect = u_res.x / u_res.y;',
    '  vec2 p = vec2(uv.x * aspect, uv.y);',
    '  float t = u_time * 0.012;',
    '',
    // Two layers of slow noise bend the colour bands so the sky is
    // blended and uneven, like film, without forming readable clouds.
    '  float n1 = fbm(p * vec2(1.2, 1.6) + vec2(t * 0.9, t * 0.3));',
    '  float n2 = fbm(p * vec2(2.6, 3.4) - vec2(t * 0.5, t * 0.7) + 7.0);',
    '  float y = uv.y + (n1 - 0.5) * 0.40 + (n2 - 0.5) * 0.14;',
    '',
    '  vec3 col = mix(u_hor, u_mid, smoothstep(-0.05, 0.55, y));',
    '  col = mix(col, u_zen, smoothstep(0.45, 1.05, y));',
    '  col += u_glow * smoothstep(0.55, 0.9, n2) * 0.10 * (1.0 - smoothstep(0.0, 0.7, uv.y));',
    '',
    // Stars, only when the palette says it is night.
    '  if (u_night > 0.0){',
    '    vec2 g = gl_FragCoord.xy / 3.0;',
    '    vec2 id = floor(g);',
    '    float h = hash(id);',
    '    float star = step(0.994, h) * smoothstep(0.55, 0.05, length(fract(g) - 0.5));',
    '    float tw = 0.55 + 0.45 * sin(u_time * (0.4 + h * 1.5) + h * 40.0);',
    '    col += star * tw * u_night * smoothstep(0.25, 0.9, uv.y) * 0.75;',
    '  }',
    '',
    // A low silhouette of rooftops and trees along the bottom.
    '  float hz = 0.085 + 0.035 * fbm(vec2(p.x * 5.0, 3.0)) + 0.012 * noise(vec2(p.x * 24.0, 1.0));',
    '  float sil = 1.0 - smoothstep(hz - 0.005, hz + 0.006, uv.y);',
    '  col = mix(col, vec3(0.035, 0.03, 0.05), sil * 0.96);',
    '',
    // Film finish: cool shadows, lifted blacks, vignette, grain.
    '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col += vec3(-0.02, 0.01, 0.035) * (1.0 - lum);',
    '  col = col * 0.90 + 0.045;',
    '  float vig = smoothstep(1.45, 0.45, length((uv - 0.5) * vec2(1.1, 1.0)));',
    '  col *= 0.80 + 0.20 * vig;',
    '  float frame = floor(u_time * 12.0);',
    '  float gr = hash(gl_FragCoord.xy + vec2(fract(frame * 0.137) * 311.0, fract(frame * 0.291) * 197.0));',
    '  col += (gr - 0.5) * 0.075;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('sky.js shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.style.display = 'none'; return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('sky.js link error:', gl.getProgramInfoLog(prog));
    canvas.style.display = 'none';
    return;
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ['u_res', 'u_time', 'u_hor', 'u_mid', 'u_zen', 'u_glow', 'u_night'].forEach(function (name) {
    U[name] = gl.getUniformLocation(prog, name);
  });

  // --------------------------------------------------------------
  // Text colour follows the sky's brightness.
  // --------------------------------------------------------------
  var lastInk = '';
  function updateInk(pal) {
    // Judge the upper half of the sky, where the text sits.
    var c = lerp3(pal.mid, pal.zen, 0.4);
    var lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    var mode = lum > 0.45 ? 'bright' : 'dark';
    if (mode !== lastInk) {
      document.documentElement.setAttribute('data-sky', mode);
      lastInk = mode;
    }
  }

  // --------------------------------------------------------------
  // Sizing & render loop. The sky renders at half resolution: the grain
  // hides it completely and it keeps laptops cool.
  // --------------------------------------------------------------
  function resize() {
    var scale = 0.5 * Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.floor(canvas.clientWidth * scale));
    var h = Math.max(1, Math.floor(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener('resize', function () { resize(); wake(); });

  var start = performance.now();
  var running = false;
  var lastInkCheck = 0;

  function draw() {
    resize();
    var t = (performance.now() - start) / 1000;
    var pal = paletteAt(currentHour(t));
    gl.uniform2f(U.u_res, canvas.width, canvas.height);
    gl.uniform1f(U.u_time, reduceMotion ? 0.0 : t);
    gl.uniform3fv(U.u_hor, pal.hor);
    gl.uniform3fv(U.u_mid, pal.mid);
    gl.uniform3fv(U.u_zen, pal.zen);
    gl.uniform3fv(U.u_glow, pal.glow);
    gl.uniform1f(U.u_night, pal.night);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (performance.now() - lastInkCheck > 1000) { updateInk(pal); lastInkCheck = performance.now(); }

    if (document.hidden || reduceMotion) { running = false; return; }
    requestAnimationFrame(draw);
  }

  function wake() {
    if (!running && !document.hidden) { running = true; requestAnimationFrame(draw); }
  }

  document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
  if (reduceMotion) setInterval(wake, 60000);   // still follow the clock

  gl.clearColor(0.05, 0.07, 0.14, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  updateInk(paletteAt(currentHour(0)));
  wake();
})();
