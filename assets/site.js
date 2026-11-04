(() => {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = () => matchMedia('(max-width: 767px)').matches;
  const jump = (y) => {
    if (Stage.lenis) Stage.lenis.scrollTo(y, { immediate: true, force: true });
    else scrollTo({ top: y, behavior: 'instant' });
  };
  const TAU = Math.PI * 2;
  const CURSOR_INKS = ['#006cff', '#ff6b2c', '#12a150', '#7c5cff', '#1d1d1d', '#e8457c', '#4d9bff', '#f2a900', '#00a3a3', '#b14cf0', '#ff3b30', '#2f6bff'];
  const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // A pixel budget draws finer than the screen where it can afford to, which keeps hairlines from shimmering.
  const fit = (canvas, budget = 0) => {
    const r = canvas.getBoundingClientRect();
    const screen = Math.min(devicePixelRatio || 1, 2);
    const ratio = budget ? clamp(Math.sqrt(budget / (r.width * r.height)), screen, 2) : screen;
    canvas.width = Math.round(r.width * ratio);
    canvas.height = Math.round(r.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, w: r.width, h: r.height };
  };
  // Runs fn on every frame only while the element is on screen; under reduced motion it paints once.
  const whileVisible = (el, fn) => {
    let on = false;
    let frame = 0;
    const run = (now) => {
      fn(now);
      frame = on && !calm() ? requestAnimationFrame(run) : 0;
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(run); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        on = entries.some((e) => e.isIntersecting);
        if (on) wake();
      }, { threshold: 0 }).observe(el);
    } else { on = true; wake(); }
    return wake;
  };

  window.Scenes = window.Scenes || {};

  /* Opening: a tangle pulled out into parallel lines. The scroll undoes the knot, then the lines thicken
     until they close over the page, which is how the white opening hands over to the black chapter. */
  Scenes.opening = (root, o = {}) => {
    const canvas = root.querySelector('.strands');
    const stage = root.querySelector('.scene-stage');
    const first = root.querySelector('.opening__first');
    const second = root.querySelector('.opening__second');
    const title = root.querySelector('.opening__title');
    const say = root.querySelector('.opening__say');
    const nav = document.querySelector('.nav');
    const small = isPhone();
    const COUNT = small ? 44 : 64;
    const STEPS = small ? 140 : 200;
    const CHOSEN = Math.floor(COUNT * 0.62);
    const random = seeded(3);
    const strands = Array.from({ length: COUNT }, (_, i) => ({
      r: (i + 0.5) / COUNT - 0.5,
      f1: 2 + Math.floor(random() * 3) + (random() < 0.5 ? 0.5 : 0),
      f2: 3 + Math.floor(random() * 4),
      p1: random() * TAU,
      p2: random() * TAU,
    }));
    const s = { p: 0, load: 0 };
    const hand = { x: 0, y: 0, aimX: 0, aimY: 0, k: 0, aim: 0 };
    let view = null;
    let g = null;
    let now = 0;
    let last = 0;

    const measure = () => {
      view = fit(canvas);
      root.style.setProperty('--say-h', `${say.offsetHeight}px`);
      const a = root.querySelector('.opening__room').getBoundingClientRect();
      const c = stage.getBoundingClientRect();
      const top = a.top - c.top;
      const bottom = a.bottom - c.top;
      const room = Math.max(120, bottom - top);
      g = {
        cx: view.w * (small ? 0.4 : 0.31),
        cy: top + room / 2,
        R: Math.min(room * 0.47, view.w * (small ? 0.34 : 0.2)),
        band: Math.min(room * 0.74, 520),
      };
    };

    const point = (st, t, u, band, x0, x1, tau, out) => {
      const leave = smooth(span(t, 0.36, 0.94));
      let x = x0 + (x1 - x0) * lerp(leave, t, u);
      const fan = lerp(smooth(span(t, 0.4, 0.74)), 1, u);
      let y = g.cy + st.r * band * fan;
      const knot = (1 - smooth(span(t, 0.28, 0.6))) * (1 - u);
      if (knot > 0.001) {
        // Loops around one centre with a radius that breathes, which winds a round ball of yarn.
        const turn = TAU * st.f1 * t + st.p1 + tau * 0.11;
        const reach = g.R * (0.56 + 0.44 * Math.sin(TAU * st.f2 * t * 0.5 + st.p2 + tau * 0.06));
        x += knot * reach * Math.cos(turn);
        y += knot * reach * Math.sin(turn);
      }
      if (hand.k > 0.004) {
        const dx = x - hand.x;
        const dy = y - hand.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 50000) {
          const d = Math.sqrt(d2) + 0.001;
          const push = Math.exp(-d2 / 12000) * 56 * hand.k;
          x += (dx / d) * push;
          y += (dy / d) * push;
        }
      }
      out[0] = x;
      out[1] = y;
    };

    const scratch = [0, 0];
    const paint = (t) => {
      if (!view || !g) return;
      now = t || now;
      const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0;
      last = now;
      hand.x += (hand.aimX - hand.x) * Math.min(1, dt * 9);
      hand.y += (hand.aimY - hand.y) * Math.min(1, dt * 9);
      hand.k += (hand.aim - hand.k) * Math.min(1, dt * 5);

      const { ctx, w, h } = view;
      const p = s.p;
      const u = smooth(span(p, 0, 0.42));
      const wide = smooth(span(p, 0.3, 0.6));
      const fat = smooth(span(p, 0.52, 0.84));
      nav.classList.toggle('on-dark', fat > 0.7 && root.getBoundingClientRect().bottom > 0);
      ctx.clearRect(0, 0, w, h);
      const band = lerp(g.band, h * 1.08, wide);
      const gap = band / COUNT;
      const x0 = lerp(g.cx, -w * 0.06, u);
      const x1 = w * 1.06;
      const tau = now * 0.001;
      const limit = Math.max(1, Math.floor(STEPS * s.load));
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const trace = (st) => {
        ctx.beginPath();
        let px = 0;
        let py = 0;
        for (let j = 0; j <= limit; j++) {
          point(st, j / STEPS, u, band, x0, x1, tau, scratch);
          if (j === 0) ctx.moveTo(scratch[0], scratch[1]);
          else ctx.quadraticCurveTo(px, py, (px + scratch[0]) / 2, (py + scratch[1]) / 2);
          px = scratch[0];
          py = scratch[1];
        }
        ctx.lineTo(px, py);
      };
      if (fat >= 1) {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, w, h);
      } else {
        // The lines leave the knot black and arrive blue, the same turn the logo makes from E to Y.
        const wash = ctx.createLinearGradient(g.cx + g.R * 0.4, 0, w * 0.86, 0);
        wash.addColorStop(0, `rgba(17,17,17,${lerp(0.56, 1, fat)})`);
        wash.addColorStop(1, `rgba(${Math.round(lerp(0, 17, fat))},${Math.round(lerp(108, 17, fat))},${Math.round(lerp(255, 17, fat))},${lerp(0.92, 1, fat)})`);
        ctx.strokeStyle = wash;
        ctx.lineWidth = lerp(1, gap + 1.5, fat);
        strands.forEach((st, i) => {
          if (i === CHOSEN) return;
          trace(st);
          ctx.stroke();
        });
      }
      // One thread stays blue from the knot to the next chapter, with a signal running along it.
      trace(strands[CHOSEN]);
      ctx.strokeStyle = '#006cff';
      ctx.lineWidth = 2.25;
      ctx.stroke();
      if (s.load >= 1 && !calm()) {
        const travel = 0.42 + ((now * 0.00011) % 1) * 0.58;
        point(strands[CHOSEN], travel, u, band, x0, x1, tau, scratch);
        ctx.fillStyle = '#006cff';
        ctx.beginPath();
        ctx.arc(scratch[0], scratch[1], 5, 0, TAU);
        ctx.fill();
      }
    };

    const mm = Stage.scene(root, {
      hold: o.hold ?? 3.4,
      scrub: 0.6,
      build(tl, { q, phone }) {
        measure();
        tl.to(s, { p: 1, duration: 0.84, ease: 'none', onUpdate: () => paint() }, 0);
        tl.to(first, phone ? { yPercent: -120, duration: 0.3, ease: 'power2.in' } : { xPercent: -112, duration: 0.3, ease: 'power2.in' }, 0.02);
        tl.to(second, phone ? { xPercent: 112, duration: 0.3, ease: 'power2.in' } : { xPercent: 112, duration: 0.3, ease: 'power2.in' }, 0.02);
        tl.to(say, { autoAlpha: 0, y: 32, duration: 0.14, ease: 'power1.in' }, 0.02);
        tl.set(title, { autoAlpha: 0 }, 0.36);
        tl.fromTo(q('.opening__claim'), { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 0.12, ease: 'power2.out' }, 0.76);
        paint();
      },
      rest() {
        nav.classList.remove('on-dark');
        s.p = 0;
        s.load = 1;
        measure();
        g = { cx: view.w * (small ? 0.4 : 0.31), cy: view.h / 2, R: Math.min(view.h * 0.46, view.w * 0.2), band: view.h * 0.8 };
        paint(1);
      },
    });

    if (root.classList.contains('is-live')) {
      ScrollTrigger.addEventListener('refresh', () => { measure(); paint(); });
      gsap.to(s, { load: 1, duration: 1.3, ease: 'power2.inOut' });
      whileVisible(stage, paint);
      addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = stage.getBoundingClientRect();
        if (e.clientY > r.bottom || e.clientY < r.top) { hand.aim = 0; return; }
        hand.aimX = e.clientX;
        hand.aimY = e.clientY - r.top;
        if (hand.aim === 0) { hand.x = hand.aimX; hand.y = hand.aimY; }
        hand.aim = 1;
      }, { passive: true });
      document.addEventListener('pointerleave', () => { hand.aim = 0; });
      stage.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        const r = stage.getBoundingClientRect();
        hand.x = hand.aimX = e.clientX;
        hand.y = hand.aimY = e.clientY - r.top;
        hand.aim = 1;
        hand.k = 1;
        setTimeout(() => { hand.aim = 0; }, 260);
      }, { passive: true });
    }
    return mm;
  };

  /* Why: one problem at a time. The thread that closed the opening curls up with each problem, and the scroll pulls it
     straight into the way that problem gets solved. */
  Scenes.why = (root, o = {}) => {
    const canvas = root.querySelector('.why__thread');
    const count = root.querySelector('.why__count');
    const rows = [...root.querySelectorAll('.why__row')];
    const TITLE = 0.1;
    const EACH = (1 - TITLE) / rows.length;
    const CURL = [1, 1.3, 0.8, 1.15, 0.95];
    const s = { t: 0 };
    let view = null;
    const paint = () => {
      if (!view) return;
      const { ctx, w, h } = view;
      const i = clamp(Math.floor((s.t - TITLE) / EACH), 0, rows.length - 1);
      const u = s.t < TITLE ? 0 : clamp((s.t - TITLE - i * EACH) / EACH, 0, 1);
      const most = Math.min(h * 0.08, w * 0.09);
      const size = s.t < TITLE ? 0 : most * smooth(span(u, 0, 0.16)) * (1 - smooth(span(u, 0.3, 0.72)));
      const turns = ((2.6 * w) / (TAU * most)) * CURL[i];
      const at = (x) => {
        const a = x / w;
        const k = size * smooth(span(a, 0.04, 0.2)) * (1 - smooth(span(a, 0.8, 0.96)));
        const th = TAU * turns * a + i * 1.7;
        return [x + k * Math.sin(th), h / 2 + k * Math.cos(th)];
      };
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#4d9bff';
      ctx.beginPath();
      const STEPS = Math.round(w / 1.5);
      for (let n = -1; n <= STEPS + 1; n++) {
        const [x, y] = at((n / STEPS) * w);
        if (n > -1) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      const [dx, dy] = at(lerp(w * 0.04, w * 0.96, s.t < TITLE ? 0 : smooth(span(u, 0.1, 0.8))));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dx, dy, 5, 0, TAU);
      ctx.fill();
      count.textContent = s.t < TITLE ? '' : `${i + 1} / ${rows.length}`;
    };
    const resize = () => { view = fit(canvas); paint(); };
    const mm = Stage.scene(root, {
      hold: o.hold ?? 12,
      phone: { hold: 8 },
      scrub: 0.6,
      build(tl, { q }) {
        s.t = 0;
        tl.to(s, { t: 1, duration: 1, onUpdate: paint }, 0);
        tl.to(q('.why__title'), { opacity: 0, y: -28, pointerEvents: 'none', duration: 0.02, ease: 'power1.in' }, TITLE - 0.025);
        rows.forEach((row, i) => {
          const start = TITLE + i * EACH;
          const parts = [row.querySelector('.why__from'), row.querySelector('.why__to')];
          tl.fromTo(parts[0], { opacity: 0, y: 32, pointerEvents: 'none' }, { opacity: 1, y: 0, pointerEvents: 'auto', duration: EACH * 0.12, ease: 'power2.out' }, start);
          tl.fromTo(parts[1], { opacity: 0, y: 32, pointerEvents: 'none' }, { opacity: 1, y: 0, pointerEvents: 'auto', duration: EACH * 0.12, ease: 'power2.out' }, start + EACH * 0.52);
          if (i < rows.length - 1) tl.to(parts, { opacity: 0, y: -28, pointerEvents: 'none', duration: EACH * 0.08, ease: 'power1.in' }, start + EACH * 0.92);
        });
        resize();
      },
      rest() { count.textContent = ''; },
    });
    if (root.classList.contains('is-live')) ScrollTrigger.addEventListener('refresh', resize);
    return mm;
  };

  /* Path: how the work goes, on one continuous line in 3D. Every shape is walked along its own edges, so the morph
     never needs a stray stroke: a tangle to discover, a plan, a made thing, what gets delivered, and last the mark. */
  const walk = (nodes, edges, count) => {
    const links = nodes.map(() => []);
    edges.forEach(([a, b], id) => { links[a].push([b, id]); links[b].push([a, id]); });
    const seen = new Set();
    const order = [0];
    const legEdge = [];
    const visit = (at) => {
      links[at].forEach(([to, id]) => {
        if (seen.has(id)) return;
        seen.add(id);
        order.push(to);
        legEdge.push(id);
        visit(to);
        order.push(at);
        legEdge.push(id);
      });
    };
    visit(0);
    const out = new Float32Array(count * 3);
    const kinds = new Uint8Array(count);
    const legs = order.length - 1;
    const each = Math.floor((count - 1) / legs);
    let k = 0;
    for (let l = 0; l < legs; l++) {
      const a = nodes[order[l]];
      const b = nodes[order[l + 1]];
      const kind = edges[legEdge[l]][2] || 0;
      for (let i = 0; i < each; i++) {
        const t = i / each;
        kinds[k / 3] = kind;
        out[k++] = lerp(a[0], b[0], t);
        out[k++] = lerp(a[1], b[1], t);
        out[k++] = lerp(a[2], b[2], t);
      }
    }
    const end = nodes[order[legs]];
    while (k < count * 3) { out[k++] = end[0]; out[k++] = end[1]; out[k++] = end[2]; }
    out.kinds = kinds;
    return out;
  };
  const lattice = (nx, ny, nz, place) => {
    const nodes = [];
    const edges = [];
    const id = (x, y, z) => x + y * nx + z * nx * ny;
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      nodes.push(place(x / Math.max(nx - 1, 1), y / Math.max(ny - 1, 1), z / Math.max(nz - 1, 1)));
      if (x < nx - 1) edges.push([id(x, y, z), id(x + 1, y, z)]);
      if (y < ny - 1) edges.push([id(x, y, z), id(x, y + 1, z)]);
      if (z < nz - 1) edges.push([id(x, y, z), id(x, y, z + 1)]);
    }
    return { nodes, edges };
  };
  const shapeKnot = (count) => {
    const random = seeded(19);
    const wave = () => Array.from({ length: 7 }, (_, i) => ({ f: 3 + i * 3 + Math.floor(random() * 3), p: random() * TAU, a: 1 / (1 + i * 0.55) }));
    const wx = wave();
    const wy = wave();
    const wz = wave();
    const out = new Float32Array(count * 3);
    let most = 0;
    for (let i = 0; i < count; i++) {
      const t = (i / count) * TAU;
      const sum = (w) => w.reduce((v, c) => v + c.a * Math.sin(c.f * t + c.p), 0);
      const x = sum(wx);
      const y = sum(wy);
      const z = sum(wz);
      out[i * 3] = x;
      out[i * 3 + 1] = y;
      out[i * 3 + 2] = z;
      most = Math.max(most, Math.hypot(x, y, z));
    }
    for (let i = 0; i < out.length; i++) out[i] /= most * 0.92;
    return out;
  };
  const shapePlan = (count) => {
    const { nodes, edges } = lattice(8, 1, 8, (x, _, z) => [x * 2 - 1, 0, z * 2 - 1]);
    return walk(nodes, edges, count);
  };
  const shapeMade = (count) => {
    const { nodes, edges } = lattice(3, 3, 3, (x, y, z) => [(x * 2 - 1) * 0.72, (y * 2 - 1) * 0.72, (z * 2 - 1) * 0.72]);
    return walk(nodes, edges, count);
  };
  const shapeBars = (count) => {
    const heights = [0.42, 0.72, 1.02, 1.38, 1.82];
    const nodes = [];
    const edges = [];
    heights.forEach((tall, b) => {
      const x0 = -1.12 + b * 0.47;
      const x1 = x0 + 0.34;
      const base = nodes.length;
      [[x0, 0.9, -0.24], [x1, 0.9, -0.24], [x1, 0.9, 0.24], [x0, 0.9, 0.24]].forEach((n) => nodes.push(n));
      [[x0, 0.9 - tall, -0.24], [x1, 0.9 - tall, -0.24], [x1, 0.9 - tall, 0.24], [x0, 0.9 - tall, 0.24]].forEach((n) => nodes.push(n));
      for (let i = 0; i < 4; i++) {
        edges.push([base + i, base + ((i + 1) % 4)]);
        edges.push([base + 4 + i, base + 4 + ((i + 1) % 4)]);
        edges.push([base + i, base + 4 + i]);
      }
      if (b) edges.push([base - 8 + 1, base]);
    });
    return walk(nodes, edges, count);
  };

  // The company's mark, extruded: the line's last shape. Joins between its three parts stay unseen.
  const LOGO_HIDE = 9;
  const shapeLogo = (count) => {
    const S = 2.35 / 676;
    const DEPTH = 0.16;
    const parts = [
      [[311, 398], [596, 398], [604, 400], [610, 405], [758, 562], [771, 576], [781, 590], [788, 606], [790.5, 625], [790.5, 750.5], [702, 750.5], [702, 634], [700, 624], [695, 616], [690, 611], [548, 462], [311, 462]],
      [[861, 398], [986, 398], [803, 584], [743.5, 520]],
      [[311, 549], [525, 549], [580, 610.5], [373.5, 610.5], [373.5, 690], [657.5, 690], [657.5, 750.5], [311, 750.5]],
    ];
    const SHARP = [[0, 1, 4, 9, 10, 15, 16], [0, 1, 2, 3], [0, 1, 2, 3, 4, 5, 6, 7]];
    const nodes = [];
    const edges = [];
    const firsts = [];
    parts.forEach((pts, p) => {
      const base = nodes.length;
      firsts.push(base);
      pts.forEach(([x, y]) => nodes.push([(x - 649) * S, (y - 574) * S, -DEPTH]));
      pts.forEach(([x, y]) => nodes.push([(x - 649) * S, (y - 574) * S, DEPTH]));
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        edges.push([base + i, base + ((i + 1) % n), p + 1]);
        edges.push([base + n + i, base + n + ((i + 1) % n), p + 1]);
      }
      SHARP[p].forEach((i) => edges.push([base + i, base + n + i, p + 1]));
    });
    edges.push([firsts[0] + 1, firsts[1], LOGO_HIDE]);
    edges.push([firsts[0] + 16, firsts[2], LOGO_HIDE]);
    const out = walk(nodes, edges, count);
    const blue = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const kind = out.kinds[i];
      if (kind === 2) blue[i] = 1;
      if (kind === 1) {
        const px = out[i * 3] / S + 649;
        const py = out[i * 3 + 1] / S + 574;
        if (((px - 657) * 114 + (py - 550) * 54.5) / (114 * 114 + 54.5 * 54.5) > 0.56) blue[i] = 1;
      }
    }
    out.blue = blue;
    return out;
  };

  Scenes.path = (root, o = {}) => {
    const canvas = root.querySelector('canvas');
    const count = root.querySelector('.path__count');
    const N = isPhone() ? 1500 : 2200;
    const shapes = [shapeKnot(N), shapePlan(N), shapeMade(N), shapeBars(N), shapeLogo(N)];
    const logo = shapes[4];
    const TILT = [0.42, 0.98, 0.58, 0.3, 0];
    const ZOOM = [0.92, 0.8, 0.92, 0.82, 0.94];
    const MORPHS = [[0.2, 0.3], [0.38, 0.48], [0.58, 0.68], [0.78, 0.9]];
    // The title, then each working step as its shape forms, then the company's line. Only the steps are counted.
    const SWAPS = [0.08, 0.24, 0.43, 0.63, 0.84];
    const s = { t: 0 };
    const sx = new Float32Array(N);
    const sy = new Float32Array(N);
    const sz = new Float32Array(N);
    const tone = new Uint8Array(N);
    let view = null;
    let yaw = 0.7;
    let spin = 0;
    let pull = 0;
    let tilt = 0;
    let aimTilt = 0;
    let last = 0;
    let held = null;
    let clock = 0;

    // The bars and the mark only read from the front, so from there on the line stops spinning and holds an angle.
    const facing = () => smooth(span(s.t, 0.58, 0.68));
    const paint = (now) => {
      if (!view) return;
      const face = facing();
      if (now) {
        const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0;
        last = now;
        clock = now;
        if (!held) {
          yaw += (0.2 * (1 - face) + spin) * dt;
          spin *= Math.pow(0.08, dt);
          pull *= Math.pow(0.04, dt);
        }
        tilt += (aimTilt - tilt) * Math.min(1, dt * 4);
      }
      const { ctx, w, h } = view;
      const t = s.t;
      const at = t < MORPHS[0][1] ? 0 : t < MORPHS[1][1] ? 1 : t < MORPHS[2][1] ? 2 : 3;
      const m = span(t, MORPHS[at][0], MORPHS[at][1]);
      const a = shapes[at];
      const b = shapes[at + 1];
      const pitch = lerp(TILT[at], TILT[at + 1], smooth(m)) + tilt;
      const zoom = lerp(ZOOM[at], ZOOM[at + 1], smooth(m));
      const narrow = w < 768;
      const cx = narrow ? w * 0.5 : w * 0.68;
      const cy = narrow ? h * 0.36 : h * 0.5;
      const R = (narrow ? Math.min(w * 0.39, h * 0.26) : Math.min(w * 0.23, h * 0.37)) * zoom;
      // The bars stand three-quarters on; the mark turns to face the visitor and only leans with the hand.
      const wrapped = ((yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
      const sway = 0.2 * Math.sin(clock * 0.00045);
      const rest = lerp(-0.42 + sway, sway, smooth(span(t, 0.8, 0.92)));
      const turn = lerp(wrapped, rest, face) + pull;
      const cosY = Math.cos(turn);
      const sinY = Math.sin(turn);
      const cosX = Math.cos(pitch);
      const sinX = Math.sin(pitch);
      const CAM = 3.4;
      const toLogo = at === 3;
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        // Each stretch of the line sets off a beat after the one before it, so the shape re-knits along its length.
        const k = smooth(clamp(m * 1.7 - (i / N) * 0.7, 0, 1));
        const x = lerp(a[j], b[j], k);
        const y = lerp(a[j + 1], b[j + 1], k);
        const z = lerp(a[j + 2], b[j + 2], k);
        const x1 = x * cosY + z * sinY;
        const z1 = z * cosY - x * sinY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = z1 * cosX + y * sinX;
        const scale = CAM / (CAM + z2);
        sx[i] = cx + x1 * R * scale;
        sy[i] = cy + y2 * R * scale;
        sz[i] = z2;
        tone[i] = toLogo && k > 0.97 ? (logo.kinds[i] === LOGO_HIDE ? 2 : logo.blue[i]) : 0;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = narrow ? 1.1 : 1.35;
      [['rgba(58,132,255,0.72)', 0.42, 3], ['rgba(176,208,255,0.86)', -0.12, 0.42], ['#ffffff', -3, -0.12]].forEach(([colour, far, near]) => {
        ctx.strokeStyle = colour;
        ctx.beginPath();
        for (let i = 0; i < N - 1; i++) {
          if (tone[i]) continue;
          const z = (sz[i] + sz[i + 1]) / 2;
          if (z >= far && z < near) {
            ctx.moveTo(sx[i], sy[i]);
            ctx.lineTo(sx[i + 1], sy[i + 1]);
          }
        }
        ctx.stroke();
      });
      if (toLogo) {
        ctx.strokeStyle = '#2f8bff';
        ctx.lineWidth = narrow ? 1.4 : 1.8;
        ctx.beginPath();
        for (let i = 0; i < N - 1; i++) {
          if (tone[i] !== 1) continue;
          ctx.moveTo(sx[i], sy[i]);
          ctx.lineTo(sx[i + 1], sy[i + 1]);
        }
        ctx.stroke();
      }
      // A signal runs along the line, whatever it has become.
      if (!calm()) {
        ctx.fillStyle = '#4d9bff';
        for (let d = 0; d < 3; d++) {
          const i = Math.floor((((clock * 0.00006 + d / 3) % 1) * (N - 1)));
          if (tone[i] === 2) continue;
          ctx.beginPath();
          ctx.arc(sx[i], sy[i], narrow ? 3.5 : 4.5, 0, TAU);
          ctx.fill();
        }
      }
      if (count) {
        const step = SWAPS.filter((at2) => t >= at2 + 0.015).length;
        count.textContent = step >= 1 && step <= 4 ? `${step} / 4` : '';
      }
    };

    const resize = () => { view = fit(canvas); paint(); };
    const mm = Stage.scene(root, {
      hold: o.hold ?? 10,
      phone: { hold: 7 },
      scrub: 0.6,
      build(tl, { q }) {
        const beats = q('.path__title, .path__beats li, .path__end');
        s.t = 0;
        tl.to(s, { t: 1, duration: 1, onUpdate: () => paint() }, 0);
        SWAPS.forEach((at2, i) => {
          tl.to(beats[i], { opacity: 0, y: -28, duration: 0.025, ease: 'power1.in' }, at2);
          tl.fromTo(beats[i + 1], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.04, ease: 'power2.out' }, at2 + 0.03);
        });
        resize();
      },
      rest() {
        s.t = 1;
        resize();
      },
    });
    if (Stage.live) ScrollTrigger.addEventListener('refresh', resize);
    else { s.t = 1; resize(); new ResizeObserver(resize).observe(canvas); }

    if (!calm()) {
      whileVisible(root, paint);
      canvas.addEventListener('pointerdown', (e) => {
        held = { x: e.clientX, t: e.timeStamp, v: 0 };
        canvas.setPointerCapture(e.pointerId);
        canvas.classList.add('is-held');
      });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') aimTilt = (e.clientY / innerHeight - 0.5) * 0.5;
        if (!held) return;
        const dx = e.clientX - held.x;
        const dt = Math.max(1, e.timeStamp - held.t);
        const face = facing();
        yaw += dx * 0.009 * (1 - face);
        pull += dx * 0.009 * face;
        held.v = (dx * 0.009 * 1000) / dt;
        held.x = e.clientX;
        held.t = e.timeStamp;
      });
      const drop = (e) => {
        if (!held) return;
        spin = e.timeStamp - held.t < 90 ? clamp(held.v, -7, 7) * (1 - facing()) : 0;
        held = null;
        canvas.classList.remove('is-held');
      };
      canvas.addEventListener('pointerup', drop);
      canvas.addEventListener('pointercancel', drop);
    }
    return mm;
  };

  /* Build: a crowd of cursors puts each project's screen together, one element at a time, as the page scrolls. The
     screens follow what each project shows on its own pages: 눈길 at work on an ordinary page, HANFLOW's market board
     and DSSI's school dashboard. Cursors with nothing to do drift toward the visitor's pointer. */
  Scenes.build = (root, o = {}) => {
    const canvas = root.querySelector('.build__view');
    const stage = root.querySelector('.scene-stage');
    const copy = root.querySelector('.build__copy');
    const items = [...root.querySelectorAll('.build__list li')];
    const side = matchMedia('(min-width: 1024px), (orientation: landscape) and (max-height: 600px)');
    const INK = '#1d1d1d';
    const BLUE = '#006cff';
    const UP = '#e5484d';
    const DOWN = '#2f6bff';
    const SOFT = ['#dfe9ff', '#ffe5d9', '#dcf2e3', '#ebe5ff', '#fff1c7'];
    const INKS = CURSOR_INKS;
    // Each element: x, y, width and height as shares of the page under the address bar, its kind, and its words.
    const SCREENS = [
      {
        url: 'www.example.com',
        eye: true,
        ground: '#ffffff',
        wide: [
          [0, 0, 1, 0.1, 'nav'],
          [0.05, 0.16, 0.48, 0.14, 'heading'],
          [0.05, 0.34, 0.44, 0.1, 'lines'],
          [0.05, 0.48, 0.16, 0.07, 'button', '검색'],
          [0.58, 0.16, 0.37, 0.38, 'picture'],
          [0.05, 0.62, 0.28, 0.32, 'card'],
          [0.36, 0.62, 0.28, 0.32, 'card'],
          [0.67, 0.62, 0.28, 0.32, 'card'],
          [0.345, 0.605, 0.31, 0.35, 'gaze'],
          [0.55, 0.83, 0.13, 0.09, 'voice', '클릭'],
          [0.69, 0.03, 0.28, 0.3, 'popup', '눈길'],
        ],
        narrow: [
          [0, 0, 1, 0.08, 'nav'],
          [0.06, 0.12, 0.88, 0.11, 'heading'],
          [0.06, 0.25, 0.8, 0.08, 'lines'],
          [0.06, 0.35, 0.34, 0.055, 'button', '검색'],
          [0.06, 0.44, 0.88, 0.2, 'picture'],
          [0.06, 0.68, 0.42, 0.27, 'card'],
          [0.52, 0.68, 0.42, 0.27, 'card'],
          [0.505, 0.665, 0.45, 0.3, 'gaze'],
          [0.24, 0.87, 0.25, 0.07, 'voice', '클릭'],
          [0.42, 0.02, 0.55, 0.26, 'popup', '눈길'],
        ],
      },
      {
        url: 'hanflow.org',
        ground: '#f5f6f8',
        wide: [
          [0, 0, 1, 0.1, 'brand', 'HANFLOW'],
          [0.03, 0.14, 0.225, 0.17, 'index', '나스닥 선물'],
          [0.27, 0.14, 0.225, 0.17, 'index', '코스피200 선물'],
          [0.51, 0.14, 0.225, 0.17, 'index', '코스피'],
          [0.75, 0.14, 0.22, 0.17, 'index', '코스닥'],
          [0.03, 0.35, 0.57, 0.35, 'flows', '수급 흐름'],
          [0.63, 0.35, 0.34, 0.35, 'rank', '주도주'],
          [0.03, 0.74, 0.57, 0.22, 'summary', 'AI 시황 요약'],
          [0.63, 0.74, 0.34, 0.22, 'compare', 'KRX · NXT'],
        ],
        narrow: [
          [0, 0, 1, 0.08, 'brand', 'HANFLOW'],
          [0.05, 0.11, 0.43, 0.12, 'index', '나스닥 선물'],
          [0.52, 0.11, 0.43, 0.12, 'index', '코스피200 선물'],
          [0.05, 0.25, 0.43, 0.12, 'index', '코스피'],
          [0.52, 0.25, 0.43, 0.12, 'index', '코스닥'],
          [0.05, 0.4, 0.9, 0.22, 'flows', '수급 흐름'],
          [0.05, 0.65, 0.9, 0.17, 'rank', '주도주'],
          [0.05, 0.85, 0.9, 0.12, 'summary', 'AI 시황 요약'],
        ],
      },
      {
        url: 'dssi.kr',
        ground: '#f6f7fb',
        wide: [
          [0, 0, 0.17, 1, 'side', 'DSSI'],
          [0.17, 0, 0.83, 0.1, 'top'],
          [0.2, 0.14, 0.48, 0.5, 'timetable', '시간표'],
          [0.71, 0.14, 0.26, 0.22, 'dday', '시험 D-day'],
          [0.71, 0.4, 0.26, 0.24, 'todo', '숙제'],
          [0.2, 0.68, 0.35, 0.28, 'meal', '급식'],
          [0.58, 0.68, 0.39, 0.28, 'cards', '단어장'],
        ],
        narrow: [
          [0, 0, 1, 0.08, 'top', 'DSSI'],
          [0.05, 0.11, 0.9, 0.36, 'timetable', '시간표'],
          [0.05, 0.5, 0.43, 0.16, 'dday', '시험 D-day'],
          [0.52, 0.5, 0.43, 0.16, 'todo', '숙제'],
          [0.05, 0.69, 0.43, 0.27, 'meal', '급식'],
          [0.52, 0.69, 0.43, 0.27, 'cards', '단어장'],
        ],
      },
    ];
    const INTRO = 0.05;
    const SEG = (1 - INTRO) / SCREENS.length;
    const FADE = 0.07;
    const DUR = 0.2;
    const s = { p: 0 };
    const hand = { x: 0, y: 0, until: 0 };
    let view = null;
    let win = null;
    let last = 0;
    let shown = -1;
    let agents = [];

    const round = (ctx, x, y, w, h, r) => {
      ctx.beginPath();
      const k = Math.max(0, Math.min(r, w / 2, h / 2));
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, k); else ctx.rect(x, y, w, h);
    };
    const capsule = (ctx, x, y, w, h, fill) => { round(ctx, x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill(); };
    const dot = (ctx, x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); };
    const write = (ctx, text, x, y, size, weight, fill, align = 'left') => {
      ctx.font = `${weight} ${size}px ${FAMILY}`;
      ctx.fillStyle = fill;
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
    };
    const eye = (ctx, x, y, r) => {
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.15, r * 0.7, 0, 0, TAU);
      ctx.lineWidth = Math.max(1.2, r * 0.22);
      ctx.strokeStyle = BLUE;
      ctx.stroke();
      dot(ctx, x, y, r * 0.38, BLUE);
    };

    // One element of a screen, finished. Text sizes follow the window, so a phone gets the same drawing smaller.
    const piece = (ctx, kind, x, y, w, h, label, fs, seed) => {
      const random = seeded(seed);
      const pad = clamp(Math.min(w, h) * 0.09, 5, 14);
      const card = () => {
        round(ctx, x, y, w, h, Math.min(10, h * 0.14));
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#e4e4e4';
        ctx.stroke();
      };
      const title = () => {
        write(ctx, label, x + pad, y + pad + fs * 0.9, fs, 650, INK);
        return y + pad + fs * 1.7;
      };
      const line = Math.max(3, Math.min(h * 0.07, fs * 0.62));
      // Bars that run edge to edge keep square corners; the outline, the floating popup and the bubble may reach past their box.
      const reach = kind === 'gaze' || kind === 'popup' || kind === 'voice' ? 12 : 1;
      const square = kind === 'nav' || kind === 'brand' || kind === 'top' || kind === 'side';
      ctx.save();
      round(ctx, x - reach, y - reach, w + 2 * reach, h + 2 * reach, square ? 0 : Math.min(10, h * 0.14) + reach);
      ctx.clip();
      switch (kind) {
        case 'nav': {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = '#ececec';
          ctx.fillRect(x, y + h - 1, w, 1);
          dot(ctx, x + pad + h * 0.18, y + h / 2, h * 0.18, BLUE);
          capsule(ctx, x + pad + h * 0.5, y + h / 2 - h * 0.08, w * 0.1, h * 0.16, INK);
          for (let i = 0; i < 3; i++) capsule(ctx, x + w - pad - (i + 1) * w * 0.09, y + h / 2 - h * 0.06, w * 0.065, h * 0.12, '#cfcfcf');
          break;
        }
        case 'heading': {
          const lh = Math.min(h * 0.32, fs * 2);
          capsule(ctx, x, y + h * 0.08, w * 0.94, lh, INK);
          capsule(ctx, x, y + h * 0.08 + lh * 1.5, w * 0.6, lh, INK);
          break;
        }
        case 'lines': {
          const lh = Math.min(h * 0.17, fs * 0.8);
          [0.96, 0.9, 0.56].forEach((share, i) => capsule(ctx, x, y + lh * 0.3 + i * lh * 2.1, w * share, lh, '#e2e2e2'));
          break;
        }
        case 'button': {
          capsule(ctx, x, y, w, h, BLUE);
          write(ctx, label, x + w / 2, y + h * 0.66, Math.min(fs, h * 0.48), 600, '#ffffff', 'center');
          break;
        }
        case 'picture': {
          round(ctx, x, y, w, h, 10);
          ctx.fillStyle = '#e4edff';
          ctx.fill();
          ctx.save();
          ctx.clip();
          dot(ctx, x + w * 0.74, y + h * 0.3, h * 0.12, '#a9c6ff');
          ctx.fillStyle = '#7fa8ff';
          ctx.beginPath();
          ctx.moveTo(x, y + h);
          ctx.lineTo(x + w * 0.3, y + h * 0.42);
          ctx.lineTo(x + w * 0.58, y + h);
          ctx.fill();
          ctx.fillStyle = '#4d86ff';
          ctx.beginPath();
          ctx.moveTo(x + w * 0.32, y + h);
          ctx.lineTo(x + w * 0.66, y + h * 0.55);
          ctx.lineTo(x + w, y + h);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'card': {
          card();
          round(ctx, x + pad, y + pad, w - 2 * pad, h * 0.46, 6);
          ctx.fillStyle = '#eef2f8';
          ctx.fill();
          capsule(ctx, x + pad, y + h * 0.64, (w - 2 * pad) * 0.9, line, INK);
          capsule(ctx, x + pad, y + h * 0.64 + line * 2.2, (w - 2 * pad) * 0.6, line, '#dcdcdc');
          break;
        }
        case 'gaze': {
          round(ctx, x, y, w, h, 12);
          ctx.lineWidth = 8;
          ctx.strokeStyle = 'rgba(0, 108, 255, 0.16)';
          ctx.stroke();
          ctx.lineWidth = 3;
          ctx.strokeStyle = BLUE;
          ctx.stroke();
          break;
        }
        case 'voice': {
          capsule(ctx, x, y, w, h, INK);
          const m = h * 0.5;
          round(ctx, x + m * 0.62, y + h * 0.22, m * 0.34, h * 0.34, m * 0.17);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + m * 0.79, y + h * 0.42, m * 0.34, 0.15, Math.PI - 0.15);
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          write(ctx, label, x + m * 1.45, y + h * 0.66, Math.min(fs, h * 0.46), 600, '#ffffff');
          break;
        }
        case 'popup': {
          ctx.save();
          ctx.shadowColor = 'rgba(17, 17, 17, 0.16)';
          ctx.shadowBlur = 16;
          ctx.shadowOffsetY = 6;
          card();
          ctx.restore();
          eye(ctx, x + pad + fs * 0.6, y + pad + fs * 0.6, fs * 0.55);
          write(ctx, label, x + pad + fs * 1.55, y + pad + fs * 0.98, fs, 700, INK);
          const rowTop = y + pad + fs * 2.4;
          const step = (h - (rowTop - y) - pad) / 3;
          for (let i = 0; i < 3; i++) {
            const ry = rowTop + step * i + step * 0.5;
            if (i === 0) write(ctx, '응시 클릭', x + pad, ry + fs * 0.35, fs * 0.88, 500, INK);
            else capsule(ctx, x + pad, ry - fs * 0.3, w * 0.34, fs * 0.6, '#e2e2e2');
            const tw = fs * 1.9;
            const th = fs * 1.05;
            capsule(ctx, x + w - pad - tw, ry - th / 2, tw, th, i === 0 ? BLUE : '#d9d9d9');
            dot(ctx, i === 0 ? x + w - pad - th / 2 : x + w - pad - tw + th / 2, ry, th * 0.38, '#ffffff');
          }
          break;
        }
        case 'brand': {
          ctx.fillStyle = '#111111';
          ctx.fillRect(x, y, w, h);
          write(ctx, label, x + pad * 1.4, y + h * 0.64, Math.min(fs * 1.15, h * 0.45), 800, '#ffffff');
          for (let i = 0; i < 3; i++) capsule(ctx, x + w - pad - (i + 1) * w * 0.08, y + h / 2 - h * 0.07, w * 0.055, h * 0.14, '#3a3a3a');
          break;
        }
        case 'index': {
          card();
          write(ctx, label, x + pad, y + pad + fs * 0.85, fs * 0.86, 600, '#4a4a4a');
          const up = random() > 0.4;
          const top = y + pad + fs * 1.5;
          const bottom = y + h - pad;
          const n = 16;
          let v = 0.5;
          const pts = [];
          for (let i = 0; i < n; i++) {
            v = clamp(v + (random() - (up ? 0.38 : 0.62)) * 0.22, 0.05, 0.95);
            pts.push([x + pad + ((w - 2 * pad) * i) / (n - 1), bottom - (bottom - top) * v]);
          }
          ctx.beginPath();
          pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
          ctx.lineWidth = 1.8;
          ctx.lineJoin = 'round';
          ctx.strokeStyle = up ? UP : DOWN;
          ctx.stroke();
          ctx.lineTo(pts[n - 1][0], bottom);
          ctx.lineTo(pts[0][0], bottom);
          ctx.globalAlpha *= 0.1;
          ctx.fillStyle = up ? UP : DOWN;
          ctx.fill();
          break;
        }
        case 'flows': {
          card();
          const top = title();
          if (w > fs * 22) {
            [['외국인', BLUE], ['기관', '#ff6b2c'], ['프로그램', '#12a150']].reverse().reduce((right, [name, ink]) => {
              ctx.font = `500 ${fs * 0.78}px ${FAMILY}`;
              const tw = ctx.measureText(name).width;
              write(ctx, name, right - tw, y + pad + fs * 0.85, fs * 0.78, 500, '#6b6b6b');
              dot(ctx, right - tw - fs * 0.5, y + pad + fs * 0.58, fs * 0.22, ink);
              return right - tw - fs * 1.4;
            }, x + w - pad);
          }
          const mid = (top + y + h - pad) / 2;
          const reach = (y + h - pad - top) / 2;
          ctx.fillStyle = '#e8e8e8';
          ctx.fillRect(x + pad, mid, w - 2 * pad, 1);
          const groups = w > 300 ? 9 : 6;
          const gw = (w - 2 * pad) / groups;
          for (let i = 0; i < groups; i++) {
            [BLUE, '#ff6b2c', '#12a150'].forEach((ink, j) => {
              const v = (random() - 0.45) * 1.6;
              const bh = Math.abs(v) * reach * 0.9;
              ctx.fillStyle = ink;
              ctx.fillRect(x + pad + gw * i + gw * 0.18 + j * gw * 0.22, v > 0 ? mid - bh : mid + 1, gw * 0.18, bh);
            });
          }
          break;
        }
        case 'rank': {
          card();
          const top = title();
          const rows = clamp(Math.floor((y + h - pad - top) / (fs * 1.35)), 2, 5);
          const step = (y + h - pad - top) / rows;
          [0.42, 0.5, 0.36, 0.46, 0.3].slice(0, rows).forEach((share, i) => {
            const ry = top + step * i + step / 2;
            write(ctx, String(i + 1), x + pad, ry + fs * 0.32, fs * 0.82, 600, '#9a9a9a');
            capsule(ctx, x + pad + fs * 1.2, ry - line / 2, (w - 2 * pad) * share, line, '#e3e3e3');
            capsule(ctx, x + w - pad - w * 0.13, ry - line / 2, w * 0.13, line, i < 3 ? UP : DOWN);
          });
          break;
        }
        case 'summary': {
          card();
          const top = title();
          ctx.font = `650 ${fs}px ${FAMILY}`;
          const sx = x + pad + ctx.measureText(label).width + fs * 0.9;
          const sy = y + pad + fs * 0.55;
          const r = fs * 0.5;
          ctx.beginPath();
          ctx.moveTo(sx, sy - r);
          ctx.quadraticCurveTo(sx, sy, sx + r, sy);
          ctx.quadraticCurveTo(sx, sy, sx, sy + r);
          ctx.quadraticCurveTo(sx, sy, sx - r, sy);
          ctx.quadraticCurveTo(sx, sy, sx, sy - r);
          ctx.fillStyle = BLUE;
          ctx.fill();
          [0.94, 0.86, 0.6].forEach((share, i) => capsule(ctx, x + pad, top + i * line * 2.3, (w - 2 * pad) * share, line, '#e3e3e3'));
          break;
        }
        case 'compare': {
          card();
          const top = title();
          [['KRX', 0.82, BLUE], ['NXT', 0.56, '#9bb8ff']].forEach(([name, share, ink], i) => {
            const ry = top + i * fs * 1.9 + fs * 0.4;
            write(ctx, name, x + pad, ry + fs * 0.35, fs * 0.82, 600, '#4a4a4a');
            capsule(ctx, x + pad + fs * 2.6, ry - line * 0.7, (w - 2 * pad - fs * 2.6) * share, line * 1.4, ink);
          });
          break;
        }
        case 'side': {
          ctx.fillStyle = '#111111';
          ctx.fillRect(x, y, w, h);
          write(ctx, label, x + pad * 1.3, y + pad + fs * 1.3, fs * 1.15, 800, '#ffffff');
          for (let i = 0; i < 5; i++) {
            const ry = y + pad + fs * 3.2 + i * fs * 2.3;
            if (i === 0) capsule(ctx, x + pad * 0.7, ry - fs * 0.75, w - pad * 1.4, fs * 1.6, BLUE);
            capsule(ctx, x + pad * 1.3, ry - fs * 0.22, (w - pad * 2.6) * (0.7 - i * 0.07), fs * 0.44, i === 0 ? '#ffffff' : '#3a3a3a');
          }
          break;
        }
        case 'top': {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = '#e8e8e8';
          ctx.fillRect(x, y + h - 1, w, 1);
          let left = x + pad * 1.3;
          if (label) {
            write(ctx, label, left, y + h * 0.64, Math.min(fs * 1.1, h * 0.46), 800, INK);
            left += fs * 4;
          }
          capsule(ctx, left, y + h * 0.28, w * 0.4, h * 0.44, '#f0f1f4');
          dot(ctx, x + w - pad - h * 0.22, y + h / 2, h * 0.22, BLUE);
          break;
        }
        case 'timetable': {
          card();
          const top = title();
          const cols = 5;
          const rows = h > 200 ? 6 : 5;
          const cw = (w - 2 * pad) / cols;
          '월화수목금'.split('').forEach((day, i) => write(ctx, day, x + pad + cw * i + cw / 2, top + fs * 0.4, fs * 0.8, 600, '#6b6b6b', 'center'));
          const gridTop = top + fs * 1.1;
          const ch = (y + h - pad - gridTop) / rows;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const pick = random();
              round(ctx, x + pad + cw * c + 2, gridTop + ch * r + 2, cw - 4, ch - 4, 4);
              ctx.fillStyle = pick < 0.78 ? SOFT[Math.floor(random() * SOFT.length)] : '#f4f4f6';
              ctx.fill();
            }
          }
          break;
        }
        case 'dday': {
          card();
          const top = title();
          ['D-7', 'D-12'].forEach((left, i) => {
            const ry = top + i * fs * 2 + fs * 0.5;
            dot(ctx, x + pad + fs * 0.3, ry, fs * 0.3, i ? '#7c5cff' : '#ff6b2c');
            capsule(ctx, x + pad + fs * 1, ry - line / 2, (w - 2 * pad) * 0.38, line, '#e3e3e3');
            write(ctx, left, x + w - pad, ry + fs * 0.36, fs * 0.95, 700, BLUE, 'right');
          });
          break;
        }
        case 'todo': {
          card();
          const top = title();
          [0.62, 0.5, 0.7].forEach((share, i) => {
            const ry = top + i * fs * 1.85 + fs * 0.4;
            const b = fs * 0.9;
            round(ctx, x + pad, ry - b / 2, b, b, 3);
            if (i === 0) {
              ctx.fillStyle = BLUE;
              ctx.fill();
              ctx.beginPath();
              ctx.moveTo(x + pad + b * 0.22, ry);
              ctx.lineTo(x + pad + b * 0.43, ry + b * 0.2);
              ctx.lineTo(x + pad + b * 0.78, ry - b * 0.2);
              ctx.lineWidth = 1.6;
              ctx.strokeStyle = '#ffffff';
              ctx.stroke();
            } else {
              ctx.lineWidth = 1.2;
              ctx.strokeStyle = '#c9c9c9';
              ctx.stroke();
            }
            capsule(ctx, x + pad + b * 1.6, ry - line / 2, (w - 2 * pad - b * 1.6) * share, line, '#e3e3e3');
          });
          break;
        }
        case 'meal': {
          card();
          const top = title();
          [0.6, 0.48, 0.66, 0.4].forEach((share, i) => {
            const ry = top + i * fs * 1.6 + fs * 0.3;
            dot(ctx, x + pad + fs * 0.2, ry, fs * 0.2, '#f2a900');
            capsule(ctx, x + pad + fs * 0.8, ry - line / 2, (w - 2 * pad) * share, line, '#e3e3e3');
          });
          break;
        }
        case 'cards': {
          card();
          const top = title();
          const cw = (w - 2 * pad) * 0.7;
          const ch = Math.max(fs * 2, y + h - pad - top);
          ctx.save();
          ctx.translate(x + pad + cw * 0.62, top + ch / 2);
          ctx.rotate(-0.07);
          round(ctx, -cw / 2, -ch / 2, cw, ch, 8);
          ctx.fillStyle = '#ebe5ff';
          ctx.fill();
          ctx.restore();
          round(ctx, x + pad, top, cw, ch, 8);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#dcdcdc';
          ctx.stroke();
          capsule(ctx, x + pad + cw * 0.12, top + ch * 0.38, cw * 0.5, line * 1.3, INK);
          capsule(ctx, x + pad + cw * 0.12, top + ch * 0.38 + line * 2.4, cw * 0.32, line, '#cfcfcf');
          break;
        }
        default:
      }
      ctx.restore();
    };

    // The browser window, its address bar and the empty page; returns where the page is.
    const frame = (ctx, r, k) => {
      const screen = SCREENS[k];
      const narrow = r.w / r.h < 1.05 || (r.w < 400 && r.w / r.h < 1.4);
      const bar = clamp(r.w * 0.042, 22, 34);
      const rad = clamp(r.w * 0.016, 8, 14);
      ctx.save();
      ctx.shadowColor = 'rgba(17, 17, 17, 0.14)';
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 14;
      round(ctx, r.x, r.y, r.w, r.h, rad);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
      ctx.save();
      round(ctx, r.x, r.y, r.w, r.h, rad);
      ctx.clip();
      ctx.fillStyle = '#efefef';
      ctx.fillRect(r.x, r.y, r.w, bar);
      ['#ff5f57', '#febc2e', '#28c840'].forEach((ink, i) => dot(ctx, r.x + bar * 0.5 + i * bar * 0.42, r.y + bar / 2, bar * 0.12, ink));
      const ux = r.x + bar * 1.75;
      const uw = r.w - bar * 1.75 - bar * (screen.eye ? 1.35 : 0.5);
      const uh = bar * 0.6;
      capsule(ctx, ux, r.y + (bar - uh) / 2, uw, uh, '#ffffff');
      write(ctx, screen.url, ux + uh * 0.6, r.y + bar / 2 + bar * 0.13, bar * 0.36, 500, '#6b6b6b');
      if (screen.eye) eye(ctx, r.x + r.w - bar * 0.72, r.y + bar / 2, bar * 0.2);
      ctx.fillStyle = screen.ground;
      ctx.fillRect(r.x, r.y + bar, r.w, r.h - bar);
      ctx.restore();
      round(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, rad);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#dedede';
      ctx.stroke();
      const fs = narrow ? clamp(r.w * 0.032, 8.5, 12.5) : clamp(r.w * 0.0165, 9, 14);
      return { x: r.x, y: r.y + bar, w: r.w, h: r.h - bar, narrow, fs, rad, outer: r };
    };
    const clipPage = (ctx, g) => {
      ctx.save();
      round(ctx, g.outer.x, g.outer.y, g.outer.w, g.outer.h, g.rad);
      ctx.clip();
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.w, g.h);
      ctx.clip();
    };
    const parts = (k, g) => SCREENS[k][g.narrow ? 'narrow' : 'wide'].map((b) => ({ x: g.x + b[0] * g.w, y: g.y + b[1] * g.h, w: b[2] * g.w, h: b[3] * g.h, kind: b[4], label: b[5] || '' }));
    const draw = (ctx, b, g, k, j) => piece(ctx, b.kind, b.x, b.y, b.w, b.h, b.label, g.fs, 101 + k * 37 + j * 11);

    // The outline a cursor drags out, with its handles and the size it has reached.
    const selection = (ctx, x, y, w, h, ink, g) => {
      ctx.save();
      ctx.globalAlpha *= 0.08;
      ctx.fillStyle = ink;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = ink;
      ctx.strokeRect(x, y, w, h);
      [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy]) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(hx - 3, hy - 3, 6, 6);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(hx - 3, hy - 3, 6, 6);
      });
      const scale = (g.narrow ? 390 : 1280) / g.w;
      const text = `${Math.round(w * scale)} × ${Math.round(h * scale)}`;
      const size = g.fs * 0.8;
      ctx.font = `600 ${size}px ${FAMILY}`;
      const tw = ctx.measureText(text).width + size;
      const th = size * 1.6;
      const ly = y + h + 5 + th > g.y + g.h ? y + h - th - 5 : y + h + 5;
      round(ctx, x, ly, tw, th, 4);
      ctx.fillStyle = ink;
      ctx.fill();
      write(ctx, text, x + size / 2, ly + th * 0.7, size, 600, '#ffffff');
    };

    const ARROW = [[0, 0], [0, 17], [4.4, 13], [7.4, 19.4], [10.4, 18.1], [7.5, 11.9], [13, 11.9]];
    const cursor = (ctx, x, y, ink, scale) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ARROW.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = ink;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    };
    const status = (ctx, g, done, total) => {
      const size = g.fs * 0.86;
      const text = `에이전트 ${agents.length} · ${done}/${total}`;
      ctx.font = `600 ${size}px ${FAMILY}`;
      const dots = 4;
      const r = size * 0.36;
      const pw = ctx.measureText(text).width + size * 1.6 + dots * r * 1.4 + r;
      const ph = size * 2;
      const px = g.outer.x + g.outer.w / 2 - pw / 2;
      const py = g.outer.y + g.outer.h - ph / 2;
      capsule(ctx, px, py, pw, ph, INK);
      for (let i = 0; i < dots; i++) {
        dot(ctx, px + size * 0.8 + r + i * r * 1.4, py + ph / 2, r + 1, INK);
        dot(ctx, px + size * 0.8 + r + i * r * 1.4, py + ph / 2, r, INKS[i]);
      }
      write(ctx, text, px + size * 0.8 + dots * r * 1.4 + r * 1.6, py + ph * 0.66, size, 600, '#ffffff');
    };

    // Critically damped, from where the cursor is now, so the scroll and the pointer can both pull on it.
    const follow = (a, tx, ty, dt, omega) => {
      if (!a.ready || !dt) {
        a.x = tx;
        a.y = ty;
        a.vx = 0;
        a.vy = 0;
        a.ready = true;
        return;
      }
      const k = omega * omega;
      const d = 1 + dt * 2 * omega + dt * dt * k;
      a.vx = (a.vx + dt * k * (tx - a.x)) / d;
      a.vy = (a.vy + dt * k * (ty - a.y)) / d;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
    };
    const idle = (i, now, g) => {
      const turn = i * 2.39996 + now * 0.00011 * (0.7 + (i % 4) * 0.2);
      let x = g.x + g.w / 2 + Math.cos(turn) * g.w * (0.3 + 0.1 * Math.sin(i * 1.7 + now * 0.00023));
      let y = g.y + g.h / 2 + Math.sin(turn * 1.3) * g.h * (0.28 + 0.08 * Math.cos(i * 2.3 + now * 0.00019));
      const o = g.outer;
      if (now < hand.until && hand.x > o.x - 48 && hand.x < o.x + o.w + 48 && hand.y > o.y - 48 && hand.y < o.y + o.h + 48) {
        x = lerp(x, hand.x + Math.cos(i * 2.39996) * 52, 0.6);
        y = lerp(y, hand.y + Math.sin(i * 2.39996) * 52, 0.6);
      }
      return [x, y];
    };

    const layout = () => {
      view = fit(canvas);
      const { w, h } = view;
      const S = stage.getBoundingClientRect();
      const C = copy.getBoundingClientRect();
      const m = Math.max(16, C.left - S.left);
      let r;
      if (side.matches) {
        const x = C.right - S.left + clamp(w * 0.04, 24, 72);
        const ww = w - m - x;
        const wh = Math.min(h - 2 * Math.max(72, h * 0.12), ww * 0.64, h - 112);
        r = { x, y: Math.max(64, (h - wh) / 2 + h * 0.03), w: ww, h: wh };
      } else {
        const y = C.bottom - S.top + clamp(h * 0.03, 16, 32);
        const ww = w - 2 * m;
        r = { x: m, y, w: ww, h: Math.min(h - y - 56, ww * 1.45) };
      }
      win = { ...r, h: Math.max(140, r.h) };
      const count = win.w < 560 ? 8 : 12;
      if (agents.length !== count) agents = INKS.slice(0, count).map((ink) => ({ ink, x: 0, y: 0, vx: 0, vy: 0, ready: false }));
    };

    // Resting: the three finished screens stacked like windows on a desk, the cursors parked on the last one.
    const still = (ctx) => {
      const { w, h } = view;
      const wide = w >= 560;
      const ww = wide ? Math.min(w * 0.7, h * 0.86 * 1.55) : w * 0.84;
      const wh = wide ? ww / 1.55 : Math.min(h * 0.8, ww * 1.2);
      const dx = Math.min(w * 0.06, (w - ww) / 2);
      const dy = Math.min(h * 0.05, (h - wh) / 2);
      const x0 = (w - ww - 2 * dx) / 2;
      const y0 = (h - wh - 2 * dy) / 2;
      SCREENS.forEach((_, k) => {
        const g = frame(ctx, { x: x0 + k * dx, y: y0 + k * dy, w: ww, h: wh }, k);
        clipPage(ctx, g);
        parts(k, g).forEach((b, j) => draw(ctx, b, g, k, j));
        ctx.restore();
        if (k === SCREENS.length - 1) {
          parts(k, g).forEach((b, j) => {
            if (j < 4) cursor(ctx, b.x + b.w * 0.7, b.y + b.h * 0.62, INKS[j], g.narrow ? 0.85 : 1);
          });
        }
      });
    };

    const paint = (now = performance.now()) => {
      if (!view || !win) return;
      const { ctx, w, h } = view;
      const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0;
      last = now;
      ctx.clearRect(0, 0, w, h);
      if (!root.classList.contains('is-live')) { still(ctx); return; }
      const p = s.p;
      const k = p < INTRO ? 0 : Math.min(SCREENS.length - 1, Math.floor((p - INTRO) / SEG));
      const u = p < INTRO ? 0 : clamp((p - INTRO - k * SEG) / SEG, 0, 1);
      if (k !== shown) {
        items.forEach((li, i) => li.classList.toggle('is-on', i === k));
        shown = k;
      }
      const g = frame(ctx, win, k);
      const list = parts(k, g);
      const starts = list.map((_, j) => 0.1 + (j * 0.64) / list.length);
      const grown = list.map((_, j) => span(u, starts[j], starts[j] + DUR));
      clipPage(ctx, g);
      if (k > 0 && u < FADE) {
        ctx.globalAlpha = 1 - smooth(u / FADE);
        parts(k - 1, g).forEach((b, j) => draw(ctx, b, g, k - 1, j));
        ctx.globalAlpha = 1;
      }
      list.forEach((b, j) => {
        const seen = smooth(span(grown[j], 0.55, 1));
        if (seen <= 0) return;
        ctx.globalAlpha = seen;
        draw(ctx, b, g, k, j);
        ctx.globalAlpha = 1;
      });
      const A = agents.length;
      list.forEach((b, j) => {
        const a = grown[j];
        if (a <= 0 || a >= 1) return;
        const e = smooth(Math.min(1, a / 0.6));
        ctx.globalAlpha = 1 - smooth(span(a, 0.75, 1));
        selection(ctx, b.x, b.y, b.w * e, b.h * e, agents[(j + k * 4) % A].ink, g);
        ctx.globalAlpha = 1;
      });
      ctx.restore();
      status(ctx, g, grown.filter((a) => a >= 1).length, list.length);

      agents.forEach((agent, i) => {
        let [tx, ty] = idle(i, now, g);
        let omega = 5;
        if (p < INTRO) {
          const t = smooth(span(p, 0, INTRO));
          const ex = i % 2 ? w + 30 + (i % 3) * 24 : g.outer.x + g.outer.w * ((i * 0.618) % 1);
          const ey = i % 2 ? g.outer.y + g.outer.h * ((i * 0.618) % 1) : h + 30 + (i % 3) * 24;
          tx = lerp(ex, tx, t);
          ty = lerp(ey, ty, t);
          omega = 9;
        }
        list.forEach((b, j) => {
          if ((j + k * 4) % A !== i) return;
          const start = starts[j];
          if (u >= start - 0.06 && u < start) {
            const t = smooth(span(u, start - 0.06, start));
            tx = lerp(tx, b.x, t);
            ty = lerp(ty, b.y, t);
            omega = 14;
          } else if (u >= start && u < start + DUR * 0.6) {
            const e = smooth(span(u, start, start + DUR * 0.6));
            tx = b.x + b.w * e;
            ty = b.y + b.h * e;
            omega = 40;
          } else if (u >= start + DUR * 0.6 && u < start + DUR + 0.05) {
            tx = b.x + b.w + 4;
            ty = b.y + b.h + 4;
            omega = 20;
          }
        });
        follow(agent, tx, ty, dt, omega);
        cursor(ctx, agent.x, agent.y, agent.ink, g.narrow ? 0.85 : 1);
      });
    };

    const mm = Stage.scene(root, {
      hold: o.hold ?? 7.5,
      scrub: 0.6,
      phone: { hold: 5.5 },
      build(tl) {
        s.p = 0;
        tl.to(s, { p: 1, duration: 1 }, 0);
        layout();
      },
      rest() {
        s.p = 1;
        layout();
        paint();
        new ResizeObserver(() => { if (root.classList.contains('is-rest')) { layout(); paint(); } }).observe(canvas);
      },
    });
    if (root.classList.contains('is-live')) {
      ScrollTrigger.addEventListener('refresh', () => { layout(); paint(); });
      whileVisible(stage, paint);
      stage.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = stage.getBoundingClientRect();
        hand.x = e.clientX - r.left;
        hand.y = e.clientY - r.top;
        hand.until = Infinity;
      }, { passive: true });
      stage.addEventListener('pointerleave', () => { hand.until = 0; });
      stage.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        const r = stage.getBoundingClientRect();
        hand.x = e.clientX - r.left;
        hand.y = e.clientY - r.top;
        hand.until = performance.now() + 1500;
      }, { passive: true });
    }
    return mm;
  };

  /* Tool: one thread crosses three fields. Six candidates narrow to one, that one is tuned, and it goes to work
     on live data. The scroll draws it from left to right; stacked, each field draws its own part. */
  const tool = () => {
    const root = document.querySelector('.tool');
    const canvases = [...root.querySelectorAll('canvas')];
    const random = seeded(7);
    const N = 160;
    const wiggle = () => {
      const parts = Array.from({ length: 4 }, (_, i) => ({ f: 2 + i * 3 + random() * 3, ph: random() * TAU, a: 1 / (i + 1) }));
      return (x) => parts.reduce((sum, c) => sum + c.a * Math.sin(c.f * x * TAU + c.ph), 0) / 2;
    };
    const SEAM_A = 0.34;
    const SEAM_B = 0.74;

    // Review: six lines come in apart. Five stop where they were dropped; the chosen one runs on to the seam.
    const review = [0.1, 0.25, 0.42, 0.58, 0.74, 0.9].map((y0, k) => {
      const w = wiggle();
      const chosen = k === 1;
      const end = chosen ? 1 : [0.5, 0, 0.72, 0.42, 0.86, 0.62][k];
      const goal = chosen ? SEAM_A : lerp(y0, 0.5, 0.45);
      return { chosen, end, y: (x) => lerp(y0, goal, smooth(x / (chosen ? 1 : Math.max(end, 0.01)))) + 0.018 * w(x) * (chosen ? Math.sin(Math.PI * x) : 1) };
    });
    // Tuning: runs fall as error falls; the kept run falls furthest and settles.
    const tuning = [[0.5, 0.05, false], [0.6, 0.06, false], [SEAM_B, 0.045, true]].map(([floor, amp, chosen]) => {
      const w = wiggle();
      return { chosen, end: chosen ? 1 : 0.9, y: (x) => lerp(SEAM_A, floor, 1 - Math.exp(-4.4 * x)) + amp * w(x) * Math.sin(Math.PI * Math.min(1, x * 1.15)) * Math.exp(-2.4 * x) + (chosen ? (SEAM_B - lerp(SEAM_A, floor, 1 - Math.exp(-4.4))) * x : 0) };
    });
    // Decision: the line holds a band around normal, and three moves leave the band.
    const w3 = wiggle();
    const mid = (x) => lerp(SEAM_B, 0.56, smooth(Math.min(1, x / 0.14))) + 0.022 * Math.sin(TAU * 1.3 * x) * Math.min(1, x / 0.14);
    const spikes = [[0.3, 0.3], [0.56, 0.36], [0.8, 0.27]];
    const live = (x) => mid(x) + 0.016 * w3(x) * Math.min(1, x / 0.14) - spikes.reduce((sum, [at, up]) => sum + up * Math.exp(-((x - at) ** 2) / 0.00028), 0);

    const TONES = [
      { thread: '0,108,255', rest: '29,29,29', dot: '#006cff' },
      { thread: '0,108,255', rest: '29,29,29', dot: '#006cff' },
      { thread: '0,108,255', rest: '29,29,29', dot: '#006cff' },
    ];
    const prog = [0, 0, 0];
    const views = [];

    const stroke = (ctx, X, Y, fn, until) => {
      ctx.beginPath();
      const last = Math.floor(until * N);
      for (let i = 0; i <= last; i++) {
        const x = i / N;
        if (i) ctx.lineTo(X(x), Y(fn(x))); else ctx.moveTo(X(x), Y(fn(x)));
      }
      if (until * N > last) ctx.lineTo(X(until), Y(fn(until)));
      ctx.stroke();
    };
    const dot = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };

    const draw = (k) => {
      const view = views[k];
      if (!view) return;
      const { ctx, w, h } = view;
      const tone = TONES[k];
      const p = prog[k];
      const X = (x) => x * w;
      const Y = (y) => y * h;
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (k === 2) {
        ctx.fillStyle = 'rgba(29,29,29,0.06)';
        ctx.beginPath();
        for (let i = 0; i <= N; i++) ctx.lineTo(X(i / N), Y(mid(i / N) - 0.075 * smooth(Math.min(1, (i / N) / 0.14))));
        for (let i = N; i >= 0; i--) ctx.lineTo(X(i / N), Y(mid(i / N) + 0.075 * smooth(Math.min(1, (i / N) / 0.14))));
        ctx.closePath();
        ctx.fill();
      }
      const lines = k === 0 ? review : k === 1 ? tuning : [];
      lines.forEach((line) => {
        if (line.chosen) return;
        const until = Math.min(p, line.end);
        if (until <= 0) return;
        ctx.strokeStyle = `rgba(${tone.rest},0.42)`;
        ctx.lineWidth = 1.25;
        stroke(ctx, X, Y, line.y, until);
        if (p >= line.end) {
          ctx.fillStyle = `rgba(${tone.rest},0.7)`;
          dot(ctx, X(line.end), Y(line.y(line.end)), 3);
        }
      });
      const thread = k === 2 ? live : lines.find((l) => l.chosen).y;
      ctx.strokeStyle = `rgb(${tone.thread})`;
      ctx.lineWidth = 2.5;
      if (p > 0) stroke(ctx, X, Y, thread, p);
      if (k === 2) {
        spikes.forEach(([at]) => {
          if (p < at) return;
          const px = X(at);
          const py = Y(live(at));
          ctx.fillStyle = 'rgba(0,108,255,0.18)';
          dot(ctx, px, py, 13);
          ctx.fillStyle = tone.dot;
          dot(ctx, px, py, 5.5);
        });
      }
      if (p > 0 && p < 1) {
        ctx.fillStyle = tone.dot;
        dot(ctx, X(p), Y(thread(p)), 5);
      }
    };
    const drawAll = () => canvases.forEach((_, k) => draw(k));
    const size = () => {
      canvases.forEach((canvas, k) => { views[k] = fit(canvas); });
      drawAll();
    };
    const setStack = (ps) => { ps.forEach((v, k) => { prog[k] = v; }); drawAll(); };

    if (!Stage.live || calm()) setStack([1, 1, 1]);
    else {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px)', () => {
        const strip = root.querySelector('.tool__strip');
        // Starts part-drawn, so the strip never rises into view empty. The empty timeline makes the trigger wait for the
        // next tick to measure itself; measuring at once here sends the page to the top when the window crosses this width.
        ScrollTrigger.create({
          animation: gsap.timeline(),
          trigger: strip,
          start: 'top 85%',
          end: 'bottom 45%',
          scrub: 0.6,
          onUpdate: (self) => {
            const t = lerp(0.12, 1, self.progress);
            setStack([span(t, 0, 1 / 3), span(t, 1 / 3, 2 / 3), span(t, 2 / 3, 1)]);
          },
          onRefresh: (self) => {
            const t = lerp(0.12, 1, self.progress);
            setStack([span(t, 0, 1 / 3), span(t, 1 / 3, 2 / 3), span(t, 2 / 3, 1)]);
          },
        });
      });
      mm.add('(max-width: 1023.98px)', () => {
        canvases.forEach((canvas, k) => {
          const run = (self) => { prog[k] = lerp(0.1, 1, self.progress); draw(k); };
          ScrollTrigger.create({ animation: gsap.timeline(), trigger: canvas, start: 'top 90%', end: 'bottom 25%', scrub: 0.6, onUpdate: run, onRefresh: run });
        });
      });
    }
    size();
    new ResizeObserver(size).observe(root.querySelector('.tool__strip'));
  };

  /* Segmented controls share one behaviour: the thumb follows the pressed button. */
  const segmented = (el, onChange) => {
    const buttons = [...el.querySelectorAll('button')];
    el.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button || button.getAttribute('aria-pressed') === 'true') return;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      el.style.setProperty('--at', buttons.indexOf(button));
      onChange(button);
    });
  };

  /* Flow: every request is judged by the same two written rules. Pressing a gate moves its criterion. */
  const flow = () => {
    const root = document.querySelector('.flow');
    const box = root.querySelector('.flow__graph');
    const canvas = box.querySelector('canvas');
    const start = box.querySelector('.flow__start');
    const gates = [...box.querySelectorAll('.flow__gate')];
    const bins = [...box.querySelectorAll('.flow__bin')];
    const hint = root.querySelector('.flow__hint');
    box.hidden = false;
    hint.hidden = false;

    const LEVELS = [
      [{ name: '엄격', at: 0.9 }, { name: '보통', at: 0.78 }, { name: '여유', at: 0.55 }],
      [{ name: '엄격', at: 0.72 }, { name: '보통', at: 0.42 }, { name: '여유', at: 0.16 }],
    ];
    const level = [1, 1];
    const random = seeded(23);
    const recent = [];
    const WINDOW = 60;
    const route = (u, r) => {
      if (u > LEVELS[0][level[0]].at) return 0;
      return r > LEVELS[1][level[1]].at ? 1 : 2;
    };
    const remember = (bin) => {
      recent.push(bin);
      if (recent.length > WINDOW) recent.shift();
    };
    for (let i = 0; i < WINDOW; i++) remember(route(random(), random()));

    let view = null;
    let paths = null;
    let tokens = [];
    let pulses = [0, 0, 0];
    let spawn = 0;
    let last = 0;
    let shown = '';
    const still = calm();

    // A polyline with rounded corners, sampled so a token can be placed by distance.
    const trail = (pts, corner) => {
      const out = [];
      const add = (x, y) => out.push({ x, y });
      add(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const [cx, cy] = pts[i + 1];
        const d1 = Math.hypot(bx - ax, by - ay);
        const d2 = Math.hypot(cx - bx, cy - by);
        const c = Math.min(corner, d1 / 2, d2 / 2);
        const sx = bx + ((ax - bx) / d1) * c;
        const sy = by + ((ay - by) / d1) * c;
        const ex = bx + ((cx - bx) / d2) * c;
        const ey = by + ((cy - by) / d2) * c;
        add(sx, sy);
        for (let k = 1; k <= 10; k++) {
          const t = k / 10;
          const q = 1 - t;
          add(q * q * sx + 2 * q * t * bx + t * t * ex, q * q * sy + 2 * q * t * by + t * t * ey);
        }
      }
      const end = pts[pts.length - 1];
      add(end[0], end[1]);
      let total = 0;
      out[0].d = 0;
      for (let i = 1; i < out.length; i++) {
        total += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
        out[i].d = total;
      }
      return { pts: out, len: total };
    };
    const place = (t, d) => {
      const { pts } = t;
      let i = 1;
      while (i < pts.length - 1 && pts[i].d < d) i++;
      const a = pts[i - 1];
      const b = pts[i];
      const k = b.d > a.d ? clamp((d - a.d) / (b.d - a.d), 0, 1) : 0;
      return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
    };
    const lay = (el, x, y, ax, ay) => {
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(${ax}%, ${ay}%)`;
    };

    const layout = () => {
      view = fit(canvas);
      const { w, h } = view;
      const r = 26;
      let nodes;
      if (w < 640) {
        const g1 = [w * 0.5, h * 0.17];
        const g2 = [w * 0.5, h * 0.47];
        const end = h * 0.82;
        nodes = { s: [w * 0.5, 22], g1, g2, a: [w * 0.13, end], b: [w * 0.5, end], c: [w * 0.87, end] };
        paths = {
          in: trail([nodes.s, g1], r),
          a: trail([g1, [nodes.a[0], g1[1]], nodes.a], r),
          mid: trail([g1, g2], r),
          b: trail([g2, nodes.b], r),
          c: trail([g2, [nodes.c[0], g2[1]], nodes.c], r),
        };
        lay(start, nodes.s[0], 0, -50, 0);
        bins.forEach((el, i) => { const n = [nodes.a, nodes.b, nodes.c][i]; el.style.textAlign = 'center'; lay(el, clamp(n[0], 46, w - 46), n[1] + 8, -50, 0); });
      } else {
        const mid = h * 0.5;
        const g1 = [w * 0.26, mid];
        const g2 = [w * 0.6, mid];
        const right = w - 6;
        nodes = { s: [0, mid], g1, g2, a: [right, h * 0.13], b: [right, mid], c: [right, h * 0.87] };
        paths = {
          in: trail([nodes.s, g1], r),
          a: trail([g1, [g1[0], nodes.a[1]], nodes.a], r),
          mid: trail([g1, g2], r),
          b: trail([g2, nodes.b], r),
          c: trail([g2, [g2[0], nodes.c[1]], nodes.c], r),
        };
        lay(start, 0, mid - 12, 0, -100);
        bins.forEach((el, i) => { const n = [nodes.a, nodes.b, nodes.c][i]; el.style.textAlign = 'right'; lay(el, n[0], n[1] - 10, -100, -100); });
      }
      lay(gates[0], nodes.g1[0], nodes.g1[1], -50, -50);
      lay(gates[1], nodes.g2[0], nodes.g2[1], -50, -50);
      paths.ends = [nodes.a, nodes.b, nodes.c];
    };

    const tellShares = () => {
      const counts = [0, 0, 0];
      recent.forEach((b) => { counts[b]++; });
      const text = counts.map((c) => `${Math.round((c / recent.length) * 100)}%`);
      const key = text.join();
      if (key === shown) return;
      shown = key;
      bins.forEach((el, i) => { el.querySelector('span').textContent = text[i]; });
    };

    const partial = (ctx, t, frac) => {
      if (frac <= 0) return;
      const limit = t.len * frac;
      ctx.moveTo(t.pts[0].x, t.pts[0].y);
      for (let i = 1; i < t.pts.length; i++) {
        if (t.pts[i].d >= limit) {
          const q = place(t, limit);
          ctx.lineTo(q.x, q.y);
          return;
        }
        ctx.lineTo(t.pts[i].x, t.pts[i].y);
      }
    };

    const paint = (now) => {
      if (!view) return;
      const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0;
      last = now;
      const { ctx, w, h } = view;
      // The graph is drawn out by the scroll, in the order a request travels it.
      const rect = root.getBoundingClientRect();
      const drawn = still ? 1 : span((innerHeight * 0.92 - rect.top) / (innerHeight * 0.7), 0, 1);
      const first = span(drawn, 0, 0.34);
      const second = span(drawn, 0.3, 0.68);
      const third = span(drawn, 0.62, 1);
      start.style.opacity = first > 0 ? 1 : 0;
      gates[0].style.opacity = smooth(span(first, 0.8, 1));
      gates[1].style.opacity = smooth(span(second, 0.8, 1));
      bins[0].style.opacity = smooth(span(second, 0.8, 1));
      bins[1].style.opacity = smooth(span(third, 0.8, 1));
      bins[2].style.opacity = smooth(span(third, 0.8, 1));

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.42)';
      ctx.beginPath();
      partial(ctx, paths.in, first);
      partial(ctx, paths.a, second);
      partial(ctx, paths.mid, second);
      partial(ctx, paths.b, third);
      partial(ctx, paths.c, third);
      ctx.stroke();

      if (!still && drawn >= 1) {
        spawn -= dt;
        if (spawn <= 0) {
          spawn = 0.16;
          const u = random();
          const r = random();
          tokens.push({ on: 'in', d: 0, u, r, hue: -1 });
        }
        const speed = w < 640 ? 150 : 210;
        tokens = tokens.filter((t) => {
          t.d += speed * dt;
          const seg = paths[t.on];
          if (t.d < seg.len) return true;
          const over = t.d - seg.len;
          if (t.on === 'in') {
            const hit = t.u > LEVELS[0][level[0]].at;
            t.on = hit ? 'a' : 'mid';
            t.hue = hit ? 0 : -1;
            t.d = over;
            return true;
          }
          if (t.on === 'mid') {
            const hit = t.r > LEVELS[1][level[1]].at;
            t.on = hit ? 'b' : 'c';
            t.hue = hit ? 1 : 2;
            t.d = over;
            return true;
          }
          const bin = t.on === 'a' ? 0 : t.on === 'b' ? 1 : 2;
          remember(bin);
          pulses[bin] = 1;
          return false;
        });
        tellShares();
      }

      tokens.forEach((t) => {
        const q = place(paths[t.on], t.d);
        ctx.fillStyle = t.hue === 0 ? '#4d9bff' : t.hue === 2 ? 'rgba(255,255,255,0.55)' : '#ffffff';
        ctx.beginPath();
        ctx.arc(q.x, q.y, w < 640 ? 3.5 : 4.5, 0, TAU);
        ctx.fill();
      });
      if (paths.ends && third >= 1) {
        paths.ends.forEach((n, i) => {
          pulses[i] = Math.max(0, pulses[i] - dt * 2.6);
          const k = pulses[i];
          ctx.fillStyle = i === 0 ? '#4d9bff' : '#ffffff';
          ctx.beginPath();
          ctx.arc(n[0], n[1], 5 + k * 4, 0, TAU);
          ctx.fill();
        });
      }
    };

    gates.forEach((button, i) => {
      const tell = () => {
        const name = LEVELS[i][level[i]].name;
        button.querySelector('small').textContent = `기준 ${name}`;
        button.setAttribute('aria-label', `${button.querySelector('b').textContent}: 기준 ${name}. 선택하면 기준이 바뀝니다.`);
      };
      tell();
      button.addEventListener('click', () => {
        level[i] = (level[i] + 1) % LEVELS[i].length;
        tell();
        if (still) {
          recent.length = 0;
          for (let n = 0; n < WINDOW; n++) remember(route(random(), random()));
          tellShares();
        }
      });
    });

    new ResizeObserver(() => { layout(); paint(performance.now()); }).observe(box);
    layout();
    tellShares();
    const wake = whileVisible(box, paint);
    if (still) wake();
    addEventListener('scroll', () => { if (still) wake(); }, { passive: true });
  };

  /* The dot display: each dot's size is how much of a shape covers it, drawn small so edges stay soft. */
  const FAMILY = '"Pretendard Variable", Pretendard, sans-serif';
  const dotDisplay = (canvas, ink = '255,255,255') => {
    const still = calm();
    const off = document.createElement('canvas');
    const octx = off.getContext('2d', { willReadFrequently: true });
    let view = null;
    let cols = 0;
    let lines = 0;
    let pitch = 8;
    let x0 = 0;
    let y0 = 0;
    let cur = new Float32Array(0);
    let goal = new Float32Array(0);
    let wait = new Float32Array(0);
    let sinceChange = 9;
    let dirty = true;

    const takeGoal = () => {
      const d = octx.getImageData(0, 0, cols, lines).data;
      for (let i = 0; i < goal.length; i++) goal[i] = Math.pow(d[i * 4 + 3] / 255, 0.8);
    };
    const word = (text) => {
      octx.clearRect(0, 0, cols, lines);
      octx.fillStyle = '#ffffff';
      octx.textBaseline = 'alphabetic';
      octx.textAlign = 'left';
      octx.font = `700 100px ${FAMILY}`;
      const m = octx.measureText(text);
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const k = Math.min((cols * 0.88) / w, (lines * 0.68) / h);
      octx.font = `700 ${100 * k}px ${FAMILY}`;
      octx.fillText(text, (cols - w * k) / 2 + m.actualBoundingBoxLeft * k, (lines - h * k) / 2 + m.actualBoundingBoxAscent * k);
      takeGoal();
    };
    const box = (x, y, w, h, r) => {
      octx.beginPath();
      if (octx.roundRect) octx.roundRect(x, y, w, h, r); else octx.rect(x, y, w, h);
      octx.fill();
    };
    const shapes = {
      // The iris looks where the pointer is.
      eye(gx = 0, gy = 0) {
        const c = octx;
        c.clearRect(0, 0, cols, lines);
        const cx = cols / 2;
        const cy = lines / 2;
        const W = Math.min(cols * 0.84, lines * 1.46);
        const H = W * 0.62;
        const lid = () => {
          c.beginPath();
          c.moveTo(cx - W / 2, cy);
          c.quadraticCurveTo(cx, cy - H, cx + W / 2, cy);
          c.quadraticCurveTo(cx, cy + H, cx - W / 2, cy);
          c.closePath();
        };
        const ix = cx + gx * W * 0.2;
        const iy = cy + gy * H * 0.2;
        const r = H * 0.4;
        c.save();
        lid();
        c.clip();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(ix, iy, r, 0, TAU);
        c.fill();
        c.globalCompositeOperation = 'destination-out';
        c.beginPath();
        c.arc(ix, iy, r * 0.42, 0, TAU);
        c.fill();
        c.restore();
        c.strokeStyle = '#ffffff';
        c.lineWidth = Math.max(1.5, lines * 0.05);
        lid();
        c.stroke();
        takeGoal();
      },
      // A dashboard's panels, in the tones its tiles would have.
      tiles() {
        octx.clearRect(0, 0, cols, lines);
        const H = lines * 0.76;
        const W = Math.min(cols * 0.8, H * 1.55);
        const x = (cols - W) / 2;
        const y = (lines - H) / 2;
        const g = Math.max(1.2, lines * 0.035);
        const r = Math.max(1, lines * 0.03);
        const bar = H * 0.14;
        const bodyH = H - bar - g;
        octx.fillStyle = '#ffffff';
        box(x, y, W, bar, r);
        octx.fillStyle = 'rgba(255,255,255,0.5)';
        box(x, y + bar + g, W * 0.6 - g / 2, bodyH, r);
        octx.fillStyle = '#ffffff';
        box(x + W * 0.6 + g / 2, y + bar + g, W * 0.4 - g / 2, bodyH / 2 - g / 2, r);
        octx.fillStyle = 'rgba(255,255,255,0.28)';
        box(x + W * 0.6 + g / 2, y + bar + g + bodyH / 2 + g / 2, W * 0.4 - g / 2, bodyH / 2 - g / 2, r);
        takeGoal();
      },
      // True to scale: bright dots are to all the dots as 150 is to 23,000.
      stars() {
        goal.fill(0);
        const random = seeded(150);
        const count = Math.max(1, Math.round((goal.length * 150) / 23000));
        for (let placed = 0; placed < count;) {
          const i = Math.floor(random() * goal.length);
          if (!goal[i]) { goal[i] = 1; placed++; }
        }
      },
      lock() {
        const c = octx;
        c.clearRect(0, 0, cols, lines);
        const H = lines * 0.76;
        const bw = H * 0.86;
        const bh = H * 0.56;
        const cx = cols / 2;
        const by = (lines + H) / 2 - bh;
        const lw = H * 0.13;
        const r = bw * 0.3;
        c.fillStyle = '#ffffff';
        c.strokeStyle = '#ffffff';
        c.lineWidth = lw;
        c.beginPath();
        c.moveTo(cx - r, by + 1);
        c.lineTo(cx - r, by - H * 0.44 + r + lw / 2);
        c.arc(cx, by - H * 0.44 + r + lw / 2, r, Math.PI, 0);
        c.lineTo(cx + r, by + 1);
        c.stroke();
        box(cx - bw / 2, by, bw, bh, Math.max(1, H * 0.06));
        c.save();
        c.globalCompositeOperation = 'destination-out';
        c.beginPath();
        c.arc(cx, by + bh * 0.42, H * 0.075, 0, TAU);
        c.fill();
        c.fillRect(cx - H * 0.03, by + bh * 0.42, H * 0.06, bh * 0.32);
        c.restore();
        takeGoal();
      },
      heart() {
        const c = octx;
        c.clearRect(0, 0, cols, lines);
        const s = Math.min(cols * 0.36, lines * 0.46);
        const cx = cols / 2;
        const cy = lines / 2;
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(cx, cy + s * 0.92);
        c.bezierCurveTo(cx - s * 1.5, cy - s * 0.05, cx - s * 0.78, cy - s * 1.02, cx, cy - s * 0.32);
        c.bezierCurveTo(cx + s * 0.78, cy - s * 1.02, cx + s * 1.5, cy - s * 0.05, cx, cy + s * 0.92);
        c.fill();
        takeGoal();
      },
    };

    const paintDots = () => {
      const { ctx, w, h } = view;
      ctx.clearRect(0, 0, w, h);
      const small = pitch * 0.11;
      const large = pitch * 0.46;
      const levels = Array.from({ length: 6 }, () => new Path2D());
      for (let i = 0; i < cur.length; i++) {
        const v = cur[i];
        const px = x0 + (i % cols) * pitch;
        const py = y0 + Math.floor(i / cols) * pitch;
        const r = small + (large - small) * v;
        const path = levels[Math.round(v * 5)];
        path.moveTo(px + r, py);
        path.arc(px, py, r, 0, TAU);
      }
      levels.forEach((path, n) => {
        ctx.fillStyle = `rgba(${ink},${0.26 + (0.74 * n) / 5})`;
        ctx.fill(path);
      });
    };
    const stepDots = (dt) => {
      sinceChange += dt;
      const k = still ? 1 : 1 - Math.exp(-dt * 13);
      for (let i = 0; i < cur.length; i++) {
        if (!still && sinceChange < wait[i]) { dirty = true; continue; }
        const d = goal[i] - cur[i];
        if (d === 0) continue;
        cur[i] = Math.abs(d) > 0.004 ? cur[i] + d * k : goal[i];
        dirty = true;
      }
      if (dirty) paintDots();
      dirty = false;
    };

    const show = (scene) => {
      if (scene.shape) shapes[scene.shape](); else word(scene.led);
      sinceChange = 0;
      dirty = true;
    };
    const size = () => {
      view = fit(canvas);
      // A tall display (a card stretched by larger text) spaces its dots out, so a frame never paints more than about 9,000.
      pitch = Math.max(view.w < 640 ? 6 : 8, Math.sqrt((view.w * view.h) / 9000));
      cols = Math.max(8, Math.floor(view.w / pitch));
      lines = Math.max(6, Math.floor(view.h / pitch));
      x0 = (view.w - (cols - 1) * pitch) / 2;
      y0 = (view.h - (lines - 1) * pitch) / 2;
      off.width = cols;
      off.height = lines;
      const n = cols * lines;
      cur = new Float32Array(n);
      goal = new Float32Array(n);
      wait = new Float32Array(n);
      const random = seeded(41);
      for (let i = 0; i < n; i++) wait[i] = ((i % cols) / cols) * 0.26 + random() * 0.06;
    };
    return { size, show, step: stepDots, look: shapes.eye, settled: () => sinceChange > 0.5 };
  };

  /* Record: the list behaves like Nungil, the company's gaze-controlled browser. What you look at gets an
     outline; keep looking and it presses. A pressed item fills the dot display and the panel beside the list. */
  const record = () => {
    const root = document.querySelector('.record');
    const wrap = root.querySelector('.rec__wrap');
    const rows = [...root.querySelectorAll('.rec')];
    const ring = root.querySelector('.rec__ring');
    const fill = ring.firstElementChild;
    const mark = root.querySelector('.rec__mark');
    const canvas = root.querySelector('.rec__dots');
    const say = root.querySelector('.rec__say');
    const sayTitle = say.querySelector('.rec__say-title');
    const sayDate = say.querySelector('.rec__say-meta span');
    const segment = root.querySelector('.segment');
    const panel = root.querySelector('.rec__panel');
    const wideQuery = matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
    const still = calm();
    const DWELL = 700;
    const AUTO_STEP = 3000;
    const IDLE = 1800;
    const OMEGA = (2 * Math.PI) / 0.32;
    const dots = dotDisplay(canvas);
    const groups = [...root.querySelectorAll('.rec__group')];
    segment.hidden = false;
    root.querySelector('.record__hint').hidden = false;

    /* Rows */
    let chosen = rows[0];
    let gaze = rows[0];
    let dwell = null;
    let autoLeft = still ? 0 : rows.length;
    let wide = wideQuery.matches;
    let visible = false;
    let near = false;
    let lastMove = -1e9;
    let moveX = -1;
    let moveY = -1;

    const showScene = (row) => dots.show(row.dataset);
    const sizeDots = () => { dots.size(); showScene(chosen); };
    const tell = () => {
      sayTitle.textContent = chosen.querySelector('.rec__title').textContent;
      sayDate.textContent = chosen.querySelector('.rec__date').textContent;
      if (!still && say.animate) {
        say.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    };
    const choose = (row, byUser) => {
      if (row === chosen) return;
      chosen.classList.remove('is-on');
      chosen = row;
      chosen.classList.add('is-on');
      rows.forEach((r) => {
        if (wide) r.querySelector('.rec__row').setAttribute('aria-current', String(r === chosen));
      });
      say.setAttribute('aria-live', byUser ? 'polite' : 'off');
      tell();
      showScene(chosen);
    };
    const shown = () => rows.filter((r) => !r.classList.contains('is-out'));
    const setMode = () => {
      wide = wideQuery.matches;
      root.classList.toggle('is-fold', !wide);
      if (wide) wake();
      rows.forEach((r) => {
        const head = r.querySelector('.rec__row');
        if (wide) {
          head.setAttribute('role', 'group');
          head.tabIndex = 0;
          head.setAttribute('aria-current', String(r === chosen));
        } else {
          head.removeAttribute('role');
          head.removeAttribute('tabindex');
          head.removeAttribute('aria-current');
        }
      });
      dwell = null;
      gaze = chosen;
      ringSpring.fresh = true;
      markSpring.fresh = true;
    };

    /* The outline and the pressed mark move on critically damped springs, always from where they are now. */
    const makeSpring = () => ({ y: 0, h: 0, vy: 0, vh: 0, fresh: true, py: -1, ph: -1 });
    const ringSpring = makeSpring();
    const markSpring = makeSpring();
    const follow = (el, s, row, dt) => {
      const y = row.offsetTop;
      const h = row.offsetHeight;
      if (s.fresh || still || !dt) {
        s.y = y;
        s.h = h;
        s.vy = 0;
        s.vh = 0;
        s.fresh = false;
      } else {
        s.vy += (OMEGA * OMEGA * (y - s.y) - 2 * OMEGA * s.vy) * dt;
        s.y += s.vy * dt;
        s.vh += (OMEGA * OMEGA * (h - s.h) - 2 * OMEGA * s.vh) * dt;
        s.h += s.vh * dt;
      }
      if (Math.abs(s.y - s.py) > 0.05 || Math.abs(s.h - s.ph) > 0.05) {
        el.style.transform = `translate3d(0, ${s.y.toFixed(2)}px, 0)`;
        el.style.height = `${s.h.toFixed(2)}px`;
        s.py = s.y;
        s.ph = s.h;
      }
    };

    let last = 0;
    let frame = 0;
    const tick = (now) => {
      const dt = last ? clamp((now - last) / 1000, 0, 1 / 30) : 0;
      last = now;
      if (wide && !still) {
        const idle = now - lastMove > IDLE;
        const busy = wrap.matches(':hover') || root.contains(document.activeElement);
        // Until someone takes over, the outline walks the list once and shows what it does.
        if (autoLeft > 0 && near && idle && !busy && !dwell) {
          const list = shown();
          gaze = list[(list.indexOf(gaze) + 1) % list.length];
          dwell = { row: gaze, start: now, length: AUTO_STEP, byUser: false };
          autoLeft -= 1;
        }
        if (dwell && !dwell.byUser && !idle) {
          dwell = null;
          gaze = chosen;
        }
      }
      let progress = 0;
      if (dwell) {
        progress = clamp((now - dwell.start) / dwell.length, 0, 1);
        if (progress >= 1) {
          const { row, byUser } = dwell;
          dwell = null;
          progress = 0;
          if (byUser) autoLeft = 0;
          choose(row, byUser);
        }
      }
      if (wide) {
        follow(ring, ringSpring, gaze, dt);
        follow(mark, markSpring, chosen, dt);
        fill.style.transform = `scaleX(${progress.toFixed(3)})`;
        dots.step(dt);
      }
      frame = visible && wide ? requestAnimationFrame(tick) : 0;
      if (!frame) last = 0;
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };

    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.clientX === moveX && e.clientY === moveY) return;
      moveX = e.clientX;
      moveY = e.clientY;
      lastMove = performance.now();
    }, { passive: true });
    wrap.addEventListener('pointermove', (e) => {
      if (!wide || e.pointerType !== 'mouse') return;
      const row = e.target.closest('.rec');
      if (!row || row === gaze) return;
      gaze = row;
      dwell = row === chosen ? null : { row, start: performance.now(), length: DWELL, byUser: true };
    });
    wrap.addEventListener('pointerleave', () => {
      if (!wide) return;
      dwell = null;
      gaze = chosen;
    });
    const fold = (row) => {
      const open = row.classList.toggle('is-open');
      row.querySelector('.rec__more').setAttribute('aria-expanded', String(open));
    };
    rows.forEach((row) => {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'rec__more';
      more.setAttribute('aria-expanded', 'false');
      more.setAttribute('aria-label', `${row.querySelector('.rec__title').textContent} 자세히 보기`);
      row.querySelector('.rec__row').append(more);
    });
    wrap.addEventListener('click', (e) => {
      if (!wide) {
        const row = e.target.closest('.rec');
        if (row && !e.target.closest('a')) fold(row);
        return;
      }
      const row = e.target.closest('.rec');
      if (!row) return;
      gaze = row;
      dwell = null;
      autoLeft = 0;
      choose(row, true);
    });
    wrap.addEventListener('focusin', (e) => {
      if (!wide) return;
      const row = e.target.closest('.rec');
      if (!row) return;
      gaze = row;
      dwell = null;
      autoLeft = 0;
      choose(row, true);
    });
    wrap.addEventListener('keydown', (e) => {
      if (!wide || e.target.closest('a')) return;
      const row = e.target.closest('.rec');
      if (!row) return;
      const list = shown();
      const at = list.indexOf(row);
      let to = null;
      if (e.key === 'ArrowDown') to = list[Math.min(at + 1, list.length - 1)];
      if (e.key === 'ArrowUp') to = list[Math.max(at - 1, 0)];
      if (e.key === 'Enter' || e.key === ' ') to = row;
      if (!to) return;
      e.preventDefault();
      to.querySelector('.rec__row').focus();
    });
    segmented(segment, (button) => {
      const kind = button.dataset.kind;
      rows.forEach((r) => {
        const on = kind === 'all' || r.dataset.kind === kind;
        r.classList.toggle('is-out', !on);
        r.inert = !on;
      });
      groups.forEach((g) => { g.classList.toggle('is-out', kind !== 'all' && g.dataset.kind !== kind); });
      autoLeft = 0;
      dwell = null;
      if (chosen.classList.contains('is-out')) choose(shown()[0], true);
      gaze = chosen;
      // The list just got shorter. From deep in it, bring its top back beside the filter, which stays under the hand.
      const stuck = getComputedStyle(panel);
      if (wide && stuck.position === 'sticky') {
        const over = wrap.getBoundingClientRect().top - parseFloat(stuck.top);
        if (over < 0) jump(scrollY + over);
      }
    });
    wideQuery.addEventListener('change', setMode);

    chosen.classList.add('is-on');
    setMode();
    tell();
    new ResizeObserver(() => { sizeDots(); wake(); }).observe(canvas);
    sizeDots();
    if (document.fonts && document.fonts.load) {
      document.fonts.load(`700 40px ${FAMILY}`, rows.map((r) => r.dataset.led || '').join('')).then(() => { showScene(chosen); wake(); }).catch(() => {});
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          visible = e.isIntersecting;
          near = e.intersectionRatio >= 0.3;
        });
        if (visible) wake();
      }, { threshold: [0, 0.3, 0.6] }).observe(root);
    } else { visible = true; near = true; wake(); }
  };

  /* Projects: each one on the dot display. Nungil's eye looks where the pointer is, or looks around by itself. */
  const projects = () => {
    const still = calm();
    let pointer = null;
    let lastMove = -1e9;
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer = { x: e.clientX, y: e.clientY };
      lastMove = performance.now();
    }, { passive: true });
    document.querySelectorAll('.project__view canvas').forEach((canvas) => {
      const dots = dotDisplay(canvas, canvas.dataset.ink);
      const scene = canvas.dataset;
      const look = { x: 0, y: 0 };
      let last = 0;
      const wake = whileVisible(canvas, (now) => {
        const dt = last ? clamp((now - last) / 1000, 0, 1 / 30) : 0;
        last = now;
        if (scene.shape === 'eye' && !still && dots.settled()) {
          let aimX = Math.sin(now * 0.0011) * 0.7;
          let aimY = Math.sin(now * 0.0017) * 0.35;
          if (pointer && now - lastMove < 3000) {
            const b = canvas.getBoundingClientRect();
            aimX = clamp((pointer.x - (b.left + b.width / 2)) / (b.width / 2), -1, 1);
            aimY = clamp((pointer.y - (b.top + b.height / 2)) / (b.height / 2), -1, 1);
          }
          const k = 1 - Math.exp(-dt * 7);
          const nx = look.x + (aimX - look.x) * k;
          const ny = look.y + (aimY - look.y) * k;
          if (Math.abs(nx - look.x) + Math.abs(ny - look.y) > 0.003) {
            look.x = nx;
            look.y = ny;
            dots.look(nx, ny);
          }
        }
        dots.step(dt);
      });
      const fill = () => { dots.size(); dots.show(scene); wake(); };
      new ResizeObserver(fill).observe(canvas);
      fill();
      if (scene.led && document.fonts && document.fonts.load) document.fonts.load(`700 40px ${FAMILY}`, scene.led).then(fill).catch(() => {});
    });
  };

  /* What: each sheet draws what its line of work does. Candidates narrow to one output; software stands in layers;
     rules sort a stream into counts; one product reflows from desktop to phone. */
  const box = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  };
  const ARTS = {
    net(ctx, w, h, t, ink, hi) {
      const cols = [4, 6, 6, 3, 1];
      const x = (c) => lerp(w * 0.06, w * 0.94, c / (cols.length - 1));
      const y = (c, n) => h / 2 + (n - (cols[c] - 1) / 2) * Math.min((h * 0.84) / 5, 64);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      for (let c = 0; c < cols.length - 1; c++) for (let a = 0; a < cols[c]; a++) for (let b = 0; b < cols[c + 1]; b++) {
        ctx.moveTo(x(c), y(c, a));
        ctx.lineTo(x(c + 1), y(c + 1, b));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
      cols.forEach((n, c) => {
        for (let a = 0; a < n; a++) {
          ctx.beginPath();
          ctx.arc(x(c), y(c, a), c === cols.length - 1 ? 9 : 4, 0, TAU);
          ctx.fill();
        }
      });
      const random = seeded(4);
      ctx.fillStyle = hi;
      for (let p = 0; p < 7; p++) {
        const route = cols.map((n) => Math.floor(random() * n));
        const run = ((t * 0.16 + p / 7) % 1) * (cols.length - 1);
        const c = Math.floor(run);
        const k = smooth(run - c);
        ctx.beginPath();
        ctx.arc(lerp(x(c), x(c + 1), k), lerp(y(c, route[c]), y(c + 1, route[c + 1]), k), 5.5, 0, TAU);
        ctx.fill();
      }
    },
    layers(ctx, w, h, t, ink, hi, ground) {
      const a = Math.min(w * 0.42, h * 0.62);
      const cx = w / 2;
      const gap = a * 0.34 + Math.sin(t * 0.7) * a * 0.025;
      const at = (u, v, z) => [cx + (u - v) * a, h / 2 + (u + v - 1) * a * 0.5 + z];
      const face = (z, u0, v0, u1, v1) => {
        ctx.beginPath();
        [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].forEach(([u, v], i) => {
          const [x, y] = at(u, v, z);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.closePath();
      };
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = ink;
      [gap, 0, -gap].forEach((z, level) => {
        face(z, 0, 0, 1, 1);
        ctx.fillStyle = ground;
        ctx.fill();
        ctx.stroke();
        if (level === 0) {
          ctx.fillStyle = ink;
          for (let u = 1; u < 6; u++) for (let v = 1; v < 6; v++) {
            const [x, y] = at(u / 6, v / 6, z);
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, TAU);
            ctx.fill();
          }
        } else if (level === 1) {
          [0.2, 0.4, 0.6, 0.8].forEach((v, i) => {
            face(z, 0.12, v - 0.05, i % 2 ? 0.62 : 0.88, v + 0.05);
            ctx.stroke();
          });
        } else {
          face(z, 0.08, 0.08, 0.92, 0.2);
          ctx.fillStyle = ink;
          ctx.fill();
          face(z, 0.08, 0.28, 0.32, 0.92);
          ctx.stroke();
          face(z, 0.4, 0.28, 0.92, 0.58);
          ctx.fillStyle = hi;
          ctx.fill();
          face(z, 0.4, 0.66, 0.92, 0.92);
          ctx.stroke();
        }
      });
      ctx.fillStyle = hi;
      for (let p = 0; p < 3; p++) {
        const k = (t * 0.28 + p / 3) % 1;
        const [x, y] = at(0.5, 0.5, lerp(gap, -gap, k));
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, TAU);
        ctx.fill();
      }
    },
    routes(ctx, w, h, t, ink, hi) {
      const ROWS = 5;
      const dx = Math.min(w * 0.13, h * 0.13);
      const dy = h * 0.095;
      const top = h * 0.07;
      const px = (r, k) => w / 2 + (k - r / 2) * dx;
      const py = (r) => top + r * dy;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.34;
      ctx.beginPath();
      for (let r = 0; r < ROWS; r++) for (let k = 0; k <= r; k++) {
        ctx.moveTo(px(r, k), py(r));
        ctx.lineTo(px(r + 1, k), py(r + 1));
        ctx.moveTo(px(r, k), py(r));
        ctx.lineTo(px(r + 1, k + 1), py(r + 1));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
      for (let r = 0; r <= ROWS; r++) for (let k = 0; k <= r; k++) {
        ctx.beginPath();
        ctx.arc(px(r, k), py(r), 3, 0, TAU);
        ctx.fill();
      }
      const random = seeded(12);
      const TOKENS = 16;
      const SPEED = 0.13;
      const bins = new Array(ROWS + 1).fill(0);
      ctx.fillStyle = hi;
      for (let i = 0; i < TOKENS; i++) {
        const bits = Array.from({ length: ROWS }, () => (random() < 0.5 ? 0 : 1));
        const end = bits.reduce((a, b) => a + b, 0);
        const clock = t * SPEED + i / TOKENS;
        bins[end] += Math.floor(clock);
        const run = (clock % 1) * ROWS;
        const r = Math.floor(run);
        const k = bits.slice(0, r).reduce((a, b) => a + b, 0);
        const f = smooth(run - r);
        ctx.beginPath();
        ctx.arc(lerp(px(r, k), px(r + 1, k + bits[r]), f), lerp(py(r), py(r + 1), f), 5, 0, TAU);
        ctx.fill();
      }
      const floor = h * 0.95;
      const room = floor - py(ROWS) - 14;
      const step = Math.max(6, room / 9);
      bins.forEach((n, k) => {
        const stack = (n % 9) + (still0(t) ? [1, 3, 6, 7, 4, 2][k] : 0);
        for (let d = 0; d < Math.min(stack, 9); d++) {
          ctx.beginPath();
          ctx.arc(px(ROWS, k), floor - d * step, Math.min(step * 0.36, 5), 0, TAU);
          ctx.fill();
        }
      });
    },
    devices(ctx, w, h, t, ink, hi) {
      const tall = h * 0.84;
      const SHAPES = [[Math.min(w * 0.9, tall * 1.5), Math.min(tall, w * 0.56), 3], [Math.min(tall * 0.74, w * 0.6), tall, 2], [Math.min(tall * 0.48, w * 0.4), tall, 1]];
      const run = (t * 0.14) % 3;
      const at = Math.floor(run);
      const k = smooth(clamp((run - at - 0.55) / 0.45, 0, 1));
      const a = SHAPES[at];
      const b = SHAPES[(at + 1) % 3];
      const W = lerp(a[0], b[0], k);
      const H = lerp(a[1], b[1], k);
      const X = (w - W) / 2;
      const Y = (h - H) / 2;
      const pad = Math.max(8, W * 0.035);
      const tile = (cols, i) => {
        const g = pad * 0.7;
        const tw = (W - pad * 2 - g * (cols - 1)) / cols;
        const th = Math.max(26, H * 0.19);
        const top = H * 0.46;
        return [X + pad + (i % cols) * (tw + g), Y + top + Math.floor(i / cols) * (th + g), tw, th];
      };
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = ink;
      box(ctx, X, Y, W, H, 14);
      ctx.stroke();
      ctx.save();
      box(ctx, X, Y, W, H, 14);
      ctx.clip();
      ctx.fillStyle = ink;
      box(ctx, X + pad, Y + pad, W - pad * 2, Math.max(8, H * 0.05), 4);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.globalAlpha = 0.9;
      box(ctx, X + pad, Y + pad * 2 + H * 0.05, W - pad * 2, H * 0.46 - pad * 3 - H * 0.05, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) {
        const p = tile(a[2], i);
        const q = tile(b[2], i);
        box(ctx, lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2], q[2], k), lerp(p[3], q[3], k), 6);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
  const still0 = (t) => t === 0;
  const sheets = () => {
    const still = calm();
    document.querySelectorAll('[data-art]').forEach((canvas) => {
      const sheet = canvas.closest('.sheet');
      const style = getComputedStyle(sheet);
      const hi = sheet.classList.contains('sheet--pale') ? '#006cff' : sheet.classList.contains('sheet--ink') ? '#4d9bff' : '#ffffff';
      const ink = sheet.classList.contains('sheet--blue') ? 'rgba(255,255,255,0.72)' : style.color;
      let view = null;
      const draw = (now) => {
        if (!view) return;
        view.ctx.clearRect(0, 0, view.w, view.h);
        ARTS[canvas.dataset.art](view.ctx, view.w, view.h, still ? 0 : now * 0.001, ink, hi, style.backgroundColor);
      };
      const wake = whileVisible(canvas, draw);
      new ResizeObserver(() => { view = fit(canvas); draw(performance.now()); wake(); }).observe(canvas);
      view = fit(canvas);
      draw(performance.now());
    });
    if (!Stage.live || still || document.documentElement.classList.contains('big-type')) return;
    gsap.matchMedia().add('(min-height: 561px)', () => {
      document.querySelectorAll('.sheet + .sheet').forEach((next) => {
        const under = next.previousElementSibling;
        const scrollTrigger = { trigger: next, start: 'top bottom', end: 'top 35%', scrub: 0.4 };
        gsap.to(under, { scale: 0.97, transformOrigin: '50% 0', ease: 'none', scrollTrigger });
        gsap.to(under.querySelector('.sheet__body'), { opacity: 0, ease: 'none', scrollTrigger: { ...scrollTrigger } });
      });
    });
  };

  /* Contact: two sets of lines come in from either side and interlock as the section arrives. */
  const weave = () => {
    const canvas = document.querySelector('.contact__weave');
    const root = canvas.parentElement;
    const still = calm();
    const hand = { x: 0, y: 0, aimX: 0, aimY: 0, k: 0, aim: 0 };
    let view = null;
    let last = 0;

    const paint = (t) => {
      if (!view) return;
      const now = t || last;
      const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0;
      last = now;
      hand.x += (hand.aimX - hand.x) * Math.min(1, dt * 9);
      hand.y += (hand.aimY - hand.y) * Math.min(1, dt * 9);
      hand.k += (hand.aim - hand.k) * Math.min(1, dt * 5);
      const { ctx, w, h } = view;
      const top = root.getBoundingClientRect().top;
      const k = still ? 1 : smooth(span((innerHeight * 0.98 - top) / (innerHeight * 0.74), 0, 1));
      const narrow = w < 640;
      const PAIRS = narrow ? 13 : 18;
      const TRACKS = PAIRS * 2;
      const gap = narrow ? 4.5 : 4.6;
      const spread = Math.max(1, (h * 0.94) / (TRACKS * gap));
      const cy = h / 2;
      const tips = [lerp(w * 0.16, w * 0.68, k), lerp(w * 0.84, w * 0.32, k)];
      const STEPS = narrow ? 50 : 80;
      const time = now * 0.0006;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = narrow ? 1.1 : 1.25;
      [0, 1].forEach((side) => {
        const colour = side ? '#006cff' : '#1d1d1d';
        const start = side ? w + 12 : -12;
        ctx.strokeStyle = colour;
        ctx.fillStyle = colour;
        for (let i = 0; i < PAIRS; i++) {
          // Left lines take the even tracks and right lines the odd ones, so they mesh without touching.
          const track = i * 2 + side - (TRACKS - 1) / 2;
          let x = 0;
          let y = 0;
          ctx.beginPath();
          for (let j = 0; j <= STEPS; j++) {
            x = lerp(start, tips[side], j / STEPS);
            const fan = smooth(span(Math.abs(x - w / 2) / (w / 2), 0.16, 1));
            y = cy + track * gap * lerp(1, spread, fan);
            if (!still) y += Math.sin(x * 0.007 + time + i * 0.35 + side * 2) * 9 * fan;
            if (hand.k > 0.004) {
              const dx = x - hand.x;
              const dy = y - hand.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 30000) {
                const d = Math.sqrt(d2) + 0.001;
                y += (dy / d) * Math.exp(-d2 / 7000) * 30 * hand.k;
              }
            }
            if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, narrow ? 2 : 2.5, 0, TAU);
          ctx.fill();
        }
      });
    };

    new ResizeObserver(() => { view = fit(canvas); paint(); }).observe(canvas);
    view = fit(canvas);
    paint(1);
    whileVisible(canvas, paint);
    if (!still) {
      addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = canvas.getBoundingClientRect();
        const inside = e.clientY >= r.top && e.clientY <= r.bottom;
        if (inside && hand.aim === 0) { hand.x = e.clientX; hand.y = e.clientY - r.top; }
        hand.aimX = e.clientX;
        hand.aimY = e.clientY - r.top;
        hand.aim = inside ? 1 : 0;
      }, { passive: true });
    }
  };

  /* Compose: the visitor picks what to make together, a cursor presses the choice and drafts the subject and the
     headings of the mail, and the button opens that draft in the visitor's own mail app. */
  const compose = () => {
    const root = document.querySelector('.compose');
    if (!root) return;
    const act = document.querySelector('.contact__act');
    const topics = [...root.querySelectorAll('.compose__topics button')];
    const to = root.querySelector('.compose__to');
    const typed = root.querySelector('.compose__subject span');
    const lines = [...root.querySelectorAll('.compose__body p')];
    const send = root.querySelector('.compose__send');
    const cursor = root.querySelector('.compose__cursor');
    const still = calm();
    let run = 0;
    root.hidden = false;
    // The two plain buttons stay for pages without script; here the composer takes their place.
    act.hidden = true;
    act.classList.add('is-in');

    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    // The tip of the cursor goes to a point on an element, measured from the composer's own corner.
    const point = (el, fx, fy) => {
      const r = el.getBoundingClientRect();
      const o = root.getBoundingClientRect();
      return [r.left - o.left + r.width * fx, r.top - o.top + r.height * fy];
    };
    const moveTo = ([x, y], ms = 520) => {
      cursor.style.transitionDuration = `${ms}ms, 200ms`;
      cursor.style.transform = `translate(${x}px, ${y}px)`;
    };
    const mailto = (button) => {
      const body = lines.map((p) => p.textContent).join('\r\n') + '\r\n';
      return `mailto:${button.dataset.to}?subject=${encodeURIComponent(button.dataset.subject)}&body=${encodeURIComponent(body)}`;
    };

    const choose = async (button, byCursor) => {
      const mine = ++run;
      topics.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      to.textContent = button.dataset.to;
      send.href = mailto(button);
      send.setAttribute('aria-label', `${button.dataset.to}로 메일 쓰기, 제목 ${button.dataset.subject}`);
      const subject = button.dataset.subject;
      if (still) {
        typed.textContent = subject;
        lines.forEach((p) => p.classList.add('is-in'));
        return;
      }
      lines.forEach((p) => p.classList.remove('is-in'));
      typed.textContent = '';
      cursor.style.opacity = '1';
      if (byCursor) {
        moveTo(point(button, 0.55, 0.6));
        await wait(560);
        if (mine !== run) return;
        button.classList.add('is-press');
        await wait(160);
        button.classList.remove('is-press');
      }
      moveTo(point(typed.parentElement, 0, 0.9), 420);
      await wait(440);
      for (let i = 1; i <= subject.length; i++) {
        if (mine !== run) return;
        typed.textContent = subject.slice(0, i);
        moveTo(point(typed, 1, 0.9), 60);
        await wait(subject[i - 1] === ' ' ? 90 : 46);
      }
      for (const p of lines) {
        if (mine !== run) return;
        p.classList.add('is-in');
        moveTo(point(p, 0.6, 0.9), 160);
        await wait(170);
      }
      if (mine !== run) return;
      moveTo(point(send, 0.7, 0.62), 600);
    };

    topics.forEach((b) => b.addEventListener('click', () => choose(b, false)));
    const start = () => {
      if (topics.some((b) => b.getAttribute('aria-pressed') === 'true')) return;
      moveTo(point(root, 0.9, 0), 0);
      choose(topics[0], true);
    };
    if (still || !('IntersectionObserver' in window)) { choose(topics[0], false); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      start();
    }, { threshold: 0.5 });
    io.observe(root);
  };

  /* Footer: the cursors gather into the company's name as the page reaches its end, scatter again on the way back up,
     and step aside for the visitor's pointer or finger. */
  const swarm = () => {
    const canvas = document.querySelector('.foot__swarm');
    if (!canvas) return;
    const still = calm();
    const inks = CURSOR_INKS.filter((ink) => ink !== '#1d1d1d');
    const hand = { x: -1e4, y: -1e4, until: 0 };
    let view = null;
    let agents = [];
    let last = 0;
    let scale = 1;

    const shape = () => {
      view = fit(canvas);
      const { w, h } = view;
      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(w));
      off.height = Math.max(1, Math.round(h));
      const g = off.getContext('2d');
      // A narrow screen stacks the name on two lines, so each letter keeps enough cursors to read.
      const rows = w < 640 ? ['EY', 'LABS'] : ['EY LABS'];
      let size = (h * 0.92) / (rows.length === 1 ? 1 : 2.05);
      g.font = `800 ${size}px ${FAMILY}`;
      const width = Math.max(...rows.map((row) => g.measureText(row).width));
      if (width > w * 0.96) size *= (w * 0.96) / width;
      g.font = `800 ${size}px ${FAMILY}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      rows.forEach((row, i) => g.fillText(row, w / 2, h / 2 + (i - (rows.length - 1) / 2) * size * 1.02 + size * 0.04));
      const data = g.getImageData(0, 0, off.width, off.height).data;
      let ink = 0;
      for (let i = 3; i < data.length; i += 16) if (data[i] > 128) ink += 4;
      const want = w < 640 ? 130 : 280;
      const step = Math.max(5, Math.sqrt(ink / want));
      scale = clamp(step / 15, 0.4, 0.85);
      const random = seeded(29);
      const points = [];
      for (let y = step / 2; y < off.height; y += step) {
        for (let x = step / 2; x < off.width; x += step) {
          // A little off the grid, so the letters read as a crowd rather than a printout.
          if (data[(Math.round(y) * off.width + Math.round(x)) * 4 + 3] > 128) points.push([x + (random() - 0.5) * step * 0.35, y + (random() - 0.5) * step * 0.35]);
        }
      }
      agents = points.map(([tx, ty], i) => {
        const away = random() * TAU;
        const reach = Math.max(w, h) * (0.55 + random() * 0.5);
        const old = agents[i];
        return {
          tx, ty,
          sx: w / 2 + Math.cos(away) * reach,
          sy: h / 2 + Math.sin(away) * reach * 0.6 + h * 0.4,
          delay: random() * 0.45,
          phase: random() * TAU,
          ink: inks[i % inks.length],
          x: old ? old.x : NaN, y: old ? old.y : NaN, vx: 0, vy: 0,
        };
      });
    };

    const ARROW = new Path2D('M0 0V17L4.4 13L7.4 19.4L10.4 18.1L7.5 11.9H13Z');
    const paint = (now = performance.now()) => {
      if (!view) return;
      const { ctx, w, h } = view;
      const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0;
      last = now;
      const r = canvas.getBoundingClientRect();
      const k = still ? 1 : smooth(span(innerHeight - r.top, h * 0.15, h * 0.95));
      const near = now < hand.until;
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.2 / scale;
      ctx.strokeStyle = '#111111';
      agents.forEach((a) => {
        const t = smooth(span(k, a.delay, a.delay + 0.55));
        const drift = still ? 0 : (1 - t * 0.85) * 4;
        let gx = lerp(a.sx, a.tx, t) + Math.cos(now * 0.0016 + a.phase) * drift;
        let gy = lerp(a.sy, a.ty, t) + Math.sin(now * 0.0013 + a.phase) * drift;
        if (near) {
          const dx = gx - hand.x;
          const dy = gy - hand.y;
          const d = Math.hypot(dx, dy) || 1;
          const R = Math.max(70, w * 0.07);
          if (d < R) {
            gx += (dx / d) * (R - d) * 0.9;
            gy += (dy / d) * (R - d) * 0.9;
          }
        }
        if (Number.isNaN(a.x) || !dt || still) {
          a.x = gx;
          a.y = gy;
        } else {
          const kk = 140;
          const d = 1 + dt * 2 * 12 + dt * dt * kk;
          a.vx = (a.vx + dt * kk * (gx - a.x)) / d;
          a.vy = (a.vy + dt * kk * (gy - a.y)) / d;
          a.x += a.vx * dt;
          a.y += a.vy * dt;
        }
        if (a.x < -20 || a.y < -30 || a.x > w + 20 || a.y > h + 20) return;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.scale(scale, scale);
        ctx.fillStyle = a.ink;
        ctx.fill(ARROW);
        ctx.stroke(ARROW);
        ctx.restore();
      });
    };

    const ready = document.fonts ? document.fonts.ready : Promise.resolve();
    ready.then(() => {
      shape();
      paint();
      new ResizeObserver(() => { shape(); paint(); }).observe(canvas);
      if (still) return;
      whileVisible(canvas, paint);
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const b = canvas.getBoundingClientRect();
        hand.x = e.clientX - b.left;
        hand.y = e.clientY - b.top;
        hand.until = Infinity;
      }, { passive: true });
      canvas.addEventListener('pointerleave', () => { hand.until = 0; });
      canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        const b = canvas.getBoundingClientRect();
        hand.x = e.clientX - b.left;
        hand.y = e.clientY - b.top;
        hand.until = performance.now() + 900;
      }, { passive: true });
    });
  };

  /* Quiet layer */
  const quiet = () => {
    const still = calm();
    document.documentElement.classList.add('reveal-on');

    const nav = document.querySelector('.nav');
    const stack = document.querySelector('.what__list');
    let lastY = scrollY;
    addEventListener('scroll', () => {
      const y = scrollY;
      if (Math.abs(y - lastY) < 6) return;
      const box = stack.getBoundingClientRect();
      const stacked = getComputedStyle(stack.firstElementChild).position === 'sticky' && box.top <= innerHeight * 0.5 && box.bottom > 0;
      nav.classList.toggle('is-away', y > lastY && y > 40 && !stacked);
      lastY = y;
    }, { passive: true });
    nav.addEventListener('focusin', () => nav.classList.remove('is-away'));
    const menu = nav.querySelector('.nav__menu');
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.open = false; });
    addEventListener('scroll', () => { if (nav.classList.contains('is-away')) menu.open = false; }, { passive: true });
    document.addEventListener('pointerdown', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !menu.open) return;
      menu.open = false;
      menu.querySelector('summary').focus();
    });

    if ('IntersectionObserver' in window) {
      const tones = new IntersectionObserver((entries) => {
        [...entries].sort((a, b) => a.isIntersecting - b.isIntersecting).forEach((e) => {
          if (e.isIntersecting) nav.dataset.tone = e.target.dataset.nav;
          else if (nav.dataset.tone === e.target.dataset.nav) delete nav.dataset.tone;
        });
      }, { rootMargin: '0px 0px -96% 0px' });
      document.querySelectorAll('[data-nav]').forEach((el) => tones.observe(el));
    }

    // The keyword line is pushed sideways by the scroll.
    const pushed = document.querySelector('.pushed__line');
    if (pushed && window.gsap && window.ScrollTrigger && !still) {
      gsap.fromTo(pushed, { xPercent: 4 }, {
        xPercent: -20,
        ease: 'none',
        scrollTrigger: { trigger: pushed.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }

    const reveals = [...document.querySelectorAll('[data-reveal]')];
    if ('IntersectionObserver' in window && !still) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
      reveals.forEach((el) => io.observe(el));
    } else reveals.forEach((el) => el.classList.add('is-in'));

    // Lines that rise: split on the lines the fonts really produced, then give the plain text back.
    const heads = [...document.querySelectorAll('[data-lines]')];
    if (heads.length && 'IntersectionObserver' in window && !still) {
      const restore = (el) => { el.textContent = el.dataset.text; el.classList.remove('is-split', 'is-in'); };
      const split = (el) => {
        const text = el.textContent.trim().replace(/\s+/g, ' ');
        el.dataset.text = text;
        el.setAttribute('aria-label', text);
        el.textContent = '';
        const words = text.split(' ').map((word) => {
          const s = document.createElement('span');
          s.style.display = 'inline-block';
          s.textContent = word;
          el.append(s, ' ');
          return s;
        });
        const rows = [];
        words.forEach((w) => {
          const row = rows[rows.length - 1];
          if (row && Math.abs(row.top - w.offsetTop) < 4) row.words.push(w.textContent);
          else rows.push({ top: w.offsetTop, words: [w.textContent] });
        });
        el.textContent = '';
        rows.forEach((row, i) => {
          const mask = document.createElement('span');
          const inner = document.createElement('span');
          mask.className = 'line';
          inner.style.setProperty('--i', i);
          inner.textContent = row.words.join(' ');
          mask.append(inner);
          el.append(mask, ' ');
        });
        el.classList.add('is-split');
      };
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          e.target.classList.add('is-in');
          const lastLine = e.target.querySelector('.line:last-of-type > span');
          lastLine.addEventListener('transitionend', () => restore(e.target), { once: true });
          setTimeout(() => { if (e.target.classList.contains('is-split')) restore(e.target); }, 1600);
        });
      }, { rootMargin: '0px 0px -10% 0px' });
      const ready = document.fonts ? document.fonts.ready : Promise.resolve();
      ready.then(() => heads.forEach((el) => { split(el); io.observe(el); }));
    }

  };

  /* Scene heights follow the window, so after a resize the same scroll position can be in another section. Remember
     where the reader is, as a share of the section at the top of the screen, and go back there once the page is measured. */
  const keepPlace = () => {
    if (!Stage.live) return;
    const sections = [...document.querySelectorAll('main > section, .foot')];
    let place = null;
    let hold = 0;
    let wasW = innerWidth;
    let wasH = innerHeight;
    const note = () => {
      if (ScrollTrigger.isRefreshing || performance.now() < hold) return;
      const section = sections.find((el) => el.getBoundingClientRect().bottom > 0) || sections[0];
      const box = section.getBoundingClientRect();
      place = { section, share: -box.top / box.height };
    };
    addEventListener('scroll', note, { passive: true });
    addEventListener('resize', () => {
      // A phone's address bar changes only the height, and the page must not move for that.
      if (innerWidth === wasW && (innerHeight === wasH || Stage.touch)) return;
      wasW = innerWidth;
      wasH = innerHeight;
      hold = performance.now() + 1000;
    });
    ScrollTrigger.addEventListener('refresh', () => {
      if (!place || performance.now() >= hold) return;
      const box = place.section.getBoundingClientRect();
      scrollTo({ top: box.top + scrollY + place.share * box.height, behavior: 'instant' });
    });
    note();
  };

  Stage.smooth();
  Stage.init();
  keepPlace();
  quiet();
  tool();
  flow();
  record();
  projects();
  sheets();
  weave();
  compose();
  swarm();
})();
