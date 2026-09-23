(function () {
  var toggle = document.querySelector('[data-nav-toggle]');
  var panel = document.querySelector('[data-mobile-nav]');
  var closeBtn = panel ? panel.querySelector('[data-nav-close]') : null;

  if (!toggle || !panel) return;

  var lastFocused = null;

  function openNav() {
    lastFocused = document.activeElement;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';

    var firstLink = panel.querySelector('a, button');
    if (firstLink) firstLink.focus();

    document.addEventListener('keydown', onKeydown);
  }

  function closeNav() {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';

    document.removeEventListener('keydown', onKeydown);

    if (lastFocused) {
      lastFocused.focus();
    } else {
      toggle.focus();
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      closeNav();
      return;
    }

    if (event.key === 'Tab') {
      var focusable = panel.querySelectorAll('a, button');
      if (focusable.length === 0) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  toggle.addEventListener('click', function () {
    var isOpen = panel.classList.contains('is-open');
    if (isOpen) {
      closeNav();
    } else {
      openNav();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeNav);
  }

  panel.setAttribute('aria-hidden', 'true');
})();

(function () {
  var stage = document.querySelector('[data-carousel]');
  if (!stage) return;

  var slides = [
    {
      title: 'Банкет',
      desc: 'Класичне святкування за столами з повним сервісом офіціантів — для весіль, ювілеїв і корпоративів.',
      guests: 'від 20 гостей',
      service: 'повний сервіс',
      image: 'assets/images/service-banquet-longtable.webp'
    },
    {
      title: 'Фуршет',
      desc: 'Класичне святкування за столами з повним сервісом офіціантів — для весіль, ювілеїв і корпоративів.',
      guests: 'від 20 гостей',
      service: 'повний сервіс',
      image: 'assets/images/service-banquet-longtable.webp'
    },
    {
      title: 'Кейтеринг-бокси',
      desc: 'Класичне святкування за столами з повним сервісом офіціантів — для весіль, ювілеїв і корпоративів.',
      guests: 'від 20 гостей',
      service: 'повний сервіс',
      image: 'assets/images/service-banquet-longtable.webp'
    },
    {
      title: 'Кенді-бар / коктейль-бар',
      desc: 'Класичне святкування за столами з повним сервісом офіціантів — для весіль, ювілеїв і корпоративів.',
      guests: 'від 20 гостей',
      service: 'повний сервіс',
      image: 'assets/images/service-banquet-longtable.webp'
    }
  ];

  var titleEl = stage.querySelector('[data-carousel-title]');
  var descEl = stage.querySelector('[data-carousel-desc]');
  var guestsEl = stage.querySelector('[data-carousel-guests]');
  var serviceEl = stage.querySelector('[data-carousel-service]');
  var imageEl = stage.querySelector('[data-carousel-image]');
  var progress = stage.querySelector('[data-carousel-progress]');
  var indexEl = document.querySelector('[data-carousel-index]');
  var prevBtns = document.querySelectorAll('[data-carousel-prev]');
  var nextBtns = document.querySelectorAll('[data-carousel-next]');
  var current = 0;

  slides.forEach(function (slide, index) {
    var segment = document.createElement('button');
    segment.type = 'button';
    segment.className = 'carousel-progress__segment';
    segment.setAttribute('aria-label', 'Показати формат: ' + slide.title);
    segment.addEventListener('click', function () {
      goTo(index);
    });
    progress.appendChild(segment);
  });
  var segments = progress.querySelectorAll('.carousel-progress__segment');

  function render() {
    var slide = slides[current];
    titleEl.textContent = slide.title;
    descEl.textContent = slide.desc;
    guestsEl.textContent = slide.guests;
    serviceEl.textContent = slide.service;
    imageEl.src = slide.image;
    imageEl.alt = 'Сервірований стіл — ' + slide.title;

    if (indexEl) {
      indexEl.textContent = String(current + 1).padStart(2, '0');
    }

    segments.forEach(function (segment, index) {
      segment.classList.toggle('is-active', index === current);
    });
  }

  var panel = stage.querySelector('.service-panel');

  function goTo(rawIndex) {
    var next = (rawIndex + slides.length) % slides.length;
    if (next === current) return;
    // Direction the carousel is conceptually moving — next/prev buttons
    // and drag pass current±1 (so this is exact); the progress segments
    // pass an absolute target index, where this is just a reasonable
    // "which way is shorter" default. Only used to pick which edge the
    // GSAP transition (scroll-experience.js) enters/exits from.
    var direction = rawIndex > current ? 1 : -1;
    current = next;

    if (window.__servicePanelTransition && panel) {
      window.__servicePanelTransition(render, direction);
    } else if (panel) {
      // Fallback when GSAP never loaded (or reduced-motion skipped its
      // boot entirely) — the plain cross-fade this carousel always had.
      panel.classList.add('is-transitioning');
      window.setTimeout(function () {
        render();
        panel.classList.remove('is-transitioning');
      }, 150);
    } else {
      render();
    }
  }

  prevBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      goTo(current - 1);
    });
  });

  nextBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      goTo(current + 1);
    });
  });

  // Swipe-to-advance: this carousel swaps one panel's content in place
  // rather than translating a row of cards (see the portfolio carousel
  // below for that pattern), so dragging here is a gesture recognizer —
  // a real horizontal drag past the threshold on release just calls the
  // same goTo() the arrow buttons already use, instead of visually
  // following the pointer. Starting a drag from inside a link/button
  // (service-panel__actions) is ignored so those keep working untouched.
  var media = stage.querySelector('.service-panel__media');
  if (media && window.PointerEvent) {
    var DRAG_THRESHOLD = 40;
    var dragging = false;
    var startX = 0;
    var pointerId = null;

    media.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('a, button')) return;
      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      media.classList.add('is-dragging');
    });

    media.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pointerId) return;
      e.preventDefault();
    });

    function endDrag(e) {
      if (!dragging || (e && e.pointerId !== pointerId)) return;
      dragging = false;
      media.classList.remove('is-dragging');
      var dx = e.clientX - startX;
      if (Math.abs(dx) > DRAG_THRESHOLD) {
        goTo(dx < 0 ? current + 1 : current - 1);
      }
    }

    media.addEventListener('pointerup', endDrag);
    media.addEventListener('pointercancel', endDrag);
  }

  render();
})();

/*
  Infinite-loop drag carousel — factory, shared by Home's portfolio/events
  slider and About's team-member and photo-strip carousels. Originally
  written just for the portfolio carousel; extracted into
  createLoopCarousel() when About needed the exact same drag/loop/snap
  mechanics on two more sections rather than a second, simplified slider
  model (see CHANGELOG.md).

  config:
    viewport, track, prev, next  — selectors (each queried once)
    progress                     — optional selector for a .carousel-progress
                                    container; if present, one
                                    .carousel-progress__segment child per
                                    real card is toggled .is-active to match
                                    whichever real card is currently nearest
                                    center (About's team/gallery carousels;
                                    the portfolio carousel has no dots and
                                    omits this)
    mobileOnly                   — if true, the carousel only builds/drags
                                    below 1024px; at desktop the clones are
                                    torn back down to the plain real cards so
                                    CSS can lay them out as a static grid
                                    (About's photo strip fits its row exactly
                                    within the 1440px desktop frame with no
                                    overflow, so it's mobile-only; the team
                                    section's row is wider than the frame at
                                    every breakpoint including desktop —
                                    confirmed via Figma's own node metadata —
                                    so it omits this and drags everywhere,
                                    same as portfolio's slider)
*/
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SNAP_MS = reduceMotion ? 0 : 450;
  var SNAP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var DRAG_THRESHOLD = 6; // px of pointer movement before a press counts as a drag rather than a click
  var REPEATS = 2; // clone sets on each side of the real one — drag/loop buffer
  var MAX_SKEW = 8; // deg — cards lean with drag velocity (see feedSkew)
  var SKEW_PER_VELOCITY = 5; // deg per px/ms of pointer speed

  function createLoopCarousel(config) {
    var viewport = document.querySelector(config.viewport);
    var track = document.querySelector(config.track);
    if (!viewport || !track) return;

    var prevBtns = document.querySelectorAll(config.prev);
    var nextBtns = document.querySelectorAll(config.next);
    var progress = config.progress ? document.querySelector(config.progress) : null;
    var mobileQuery = config.mobileOnly ? window.matchMedia('(max-width: 1023.98px)') : null;

    // True infinite loop: the real cards are cloned REPEATS times on each
    // side into one long flex track. Dragging/snapping just translates that
    // track; whenever the settled position drifts a full set-width away
    // from "home", it's snapped back by exactly one set-width with no
    // transition — the clones there are pixel-identical to what was just
    // showing, so nothing visibly jumps. This works for any viewport width
    // or card count without hard-coding either (see buildTrack/measure).
    var originalCards = Array.prototype.slice.call(track.children);
    var setCount = originalCards.length;
    if (!setCount) return;

    var step = 0;
    var setWidth = 0;
    var homeOffset = 0;
    var offset = 0;
    var isDragging = false;
    var dragStartX = 0;
    var dragStartOffset = 0;
    var pointerMoved = 0;
    var activePointerId = null;
    var recenterTimer = null;
    var active = false;
    var segments = [];

    // Velocity skew: while dragging, the cards lean with the pointer's
    // speed (top trailing behind, like something with weight) and settle
    // back once it slows. Only ever writes --carousel-skew on the track;
    // the cards' own CSS transform reads it (.has-velocity-skew,
    // components.css), so the track's translateX above stays the only
    // transform this factory sets inline. Skipped under reduced motion.
    var skew = 0;
    var skewTarget = 0;
    var skewRaf = null;
    var lastMoveX = 0;
    var lastMoveT = 0;

    function renderSkew() {
      skewTarget *= 0.85;
      skew += (skewTarget - skew) * 0.25;
      if (Math.abs(skew) < 0.02 && Math.abs(skewTarget) < 0.02) {
        skew = 0;
        skewRaf = null;
        track.style.removeProperty('--carousel-skew');
        return;
      }
      track.style.setProperty('--carousel-skew', skew.toFixed(2) + 'deg');
      skewRaf = window.requestAnimationFrame(renderSkew);
    }

    function kickSkew(deg) {
      if (reduceMotion) return;
      skewTarget = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, deg));
      if (!skewRaf) skewRaf = window.requestAnimationFrame(renderSkew);
    }

    function feedSkew(x) {
      var now = window.performance.now();
      var dt = now - lastMoveT;
      if (dt > 0 && dt < 100) kickSkew((x - lastMoveX) / dt * SKEW_PER_VELOCITY);
      lastMoveX = x;
      lastMoveT = now;
    }

    function resetSkew() {
      if (skewRaf) window.cancelAnimationFrame(skewRaf);
      skewRaf = null;
      skew = skewTarget = 0;
      track.style.removeProperty('--carousel-skew');
    }

    function buildProgress() {
      if (!progress) return;
      segments = Array.prototype.slice.call(progress.querySelectorAll('.carousel-progress__segment'));
    }

    function updateProgress() {
      if (!progress || !segments.length || !step) return;
      // "Next" moves the track left, i.e. offset becomes MORE negative —
      // the opposite sign from the forward index count — so this is
      // (homeOffset - offset), not (offset - homeOffset).
      var realIndex = Math.round((homeOffset - offset) / step) % setCount;
      if (realIndex < 0) realIndex += setCount;
      segments.forEach(function (seg, i) {
        seg.classList.toggle('is-active', i === realIndex);
      });
    }

    function buildTrack() {
      track.innerHTML = '';
      var totalSets = REPEATS * 2 + 1;
      for (var s = 0; s < totalSets; s++) {
        originalCards.forEach(function (card) {
          var clone = card.cloneNode(true);
          if (s !== REPEATS) {
            clone.setAttribute('aria-hidden', 'true');
            // The card itself may be an <a>/<button> as well as possibly
            // containing further links/buttons — both need excluding from
            // tab order for the decorative (non-real) sets.
            if (clone.matches('a, button')) clone.setAttribute('tabindex', '-1');
            clone.querySelectorAll('a, button').forEach(function (el) { el.setAttribute('tabindex', '-1'); });
          }
          track.appendChild(clone);
        });
      }
      track.querySelectorAll('img').forEach(function (img) {
        img.setAttribute('draggable', 'false');
      });
    }

    // Restores the track to exactly its original, un-cloned real cards —
    // used when a mobileOnly carousel crosses up into desktop, where CSS
    // takes over as a plain static grid/row instead.
    function teardown() {
      track.innerHTML = '';
      originalCards.forEach(function (card) { track.appendChild(card); });
      track.style.transition = 'none';
      track.style.transform = '';
      track.classList.remove('has-velocity-skew');
      resetSkew();
      step = 0;
      setWidth = 0;
      homeOffset = 0;
      offset = 0;
    }

    function measure() {
      var first = track.children[0];
      if (!first) return;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      step = first.getBoundingClientRect().width + gap;
      setWidth = step * setCount;
      homeOffset = -(REPEATS * setWidth);
    }

    function applyTransform(px, animate) {
      track.style.transition = animate && !reduceMotion
        ? 'transform ' + SNAP_MS + 'ms ' + SNAP_EASE
        : 'none';
      track.style.transform = 'translateX(' + px + 'px)';
    }

    function recenter() {
      if (!setWidth) return;
      while (offset <= homeOffset - setWidth) {
        offset += setWidth;
        applyTransform(offset, false);
      }
      while (offset >= homeOffset + setWidth) {
        offset -= setWidth;
        applyTransform(offset, false);
      }
    }

    function snapToNearestCard(animate) {
      if (!step) return;
      offset = Math.round((offset - homeOffset) / step) * step + homeOffset;
      applyTransform(offset, animate);
      updateProgress();
      window.clearTimeout(recenterTimer);
      recenterTimer = window.setTimeout(recenter, SNAP_MS + 30);
    }

    function shiftByCards(n) {
      if (!active || !step) return;
      offset -= n * step;
      applyTransform(offset, true);
      // A button press leans the cards the same way a quick drag would.
      kickSkew(-n * 3);
      updateProgress();
      window.clearTimeout(recenterTimer);
      recenterTimer = window.setTimeout(recenter, SNAP_MS + 30);
    }

    nextBtns.forEach(function (btn) { btn.addEventListener('click', function () { shiftByCards(1); }); });
    prevBtns.forEach(function (btn) { btn.addEventListener('click', function () { shiftByCards(-1); }); });

    /* ------------------------- Pointer drag ------------------------- */

    function onPointerDown(e) {
      if (!active) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!step) return;
      isDragging = true;
      pointerMoved = 0;
      activePointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartOffset = offset;
      lastMoveX = e.clientX;
      lastMoveT = window.performance.now();
      window.clearTimeout(recenterTimer);
      track.style.transition = 'none';
      viewport.classList.add('is-dragging');
      // Pointer capture is deliberately NOT taken here — see onPointerMove.
    }

    function onPointerMove(e) {
      if (!isDragging || e.pointerId !== activePointerId) return;
      var dx = e.clientX - dragStartX;
      var wasBelowThreshold = pointerMoved <= DRAG_THRESHOLD;
      pointerMoved = Math.max(pointerMoved, Math.abs(dx));
      // Capture only once the press has become a real drag. Capturing on
      // pointerdown retargets the follow-up `click` to the viewport itself
      // (Chromium dispatches click to the capture target), so a plain click
      // on a card that is an <a> (Home's portfolio cards) never reached the
      // link and never navigated.
      if (wasBelowThreshold && pointerMoved > DRAG_THRESHOLD && viewport.setPointerCapture) {
        try { viewport.setPointerCapture(e.pointerId); } catch (err) {}
      }
      offset = dragStartOffset + dx;
      applyTransform(offset, false);
      feedSkew(e.clientX);
    }

    function suppressClickOnce(e) {
      e.preventDefault();
      e.stopPropagation();
      viewport.removeEventListener('click', suppressClickOnce, true);
    }

    function endDrag(e) {
      if (!isDragging || (e && e.pointerId !== activePointerId)) return;
      isDragging = false;
      activePointerId = null;
      viewport.classList.remove('is-dragging');
      var wasRealDrag = pointerMoved > DRAG_THRESHOLD;
      snapToNearestCard(true);
      if (wasRealDrag) {
        // A real drag shouldn't also fire a click on release — captured once,
        // scoped to this viewport only (never `window`, which could later
        // swallow an unrelated click elsewhere on the page), and with a
        // short safety timeout in case the browser never actually fires the
        // follow-up click at all (e.g. a drag that ends off the element).
        viewport.addEventListener('click', suppressClickOnce, true);
        window.setTimeout(function () {
          viewport.removeEventListener('click', suppressClickOnce, true);
        }, 350);
      }
    }

    if (window.PointerEvent) {
      viewport.addEventListener('pointerdown', onPointerDown);
      viewport.addEventListener('pointermove', onPointerMove);
      viewport.addEventListener('pointerup', endDrag);
      viewport.addEventListener('pointercancel', endDrag);
    }

    function enable() {
      if (active) return;
      active = true;
      buildTrack();
      if (!reduceMotion) track.classList.add('has-velocity-skew');
      buildProgress();
      measure();
      offset = homeOffset;
      applyTransform(offset, false);
      updateProgress();
    }

    function disable() {
      if (!active) return;
      active = false;
      teardown();
    }

    function onResize() {
      if (mobileQuery) {
        if (mobileQuery.matches) {
          enable();
          measure();
          offset = homeOffset;
          applyTransform(offset, false);
        } else {
          disable();
        }
      } else if (active) {
        measure();
        offset = homeOffset;
        applyTransform(offset, false);
      }
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(onResize, 150);
    });

    if (mobileQuery) {
      if (mobileQuery.matches) enable();
    } else {
      enable();
    }
  }

  createLoopCarousel({
    viewport: '[data-portfolio-carousel]',
    track: '[data-portfolio-track]',
    prev: '[data-portfolio-prev]',
    next: '[data-portfolio-next]'
  });

  createLoopCarousel({
    viewport: '[data-team-carousel]',
    track: '[data-team-track]',
    prev: '[data-team-prev]',
    next: '[data-team-next]',
    progress: '[data-team-progress]'
    // No mobileOnly: Figma's desktop frame shows this row overflowing the
    // 1440px canvas too (confirmed via node metadata — the 4th card's
    // right edge sits at x=1696, past the 1440px frame), so it's a
    // drag/scroll carousel at every breakpoint, same as the portfolio
    // slider. Desktop just never shows the dots/arrows (hidden by the
    // existing generic `@media (min-width:1024px)` rule on
    // .carousel-progress/.carousel-controls-mobile) — Figma's desktop
    // frame has none either, drag-only there.
  });

  createLoopCarousel({
    viewport: '[data-gallery-carousel]',
    track: '[data-gallery-track]',
    prev: '[data-gallery-prev]',
    next: '[data-gallery-next]',
    progress: '[data-gallery-progress]',
    mobileOnly: true
  });
})();

(function () {
  var links = document.querySelectorAll('a[href^="#"]:not([href="#"])');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  links.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;

      event.preventDefault();

      // The site header is fixed (always covers the top of the viewport),
      // so every same-page anchor scroll needs to leave room for it or the
      // target's own heading lands partly hidden underneath it. On top of
      // that, if this link lives inside a sticky nav (marked generically
      // with data-sticky-nav — currently just Menu's category bar, but not
      // hardcoded to it by name so any future sticky nav gets the same
      // treatment for free), that nav docks directly under the header once
      // it starts sticking, so its height needs reserving too. Both
      // measured live (not a fixed guess), since either can differ by
      // breakpoint (wraps to more/less padding, font-size, etc.) and could
      // change independently of this file.
      var header = document.querySelector('.site-header');
      var headerOffset = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
      var stickyNav = link.closest('[data-sticky-nav]');
      var navOffset = stickyNav ? Math.ceil(stickyNav.getBoundingClientRect().height) : 0;
      // The header hides on the way down (hide-on-scroll module below), so
      // reserve its height only if it will still be showing on arrival —
      // otherwise the target would land with an empty header-sized gap
      // above it (and any sticky nav has moved up to the viewport top).
      var dest = target.getBoundingClientRect().top + window.scrollY - headerOffset - navOffset;
      var headerApi = window.__verandaHeader;
      if (headerApi && !headerApi.visibleAt(dest)) headerOffset = 0;
      var offset = headerOffset + navOffset;

      // Checked at click time, not at listener-attach time (this file
      // loads before Lenis — see the script-order rule in CLAUDE.md/
      // ANIMATIONS.md — so window.__lenis doesn't exist yet when this
      // IIFE runs, but it does exist by the time a user actually clicks,
      // once scroll-experience.js has booted; it never exists at all under
      // reduced motion, since scroll-experience.js's boot() returns before
      // ever constructing Lenis — so this branch only ever runs smoothed,
      // never fighting reduced-motion). Native
      // scrollIntoView({behavior:'smooth'}) turned out not to reliably
      // finish very long scrolls (confirmed on the Menu page's category
      // nav, which can jump several thousand px down a single tall page —
      // it silently stopped partway, no error). Lenis's own scrollTo drives
      // the same rAF loop every other scroll animation on the site already
      // uses, so it reliably completes regardless of distance.
      if (window.__lenis && typeof window.__lenis.scrollTo === 'function') {
        // Lenis's offset is ADDED to the natural scroll position — negative
        // stops that many px short, leaving exactly enough room at the top
        // of the viewport for the sticky nav to sit without covering the
        // target's own heading.
        window.__lenis.scrollTo(target, offset ? { offset: -offset } : undefined);
        return;
      }

      // No Lenis (reduced motion, or GSAP/Lenis failed to load). Under
      // reduced motion this must be an instant jump anyway (an animated
      // 'smooth' scroll would itself be a motion regression) — which also
      // happens to sidestep the same long-distance bug entirely, since
      // there's no in-flight animation left to get cut short.
      // scrollIntoView has no numeric-offset option, so when a sticky-nav
      // offset applies, compute the absolute target position by hand
      // instead and use plain window.scrollTo.
      if (offset) {
        var targetTop = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: reduceMotion ? 'auto' : 'smooth' });
        return;
      }

      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });
})();

(function () {
  // The site can now have more than one phone field live in the same
  // document at once (the inline Home quick-contact form plus the global
  // contact modal's own form both render a tel input) — this used to be a
  // single hardcoded `getElementById('home-phone')` instance, which broke
  // the moment a second phone field with a different id existed on the
  // page (getElementById only ever finds one element, so the modal's
  // field silently got no mask at all). initPhoneMask() is the exact same
  // logic as before, just parameterized so every `[data-phone-mask]`
  // input gets its own independent instance/closure over its own `digits`
  // buffer — one shared implementation, never a second copy of this logic.
  var inputs = document.querySelectorAll('[data-phone-mask]');
  inputs.forEach(initPhoneMask);

  function initPhoneMask(input) {
  // A "controlled input" mask: `digits` is the single source of truth (a
  // flat, un-annotated string of 0-12 raw digits — never a value re-parsed
  // out of the formatted display text). Every edit — typed key, Backspace,
  // Delete, a selection replace, or a paste — is resolved directly against
  // this buffer at an explicit digit-index range, then the whole display
  // string is re-rendered from it and the caret placed by digit-index.
  // Nothing here ever re-derives "is this fragment the country code" from
  // a partial string, which is what let a stray "380" reappear while
  // deleting before: the old code re-guessed the prefix from whatever
  // digits were left after every keystroke, so deleting into the middle
  // of "380" left a fragment (e.g. "38") that looked like a bare
  // subscriber number and got a fresh "380" prepended to it. A flat
  // buffer only ever shrinks or grows by exactly what the edit asked for.
  var digits = '';

  // "+38 067 123 45 67" — the exact grouping already used elsewhere on the
  // site (contact-tile, footer) for this number: 2/3/3/2/2 digits, purely
  // a cosmetic split of the flat sequence, not a country/local boundary.
  function formatFromDigits(d) {
    if (!d) return '';
    var out = '+' + d.slice(0, 2);
    if (d.length > 2) out += ' ' + d.slice(2, 5);
    if (d.length > 5) out += ' ' + d.slice(5, 8);
    if (d.length > 8) out += ' ' + d.slice(8, 10);
    if (d.length > 10) out += ' ' + d.slice(10, 12);
    return out;
  }

  // Paste-only normalization: a pasted string is one unambiguous, atomic
  // chunk (unlike a single typed keystroke), so it's safe to recognize a
  // leading 0 (a locally-written "0671234567") or an already-present
  // "380"/"+380" and fold it down to the canonical 12-digit sequence
  // without duplicating the country code.
  function normalizePastedDigits(text) {
    var d = text.replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('380') === 0) return d.slice(0, 12);
    if (d.charAt(0) === '0') return ('380' + d.slice(1)).slice(0, 12);
    return ('380' + d).slice(0, 12);
  }

  function digitIndexAtPos(formatted, pos) {
    var count = 0;
    for (var i = 0; i < pos && i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) count++;
    }
    return count;
  }

  function posForDigitIndex(formatted, index) {
    if (index <= 0) return formatted ? 1 : 0; // right after "+"
    var seen = 0;
    for (var i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        seen++;
        if (seen === index) return i + 1;
      }
    }
    return formatted.length;
  }

  function commit(newDigits, caretDigitIndex) {
    digits = newDigits.slice(0, 12);
    var formatted = formatFromDigits(digits);
    input.value = formatted;
    var pos = posForDigitIndex(formatted, Math.min(caretDigitIndex, digits.length));
    input.setSelectionRange(pos, pos);
  }

  var supportsBeforeInput = 'onbeforeinput' in input;

  if (supportsBeforeInput) {
    input.addEventListener('beforeinput', function (e) {
      var type = e.inputType || '';
      // Paste is handled entirely by the dedicated 'paste' listener below
      // (it needs clipboardData, which isn't reliably on the InputEvent).
      if (type === 'insertFromPaste' || type === 'insertFromPasteAsQuotation') {
        e.preventDefault();
        return;
      }

      var selStart = input.selectionStart;
      var selEnd = input.selectionEnd;
      var formatted = input.value;
      var startIdx = digitIndexAtPos(formatted, selStart);
      var endIdx = digitIndexAtPos(formatted, selEnd);

      if (type.indexOf('insert') === 0) {
        e.preventDefault();
        var incoming = (e.data || '').replace(/\D/g, '');
        var base = digits.slice(0, startIdx) + digits.slice(endIdx);
        commit(base.slice(0, startIdx) + incoming + base.slice(startIdx), startIdx + incoming.length);
        return;
      }

      if (type.indexOf('delete') === 0) {
        e.preventDefault();
        if (startIdx !== endIdx) {
          // An explicit selection (incl. select-all) — remove exactly that
          // digit range, regardless of forward/backward delete.
          commit(digits.slice(0, startIdx) + digits.slice(endIdx), startIdx);
        } else if (type.indexOf('Forward') !== -1) {
          commit(digits.slice(0, startIdx) + digits.slice(startIdx + 1), startIdx);
        } else if (startIdx > 0) {
          commit(digits.slice(0, startIdx - 1) + digits.slice(startIdx), startIdx - 1);
        }
        // startIdx === 0 with no selection and a backward delete: nothing
        // to remove — field is already empty at the caret, leave as-is.
        return;
      }

      // Any other input type (IME composition, drop, etc.) — not part of
      // the supported editing set for this field; block it so the buffer
      // never gets out of sync with an uncontrolled native mutation.
      e.preventDefault();
    });
  } else {
    // Fallback for a browser without beforeinput support: re-sync from
    // whatever the native edit produced. Caret placement is best-effort
    // here (end of the edited digits) rather than fully precise, but the
    // buffer itself never re-injects a country code — only ever reflects
    // exactly the digits currently present.
    input.addEventListener('input', function () {
      var caret = input.selectionStart == null ? input.value.length : input.selectionStart;
      var digitsBefore = digitIndexAtPos(input.value, caret);
      commit(input.value.replace(/\D/g, ''), digitsBefore);
    });
  }

  input.addEventListener('paste', function (e) {
    e.preventDefault();
    var clipboard = e.clipboardData || window.clipboardData;
    var text = clipboard ? clipboard.getData('text') : '';
    var incoming = normalizePastedDigits(text);
    if (!incoming) return;
    var selStart = input.selectionStart;
    var selEnd = input.selectionEnd;
    var startIdx = digitIndexAtPos(input.value, selStart);
    var endIdx = digitIndexAtPos(input.value, selEnd);
    var base = digits.slice(0, startIdx) + digits.slice(endIdx);
    commit(base.slice(0, startIdx) + incoming + base.slice(startIdx), startIdx + incoming.length);
  });
  }
})();

(function () {
  var forms = document.querySelectorAll('[data-quick-form]');

  forms.forEach(function (form) {
    var successEl = form.querySelector('[data-form-success]');
    var errorEl = form.querySelector('[data-form-error]');

    // Empty <input type="date"> still renders its "дд.мм.рррр" mask as
    // real text (no ::placeholder to style), so mark it for the muted
    // placeholder color in CSS. Contacts page only; no-op elsewhere.
    var dateInputs = form.querySelectorAll('input[type="date"]');
    function syncDateEmpty() {
      dateInputs.forEach(function (input) {
        input.classList.toggle('is-empty', !input.value);
      });
    }
    if (dateInputs.length) {
      syncDateEmpty();
      form.addEventListener('input', syncDateEmpty);
      form.addEventListener('change', syncDateEmpty);
      form.addEventListener('reset', function () { setTimeout(syncDateEmpty, 0); });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var isValid = form.checkValidity();

      if (successEl) successEl.hidden = !isValid;
      if (errorEl) errorEl.hidden = isValid;

      if (isValid) form.reset();
    });
  });
})();

/*
  Photo lightbox content sync — Menu page food photos. The actual open/
  close/focus-trap/Escape/Lenis-stop behavior is entirely owned by the
  generic [data-modal] system below (this page's lightbox is just a second
  data-modal="lightbox" instance of it, see components.css); this listener
  only copies the clicked photo into the lightbox's <img> first. Capture
  phase (true as the 3rd addEventListener arg) guarantees it runs before
  that system's own bubble-phase click listener opens the modal, so the
  right image is already in place the instant it becomes visible — no-ops
  harmlessly on any page without a .menu-item__media-trigger (every page
  except menu.html).
*/
(function () {
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('.menu-item__media-trigger');
    if (!trigger) return;

    var sourceImg = trigger.querySelector('img');
    var lightboxImg = document.querySelector('[data-modal="lightbox"] [data-lightbox-image]');
    if (!sourceImg || !lightboxImg) return;

    lightboxImg.src = sourceImg.currentSrc || sourceImg.src;
    lightboxImg.alt = sourceImg.alt;
  }, true);
})();

/*
  Global contact/quote modal. One `[data-modal="contact"]` instance lives on
  every page (duplicated markup, like the header/footer — there's no build
  step to share a partial); any CTA anywhere becomes a trigger just by
  carrying `data-modal-open="contact"`, matched against a modal by that
  name via delegation, so adding a new trigger later never needs a new
  listener wired up here.

  This module owns showing/hiding the modal (the [hidden] attribute + an
  `.is-open` class CSS transitions off of — see components.css) and is
  entirely independent of GSAP: main.js loads before GSAP (see the script
  order in index.html/services.html) and everything here must work even if
  GSAP never loads or prefers-reduced-motion disables scroll-experience.js
  entirely. The "cinematic reveal" is the CSS transition on `.contact-modal`
  / `.contact-modal__panel` itself (opacity/transform), which keeps working
  identically either way — there's no separate GSAP-only code path to fall
  back from.

  Scroll locking talks to Lenis defensively (`window.__lenis`, exposed by
  scroll-experience.js once it boots) rather than assuming it exists, for
  the same reason: this file cannot depend on that script having run.
*/
(function () {
  var modals = document.querySelectorAll('[data-modal]');
  if (!modals.length) return;

  var activeModal = null;
  var activeTrigger = null;
  var hideTimer = null;

  function getFocusable(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
    );
  }

  function onKeydown(event) {
    if (!activeModal) return;

    if (event.key === 'Escape') {
      closeModal(activeModal);
      return;
    }

    if (event.key === 'Tab') {
      var panel = activeModal.querySelector('.contact-modal__panel') || activeModal;
      var focusable = getFocusable(panel);
      if (!focusable.length) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function openModal(modal, trigger) {
    if (modal === activeModal) return;
    window.clearTimeout(hideTimer);

    activeModal = modal;
    activeTrigger = trigger || document.activeElement;

    modal.hidden = false;
    // Force a layout flush between removing [hidden] and adding the class
    // that transitions opacity/transform — otherwise the browser can batch
    // both changes into one paint and skip the transition entirely.
    void modal.offsetWidth;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    document.body.classList.add('modal-open');
    if (window.__lenis && typeof window.__lenis.stop === 'function') window.__lenis.stop();

    document.addEventListener('keydown', onKeydown);

    var panel = modal.querySelector('.contact-modal__panel') || modal;
    // Land focus on the first actual form field rather than the close
    // button that happens to precede it in the DOM — the whole point of
    // this modal is to fill the form, so typing should work immediately.
    var firstField = panel.querySelector('input, textarea, select');
    var focusable = getFocusable(panel);
    if (firstField) firstField.focus();
    else if (focusable.length) focusable[0].focus();
  }

  function closeModal(modal) {
    if (modal !== activeModal) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    document.body.classList.remove('modal-open');
    if (window.__lenis && typeof window.__lenis.start === 'function') window.__lenis.start();

    document.removeEventListener('keydown', onKeydown);

    if (activeTrigger && typeof activeTrigger.focus === 'function') activeTrigger.focus({ preventScroll: true });
    activeModal = null;

    // Lets a page-specific module (Portfolio's gallery lightbox) play its
    // own close choreography without this generic system knowing about it.
    modal.dispatchEvent(new CustomEvent('veranda:modalclose', { bubbles: true }));

    // Matches the CSS transition duration (0.35s) with a small margin —
    // [hidden] is only restored once the fade-out has actually finished,
    // so a reduced-motion visitor (transition:none) still gets it removed
    // almost immediately rather than waiting out a transition that never
    // runs.
    hideTimer = window.setTimeout(function () {
      modal.hidden = true;
    }, 400);
  }

  document.addEventListener('click', function (event) {
    var opener = event.target.closest('[data-modal-open]');
    if (opener) {
      var name = opener.getAttribute('data-modal-open');
      var modal = document.querySelector('[data-modal="' + name + '"]');
      if (modal) {
        event.preventDefault();
        openModal(modal, opener);
      }
      return;
    }

    var closer = event.target.closest('[data-modal-close]');
    if (closer) {
      var closeTarget = closer.closest('[data-modal]');
      if (closeTarget) closeModal(closeTarget);
      return;
    }

    // A click that lands on the overlay itself (not bubbled from the
    // panel) closes the modal; a click anywhere inside .contact-modal__panel
    // never reaches this branch since event.target won't be the modal root.
    modals.forEach(function (modal) {
      if (event.target === modal) closeModal(modal);
    });
  });
})();

/*
  Menu photo lightbox — motion hooks. The capture-phase listener near the
  top of this file copies the clicked dish photo into the lightbox; the
  generic modal system opens/closes it. This only adds the optional
  expand-from-thumbnail / collapse-back motion that scroll-experience.js
  registers on window.__verandaFx (same as Portfolio's gallery lightbox).
  Registered after the generic modal module on purpose: this bubbling
  click runs once the lightbox is already open and laid out.
*/
(function () {
  var lightbox = document.querySelector('.photo-lightbox:not(.photo-lightbox--gallery)');
  if (!lightbox) return;
  var image = lightbox.querySelector('[data-lightbox-image]');
  if (!image) return;
  var lastThumb = null;

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('.menu-item__media-trigger');
    if (!trigger) return;
    lastThumb = trigger.querySelector('img');
    var open = window.__verandaFx && window.__verandaFx.lightboxOpen;
    if (open && lastThumb) open(lastThumb, image);
  });

  lightbox.addEventListener('veranda:modalclose', function () {
    var close = window.__verandaFx && window.__verandaFx.lightboxClose;
    if (close && lastThumb) close(image, lastThumb);
  });
})();

/*
  Menu category nav — active-indicator scroll-spy. The categories are
  anchor links (see the shared click handler above), not filters; this
  module only decides which one *looks* active as the page scrolls, using
  IntersectionObserver rather than a scroll listener (no manual rAF/
  getBoundingClientRect polling needed, and it stays cheap on a page with
  five tall sections).
*/
(function () {
  var nav = document.querySelector('.menu-nav');
  if (!nav || !window.IntersectionObserver) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var links = Array.prototype.slice.call(nav.querySelectorAll('.menu-nav__link'));
  if (!links.length) return;

  var sections = [];
  var sectionLinks = [];

  links.forEach(function (link) {
    var section = document.querySelector(link.getAttribute('href'));
    if (section) {
      sections.push(section);
      sectionLinks.push(link);
    }
  });

  if (!sections.length) return;

  function setActive(link) {
    links.forEach(function (l) {
      l.classList.toggle('menu-nav__link--active', l === link);
    });
    revealActiveLink(link);
  }

  // At mobile widths .menu-nav scrolls horizontally on its own (overflow-x:
  // auto — desktop fits all 5 labels, so nav.scrollWidth === clientWidth
  // there and this is a no-op). The underline already shows which category
  // is active as the page scrolls, but if that link has scrolled out of
  // the nav's own horizontal viewport (e.g. the visitor is on category 3+
  // and never touched the nav strip itself), the indicator is invisible —
  // nothing was pulling the nav's horizontal scroll along with it. Scoped
  // to inline/horizontal movement only (block:'nearest' so this never
  // nudges the page's own vertical scroll, which Lenis already owns).
  function revealActiveLink(link) {
    if (nav.scrollWidth <= nav.clientWidth) return;
    link.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      inline: 'nearest',
      block: 'nearest'
    });
  }

  // A click already knows exactly which category it's going to — flip the
  // indicator immediately instead of waiting for the scroll (and the
  // subsequent smooth-scroll) to settle.
  links.forEach(function (link) {
    link.addEventListener('click', function () {
      setActive(link);
      // The smooth scroll to a far-off category briefly crosses every
      // section in between, each of which would otherwise trigger the
      // observer below and flicker the indicator through them on the way
      // past. 1.2s comfortably covers the longest Lenis scroll on this
      // page; observer-driven updates resume normally after it elapses.
      suppressUntil = Date.now() + 1200;
    });
  });

  var suppressUntil = 0;
  var activeSet = [];
  var observer = null;

  function currentNavOffset() {
    return Math.ceil(nav.getBoundingClientRect().height) || 0;
  }

  function updateActiveFromIntersections() {
    if (Date.now() < suppressUntil || !activeSet.length) return;

    // Sections are taller than the viewport, so more than one can be
    // "intersecting" the observation band at once near a boundary — of
    // those, the one furthest down in DOM order is the category the
    // visible band is actually sitting in.
    var current = null;
    for (var i = sections.length - 1; i >= 0; i--) {
      if (activeSet.indexOf(sections[i]) !== -1) {
        current = sections[i];
        break;
      }
    }
    if (!current) return;

    var link = sectionLinks[sections.indexOf(current)];
    if (link) setActive(link);
  }

  function createObserver() {
    if (observer) observer.disconnect();
    activeSet = [];

    // Top margin clears the sticky nav itself (so a section only counts
    // as "current" once it's actually visible below the bar); a large
    // negative bottom margin narrows the observation band to a strip near
    // the top of the viewport, so the active link changes as soon as a
    // new category's heading crosses into view rather than only once it
    // fills the whole screen.
    var rootMargin = '-' + (currentNavOffset() + 1) + 'px 0px -65% 0px';

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var idx = activeSet.indexOf(entry.target);
        if (entry.isIntersecting && idx === -1) {
          activeSet.push(entry.target);
        } else if (!entry.isIntersecting && idx !== -1) {
          activeSet.splice(idx, 1);
        }
      });
      updateActiveFromIntersections();
    }, { rootMargin: rootMargin, threshold: 0 });

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  createObserver();

  // The sticky nav's own height (and so the top clearance the rootMargin
  // needs) differs between the mobile and desktop layouts — rebuild the
  // observer on resize rather than assuming it can't change after load.
  var resizeTimer;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(createObserver, 150);
  });
})();

/*
  Portfolio page — category filter. Real client-side filtering (not an
  anchor scroll like .menu-nav above): clicking a tab shows only the
  gallery items whose data-category matches (or everything for "Усі").
  See layout.css's "Portfolio page" section for why this doesn't reuse
  createLoopCarousel for the gallery.

  Home's four portfolio/events cards link here with a matching
  ?category= slug (see index.html) — reserved for this page since it
  didn't exist yet (see PROJECT.md/COMPONENTS.md). On load, that query
  param pre-selects the matching tab instead of always starting on "Усі".
*/
(function () {
  var filter = document.querySelector('.portfolio-filter');
  var viewport = document.querySelector('.portfolio-gallery__viewport');
  if (!filter || !viewport) return;

  var links = Array.prototype.slice.call(filter.querySelectorAll('.portfolio-filter__link'));
  var items = Array.prototype.slice.call(document.querySelectorAll('.portfolio-gallery__item'));
  var progress = document.querySelector('[data-gallery-progress]');
  var prevBtn = document.querySelector('[data-gallery-scroll-prev]');
  var nextBtn = document.querySelector('[data-gallery-scroll-next]');
  if (!links.length || !items.length) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var segments = [];

  // Rebuilds one dot per currently-visible item, matching Figma's
  // pagination for the mobile scroll-snap row (see layout.css) — the
  // dot count has to change with the active filter since the item set
  // itself changes, unlike createLoopCarousel's dots (fixed count, set
  // once at boot).
  function buildDots() {
    if (!progress) return;
    progress.innerHTML = '';
    segments = [];
    var visible = items.filter(function (item) { return !item.classList.contains('is-hidden'); });
    visible.forEach(function (item, i) {
      var seg = document.createElement('button');
      seg.type = 'button';
      seg.className = 'carousel-progress__segment';
      seg.setAttribute('aria-label', 'Перейти до фото ' + (i + 1));
      seg.addEventListener('click', function () {
        viewport.scrollTo({ left: item.offsetLeft - viewport.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      progress.appendChild(seg);
      segments.push({ el: seg, item: item });
    });
    updateActiveDot();
  }

  // Picks whichever visible item's center currently sits closest to the
  // viewport's own center as "current" — cheap enough on scroll since
  // the visible set is at most a dozen items.
  function updateActiveDot() {
    if (!segments.length) return;
    var viewportCenter = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
    var closest = null;
    var closestDist = Infinity;
    segments.forEach(function (seg) {
      var rect = seg.item.getBoundingClientRect();
      var dist = Math.abs((rect.left + rect.width / 2) - viewportCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = seg;
      }
    });
    segments.forEach(function (seg) {
      seg.el.classList.toggle('is-active', seg === closest);
    });
  }

  var scrollTimer;
  viewport.addEventListener('scroll', function () {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(updateActiveDot, 100);
  });

  var currentCategory = null;

  function commitFilter(category) {
    links.forEach(function (link) {
      link.classList.toggle('is-active', link.dataset.filter === category);
    });
    items.forEach(function (item) {
      var matches = category === 'all' || item.dataset.category === category;
      item.classList.toggle('is-hidden', !matches);
    });
    viewport.scrollTo({ left: 0, behavior: 'auto' });
    buildDots();
  }

  // Desktop's grid gains/loses whole rows on every filter change, shifting
  // everything below — scroll-experience.js refreshes ScrollTrigger on
  // this event (see the CTA banner fix in CHANGELOG.md).
  function notifyLayoutChange() {
    window.dispatchEvent(new CustomEvent('veranda:layoutchange'));
  }

  function applyFilter(category) {
    if (category === currentCategory) return;
    var isFirst = currentCategory === null;
    currentCategory = category;
    // scroll-experience.js (GSAP, loads after this file, skipped entirely
    // under reduced motion) registers window.__verandaFx.galleryFilter to
    // animate the change with Flip. It must call commit() synchronously
    // and done() once finished. Without it — or for the initial,
    // pre-selected category on load — the change is instant.
    var fx = window.__verandaFx && window.__verandaFx.galleryFilter;
    if (fx && !isFirst) {
      fx(items, function () { commitFilter(category); }, notifyLayoutChange);
    } else {
      commitFilter(category);
      notifyLayoutChange();
    }
  }

  links.forEach(function (link) {
    link.addEventListener('click', function () {
      applyFilter(link.dataset.filter);
    });
  });

  function cardStep() {
    var first = viewport.querySelector('.portfolio-gallery__item:not(.is-hidden)');
    if (!first) return 0;
    var style = getComputedStyle(viewport.querySelector('.portfolio-gallery__track'));
    return first.getBoundingClientRect().width + (parseFloat(style.columnGap) || 0);
  }

  function scrollByCards(dir) {
    viewport.scrollBy({ left: dir * cardStep(), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { scrollByCards(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { scrollByCards(1); });

  var requestedCategory = new URLSearchParams(window.location.search).get('category');
  var hasMatch = requestedCategory && links.some(function (link) { return link.dataset.filter === requestedCategory; });
  applyFilter(hasMatch ? requestedCategory : 'all');
})();

/*
  Portfolio gallery lightbox. Reuses the generic [data-modal] system above
  for open/close/Escape/focus-trap/scroll-lock (every gallery photo is a
  data-modal-open="lightbox" button, same as Menu's food photos) and only
  adds what a gallery needs on top: which photo to show, stepping through
  the CURRENTLY FILTERED photos (prev/next buttons, arrow keys, swipe) and
  the "3 / 12" counter.

  Motion is optional, via window.__verandaFx hooks that scroll-experience.js
  registers (Flip-style expand from the clicked thumbnail, clip-path wipe
  between photos, collapse back on close). Without them (GSAP missing,
  reduced motion) the plain CSS fade of .photo-lightbox still applies and
  photo changes are instant.

  The click listener is a normal bubbling one registered AFTER the generic
  modal module's, so it runs once the lightbox is already open and laid
  out, in the same task (no frame painted in between).
*/
(function () {
  var lightbox = document.querySelector('.photo-lightbox--gallery');
  var gallery = document.querySelector('.portfolio-gallery');
  if (!lightbox || !gallery) return;

  var image = lightbox.querySelector('[data-lightbox-image]');
  var prevBtn = lightbox.querySelector('[data-lightbox-prev]');
  var nextBtn = lightbox.querySelector('[data-lightbox-next]');
  var currentEl = lightbox.querySelector('[data-lightbox-current]');
  var totalEl = lightbox.querySelector('[data-lightbox-total]');
  if (!image) return;

  var list = [];
  var index = 0;
  var busy = false;

  function fx(name) {
    return window.__verandaFx && window.__verandaFx[name];
  }

  function isOpen() {
    return lightbox.classList.contains('is-open');
  }

  function visibleTriggers() {
    return Array.prototype.slice.call(
      gallery.querySelectorAll('.portfolio-gallery__item:not(.is-hidden) .portfolio-gallery__trigger')
    );
  }

  function thumbAt(i) {
    return list[i] ? list[i].querySelector('img') : null;
  }

  function show(i) {
    var thumb = thumbAt(i);
    if (!thumb) return;
    // Grid thumbnails can be small, fast-decoding versions; data-full
    // points at the sharper file for the full-screen view (Portfolio's
    // big photos — decoding 12 MP originals in the grid stalled scrolling).
    image.src = thumb.getAttribute('data-full') || thumb.currentSrc || thumb.src;
    image.alt = thumb.alt;
    if (currentEl) currentEl.textContent = String(i + 1);
    if (totalEl) totalEl.textContent = String(list.length);
    var single = list.length < 2;
    if (prevBtn) prevBtn.hidden = single;
    if (nextBtn) nextBtn.hidden = single;
  }

  function navigate(dir) {
    if (busy || list.length < 2) return;
    var nextIndex = (index + dir + list.length) % list.length;
    var swap = fx('lightboxSwap');
    if (!swap) {
      index = nextIndex;
      show(index);
      return;
    }
    busy = true;
    swap(image, dir, function commit() {
      index = nextIndex;
      show(index);
    }, function done() {
      busy = false;
    });
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('.portfolio-gallery__trigger');
    if (!trigger) return;
    list = visibleTriggers();
    index = Math.max(0, list.indexOf(trigger));
    show(index);
    var open = fx('lightboxOpen');
    if (open) open(thumbAt(index), image);
  });

  lightbox.addEventListener('veranda:modalclose', function () {
    busy = false;
    var close = fx('lightboxClose');
    if (close) close(image, thumbAt(index));
  });

  if (prevBtn) prevBtn.addEventListener('click', function () { navigate(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { navigate(1); });

  document.addEventListener('keydown', function (event) {
    if (!isOpen()) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
  });

  // Horizontal swipe on the photo itself (touch or mouse). touch-action:
  // pan-y on the image (components.css) keeps vertical gestures native.
  var swipeStartX = null;
  var swipeStartY = 0;
  var SWIPE_MIN = 50;
  image.addEventListener('pointerdown', function (event) {
    swipeStartX = event.clientX;
    swipeStartY = event.clientY;
  });
  image.addEventListener('pointerup', function (event) {
    if (swipeStartX === null) return;
    var dx = event.clientX - swipeStartX;
    var dy = event.clientY - swipeStartY;
    swipeStartX = null;
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) navigate(dx < 0 ? 1 : -1);
  });
  image.addEventListener('pointercancel', function () { swipeStartX = null; });
})();

/*
  Magnetic CTAs — primary/inverse buttons lean toward the cursor while it
  is over them and spring back on leave. Desktop + fine pointer + motion
  allowed only. Writes only the --btn-magnet-x/y custom properties that
  .btn's own transform already composes with the hover lift
  (components.css), so no inline transform ever fights GSAP reveals
  (which clear theirs) or the CSS hover. Excluded: the header CTA (flush
  to the viewport edge — any shift opens a gap) and full-width form
  submits (.btn--block).
*/
(function () {
  var mq = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
  if (mq('(prefers-reduced-motion: reduce)')) return;
  if (!mq('(hover: hover) and (pointer: fine)') || window.innerWidth < 1024) return;

  var MAX_X = 10; // px at the button's left/right edge
  var MAX_Y = 6;  // px at its top/bottom edge
  var buttons = document.querySelectorAll('.btn--primary:not(.btn--block):not(.site-header__cta), .btn--inverse');

  buttons.forEach(function (btn) {
    // Resting box, measured on enter (and again after a scroll) rather
    // than every move: the live rect already includes the pull itself.
    var rest = null;

    function measure() {
      var r = btn.getBoundingClientRect();
      var cs = window.getComputedStyle(btn);
      var mx = parseFloat(cs.getPropertyValue('--btn-magnet-x')) || 0;
      var my = parseFloat(cs.getPropertyValue('--btn-magnet-y')) || 0;
      rest = { cx: r.left + r.width / 2 - mx, cy: r.top + r.height / 2 - my, hw: r.width / 2, hh: r.height / 2 };
    }
    function invalidate() { rest = null; }

    btn.addEventListener('pointerenter', function (event) {
      if (event.pointerType !== 'mouse') return;
      btn.classList.remove('is-magnet-release');
      measure();
      window.addEventListener('scroll', invalidate, { passive: true });
    });

    btn.addEventListener('pointermove', function (event) {
      if (event.pointerType !== 'mouse') return;
      if (!rest) measure();
      var nx = Math.max(-1, Math.min(1, (event.clientX - rest.cx) / rest.hw));
      var ny = Math.max(-1, Math.min(1, (event.clientY - rest.cy) / rest.hh));
      btn.style.setProperty('--btn-magnet-x', (nx * MAX_X).toFixed(2) + 'px');
      btn.style.setProperty('--btn-magnet-y', (ny * MAX_Y).toFixed(2) + 'px');
    });

    btn.addEventListener('pointerleave', function () {
      window.removeEventListener('scroll', invalidate);
      rest = null;
      btn.classList.add('is-magnet-release');
      btn.style.removeProperty('--btn-magnet-x');
      btn.style.removeProperty('--btn-magnet-y');
    });
  });
})();

/*
  Hide-on-scroll header — scrolling down hides .site-header (translateY,
  layout.css), any scroll up brings it back. Plain scroll listener (Lenis
  drives native scroll, so this works with or without it) — no GSAP. The
  header always shows near the top of the page and while keyboard focus
  is inside it. It hides during the pinned sections too (Why-Us, CTA
  banners) — those pin flush with the viewport top ('top top' in
  scroll-experience.js), so scrolling down through them shows the whole
  section. .menu-nav follows it up via CSS.
*/
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  var root = document.documentElement;
  var DELTA = 6; // px of travel before a direction change counts (trackpad jitter)
  var lastY = window.scrollY;
  var hidden = false;
  var ticking = false;

  function threshold() { return header.offsetHeight * 2; }

  function setHidden(value) {
    if (value === hidden) return;
    hidden = value;
    root.classList.toggle('is-header-hidden', value);
  }

  function mustShow() {
    return header.contains(document.activeElement);
  }

  function update() {
    ticking = false;
    var y = window.scrollY;
    if (y <= threshold() || mustShow()) {
      setHidden(false);
      lastY = y;
      return;
    }
    if (Math.abs(y - lastY) < DELTA) return;
    setHidden(y > lastY);
    lastY = y;
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }, { passive: true });

  header.addEventListener('focusin', function () { setHidden(false); });

  // For the anchor-scroll offset above: a scroll ending at destY leaves
  // the header visible only if it ends near the top or goes upward.
  window.__verandaHeader = {
    visibleAt: function (destY) { return destY <= threshold() || destY < window.scrollY; }
  };
})();
