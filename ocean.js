/* ------------------------------------------------------------------
   ocean.js — living water whose colours follow the time of day.

   A full-screen WebGL fragment shader draws a gently rolling surface:
   slow swells plus fine chop, lit from a low sun. The palette is
   picked from a 24-hour cycle (indigo night, lavender-and-peach dawn,
   blue day, orange-and-purple sunset) and drifts slowly within it so
   the colour is never quite still. Clicks and taps draw small,
   hand-drawn-looking rings.

   Preview tricks (add to the URL):
     ?hour=19       freeze the palette at a given hour (0-24, decimals ok)
     ?cycle=120     run the whole day on a loop, this many seconds long

   Falls back to a quiet CSS gradient if WebGL isn't available.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var MAX_RIPPLES = 24;
  var canvas = document.getElementById('ocean');
  if (!canvas) return;

  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false })
        || canvas.getContext('experimental-webgl');
  if (!gl) { canvas.style.display = 'none'; return; }

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --------------------------------------------------------------
  // Palette through the day: [hour, deep, mid, shallow, glow]
  // deep = horizon / far water, shallow = near water, glow = light.
  // The dawn and dusk keys lean on the old site's #9B8BC7 lavender
  // and #EDA074 orange; midday is the blue.
  // --------------------------------------------------------------
  var KEYS = [
    [ 0,   [0.07, 0.05, 0.17], [0.19, 0.14, 0.37], [0.31, 0.21, 0.45], [0.78, 0.70, 0.92]],
    [ 4.5, [0.10, 0.07, 0.25], [0.30, 0.20, 0.48], [0.44, 0.28, 0.50], [0.90, 0.72, 0.68]],
    [ 7,   [0.22, 0.16, 0.44], [0.50, 0.42, 0.70], [0.80, 0.49, 0.36], [1.00, 0.86, 0.72]],
    [ 9.5, [0.10, 0.15, 0.38], [0.30, 0.36, 0.62], [0.50, 0.52, 0.68], [0.95, 0.92, 0.92]],
    [12,   [0.03, 0.12, 0.26], [0.09, 0.32, 0.46], [0.25, 0.58, 0.63], [0.84, 0.95, 0.95]],
    [15,   [0.016, 0.078, 0.15], [0.04, 0.235, 0.37], [0.18, 0.52, 0.56], [0.82, 0.93, 0.93]],
    [17.5, [0.06, 0.12, 0.32], [0.25, 0.27, 0.58], [0.52, 0.45, 0.72], [0.95, 0.86, 0.82]],
    [19.5, [0.18, 0.11, 0.38], [0.48, 0.30, 0.58], [0.80, 0.47, 0.36], [1.00, 0.80, 0.62]],
    [21.5, [0.11, 0.07, 0.27], [0.31, 0.19, 0.48], [0.46, 0.28, 0.52], [0.84, 0.70, 0.90]],
    [24,   [0.07, 0.05, 0.17], [0.19, 0.14, 0.37], [0.31, 0.21, 0.45], [0.78, 0.70, 0.92]]
  ];

  function smooth(x) { return x * x * (3 - 2 * x); }
  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  function paletteAt(hour) {
    hour = ((hour % 24) + 24) % 24;
    for (var i = 0; i < KEYS.length - 1; i++) {
      var a = KEYS[i], b = KEYS[i + 1];
      if (hour >= a[0] && hour <= b[0]) {
        var t = smooth((hour - a[0]) / (b[0] - a[0]));
        return [lerp3(a[1], b[1], t), lerp3(a[2], b[2], t), lerp3(a[3], b[3], t), lerp3(a[4], b[4], t)];
      }
    }
    return [KEYS[0][1], KEYS[0][2], KEYS[0][3], KEYS[0][4]];
  }

  var params = new URLSearchParams(window.location.search);
  var fixedHour = params.has('hour') ? parseFloat(params.get('hour')) : NaN;
  var cycleSecs = params.has('cycle') ? parseFloat(params.get('cycle')) : NaN;

  // Which hour the water thinks it is. Real local time by default, with
  // a slow wander of about forty minutes either way so the colour keeps
  // moving even when the clock barely has.
  function currentHour(t) {
    if (cycleSecs > 0) return (t / cycleSecs) * 24;
    if (!isNaN(fixedHour)) return fixedHour;
    var d = new Date();
    var h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    return h + 0.35 * Math.sin(t / 140);
  }

  // --------------------------------------------------------------
  // Shaders
  // --------------------------------------------------------------
  var VERT = [
    'attribute vec2 a_pos;',
    'void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2  u_res;',
    'uniform float u_time;',
    'uniform int   u_count;',
    'uniform vec4  u_ripples[' + MAX_RIPPLES + '];', // x, y, birth time, strength
    'uniform vec3  u_deep;',
    'uniform vec3  u_mid;',
    'uniform vec3  u_shal;',
    'uniform vec3  u_glow;',
    '',
    // Slow swells: a few sines travelling in different directions.
    'float swell(vec2 p, float t){',
    '  float h = 0.0;',
    '  h += sin(p.x * 1.60 + p.y * 0.40 + t * 0.28) * 0.34;',
    '  h += sin(p.x * 0.75 + p.y * 1.80 - t * 0.22) * 0.26;',
    '  h += sin(p.x * 2.70 - p.y * 1.10 + t * 0.40) * 0.14;',
    '  h += sin(p.x * -1.20 + p.y * 3.30 + t * 0.55) * 0.07;',
    '  return h;',
    '}',
    '',
    // Chop: finer, faster wavelets layered on the swells so the surface
    // has texture to catch the light.
    'float chop(vec2 p, float t){',
    '  float h = 0.0;',
    '  h += sin(p.x * 4.10 + p.y * 2.10 - t * 0.70) * 0.50;',
    '  h += sin(p.x * -3.30 + p.y * 5.20 + t * 0.85) * 0.35;',
    '  h += sin(p.x * 6.80 + p.y * -1.40 + t * 1.00) * 0.22;',
    '  h += sin(p.x * 2.20 + p.y * 7.60 - t * 0.95) * 0.18;',
    '  h += sin(p.x * 9.50 + p.y * 4.30 + t * 1.20) * 0.10;',
    '  return h;',
    '}',
    '',
    // Ripples: each click draws a couple of thin rings that widen and
    // fade over about two seconds. The radius wobbles a little with the
    // angle so they look drawn by hand rather than simulated. Returns
    // how much light to add at this point (0..1).
    'float ripples(vec2 p, float t){',
    '  float light = 0.0;',
    '  for (int i = 0; i < ' + MAX_RIPPLES + '; i++){',
    '    if (i >= u_count) break;',
    '    vec4 r = u_ripples[i];',
    '    float age = t - r.z;',
    '    if (age <= 0.0 || age > 2.4) continue;',
    '    vec2 q = p - r.xy;',
    '    float ang = atan(q.y, q.x);',
    '    float seed = r.z * 7.3;',
    '    float wob = 0.007 * sin(ang * 5.0 + seed) + 0.004 * sin(ang * 9.0 - seed * 1.7);',
    '    float d = length(q) + wob;',
    '    float grow = 1.0 - exp(-age * 1.6);',                 // eases out as it widens
    '    float front = 0.02 + grow * 0.22;',
    '    float fade = (1.0 - smoothstep(0.9, 2.4, age)) * r.w;',
    '    float w = 0.006 + age * 0.004;',                      // the line softens as it goes
    '    float ring1 = 1.0 - smoothstep(0.0, w, abs(d - front));',
    '    float ring2 = 1.0 - smoothstep(0.0, w, abs(d - front * 0.62));',
    '    light += (ring1 + ring2 * 0.5) * fade;',
    '  }',
    '  return light;',
    '}',
    '',
    'float height(vec2 p, float t){ return swell(p, t) + chop(p, t) * 0.08; }',
    '',
    'void main(){',
    '  float aspect = u_res.x / u_res.y;',
    '  vec2 uv = gl_FragCoord.xy / u_res;',
    '  vec2 p = vec2((uv.x - 0.5) * 2.0 * aspect, (uv.y - 0.5) * 2.0);',
    '  float t = u_time;',
    '',
    '  float rp = ripples(p, t);',
    '  float e = 0.012;',
    '  float h  = height(p, t);',
    '  float hx = height(p + vec2(e, 0.0), t);',
    '  float hy = height(p + vec2(0.0, e), t);',
    '  vec3 n = normalize(vec3(-(hx - h) / e * 0.22, -(hy - h) / e * 0.22, 1.0));',
    '',
    // Lighting: a low sun up and to the left, a viewer looking down.
    '  vec3 L = normalize(vec3(-0.35, 0.60, 0.72));',
    '  vec3 V = vec3(0.0, 0.0, 1.0);',
    '  float diff = clamp(dot(n, L), 0.0, 1.0);',
    '  float spec = pow(clamp(dot(reflect(-L, n), V), 0.0, 1.0), 10.0);',
    '  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.0);',
    '',
    '  float depth = smoothstep(0.0, 1.0, uv.y * 0.85 + 0.1);',   // 0 bottom, 1 top
    '  vec3 col = mix(u_shal, u_deep, depth);',
    '  col = mix(col, u_mid, 0.45 + 0.35 * sin(h * 1.7));',
    '  col += (diff - 0.5) * 0.22;',
    '  col = mix(col, u_glow, smoothstep(0.55, 0.95, h) * 0.18);',   // crests catch light
    '',
    // A broad, soft sheen instead of sharp glints: matte, not glossy.
    '  col = mix(col, u_glow, spec * 0.10 * (0.5 + 0.5 * (1.0 - depth)));',
    '  col += fres * u_mid * 0.35;',
    '',
    // The ripple rings, in the palette's glow colour.
    '  col = mix(col, u_glow, clamp(rp, 0.0, 1.0) * 0.28);',
    '',
    // A whisper of grain so the surface feels like paper, not a screen.
    '  float grain = fract(sin(dot(gl_FragCoord.xy + vec2(t * 7.0), vec2(12.9898, 78.233))) * 43758.5453);',
    '  col += (grain - 0.5) * 0.035;',
    '',
    // A soft vignette so the type always has somewhere darker to sit.
    '  float vig = smoothstep(1.35, 0.35, length((uv - 0.5) * vec2(1.15, 1.0)));',
    '  col *= 0.64 + 0.36 * vig;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('ocean.js shader error:', gl.getShaderInfoLog(s));
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
    console.error('ocean.js link error:', gl.getProgramInfoLog(prog));
    canvas.style.display = 'none';
    return;
  }
  gl.useProgram(prog);

  // Two triangles covering the screen.
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ['u_res', 'u_time', 'u_count', 'u_ripples', 'u_deep', 'u_mid', 'u_shal', 'u_glow'].forEach(function (name) {
    U[name] = gl.getUniformLocation(prog, name);
  });

  // --------------------------------------------------------------
  // Ripple bookkeeping. A ring buffer of [x, y, birth, strength].
  // --------------------------------------------------------------
  var ripples = new Float32Array(MAX_RIPPLES * 4);
  var rippleCount = 0;
  var rippleHead = 0;

  var start = performance.now();
  function now() { return (performance.now() - start) / 1000; }

  function addRipple(clientX, clientY, strength) {
    var w = canvas.clientWidth, hgt = canvas.clientHeight;
    var aspect = w / hgt;
    // Same mapping as the shader: x in [-aspect, aspect], y in [-1, 1], y up.
    var x = (clientX / w - 0.5) * 2 * aspect;
    var y = (0.5 - clientY / hgt) * 2;
    var i = rippleHead * 4;
    ripples[i] = x; ripples[i + 1] = y; ripples[i + 2] = now(); ripples[i + 3] = strength;
    rippleHead = (rippleHead + 1) % MAX_RIPPLES;
    rippleCount = Math.min(rippleCount + 1, MAX_RIPPLES);
    wake();
  }

  // Clicks anywhere on the page drop a ripple — including on text,
  // since the content layers let pointer events fall through to here.
  window.addEventListener('pointerdown', function (ev) {
    if (ev.button !== undefined && ev.button !== 0) return;
    addRipple(ev.clientX, ev.clientY, 1.0);
  }, { passive: true });

  // A quieter ripple follows a slow drag / finger move.
  var lastTrail = 0;
  window.addEventListener('pointermove', function (ev) {
    if (!(ev.buttons & 1)) return;
    var t = performance.now();
    if (t - lastTrail < 110) return;
    lastTrail = t;
    addRipple(ev.clientX, ev.clientY, 0.45);
  }, { passive: true });

  // --------------------------------------------------------------
  // Sizing & render loop
  // --------------------------------------------------------------
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.floor(canvas.clientWidth * dpr);
    var h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener('resize', function () { resize(); wake(); });

  var running = false;
  var frameReq = 0;
  // With reduced motion we still draw, but only when something changes.
  var stillUntil = 0;

  function draw() {
    frameReq = 0;
    resize();
    var t = now();
    var pal = paletteAt(currentHour(t));
    gl.uniform2f(U.u_res, canvas.width, canvas.height);
    gl.uniform1f(U.u_time, reduceMotion ? t * 0.15 : t);
    gl.uniform1i(U.u_count, rippleCount);
    gl.uniform4fv(U.u_ripples, ripples);
    gl.uniform3fv(U.u_deep, pal[0]);
    gl.uniform3fv(U.u_mid, pal[1]);
    gl.uniform3fv(U.u_shal, pal[2]);
    gl.uniform3fv(U.u_glow, pal[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (document.hidden) { running = false; return; }
    if (reduceMotion && performance.now() > stillUntil) { running = false; return; }
    frameReq = requestAnimationFrame(draw);
  }

  function wake() {
    stillUntil = performance.now() + 3000;   // ripples live about two seconds
    if (!running && !document.hidden) { running = true; frameReq = requestAnimationFrame(draw); }
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) wake();
  });

  // With reduced motion, still refresh the palette now and then.
  if (reduceMotion) setInterval(wake, 60000);

  gl.clearColor(0.07, 0.05, 0.17, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  wake();
})();
