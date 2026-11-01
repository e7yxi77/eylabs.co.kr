(() => {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const span = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = () => matchMedia('(max-width: 767px)').matches;
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

  /* Opening: the film starts in the gap the sentence leaves, then pushes the sentence off the screen. */
  window.Scenes = window.Scenes || {};
  Scenes.opening = (root, o = {}) => {
    const film = root.querySelector('.film');
    const video = film.querySelector('video');
    const words = root.querySelector('.opening__words');
    const first = root.querySelector('.opening__first');
    const second = root.querySelector('.opening__second');
    const say = root.querySelector('.opening__say');
    const stage = root.querySelector('.scene-stage');
    const nav = document.querySelector('.nav');
    const s = { p: 0, load: 0 };
    let g = null;

    const measure = () => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      const navH = nav.offsetHeight;
      const top = words.offsetTop + first.offsetTop;
      const phone = isPhone();
      if (phone) {
        const a = top + first.offsetHeight + 6;
        const b = words.offsetTop + second.offsetTop - 6;
        g = { phone, W, H, navH, a, b, up: a, down: H - b };
      } else {
        const em = first.offsetHeight;
        g = {
          phone, W, H, navH,
          x: words.offsetLeft + say.offsetLeft,
          t: top - em * 0.05,
          b: top + em,
          down: H - top + em * 0.05,
        };
      }
    };

    const paint = () => {
      if (!g || !root.classList.contains('is-live')) return;
      const { W, H, navH } = g;
      const k = s.load;
      const p = s.p;
      let path;
      if (g.phone) {
        const top = lerp(g.a, 0, p);
        const bottom = lerp(top, lerp(g.b, H, p), k);
        path = `polygon(0 ${top}px, ${W}px ${top}px, ${W}px ${bottom}px, 0 ${bottom}px)`;
        first.style.transform = `translate3d(0, ${-g.up * p}px, 0)`;
        const down = `translate3d(0, ${g.down * p}px, 0)`;
        second.style.transform = down;
        say.style.transform = down;
        words.style.transform = '';
      } else {
        const top = navH * (1 - span(p, 0, 0.22));
        const shift = g.down * p;
        const bottom = lerp(top, g.b + shift, k);
        const notch = Math.min(g.t + shift, bottom);
        path = `polygon(0 ${top}px, ${W}px ${top}px, ${W}px ${bottom}px, ${g.x}px ${bottom}px, ${g.x}px ${notch}px, 0 ${notch}px)`;
        words.style.transform = `translate3d(0, ${shift}px, 0)`;
        [first, second, say].forEach((el) => { el.style.transform = ''; });
      }
      // Once pushed off the stage the sentence must not sit over the page that follows.
      words.style.visibility = p > 0.995 ? 'hidden' : '';
      film.style.clipPath = path;
      video.style.transform = `scale(${(1.05 - 0.05 * p + (1 - k) * 0.14).toFixed(4)})`;
    };

    const mm = Stage.scene(root, {
      hold: o.hold ?? 1.6,
      scrub: Stage.lenis ? true : 0.3,
      build(tl, { q }) {
        measure();
        tl.to(s, { p: 1, duration: 0.62, ease: 'power2.inOut', onUpdate: paint }, 0);
        tl.fromTo(q('.opening__scrim'), { opacity: 0 }, { opacity: 1, duration: 0.18 }, 0.44);
        tl.fromTo(q('.opening__claim'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.16, ease: 'power2.out' }, 0.54);
        paint();
      },
      rest() {
        film.style.clipPath = '';
        video.style.transform = '';
        words.style.visibility = '';
        [words, first, second, say].forEach((el) => { el.style.transform = ''; });
      },
    });

    if (root.classList.contains('is-live')) {
      ScrollTrigger.addEventListener('refresh', () => { measure(); paint(); });
      gsap.to(s, { load: 1, duration: 1.15, ease: 'power3.inOut', onUpdate: paint });
    }
    return mm;
  };

  /* Signal: candidates are compared, one is tuned, then its lines become a band around real-looking data. */
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
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
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
        if (k === 1) return lerp(lerp(0.55, 0.6, toB), 0.34, toC);
        if (k === 2) return lerp(lerp(0.55, 0, toB), 0.34, toC);
        return lerp(lerp(0.55, 0.16, pick), 0, toB);
      };
      // Flat fields give the chart mass: what the chosen model leaves under its curve, then the normal band.
      const under = 0.2 * pick * (1 - toC);
      if (under > 0.002) {
        ctx.beginPath();
        ctx.moveTo(X(0), Y(1));
        for (let i = 0; i <= Math.floor(last); i++) ctx.lineTo(X(i / (N - 1)), Y(at(shapes[0], i)));
        ctx.lineTo(X(Math.floor(last) / (N - 1)), Y(1));
        ctx.closePath();
        ctx.fillStyle = `rgba(111,147,255,${under})`;
        ctx.fill();
      }
      if (toC > 0.002) {
        ctx.beginPath();
        for (let i = 0; i < N; i++) ctx.lineTo(X(i / (N - 1)), Y(at(shapes[1], i)));
        for (let i = N - 1; i >= 0; i--) ctx.lineTo(X(i / (N - 1)), Y(at(shapes[2], i)));
        ctx.closePath();
        ctx.fillStyle = `rgba(255,255,255,${0.09 * toC})`;
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
        ctx.lineWidth = k === 0 ? lerp(2.5, phone ? 3 : 4, pick) : phone ? 1.75 : 2.5;
        const r = Math.round(lerp(255, 111, hot));
        const g = Math.round(lerp(255, 147, hot));
        ctx.strokeStyle = `rgba(${r},${g},255,${alpha})`;
        ctx.stroke();
      }

      // Line ends: names while comparing, before and after while tuning.
      ctx.textBaseline = 'middle';
      ctx.font = font(phone ? 13 : 14);
      const labelIn = span(t, 0.16, 0.24) * (1 - toB);
      if (labelIn > 0) {
        shapes.forEach((shape, k) => {
          const chosen = k === 0;
          const alpha = labelIn * (chosen ? 1 : lerp(0.75, 0.3, pick));
          ctx.fillStyle = chosen ? `rgba(${Math.round(lerp(255, 111, pick))},${Math.round(lerp(255, 147, pick))},255,${alpha})` : `rgba(255,255,255,${alpha})`;
          ctx.fillText(`${phone ? '' : '모델 '}${names[k]}`, X(1) + 10, Y(at(shape, N - 1)));
        });
      }
      const tuneIn = toB * (1 - toC);
      if (tuneIn > 0.01) {
        ctx.fillStyle = `rgba(111,147,255,${tuneIn})`;
        ctx.fillText('튜닝 후', X(1) + 10, Y(at(shapes[0], N - 1)));
        ctx.fillStyle = `rgba(255,255,255,${tuneIn * 0.8})`;
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
          ctx.strokeStyle = `rgba(111,147,255,${0.8 * drop})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, lerp(py, Y(1), drop));
          ctx.stroke();
          ctx.fillStyle = `rgba(111,147,255,${drop})`;
          ctx.textAlign = 'center';
          ctx.fillText('검토', px, h - 10);
          ctx.textAlign = 'left';
        }
        ctx.fillStyle = `rgba(111,147,255,${0.28 * inn})`;
        ctx.beginPath();
        ctx.arc(px, py, (phone ? 12 : 17) * inn, 0, 6.29);
        ctx.fill();
        ctx.fillStyle = '#6f93ff';
        ctx.beginPath();
        ctx.arc(px, py, (phone ? 5 : 7) * inn, 0, 6.29);
        ctx.fill();
      });

      if (reveal < 1 && reveal > 0) {
        ctx.fillStyle = '#fff';
        shapes.forEach((shape, k) => {
          const i = Math.floor(last);
          ctx.globalAlpha = k === 0 ? 1 : 0.55;
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
      hold: o.hold ?? 2.6,
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
        const r = Math.round(lerp(17, 24, bar.heat));
        const g = Math.round(lerp(17, 70, bar.heat));
        const b = Math.round(lerp(17, 216, bar.heat));
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
    const start = (e) => {
      if (e.button) return;
      if (e.currentTarget === box && e.pointerType !== 'mouse') return;
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

    segment.addEventListener('click', (e) => {
      const button = e.target.closest('[data-set]');
      if (!button || button.dataset.set === set) return;
      set = button.dataset.set;
      segment.dataset.on = set;
      segment.querySelectorAll('[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
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

    const clips = [...document.querySelectorAll('video[autoplay]')];
    if (still) clips.forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
    else if ('IntersectionObserver' in window) {
      const watch = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); });
      }, { threshold: 0.05 });
      clips.forEach((v) => watch.observe(v));
    }

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

    // The ink fill keeps the pictures in the line and fills only the words.
    if (CSS.supports('animation-timeline: view()') && !still) {
      document.querySelectorAll('[data-fill]').forEach((el) => {
        [...el.childNodes].forEach((node) => {
          if (node.nodeType !== Node.TEXT_NODE) return;
          const pieces = node.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          pieces.forEach((piece) => {
            if (!piece) return;
            if (/^\s+$/.test(piece)) frag.append(' ');
            else {
              const s = document.createElement('span');
              s.className = 'w';
              s.textContent = piece;
              frag.append(s);
            }
          });
          node.replaceWith(frag);
        });
        el.classList.add('is-filling');
      });
    }
  };

  Stage.smooth();
  Stage.init();
  quiet();
  live();
})();
