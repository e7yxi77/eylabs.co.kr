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
      const a = first.getBoundingClientRect();
      const b = second.getBoundingClientRect();
      const c = stage.getBoundingClientRect();
      root.style.setProperty('--say-h', `${say.offsetHeight}px`);
      const top = a.bottom - c.top;
      const bottom = b.top - c.top;
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
      nav.classList.toggle('on-dark', fat > 0.7);
      ctx.clearRect(0, 0, w, h);
      if (fat >= 1) {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, w, h);
        return;
      }
      const band = lerp(g.band, h * 1.08, wide);
      const gap = band / COUNT;
      const x0 = lerp(g.cx, -w * 0.06, u);
      const x1 = w * 1.06;
      const tau = now * 0.001;
      const limit = Math.max(1, Math.floor(STEPS * s.load));
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      strands.forEach((st, i) => {
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
        const chosen = i === CHOSEN;
        ctx.lineWidth = lerp(chosen ? 2.2 : 1, gap + 1.5, fat);
        const blue = chosen ? 1 - fat : 0;
        ctx.strokeStyle = blue > 0
          ? `rgb(${Math.round(lerp(17, 0, blue))},${Math.round(lerp(17, 108, blue))},${Math.round(lerp(17, 255, blue))})`
          : `rgba(17,17,17,${lerp(0.68, 1, fat)})`;
        ctx.stroke();
      });
      // A signal keeps running down the one blue line.
      if (s.load >= 1 && fat < 0.2 && !calm()) {
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
      [[0.32, 2], [0.62, 0.15], [1, -2]].forEach(([alpha, far], band, all) => {
        const near = band ? all[band - 1][1] : 3;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
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

  /* Signal: candidates are compared, one is tuned, then its lines become a band around the data. */
  Scenes.signal = (root, o = {}) => {
    const canvas = root.querySelector('canvas');
    const count = root.querySelector('.signal__count');
    const N = 240;
    const random = seeded(7);
    const noise = () => {
      const parts = Array.from({ length: 5 }, (_, i) => ({ f: 3 + i * i * 4 + random() * 6, ph: random() * 6.28, a: 1 / (i + 1) }));
      return Array.from({ length: N }, (_, i) => {
        const x = i / (N - 1);
        const wave = parts.reduce((sum, c) => sum + c.a * Math.sin(c.f * x * 6.28 + c.ph), 0) / 2.3;
        return wave * 0.8 + (random() - 0.5) * 0.5;
      });
    };
    const decay = (plateau, speed, amp) => {
      const n = noise();
      return Array.from({ length: N }, (_, i) => {
        const x = i / (N - 1);
        return plateau - (plateau - 0.05) * Math.exp(-speed * x) + amp * n[i] * (0.3 + 0.7 * Math.exp(-2.2 * x));
      });
    };
    const before = decay(0.72, 5, 0.028);
    const candidates = [before, decay(0.6, 3.2, 0.03), decay(0.66, 6.5, 0.03), decay(0.5, 2.6, 0.03), decay(0.44, 4, 0.03), decay(0.55, 7, 0.03)];
    const tuned = decay(0.91, 4.2, 0.018);
    const mid = (x) => 0.6 + 0.065 * Math.sin(6.28 * (1.2 * x + 0.1)) + 0.03 * Math.sin(6.28 * 3.1 * x);
    const spikes = [[0.24, 0.3], [0.57, 0.34], [0.82, 0.27]];
    const seriesNoise = noise();
    const series = Array.from({ length: N }, (_, i) => {
      const x = i / (N - 1);
      const peak = spikes.reduce((sum, [at, h]) => sum + h * Math.exp(-((x - at) ** 2) / 0.00009), 0);
      return mid(x) + 0.04 * seriesNoise[i] - peak;
    });
    const upper = Array.from({ length: N }, (_, i) => mid(i / (N - 1)) - 0.12);
    const lower = Array.from({ length: N }, (_, i) => mid(i / (N - 1)) + 0.12);
    const shapes = [
      { a: candidates[0], b: tuned, c: series },
      { a: candidates[1], b: before, c: upper },
      { a: candidates[2], b: candidates[2], c: lower },
      { a: candidates[3], b: candidates[3], c: candidates[3] },
      { a: candidates[4], b: candidates[4], c: candidates[4] },
      { a: candidates[5], b: candidates[5], c: candidates[5] },
    ];
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    const dots = spikes.map(([at]) => Math.round(at * (N - 1)));
    const s = { t: 0, enter: 0 };
    let view = null;
    const font = (size, weight = 500) => `${weight} ${size}px "Pretendard Variable", Pretendard, sans-serif`;
    const HEAD_START = 0.42;
    const INK = '29,29,29';
    const BLUE = '0,108,255';

    const draw = () => {
      if (!view) return;
      const { ctx, w, h } = view;
      const t = s.t;
      const phone = w < 640;
      const pad = { l: 0, r: phone ? 58 : 92, t: 8, b: 28 };
      const X = (x) => pad.l + x * (w - pad.l - pad.r);
      const Y = (y) => pad.t + y * (h - pad.t - pad.b);
      // The lines start drawing while the chapter rises, so the held stage never opens on an empty chart.
      const reveal = t > 0 ? lerp(HEAD_START, 1, smooth(span(t, 0, 0.2))) : HEAD_START * smooth(s.enter);
      const pick = smooth(span(t, 0.2, 0.3));
      const toB = smooth(span(t, 0.34, 0.46));
      const toC = smooth(span(t, 0.64, 0.78));
      ctx.clearRect(0, 0, w, h);

      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${INK},0.1)`;
      [0, 1, 2, 3, 4].forEach((i) => {
        const y = Y(i / 4);
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      });

      const at = (shape, i) => lerp(lerp(shape.a[i], shape.b[i], toB), shape.c[i], toC);
      const last = reveal * (N - 1);
      const alphaOf = (k) => {
        if (k === 0) return 1;
        if (k === 1) return lerp(lerp(0.5, 0.55, toB), 0.32, toC);
        if (k === 2) return lerp(lerp(0.5, 0, toB), 0.32, toC);
        return lerp(lerp(0.5, 0.14, pick), 0, toB);
      };
      // Flat fields give the chart mass: what the chosen model leaves under its curve, then the normal band.
      const under = 0.14 * pick * (1 - toC);
      if (under > 0.002) {
        ctx.beginPath();
        ctx.moveTo(X(0), Y(1));
        for (let i = 0; i <= Math.floor(last); i++) ctx.lineTo(X(i / (N - 1)), Y(at(shapes[0], i)));
        ctx.lineTo(X(Math.floor(last) / (N - 1)), Y(1));
        ctx.closePath();
        ctx.fillStyle = `rgba(${BLUE},${under})`;
        ctx.fill();
      }
      if (toC > 0.002) {
        ctx.beginPath();
        for (let i = 0; i < N; i++) ctx.lineTo(X(i / (N - 1)), Y(at(shapes[1], i)));
        for (let i = N - 1; i >= 0; i--) ctx.lineTo(X(i / (N - 1)), Y(at(shapes[2], i)));
        ctx.closePath();
        ctx.fillStyle = `rgba(${INK},${0.06 * toC})`;
        ctx.fill();
      }
      for (let k = shapes.length - 1; k >= 0; k--) {
        const alpha = alphaOf(k);
        if (alpha <= 0.002) continue;
        const shape = shapes[k];
        ctx.beginPath();
        for (let i = 0; i <= Math.floor(last); i++) {
          const px = X(i / (N - 1));
          const py = Y(at(shape, i));
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const hot = k === 0 ? pick * (1 - toC) : 0;
        ctx.lineWidth = k === 0 ? lerp(2.25, phone ? 3 : 3.5, pick) : phone ? 1.5 : 2;
        const r = Math.round(lerp(29, 0, hot));
        const g = Math.round(lerp(29, 108, hot));
        const b = Math.round(lerp(29, 255, hot));
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.stroke();
      }

      // Line ends: names while comparing, before and after while tuning.
      ctx.textBaseline = 'middle';
      ctx.font = font(phone ? 13 : 14);
      const labelIn = span(t, 0.16, 0.24) * (1 - toB);
      if (labelIn > 0) {
        shapes.forEach((shape, k) => {
          const chosen = k === 0;
          const alpha = labelIn * (chosen ? 1 : lerp(0.8, 0.35, pick));
          ctx.fillStyle = chosen ? `rgba(${BLUE},${alpha})` : `rgba(${INK},${alpha})`;
          ctx.fillText(`${phone ? '' : '모델 '}${names[k]}`, X(1) + 10, Y(at(shape, N - 1)));
        });
      }
      const tuneIn = toB * (1 - toC);
      if (tuneIn > 0.01) {
        ctx.fillStyle = `rgba(${BLUE},${tuneIn})`;
        ctx.fillText('튜닝 후', X(1) + 10, Y(at(shapes[0], N - 1)));
        ctx.fillStyle = `rgba(${INK},${tuneIn * 0.8})`;
        ctx.fillText('튜닝 전', X(1) + 10, Y(at(shapes[1], N - 1)));
      }

      // Anomalies: each signal lands, then drops a line to the decision it asks for.
      dots.forEach((i, k) => {
        const inn = smooth(span(t, 0.78 + k * 0.025, 0.85 + k * 0.025));
        if (inn <= 0) return;
        const px = X(i / (N - 1));
        const py = Y(at(shapes[0], i));
        const drop = smooth(span(t, 0.88 + k * 0.02, 0.95 + k * 0.02));
        if (drop > 0) {
          ctx.strokeStyle = `rgba(${BLUE},${0.8 * drop})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, lerp(py, Y(1), drop));
          ctx.stroke();
          ctx.fillStyle = `rgba(${BLUE},${drop})`;
          ctx.textAlign = 'center';
          ctx.fillText('검토', px, h - 10);
          ctx.textAlign = 'left';
        }
        ctx.fillStyle = `rgba(${BLUE},${0.2 * inn})`;
        ctx.beginPath();
        ctx.arc(px, py, (phone ? 12 : 17) * inn, 0, 6.29);
        ctx.fill();
        ctx.fillStyle = `rgb(${BLUE})`;
        ctx.beginPath();
        ctx.arc(px, py, (phone ? 5 : 7) * inn, 0, 6.29);
        ctx.fill();
      });

      if (reveal < 1 && reveal > 0) {
        ctx.fillStyle = `rgb(${INK})`;
        shapes.forEach((shape, k) => {
          const i = Math.floor(last);
          ctx.globalAlpha = k === 0 ? 1 : 0.5;
          ctx.beginPath();
          ctx.arc(X(i / (N - 1)), Y(at(shape, i)), 3.5, 0, 6.29);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      if (count) count.textContent = `${t < 0.34 ? 1 : t < 0.65 ? 2 : 3} / 3`;
    };

    const resize = () => { view = fit(canvas); draw(); };
    const mm = Stage.scene(root, {
      hold: o.hold ?? 2.2,
      scrub: Stage.lenis ? true : 0.3,
      build(tl, { q }) {
        const beats = q('.signal__beats li');
        const reads = q('.signal__reads span');
        s.t = 0;
        tl.to(s, { t: 1, duration: 1, onUpdate: draw }, 0);
        ScrollTrigger.create({
          trigger: root,
          start: 'top bottom',
          end: 'top top',
          onUpdate: (self) => { s.enter = self.progress; draw(); },
        });
        [beats, reads].forEach(([one, two, three]) => {
          tl.to(one, { autoAlpha: 0, y: -14, duration: 0.03, ease: 'power1.in' }, 0.32);
          tl.fromTo(two, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.05, ease: 'power2.out' }, 0.355);
          tl.to(two, { autoAlpha: 0, y: -14, duration: 0.03, ease: 'power1.in' }, 0.63);
          tl.fromTo(three, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.05, ease: 'power2.out' }, 0.665);
        });
        resize();
      },
      rest() {
        s.t = 1;
        s.enter = 1;
        resize();
      },
    });
    if (window.ScrollTrigger) ScrollTrigger.addEventListener('refresh', resize);
    else { s.t = 1; s.enter = 1; resize(); }
    if (document.fonts) document.fonts.ready.then(draw);
    return mm;
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
      [{ name: '엄격', at: 0.9 }, { name: '보통', at: 0.78 }, { name: '느슨', at: 0.55 }],
      [{ name: '엄격', at: 0.72 }, { name: '보통', at: 0.42 }, { name: '느슨', at: 0.16 }],
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
        button.setAttribute('aria-label', `${button.querySelector('b').textContent}: 기준 ${name}. 누르면 기준이 바뀝니다.`);
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

  /* The live rule: drag the line, and the sentence, the code and the count all follow. */
  const live = () => {
    const root = document.querySelector('.live');
    const box = root.querySelector('.bars');
    const canvas = box.querySelector('canvas');
    const line = box.querySelector('.bars__line');
    const handle = box.querySelector('.bars__handle');
    const segment = root.querySelector('.segment');
    const values = [...root.querySelectorAll('[data-value]')];
    const result = root.querySelector('[data-result]');
    const countEl = root.querySelector('[data-count]');
    const code = root.querySelector('[data-code]');
    box.hidden = false;
    segment.hidden = false;

    const MIN = 1.2, MAX = 3.6, TOP = 4, N = 96;
    const make = (seed, level, wobble, spikes) => {
      const random = seeded(seed);
      const out = Array.from({ length: N }, (_, i) => {
        const slow = Math.sin(i * 0.17 + seed) * 0.18 + Math.sin(i * 0.05 + seed * 2) * 0.14;
        return clamp(level + slow + (random() - 0.5) * wobble, 0.3, 2.3);
      });
      spikes.forEach(([i, v]) => { out[i] = v; });
      return out;
    };
    const sets = {
      trade: {
        data: make(11, 1.05, 0.9, [[7, 2.7], [19, 1.9], [23, 3.3], [38, 2.2], [41, 2.6], [58, 3.7], [60, 2.5], [73, 2.1], [79, 2.9], [90, 3.1], [93, 1.8]]),
        sentence: (v) => `하루 변동폭이 평소의 ${v}배를 넘는 날에만 매매를 검토합니다.`,
        code: (v) => `if today_range > ${v} * usual_range:\n    review_trade()`,
      },
      ops: {
        data: make(29, 0.95, 0.7, [[12, 2.3], [13, 2.9], [14, 3.4], [15, 2.6], [47, 2.1], [48, 3.0], [49, 2.5], [70, 2.8], [71, 3.6], [72, 3.2], [73, 2.4]]),
        sentence: (v) => `처리 대기 시간이 평소의 ${v}배를 넘으면 담당자를 호출합니다.`,
        code: (v) => `if wait_time > ${v} * usual_wait:\n    call_owner()`,
      },
    };

    const still = calm();
    let set = 'trade';
    let value = 2.4;
    let shown = null;
    let view = null;
    let frame = 0;
    let grown = still;
    let growth = still ? 1 : 0;
    const bars = sets[set].data.map((v) => ({ now: v, speed: 0, heat: v > value ? 1 : 0 }));

    const yOf = (v) => {
      const h = view ? view.h : box.clientHeight;
      return h - (v / TOP) * h;
    };
    const valueOf = (y) => {
      const h = view ? view.h : box.clientHeight;
      return ((h - y) / h) * TOP;
    };
    const rounded = (v) => (Math.round(clamp(v, MIN, MAX) * 10) / 10).toFixed(1);

    const sayRule = () => {
      const v = rounded(value);
      const key = `${set}:${v}`;
      if (key === shown) return;
      shown = key;
      values.forEach((el) => { el.textContent = v; });
      result.textContent = sets[set].sentence(v);
      code.textContent = sets[set].code(v);
      const hits = sets[set].data.filter((d) => d > +v).length;
      countEl.textContent = `예시 96일 가운데 ${hits}일`;
      handle.setAttribute('aria-valuenow', v);
      handle.setAttribute('aria-valuetext', `평소의 ${v}배`);
    };

    const placeLine = () => {
      const y = yOf(value);
      line.style.transform = `translate3d(0, ${y}px, 0)`;
      handle.style.transform = `translate3d(0, ${y}px, 0)`;
    };

    const paint = () => {
      if (!view) return;
      const { ctx, w, h } = view;
      ctx.clearRect(0, 0, w, h);
      const gap = w < 640 ? 1 : 2.5;
      const width = (w - gap * (N - 1)) / N;
      bars.forEach((bar, i) => {
        const delay = i / N;
        const grow = still ? 1 : smooth(span(growth, delay * 0.55, delay * 0.55 + 0.45));
        const height = (bar.now / TOP) * h * grow;
        const r = Math.round(lerp(29, 0, bar.heat));
        const g = Math.round(lerp(29, 108, bar.heat));
        const b = Math.round(lerp(29, 255, bar.heat));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(i * (width + gap), h - height, width, height);
      });
    };

    const OMEGA = (2 * Math.PI) / 0.42;
    const step = (dt) => {
      let busy = false;
      const data = sets[set].data;
      bars.forEach((bar, i) => {
        const target = data[i];
        bar.speed += (OMEGA * OMEGA * (target - bar.now) - 2 * OMEGA * bar.speed) * dt;
        bar.now += bar.speed * dt;
        if (Math.abs(target - bar.now) + Math.abs(bar.speed) > 0.002) busy = true; else { bar.now = target; bar.speed = 0; }
        const heat = target > value ? 1 : 0;
        bar.heat += (heat - bar.heat) * Math.min(1, dt * 18);
        if (Math.abs(heat - bar.heat) > 0.01) busy = true; else bar.heat = heat;
      });
      if (growth < 1) {
        growth = Math.min(1, growth + dt / 1.1);
        busy = true;
      }
      return busy;
    };

    // The spring carries the release velocity and always starts from where the line is now.
    let spring = null;
    let last = 0;
    const tick = (now) => {
      const dt = clamp((now - last) / 1000, 1 / 240, 0.05);
      last = now;
      let busy = step(dt);
      if (spring) {
        const omega = (2 * Math.PI) / 0.38;
        spring.v += (omega * omega * (spring.to - spring.y) - 2 * omega * spring.v) * dt;
        spring.y += spring.v * dt;
        value = valueOf(spring.y);
        if (Math.abs(spring.to - spring.y) + Math.abs(spring.v) < 0.3) {
          value = valueOf(spring.to);
          spring = null;
        } else busy = true;
        placeLine();
        sayRule();
      }
      paint();
      frame = busy ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    const settleAt = (to, v = 0) => {
      const snapped = +rounded(to);
      if (still) {
        value = snapped;
        placeLine();
        sayRule();
        bars.forEach((bar, i) => { bar.now = sets[set].data[i]; bar.speed = 0; bar.heat = bar.now > value ? 1 : 0; });
        paint();
        return;
      }
      spring = { y: yOf(value), v, to: yOf(snapped) };
      wake();
    };

    const rubber = (over, size) => (over * size * 0.55) / (size + 0.55 * Math.abs(over));
    const bounded = (y) => {
      const low = yOf(MAX);
      const high = yOf(MIN);
      const size = view ? view.h : 300;
      if (y < low) return low + rubber(y - low, size);
      if (y > high) return high + rubber(y - high, size);
      return y;
    };

    let held = null;
    const move = (e) => {
      if (!held || e.pointerId !== held.id) return;
      const y = bounded(e.clientY - held.top - held.grab);
      held.trail.push({ y, t: e.timeStamp });
      if (held.trail.length > 5) held.trail.shift();
      value = valueOf(y);
      placeLine();
      sayRule();
      wake();
    };
    const start = (e) => {
      if (e.button) return;
      if (e.currentTarget === box && e.pointerType !== 'mouse' && !e.target.closest('.bars__handle')) return;
      e.preventDefault();
      spring = null;
      const rect = box.getBoundingClientRect();
      const onLine = e.target.closest('.bars__handle') || Math.abs(e.clientY - rect.top - yOf(value)) < 24;
      const grab = onLine ? e.clientY - rect.top - yOf(value) : 0;
      held = { id: e.pointerId, top: rect.top, grab, trail: [] };
      box.setPointerCapture(e.pointerId);
      box.classList.add('is-held');
      move(e);
    };
    const end = (e) => {
      if (!held || e.pointerId !== held.id) return;
      // Only the last moments count: a hand that paused before letting go has no velocity left.
      const trail = held.trail.filter((pt) => e.timeStamp - pt.t < 100);
      const a = trail[0];
      const b = trail[trail.length - 1];
      const velocity = trail.length > 1 && b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0;
      held = null;
      box.classList.remove('is-held');
      const projected = yOf(value) + (velocity / 1000) * (0.992 / (1 - 0.992));
      settleAt(clamp(valueOf(projected), MIN, MAX), velocity);
    };
    box.addEventListener('pointerdown', start);
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);

    handle.addEventListener('keydown', (e) => {
      const steps = { ArrowUp: 0.1, ArrowRight: 0.1, ArrowDown: -0.1, ArrowLeft: -0.1, PageUp: 0.5, PageDown: -0.5 };
      let to = null;
      // Key repeat outruns the spring, so steps add to where the line is heading, not where it is.
      if (e.key in steps) to = (spring ? valueOf(spring.to) : value) + steps[e.key];
      if (e.key === 'Home') to = MIN;
      if (e.key === 'End') to = MAX;
      if (to === null) return;
      e.preventDefault();
      settleAt(clamp(to, MIN, MAX));
    });

    segmented(segment, (button) => {
      set = button.dataset.set;
      sayRule();
      if (still) settleAt(value); else wake();
    });

    const resize = () => {
      view = fit(canvas);
      placeLine();
      paint();
    };
    new ResizeObserver(resize).observe(box);
    resize();
    sayRule();

    // First sight: the bars rise and the line settles, which also shows that it moves.
    if (!still && 'IntersectionObserver' in window) {
      value = 3.3;
      placeLine();
      const seen = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting) || grown) return;
        grown = true;
        seen.disconnect();
        settleAt(2.4);
      }, { threshold: 0.35 });
      seen.observe(box);
    } else {
      growth = 1;
      settleAt(2.4);
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

    // Phone digits roll up to their values once. Each digit stays real text, so the number still reads and copies;
    // only the digits it rolls past come from CSS.
    const rolls = [...document.querySelectorAll('[data-roll]')];
    rolls.forEach((el) => {
      const value = el.textContent.trim();
      const shown = Object.assign(document.createElement('span'), { className: 'roll__digits' });
      let i = 0;
      for (const ch of value) {
        if (!/\d/.test(ch)) { shown.append(ch); continue; }
        const col = Object.assign(document.createElement('span'), { className: 'roll__col' });
        const strip = Object.assign(document.createElement('span'), { className: 'roll__strip', textContent: ch });
        strip.dataset.past = Array.from({ length: +ch }, (_, n) => n).join('\n');
        strip.style.setProperty('--d', ch);
        strip.style.setProperty('--i', i++);
        col.append(strip);
        shown.append(col);
      }
      el.classList.add('roll');
      el.replaceChildren(shown);
    });
    if ('IntersectionObserver' in window && !still) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          // Digits rest at their values; they drop back to zero only for the frame the roll starts.
          e.target.classList.add('is-armed');
          void e.target.offsetWidth;
          e.target.classList.remove('is-armed');
          e.target.classList.add('is-in');
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      rolls.forEach((el) => io.observe(el));
    }
  };

  Stage.smooth();
  Stage.init();
  quiet();
  lab();
  flow();
  live();
})();
