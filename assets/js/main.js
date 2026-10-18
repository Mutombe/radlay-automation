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

  // Subtle parallax on the hero gears
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
        e.preventDefault();
        status.classList.add('is-error');
        status.textContent = invalid.length === 1 ? 'One field needs attention.' : `${invalid.length} fields need attention.`;
        invalid[0].focus();
        return;
      }
      status.classList.remove('is-error');
      status.textContent = 'Your email app should now open with the enquiry filled in. Press send there to reach our engineers.';
      button.setAttribute('aria-busy', 'true');
      setTimeout(() => button.removeAttribute('aria-busy'), 1500);
    });
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
