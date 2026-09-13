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
      image: 'assets/images/service-banquet-longtable.jpg'
    },
    {
      title: 'Фуршет',
      desc: 'Класичне святкування за столами з повним сервісом офіціантів — для весіль, ювілеїв і корпоративів.',
      guests: 'від 20 гостей',
      service: 'повний сервіс',
      image: 'assets/images/service-banquet-longtable.jpg'
    },
    {
      title: 'Кейтеринг-бокси',
      desc: 'Класичне святкування за столами з повним сервісом офіціантів — для весіль, ювілеїв і корпоративів.',
      guests: 'від 20 гостей',
      service: 'повний сервіс',
      image: 'assets/images/service-banquet-longtable.jpg'
    },
    {
      title: 'Кенді-бар / коктейль-бар',
      desc: 'Класичне святкування за столами з повним сервісом офіціантів — для весіль, ювілеїв і корпоративів.',
      guests: 'від 20 гостей',
      service: 'повний сервіс',
      image: 'assets/images/service-banquet-longtable.jpg'
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
      window.clearTimeout(recenterTimer);
      track.style.transition = 'none';
      viewport.classList.add('is-dragging');
      if (viewport.setPointerCapture) {
        try { viewport.setPointerCapture(e.pointerId); } catch (err) {}
      }
    }

    function onPointerMove(e) {
      if (!isDragging || e.pointerId !== activePointerId) return;
      var dx = e.clientX - dragStartX;
      pointerMoved = Math.max(pointerMoved, Math.abs(dx));
      offset = dragStartOffset + dx;
      applyTransform(offset, false);
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

      // If this link lives inside a sticky nav (marked generically with
      // data-sticky-nav — currently just Menu's category bar, but not
      // hardcoded to it by name so any future sticky nav gets the same
      // treatment for free), scrolling the target flush to the viewport
      // top would land its heading right underneath that nav instead of
      // below it. Measured live (not a fixed guess) since the sticky
      // nav's own height differs by breakpoint (wraps to more/less
      // padding, font-size, etc.) and could change independently of this
      // file.
      var stickyNav = link.closest('[data-sticky-nav]');
      var offset = stickyNav ? Math.ceil(stickyNav.getBoundingClientRect().height) : 0;

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

    if (activeTrigger && typeof activeTrigger.focus === 'function') activeTrigger.focus();
    activeModal = null;

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
