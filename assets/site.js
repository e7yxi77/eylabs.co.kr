(() => {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = () => matchMedia('(max-width: 767px)').matches;
  const TAU = Math.PI * 2;
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

  /* Opening: one band of parallel lines with a knot tied in it. The scroll pulls the knot tight, the band lies
     straight, and its lines thicken until they close over the page, which is how the white opening hands over
     to the black chapter. */
  Scenes.opening = (root, o = {}) => {
    const canvas = root.querySelector('.strands');
    const stage = root.querySelector('.scene-stage');
    const first = root.querySelector('.opening__first');
    const second = root.querySelector('.opening__second');
    const title = root.querySelector('.opening__title');
    const say = root.querySelector('.opening__say');
    const nav = document.querySelector('.nav');
    const small = isPhone();
    const STEPS = small ? 280 : 400;
    const Cx = new Float32Array(STEPS + 1);
    const Cy = new Float32Array(STEPS + 1);
    const Ox = new Float32Array(STEPS + 1);
    const Oy = new Float32Array(STEPS + 1);
    const Sx = new Float32Array(STEPS + 1);
    const Dx = new Float32Array(STEPS + 1);
    const Dy = new Float32Array(STEPS + 1);
    const Tied = new Float32Array(STEPS + 1);
    const Under = new Float32Array(STEPS + 1);
    const s = { p: 0, load: 0 };
    const hand = { x: 0, y: 0, aimX: 0, aimY: 0, k: 0, aim: 0 };
    let view = null;
    let g = null;
    let lines = [];
    let chosen = 0;
    let bridges = [];
    let now = 0;
    let last = 0;

    // A trefoil in two turns with its lowest lobe opened, so both ends can run out to the edges of the page.
    const tie = (top, tall) => {
      const { w } = view;
      const R = Math.min(tall * 0.3, w * 0.38);
      const band = R * 0.4;
      const cx = small ? w * 0.5 : Math.max(w * 0.33, R * 1.32);
      const cy = top + tall / 2 - R * 0.42;
      const low = cy + R * 1.68;
      const rose = (a) => {
        const r = 0.765 + 0.235 * Math.cos(1.5 * a);
        return [cx + R * r * Math.sin(a), cy + R * r * Math.cos(a)];
      };
      const heading = (a) => {
        const p = rose(a - 0.001);
        const q = rose(a + 0.001);
        const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
        return [(q[0] - p[0]) / l, (q[1] - p[1]) / l];
      };
      const dense = [];
      const curve = (p0, c0, c1, p1) => {
        for (let i = 0; i < 240; i++) {
          const t = i / 240;
          const m = 1 - t;
          dense.push([
            m * m * m * p0[0] + 3 * m * m * t * c0[0] + 3 * m * t * t * c1[0] + t * t * t * p1[0],
            m * m * m * p0[1] + 3 * m * m * t * c0[1] + 3 * m * t * t * c1[1] + t * t * t * p1[1],
          ]);
        }
      };
      const JOIN = 0.34;
      const inAt = rose(JOIN);
      const inDir = heading(JOIN);
      const outAt = rose(TAU * 2 - JOIN);
      const outDir = heading(TAU * 2 - JOIN);
      // The band leaves as far up and as wide as the width left to the right of the knot allows.
      const reach = Math.min(R * 1.5, (w * 1.06 - cx) * 0.62);
      const free = w * 1.06 - (cx + reach);
      const mid = low - Math.min(R * 1.26, free * 0.3);
      const wideBand = clamp(free * 0.5, band, tall * 0.62);
      const left = [-w * 0.06, low];
      const right = [w * 1.06, mid];
      const landIn = [cx - reach, low];
      const landOut = [cx + reach, low];
      curve(left, [lerp(left[0], landIn[0], 0.33), low], [lerp(left[0], landIn[0], 0.67), low], landIn);
      curve(landIn, [lerp(landIn[0], inAt[0], 0.55), low], [inAt[0] - inDir[0] * R * 0.6, inAt[1] - inDir[1] * R * 0.6], inAt);
      const knotFrom = dense.length;
      for (let i = 0; i < 1400; i++) dense.push(rose(JOIN + ((TAU * 2 - JOIN * 2) * i) / 1400));
      const exitFrom = dense.length;
      curve(outAt, [outAt[0] + outDir[0] * R * 0.6, outAt[1] + outDir[1] * R * 0.6], [lerp(landOut[0], outAt[0], 0.55), low], landOut);
      curve(landOut, [lerp(landOut[0], right[0], 0.45), low], [lerp(landOut[0], right[0], 0.55), mid], right);
      dense.push(right);

      const run = new Float64Array(dense.length);
      for (let i = 1; i < dense.length; i++) run[i] = run[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
      const total = run[dense.length - 1];
      const ds = total / STEPS;
      let k = 0;
      let tieFrom = 0;
      let fanFrom = STEPS;
      for (let j = 0; j <= STEPS; j++) {
        const aim = ds * j;
        while (k < dense.length - 2 && run[k + 1] < aim) k++;
        if (k >= knotFrom && !tieFrom) tieFrom = j;
        if (k >= exitFrom && fanFrom === STEPS) fanFrom = j;
        const f = clamp((aim - run[k]) / (run[k + 1] - run[k] || 1), 0, 1);
        Cx[j] = lerp(dense[k][0], dense[k + 1][0], f);
        Cy[j] = lerp(dense[k][1], dense[k + 1][1], f);
        Sx[j] = lerp(-w * 0.06, w * 1.06, j / STEPS);
      }
      for (let j = 0; j <= STEPS; j++) {
        const a = Math.max(0, j - 1);
        const b = Math.min(STEPS, j + 1);
        const dx = Cx[b] - Cx[a];
        const dy = Cy[b] - Cy[a];
        const l = Math.hypot(dx, dy) || 1;
        const fan = j >= fanFrom ? smooth(span(Cx[j], cx + R * 0.9, w * 1.02)) : 0;
        const across = lerp(band, wideBand, fan);
        Ox[j] = (-dy / l) * across;
        Oy[j] = (dx / l) * across;
        Tied[j] = smooth(Math.min(1, j / tieFrom, (STEPS - j) / (STEPS - fanFrom)));
      }

      const crossings = [];
      for (let i = 0; i < STEPS; i++) {
        for (let n = i + 6; n < STEPS; n++) {
          const ax = Cx[i + 1] - Cx[i];
          const ay = Cy[i + 1] - Cy[i];
          const bx = Cx[n + 1] - Cx[n];
          const by = Cy[n + 1] - Cy[n];
          const d = ax * by - ay * bx;
          if (!d) continue;
          const ex = Cx[n] - Cx[i];
          const ey = Cy[n] - Cy[i];
          const u1 = (ex * by - ey * bx) / d;
          const u2 = (ex * ay - ey * ax) / d;
          if (u1 >= 0 && u1 < 1 && u2 >= 0 && u2 < 1) crossings.push([i + u1, n + u2]);
        }
      }
      // Walking the band, it goes over, then under, then over: the weave that makes a knot read as one.
      const gapPx = clamp(band * 0.1, 4, 11);
      const near = (j, other) => {
        const around = Math.ceil((band * 2) / ds);
        let best = Infinity;
        for (let n = Math.max(0, other - around); n <= Math.min(STEPS, other + around); n++) best = Math.min(best, Math.hypot(Cx[j] - Cx[n], Cy[j] - Cy[n]));
        return best;
      };
      const passes = crossings.flatMap(([i, n]) => [{ j: i, other: Math.round(n) }, { j: n, other: Math.round(i) }]).sort((a, b) => a.j - b.j);
      Under.fill(0);
      bridges = [];
      passes.forEach((pass, n) => {
        const touching = (j) => near(j, pass.other) < band + gapPx;
        let a = Math.floor(pass.j);
        let b = Math.ceil(pass.j);
        while (a > 1 && touching(a - 1)) a--;
        while (b < STEPS - 2 && touching(b + 1)) b++;
        if (n % 2 === 0) bridges.push([a, b]);
        else for (let j = a; j <= b; j++) Under[j] = Math.max(Under[j], clamp(Math.min(j - a, b - j) / 3, 0, 1));
      });
      // Each stretch reaches toward a crossing it goes under, so it must be painted before the stretch on top
      // there. Walking order gives that, except that the last one reaches the first, which it must precede.
      bridges.unshift(bridges.pop());

      // A bigger knot gets wider spacing and heavier lines, so it reads the same at every size.
      const count = clamp(Math.round(band / (small ? 4.6 : 4 + R * 0.012)), 6, 24);
      lines = Array.from({ length: count }, (_, i) => i / (count - 1) - 0.5);
      chosen = Math.floor(count * 0.62);
      g = { R, cx, cy, mid, band: wideBand, clear: 0.5 + gapPx / band, sway: R * 0.022, line: small ? 1 : clamp(R * 0.0075, 1.1, 1.6) };
    };

    const measure = () => {
      view = fit(canvas, 9e6);
      root.style.setProperty('--say-h', `${say.offsetHeight}px`);
      if (root.classList.contains('is-rest')) { tie(0, view.h); return; }
      const a = root.querySelector('.opening__room').getBoundingClientRect();
      const c = stage.getBoundingClientRect();
      tie(a.top - c.top, Math.max(120, a.bottom - a.top));
    };

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
      // The knot is pulled tight to a point, and only then does the band lie straight.
      const pull = smooth(span(p, 0, 0.24));
      const open = smooth(span(p, 0.2, 0.42));
      const wide = smooth(span(p, 0.3, 0.6));
      const fat = smooth(span(p, 0.52, 0.84));
      nav.classList.toggle('on-dark', fat > 0.7 && root.getBoundingClientRect().bottom > 0);
      ctx.clearRect(0, 0, w, h);
      const band = lerp(g.band, h * 1.08, wide);
      const mid = lerp(g.mid, h / 2, wide);
      const limit = Math.max(1, Math.floor(STEPS * s.load));
      const tau = now * 0.001;
      const sway = g.sway * (1 - wide);
      const pointX = lerp(g.cx, w / 2, pull);
      const pointY = lerp(g.cy, mid, pull);
      for (let j = 0; j <= STEPS; j++) {
        Dx[j] = sway * Math.sin(Cy[j] * 0.0045 + tau * 0.42);
        Dy[j] = sway * Math.sin(Cx[j] * 0.0038 + tau * 0.36 + 1.7);
      }
      let px = 0;
      let py = 0;
      const at = (r, j) => {
        const held = pull * Tied[j];
        const rx = lerp(Cx[j], pointX, held) + r * Ox[j] * (1 - held);
        const ry = lerp(Cy[j], pointY, held) + r * Oy[j] * (1 - held);
        let x = lerp(rx, Sx[j], open) + Dx[j];
        let y = lerp(ry, mid + r * band, open) + Dy[j];
        if (hand.k > 0.004) {
          const dx = x - hand.x;
          const dy = y - hand.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 50000) {
            const d = Math.sqrt(d2) + 0.001;
            const push = Math.exp(-d2 / 12000) * 44 * hand.k;
            x += (dx / d) * push;
            y += (dy / d) * push;
          }
        }
        px = x;
        py = y;
      };
      const trace = (r, a, b) => {
        ctx.beginPath();
        at(r, a);
        let qx = px;
        let qy = py;
        if (a > 0) {
          at(r, a - 1);
          ctx.moveTo((qx + px) / 2, (qy + py) / 2);
        } else ctx.moveTo(qx, qy);
        for (let j = a + 1; j <= b; j++) {
          at(r, j);
          ctx.quadraticCurveTo(qx, qy, (qx + px) / 2, (qy + py) / 2);
          qx = px;
          qy = py;
        }
        if (b === limit) ctx.lineTo(qx, qy);
      };
      ctx.lineJoin = 'round';
      ctx.lineCap = 'butt';
      // The lines leave the knot black and arrive blue, the same turn the logo makes from E to Y.
      const wash = ctx.createLinearGradient(g.cx + g.R, 0, w * 0.92, 0);
      wash.addColorStop(0, '#111111');
      wash.addColorStop(1, `rgb(${Math.round(lerp(0, 17, fat))},${Math.round(lerp(108, 17, fat))},${Math.round(lerp(255, 17, fat))})`);
      const weight = lerp(g.line, band / (lines.length - 1) + 1.5, fat);
      const ink = () => {
        ctx.strokeStyle = wash;
        ctx.lineWidth = weight;
      };
      const thread = (a, b) => {
        trace(lines[chosen], a, b);
        ctx.strokeStyle = '#006cff';
        ctx.lineWidth = g.line * 1.9;
        ctx.stroke();
      };
      if (fat >= 1) {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, w, h);
      } else {
        ink();
        lines.forEach((r) => {
          trace(r, 0, limit);
          ctx.stroke();
        });
      }
      // One thread stays blue from the knot to the next chapter, with a signal running along it.
      thread(0, limit);

      // Where the band passes over itself, clear what lies under it and draw that stretch again on top.
      if (pull < 1) {
        // Just inside where a trace starts and stops, halfway between samples, so nothing is inked twice or left pale.
        const seam = (r, j, f) => {
          at(r, j);
          const x = px;
          const y = py;
          at(r, j + 1);
          px = lerp(x, px, f);
          py = lerp(y, py, f);
        };
        const edge = g.clear;
        bridges.forEach(([a, b]) => {
          if (a >= limit) return;
          const end = Math.min(b, limit - 1);
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          seam(edge, a - 1, 0.56);
          ctx.moveTo(px, py);
          for (let j = a; j <= end; j++) { at(edge, j); ctx.lineTo(px, py); }
          seam(edge, end, 0.44);
          ctx.lineTo(px, py);
          seam(-edge, end, 0.44);
          ctx.lineTo(px, py);
          for (let j = end; j >= a; j--) { at(-edge, j); ctx.lineTo(px, py); }
          seam(-edge, a - 1, 0.56);
          ctx.lineTo(px, py);
          ctx.closePath();
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ink();
          lines.forEach((r) => {
            trace(r, a, end + 1);
            ctx.stroke();
          });
          thread(a, end + 1);
        });
      }

      if (s.load >= 1 && !calm()) {
        const travel = ((now * 0.00007) % 1) * STEPS;
        const j = Math.min(STEPS - 1, Math.floor(travel));
        const size = 1 - Math.max(Under[j], Under[j + 1]) * (1 - pull);
        if (size > 0.02) {
          at(lines[chosen], j);
          const ax = px;
          const ay = py;
          at(lines[chosen], j + 1);
          const dotX = lerp(ax, px, travel - j);
          const dotY = lerp(ay, py, travel - j);
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(dotX, dotY, lerp(8, 4.5, fat) * size, 0, TAU);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#006cff';
          ctx.beginPath();
          ctx.arc(dotX, dotY, 4.5 * size, 0, TAU);
          ctx.fill();
        }
      }
    };

    const mm = Stage.scene(root, {
      hold: o.hold ?? 1.9,
      scrub: Stage.lenis ? true : 0.3,
      build(tl, { q }) {
        measure();
        tl.to(s, { p: 1, duration: 0.84, ease: 'none', onUpdate: () => paint() }, 0);
        tl.to(first, { xPercent: -112, duration: 0.3, ease: 'power2.in' }, 0.02);
        tl.to(second, { xPercent: 112, duration: 0.3, ease: 'power2.in' }, 0.02);
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
        paint(1);
      },
    });

    if (root.classList.contains('is-live')) {
      ScrollTrigger.addEventListener('refresh', () => { measure(); paint(); });
      gsap.to(s, { load: 1, duration: 2, ease: 'power2.inOut' });
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
      hold: o.hold ?? 5,
      scrub: Stage.lenis ? true : 0.3,
      build(tl, { q }) {
        s.t = 0;
        tl.to(s, { t: 1, duration: 1, onUpdate: paint }, 0);
        tl.to(q('.why__title'), { autoAlpha: 0, y: -28, duration: 0.02, ease: 'power1.in' }, TITLE - 0.025);
        rows.forEach((row, i) => {
          const start = TITLE + i * EACH;
          const parts = [row.querySelector('.why__from'), row.querySelector('.why__to')];
          tl.fromTo(parts[0], { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: EACH * 0.12, ease: 'power2.out' }, start);
          tl.fromTo(parts[1], { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: EACH * 0.12, ease: 'power2.out' }, start + EACH * 0.52);
          if (i < rows.length - 1) tl.to(parts, { autoAlpha: 0, y: -28, duration: EACH * 0.08, ease: 'power1.in' }, start + EACH * 0.92);
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
      hold: o.hold ?? 3.8,
      scrub: Stage.lenis ? true : 0.3,
      build(tl, { q }) {
        const beats = q('.path__title, .path__beats li, .path__end');
        s.t = 0;
        tl.to(s, { t: 1, duration: 1, onUpdate: () => paint() }, 0);
        SWAPS.forEach((at2, i) => {
          tl.to(beats[i], { autoAlpha: 0, y: -28, duration: 0.025, ease: 'power1.in' }, at2);
          tl.fromTo(beats[i + 1], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.04, ease: 'power2.out' }, at2 + 0.03);
        });
        resize();
      },
      rest() {
        s.t = 1;
        resize();
      },
    });
    if (window.ScrollTrigger) ScrollTrigger.addEventListener('refresh', resize);
    else { s.t = 1; resize(); }

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
      { thread: '77,155,255', rest: '255,255,255', dot: '#4d9bff' },
      { thread: '255,255,255', rest: '255,255,255', dot: '#ffffff' },
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

    if (!window.ScrollTrigger || calm()) setStack([1, 1, 1]);
    else {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px)', () => {
        const strip = root.querySelector('.tool__strip');
        // Starts part-drawn, so the strip never rises into view empty.
        ScrollTrigger.create({
          trigger: strip,
          start: 'top 92%',
          end: 'top 12%',
          scrub: true,
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
      mm.add('(max-width: 1023px)', () => {
        canvases.forEach((canvas, k) => {
          const run = (self) => { prog[k] = lerp(0.1, 1, self.progress); draw(k); };
          ScrollTrigger.create({ trigger: canvas, start: 'top 88%', end: 'bottom 55%', scrub: true, onUpdate: run, onRefresh: run });
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
      pitch = view.w < 640 ? 6 : 8;
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
      if (!wide) {
        // No pointer to read, so the row at the middle of the screen is the one being looked at.
        const line = innerHeight * 0.6;
        const row = shown().find((r) => {
          const b = r.getBoundingClientRect();
          return b.top <= line && b.bottom >= line;
        });
        if (row && row !== gaze) {
          gaze = row;
          choose(row, false);
        }
      }
      follow(ring, ringSpring, gaze, dt);
      if (wide) follow(mark, markSpring, chosen, dt);
      fill.style.transform = `scaleX(${progress.toFixed(3)})`;

      dots.step(dt);
      frame = visible ? requestAnimationFrame(tick) : 0;
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
    wrap.addEventListener('click', (e) => {
      if (!wide) return;
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

  /* Quiet layer */
  const quiet = () => {
    const still = calm();

    const nav = document.querySelector('.nav');
    let lastY = scrollY;
    addEventListener('scroll', () => {
      const y = scrollY;
      if (Math.abs(y - lastY) < 6) return;
      nav.classList.toggle('is-away', y > lastY && y > 40);
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
        entries.forEach((e) => {
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
        xPercent: -46,
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

  Stage.smooth();
  Stage.init();
  quiet();
  tool();
  flow();
  record();
  projects();
  sheets();
  weave();
})();
