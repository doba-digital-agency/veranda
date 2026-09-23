/*
  Site-wide WebGL layer (Three.js) — loaded last on every page.

  Two effects, both pure progressive enhancement. (There used to be a
  third, a "liquid" hero photo on every page — removed at the user's
  request; every hero now has only its GSAP shape reveal, see
  ANIMATIONS.md "Hero shape reveal".)

  1. Portfolio lightbox photo change — replaces stage 1's clip-path wipe with a
     liquid, noise-edged dissolve between the two photos. It wraps
     window.__verandaFx.lightboxSwap (registered by scroll-experience.js)
     and falls back to that original on any failure.
  2. Services format stage photo change — the same liquid dissolve, cover-
     fit and vertical, wrapping window.__verandaFx.formatSwap (the sticky
     .service-stage built by scroll-experience.js on desktop).

  Runs only on desktop with a fine pointer, without reduced motion, with
  WebGL available. Three.js (a ~170 KB gzip ES module) is fetched with a
  dynamic import() only after the page has loaded and gone idle, so it
  never delays first paint; if it fails to load, nothing changes.

  Deliberately does NOT touch GSAP/ScrollTrigger/Lenis (CLAUDE.md §3 — only
  scroll-experience.js may): it runs its own small rAF loop and reads
  plain window.scrollY, which Lenis keeps updated.
*/
(function () {
  'use strict';

  // No hero effect any more (the liquid hero was removed at the user's
  // request) — Three.js is only fetched where one of the two remaining
  // effects can run: Portfolio's gallery lightbox, Services' format rows.
  var galleryLightbox = document.querySelector('.photo-lightbox--gallery');
  var formatRows = document.querySelector('.service-detail-list');
  if (!galleryLightbox && !formatRows) return;

  var mq = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
  if (mq('(prefers-reduced-motion: reduce)')) return;
  if (!mq('(hover: hover) and (pointer: fine)') || window.innerWidth < 1024) return;

  function supportsWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (err) {
      return false;
    }
  }
  if (!supportsWebGL()) return;
  // Opened straight from disk (file://): every image counts as cross-origin,
  // so WebGL refuses them as textures and the dissolve would render blank.
  // Keep the GSAP wipe instead; over http(s) this never applies.
  if (location.protocol === 'file:') return;

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

  function whenIdle(cb) {
    function schedule() {
      if ('requestIdleCallback' in window) window.requestIdleCallback(cb, { timeout: 2000 });
      else window.setTimeout(cb, 300);
    }
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = src;
    });
  }

  var VERTEX = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var NOISE = [
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p) {',
    '  float v = 0.0; float a = 0.5;',
    '  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }',
    '  return v;',
    '}'
  ].join('\n');

  function makeTexture(THREE, image) {
    var tex = new THREE.Texture(image);
    // Raw sRGB bytes straight through: no colorspace conversion in the
    // ShaderMaterial, so output pixels match the <img> exactly.
    tex.colorSpace = THREE.NoColorSpace;
    // Mipmapped minification: several sources are 3024px wide and get
    // drawn at under half size — plain linear filtering aliased visibly
    // against the browser's own high-quality <img> downscale (Home's hero
    // measured 2x noisier than the other pages before this).
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  function makeRenderer(THREE, canvas, alpha) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: alpha, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (alpha) renderer.setClearColor(0x000000, 0);
    return renderer;
  }

  function makeQuad(THREE, uniforms, fragment, transparent) {
    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: VERTEX,
      fragmentShader: fragment,
      transparent: !!transparent,
      depthTest: false,
      depthWrite: false
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    return { scene: scene, camera: camera };
  }

  /* ---------------------- 1. Lightbox photo change -------------------- */

  var SWAP_FRAGMENT = [
    'precision highp float;',
    'uniform sampler2D uA;',
    'uniform sampler2D uB;',
    'uniform vec2 uRes;',
    'uniform vec2 uSizeA;',
    'uniform vec2 uSizeB;',
    'uniform float uP;',
    'uniform float uDir;',
    'varying vec2 vUv;',
    NOISE,
    // object-fit:contain inside the canvas; outside the photo -> transparent.
    'vec4 contain(sampler2D t, vec2 size, vec2 uv) {',
    '  float rs = uRes.x / uRes.y; float ri = size.x / size.y;',
    '  vec2 s = rs > ri ? vec2(rs / ri, 1.0) : vec2(1.0, ri / rs);',
    '  vec2 q = (uv - 0.5) * s + 0.5;',
    '  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return vec4(0.0);',
    '  return vec4(texture2D(t, q).rgb, 1.0);',
    '}',
    'void main() {',
    '  vec2 uv = vUv;',
    '  float n = fbm(uv * vec2(3.0, 4.5) + uP * 0.6);',
    // r = distance from the edge the new photo enters from (next -> right).
    '  float r = uDir > 0.0 ? 1.0 - uv.x : uv.x;',
    '  float edge = uP * 1.7 - 0.35;',
    '  float m = 1.0 - smoothstep(edge - 0.18, edge + 0.18, r + (n - 0.5) * 0.45);',
    '  float band = 1.0 - abs(m * 2.0 - 1.0);',
    // Liquid push along the direction of travel, strongest at the edge.
    '  vec2 disp = vec2(-uDir, 0.0) * band * 0.07 + (vec2(n, fbm(uv * 5.0)) - 0.5) * band * 0.08;',
    '  vec4 a = contain(uA, uSizeA, uv + disp);',
    '  vec4 b = contain(uB, uSizeB, uv - disp * 0.6);',
    '  gl_FragColor = mix(a, b, m);',
    '}'
  ].join('\n');

  function setupLightbox(THREE) {
    var fx = window.__verandaFx;
    var lightbox = galleryLightbox;
    if (!fx || !fx.lightboxSwap || !lightbox) return;
    var image = lightbox.querySelector('[data-lightbox-image]');
    if (!image) return;

    var fallbackSwap = fx.lightboxSwap;
    var canvas = document.createElement('canvas');
    canvas.className = 'photo-lightbox__webgl';
    canvas.setAttribute('aria-hidden', 'true');
    lightbox.insertBefore(canvas, lightbox.firstChild);

    var renderer = makeRenderer(THREE, canvas, true);
    var uniforms = {
      uA: { value: null },
      uB: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uSizeA: { value: new THREE.Vector2(1, 1) },
      uSizeB: { value: new THREE.Vector2(1, 1) },
      uP: { value: 0 },
      uDir: { value: 1 }
    };
    var quad = makeQuad(THREE, uniforms, SWAP_FRAGMENT, true);
    var run = 0; // bumps on every swap/close, cancelling a stale one

    function finish(textures) {
      canvas.classList.remove('is-active');
      image.style.visibility = '';
      textures.forEach(function (t) { if (t) t.dispose(); });
    }

    lightbox.addEventListener('veranda:modalclose', function () {
      run++;
      canvas.classList.remove('is-active');
      image.style.visibility = '';
    });

    var DURATION = 1100;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    fx.lightboxSwap = function (img, dir, commit, done) {
      var rect = img.getBoundingClientRect();
      var fromSrc = img.currentSrc || img.src;
      if (!rect.width || !rect.height || !fromSrc) return fallbackSwap(img, dir, commit, done);

      var myRun = ++run;
      var texA = null;
      var texB = null;

      loadImage(fromSrc).then(function (a) {
        if (myRun !== run) throw new Error('stale');
        texA = makeTexture(THREE, a);
        uniforms.uA.value = texA;
        uniforms.uB.value = texA;
        uniforms.uSizeA.value.set(a.naturalWidth, a.naturalHeight);
        uniforms.uSizeB.value.set(a.naturalWidth, a.naturalHeight);
        uniforms.uP.value = 0;
        uniforms.uDir.value = dir > 0 ? 1 : -1;

        canvas.style.left = rect.left + 'px';
        canvas.style.top = rect.top + 'px';
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        renderer.setSize(rect.width, rect.height, false);
        uniforms.uRes.value.set(rect.width, rect.height);
        renderer.render(quad.scene, quad.camera);

        // Canvas now shows photo A exactly where the <img> is; swap under it.
        canvas.classList.add('is-active');
        image.style.visibility = 'hidden';
        commit();
        return loadImage(img.src);
      }).then(function (b) {
        if (myRun !== run) throw new Error('stale');
        texB = makeTexture(THREE, b);
        uniforms.uB.value = texB;
        uniforms.uSizeB.value.set(b.naturalWidth, b.naturalHeight);

        return new Promise(function (resolve) {
          var start = performance.now();
          (function tick(now) {
            if (myRun !== run) { resolve(); return; }
            var p = Math.min((now - start) / DURATION, 1);
            uniforms.uP.value = ease(p);
            renderer.render(quad.scene, quad.camera);
            if (p < 1) requestAnimationFrame(tick);
            else resolve();
          })(start);
        });
      }).then(function () {
        if (myRun === run) finish([texA, texB]);
        else [texA, texB].forEach(function (t) { if (t) t.dispose(); });
        done();
      }).catch(function () {
        [texA, texB].forEach(function (t) { if (t) t.dispose(); });
        if (myRun === run) {
          canvas.classList.remove('is-active');
          image.style.visibility = '';
        }
        // If commit() never ran (photo A failed), fall back to stage 1.
        if (!texA && myRun === run) fallbackSwap(img, dir, commit, done);
        else done();
      });
    };
  }

  /* ---------------- 2. Services format stage photo change -------------- */

  // Same noise-edged liquid dissolve as the lightbox, but object-fit:cover
  // (matching .service-stage__img exactly, so the hand-over to/from the
  // <img>s is invisible) and vertical: scrolling down, the next photo
  // rises from the bottom edge; scrolling up, it pours in from the top.
  var STAGE_FRAGMENT = [
    'precision highp float;',
    'uniform sampler2D uA;',
    'uniform sampler2D uB;',
    'uniform vec2 uRes;',
    'uniform vec2 uSizeA;',
    'uniform vec2 uSizeB;',
    'uniform float uP;',
    'uniform float uDir;',
    'varying vec2 vUv;',
    NOISE,
    'vec3 cover(sampler2D t, vec2 size, vec2 uv) {',
    '  float rs = uRes.x / uRes.y; float ri = size.x / size.y;',
    '  vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);',
    '  return texture2D(t, clamp((uv - 0.5) * s + 0.5, 0.0, 1.0)).rgb;',
    '}',
    'void main() {',
    '  vec2 uv = vUv;',
    '  float n = fbm(uv * vec2(4.5, 3.0) + uP * 0.6);',
    '  float r = uDir > 0.0 ? uv.y : 1.0 - uv.y;',
    '  float edge = uP * 1.7 - 0.35;',
    '  float m = 1.0 - smoothstep(edge - 0.18, edge + 0.18, r + (n - 0.5) * 0.45);',
    '  float band = 1.0 - abs(m * 2.0 - 1.0);',
    '  vec2 disp = vec2(0.0, -uDir) * band * 0.07 + (vec2(fbm(uv * 5.0), n) - 0.5) * band * 0.08;',
    '  vec3 a = cover(uA, uSizeA, uv + disp);',
    '  vec3 b = cover(uB, uSizeB, uv - disp * 0.6);',
    '  gl_FragColor = vec4(mix(a, b, m), 1.0);',
    '}'
  ].join('\n');

  function setupFormatStage(THREE) {
    var fx = window.__verandaFx;
    // Built by scroll-experience.js (desktop, motion allowed) — only then
    // does a stage exist to enhance.
    var stage = document.querySelector('.service-stage');
    if (!fx || !fx.formatSwap || !stage) return;

    var fallbackSwap = fx.formatSwap;
    var canvas = document.createElement('canvas');
    canvas.className = 'service-stage__webgl';
    canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas);

    var renderer = makeRenderer(THREE, canvas, false);
    var uniforms = {
      uA: { value: null },
      uB: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uSizeA: { value: new THREE.Vector2(1, 1) },
      uSizeB: { value: new THREE.Vector2(1, 1) },
      uP: { value: 0 },
      uDir: { value: 1 }
    };
    var quad = makeQuad(THREE, uniforms, STAGE_FRAGMENT, false);

    // Only 4 photos, reused on every scroll pass — upload each once.
    var textures = {};
    function texture(img) {
      var src = img.currentSrc || img.src;
      if (!textures[src]) {
        textures[src] = loadImage(src).then(function (im) {
          return { tex: makeTexture(THREE, im), w: im.naturalWidth, h: im.naturalHeight };
        });
        textures[src].catch(function () { delete textures[src]; });
      }
      return textures[src];
    }
    Array.prototype.forEach.call(stage.querySelectorAll('.service-stage__img'), texture);

    var DURATION = 1000;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    fx.formatSwap = function (from, to, dir, done) {
      var rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return fallbackSwap(from, to, dir, done);
      var switched = false;

      Promise.all([texture(from), texture(to)]).then(function (pair) {
        uniforms.uA.value = pair[0].tex;
        uniforms.uSizeA.value.set(pair[0].w, pair[0].h);
        uniforms.uB.value = pair[1].tex;
        uniforms.uSizeB.value.set(pair[1].w, pair[1].h);
        uniforms.uDir.value = dir > 0 ? 1 : -1;
        uniforms.uP.value = 0;
        renderer.setSize(rect.width, rect.height, false);
        uniforms.uRes.value.set(rect.width, rect.height);
        renderer.render(quad.scene, quad.camera);

        // Canvas now shows `from` exactly; switch the <img>s underneath.
        canvas.classList.add('is-active');
        from.style.visibility = 'hidden';
        from.style.zIndex = '0';
        to.style.visibility = 'visible';
        to.style.zIndex = '2';
        switched = true;

        return new Promise(function (resolve) {
          var start = performance.now();
          (function tick(now) {
            var p = Math.min((now - start) / DURATION, 1);
            uniforms.uP.value = ease(p);
            renderer.render(quad.scene, quad.camera);
            if (p < 1) requestAnimationFrame(tick);
            else resolve();
          })(start);
        });
      }).then(function () {
        canvas.classList.remove('is-active');
        done();
      }).catch(function () {
        canvas.classList.remove('is-active');
        // Photos already switched under the canvas: just end on `to`.
        if (switched) done();
        else fallbackSwap(from, to, dir, done);
      });
    };
  }

  whenIdle(function () {
    import(THREE_URL).then(function (THREE) {
      setupLightbox(THREE);
      setupFormatStage(THREE);
    }).catch(function () {
      // Offline/CDN blocked: stage 1 (plain photo + GSAP wipe) stays.
    });
  });
})();
