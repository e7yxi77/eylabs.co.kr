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
  const fit = (canvas) => {
    const r = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
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
      hold: o.hold ?? 1.9,
      scrub: Stage.lenis ? true : 0.3,
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

  /* Path: one continuous line in 3D. Every shape is walked along its own edges, so the morph never
     needs a stray stroke: a tangle, a plan, a made thing, a rising business, and last the company's mark. */
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
    const ZOOM = [1, 0.8, 0.92, 0.82, 0.94];
    const MORPHS = [[0.12, 0.24], [0.34, 0.46], [0.56, 0.68], [0.78, 0.9]];
    const SWAPS = [0.175, 0.395, 0.615, 0.835];
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
      const cy = narrow ? h * 0.36 : h * 0.45;
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
      if (count) count.textContent = `${SWAPS.filter((at2) => t >= at2 + 0.015).length + 1} / 5`;
    };

    const resize = () => { view = fit(canvas); paint(); };
    const mm = Stage.scene(root, {
      hold: o.hold ?? 3.4,
      scrub: Stage.lenis ? true : 0.3,
      build(tl, { q }) {
        const beats = q('.path__beats li');
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

  /* Lab: a real multilayer network, trained with Adam on the points the visitor places. */
  const makeNet = (sizes, seed) => {
    const random = seeded(seed);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(TAU * random());
    const L = sizes.length - 1;
    const W = [];
    const B = [];
    const mW = [];
    const vW = [];
    const mB = [];
    const vB = [];
    const gW = [];
    const gB = [];
    const act = [new Float64Array(sizes[0])];
    const delta = [];
    for (let l = 0; l < L; l++) {
      const n = sizes[l] * sizes[l + 1];
      const w = new Float64Array(n);
      for (let i = 0; i < n; i++) w[i] = gauss() / Math.sqrt(sizes[l]);
      W.push(w);
      B.push(new Float64Array(sizes[l + 1]));
      mW.push(new Float64Array(n));
      vW.push(new Float64Array(n));
      mB.push(new Float64Array(sizes[l + 1]));
      vB.push(new Float64Array(sizes[l + 1]));
      gW.push(new Float64Array(n));
      gB.push(new Float64Array(sizes[l + 1]));
      act.push(new Float64Array(sizes[l + 1]));
      delta.push(new Float64Array(sizes[l + 1]));
    }
    let t = 0;

    const forward = (x, y) => {
      act[0][0] = x;
      act[0][1] = y;
      for (let l = 0; l < L; l++) {
        const nIn = sizes[l];
        const nOut = sizes[l + 1];
        const w = W[l];
        const b = B[l];
        const a = act[l];
        const o = act[l + 1];
        for (let j = 0; j < nOut; j++) {
          let z = b[j];
          for (let i = 0; i < nIn; i++) z += a[i] * w[i + j * nIn];
          o[j] = l === L - 1 ? 1 / (1 + Math.exp(-clamp(z, -30, 30))) : Math.tanh(z);
        }
      }
      return act[L][0];
    };

    const train = (points, lr) => {
      for (let l = 0; l < L; l++) { gW[l].fill(0); gB[l].fill(0); }
      let loss = 0;
      let right = 0;
      points.forEach((pt) => {
        const p = forward(pt.x, pt.y);
        const safe = clamp(p, 1e-7, 1 - 1e-7);
        loss -= pt.c ? Math.log(safe) : Math.log(1 - safe);
        if ((p > 0.5) === !!pt.c) right++;
        delta[L - 1][0] = p - pt.c;
        for (let l = L - 1; l >= 0; l--) {
          const nIn = sizes[l];
          const nOut = sizes[l + 1];
          const w = W[l];
          const a = act[l];
          const d = delta[l];
          for (let j = 0; j < nOut; j++) {
            const dj = d[j];
            gB[l][j] += dj;
            for (let i = 0; i < nIn; i++) gW[l][i + j * nIn] += dj * a[i];
          }
          if (l > 0) {
            const back = delta[l - 1];
            for (let i = 0; i < nIn; i++) {
              let sum = 0;
              for (let j = 0; j < nOut; j++) sum += d[j] * w[i + j * nIn];
              back[i] = sum * (1 - a[i] * a[i]);
            }
          }
        }
      });
      const n = Math.max(points.length, 1);
      t++;
      const fixM = 1 - 0.9 ** t;
      const fixV = 1 - 0.999 ** t;
      const adam = (p, g, m, v) => {
        for (let i = 0; i < p.length; i++) {
          const gi = g[i] / n;
          m[i] = 0.9 * m[i] + 0.1 * gi;
          v[i] = 0.999 * v[i] + 0.001 * gi * gi;
          p[i] -= (lr * (m[i] / fixM)) / (Math.sqrt(v[i] / fixV) + 1e-8);
        }
      };
      for (let l = 0; l < L; l++) {
        adam(W[l], gW[l], mW[l], vW[l]);
        adam(B[l], gB[l], mB[l], vB[l]);
      }
      return { loss: loss / n, acc: right / n };
    };

    return { forward, train };
  };

  const lab = () => {
    const root = document.querySelector('.lab');
    const grid = root.querySelector('.lab__grid');
    const box = root.querySelector('.lab__field');
    const fieldCanvas = box.querySelector('canvas');
    const empty = root.querySelector('.lab__empty');
    const curveCanvas = root.querySelector('.lab__curve canvas');
    const stat = (name) => root.querySelector(`[data-stat="${name}"]`);
    const out = { loss: stat('loss'), acc: stat('acc'), steps: stat('steps') };
    grid.hidden = false;

    const SIZES = { small: [2, 3, 1], big: [2, 14, 14, 1] };
    const X_SPAN = 1.32;
    const presets = {
      spiral() {
        const r = seeded(5);
        const pts = [];
        [0, 1].forEach((arm) => {
          for (let i = 0; i < 46; i++) {
            const t = i / 45;
            const rad = 0.1 + 0.84 * t;
            const a = t * 3.6 * Math.PI + arm * Math.PI;
            pts.push({ x: rad * Math.cos(a) * 1.25 + (r() - 0.5) * 0.05, y: rad * Math.sin(a) + (r() - 0.5) * 0.05, c: arm });
          }
        });
        return pts;
      },
      ring() {
        const r = seeded(6);
        const pts = [];
        for (let i = 0; i < 34; i++) { const a = r() * TAU; const d = Math.sqrt(r()) * 0.36; pts.push({ x: d * Math.cos(a) * 1.25, y: d * Math.sin(a), c: 1 }); }
        for (let i = 0; i < 56; i++) { const a = r() * TAU; const d = 0.64 + r() * 0.3; pts.push({ x: d * Math.cos(a) * 1.25, y: d * Math.sin(a), c: 0 }); }
        return pts;
      },
      quad() {
        const r = seeded(8);
        const pts = [];
        [[-1, -1, 1], [1, 1, 1], [-1, 1, 0], [1, -1, 0]].forEach(([sx, sy, c]) => {
          for (let i = 0; i < 22; i++) pts.push({ x: sx * 0.68 + (r() - 0.5) * 0.62, y: sy * 0.52 + (r() - 0.5) * 0.54, c });
        });
        return pts;
      },
    };

    const state = { points: presets.spiral(), size: 'big', rate: 0.02, mark: 1, steps: 0, loss: 0.693, acc: 0.5, net: null, seed: 11, running: true, history: [] };
    const MAX_STEPS = 9000;
    let field = null;
    let curve = null;
    let visible = false;
    let frame = 0;
    let tick = 0;
    let ghost = null;
    let grid2 = null;
    const still = calm();

    const reset = () => {
      state.net = makeNet(SIZES[state.size], state.seed++);
      state.steps = 0;
      state.history = [];
      state.running = state.points.length > 0;
      empty.hidden = state.points.length > 0;
    };

    const sizeField = () => {
      field = fit(fieldCanvas);
      curve = fit(curveCanvas);
      const cell = field.w < 500 ? 11 : 14;
      const cols = Math.max(4, Math.round(field.w / cell));
      const rows = Math.max(4, Math.round(field.h / cell));
      grid2 = { cols, rows, cw: field.w / cols, ch: field.h / rows };
    };
    const toPx = (pt) => ({ x: ((pt.x / X_SPAN) * 0.5 + 0.5) * field.w, y: (0.5 - pt.y * 0.5) * field.h });
    const toData = (px, py) => ({ x: ((px / field.w) - 0.5) * 2 * X_SPAN, y: (0.5 - py / field.h) * 2 });

    const paintField = () => {
      const { ctx, w, h } = field;
      ctx.clearRect(0, 0, w, h);
      const { cols, rows, cw, ch } = grid2;
      const reach = Math.min(cw, ch) * 0.4;
      const blue = new Path2D();
      const ink = new Path2D();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = (c + 0.5) * cw;
          const py = (r + 0.5) * ch;
          const d = toData(px, py);
          const p = state.net.forward(d.x / X_SPAN, d.y);
          const size = Math.max(0.5, reach * Math.pow(Math.abs(2 * p - 1), 0.7));
          const path = p > 0.5 ? blue : ink;
          path.moveTo(px + size, py);
          path.arc(px, py, size, 0, TAU);
        }
      }
      ctx.fillStyle = 'rgba(0,108,255,0.3)';
      ctx.fill(blue);
      ctx.fillStyle = 'rgba(29,29,29,0.2)';
      ctx.fill(ink);
      const dot = w < 500 ? 4.5 : 6;
      state.points.forEach((pt) => {
        const q = toPx(pt);
        ctx.beginPath();
        ctx.arc(q.x, q.y, dot, 0, TAU);
        ctx.fillStyle = pt.c ? '#006cff' : '#1d1d1d';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#f4f4f4';
        ctx.stroke();
      });
      if (ghost) {
        ctx.beginPath();
        ctx.arc(ghost.x, ghost.y, dot + 2, 0, TAU);
        ctx.lineWidth = 2;
        ctx.strokeStyle = state.mark ? '#006cff' : '#1d1d1d';
        ctx.stroke();
      }
    };

    const paintCurve = () => {
      const { ctx, w, h } = curve;
      ctx.clearRect(0, 0, w, h);
      const data = state.history;
      if (data.length < 2) return;
      const top = Math.max(0.75, ...data);
      const X = (i) => (i / (data.length - 1)) * w;
      const Y = (v) => h - 8 - (v / top) * (h - 16);
      ctx.beginPath();
      data.forEach((v, i) => { if (i) ctx.lineTo(X(i), Y(v)); else ctx.moveTo(X(i), Y(v)); });
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#006cff';
      ctx.stroke();
    };

    const say = () => {
      out.loss.textContent = state.points.length ? state.loss.toFixed(3) : '0.000';
      out.acc.textContent = `${Math.round((state.points.length ? state.acc : 0) * 100)}%`;
      out.steps.textContent = `${state.steps.toLocaleString('ko-KR')}회`;
    };

    const inputs = () => state.points.map((pt) => ({ x: pt.x / X_SPAN, y: pt.y, c: pt.c }));
    let batch = inputs();

    const run = () => {
      frame = 0;
      if (!field) return;
      if (state.running && visible) {
        // Slow enough to watch the field reorganise; reduced motion paints less often instead.
        const rounds = still ? 40 : 2;
        let last = null;
        for (let i = 0; i < rounds && state.steps < MAX_STEPS; i++) {
          last = state.net.train(batch, state.rate);
          state.steps++;
        }
        if (last) {
          state.loss = last.loss;
          state.acc = last.acc;
          if (state.steps % 4 === 0 || still) {
            state.history.push(last.loss);
            if (state.history.length > 420) state.history = state.history.filter((_, i) => i % 2 === 0);
          }
        }
        if (state.steps >= MAX_STEPS || (last && last.loss < 0.008)) state.running = false;
      }
      tick++;
      if (!still || !state.running || tick % 12 === 0) {
        paintField();
        paintCurve();
        say();
      }
      if (state.running && visible) frame = requestAnimationFrame(run);
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(run); };

    const changed = () => {
      batch = inputs();
      empty.hidden = state.points.length > 0;
      state.running = state.points.length > 0;
      if (!state.running) state.history = [];
      wake();
    };

    root.querySelectorAll('.lab .segment').forEach((el) => {
      segmented(el, (button) => {
        const group = el.dataset.group;
        const value = button.dataset.value;
        if (group === 'data') { state.points = presets[value](); reset(); batch = inputs(); wake(); }
        if (group === 'mark') { state.mark = +value; }
        if (group === 'size') { state.size = value; reset(); wake(); }
        if (group === 'rate') { state.rate = +value; state.running = state.points.length > 0; state.steps = Math.min(state.steps, MAX_STEPS - 3000); wake(); }
      });
    });
    root.querySelector('[data-act="retrain"]').addEventListener('click', () => { reset(); batch = inputs(); wake(); });
    root.querySelector('[data-act="clear"]').addEventListener('click', () => {
      state.points = [];
      reset();
      batch = [];
      state.loss = 0;
      state.acc = 0;
      wake();
    });

    let down = null;
    box.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    box.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 10) return;
      const r = box.getBoundingClientRect();
      state.points.push({ ...toData(e.clientX - r.left, e.clientY - r.top), c: state.mark });
      changed();
    });
    box.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = box.getBoundingClientRect();
      ghost = { x: e.clientX - r.left, y: e.clientY - r.top };
      wake();
    });
    box.addEventListener('pointerleave', () => { ghost = null; wake(); });

    new ResizeObserver(() => { sizeField(); wake(); }).observe(box);
    sizeField();
    reset();
    batch = inputs();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) wake();
      }, { threshold: 0.15 }).observe(box);
    } else { visible = true; wake(); }
    say();
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
    const FAMILY = '"Pretendard Variable", Pretendard, sans-serif';
    segment.hidden = false;
    root.querySelector('.record__hint').hidden = false;

    /* The dot display: each dot's size is how much of a shape covers it, drawn small so edges stay soft. */
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
        const W = Math.min(cols * 0.84, lines * 1.85);
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
        ctx.fillStyle = `rgba(255,255,255,${0.26 + (0.74 * n) / 5})`;
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

    /* Rows */
    let chosen = rows[0];
    let gaze = rows[0];
    let dwell = null;
    let autoLeft = still ? 0 : rows.length;
    let wide = wideQuery.matches;
    let visible = false;
    let near = false;
    let lastMove = -1e9;
    let pointer = null;
    let moveX = -1;
    let moveY = -1;
    const look = { x: 0, y: 0 };

    const showScene = (row) => {
      const shape = row.dataset.shape;
      if (shape) shapes[shape](); else word(row.dataset.led);
      sinceChange = 0;
      dirty = true;
    };
    const sizeDots = () => {
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
      showScene(chosen);
    };
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

      if (chosen.dataset.shape === 'eye' && !still && sinceChange > 0.5) {
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
          shapes.eye(nx, ny);
        }
      }
      stepDots(dt);
      frame = visible ? requestAnimationFrame(tick) : 0;
      if (!frame) last = 0;
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };

    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.clientX === moveX && e.clientY === moveY) return;
      moveX = e.clientX;
      moveY = e.clientY;
      pointer = { x: e.clientX, y: e.clientY };
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
  lab();
  flow();
  record();
  weave();
})();
