(() => {
  // Extrude the real Radlay mark into a 3D steel object: a stack of masked layers,
  // lit yellow near the face (light from the seams) and falling into shadow behind.
  document.querySelectorAll('.mark3d').forEach((el) => {
    const depth = Number(el.dataset.depth) || 20;
    const glow = document.createElement('div');
    glow.className = 'm3-glow';
    el.append(glow);
    for (let i = depth; i >= 1; i--) {
      const layer = document.createElement('div');
      layer.className = 'm3';
      const t = i / depth;
      const light = Math.max(0, 1 - t * 2.2); // amber rim only on the first layers
      const r = Math.round(4 + 236 * light), g = Math.round(24 + 153 * light), b = Math.round(62 - 52 * light); // navy -> brand yellow
      layer.style.background = `rgb(${r},${g},${b})`;
      layer.style.transform = `translate(${(i * 0.16).toFixed(2)}%, ${(i * 0.22).toFixed(2)}%)`;
      el.append(layer);
    }
    const face = document.createElement('div');
    face.className = 'm3 m3-face';
    el.append(face);
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = window.matchMedia('(max-width: 560px)').matches;

  // Play once when on screen
  const onceVisible = (el, fn, threshold = 0.3) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    new IntersectionObserver((entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); fn(); }
    }, { threshold }).observe(el);
  };
  document.querySelectorAll('.mark3d').forEach((el) => onceVisible(el, () => el.classList.add('in'), 0.2));

  const header = document.querySelector('.site-header');
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');

  // Header state on scroll
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile menu
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    document.documentElement.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Stagger siblings, then reveal on scroll
  document.querySelectorAll('.cap-grid, .steps, .bento, .prod-grid, .sol-cards, .values, .gallery').forEach((group) => {
    [...group.children].forEach((el, i) => el.style.setProperty('--d', `${i * (narrow ? 0.05 : 0.07)}s`));
  });
  const hero = document.querySelectorAll('.hero .reveal');
  hero.forEach((el, i) => el.style.setProperty('--d', `${0.1 + i * 0.07}s`));

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  // the observer can miss elements carried past the viewport by a fast flick or the End key
  let sweepQueued = false;
  const sweep = () => {
    sweepQueued = false;
    document.querySelectorAll('.reveal:not(.in)').forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) { el.classList.add('in'); io.unobserve(el); }
    });
  };
  window.addEventListener('scroll', () => { if (!sweepQueued) { sweepQueued = true; setTimeout(sweep, 150); } }, { passive: true });

  // Process: the line fills and each step lights in turn
  document.querySelectorAll('.steps').forEach((steps) => {
    [...steps.children].forEach((li, i) => li.style.setProperty('--i', i));
    onceVisible(steps, () => steps.classList.add('is-run'), 0.35);
  });

  // Plant solutions schematic: hotspots and tabs switch the readout; cycles until touched
  const hmi = document.querySelector('[data-hmi]');
  if (hmi) {
    const panels = [...hmi.querySelectorAll('.read')];
    const triggers = [...hmi.querySelectorAll('[data-sol]')];
    let current = 0;
    let timer = null;
    const show = (i) => {
      current = i;
      hmi.dataset.active = String(i);
      panels.forEach((p, k) => { p.hidden = k !== i; });
      triggers.forEach((t) => {
        const on = Number(t.dataset.sol) === i;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-pressed', String(on));
      });
    };
    let manual = false;
    let paused = false;
    let visible = false;
    const stop = () => { clearInterval(timer); timer = null; hmi.classList.remove('cycling'); };
    const start = () => {
      if (timer || manual || paused || !visible || reduceMotion) return;
      hmi.classList.add('cycling');
      timer = setInterval(() => {
        show((current + 1) % panels.length);
        // restart the tab progress bar
        hmi.classList.remove('cycling'); void hmi.offsetWidth; hmi.classList.add('cycling');
      }, 6000);
    };
    triggers.forEach((t) => t.addEventListener('click', () => { manual = true; stop(); show(Number(t.dataset.sol)); }));
    hmi.addEventListener('keydown', (e) => {
      if (!e.target.matches('[data-sol]') || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      manual = true;
      stop();
      show((current + (e.key === 'ArrowRight' ? 1 : panels.length - 1)) % panels.length);
      hmi.querySelector(`.hmi-tabs [data-sol="${current}"]`).focus();
    });
    show(0);

    // Pause stops the flows and the auto-advance; Play resumes both
    const pauseBtn = hmi.querySelector('[data-pause]');
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      hmi.classList.toggle('is-paused', paused);
      pauseBtn.setAttribute('aria-pressed', String(paused));
      pauseBtn.querySelector('span').textContent = paused ? 'Play' : 'Pause';
      if (paused) stop(); else start();
    });

    // Nothing animates while the schematic is off screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        hmi.classList.toggle('is-offscreen', !visible);
        if (visible) start(); else stop();
      }, { threshold: 0.2 }).observe(hmi);
    }

    // Draw the schematic once: power sources first, then control, cloud, process, line
    if (!reduceMotion && 'IntersectionObserver' in window) {
      const plant = hmi.querySelector('.plant');
      plant.querySelectorAll('.s-line').forEach((el) => el.setAttribute('pathLength', '1'));
      ['4', '5', '1', '3', '0', '6', '2'].forEach((part, i) => {
        plant.querySelectorAll(`[data-part="${part}"]`).forEach((g) => g.style.setProperty('--dd', `${350 + i * 110}ms`));
      });
      hmi.classList.add('is-drawing');
      onceVisible(hmi, () => {
        hmi.classList.add('is-drawn');
        setTimeout(() => {
          hmi.classList.remove('is-drawing', 'is-drawn');
          plant.querySelectorAll('.s-line').forEach((el) => el.removeAttribute('pathLength'));
        }, 2900);
      }, 0.25);
    }

    const clock = hmi.querySelector('[data-clock]');
    const tick = () => { clock.textContent = new Date().toLocaleTimeString('en-GB'); };
    tick();
    setInterval(tick, 1000);
  }

  // Home hero slides. The active bar's fill animation is the timer, so anything that
  // pauses the bar (Pause, hover, keyboard focus, off screen) pauses the slides too.
  const slides = document.querySelector('.hero-slides');
  if (slides) {
    const photos = [...document.querySelectorAll('.hero-home .hero-photo')];
    const dots = [...slides.querySelectorAll('.hero-dots button')];
    const cap = slides.querySelector('.hero-cap');
    const pause = slides.querySelector('.hero-pause');
    let cur = 0;
    const show = (n, byUser) => {
      cur = (n + photos.length) % photos.length;
      photos.forEach((p, i) => p.classList.toggle('is-on', i === cur));
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === cur)));
      cap.querySelector('.num').textContent = String(cur + 1).padStart(2, '0');
      cap.querySelector('[data-cap]').textContent = dots[cur].dataset.cap;
      if (byUser) cap.setAttribute('aria-live', 'polite');
    };
    dots.forEach((d, i) => {
      d.addEventListener('click', () => show(i, true));
      d.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        show(cur + step, true);
        dots[cur].focus();
      });
    });
    slides.addEventListener('animationend', (e) => {
      if (e.animationName === 'heroProg') show(cur + 1);
    });
    pause.addEventListener('click', () => {
      const paused = pause.getAttribute('aria-pressed') !== 'true';
      pause.setAttribute('aria-pressed', String(paused));
      pause.setAttribute('aria-label', paused ? 'Play slides' : 'Pause slides');
      slides.classList.toggle('is-paused', paused);
    });
    if (!reduceMotion) slides.classList.add('is-auto');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => slides.classList.toggle('is-offscreen', !e.isIntersecting))
        .observe(slides.closest('.hero'));
    }
  }

  // Framing engine. Each photo with data-focus="L T R B" (its subject box, in % of the
  // image) gets the object-position that keeps the subject inside its frame and clear of
  // anything drawn over it, scored on a 65 x 65 grid of the crop's sliding room.
  const heroSec = document.querySelector('.hero');
  const stacked = window.matchMedia('(max-width: 900px)');
  const OBSTACLES = '.hero-inner > *, .hero-ctrl, .site-header .brand, .site-header .header-live, .site-header .burger, .site-header .nav > a';
  const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

  const frame = () => {
    if (!heroSec) return;
    // On tablets and phones the photo is a band above the copy, ending just under the slide controls
    const anchor = heroSec.querySelector('.hero-slides') || heroSec.querySelector('.hero-inner > *');
    const top = (el) => { let y = 0; for (; el && el !== heroSec; el = el.offsetParent) y += el.offsetTop; return y; };
    // the photo runs on under the slide controls so its fade ends where the copy starts
    const end = anchor.classList.contains('hero-slides') ? top(anchor) + anchor.offsetHeight + 8 : top(anchor) + 24;
    if (stacked.matches) heroSec.style.setProperty('--photo-h', `${end}px`);
    else heroSec.style.removeProperty('--photo-h');

    const host = heroSec.getBoundingClientRect();
    // text counts line by line, so a short line leaves the photo beside it free
    const rectsOf = (el) => {
      if (/^(H1|P)$/.test(el.tagName)) { const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()]; }
      if (el.matches('.hero-actions, .hero-stats')) return [...el.children].map((c) => c.getBoundingClientRect());
      return [el.getBoundingClientRect()];
    };
    const obstacles = [...document.querySelectorAll(OBSTACLES)].flatMap((el) => {
      if (getComputedStyle(el).visibility === 'hidden') return [];
      // the header is fixed: frame against where it sits with the page at the top;
      // copy still rising in is measured where it will land
      const tf = getComputedStyle(el).transform;
      const rise = tf === 'none' ? 0 : new DOMMatrix(tf).m42;
      const dy = (el.closest('.site-header') ? -host.top - window.scrollY : -host.top) - rise;
      return rectsOf(el).filter((r) => r.width && r.height)
        .map((r) => ({ l: r.left - host.left, t: r.top + dy, r: r.right - host.left, b: r.bottom + dy }));
    });

    heroSec.querySelectorAll('img[data-focus]').forEach((img) => {
      if (img.dataset.pos0 === undefined) img.dataset.pos0 = img.style.objectPosition;
      if (img.dataset.focusOn === 'stacked' && !stacked.matches) { img.style.objectPosition = img.dataset.pos0; return; }
      // layout size, not the zoomed size, so the settle animation never moves the crop
      const fw = img.offsetWidth, fh = img.offsetHeight;
      const nw = Number(img.getAttribute('width')) || img.naturalWidth;
      const nh = Number(img.getAttribute('height')) || img.naturalHeight;
      if (!fw || !fh || !nw || !nh) return;
      const fx = img.offsetLeft + img.offsetParent.offsetLeft, fy = top(img);
      const s = Math.max(fw / nw, fh / nh), rw = nw * s, rh = nh * s;
      const [L, T, R, B] = img.dataset.focus.split(' ').map((v) => v / 100);
      const obs = obstacles.map((o) => ({ l: o.l - fx, t: o.t - fy, r: o.r - fx, b: o.b - fy }));
      if (stacked.matches) obs.push({ l: 0, t: fh * 0.7, r: fw, b: fh }); // the fade into the copy
      const view = { l: 0, t: 0, r: fw, b: fh };
      let best = [0, 0], bestCost = Infinity;
      for (let i = 0; i <= 64; i++) {
        for (let j = 0; j <= 64; j++) {
          const ox = (fw - rw) * i / 64, oy = (fh - rh) * j / 64;
          const sub = { l: ox + L * rw, t: oy + T * rh, r: ox + R * rw, b: oy + B * rh };
          const area = (sub.r - sub.l) * (sub.b - sub.t);
          const covered = obs.reduce((sum, o) => sum + overlap(sub, o), 0);
          const dx = ((sub.l + sub.r) / 2 - fw / 2) / fw, dy = ((sub.t + sub.b) / 2 - fh / 2) / fh;
          const cost = 1000 * (area - overlap(sub, view) + covered) + dx * dx + dy * dy;
          if (cost < bestCost) { bestCost = cost; best = [ox, oy]; }
        }
      }
      img.style.objectPosition = `${best[0].toFixed(1)}px ${best[1].toFixed(1)}px`;
    });
  };
  if (heroSec && heroSec.querySelector('img[data-focus]')) {
    frame();
    heroSec.querySelectorAll('img[data-focus]').forEach((img) => img.addEventListener('load', frame));
    if (document.fonts) document.fonts.ready.then(frame);
    window.addEventListener('load', () => setTimeout(frame, 1100));
    let rt;
    const later = () => { clearTimeout(rt); rt = setTimeout(frame, 120); };
    window.addEventListener('resize', later);
    // once the copy has risen into place, frame against where it actually sits
    heroSec.querySelector('.hero-inner').addEventListener('transitionend', (e) => {
      if (e.propertyName === 'transform' && e.target.parentElement.classList.contains('hero-inner')) later();
    });
  }

  // Partner logos on tablets and phones: a slow drift to the left that the visitor can grab
  // and swipe either way. Three copies of the set let it loop seamlessly in both directions.
  const strip = document.querySelector('.partner-logos');
  const phoneStrip = window.matchMedia('(max-width: 900px)');
  if (strip) {
    const originals = [...strip.children];
    let clones = [], raf = 0, last = 0, pos = 0, held = false, holdUntil = 0, onScreen = false, lastSet = -1;
    const period = () => (clones.length ? clones[0].offsetLeft - originals[0].offsetLeft : 0);
    const wrapAround = () => {
      const p = period();
      if (!p) return;
      if (strip.scrollLeft < p * 0.5) strip.scrollLeft += p;
      else if (strip.scrollLeft >= p * 1.5) strip.scrollLeft -= p;
      pos = strip.scrollLeft;
    };
    const step = (now) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(48, now - (last || now));
      last = now;
      if (held || now < holdUntil) { pos = strip.scrollLeft; return; }
      pos += dt * 0.03; // 30px a second
      strip.scrollLeft = pos;
      lastSet = strip.scrollLeft;
      wrapAround();
    };
    const run = () => {
      const go = phoneStrip.matches && onScreen && !reduceMotion && !document.hidden;
      if (go && !raf) { last = 0; raf = requestAnimationFrame(step); }
      if (!go && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    const setup = () => {
      if (phoneStrip.matches && !clones.length) {
        clones = [0, 1].flatMap(() => originals.map((li) => {
          const c = li.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          c.querySelector('img').alt = '';
          strip.append(c);
          return c;
        }));
        strip.scrollLeft = period();
        pos = strip.scrollLeft;
      } else if (!phoneStrip.matches && clones.length) {
        clones.forEach((c) => c.remove());
        clones = [];
      }
      run();
    };
    // the visitor takes over while touching, and for a moment after letting go
    const release = () => { held = false; holdUntil = performance.now() + 1600; };
    strip.addEventListener('pointerdown', () => { held = true; });
    strip.addEventListener('touchstart', () => { held = true; }, { passive: true });
    ['pointerup', 'pointercancel', 'touchend', 'touchcancel'].forEach((ev) => strip.addEventListener(ev, release, { passive: true }));
    strip.addEventListener('wheel', () => { holdUntil = performance.now() + 1600; }, { passive: true });
    strip.addEventListener('scroll', () => {
      if (Math.abs(strip.scrollLeft - lastSet) > 2) { holdUntil = Math.max(holdUntil, performance.now() + 900); wrapAround(); }
    }, { passive: true });
    // mouse drag on touch-less tablets and desktop browsers at phone width
    let dragX = null;
    strip.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { dragX = e.clientX; strip.setPointerCapture(e.pointerId); } });
    strip.addEventListener('pointermove', (e) => {
      if (dragX === null) return;
      strip.scrollLeft -= e.clientX - dragX;
      dragX = e.clientX;
    });
    strip.addEventListener('pointerup', () => { dragX = null; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; run(); }).observe(strip);
    } else onScreen = true;
    document.addEventListener('visibilitychange', run);
    phoneStrip.addEventListener('change', setup);
    setup();
  }

  // WhatsApp button: arrives once the visitor scrolls past the first half of the hero,
  // sends out its wave, and on touch screens shows its label once
  const wa = document.querySelector('.wa-float');
  if (wa) {
    let shown = false;
    const onScrollWa = () => {
      if (shown || window.scrollY < window.innerHeight * 0.5) return;
      shown = true;
      wa.classList.add('is-on');
      window.removeEventListener('scroll', onScrollWa);
      if (window.matchMedia('(hover: none)').matches) {
        setTimeout(() => wa.classList.add('is-tip'), 1400);
        setTimeout(() => wa.classList.remove('is-tip'), 5400);
      }
    };
    window.addEventListener('scroll', onScrollWa, { passive: true });
    onScrollWa();
  }

  // Subtle parallax on the hero photo
  const heroImg = document.querySelector('.hero-visual');
  if (heroImg && !reduceMotion && window.matchMedia('(hover: hover) and (min-width: 901px)').matches) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < window.innerHeight) heroImg.style.transform = `translateY(${(y * 0.18).toFixed(1)}px)`;
        ticking = false;
      });
    }, { passive: true });
  }

  // Projects gallery filter
  const filters = document.querySelectorAll('.filter');
  filters.forEach((btn) => btn.addEventListener('click', () => {
    const cat = btn.dataset.filter;
    filters.forEach((b) => {
      b.classList.toggle('is-on', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    const shots = [...document.querySelectorAll('.shot')];
    let shown = 0;
    shots.forEach((shot) => {
      const match = cat === 'all' || shot.dataset.cat === cat;
      shot.hidden = !match;
      if (!match) return;
      shot.style.setProperty('--fd', `${shown * 40}ms`);
      shown += 1;
      if (reduceMotion || !shot.classList.contains('in')) return;
      shot.classList.remove('is-settling');
      shot.classList.add('is-entering');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        shot.classList.replace('is-entering', 'is-settling');
      }));
    });
    const count = document.getElementById('filterCount');
    if (count) count.textContent = cat === 'all' ? `Showing all ${shots.length} projects` : `Showing ${shown} of ${shots.length} projects`;
  }));

  // Contact form: inline errors in words, then an honest hand-off to the mail app
  document.querySelectorAll('form.form').forEach((form) => {
    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');
    const message = (input) => {
      if (input.validity.valueMissing) return `Please add your ${input.name === 'email' ? 'email address' : input.name}.`;
      if (input.validity.typeMismatch) return 'That email address looks incomplete.';
      return '';
    };
    const clear = (input) => {
      input.removeAttribute('aria-invalid');
      input.parentElement.querySelector('.field-error')?.remove();
    };
    form.querySelectorAll('input[required]').forEach((input) => input.addEventListener('input', () => clear(input)));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const invalid = [...form.querySelectorAll('input[required]')].filter((input) => {
        clear(input);
        const text = message(input);
        if (!text) return false;
        input.setAttribute('aria-invalid', 'true');
        const err = document.createElement('small');
        err.className = 'field-error';
        err.id = `${input.name}-error`;
        err.textContent = text;
        input.setAttribute('aria-describedby', err.id);
        input.after(err);
        return true;
      });
      if (invalid.length) {
        status.classList.add('is-error');
        status.textContent = invalid.length === 1 ? 'One field needs attention.' : `${invalid.length} fields need attention.`;
        invalid[0].focus();
        return;
      }
      // compose the email here rather than posting the form to mailto:, which browsers flag as insecure
      const data = new FormData(form);
      const line = (label, key) => (data.get(key) ? `${label}: ${data.get(key)}` : '');
      const body = [line('Name', 'name'), line('Company', 'company'), line('Email', 'email'), line('Phone', 'phone'),
        data.getAll('need').length ? `Needs: ${data.getAll('need').join(', ')}` : '', '', data.get('message') || '']
        .filter((l, i) => l || i === 5).join('\n');
      const subject = `Enquiry from ${data.get('name')}${data.get('company') ? `, ${data.get('company')}` : ''}`;
      window.location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.classList.remove('is-error');
      status.textContent = 'Your email app should now open with the enquiry filled in. Press send there to reach our engineers.';
      button.setAttribute('aria-busy', 'true');
      setTimeout(() => button.removeAttribute('aria-busy'), 1500);
    });
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
