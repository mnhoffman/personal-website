/* ------------------------------------------------------------------
   ocean.js — a living water background.

   A full-screen WebGL fragment shader draws a gently rolling sea.
   The surface height is a sum of slow sine swells plus any number of
   expanding ripple rings; the shader lights the surface from the
   slope of that height field so swells, crests and ripples all read
   as water. Click (or tap) anywhere to drop a ripple.

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
    '',
    // Slow swells: a few sines travelling in different directions.
    'float swell(vec2 p, float t){',
    '  float h = 0.0;',
    '  h += sin(p.x * 1.60 + p.y * 0.40 + t * 0.55) * 0.34;',
    '  h += sin(p.x * 0.75 + p.y * 1.80 - t * 0.42) * 0.26;',
    '  h += sin(p.x * 2.70 - p.y * 1.10 + t * 0.78) * 0.14;',
    '  h += sin(p.x * -1.20 + p.y * 3.30 + t * 1.05) * 0.07;',
    '  return h;',
    '}',
    '',
    // Chop: finer, faster wavelets layered on the swells so the surface
    // has texture to catch the light even when nothing has been clicked.
    'float chop(vec2 p, float t){',
    '  float h = 0.0;',
    '  h += sin(p.x * 4.10 + p.y * 2.10 - t * 1.40) * 0.50;',
    '  h += sin(p.x * -3.30 + p.y * 5.20 + t * 1.75) * 0.35;',
    '  h += sin(p.x * 6.80 + p.y * -1.40 + t * 2.10) * 0.22;',
    '  h += sin(p.x * 2.20 + p.y * 7.60 - t * 1.90) * 0.18;',
    '  h += sin(p.x * 9.50 + p.y * 4.30 + t * 2.60) * 0.10;',
    '  return h;',
    '}',
    '',
    // Ripples: each click is a ring that expands outward, fading as it
    // ages and as it travels. Inside the ring the surface oscillates
    // with a short wavelength so the lighting picks it up sharply.
    'float ripples(vec2 p, float t){',
    '  float h = 0.0;',
    '  for (int i = 0; i < ' + MAX_RIPPLES + '; i++){',
    '    if (i >= u_count) break;',
    '    vec4 r = u_ripples[i];',
    '    float age = t - r.z;',
    '    if (age <= 0.0 || age > 6.0) continue;',
    '    float d = distance(p, r.xy);',
    '    float front = age * 0.55;',                    // how far the ring has travelled
    '    float inside = 1.0 - smoothstep(front - 0.18, front + 0.04, d);',
    '    float env = exp(-age * 0.75) * exp(-d * 1.1) * inside;',
    '    float wave = sin(d * 42.0 - age * 11.0);',
    '    h += wave * env * r.w;',
    '  }',
    '  return h;',
    '}',
    '',
    'float height(vec2 p, float t){ return swell(p, t) + chop(p, t) * 0.14 + ripples(p, t) * 0.6; }',
    '',
    'void main(){',
    '  float aspect = u_res.x / u_res.y;',
    '  vec2 uv = gl_FragCoord.xy / u_res;',
    '  vec2 p = vec2((uv.x - 0.5) * 2.0 * aspect, (uv.y - 0.5) * 2.0);',
    '  float t = u_time;',
    '',
    '  float e = 0.012;',
    '  float h  = height(p, t);',
    '  float hx = height(p + vec2(e, 0.0), t);',
    '  float hy = height(p + vec2(0.0, e), t);',
    '  vec3 n = normalize(vec3(-(hx - h) / e * 0.30, -(hy - h) / e * 0.30, 1.0));',
    '',
    // Lighting: a low sun up and to the left, a viewer looking down.
    '  vec3 L = normalize(vec3(-0.35, 0.60, 0.72));',
    '  vec3 V = vec3(0.0, 0.0, 1.0);',
    '  float diff = clamp(dot(n, L), 0.0, 1.0);',
    '  float spec = pow(clamp(dot(reflect(-L, n), V), 0.0, 1.0), 64.0);',
    '  float glint = pow(clamp(dot(reflect(-L, n), V), 0.0, 1.0), 320.0);',
    '  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.0);',
    '',
    // Palette: deep ink at the top (far), teal-green nearer the bottom.
    '  vec3 deep  = vec3(0.016, 0.078, 0.150);',
    '  vec3 mid   = vec3(0.040, 0.235, 0.370);',
    '  vec3 shal  = vec3(0.180, 0.520, 0.560);',
    '  vec3 foam  = vec3(0.820, 0.930, 0.930);',
    '',
    '  float depth = smoothstep(0.0, 1.0, uv.y * 0.85 + 0.1);',   // 0 bottom, 1 top
    '  vec3 col = mix(shal, deep, depth);',
    '  col = mix(col, mid, 0.45 + 0.35 * sin(h * 1.7));',
    '  col += (diff - 0.5) * 0.30;',
    '  col = mix(col, foam, smoothstep(0.55, 0.95, h) * 0.35);',   // crests catch light
        // Highlights are soft-clamped so a steep slope never blows out to
    // pure white under the type.
'  float hl = spec * (0.18 + 0.30 * (1.0 - depth)) + glint * 0.35;',
'  hl = hl / (1.0 + hl * 2.2);',
'  col += hl * vec3(0.95, 0.97, 0.9);',
    '  col += fres * vec3(0.10, 0.18, 0.22);',
    '',
    // A soft vignette so the type always has somewhere dark to sit.
    '  float vig = smoothstep(1.35, 0.35, length((uv - 0.5) * vec2(1.15, 1.0)));',
    '  col *= 0.72 + 0.28 * vig;',
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

  var uRes = gl.getUniformLocation(prog, 'u_res');
  var uTime = gl.getUniformLocation(prog, 'u_time');
  var uCount = gl.getUniformLocation(prog, 'u_count');
  var uRipples = gl.getUniformLocation(prog, 'u_ripples');

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
    if (t - lastTrail < 90) return;
    lastTrail = t;
    addRipple(ev.clientX, ev.clientY, 0.35);
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
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, reduceMotion ? t * 0.15 : t);
    gl.uniform1i(uCount, rippleCount);
    gl.uniform4fv(uRipples, ripples);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (document.hidden) { running = false; return; }
    if (reduceMotion && performance.now() > stillUntil) { running = false; return; }
    frameReq = requestAnimationFrame(draw);
  }

  function wake() {
    stillUntil = performance.now() + 7000;   // ripples live about six seconds
    if (!running && !document.hidden) { running = true; frameReq = requestAnimationFrame(draw); }
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) wake();
  });

  gl.clearColor(0.016, 0.078, 0.150, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  wake();
})();
