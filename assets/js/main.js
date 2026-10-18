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
    [...group.children].forEach((el, i) => el.style.setProperty('--d', `${i * 0.085}s`));
  });
  const hero = document.querySelectorAll('.hero .reveal');
  hero.forEach((el, i) => el.style.setProperty('--d', `${0.1 + i * 0.085}s`));

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
    const stop = () => { clearInterval(timer); timer = null; hmi.classList.remove('cycling'); };
    triggers.forEach((t) => t.addEventListener('click', () => { stop(); show(Number(t.dataset.sol)); }));
    hmi.addEventListener('keydown', (e) => {
      if (!e.target.matches('[data-sol]') || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      stop();
      show((current + (e.key === 'ArrowRight' ? 1 : panels.length - 1)) % panels.length);
      hmi.querySelector(`.hmi-tabs [data-sol="${current}"]`).focus();
    });
    show(0);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      new IntersectionObserver((entries, obs) => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        hmi.classList.add('cycling');
        timer = setInterval(() => {
          show((current + 1) % panels.length);
          // restart the tab progress bar
          hmi.classList.remove('cycling'); void hmi.offsetWidth; hmi.classList.add('cycling');
        }, 6000);
      }, { threshold: 0.35 }).observe(hmi);
    }
    const clock = hmi.querySelector('[data-clock]');
    const tick = () => { clock.textContent = new Date().toLocaleTimeString('en-GB'); };
    tick();
    setInterval(tick, 1000);
  }

  // Subtle parallax on the hero gears
  const heroImg = document.querySelector('.hero-visual');
  if (heroImg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight) heroImg.style.transform = `translateY(${y * 0.18}px)`;
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
    document.querySelectorAll('.shot').forEach((shot) => {
      shot.hidden = cat !== 'all' && shot.dataset.cat !== cat;
    });
  }));

  document.getElementById('year').textContent = new Date().getFullYear();
})();
