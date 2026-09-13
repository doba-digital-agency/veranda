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

    function revealHeadingOnEnter(el, opts) {
      if (!el) return;
      opts = opts || {};
      var split = splitLines(el);
      if (split && split.lines.length) {
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
    setupPortfolio();
    setupTestimonials();
    setupQuickContact();

    window.addEventListener('load', function () {
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
      if (!hero || !content || !mediaImg || !title) return;

      var split = splitLines(title);
      var titleTargets = split && split.lines.length ? split.lines : [title];

      if (split && split.lines.length) gsap.set(titleTargets, { yPercent: 115, opacity: 0 });
      else gsap.set(titleTargets, { y: 24, opacity: 0 });
      if (meta) gsap.set(meta, { y: 20, opacity: 0 });
      gsap.set(mediaImg, { scale: 1.12 });

      // On-load entrance — above the fold, so this plays immediately
      // rather than waiting on a scroll trigger.
      var introTl = gsap.timeline({ delay: 0.15 });
      introTl.to(titleTargets, {
        yPercent: split && split.lines.length ? 0 : undefined,
        y: split && split.lines.length ? undefined : 0,
        opacity: 1,
        duration: 1.1,
        ease: 'power4.out',
        stagger: 0.08
      });
      if (meta) introTl.to(meta, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }, '-=0.75');
      introTl.to(mediaImg, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0);

      if (!isDesktop) return; // mobile: entrance only, no scroll-jacking pin

      // Hero's identity: an establishing shot that pulls back and settles
      // into a placed photograph — a single camera move, not four separate
      // ones. Depth is real here: the UI chrome (meta) is the closest layer
      // and clears first and fastest; the heading is mid-ground and clears
      // right after it, overlapping just enough to feel like one gesture;
      // the photo is the backdrop and is the slowest, longest move of the
      // three, so it reads as receding rather than merely shrinking. The
      // frame it settles into is deliberately off-center (not a symmetric
      // zoom-out) so it reads as a photograph being placed, not a UI tween.
      gsap.set(mediaWrap, { clipPath: 'inset(0% 0% 0% 0% round 0px)' });
      gsap.set([mediaImg, content], { willChange: 'transform' });

      gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: function () { return '+=' + window.innerHeight; },
          scrub: 1,
          pin: true,
          anticipatePin: 1
        }
      })
        // Closest layer clears first: the CTA/meta chrome peels off toward
        // the edge it already leans on, rather than just fading in place.
        .to(meta, { x: 70, opacity: 0, duration: 0.26, ease: 'power2.in' }, 0)
        // Mid-ground: the heading is pulled up and out through its own
        // line-masks, accelerating away as if drawn back into the scene.
        .to(titleTargets, {
          yPercent: split && split.lines.length ? -130 : undefined,
          y: split && split.lines.length ? undefined : -60,
          opacity: 0,
          duration: 0.36,
          stagger: 0.05,
          ease: 'power2.in'
        }, 0.06)
        // Backdrop: the photo keeps a slow, continuous, weighty drift for
        // nearly the whole pin — the longest move of the three, so it
        // reads as the thing the camera is pulling away from.
        .to(mediaImg, { scale: 1.3, duration: 0.85, ease: 'sine.inOut' }, 0)
        // The frame itself only starts closing in once the text has
        // cleared, and lands off-center — a photograph settling into
        // place, not a centered zoom.
        .to(mediaWrap, {
          clipPath: 'inset(8% 22% 24% 6% round 28px)',
          duration: 0.62,
          ease: 'power2.inOut'
        }, 0.22);
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
      revealCards(list, { dirs: ['left', 'right', 'left', 'right'] });
    }

    /* ----------------------- Services page: process steps ---------------- */

    function setupProcessSteps() {
      var heading = document.getElementById('process-heading');
      var grid = document.querySelector('.process-grid');
      revealHeadingOnEnter(heading);
      revealCards(grid);
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
