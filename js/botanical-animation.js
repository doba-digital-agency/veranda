/*
  Botanical wind animation for the site's decorative flower illustrations.

  These assets are flat line-art (thin single-color strokes on a transparent
  background), not photographs or vector paths — so "wind" is reproduced as a
  raster bend: the artwork is sliced into thin horizontal strips and each
  strip is redrawn with a small horizontal offset that grows from the base
  (almost none) to the tip (most), driven by a smooth multi-sine wind field
  sampled with a height-dependent phase delay so the motion visibly travels
  up the stem rather than moving everything in lockstep.

  Mouse interaction: a dandelion-style particle effect. Each flower-head
  cluster (FLOWER_REGIONS) carries a scattering of tiny "floret" points; the
  cursor approaching one lifts it off as a small procedurally-drawn seed
  particle (a dot with radiating spokes — not a crop of the artwork) that
  drifts away on its own via a shared overlay canvas. The autonomous wind
  bending above is unaffected either way — nothing here bends or moves the
  plant itself.

  Canvas2D only — no external library, so there is nothing that can fail to
  load from a CDN. If anything here throws, the original <img> (already in
  the DOM, already positioned/rotated/sized by the existing CSS classes) is
  simply left alone and the page looks exactly as it did before this file
  existed.
*/

(function () {
  'use strict';

  if (typeof document === 'undefined' || !document.createElement('canvas').getContext) {
    return;
  }

  var reduceMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener: function () {}, removeEventListener: function () {} };

  var rootStyle = getComputedStyle(document.documentElement);
  var COLOR_OLIVE = (rootStyle.getPropertyValue('--color-dark-olive') || '#333729').trim();
  var COLOR_CREAM = (rootStyle.getPropertyValue('--color-cream') || '#e9e4da').trim();

  var isMobileViewport = window.innerWidth < 1024;

  /* ---------------------------------------------------------------------
     Pointer: tracks the mouse in client (viewport) coordinates, used below
     to detect when the cursor is near a floret. Only wired up on devices
     that actually have a hover-capable, fine pointer (i.e. a real mouse) —
     touch devices never add this listener, so mobile keeps only the
     autonomous wind animation with no particle interaction at all.
  --------------------------------------------------------------------- */

  var Pointer = { x: 0, y: 0, active: false };
  var pointerCapable = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

  function setupPointer() {
    if (!pointerCapable) return;
    window.addEventListener('mousemove', function (e) {
      Pointer.x = e.clientX;
      Pointer.y = e.clientY;
      Pointer.active = true;
    }, { passive: true });
    window.addEventListener('mouseleave', function () { Pointer.active = false; });
    window.addEventListener('blur', function () { Pointer.active = false; });
  }

  // Validation flag: while true, only the Why-Us flower is animated so the
  // wind behavior can be judged on its own before wiring up every instance.
  var TEST_SINGLE_FLOWER = false;

  /* ---------------------------------------------------------------------
     Recoloring: tint a line-art image to a single brand color while
     keeping its original alpha (so antialiased stroke edges stay soft
     instead of becoming a flat hard-edged silhouette), then make the
     flower-head clusters read as slightly denser/richer than the stems by
     drawing the tinted silhouette a second time clipped to those regions.
     Runs once per unique source image and is cached.
  --------------------------------------------------------------------- */

  var recolorCache = Object.create(null);

  function tintSilhouette(sourceCanvas, color) {
    var w = sourceCanvas.width;
    var h = sourceCanvas.height;
    var out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    var ctx = out.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    return out;
  }

  // Flower-head positions, as fractions of image width/height, eyeballed
  // from the source artwork. Approximate by design — these assets are used
  // as soft decorative texture, not focal illustrations.
  var FLOWER_REGIONS = {
    'decorative-babys-breath.png': [
      { x: 0.62, y: 0.18, r: 0.22 },
      { x: 0.72, y: 0.62, r: 0.17 }
    ],
    'decorative-cornflower-branch.png': [
      { x: 0.65, y: 0.11, r: 0.15 },
      { x: 0.35, y: 0.34, r: 0.14 },
      { x: 0.87, y: 0.27, r: 0.11 },
      { x: 0.85, y: 0.05, r: 0.09 }
    ],
    'logo.png': [
      { x: 0.66, y: 0.10, r: 0.15 },
      { x: 0.34, y: 0.33, r: 0.14 },
      { x: 0.86, y: 0.06, r: 0.09 },
      { x: 0.80, y: 0.28, r: 0.09 }
    ]
  };

  function recolorImage(img, color) {
    var key = img.currentSrc || img.src;
    var cacheKey = key + '::' + color;
    if (recolorCache[cacheKey]) return recolorCache[cacheKey];

    var w = img.naturalWidth;
    var h = img.naturalHeight;
    var base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    base.getContext('2d').drawImage(img, 0, 0, w, h);

    var tinted = tintSilhouette(base, color);

    var fileName = key.split('/').pop().split('?')[0];
    var regions = FLOWER_REGIONS[fileName];
    if (regions && regions.length) {
      var ctx = tinted.getContext('2d');
      ctx.save();
      ctx.beginPath();
      for (var i = 0; i < regions.length; i++) {
        var region = regions[i];
        ctx.moveTo((region.x + region.r) * w, region.y * h);
        ctx.arc(region.x * w, region.y * h, region.r * w, 0, Math.PI * 2);
      }
      ctx.clip();
      ctx.drawImage(tinted, 0, 0);
      ctx.restore();
    }

    recolorCache[cacheKey] = tinted;
    return tinted;
  }

  /* ---------------------------------------------------------------------
     Wind field: a small sum of sines at different, non-aligned frequencies
     so the combined signal doesn't feel like an obvious loop, plus a slow
     envelope that breathes the overall strength up and down (calm -> gentle
     breeze -> calm) rather than gusting suddenly.
  --------------------------------------------------------------------- */

  function windField(t) {
    var envelope = 0.55 + 0.45 * Math.sin(t * 0.11);
    var w = Math.sin(t * 0.6) + 0.45 * Math.sin(t * 1.53 + 1.1) + 0.3 * Math.sin(t * 0.23 + 2.4);
    return envelope * (w / 1.75);
  }

  /* ---------------------------------------------------------------------
     BotanicalFlower: owns one canvas, redraws its tinted source image as a
     bending stem each frame it's told to render. Rendering is driven by a
     single shared rAF loop (see Engine below) rather than one loop per
     instance.
  --------------------------------------------------------------------- */

  function BotanicalFlower(img, options) {
    this.img = img;
    this.options = options || {};
    this.canvas = document.createElement('canvas');
    this.canvas.className = img.className;
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    this.ready = false;
    this.visible = false;
    this.phaseOffset = Math.random() * 100;
    this.dpr = Math.min(window.devicePixelRatio || 1, options.maxDpr || 2);
    this._boundResize = this.resize.bind(this);
    // Detachable dandelion-style florets for the mouse interaction (built
    // once the source image is ready — see _buildFlorets), and a cached
    // inverse of the canvas's own static CSS transform (rotation/flip) so
    // the mouse position — given in page coordinates — can be mapped into
    // the same unrotated local space the artwork is drawn in, and back
    // again when a floret lifts off.
    this.florets = [];
    this._invTransform = null;
  }

  // Reads the canvas's own (static, author-time) CSS transform and returns
  // its inverse with translation stripped out, so it can convert a
  // center-relative mouse vector into local, unrotated canvas space.
  // Computed lazily, once, the first time it's actually needed — never
  // touched by the plain autonomous wind animation.
  BotanicalFlower.prototype._getInverseTransform = function () {
    if (this._invTransform) return this._invTransform;
    var str = getComputedStyle(this.canvas).transform;
    var m = str && str !== 'none' && window.DOMMatrix ? new DOMMatrix(str) : new DOMMatrix();
    m.e = 0;
    m.f = 0;
    this._invTransform = m.inverse();
    return this._invTransform;
  };

  // Converts the current page-space mouse position into this flower's own
  // local (pre-rotation) CSS-pixel space, matching the coordinate system
  // the artwork is drawn in. Returns null when it can't be computed yet.
  BotanicalFlower.prototype._localPointer = function () {
    if (!this.canvas.isConnected) return null;
    var rect = this.canvas.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var inv = this._getInverseTransform();
    var local = inv.transformPoint(new DOMPoint(Pointer.x - cx, Pointer.y - cy));
    return { x: this.cssW / 2 + local.x, y: this.cssH / 2 + local.y };
  };

  // The reverse of _localPointer: a point in this flower's local CSS-pixel
  // space, converted to page (viewport) coordinates — used once, at the
  // moment a floret lifts off, to know where to spawn its particle on the
  // shared overlay canvas.
  BotanicalFlower.prototype._localToPage = function (lx, ly) {
    var rect = this.canvas.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var fwd = this._getInverseTransform().inverse();
    var p = fwd.transformPoint(new DOMPoint(lx - this.cssW / 2, ly - this.cssH / 2));
    return { x: cx + p.x, y: cy + p.y };
  };

  // Builds the dandelion-style florets for this flower: a scattering of
  // small points within each flower-head cluster (FLOWER_REGIONS — the same
  // regions already used for recoloring, since that's exactly where the
  // "fluffy" cluster texture is), biased toward the outer part of the
  // cluster the way seeds sit on the surface of a real seed head rather
  // than clumped at its center. Each floret is just a coordinate — nothing
  // is cropped from the artwork; the particle it produces when triggered is
  // drawn from scratch (see drawSeedParticle). Also builds the mutable
  // working copy of the source image that a triggered floret's spot is
  // faded from and later restored into.
  BotanicalFlower.prototype._buildFlorets = function () {
    var w = this.source.width;
    var h = this.source.height;
    this.displaySource = document.createElement('canvas');
    this.displaySource.width = w;
    this.displaySource.height = h;
    this.displaySource.getContext('2d').drawImage(this.source, 0, 0);

    var key = this.img.currentSrc || this.img.src;
    var fileName = key.split('/').pop().split('?')[0];
    var regions = FLOWER_REGIONS[fileName] || [];

    for (var i = 0; i < regions.length; i++) {
      var region = regions[i];
      var cx = region.x * w;
      var cy = region.y * h;
      var r = region.r * w;
      var count = Math.max(7, Math.round(region.r * 60));
      for (var j = 0; j < count; j++) {
        var angle = Math.random() * Math.PI * 2;
        var dist = r * (0.25 + Math.random() * 0.72);
        var fcx = cx + Math.cos(angle) * dist;
        var fcy = cy + Math.sin(angle) * dist;
        this.florets.push({
          cx: fcx, cy: fcy,
          fx: fcx / w, fy: fcy / h,
          state: 'attached',
          cooldownUntil: 0
        });
      }
    }
  };

  BotanicalFlower.prototype.init = function () {
    var self = this;
    var start = function () {
      try {
        self.source = recolorImage(self.img, self.options.tint || COLOR_OLIVE);
        self._buildFlorets();
      } catch (err) {
        return; // leave the original <img> visible, nothing else to do
      }
      self.img.insertAdjacentElement('afterend', self.canvas);
      self.resize(); // sets self.ready and paints the first frame if visible now
      window.addEventListener('resize', self._boundResize);
    };

    if (this.img.complete && this.img.naturalWidth) {
      start();
    } else {
      this.img.addEventListener('load', start, { once: true });
    }
  };

  BotanicalFlower.prototype.resize = function () {
    var cssW = this.img.offsetWidth;
    var cssH = this.img.offsetHeight;
    if (!cssW || !cssH) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.options.maxDpr || 2);
    this.cssW = cssW;
    this.cssH = cssH;

    // At this sway amplitude the swayed tip can travel well past the
    // artwork's own width, so the canvas is widened symmetrically (which
    // keeps its center — and any CSS rotation pivot — exactly where it
    // was) to give the bend somewhere to go without being clipped by the
    // canvas's own edge. Every render/pointer calculation elsewhere still
    // works purely in cssW/cssH terms; only the actual draw position and,
    // for absolutely-positioned instances, a compensating negative margin
    // need to know about the padding.
    var maxSway = this.options.maxSway || 6;
    this.swayPadding = Math.ceil(maxSway * 1.45);
    var paddedW = cssW + this.swayPadding * 2;
    this.canvas.style.width = paddedW + 'px';
    if (!this.options.centered) {
      // Flex-centered instances (the footer flowers, centered by their own
      // wrapper) re-center automatically as their width changes and must
      // NOT get this margin — it would push them off-center. Absolutely
      // positioned instances (left/top in CSS) do need it: growing their
      // width without it would shift their visual center to the right by
      // swayPadding.
      this.canvas.style.marginLeft = (-this.swayPadding) + 'px';
    }
    this.canvas.width = Math.round(paddedW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    if (!this.ready && this.source) {
      // Handles a decorative flower that starts hidden (e.g. desktop-only
      // decor while the page loaded at a mobile width) and only gets a real
      // size once the viewport crosses back over the relevant breakpoint.
      // IntersectionObserver isn't guaranteed to re-fire promptly for a
      // display:none -> block transition, so mark it visible directly here;
      // scroll-driven pausing still takes over from the next real
      // intersection change onward.
      this.img.style.display = 'none';
      this.ready = true;
      this.visible = true;
    }
    if (this.ready) this.renderFrame(0);
  };

  BotanicalFlower.prototype.renderFrame = function (t) {
    if (!this.ready || !this.cssW || !this.cssH) return;
    var ctx = this.ctx;
    var w = this.cssW;
    var h = this.cssH;
    var pad = this.swayPadding || 0;
    var strips = this.options.strips || 48;
    var stripH = h / strips;
    var sourceStripH = this.source.height / strips;
    var maxSway = this.options.maxSway || 6;
    var phaseSpread = this.options.phaseSpread || 2.4;
    var speed = this.options.windSpeed || 1;
    var followLag = this.options.followLag || 0.4;
    var time = t * speed + this.phaseOffset;

    if (this.options.particles !== false && pointerCapable && Pointer.active && !reduceMotionQuery.matches) {
      this._checkFloretHover();
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w + pad * 2, h);

    for (var i = 0; i < strips; i++) {
      var tip = i / (strips - 1); // 0 at base (bottom), 1 at tip (top)
      var bend = tip * tip; // base stays near-still, sway grows toward the tip
      var sample = windField(time - tip * phaseSpread);

      // The top of the artwork (flower head / canopy) additionally leans on
      // a delayed copy of the wind, fading in smoothly over the top 30% of
      // the strip range, so it visibly trails the stem instead of moving in
      // lockstep with it — with no separate draw pass, so there is no seam.
      var followWeight = Math.max(0, (tip - 0.7) / 0.3);
      var followSample = followWeight
        ? windField(time - tip * phaseSpread - followLag)
        : 0;
      var offsetX = (sample * bend + followSample * followWeight * 0.5) * maxSway;

      var destY = h - (i + 1) * stripH;
      var srcY = this.source.height - (i + 1) * sourceStripH;

      ctx.drawImage(
        this.displaySource,
        0, srcY, this.source.width, sourceStripH,
        pad + offsetX, destY, w, stripH + 0.5 // +0.5 avoids hairline seams between strips
      );
    }
  };

  // Hit-tests the cursor (in this flower's local space) against each
  // still-attached floret and lifts off the closest one it's actually near.
  // Only one floret triggers per hover pass, but since this runs every
  // rendered frame, a lingering or sweeping cursor peels several off in a
  // natural little stream rather than all at once.
  BotanicalFlower.prototype._checkFloretHover = function () {
    var pointer = this._localPointer();
    if (!pointer) return;
    var now = performance.now();
    var reach = isMobileViewport ? 18 : 22; // fixed CSS-px trigger radius; florets are points, not extended shapes
    for (var i = 0; i < this.florets.length; i++) {
      var floret = this.florets[i];
      if (floret.state !== 'attached' || now < floret.cooldownUntil) continue;
      var fx = floret.fx * this.cssW;
      var fy = floret.fy * this.cssH;
      var dx = fx - pointer.x;
      var dy = fy - pointer.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < reach) {
        this._triggerFloret(floret, pointer, fx, fy);
        break;
      }
    }
  };

  // Fades a small spot out of the working display copy where the floret
  // sat (a soft partial fade, not a hard hole, so the cluster reads as
  // gradually thinning rather than visibly punctured) and spawns a
  // procedurally-drawn seed particle on the shared ParticleField drifting
  // away from the cursor. After a delay the spot is redrawn from the
  // untouched source so the floret regrows and can be triggered again.
  BotanicalFlower.prototype._triggerFloret = function (floret, localPointer, fx, fy) {
    floret.state = 'flying';

    var fadeR = this.source.width * 0.012;
    var dctx = this.displaySource.getContext('2d');
    dctx.save();
    dctx.globalCompositeOperation = 'destination-out';
    dctx.globalAlpha = 0.55;
    dctx.beginPath();
    dctx.arc(floret.cx, floret.cy, fadeR, 0, Math.PI * 2);
    dctx.fill();
    dctx.restore();

    var page = this._localToPage(fx, fy);
    var awayX = fx - localPointer.x;
    var awayY = fy - localPointer.y;
    var awayDist = Math.sqrt(awayX * awayX + awayY * awayY) || 1;
    // Gentle, dandelion-in-the-wind pace — comparable to the main sway,
    // never a fast dart across the screen — with a strong upward bias so
    // it reads as floating/lifting off rather than being flung sideways.
    var speed = 45 + Math.random() * 55;
    var dirX = (awayX / awayDist) * 0.6 + (Math.random() - 0.5) * 0.8;
    var dirY = -0.75 - Math.random() * 0.6; // mostly upward
    var dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;

    ParticleField.spawn({
      x: page.x,
      y: page.y,
      size: 3 + Math.random() * 3,
      color: this.options.tint || COLOR_OLIVE,
      vx: (dirX / dirLen) * speed,
      vy: (dirY / dirLen) * speed,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.4,
      wobbleAmp: 8 + Math.random() * 10,
      wobbleFreq: 0.6 + Math.random() * 0.8,
      wobblePhase: Math.random() * Math.PI * 2,
      age: 0
    });

    var self = this;
    var regrowDelay = 3200 + Math.random() * 1600;
    setTimeout(function () {
      var ctx2 = self.displaySource.getContext('2d');
      var pad = fadeR * 1.3;
      ctx2.save();
      ctx2.beginPath();
      ctx2.arc(floret.cx, floret.cy, fadeR + pad, 0, Math.PI * 2);
      ctx2.clip();
      ctx2.drawImage(self.source, 0, 0);
      ctx2.restore();
      floret.state = 'attached';
      floret.cooldownUntil = performance.now() + 400;
    }, regrowDelay);
  };

  BotanicalFlower.prototype.destroy = function () {
    window.removeEventListener('resize', this._boundResize);
  };

  // Draws one dandelion-seed particle at the origin of the current
  // transform: a small center dot with a handful of thin radiating spokes,
  // like a tiny parachute/pappus. Procedurally drawn every frame — never an
  // image crop — so each particle is a genuine independent visual object.
  function drawSeedParticle(ctx, size, color) {
    var core = size * 0.16;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, core, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, size * 0.045);
    var spokes = 6;
    for (var k = 0; k < spokes; k++) {
      var a = (k / spokes) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * core, Math.sin(a) * core);
      ctx.lineTo(Math.cos(a) * size * 0.5, Math.sin(a) * size * 0.5);
      ctx.stroke();
    }
  }

  /* ---------------------------------------------------------------------
     ParticleField: a single shared, full-viewport overlay canvas that
     renders every currently-drifting seed particle from every flower.
     Created lazily on the first spawn (never on touch devices, since
     nothing ever calls spawn() there) and driven by the same rAF loop as
     the wind animation — see the Engine.start() loop below — rather than a
     second independent loop.
  --------------------------------------------------------------------- */

  var ParticleField = {
    canvas: null,
    ctx: null,
    list: [],
    dpr: 1,
    maxLife: 7, // seconds; a hard cap so a particle that drifts very slowly still cleans up

    ensureCanvas: function () {
      if (this.canvas) return;
      var canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '2147483647';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this._resize();
      var self = this;
      window.addEventListener('resize', function () { self._resize(); });
    },

    _resize: function () {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(window.innerWidth * this.dpr);
      this.canvas.height = Math.round(window.innerHeight * this.dpr);
    },

    spawn: function (particle) {
      this.ensureCanvas();
      this.list.push(particle);
    },

    tick: function (dt) {
      if (!this.list.length) return;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var margin = 120;
      var ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);

      for (var i = this.list.length - 1; i >= 0; i--) {
        var p = this.list[i];
        p.age += dt;
        // A gentle lateral wobble layered on top of the base drift is what
        // keeps this reading as "floating" rather than "flying in a
        // straight line" — closer to how a real seed actually moves.
        var wobble = Math.sin(p.age * p.wobbleFreq + p.wobblePhase) * p.wobbleAmp;
        p.x += (p.vx + wobble) * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotSpeed * dt;

        var offscreen = p.x < -margin || p.x > vw + margin || p.y < -margin || p.y > vh + margin;
        if (offscreen || p.age > this.maxLife) {
          this.list.splice(i, 1);
          continue;
        }

        var fadeIn = Math.min(1, p.age / 0.4);
        var fadeOut = Math.min(1, (this.maxLife - p.age) / 1.2);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        drawSeedParticle(ctx, p.size, p.color);
        ctx.restore();
      }
    }
  };

  /* ---------------------------------------------------------------------
     Engine: one IntersectionObserver + one requestAnimationFrame loop
     shared by every flower on the page, so nothing is rendered while off
     screen and no per-instance rAF calls pile up.
  --------------------------------------------------------------------- */

  var Engine = {
    flowers: [],
    running: false,
    rafId: null,

    add: function (flower) {
      this.flowers.push(flower);
      if (this.observer) this.observer.observe(flower.canvas || flower.img);
    },

    start: function () {
      if (this.running) return;
      this.running = true;
      var self = this;
      var lastNow = null;
      var loop = function (now) {
        if (!self.running) return;
        for (var i = 0; i < self.flowers.length; i++) {
          var f = self.flowers[i];
          if (f.ready && f.visible) f.renderFrame(now / 1000);
        }
        // Drifting particles live on their own overlay canvas, independent
        // of any single flower's visibility, so they're advanced here once
        // per frame in real seconds rather than the flowers' abstract wind
        // time. tick() is a no-op whenever nothing is currently in flight.
        var dt = lastNow === null ? 0 : Math.min(0.05, (now - lastNow) / 1000);
        lastNow = now;
        ParticleField.tick(dt);
        self.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    },

    stop: function () {
      this.running = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
    }
  };

  function setupObserver() {
    if (!('IntersectionObserver' in window)) {
      // No IO support: just mark everything visible and let the loop run.
      Engine.flowers.forEach(function (f) { f.visible = true; });
      return;
    }
    Engine.observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var flower = Engine.flowers.filter(function (f) {
          return f.canvas === entry.target || f.img === entry.target;
        })[0];
        if (flower) flower.visible = entry.isIntersecting;
      });
    }, { rootMargin: '80px' });
  }

  function applyReducedMotion() {
    if (reduceMotionQuery.matches) {
      Engine.stop();
      Engine.flowers.forEach(function (f) {
        if (f.ready) f.renderFrame(0);
      });
    } else {
      Engine.start();
    }
  }

  function initFlower(img, tint, extraOptions) {
    var options = Object.assign(
      {
        tint: tint,
        strips: isMobileViewport ? 48 : 80,
        maxSway: isMobileViewport ? 60 : 90,
        maxDpr: isMobileViewport ? 1.5 : 2
      },
      extraOptions || {}
    );
    var flower = new BotanicalFlower(img, options);
    flower.init();
    Engine.add(flower);
    // The observer needs the canvas element, which only exists after
    // init() inserts it; observe once it's actually in the DOM. Capped so a
    // flower that never becomes ready (e.g. recoloring threw) doesn't leave
    // a silent rAF loop running forever.
    var observeAttempts = 0;
    var tryObserve = function () {
      if (flower.canvas.isConnected && Engine.observer) {
        Engine.observer.observe(flower.canvas);
      } else if (!flower.ready && observeAttempts++ < 240) {
        requestAnimationFrame(tryObserve);
      }
    };
    requestAnimationFrame(tryObserve);
    return flower;
  }

  function boot() {
    try {
      setupObserver();
      setupPointer();

      // Sway amplitudes below are half their original values (60/67.5/52.5/45),
      // requested to tone down the movement range while keeping the same
      // windSpeed/phaseSpread — and therefore the same tempo and organic
      // character — untouched. bend = tip*tip in renderFrame already keeps
      // the base anchored regardless of amplitude, so halving maxSway alone
      // is enough; nothing else needs to change for that to hold.
      var whyUsDecor = document.querySelector('.why-us__decor');
      if (whyUsDecor) initFlower(whyUsDecor, COLOR_OLIVE, { maxSway: 30, phaseSpread: 2.1, windSpeed: 1.16 });

      // About page's story section decor — Figma shows it as a plain static
      // low-opacity image, but reuses the exact same cornflower-branch
      // asset already driving Testimonials' animated version, so it gets
      // the same treatment here rather than staying an inert <img> (see
      // CHANGELOG.md).
      var aboutStoryDecor = document.querySelector('.about-story__decor');
      if (aboutStoryDecor) initFlower(aboutStoryDecor, COLOR_OLIVE, { maxSway: 33.75, phaseSpread: 2.6, windSpeed: 1.35 });

      if (!TEST_SINGLE_FLOWER) {
        var testimonialsDecor = document.querySelector('.testimonials__decor');
        if (testimonialsDecor) initFlower(testimonialsDecor, COLOR_OLIVE, { maxSway: 33.75, phaseSpread: 2.6, windSpeed: 1.35 });

        var footerFlowers = document.querySelectorAll('.site-footer__decor-flower');
        footerFlowers.forEach(function (el, i) {
          initFlower(el, COLOR_CREAM, { maxSway: 26.25, phaseSpread: 2.2 + i * 0.3, windSpeed: 1.10 + i * 0.19, centered: true });
        });

        var footerMobileDecor = document.querySelector('.site-footer__mobile-decor');
        if (footerMobileDecor) initFlower(footerMobileDecor, COLOR_CREAM, { maxSway: 22.5, phaseSpread: 2, windSpeed: 1.16 });
      }

      if (reduceMotionQuery.matches) {
        // Flowers will paint one static frame each as soon as they're ready
        // (see BotanicalFlower.init) and the shared loop never starts.
      } else {
        Engine.start();
      }

      if (reduceMotionQuery.addEventListener) {
        reduceMotionQuery.addEventListener('change', applyReducedMotion);
      }
    } catch (err) {
      // Any failure here leaves the original <img> elements untouched and
      // the rest of the site unaffected.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
