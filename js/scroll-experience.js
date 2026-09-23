/*
  Cinematic scroll experience: Lenis smooth scroll + GSAP ScrollTrigger,
  driving a bespoke, per-section animation timeline rather than one generic
  "fade everything up" effect. See individual setup*() functions below —
  each section gets its own hand-tuned composition, sharing two repeated
  visual signatures (a masked line-reveal for headings, a directional
  clip-path wipe for card grids) so the site reads as one animation
  language rather than a pile of one-off effects.

  This file is intentionally separate from main.js (nav/carousel/forms) and
  botanical-animation.js (the wind + dandelion-particle system on the
  decorative flowers). It never touches their DOM/CSS state directly; where
  it does move a flower (Why-Us, Testimonials), it targets the <canvas>
  botanical-animation.js itself paints into and only ever adds a transform,
  which coexists with that canvas's own per-frame 2D redraw and pointer
  handling without conflict (verified: the canvas keeps redrawing its wind
  bend and the floret hover interaction keeps working under the added
  transform).

  Progressive enhancement throughout: if GSAP/ScrollTrigger failed to load,
  or the user prefers reduced motion, this does nothing and every element
  renders in its plain, fully-visible HTML/CSS state. SplitText is an
  optional extra — if it failed to load, heading reveals quietly fall back
  to a simpler fade+rise instead of breaking.
*/

(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Desktop-vs-mobile choreography is a device-class decision (pinned,
  // multi-stage sequences only make sense with a mouse-wheel/trackpad and
  // real vertical scroll runway), read once at boot rather than kept live
  // across resizes — the same precedent botanical-animation.js already
  // sets with its own isMobileViewport flag.
  var isDesktop = window.innerWidth >= 1024;
  // The fixed .site-header's height, for triggers that should start just
  // below it (hero fade, Services format stage centre). The pinned
  // sections do NOT use it: the header hides on scroll down (main.js), so
  // they pin flush at 'top top'. Measured live once (same precedent as
  // isDesktop) rather than duplicating the --header-height-* px values
  // from variables.css as a second hardcoded source of truth.
  var headerHeightPx = (function () {
    var header = document.querySelector('.site-header');
    return header ? Math.ceil(header.getBoundingClientRect().height) : 0;
  })();

  function boot() {
    if (reduceMotion) return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);
    var hasSplit = typeof SplitText !== 'undefined';
    if (hasSplit) gsap.registerPlugin(SplitText);

    // The site's .u-br-desktop/.u-br-mobile utility classes hide a forced
    // <br> at the "wrong" breakpoint via plain CSS (display:none) so the
    // SAME markup can carry a different editorial line break per
    // breakpoint. SplitText's line-detection, however, treats every <br>
    // element in the DOM as a hard boundary regardless of its computed
    // display — so a display:none break for the CURRENT breakpoint still
    // forces an extra line split there, invisibly to CSS but very visibly
    // once SplitText masks each "line" into its own block. Removing the
    // breakpoint-inapplicable <br>s from the DOM entirely (not just
    // hiding them) before any splitLines() call fixes this at the root,
    // for every heading that uses the pattern, rather than working around
    // it per instance. isDesktop is fixed at boot (not reactive to
    // resize) the same way the rest of this file already treats it.
    document.querySelectorAll(isDesktop ? 'br.u-br-mobile' : 'br.u-br-desktop').forEach(function (br) {
      br.remove();
    });

    var lenis = setupLenis();

    /* ---------------------------------------------------------------------
       Shared visual signatures
    --------------------------------------------------------------------- */

    // Heading signature: split into lines, each line masked and pushed
    // below its own mask, then risen into place. Reused everywhere a
    // heading reveals, at different tempos, so headings share one legible
    // "move" across the whole site instead of everyone doing their own
    // thing. Falls back to a plain fade+rise if SplitText didn't load.
    function splitLines(el) {
      if (!hasSplit || !el) return null;
      try {
        // Captured from a detached clone of the PRE-split markup, while its
        // forced <br> line breaks still exist as real elements to replace
        // with a joining space (must happen before SplitText.create below
        // rewrites el's own DOM into line wrappers with no <br> left in it).
        var clone = el.cloneNode(true);
        clone.querySelectorAll('br').forEach(function (br) { br.replaceWith(' '); });
        var label = clone.textContent.replace(/\s+/g, ' ').trim();

        var split = SplitText.create(el, { type: 'lines', mask: 'lines' });
        // SplitText marks every line wrapper aria-hidden and sets its own
        // aria-label on el so a screen reader doesn't read the fragmented
        // lines as separate items — but for a forced <br> line break, it
        // joins line text with no space at the break (e.g. "Voloshyn" +
        // "— кейтеринг" -> "Voloshyn— кейтеринг"). Overwrite it with the
        // properly space-joined version captured above.
        el.setAttribute('aria-label', label);
        return split;
      } catch (err) {
        return null;
      }
    }

    // Headings split via SplitText (see splitLines above) get their
    // line-wrapper elements' text-align baked in as an inline style at
    // split time, reflecting whatever the heading's CSS text-align
    // resolves to AT THAT MOMENT. Elements like `.portfolio-carousel
    // .section-heading--center` deliberately resolve to a DIFFERENT
    // text-align at mobile (left) vs desktop (center, see
    // components.css) — so a real resize across the 1024px breakpoint,
    // with no full page reload in between, leaves that inline value
    // stuck at whichever breakpoint the split first ran at: the heading
    // visibly detaches from the rest of its (correctly responsive)
    // section, reading as "shifted"/off-center against its own button or
    // container. Tracked here so the resize handler below can correct
    // just the alignment, without touching line-break points, the
    // reveal animation, or its ScrollTrigger — see that handler for why
    // line-break points are deliberately left alone.
    var splitHeadings = [];

    function revealHeadingOnEnter(el, opts) {
      if (!el) return;
      opts = opts || {};
      var split = splitLines(el);
      if (split && split.lines.length) {
        splitHeadings.push({ el: el, split: split });
        gsap.set(split.lines, { yPercent: 115, opacity: 0 });
        gsap.to(split.lines, {
          yPercent: 0,
          opacity: 1,
          duration: opts.duration || 1,
          ease: 'power4.out',
          stagger: opts.stagger || 0.09,
          scrollTrigger: { trigger: el, start: opts.start || 'top 85%', toggleActions: 'play none none none' }
        });
      } else {
        gsap.from(el, {
          y: 26,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          clearProps: 'transform',
          scrollTrigger: { trigger: el, start: opts.start || 'top 87%', toggleActions: 'play none none none' }
        });
      }
    }

    // Corrects the stuck-inline-text-align bug described above whenever a
    // resize actually crosses the 1024px breakpoint (debounced; ignores
    // resizes that stay within the same breakpoint, since text-align
    // never changes there). Deliberately does NOT revert/re-run
    // SplitText itself — this project fixes isDesktop-dependent <br>
    // line-break points once at boot only (see the u-br-desktop/
    // u-br-mobile removal above), by established precedent, so
    // re-splitting live would fight that and risk replaying/duplicating
    // each heading's one-time scroll-reveal tween. Just re-pointing each
    // already-split line's own text-align at its current, correctly
    // responsive CSS value is enough to fix the visual symptom (a
    // heading detached from its section) without touching any of that.
    var lastIsDesktop = window.matchMedia('(min-width: 1024px)').matches;
    var alignResizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(alignResizeTimer);
      alignResizeTimer = setTimeout(function () {
        var nowDesktop = window.matchMedia('(min-width: 1024px)').matches;
        if (nowDesktop === lastIsDesktop) return;
        lastIsDesktop = nowDesktop;
        splitHeadings.forEach(function (entry) {
          var align = getComputedStyle(entry.el).textAlign;
          (entry.split.lines || []).forEach(function (line) {
            line.style.textAlign = align;
            if (line.parentNode) line.parentNode.style.textAlign = align;
          });
        });
      }, 200);
    });

    // Calm signature for paragraphs/buttons/small lede+button rows —
    // deliberately restrained so it doesn't compete with the heading move
    // or the card wipes. clearProps:'transform' removes the inline
    // transform GSAP leaves behind once each one-time reveal finishes —
    // otherwise that inline style permanently outranks any CSS
    // `:hover { transform: ... }` on the same element (an inline style
    // always wins over a class rule, hover or not), which is exactly what
    // silently blocked the button hover lift from ever showing on a
    // button that had already played its scroll-reveal.
    function revealText(el, delay, opts) {
      if (!el) return;
      opts = opts || {};
      gsap.from(el, {
        y: 14,
        opacity: 0,
        duration: 0.7,
        delay: delay || 0,
        ease: 'power2.out',
        clearProps: 'transform',
        scrollTrigger: { trigger: el, start: opts.start || 'top 88%', toggleActions: 'play none none none' }
      });
    }

    function revealGentleGroup(container) {
      if (!container) return;
      var kids = Array.prototype.slice.call(container.children);
      if (!kids.length) return;
      gsap.from(kids, {
        y: 14,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.07,
        clearProps: 'transform',
        scrollTrigger: { trigger: container, start: 'top 88%', toggleActions: 'play none none none' }
      });
    }

    // Card-grid signature: each card wipes in from a different edge via
    // clip-path (not a fade), with a small alternating tilt that settles
    // flat — an assembling composition rather than a simultaneous fade.
    function clipFrom(dir) {
      if (dir === 'left') return 'inset(0% 100% 0% 0%)';
      if (dir === 'right') return 'inset(0% 0% 0% 100%)';
      if (dir === 'top') return 'inset(0% 0% 100% 0%)';
      return 'inset(100% 0% 0% 0%)'; // bottom
    }

    function revealCards(container, opts) {
      if (!container) return;
      revealCardList(Array.prototype.slice.call(container.children), container, opts);
    }

    // Takes an explicit card list rather than always reading a container's
    // children — the portfolio track (see setupPortfolio) clones its cards
    // several times over for the infinite-loop slider, and only the real,
    // non-decorative set should ever play this one-time entrance; running
    // it across every clone too would apply a scale/rotate transform to
    // buffer cards the drag geometry depends on measuring accurately.
    function revealCardList(cards, triggerEl, opts) {
      if (!cards || !cards.length) return;
      opts = opts || {};
      var dirs = opts.dirs || ['bottom', 'left', 'right', 'top'];

      cards.forEach(function (card, i) {
        gsap.set(card, {
          clipPath: clipFrom(dirs[i % dirs.length]),
          rotate: i % 2 === 0 ? -1.5 : 1.5,
          scale: 0.94
        });
      });

      gsap.to(cards, {
        clipPath: 'inset(0% 0% 0% 0%)',
        rotate: 0,
        scale: 1,
        duration: 0.9,
        ease: 'power3.out',
        stagger: opts.stagger || 0.12,
        clearProps: 'transform',
        scrollTrigger: { trigger: triggerEl || cards[0], start: 'top 85%', toggleActions: 'play none none none' }
      });
    }

    // Resolves the actual on-screen target for a flower <img> that
    // botanical-animation.js may have hidden and replaced with a <canvas>
    // (same class, inserted immediately after) to do its own wind-bend
    // rendering. Keys off the same img.complete/'load' gate that script
    // uses internally, since its script tag runs first and always wins
    // that race; the extra double-rAF just lets its own resize/insert
    // pass finish before we decide.
    function resolveFlowerTarget(img, cb) {
      if (!img) return;
      function decide() {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            var sibling = img.nextElementSibling;
            cb(sibling && sibling.tagName === 'CANVAS' ? sibling : img);
          });
        });
      }
      if (img.complete && img.naturalWidth) decide();
      else img.addEventListener('load', decide, { once: true });
    }

    /* ---------------------------------------------------------------------
       Section builders — each section gets exactly the treatment its
       place in the visual hierarchy calls for: hero/why-us/cta-banner are
       the pinned, cinematic "storytelling" moments; the rest get the
       shared heading/card signatures at normal tempo; quick-contact stays
       calm on purpose so the pinned sections keep their impact.
    --------------------------------------------------------------------- */

    // Runs first, deliberately: it measures each .btn--secondary's own
    // text via getBoundingClientRect(), which reports POST-transform
    // coordinates. Several sections below give their content an
    // immediateRender scroll-reveal — a transform/opacity applied
    // synchronously at setup time, before the user ever scrolls there —
    // and GSAP's default transform-origin (the element's own center, not
    // its corner) can displace a nested button and its text by different,
    // seemingly nonsensical amounts once that's active. Measuring before
    // any of that exists avoids the problem entirely rather than trying
    // to detect or wait it out.
    setupSecondaryButtonSnake();

    setupHero();
    setupServices();
    setupServiceDetails();
    setupProcessSteps();
    setupMenu();
    setupMenuCategories();
    setupWhyUs();
    setupCtaBanner();
    setupAboutTeaser();
    setupAboutStory();
    setupTeamSection();
    setupStatsBand();
    setupPullQuote();
    setupPhotoStrip();
    setupPortfolio();
    setupPortfolioGallery();
    setupPhotoViewerFx();
    setupMenuNavIndicator();
    setupTestimonials();
    setupQuickContact();
    setupContacts();

    window.addEventListener('load', function () {
      ScrollTrigger.refresh();
    });

    // main.js (which can't touch ScrollTrigger — it loads before GSAP)
    // fires this whenever it changes page height at runtime, e.g.
    // Portfolio's category filter adding/removing whole desktop grid rows.
    // Without a refresh every trigger below it (the pinned CTA banner) keeps
    // its stale start/end — switching to "Усі" left the CTA starting ~900px
    // too early, followed by an empty pin-spacer stretch.
    window.addEventListener('veranda:layoutchange', function () {
      ScrollTrigger.refresh();
    });

    if (lenis) window.__lenis = lenis;

    /* ----------------------- Hero (pinned, cinematic) ------------------- */

    function setupHero() {
      var hero = document.querySelector('[data-hero]');
      var mediaWrap = document.querySelector('[data-hero-media]');
      var mediaImg = mediaWrap ? mediaWrap.querySelector('img') : null;
      var content = document.querySelector('[data-hero-content]');
      var title = document.getElementById('hero-title');
      var meta = hero ? hero.querySelector('.hero__meta') : null;
      // Heroes with [data-hero-reveal="<shape>"] open from a catering-
      // themed silhouette (setupHeroReveal) instead of the plain scale-down.
      var revealShape = mediaWrap ? mediaWrap.getAttribute('data-hero-reveal') : null;
      var frameHero = !!revealShape;
      if (!hero || !content || !mediaImg || !title) return;

      var split = splitLines(title);
      var titleTargets = split && split.lines.length ? split.lines : [title];

      if (split && split.lines.length) gsap.set(titleTargets, { yPercent: 115, opacity: 0 });
      else gsap.set(titleTargets, { y: 24, opacity: 0 });
      if (meta) gsap.set(meta, { y: 20, opacity: 0 });
      if (!frameHero) gsap.set(mediaImg, { scale: 1.12 });

      // On-load entrance — above the fold, so this plays immediately
      // rather than waiting on a scroll trigger. A shape reveal holds it
      // until the photo is decoded and lands the text as the shape
      // finishes opening to full screen.
      var introTl = gsap.timeline({ delay: 0.15, paused: frameHero });
      introTl.to(titleTargets, {
        yPercent: split && split.lines.length ? 0 : undefined,
        y: split && split.lines.length ? undefined : 0,
        opacity: 1,
        duration: 1.1,
        ease: 'power4.out',
        stagger: 0.08
      });
      if (meta) introTl.to(meta, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }, '-=0.75');
      if (!frameHero) introTl.to(mediaImg, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0);
      else setupHeroReveal(hero, mediaWrap, mediaImg, revealShape, function () { introTl.delay(2.0).restart(true); });

      // Text clears away as the hero scrolls past — meta first/fastest
      // (closest layer), heading right after through its own line-masks —
      // same feel as the old pinned "camera pull-back," but scrub-linked to
      // NATURAL scroll (no pin, no scroll-jacking) and with no clip-path
      // frame-shrink on the photo: the removed square-shrink stays removed,
      // only the text-disappearing part came back. `end:'bottom top'` spans
      // exactly the hero's own height, so the fade finishes well before the
      // hero has fully scrolled away rather than lingering half-visible.
      if (meta) gsap.set(meta, { willChange: 'transform' });
      gsap.set(titleTargets, { willChange: 'transform' });

      // Built only once the intro has FINISHED. A scrubbed timeline records
      // its start values the first time it renders — if the visitor
      // scrolled before the text had appeared (easy: with a shape reveal
      // the intro starts ~2s in), it recorded the hidden intro state, and
      // scrolling back to the top restored exactly that: an empty hero
      // (bug report, every page). Created afterwards, its start is always
      // the visible text; if the page is already scrolled by then, scrub:1
      // simply eases the text out to match.
      function buildFadeOut() {
        var fadeOutTl = gsap.timeline({
          scrollTrigger: { trigger: hero, start: 'top ' + headerHeightPx + 'px', end: 'bottom top', scrub: 1 }
        });
        if (meta) fadeOutTl.to(meta, { x: 70, opacity: 0, duration: 0.26, ease: 'power2.in' }, 0);
        fadeOutTl.to(titleTargets, {
            yPercent: split && split.lines.length ? -130 : undefined,
            y: split && split.lines.length ? undefined : -60,
            opacity: 0,
            duration: 0.36,
            stagger: 0.05,
            ease: 'power2.in'
          }, 0.06);
      }
      introTl.eventCallback('onComplete', buildFadeOut);
    }

    /* ----------------------- Hero shape reveal (every page) ------------- */

    // Each page's hero is revealed through a catering-themed silhouette,
    // a different one per page ([data-hero-reveal="<shape>"] on
    // .hero__media): the photo first appears inside the shape in the
    // middle of the screen, holds for a beat, then the shape grows past
    // the hero's edges until the photo fills it, while the photo inside
    // settles from a slight zoom — a camera pulling back through the
    // opening. On load only: the old scroll-linked "frame closes" effect
    // stays removed (CHANGELOG).
    //
    // Shapes are clip-path: path() rebuilt in px every frame from the
    // unit-space outlines below (y down), so they scale with no raster
    // mask. Every sub-path winds CLOCKWISE, so under the default nonzero
    // rule overlapping parts merge into one silhouette. `box` is the
    // outline's bounds (for the resting size/centring) and `anchor` a
    // point deep inside its largest body: it stays put while the shape
    // grows, and the hero must fit inside the shape around it at the end.
    // A function (hoisted), not a var: setupHero() runs before this part
    // of boot() is reached, when a var would still be undefined.
    function heroShapes() {
      function rect(P, x0, y0, x1, y1) {
        return ' M' + P(x0, y0) + ' L' + P(x1, y0) + ' L' + P(x1, y1) + ' L' + P(x0, y1) + ' Z';
      }
      // Four cubic Béziers (k = 0.5523), clockwise from the left point —
      // NOT two SVG arcs. Half-circle arcs rebuilt every frame from
      // separately rounded endpoints/radius kept flipping between the two
      // possible arc solutions, so circle-heavy shapes (Menu's plate,
      // About's toque) visibly twitched while scaling (bug report).
      function ellipse(P, R, cx, cy, rx, ry) {
        var kx = rx * 0.5523, ky = ry * 0.5523;
        return ' M' + P(cx - rx, cy) +
          ' C' + P(cx - rx, cy - ky) + ' ' + P(cx - kx, cy - ry) + ' ' + P(cx, cy - ry) +
          ' C' + P(cx + kx, cy - ry) + ' ' + P(cx + rx, cy - ky) + ' ' + P(cx + rx, cy) +
          ' C' + P(cx + rx, cy + ky) + ' ' + P(cx + kx, cy + ry) + ' ' + P(cx, cy + ry) +
          ' C' + P(cx - kx, cy + ry) + ' ' + P(cx - rx, cy + ky) + ' ' + P(cx - rx, cy) + ' Z';
      }
      // bar with softly rounded ends (tray rims, cake plate)
      function bar(P, x0, y0, x1, y1) {
        var r = (y1 - y0) / 2, m = (y0 + y1) / 2;
        return ' M' + P(x0 + r, y0) + ' L' + P(x1 - r, y0) + ' Q' + P(x1, y0) + ' ' + P(x1, m) +
          ' Q' + P(x1, y1) + ' ' + P(x1 - r, y1) + ' L' + P(x0 + r, y1) +
          ' Q' + P(x0, y1) + ' ' + P(x0, m) + ' Q' + P(x0, y0) + ' ' + P(x0 + r, y0) + ' Z';
      }
      return {
        // Home — serving cloche: dome, knob, tray rim
        cloche: {
          box: [-0.72, -0.52, 0.72, 0.345], anchor: [0, 0.1],
          path: function (P, R) {
            return 'M' + P(-0.62, 0.28) + ' C' + P(-0.62, -0.12) + ' ' + P(-0.34, -0.4) + ' ' + P(0, -0.4) +
              ' C' + P(0.34, -0.4) + ' ' + P(0.62, -0.12) + ' ' + P(0.62, 0.28) + ' Z' +
              rect(P, -0.022, -0.44, 0.022, -0.38) +
              ellipse(P, R, 0, -0.47, 0.075, 0.05) +
              bar(P, -0.72, 0.28, 0.72, 0.345);
          }
        },
        // Services — wine glass: bowl, stem, foot
        glass: {
          box: [-0.34, -0.45, 0.34, 0.435], anchor: [0, -0.24],
          path: function (P, R) {
            return 'M' + P(-0.32, -0.45) + ' L' + P(0.32, -0.45) +
              ' C' + P(0.345, -0.15) + ' ' + P(0.25, 0.08) + ' ' + P(0, 0.1) +
              ' C' + P(-0.25, 0.08) + ' ' + P(-0.345, -0.15) + ' ' + P(-0.32, -0.45) + ' Z' +
              rect(P, -0.024, 0.08, 0.024, 0.39) +
              ellipse(P, R, 0, 0.4, 0.2, 0.035);
          }
        },
        // Menu — plate between a fork and a knife
        plate: {
          box: [-0.68, -0.42, 0.665, 0.42], anchor: [0, 0],
          path: function (P, R) {
            return ellipse(P, R, 0, 0, 0.4, 0.4) +
              // fork: three tines, head, neck, handle
              rect(P, -0.68, -0.42, -0.66, -0.2) + rect(P, -0.63, -0.42, -0.61, -0.2) +
              rect(P, -0.58, -0.42, -0.56, -0.2) +
              ' M' + P(-0.68, -0.22) + ' L' + P(-0.56, -0.22) + ' Q' + P(-0.56, -0.12) + ' ' + P(-0.598, -0.1) +
              ' L' + P(-0.642, -0.1) + ' Q' + P(-0.68, -0.12) + ' ' + P(-0.68, -0.22) + ' Z' +
              ' M' + P(-0.644, -0.12) + ' L' + P(-0.596, -0.12) + ' L' + P(-0.592, 0.4) +
              ' Q' + P(-0.62, 0.43) + ' ' + P(-0.648, 0.4) + ' Z' +
              // knife: curved blade, handle
              ' M' + P(0.595, -0.42) + ' C' + P(0.66, -0.38) + ' ' + P(0.665, -0.2) + ' ' + P(0.645, -0.02) +
              ' L' + P(0.595, -0.02) + ' Z' +
              ' M' + P(0.59, -0.04) + ' L' + P(0.65, -0.04) + ' L' + P(0.648, 0.4) +
              ' Q' + P(0.62, 0.43) + ' ' + P(0.592, 0.4) + ' Z';
          }
        },
        // About — chef's toque: three puffs over a band
        toque: {
          box: [-0.44, -0.46, 0.44, 0.35], anchor: [0, -0.05],
          path: function (P, R) {
            return ellipse(P, R, -0.24, -0.08, 0.2, 0.2) +
              ellipse(P, R, 0.24, -0.08, 0.2, 0.2) +
              ellipse(P, R, 0, -0.2, 0.26, 0.26) +
              rect(P, -0.3, -0.12, 0.3, 0.1) +
              ' M' + P(-0.3, 0.05) + ' L' + P(0.3, 0.05) + ' L' + P(0.3, 0.33) +
              ' Q' + P(0.3, 0.35) + ' ' + P(0.28, 0.35) + ' L' + P(-0.28, 0.35) +
              ' Q' + P(-0.3, 0.35) + ' ' + P(-0.3, 0.33) + ' Z';
          }
        },
        // Portfolio — two-tier celebration cake with a candle
        cake: {
          box: [-0.55, -0.52, 0.55, 0.39], anchor: [0, 0.1],
          path: function (P, R) {
            return 'M' + P(0, -0.52) + ' C' + P(0.04, -0.46) + ' ' + P(0.045, -0.41) + ' ' + P(0, -0.4) +
              ' C' + P(-0.045, -0.41) + ' ' + P(-0.04, -0.46) + ' ' + P(0, -0.52) + ' Z' +
              rect(P, -0.02, -0.38, 0.02, -0.19) +
              ' M' + P(-0.3, -0.18) + ' Q' + P(-0.3, -0.2) + ' ' + P(-0.28, -0.2) + ' L' + P(0.28, -0.2) +
              ' Q' + P(0.3, -0.2) + ' ' + P(0.3, -0.18) + ' L' + P(0.3, 0.07) + ' L' + P(-0.3, 0.07) + ' Z' +
              ' M' + P(-0.45, 0.08) + ' Q' + P(-0.45, 0.05) + ' ' + P(-0.42, 0.05) + ' L' + P(0.42, 0.05) +
              ' Q' + P(0.45, 0.05) + ' ' + P(0.45, 0.08) + ' L' + P(0.45, 0.35) + ' L' + P(-0.45, 0.35) + ' Z' +
              bar(P, -0.55, 0.34, 0.55, 0.39);
          }
        }
      };
    }

    function setupHeroReveal(hero, wrap, img, shapeName, onReady) {
      var shapes = heroShapes();
      var shape = shapes[shapeName] || shapes.cloche;
      var bw = shape.box[2] - shape.box[0], bh = shape.box[3] - shape.box[1];
      var bcx = (shape.box[0] + shape.box[2]) / 2, bcy = (shape.box[1] + shape.box[3]) / 2;
      var W = 0, H = 0, s0 = 0, ax = 0, ay = 0;
      var st = { s: 0, t: 0 };   // s: size of the resting shape (px/unit); t: growth 0..1

      function measure() {
        W = wrap.offsetWidth;
        H = wrap.offsetHeight;
        s0 = isDesktop
          ? Math.min(0.58 * H / bh, 0.7 * W / bw)
          : Math.min(0.5 * H / bh, 0.86 * W / bw);
        // shape bounds centred, slightly above the middle; the anchor's
        // screen position follows from that
        ax = W / 2 + (shape.anchor[0] - bcx) * s0;
        ay = H * 0.47 + (shape.anchor[1] - bcy) * s0;
      }
      function apply() {
        // exponential growth reads as one steady push in; at t=1 the shape
        // is 8x the hero's larger side, so the hero sits well inside the
        // body around the anchor
        var s = st.s * Math.pow(8 * Math.max(W, H) / s0, st.t);
        var cx = ax - shape.anchor[0] * s, cy = ay - shape.anchor[1] * s;
        // 2 decimals: coarser rounding made thin parts (fork tines) shimmer
        var P = function (x, y) { return (cx + x * s).toFixed(2) + ' ' + (cy + y * s).toFixed(2); };
        var R = function (r) { return (r * s).toFixed(2); };
        wrap.style.clipPath = 'path(\'' + shape.path(P, R).trim() + '\')';
      }

      measure();
      st.s = s0 * 0.86;
      apply();
      gsap.set(wrap, { opacity: 0 });
      gsap.set(img, { scale: 1.3, transformOrigin: '50% 60%' });
      window.addEventListener('resize', function () { if (wrap.style.clipPath) { measure(); apply(); } });

      function play() {
        var tl = gsap.timeline({
          onComplete: function () { wrap.style.clipPath = ''; }
        });
        tl.to(wrap, { opacity: 1, duration: 0.7, ease: 'power2.out' }, 0)
          .to(st, { s: s0, duration: 1.0, ease: 'power3.out', onUpdate: apply }, 0)
          .to(st, { t: 1, duration: 1.5, ease: 'power2.inOut', onUpdate: apply }, 1.2)
          .to(img, { scale: 1, duration: 2.7, ease: 'power2.inOut' }, 0);
        if (onReady) onReady();
      }

      // The source photo can be large — wait until it's decoded so the
      // shape never opens onto an empty box, but never longer than 2.5s.
      // After a page reload the brand curtain (base.css) covers the first
      // ~0.7s, so the reveal waits for it instead of playing unseen.
      var extraDelay = document.documentElement.classList.contains('is-reloading') ? 700 : 0;
      var ready = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
      var started = false;
      function go() { if (!started) { started = true; window.setTimeout(play, extraDelay); } }
      ready.then(go);
      window.setTimeout(go, 2500);
    }

    /* ----------------------- Services (richer, unpinned) ---------------- */

    function setupServices() {
      var heading = document.getElementById('services-heading');
      var headingBlock = heading ? heading.closest('.section-heading') : null;
      var row = headingBlock ? headingBlock.querySelector('.section-heading__row') : null;
      var index = document.querySelector('[data-carousel-index]');
      var panel = document.querySelector('[data-carousel-slide]');
      var media = panel ? panel.querySelector('.service-panel__media') : null;
      var img = media ? media.querySelector('img') : null;
      var body = panel ? panel.querySelector('.service-panel__body') : null;
      // Individual content pieces, not .service-panel__body itself — the
      // existing prev/next slide switch (main.js) toggles opacity on
      // .service-panel__body directly via its .is-transitioning class, so
      // animating that exact element's opacity here would leave a
      // competing inline value behind and break that transition. Animating
      // its children instead reveals the same content without touching
      // the property the slide switch depends on.
      var contentPieces = body ? [
        body.querySelector('.service-panel__title'),
        body.querySelector('.service-panel__desc'),
        body.querySelector('.service-panel__tags'),
        body.querySelector('.service-panel__actions')
      ].filter(Boolean) : [];

      revealHeadingOnEnter(heading);
      revealGentleGroup(row);

      if (index) {
        gsap.from(index, {
          opacity: 0,
          x: -16,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: { trigger: index, start: 'top 90%', toggleActions: 'play none none none' }
        });
      }

      // The panel arrives as one composed object first — a slight lift and
      // settle — a beat before its own image and text reveal inside it, so
      // the slider reads as staged, layered depth rather than a plain box
      // that happens to fade its contents in all at once.
      if (panel) {
        gsap.from(panel, {
          y: 46,
          scale: 0.97,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: panel, start: 'top 85%', toggleActions: 'play none none none' }
        });
      }

      if (media && img) {
        gsap.set(media, { clipPath: 'inset(0% 0% 0% 100%)' });
        gsap.set(img, { scale: 1.15 });
        gsap.timeline({
          scrollTrigger: { trigger: panel, start: 'top 82%', toggleActions: 'play none none none' }
        })
          .to(media, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power3.inOut' }, 0)
          .to(img, { scale: 1, duration: 1.2, ease: 'power2.out' }, 0);
      }

      if (contentPieces.length) {
        // Content reveals in sequence — title, then description, then tags
        // and actions — arriving just behind the image's own reveal.
        gsap.from(contentPieces, {
          y: 22,
          opacity: 0,
          duration: 0.7,
          delay: 0.15,
          ease: 'power2.out',
          stagger: 0.12,
          scrollTrigger: { trigger: panel, start: 'top 82%', toggleActions: 'play none none none' }
        });
      }

      // Slide-to-slide transition (invoked by main.js's goTo(), which owns
      // the carousel's data/state/controls — this only owns HOW a change
      // is staged visually). Replaces the old plain opacity+scale cross-
      // fade with a directional, layered wipe: the outgoing composition
      // clips away and drifts toward the direction of travel while the
      // image pushes in, a beat of content-swap happens out of sight
      // (image mid-fade, so the invisible jump-cut in main.js's render()
      // never shows), then the incoming composition arrives from the
      // opposite edge and settles — "one composition transforming into
      // another" rather than a hard swap. main.js falls back to its own
      // simple CSS cross-fade if this was never assigned (GSAP failed to
      // load) or reduced-motion disabled this file's boot() entirely.
      if (panel && media && img) {
        var activeTransition = null;
        window.__servicePanelTransition = function (applyContent, direction) {
          if (activeTransition) activeTransition.kill();
          var dir = direction >= 0 ? 1 : -1;
          var exitClip = dir > 0 ? 'inset(0% 0% 0% 38%)' : 'inset(0% 38% 0% 0%)';
          var enterClipStart = dir > 0 ? 'inset(0% 38% 0% 0%)' : 'inset(0% 0% 0% 38%)';

          activeTransition = gsap.timeline({ onComplete: function () { activeTransition = null; } })
            .to(img, { scale: 1.1, duration: 0.32, ease: 'power2.in' }, 0)
            .to(media, { clipPath: exitClip, opacity: 0.08, duration: 0.32, ease: 'power2.in' }, 0)
            .to(contentPieces, { x: dir > 0 ? -16 : 16, opacity: 0, duration: 0.24, stagger: 0.02, ease: 'power2.in' }, 0)
            .call(applyContent)
            .set(media, { clipPath: enterClipStart, opacity: 0.08 })
            .set(img, { scale: 1.14 })
            .set(contentPieces, { x: dir > 0 ? 16 : -16, opacity: 0 })
            .to(media, { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, duration: 0.5, ease: 'power3.out' })
            .to(img, { scale: 1, duration: 0.5, ease: 'power2.out' }, '<')
            .to(contentPieces, { x: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' }, '<0.05');
        };
      }
    }

    /* ----------------------- Services page: format rows ------------------ */

    // No-ops on any page without a .service-detail-list (e.g. Home) — same
    // guard pattern every other setup*() in this shared file already uses.
    function setupServiceDetails() {
      var list = document.querySelector('.service-detail-list');
      if (!list) return;
      var rows = Array.prototype.slice.call(list.querySelectorAll('.service-detail'));
      // Mobile keeps the stacked rows (no side-by-side column to pin).
      if (!isDesktop || rows.length < 2) {
        revealCards(list, { dirs: ['left', 'right', 'left', 'right'] });
        return;
      }
      setupFormatScrolly(list, rows);
    }

    // Desktop scrollytelling: one sticky photo stage (layout.css,
    // .service-detail-list--scrolly) whose photo follows whichever format
    // description is at the viewport's centre. The stage is built from the
    // rows' own <img>s, so the markup stays one self-contained card per
    // format (and the non-JS / reduced-motion layout is untouched).
    function setupFormatScrolly(list, rows) {
      var sources = rows.map(function (row) { return row.querySelector('.service-detail__media img'); });
      if (sources.some(function (img) { return !img; })) {
        revealCards(list, { dirs: ['left', 'right', 'left', 'right'] });
        return;
      }

      var stage = document.createElement('div');
      stage.className = 'service-stage';
      var imgs = sources.map(function (src, i) {
        var img = document.createElement('img');
        img.className = 'service-stage__img';
        img.src = src.currentSrc || src.src;
        img.alt = src.alt;
        img.decoding = 'async';
        gsap.set(img, { zIndex: i === 0 ? 2 : 0, visibility: i === 0 ? 'visible' : 'hidden' });
        stage.appendChild(img);
        return img;
      });

      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var index = document.createElement('p');
      index.className = 'service-stage__index';
      index.setAttribute('aria-hidden', 'true');
      index.innerHTML = '<span class="service-stage__index-mask"><span class="service-stage__index-current">01</span></span>' +
        '<span class="service-stage__index-total">/ ' + pad(rows.length) + '</span>';
      stage.appendChild(index);
      var current = index.querySelector('.service-stage__index-current');

      list.insertBefore(stage, list.firstChild);
      list.classList.add('service-detail-list--scrolly');
      rows[0].classList.add('is-active');

      // Stage height = description height (layout.css). Measured from the
      // bodies' natural heights (their min-height released first) and
      // given back to all of them, so every body and the photo match.
      var bodies = rows.map(function (row) { return row.querySelector('.service-detail__body'); });
      function measureBodies() {
        list.style.setProperty('--service-body-height', '0px');
        var h = Math.max.apply(null, bodies.map(function (b) { return b.offsetHeight; }));
        list.style.setProperty('--service-body-height', Math.ceil(h) + 'px');
      }
      measureBodies();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { measureBodies(); ScrollTrigger.refresh(); });
      }
      var resizeTimer = null;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { measureBodies(); ScrollTrigger.refresh(); }, 150);
      });

      // Stage arrives with the site's image signature (clip wipe + settle);
      // each description reveals on its own as it scrolls in.
      gsap.set(stage, { clipPath: clipFrom('left') });
      gsap.set(imgs[0], { scale: 1.15 });
      gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top 85%', toggleActions: 'play none none none' } })
        .to(stage, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut' }, 0)
        .to(imgs[0], { scale: 1, duration: 1.3, ease: 'power2.out' }, 0);
      bodies.forEach(function (body, i) {
        revealCardList([body], rows[i], { dirs: ['bottom'] });
      });

      // Photo change. Default: the incoming photo wipes up (down when
      // scrolling back) over the outgoing one, which drifts deeper.
      // js/webgl-fx.js replaces this with a liquid dissolve on capable
      // desktops. Contract: when done() runs, `to` is the only visible photo.
      var fxApi = window.__verandaFx = window.__verandaFx || {};
      fxApi.formatSwap = function (from, to, dir, done) {
        gsap.set(to, { zIndex: 2, visibility: 'visible', scale: 1.15, clipPath: clipFrom(dir > 0 ? 'bottom' : 'top') });
        gsap.set(from, { zIndex: 1 });
        gsap.timeline({
          onComplete: function () {
            gsap.set(from, { zIndex: 0, visibility: 'hidden', scale: 1 });
            done();
          }
        })
          .to(to, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power3.inOut' }, 0)
          .to(to, { scale: 1, duration: 1.1, ease: 'power2.out' }, 0)
          .to(from, { scale: 1.08, duration: 0.9, ease: 'power2.in' }, 0);
      };

      // Swaps run one at a time; a fast scroll past several formats jumps
      // straight from the shown photo to the latest target when the
      // running swap finishes, instead of queueing every step in between.
      var shown = 0;
      var target = 0;
      var busy = false;

      function rollIndex(i, dir) {
        gsap.timeline()
          .to(current, { yPercent: dir > 0 ? -100 : 100, duration: 0.3, ease: 'power2.in' })
          .call(function () { current.textContent = pad(i + 1); })
          .fromTo(current, { yPercent: dir > 0 ? 100 : -100 }, { yPercent: 0, duration: 0.45, ease: 'power3.out' });
      }

      function step() {
        if (busy || target === shown) return;
        var from = shown;
        var to = target;
        var dir = to > from ? 1 : -1;
        busy = true;
        rollIndex(to, dir);
        window.__verandaFx.formatSwap(imgs[from], imgs[to], dir, function () {
          shown = to;
          busy = false;
          step();
        });
      }

      // A row is active while it covers the centre of the visible area
      // under the fixed header — the point where its body lines up with
      // the stage.
      function viewCentre() {
        return Math.round(headerHeightPx + (window.innerHeight - headerHeightPx) / 2) + 'px';
      }
      rows.forEach(function (row, i) {
        ScrollTrigger.create({
          trigger: row,
          start: function () { return 'top ' + viewCentre(); },
          end: function () { return 'bottom ' + viewCentre(); },
          onToggle: function (self) {
            if (!self.isActive) return;
            rows.forEach(function (r) { r.classList.toggle('is-active', r === row); });
            target = i;
            step();
          }
        });
      });
    }

    /* ----------------------- Services page: process steps ---------------- */

    function setupProcessSteps() {
      var heading = document.getElementById('process-heading');
      var grid = document.querySelector('.process-grid');
      revealHeadingOnEnter(heading);
      if (!grid) return;
      var cards = Array.prototype.slice.call(grid.querySelectorAll('.process-card'));
      revealCardList(cards, grid);
      setupProcessLine(grid, cards);
    }

    // The 4 steps read as one journey: each card's divider line is drawn
    // in turn as you scroll (layout.css, .process-grid--drawn). Desktop
    // (one row): one scrubbed range over the grid lights the steps left to
    // right, step i at progress i/4. Mobile (stacked): each card lights as
    // it reaches the lower part of the viewport. Both reverse on scroll up.
    function setupProcessLine(grid, cards) {
      if (!cards.length) return;
      grid.classList.add('process-grid--drawn');

      if (!isDesktop) {
        cards.forEach(function (card) {
          ScrollTrigger.create({
            trigger: card,
            start: 'top 70%',
            onEnter: function () { card.classList.add('is-reached'); },
            onLeaveBack: function () { card.classList.remove('is-reached'); }
          });
        });
        return;
      }

      ScrollTrigger.create({
        trigger: grid,
        start: 'top 80%',
        end: 'top 40%',
        onUpdate: function (self) {
          cards.forEach(function (card, i) {
            card.classList.toggle('is-reached', self.progress > 0 && self.progress >= i / cards.length);
          });
        }
      });
    }

    /* ----------------------- Menu (card signature) ----------------------- */

    function setupMenu() {
      var heading = document.getElementById('menu-heading');
      var headingBlock = heading ? heading.closest('.section-heading') : null;
      var row = headingBlock ? headingBlock.querySelector('.section-heading__row') : null;
      var grid = document.querySelector('.menu-highlights__grid');

      revealHeadingOnEnter(heading);
      revealGentleGroup(row);
      revealCards(grid);
    }

    /* ----------------------- Menu page: category nav + item lists -------- */

    // No-ops on any page without .menu-nav/.menu-category (i.e. every page
    // except menu.html) — same guard pattern as setupServiceDetails()/
    // setupProcessSteps(). One category-grid reveal per category rather
    // than one reveal for the whole page, so each section's cards wipe in
    // as it individually scrolls into view instead of all firing at once.
    function setupMenuCategories() {
      var nav = document.querySelector('.menu-nav__track');
      revealGentleGroup(nav);

      document.querySelectorAll('.menu-category').forEach(function (category) {
        revealHeadingOnEnter(category.querySelector('.menu-category__title'));
        revealCards(category.querySelector('.menu-category__list'));
      });
    }

    /* ----------------------- Why-Us (pinned, cinematic) ------------------ */

    function setupWhyUs() {
      var section = document.querySelector('.why-us');
      var heading = document.getElementById('why-us-heading');
      var lede = document.getElementById('why-us-lede');
      var grid = section ? section.querySelector('.why-us__grid') : null;
      var flowerImg = section ? section.querySelector('img.why-us__decor') : null;
      if (!section || !grid) return;

      if (!isDesktop) {
        revealHeadingOnEnter(heading);
        revealText(lede);
        revealCards(grid);
        return;
      }

      var cards = Array.prototype.slice.call(grid.children);
      var split = splitLines(heading);
      var titleTargets = split && split.lines.length ? split.lines : [heading];

      if (split && split.lines.length) gsap.set(titleTargets, { yPercent: 115, opacity: 0 });
      else gsap.set(titleTargets, { y: 24, opacity: 0 });
      if (lede) gsap.set(lede, { y: 14, opacity: 0 });

      // Why-Us's identity: a case being assembled, not a page being
      // scrolled. The heading states the claim, the lede supports it, and
      // only then — as the second half's centerpiece — do the cards snap
      // into their arrangement, stronger and more decisive than a simple
      // fade (bigger tilt, deeper starting scale, a snappier ease). The
      // flower is the one continuous background presence tying the whole
      // sequence together: it drifts throughout on its own slow arc and
      // gradually comes into focus, arriving just ahead of the cards so
      // its presence feels earned rather than incidental.
      cards.forEach(function (card, i) {
        gsap.set(card, {
          clipPath: clipFrom(['bottom', 'left', 'right', 'top'][i % 4]),
          rotate: i % 2 === 0 ? -3 : 3,
          scale: 0.88
        });
      });

      var pinEnd = function () { return '+=' + window.innerHeight; };

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: pinEnd,
          scrub: 1,
          pin: true,
          anticipatePin: 1
        }
      });

      tl.to(titleTargets, {
        yPercent: split && split.lines.length ? 0 : undefined,
        y: split && split.lines.length ? undefined : 0,
        opacity: 1,
        duration: 0.3,
        stagger: 0.07,
        ease: 'power2.out'
      }, 0);
      if (lede) tl.to(lede, { y: 0, opacity: 1, duration: 0.26, ease: 'power2.out' }, 0.14);
      // The main event: cards claim the second half of the pin, arriving
      // with real conviction rather than drifting in alongside the text.
      tl.to(cards, {
        clipPath: 'inset(0% 0% 0% 0%)',
        rotate: 0,
        scale: 1,
        duration: 0.32,
        stagger: 0.09,
        ease: 'power3.out'
      }, 0.32);

      if (flowerImg) {
        resolveFlowerTarget(flowerImg, function (target) {
          // The flower's plain CSS position (bottom:-182px, see
          // layout.css) IS the final design composition: its base
          // intentionally sits below the section's own edge, cropped by
          // .why-us's overflow:hidden. Measuring that natural overflow
          // live (rather than hardcoding the -182 here too) keeps this
          // correct even if the CSS value or the section's own rendered
          // height ever changes. The pin then LIFTS the flower up by
          // exactly that amount at scroll-start (fully inside the
          // section, nothing cropped) and lowers it back to 0 — its
          // natural, designed, partially-clipped position — by
          // scroll-end, so the crop only ever appears in the finished
          // composition, never as an accidental crop mid-reveal.
          var naturalRect = target.getBoundingClientRect();
          var sectionRect = section.getBoundingClientRect();
          var restOverflow = Math.max(0, naturalRect.bottom - sectionRect.bottom);

          // transformOrigin 'bottom' (not GSAP's default center) so the
          // 1.08->1 scale-in grows from the flower's own base rather than
          // bulging symmetrically past it mid-transition.
          gsap.set(target, {
            willChange: 'transform',
            opacity: 0.06,
            scale: 1.08,
            y: -restOverflow,
            transformOrigin: '50% 100%'
          });

          // A large MotionPath journey previously carried the flower well
          // away from its intended spot in the composition (removed). Now
          // it only breathes gently in place (a small x drift, well
          // within its own footprint) while arriving into focus and
          // settling into its final resting position alongside the cards.
          gsap.timeline({
            scrollTrigger: { trigger: section, start: 'top top', end: pinEnd, scrub: 1 }
          })
            .to(target, { opacity: 0.2, scale: 1, duration: 0.7, ease: 'sine.out' }, 0)
            .to(target, { x: -12, y: 0, duration: 0.7, ease: 'none' }, 0);
        });
      }
    }

    /* ----------------------- CTA banner (pinned, cinematic) -------------- */

    function setupCtaBanner() {
      var section = document.querySelector('.cta-banner');
      var mediaWrap = section ? section.querySelector('.cta-banner__media') : null;
      var img = mediaWrap ? mediaWrap.querySelector('img') : null;
      var heading = document.getElementById('cta-banner-heading');
      var text = section ? section.querySelector('.cta-banner__text') : null;
      var btn = section ? section.querySelector('.btn') : null;
      if (!section || !img || !heading) return;

      if (!isDesktop) {
        // Mobile has no pin/scale-jack at all for this section (see
        // below), so "appears too late" here means the trigger threshold
        // itself was too conservative — 'top 85/88%' needed the section
        // almost fully scrolled into view first. Firing as soon as the
        // section merely touches the viewport gets the message visible
        // right as the section arrives, matching the "substantially
        // earlier" intent on desktop.
        var mobileStart = 'top 98%';
        revealHeadingOnEnter(heading, { start: mobileStart });
        revealText(text, 0, { start: mobileStart });
        revealText(btn, 0.08, { start: mobileStart });
        return;
      }

      // CTA's identity is the deliberate opposite of Hero's: where the hero
      // pulls back and places a photograph, this pushes in and tightens —
      // a cinematic letterbox closing toward the center while the message
      // ignites, decisive and warm rather than contemplative. Sharing the
      // hero's "photo becomes a frame" move here would make the two pinned
      // moments blur together, so the shape language is deliberately
      // different: a wide, short letterbox instead of a portrait frame,
      // and the photo keeps zooming IN throughout instead of settling.
      gsap.set(img, { scale: 1.15 });
      gsap.set(mediaWrap, { clipPath: 'inset(0% 0% 0% 0% round 0px)' });

      var split = splitLines(heading);
      var titleTargets = split && split.lines.length ? split.lines : [heading];
      if (split && split.lines.length) gsap.set(titleTargets, { yPercent: 60, opacity: 0, scale: 0.92 });
      else gsap.set(titleTargets, { y: 24, opacity: 0, scale: 0.92 });
      if (text) gsap.set(text, { y: 16, opacity: 0 });
      if (btn) gsap.set(btn, { y: 12, opacity: 0, scale: 0.85 });

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: function () { return '+=' + window.innerHeight * 0.75; },
          scrub: 1,
          pin: true,
          anticipatePin: 1
        }
      });

      // Backdrop keeps pushing closer for almost the whole pin — a single
      // continuous move, not a settle. Text/button ignite very early —
      // near the very start of the pin, well before the block has done
      // any meaningful shrinking — so the message reads clearly while the
      // block is still large, then the block keeps shrinking on its own
      // for the rest of the pin toward the final tight composition.
      tl.to(img, { scale: 1.38, duration: 0.75, ease: 'sine.inOut' }, 0)
        .to(mediaWrap, {
          clipPath: 'inset(14% 3% 14% 3% round 6px)',
          duration: 0.7,
          ease: 'power2.inOut'
        }, 0.05)
        // The message ignites center-stage, quick and confident rather
        // than a slow rise — a distinct tempo from Hero/Why-Us's headings.
        .to(titleTargets, {
          yPercent: split && split.lines.length ? 0 : undefined,
          y: split && split.lines.length ? undefined : 0,
          opacity: 1,
          scale: 1,
          duration: 0.26,
          stagger: 0.06,
          ease: 'power4.out'
        }, 0.02);
      if (text) tl.to(text, { y: 0, opacity: 1, duration: 0.22, ease: 'power2.out' }, 0.14);
      if (btn) tl.to(btn, { y: 0, opacity: 1, scale: 1, duration: 0.22, ease: 'power3.out' }, 0.26);
    }

    /* ----------------------- About teaser (image transform) -------------- */

    function setupAboutTeaser() {
      var heading = document.getElementById('about-teaser-heading');
      var headingBlock = heading ? heading.closest('.section-heading') : null;
      var row = headingBlock ? headingBlock.querySelector('.section-heading__row') : null;
      var media = document.querySelector('.about-teaser__media');
      var img = media ? media.querySelector('img') : null;

      revealHeadingOnEnter(heading);
      revealGentleGroup(row);

      if (media && img) {
        gsap.set(media, { clipPath: 'inset(0% 0% 100% 0%)' });
        gsap.set(img, { scale: 1.18, yPercent: -4 });
        gsap.timeline({
          scrollTrigger: { trigger: media, start: 'top 80%', toggleActions: 'play none none none' }
        })
          .to(media, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut' }, 0)
          .to(img, { scale: 1, yPercent: 0, duration: 1.4, ease: 'power2.out' }, 0);
      }
    }

    /* ----------------------- About: story panel --------------------------- */

    // No-ops on every page but about.html. Same shared signatures as the
    // rest of the site — heading line-mask, calm text rise, and a
    // clip-path(bottom→open)+scale photo settle copied from
    // setupAboutTeaser()'s own media reveal, since the two compositions
    // (photo beside/under text) are close cousins. The decorative flower
    // is left alone — it's already animated by the separate, always-on
    // botanical wind system (js/botanical-animation.js), not this file.
    function setupAboutStory() {
      var heading = document.getElementById('about-story-heading');
      var text = document.querySelector('.about-story__text');
      var media = document.querySelector('.about-story__media');
      var img = media ? media.querySelector('img') : null;

      revealHeadingOnEnter(heading);
      revealText(text, 0.1);

      if (media && img) {
        gsap.set(media, { clipPath: 'inset(0% 0% 100% 0%)' });
        gsap.set(img, { scale: 1.15 });
        gsap.timeline({
          scrollTrigger: { trigger: media, start: 'top 85%', toggleActions: 'play none none none' }
        })
          .to(media, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power3.inOut' }, 0)
          .to(img, { scale: 1, duration: 1.3, ease: 'power2.out' }, 0);
      }
    }

    /* ----------------------- About: team section --------------------------- */

    // No-ops on every page but about.html. Card-grid signature, scoped to
    // only the real (non-aria-hidden) cards inside the infinite-loop track
    // — same reason as setupPortfolio() below: main.js's createLoopCarousel()
    // has already cloned this track by the time this runs, and running the
    // one-time clip-path/rotate/scale reveal across the clones too would
    // corrupt the drag-geometry measurements taken from the first child's
    // rect (a real bug, already found and fixed once for Portfolio — see
    // CHANGELOG.md). dirs alternates bottom/top to echo the cards' own
    // 64px zigzag stagger, rather than the site's usual 4-direction default.
    function setupTeamSection() {
      var heading = document.getElementById('team-heading');
      var track = document.querySelector('[data-team-track]');

      revealHeadingOnEnter(heading);

      if (track) {
        var realCards = Array.prototype.slice.call(track.children).filter(function (c) {
          return c.getAttribute('aria-hidden') !== 'true';
        });
        revealCardList(realCards, track, { dirs: ['bottom', 'top'] });
      }
    }

    /* ----------------------- About: stats band (count-up) ---------------- */

    // No-ops on every page except about.html (no .stats-band elsewhere).
    // Heading + card-grid use the same shared signatures as everywhere
    // else; the numbers themselves get their own count-up on top (below).
    function setupStatsBand() {
      var section = document.querySelector('.stats-band');
      if (!section) return;

      revealHeadingOnEnter(document.getElementById('stats-band-heading'));
      revealCards(document.querySelector('.stats-band__grid'), { stagger: 0.1 });

      // Each .stat-card__value's own static text ("8", "350+", "400", "4")
      // is parsed once into a numeric target + trailing suffix, then
      // counted up from 0 via a plain GSAP-tweened number — not a DOM/CSS
      // animation, since there's no intermediate visual state to tween,
      // just the text content on every tick. Starts at 'top 80%' (a touch
      // later than the 'top 85%' the card wipe above uses), so the cards
      // are already assembling by the time the numbers start climbing,
      // rather than both firing in the same instant. Fires once, like
      // every other one-time reveal on this site (toggleActions:'play
      // none none none'). Under reduced motion this whole file's boot()
      // never runs, so the static "8"/"350+"/"400"/"4" HTML text is simply
      // left alone — already the correct final state, no separate
      // reduced-motion branch needed here.
      var values = Array.prototype.slice.call(section.querySelectorAll('.stat-card__value'));
      values.forEach(function (el) {
        var match = el.textContent.trim().match(/^(\d+)(.*)$/);
        if (!match) return;
        var target = parseInt(match[1], 10);
        var suffix = match[2];
        var counter = { val: 0 };
        el.textContent = '0' + suffix;

        gsap.to(counter, {
          val: target,
          duration: 1.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 80%', toggleActions: 'play none none none' },
          onUpdate: function () {
            el.textContent = Math.round(counter.val) + suffix;
          }
        });
      });
    }

    /* ----------------------- About: pull-quote ---------------------------- */

    // No-ops on every page but about.html. Deliberately the calm
    // paragraph/text signature, not the card wipe — a quote isn't a card,
    // and this section is meant to read as a quiet pause between the
    // stats band and the photo strip, not another "assembling" moment.
    // The quote "inks in" word by word, tied to scroll position (scrub),
    // from barely-there to full — the page's emotional centre gets read at
    // the reader's own pace instead of just fading up like body copy.
    // SplitText 'words' (not lines): the quote's own <br> stays a real
    // break. SplitText's default aria handling labels the blockquote and
    // hides the word spans from screen readers.
    function setupPullQuote() {
      var quote = document.querySelector('.pull-quote__text');
      var attribution = document.querySelector('.pull-quote__attribution');
      if (!quote) return;
      var split = null;
      if (hasSplit) {
        // Same aria-label fix as splitLines(): SplitText joins the text
        // across the quote's <br> with no space ("кожноїдеталі").
        var clone = quote.cloneNode(true);
        clone.querySelectorAll('br').forEach(function (br) { br.replaceWith(' '); });
        var label = clone.textContent.replace(/\s+/g, ' ').trim();
        try { split = SplitText.create(quote, { type: 'words' }); } catch (err) { split = null; }
        if (split) quote.setAttribute('aria-label', label);
      }
      if (split && split.words.length) {
        gsap.fromTo(split.words, { opacity: 0.12 }, {
          opacity: 1,
          ease: 'none',
          stagger: 0.1,
          scrollTrigger: { trigger: quote, start: 'top 85%', end: 'bottom 45%', scrub: true }
        });
        revealText(attribution, 0, { start: 'top 75%' });
      } else {
        revealText(quote);
        revealText(attribution, 0.15);
      }
    }

    /* ----------------------- About: photo strip ---------------------------- */

    // No-ops on every page but about.html. Same real-cards-only scoping as
    // setupTeamSection()/setupPortfolio() — this track is also built by
    // main.js's createLoopCarousel() (mobileOnly:true here, so at desktop
    // it's already been torn back down to the plain real items by the time
    // this runs, and the filter below is simply a no-op there).
    function setupPhotoStrip() {
      var track = document.querySelector('[data-gallery-track]');
      if (!track) return;
      var realItems = Array.prototype.slice.call(track.children).filter(function (c) {
        return c.getAttribute('aria-hidden') !== 'true';
      });
      revealCardList(realItems, track);
    }

    /* ----------------------- Portfolio (card signature) ------------------ */

    function setupPortfolio() {
      var heading = document.getElementById('portfolio-heading');
      var headingBlock = heading ? heading.closest('.section-heading') : null;
      var btn = headingBlock ? headingBlock.querySelector('a.btn') : null;
      var track = document.querySelector('[data-portfolio-track]');

      revealHeadingOnEnter(heading);
      revealText(btn, 0.1);

      if (track) {
        // main.js clones this track's cards for the infinite drag loop
        // (see js/main.js) before this ever runs; only the one real,
        // non-decorative set (not marked aria-hidden) plays the entrance.
        var realCards = Array.prototype.slice.call(track.children).filter(function (c) {
          return c.getAttribute('aria-hidden') !== 'true';
        });
        revealCardList(realCards, track);
      }
    }

    /* ------------- Portfolio page: gallery, filter, lightbox ------------ */

    // Four layers, each on its own element so their transforms never fight:
    //   .portfolio-gallery__item    — GSAP Flip (filter re-layout)
    //   .portfolio-gallery__trigger — clip-path reveal + desktop parallax y
    //   img                         — scale settle, then CSS hover zoom
    //   .photo-lightbox__image      — lightbox expand/collapse/swap
    // main.js owns all behavior (filtering, lightbox state) and calls these
    // through window.__verandaFx only when present, so everything still
    // works — just without motion — if this never boots.
    function setupPortfolioGallery() {
      var gallery = document.querySelector('.portfolio-gallery');
      if (!gallery) return;

      var hasFlip = typeof Flip !== 'undefined';
      if (hasFlip) gsap.registerPlugin(Flip);

      var fxApi = window.__verandaFx = window.__verandaFx || {};
      var items = Array.prototype.slice.call(gallery.querySelectorAll('.portfolio-gallery__item'));
      var triggers = items.map(function (item) { return item.querySelector('.portfolio-gallery__trigger'); });
      if (!items.length || triggers.indexOf(null) !== -1) return;
      function imgOf(el) { return el.querySelector('img'); }

      /* --- 1. Scroll reveal: the card-grid clip-path signature, with the
             photo settling from 1.25 inside its own mask. --- */
      var dirs = ['bottom', 'left', 'right', 'top'];
      triggers.forEach(function (t, i) {
        gsap.set(t, { clipPath: clipFrom(dirs[i % dirs.length]) });
        gsap.set(imgOf(t), { scale: 1.25 });
      });

      function revealTriggers(list, stagger, delay) {
        gsap.to(list, {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 1.1,
          ease: 'power3.inOut',
          stagger: stagger,
          delay: delay || 0,
          overwrite: 'auto'
        });
        // clearProps so the CSS :hover zoom on the img works afterwards —
        // an inline transform would outrank it (see revealText's note).
        gsap.to(list.map(imgOf), {
          scale: 1,
          duration: 1.5,
          ease: 'power3.out',
          stagger: stagger,
          delay: delay || 0,
          overwrite: 'auto',
          clearProps: 'transform'
        });
      }

      ScrollTrigger.batch(triggers, {
        start: 'top 88%',
        once: true,
        onEnter: function (batch) { revealTriggers(batch, 0.1); }
      });

      /* --- 2. Desktop column parallax: odd columns drift against even
             ones while the grid scrolls through. Driven by a plain
             onUpdate + quickSetter (not a scrubbed tween) so the column
             factors can change after a filter without a visible pop —
             `strength` fades the effect out/in around each Flip. --- */
      var par = { strength: 1, progress: 0 };
      var factors = triggers.map(function () { return 0; });
      var filtering = false;
      var PARALLAX_PX = 40;
      var setY = triggers.map(function (t) { return gsap.quickSetter(t, 'y', 'px'); });

      function computeFactors() {
        var col = 0;
        factors = items.map(function (item) {
          if (item.classList.contains('is-hidden')) return 0;
          return (col++ % 4) % 2;
        });
      }

      function renderParallax() {
        if (!isDesktop) return;
        var amount = PARALLAX_PX * (1 - 2 * par.progress) * par.strength;
        for (var i = 0; i < triggers.length; i++) setY[i](factors[i] * amount);
      }

      if (isDesktop) {
        computeFactors();
        ScrollTrigger.create({
          trigger: gallery,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: function (self) {
            par.progress = self.progress;
            renderParallax();
          },
          onRefresh: function (self) {
            par.progress = self.progress;
            if (!filtering) computeFactors();
            renderParallax();
          }
        });
      }

      /* --- 3. Filter: one travelling underline + Flip re-layout. --- */
      var moveIndicator = createTravelIndicator({
        nav: document.querySelector('.portfolio-filter'),
        track: document.querySelector('.portfolio-filter__track'),
        activeSelector: '.portfolio-filter__link.is-active',
        className: 'portfolio-filter__indicator'
      });

      var activeFlip = null;
      var leaveTween = null;

      fxApi.galleryFilter = function (_items, commit, done) {
        // A click mid-animation first snaps the previous one to its end
        // state, so nothing is left half-flipped or pinned out of flow.
        if (leaveTween) leaveTween.progress(1);
        if (activeFlip) activeFlip.progress(1);
        if (!hasFlip) {
          commit();
          moveIndicator(true);
          done();
          return;
        }

        var state = Flip.getState(items);
        filtering = true;
        if (isDesktop) gsap.to(par, { strength: 0, duration: 0.35, ease: 'power2.out', onUpdate: renderParallax });

        // Flip's own onLeave can't be used here: the items are hidden via a
        // class (display:none), which Flip doesn't undo for the exit tween
        // (verified: onLeave fires, but the elements are already
        // display:none, so the exit animation is invisible). So leaving
        // items are pinned back at their old spots by hand, out of flow.
        var trackEl = items[0].parentElement;
        var before = items.map(function (item) {
          return item.classList.contains('is-hidden') ? null : item.getBoundingClientRect();
        });

        commit();
        moveIndicator(true);

        activeFlip = Flip.from(state, {
          duration: 0.9,
          ease: 'power3.inOut',
          stagger: 0.02,
          onEnter: function (els) {
            var ts = els.map(function (el) { return el.querySelector('.portfolio-gallery__trigger'); });
            gsap.set(els, { clearProps: 'clipPath,opacity,scale' });
            var tl = gsap.timeline();
            tl.fromTo(ts, { clipPath: 'inset(100% 0% 0% 0%)' }, {
              clipPath: 'inset(0% 0% 0% 0%)',
              duration: 0.9,
              ease: 'power3.inOut',
              stagger: 0.06,
              overwrite: 'auto'
            }, 0.25);
            tl.fromTo(ts.map(imgOf), { scale: 1.25 }, {
              scale: 1,
              duration: 1.2,
              ease: 'power3.out',
              stagger: 0.06,
              overwrite: 'auto',
              clearProps: 'transform'
            }, 0.25);
            return tl;
          },
          onComplete: function () {
            activeFlip = null;
            filtering = false;
            if (isDesktop) {
              computeFactors();
              renderParallax();
              gsap.to(par, { strength: 1, duration: 0.8, ease: 'power2.inOut', onUpdate: renderParallax });
            }
            // Second refresh: the first (below) ran while Flip still had
            // the items transformed back to their old spots.
            done();
          }
        });

        // Runs AFTER Flip.from on purpose: pinned out of flow before it,
        // Flip saw these as still-visible "staying" items and took over
        // their position/size props, leaving them stuck absolute.
        var trackRect = trackEl.getBoundingClientRect();
        var leaving = [];
        items.forEach(function (item, i) {
          if (!before[i] || !item.classList.contains('is-hidden')) return;
          gsap.set(item, {
            display: 'block',
            position: 'absolute',
            left: before[i].left - trackRect.left,
            top: before[i].top - trackRect.top,
            width: before[i].width,
            height: before[i].height,
            margin: 0,
            zIndex: 0,
            pointerEvents: 'none'
          });
          leaving.push(item);
        });
        if (leaving.length) {
          leaveTween = gsap.to(leaving, {
            clipPath: 'inset(0% 0% 100% 0%)',
            scale: 0.92,
            opacity: 0,
            duration: 0.45,
            ease: 'power2.in',
            stagger: 0.02,
            onComplete: function () {
              leaveTween = null;
              gsap.set(leaving, { clearProps: 'display,position,left,top,width,height,margin,zIndex,pointerEvents,clipPath,scale,opacity' });
            }
          });
        }

        // Layout below the grid is already final (Flip animates with
        // transforms; leaving items are taken out of flow), so the pinned
        // CTA banner can be re-measured right away.
        done();
      };

    }

    /* ------------- Shared: travelling tab underline ------------------- */

    // One underline element that travels between tabs: stretches to span
    // the old and new tab, then contracts onto the new one. Used by
    // Portfolio's filter and Menu's category nav. The per-tab ::after
    // underline keeps marking the active tab wherever this doesn't run
    // (no GSAP, reduced motion); `.has-indicator` on the nav hides it.
    function createTravelIndicator(opts) {
      var nav = opts.nav;
      var track = opts.track;
      if (!nav || !track) return function () {};
      var indicator = document.createElement('span');
      indicator.className = opts.className;
      indicator.setAttribute('aria-hidden', 'true');
      track.appendChild(indicator);
      nav.classList.add('has-indicator');

      function move(animate) {
        var active = track.querySelector(opts.activeSelector);
        if (!active) {
          gsap.killTweensOf(indicator);
          gsap.to(indicator, { width: 0, duration: animate ? 0.3 : 0 });
          return;
        }
        var trackRect = track.getBoundingClientRect();
        var r = active.getBoundingClientRect();
        var x = r.left - trackRect.left;
        var w = r.width;
        gsap.killTweensOf(indicator);
        var curW = indicator.offsetWidth;
        if (!animate || !curW) {
          gsap.set(indicator, { x: x, width: w });
          return;
        }
        var curX = gsap.getProperty(indicator, 'x');
        var left = Math.min(curX, x);
        var right = Math.max(curX + curW, x + w);
        gsap.timeline()
          .to(indicator, { x: left, width: right - left, duration: 0.28, ease: 'power2.in' })
          .to(indicator, { x: x, width: w, duration: 0.5, ease: 'power3.out' });
      }

      move(false);
      // Tab widths change once the web font swaps in.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { move(false); });
      }
      var resizeTimer;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { move(false); }, 150);
      });
      return move;
    }

    /* ------------- Menu: category nav travelling underline ------------ */

    // main.js's scroll-spy toggles .menu-nav__link--active; the underline
    // just follows that class (MutationObserver), so it animates both on
    // click-to-scroll and while scrolling through the categories.
    function setupMenuNavIndicator() {
      var nav = document.querySelector('.menu-nav');
      var track = nav ? nav.querySelector('.menu-nav__track') : null;
      if (!track) return;
      var move = createTravelIndicator({
        nav: nav,
        track: track,
        activeSelector: '.menu-nav__link--active',
        className: 'menu-nav__indicator'
      });
      if (!('MutationObserver' in window)) return;
      var pending = false;
      var observer = new MutationObserver(function () {
        // Scroll-spy flips one class off and another on in the same task —
        // coalesce into one move.
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          pending = false;
          move(true);
        });
      });
      track.querySelectorAll('.menu-nav__link').forEach(function (link) {
        observer.observe(link, { attributes: true, attributeFilter: ['class'] });
      });
    }

    /* ------------- Shared: photo viewer (cursor + lightbox motion) ----- */

    function setupPhotoViewerFx() {
      // Every photo thumbnail that opens a lightbox, site-wide, and the
      // element that visibly crops it. Declared INSIDE the function: as
      // boot()-level vars they were still undefined when boot() called
      // this (var hoisting), so the whole setup silently no-opped.
      var THUMB_SELECTOR = '.portfolio-gallery__trigger, .menu-item__media-trigger';
      var FRAME_SELECTOR = '.portfolio-gallery__trigger, .menu-item__media';
      // The disc also shows over Home's portfolio slider cards — those are
      // links to portfolio.html, not lightbox triggers, so cursor only.
      var CURSOR_SELECTOR = THUMB_SELECTOR + ', .portfolio-highlights__grid .portfolio-card';
      var fxApi = window.__verandaFx = window.__verandaFx || {};
      if (!document.querySelector(CURSOR_SELECTOR)) return;

      /* --- Desktop hover cursor ("Переглянути" disc). --- */
      var cursor = null;
      var cursorShown = false;
      var lastPointer = null;

      function setCursorShown(show) {
        if (!cursor || show === cursorShown) return;
        cursorShown = show;
        gsap.to(cursor, {
          scale: show ? 1 : 0,
          duration: show ? 0.5 : 0.3,
          ease: show ? 'back.out(1.7)' : 'power2.in',
          overwrite: 'auto'
        });
      }

      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        cursor = document.createElement('div');
        cursor.className = 'gallery-cursor';
        cursor.setAttribute('aria-hidden', 'true');
        cursor.textContent = 'Переглянути';
        document.body.appendChild(cursor);
        document.documentElement.classList.add('has-gallery-cursor');

        var xTo = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3.out' });
        var yTo = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3.out' });

        document.addEventListener('pointermove', function (e) {
          if (e.pointerType !== 'mouse') return;
          // Hidden while a slider is being dragged (createLoopCarousel sets
          // .is-dragging on its viewport) — the native grabbing cursor
          // takes over there.
          var over = !!e.target.closest(CURSOR_SELECTOR) && !e.target.closest('.is-dragging');
          if (!over && !cursorShown) { lastPointer = null; return; }
          if (!lastPointer) gsap.set(cursor, { x: e.clientX, y: e.clientY });
          lastPointer = { x: e.clientX, y: e.clientY };
          xTo(e.clientX);
          yTo(e.clientY);
          setCursorShown(over);
        }, { passive: true });
        document.documentElement.addEventListener('pointerleave', function () { setCursorShown(false); });
        // Wheel-scrolling moves photos under a still pointer without any
        // pointermove — re-check what's under it.
        window.addEventListener('scroll', function () {
          if (!cursorShown || !lastPointer) return;
          var el = document.elementFromPoint(lastPointer.x, lastPointer.y);
          if (!el || !el.closest(CURSOR_SELECTOR)) setCursorShown(false);
        }, { passive: true });
      }

      if (!document.querySelector(THUMB_SELECTOR)) return;

      /* --- Lightbox: expand from the thumbnail, wipe between photos,
             collapse back. Generic over how the thumbnail is cropped:
             object-fit:cover (Portfolio) or an oversized absolutely
             positioned <img> (Menu). `contentRect` gives where the WHOLE
             photo is drawn on screen (can extend past its frame); the
             lightbox photo's content is mapped onto that with scaleX/Y,
             then clip-path-cropped to the thumbnail's frame. --- */
      function parsePos(value, free) {
        if (!value) return free / 2;
        if (value.slice(-1) === '%') return free * parseFloat(value) / 100;
        if (value.slice(-2) === 'px') return parseFloat(value);
        if (value === 'left' || value === 'top') return 0;
        if (value === 'right' || value === 'bottom') return free;
        return free / 2;
      }

      function contentRect(img) {
        var e = img.getBoundingClientRect();
        var iw = img.naturalWidth;
        var ih = img.naturalHeight;
        var cs = window.getComputedStyle(img);
        var fit = cs.objectFit;
        if (!iw || !ih || !fit || fit === 'fill') return { left: e.left, top: e.top, width: e.width, height: e.height };
        var k;
        if (fit === 'cover') k = Math.max(e.width / iw, e.height / ih);
        else if (fit === 'contain') k = Math.min(e.width / iw, e.height / ih);
        else if (fit === 'scale-down') k = Math.min(1, e.width / iw, e.height / ih);
        else k = 1;
        var w = iw * k;
        var h = ih * k;
        var pos = (cs.objectPosition || '50% 50%').split(/\s+/);
        return { left: e.left + parsePos(pos[0], e.width - w), top: e.top + parsePos(pos[1], e.height - h), width: w, height: h };
      }

      // Transform (from the lightbox image's untransformed layout) that puts
      // its photo exactly where the thumbnail's photo is, cropped to the
      // thumbnail's frame. Call with the image's transform cleared.
      function thumbState(image, thumb) {
        var frame = thumb ? thumb.closest(FRAME_SELECTOR) : null;
        if (!frame) return null;
        var box = image.getBoundingClientRect();
        var F = contentRect(image);
        var T = contentRect(thumb);
        var R = frame.getBoundingClientRect();
        if (!box.width || !F.width || !T.width || !R.width) return null;
        var kx = T.width / F.width;
        var ky = T.height / F.height;
        var bcx = box.left + box.width / 2;
        var bcy = box.top + box.height / 2;
        // Scaling about the box center moves the (possibly letterboxed)
        // content center too — account for that in the translation.
        var tx = (T.left + T.width / 2) - bcx - ((F.left + F.width / 2) - bcx) * kx;
        var ty = (T.top + T.height / 2) - bcy - ((F.top + F.height / 2) - bcy) * ky;
        function localX(px) { return box.width / 2 + (px - (bcx + tx)) / kx; }
        function localY(py) { return box.height / 2 + (py - (bcy + ty)) / ky; }
        var top = Math.max(0, localY(R.top));
        var left = Math.max(0, localX(R.left));
        var right = Math.max(0, box.width - localX(R.right));
        var bottom = Math.max(0, box.height - localY(R.bottom));
        return {
          x: tx,
          y: ty,
          scaleX: kx,
          scaleY: ky,
          clipPath: 'inset(' + top + 'px ' + right + 'px ' + bottom + 'px ' + left + 'px)',
          frameRect: R
        };
      }

      function whenLoaded(image, cb) {
        if (image.complete && image.naturalWidth) cb();
        else image.addEventListener('load', cb, { once: true });
      }

      function showAllThumbs() {
        // Each selector needs its own " img" — appending it to the whole
        // comma list only applied it to the last one.
        var imgSelector = THUMB_SELECTOR.split(',').map(function (sel) { return sel.trim() + ' img'; }).join(', ');
        gsap.set(Array.prototype.slice.call(document.querySelectorAll(imgSelector)), { autoAlpha: 1 });
      }

      fxApi.lightboxOpen = function (thumb, image) {
        setCursorShown(false);
        gsap.killTweensOf(image);
        // The CSS open transition (scale .97 -> 1) would both lag behind
        // GSAP's per-frame transform and skew the measurement below.
        image.style.transition = 'none';
        image.style.transform = 'none';
        gsap.set(image, { opacity: 0 });
        whenLoaded(image, function () {
          var from = thumbState(image, thumb);
          if (!from) {
            gsap.to(image, { opacity: 1, duration: 0.4 });
            return;
          }
          gsap.set(thumb, { autoAlpha: 0 });
          gsap.fromTo(image, {
            x: from.x, y: from.y, scaleX: from.scaleX, scaleY: from.scaleY,
            clipPath: from.clipPath, opacity: 1, transformOrigin: '50% 50%'
          }, {
            x: 0, y: 0, scaleX: 1, scaleY: 1, clipPath: 'inset(0px 0px 0px 0px)',
            duration: 0.85,
            ease: 'power3.inOut'
          });
        });
      };

      fxApi.lightboxSwap = function (image, dir, commit, done) {
        gsap.killTweensOf(image);
        gsap.timeline()
          .to(image, {
            clipPath: dir > 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)',
            x: dir > 0 ? -30 : 30,
            duration: 0.4,
            ease: 'power2.in',
            onComplete: function () {
              commit();
              whenLoaded(image, function () {
                gsap.fromTo(image, {
                  clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)',
                  x: dir > 0 ? 30 : -30
                }, {
                  clipPath: 'inset(0% 0% 0% 0%)',
                  x: 0,
                  duration: 0.6,
                  ease: 'power3.out',
                  onComplete: done
                });
              });
            }
          });
      };

      // The generic modal hides [hidden] ~400ms after close, so this stays
      // under that; the scrim's own CSS fade runs alongside.
      fxApi.lightboxClose = function (image, thumb) {
        gsap.killTweensOf(image);
        var cleanup = function () {
          showAllThumbs();
          gsap.delayedCall(0.1, function () { gsap.set(image, { clearProps: 'all' }); });
        };
        gsap.set(image, { x: 0, y: 0, scaleX: 1, scaleY: 1, clipPath: 'inset(0px 0px 0px 0px)' });
        var to = thumbState(image, thumb);
        var onScreen = to && to.frameRect.bottom > 0 && to.frameRect.top < window.innerHeight;
        if (!onScreen) {
          gsap.to(image, { opacity: 0, scale: 0.96, duration: 0.3, ease: 'power2.in', onComplete: cleanup });
          return;
        }
        gsap.set(thumb, { autoAlpha: 0 });
        gsap.to(image, {
          x: to.x, y: to.y, scaleX: to.scaleX, scaleY: to.scaleY, clipPath: to.clipPath,
          duration: 0.38,
          ease: 'power3.inOut',
          onComplete: cleanup
        });
      };
    }

    /* ----------------------- Testimonials (card signature + drift) ------- */

    function setupTestimonials() {
      var section = document.querySelector('.testimonials');
      var heading = document.getElementById('testimonials-heading');
      var list = document.querySelector('.testimonial-highlights__list');
      var flowerImg = section ? section.querySelector('img.testimonials__decor') : null;

      revealHeadingOnEnter(heading);
      revealCards(list, { dirs: ['left', 'right', 'left'] });

      if (isDesktop && section && flowerImg) {
        resolveFlowerTarget(flowerImg, function (target) {
          gsap.set(target, { willChange: 'transform' });
          gsap.to(target, {
            x: 40,
            y: -70,
            ease: 'none',
            scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
          });
        });
      }
    }

    /* ----------------------- Quick contact (calm, deliberately) ---------- */

    function setupQuickContact() {
      var heading = document.getElementById('quick-contact-heading');
      // Scoped to #quick-contact specifically (not a bare
      // `[data-quick-form]`, which would also match the global contact
      // modal's own form elsewhere in the document) — this section's
      // inline "Швидка заявка" form is what should reveal here. No-ops
      // safely on Services, which no longer has a #quick-contact section
      // at all (removed — see CHANGELOG.md).
      var form = document.querySelector('#quick-contact [data-quick-form]');
      var tiles = document.querySelector('#quick-contact .contact-tile-grid');

      revealHeadingOnEnter(heading);
      revealText(form);
      revealGentleGroup(tiles);
    }

    /* ----------------------- Contacts page (above the fold) ------------- */

    // No hero on this page — the title/form/tiles ARE the first screen, so
    // this is an on-load entrance (like setupHero's intro), not a scroll
    // reveal. Hero's line-mask for the h1, then the site's clip-path wipe
    // for the panels: form rises from the bottom, tiles wipe in from the
    // left one after another. clearProps drops the inline clip-path too
    // (unlike revealCardList): a leftover inset(0) would clip the tiles'
    // hover shadow.
    function setupContacts() {
      var section = document.querySelector('.contacts');
      if (!section) return;
      var title = section.querySelector('.contacts__title');
      var form = section.querySelector('.quick-form');
      var tiles = section.querySelectorAll('.contact-tile');

      var split = splitLines(title);
      var titleTargets = split && split.lines.length ? split.lines : [title];
      if (split && split.lines.length) splitHeadings.push({ el: title, split: split });

      var tl = gsap.timeline({ delay: 0.15 });
      tl.from(titleTargets, {
        yPercent: split && split.lines.length ? 115 : 0,
        y: split && split.lines.length ? 0 : 24,
        opacity: 0,
        duration: 1.1,
        ease: 'power4.out',
        stagger: 0.08
      });
      if (form) {
        tl.from(form, {
          clipPath: 'inset(100% 0% 0% 0%)',
          y: 24,
          duration: 1,
          ease: 'power3.out',
          clearProps: 'clipPath,transform'
        }, 0.3);
      }
      if (tiles.length) {
        tl.from(tiles, {
          clipPath: 'inset(0% 100% 0% 0%)',
          x: -16,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.1,
          clearProps: 'clipPath,transform'
        }, 0.45);
      }
    }

    /* ----------------------- .btn--secondary snake border ---------------- */

    // Idle and hover are two mutually exclusive border systems — never
    // both visible at once:
    //   A) .btn--secondary::after (components.css) — a pseudo-element
    //      standing in for what used to be a plain border-bottom, visible
    //      only in true idle.
    //   B) an SVG overlay, hidden at rest (stroke-dasharray reveals zero
    //      length) and the ONLY visible border for the entire duration of
    //      a hover/focus interaction, including its exit.
    // The moment a hover/focus interaction starts, JS hides (A) (a class
    // that sets its opacity to 0 — it's a pseudo-element with no layout
    // footprint to begin with, so nothing shifts) and the SVG takes over
    // completely. On the way out it retracts all the way to zero —
    // nothing at all visible for a beat — and only then draws a short
    // second stroke through the SAME path (just its bottom segment) as
    // the visual "restore", swapping back to (A) only once that finishes
    // and the two would look identical. This is a deliberate choice:
    // without the intermediate all-zero state, there'd be a moment where
    // the retracting SVG frame's bottom edge and the reappeared border
    // are both visible at once — two lines instead of one.
    //
    // (A) is a pseudo-element rather than a real border specifically so
    // its position can be pixel-matched to (B): both are positioned from
    // the exact same numbers, computed once per button in layout() below
    // and written to --btn-border-* custom properties for (A) to read —
    // one shared source of truth, so the handoff between them can never
    // show even a 1px vertical jump. A native border-bottom can only ever
    // sit at the button's own border-box edge, which does NOT reliably
    // coincide with wherever (B)'s bottom edge ends up (see GAP below).
    //
    // Both (A) and (B)'s box are measured from the button's actual
    // rendered text content (every text node inside it, unioned into one
    // rectangle — covers multi-part labels like "Отримати Прорахунок",
    // split across a <span> prefix and trailing text) plus GAP on all
    // four sides, not from the button's own padding box: .btn--secondary
    // has zero horizontal padding, so the button's box IS the text's box,
    // and a frame that "surrounds the text with a gap" has to be sized
    // independently of it. (The SVG element itself needs `max-width: none`
    // in CSS — base.css's generic `img, svg { max-width: 100% }` reset
    // otherwise silently caps it back down to the button's own,
    // text-width-only size regardless of the width set here, which was
    // the actual cause of an earlier "frame clips the text" bug — the
    // measured box was already correct, the rendered SVG just wasn't
    // allowed to be as wide as it was told to be.)
    //
    // The path itself is a single closed rectangle, traced in one
    // continuous direction starting bottom-left: bottom (left-to-right)
    // -> right (upward) -> top (right-to-left) -> left (downward),
    // closing back at the start — genuine counter-clockwise. Reveal
    // amount is a single GSAP-tweened number (0..perimeter); interrupting
    // at any point in either direction (including mid-retract or
    // mid-restore) just kills whatever's running and retargets from
    // wherever `reveal` currently sits, so rapid enter/leave never jumps
    // or leaves a stray partial stroke.
    function setupSecondaryButtonSnake() {
      var pointerCapable = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (!pointerCapable) return; // touch: keep the plain bottom border only

      var SVG_NS = 'http://www.w3.org/2000/svg';
      var GAP = 16; // px, matches --space-2 (the button's own vertical padding) — a generous, consistent gap on every side
      var FULL_DURATION = 0.65; // seconds for a full 0<->perimeter traverse; partial distances scale proportionally, so speed feels constant regardless of how much is already drawn
      var RESTORE_PAUSE = 0.1; // seconds, a small clean beat between "SVG fully gone" and "bottom border starts drawing back in"
      var EASE = 'power2.inOut';
      var HIDDEN_BORDER_CLASS = 'btn--secondary--border-hidden';

      // The union of every text node's own rendered box, relative to the
      // button's top-left corner — robust to multi-part labels and to
      // this button having zero horizontal (but real vertical) padding.
      function measureTextBox(btn) {
        var walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
        var btnRect = btn.getBoundingClientRect();
        var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        var n;
        while ((n = walker.nextNode())) {
          if (!n.textContent || !n.textContent.trim()) continue;
          var range = document.createRange();
          range.selectNodeContents(n);
          var r = range.getBoundingClientRect();
          if (!r.width && !r.height) continue;
          left = Math.min(left, r.left - btnRect.left);
          top = Math.min(top, r.top - btnRect.top);
          right = Math.max(right, r.right - btnRect.left);
          bottom = Math.max(bottom, r.bottom - btnRect.top);
        }
        if (left === Infinity) return null;
        return { left: left, top: top, right: right, bottom: bottom };
      }

      document.querySelectorAll('.btn--secondary').forEach(function (btn) {
        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'btn--secondary__snake');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');

        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', 'btn--secondary__snake-path');
        svg.appendChild(path);
        btn.appendChild(svg);

        var perimeter = 0;
        var bottomLen = 0;
        var state = { reveal: 0 };
        var active = null; // whatever GSAP tween/delayedCall is currently in flight — always killable

        function render() {
          var reveal = Math.max(0, Math.min(perimeter, state.reveal));
          path.style.strokeDasharray = reveal + ' ' + (perimeter - reveal);
        }

        function killActive() {
          if (active) { active.kill(); active = null; }
        }

        function layout() {
          var text = measureTextBox(btn);
          var w = btn.offsetWidth;
          var h = btn.offsetHeight;
          if (!w || !h) return;
          // Both axes are measured from the text plus the same GAP, so
          // the frame surrounds the label with an even margin on every
          // side rather than hugging the button's own (zero-horizontal-
          // padding) box.
          var left = text ? text.left - GAP : 0;
          var top = text ? text.top - GAP : 0;
          var right = text ? text.right + GAP : w;
          var bottom = text ? text.bottom + GAP : h;
          var boxW = right - left;
          var boxH = bottom - top;
          if (boxW <= 0 || boxH <= 0) return;

          svg.style.left = left + 'px';
          svg.style.top = top + 'px';
          svg.setAttribute('width', boxW);
          svg.setAttribute('height', boxH);
          svg.setAttribute('viewBox', '0 0 ' + boxW + ' ' + boxH);
          path.setAttribute('d',
            'M 0 ' + boxH +
            ' L ' + boxW + ' ' + boxH +
            ' L ' + boxW + ' 0' +
            ' L 0 0 Z'
          );

          perimeter = path.getTotalLength();
          bottomLen = boxW;

          // The idle/restored bottom line (.btn--secondary::after) is
          // positioned from these exact same numbers — one shared source
          // of truth — so its baseline can never drift even a pixel from
          // where the SVG's own bottom edge sits.
          btn.style.setProperty('--btn-border-left', left + 'px');
          btn.style.setProperty('--btn-border-width', boxW + 'px');
          btn.style.setProperty('--btn-border-top', bottom + 'px');

          // A resize mid-interaction snaps to whichever end state matches
          // the button's current hover/focus condition, rather than
          // leaving a stale mid-animation value from before the resize.
          var isActive = btn.matches(':hover') || btn.matches(':focus-visible');
          killActive();
          btn.classList.toggle(HIDDEN_BORDER_CLASS, isActive);
          state.reveal = isActive ? perimeter : 0;
          render();
        }

        layout();

        if (window.ResizeObserver) {
          // ResizeObserver always fires one guaranteed callback as soon as
          // observation starts, reporting the size that's already current
          // — but that callback lands asynchronously, after every other
          // setup*() function below has had a chance to run and apply its
          // own immediateRender scroll-reveal transform (see the comment
          // above setupSecondaryButtonSnake()'s call site). Re-running
          // layout() there would silently re-measure against exactly the
          // corrupted state running this function first was meant to
          // avoid. The synchronous call above already covers that first,
          // accurate measurement, so only genuine subsequent resizes
          // (a real size change to the button itself) need to redo it.
          var skippedInitialCallback = false;
          new ResizeObserver(function () {
            if (!skippedInitialCallback) { skippedInitialCallback = true; return; }
            layout();
          }).observe(btn);
        } else {
          window.addEventListener('resize', layout);
        }

        function animateTo(target, onComplete) {
          var distance = Math.abs(target - state.reveal);
          var duration = perimeter ? FULL_DURATION * (distance / perimeter) : 0;
          return gsap.to(state, {
            reveal: target,
            duration: duration,
            ease: EASE,
            onUpdate: render,
            onComplete: onComplete
          });
        }

        function enter() {
          killActive();
          btn.classList.add(HIDDEN_BORDER_CLASS); // hide the CSS border the instant the SVG takes over
          active = animateTo(perimeter, function () { active = null; });
        }

        function leave() {
          killActive();
          // Stage 1: retract the whole frame to nothing — the CSS border
          // stays hidden throughout, so there is never a moment with both
          // an SVG remnant and the real border on screen together.
          active = animateTo(0, function () {
            // Stage 2: a short, clean beat with truly zero border at all.
            active = gsap.delayedCall(RESTORE_PAUSE, function () {
              // Stage 3: redraw just the bottom segment through the same
              // path/mechanism as the main frame — "the same stroke
              // continuing its language" rather than the plain border
              // just popping back on.
              active = animateTo(bottomLen, function () {
                // Hand off to the real CSS border, which by now sits in
                // exactly the same place the SVG's bottom segment just
                // finished at — an invisible swap — and hide the SVG.
                btn.classList.remove(HIDDEN_BORDER_CLASS);
                state.reveal = 0;
                render();
                active = null;
              });
            });
          });
        }

        btn.addEventListener('mouseenter', enter);
        btn.addEventListener('mouseleave', leave);
        btn.addEventListener('focus', function () {
          var visible = true;
          try { visible = btn.matches(':focus-visible'); } catch (err) {}
          if (visible) enter();
        });
        btn.addEventListener('blur', leave);
      });
    }
  }

  /* ---------------------------------------------------------------------
     Lenis: smooths native page scroll and feeds GSAP's own ticker instead
     of running a second rAF loop.
  --------------------------------------------------------------------- */

  function setupLenis() {
    if (typeof Lenis === 'undefined') return null;

    var lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      smoothTouch: false
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    return lenis;
  }

  // Waits for both DOM-ready AND the web fonts to finish swapping in
  // before booting. SplitText measures real, rendered text metrics
  // synchronously — running it while Cormorant Garamond is still loading
  // (the Google Fonts <link> uses font-display:swap, so the fallback serif
  // paints first) makes it split lines using the FALLBACK font's wider
  // metrics, baking that possibly-wrong line grouping permanently into the
  // DOM as separate block-level line masks. Once baked, no later CSS
  // (max-width, font-size, etc.) can fix it, since each detected "line" is
  // now a hard block boundary regardless of how much room is actually
  // available — this was the real cause behind two reported bugs: a
  // heading word clipped by its own (too-narrow, fallback-font-measured)
  // mask, and a 3-word heading splitting one-word-per-line. In practice
  // this adds no perceptible delay: the fonts are requested from the very
  // top of <head> (with preconnect) and are almost always already loaded
  // by the time DOMContentLoaded fires.
  function whenReady(cb) {
    function afterDom() {
      if (document.fonts && document.fonts.status !== 'loaded') {
        document.fonts.ready.then(cb);
      } else {
        cb();
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', afterDom);
    } else {
      afterDom();
    }
  }

  whenReady(boot);
})();
