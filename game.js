// Pottery wheel mini-game: shape spinning clay, decorate it, pick a glaze, fire it.
(function () {
  const canvas = document.getElementById("wheelCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const statusEl = $("wheelStatus");
  const spinBtn = $("wheelSpin");
  const fireBtn = $("wheelFire");
  const saveBtn = $("wheelSave");

  const N = 48;            // horizontal slices of the pot, bottom -> top
  const MIN_R = 12, MAX_R = 165, MIN_H = 40, MAX_H = 250;
  const CLAY = [185, 120, 90];
  const GLAZES = {
    cream: { name: "ขาวนวล", rgb: [244, 236, 220] },
    sky: { name: "ฟ้าน้ำทะเล", rgb: [110, 165, 220] },
    pink: { name: "ชมพูพีช", rgb: [240, 160, 170] },
    sage: { name: "เขียวเซจ", rgb: [150, 190, 140] },
    sun: { name: "เหลืองมัสตาร์ด", rgb: [240, 195, 70] },
    cocoa: { name: "น้ำตาลโกโก้", rgb: [120, 80, 60] },
  };
  const PATTERNS = { none: "", dots: "ลายจุด", wave: "ลายคลื่น", stripes: "ลายทาง" };
  // fixed polka-dot positions on the pot surface: angle + height fraction
  const DOTS = Array.from({ length: 30 }, (_, i) => ({ a: i * 2.399, t: 0.12 + ((i * 0.618) % 1) * 0.78 }));

  let W = 400, Hc = 380, s = 1, cx = 200, baseY = 320, dpr = 1;
  let r = [], H = 0, theta = 0, spinning = true, speed = 0;
  let pointer = null, glaze = "sky", state = "wet"; // wet | firing | fired
  let fireT = 0, color = CLAY.slice(), visible = true, last = 0, running = false;
  let deco = { handle: false, cat: false, pattern: "none" };

  function reset() {
    H = 110;
    r = Array.from({ length: N }, (_, i) => {
      const t = i / (N - 1);
      return 72 * (1 - 0.45 * t * t) + 6 * Math.sin(t * 9); // lumpy mound
    });
    state = "wet"; fireT = 0; color = CLAY.slice();
    spinning = true; fireBtn.disabled = false; saveBtn.hidden = true;
    say("กดค้างที่ขอบดินแล้วลากเข้า-ออกเพื่อปั้น 👐");
    syncSpin();
  }

  function say(t) { statusEl.textContent = t; }
  function syncSpin() { spinBtn.textContent = spinning ? "⏸ หยุดแป้น" : "▶ หมุนแป้น"; }

  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    W = Math.min(box.width, 640);
    Hc = Math.round(W * 0.85);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = Hc * dpr;
    canvas.style.width = W + "px"; canvas.style.height = Hc + "px";
    s = W / 420; cx = W / 2; baseY = Hc * 0.8;
  }

  // ----- shaping -----
  function shape(dt) {
    if (!pointer || state !== "wet") return;
    if (!spinning) { say("เปิดแป้นหมุนก่อนนะ ดินไม่หมุนปั้นไม่ได้ 😉"); return; }
    const dx = Math.abs(pointer.x - cx) / s;
    const h = (baseY - pointer.y) / s;
    if (h < -15 || h > H + 25) return;
    const idx = Math.max(0, Math.min(N - 1, (h / H) * (N - 1)));
    const target = Math.max(MIN_R, Math.min(MAX_R, dx));
    for (let j = 0; j < N; j++) {
      const w = Math.exp(-((j - idx) ** 2) / 18);
      r[j] += (target - r[j]) * Math.min(1, w * 7 * dt * speed);
    }
  }

  function smooth() {
    const c = r.slice();
    for (let j = 1; j < N - 1; j++) r[j] = c[j] * 0.9 + (c[j - 1] + c[j + 1]) * 0.05;
  }

  function setHeight(nh) {
    nh = Math.max(MIN_H, Math.min(MAX_H, nh));
    const k = Math.sqrt(H / nh); // keep roughly the same amount of clay
    r = r.map((v) => Math.max(MIN_R, Math.min(MAX_R, v * k)));
    H = nh;
  }

  function potName() {
    const maxR = Math.max(...r), top = r[N - 1];
    const minMid = Math.min(...r.slice(N * 0.3 | 0, N - 3));
    const ratio = H / (2 * maxR);
    if (ratio < 0.35) return "จาน";
    if (ratio < 0.8 && top >= maxR * 0.85) return "ชาม";
    if (minMid < maxR * 0.6 && ratio > 0.9) return "แจกัน";
    if (top < maxR * 0.55) return "โถ";
    return "แก้ว";
  }

  function fullName() {
    let n = potName();
    if (deco.cat) n += "หน้าแมว";
    if (deco.handle) n += "มีหูจับ";
    if (deco.pattern !== "none") n += PATTERNS[deco.pattern];
    return n;
  }

  // ----- geometry helpers -----
  const rgb = (c, k = 1, a = 1) => `rgba(${c.map((v) => Math.round(Math.max(0, Math.min(255, v * k)))).join(",")},${a})`;
  const sliceY = (j) => baseY - (j / (N - 1)) * H * s;
  const rAt = (t) => { // radius at height fraction t (0..1)
    const f = Math.max(0, Math.min(1, t)) * (N - 1), i = Math.min(N - 2, f | 0);
    return r[i] + (r[i + 1] - r[i]) * (f - i);
  };
  const yAt = (t) => baseY - t * H * s;
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const decoColor = () => state === "wet" ? [236, 205, 178] : (lum(color) > 150 ? [70, 50, 42] : [252, 244, 230]);

  // ----- drawing -----
  function drawWheel() {
    const rx = Math.min(200 * s, W * 0.48), ry = rx * 0.22;
    ctx.fillStyle = "#5a4d43"; // pedestal
    ctx.beginPath(); ctx.ellipse(cx, baseY + ry + 26 * s, rx * 0.95, ry * 0.95, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - rx * 0.95, baseY + 8 * s, rx * 1.9, ry + 18 * s);
    ctx.fillStyle = "#e9e4dc"; ctx.strokeStyle = "#241d18"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, baseY + 6 * s, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let k = 0; k < 8; k++) { // spinning marks
      const a = theta + (k * Math.PI) / 4;
      ctx.fillStyle = k % 2 ? "#f08a3c" : "#5b8fd6";
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * rx * 0.82, baseY + 6 * s + Math.sin(a) * ry * 0.82, 6 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(36,29,24,.25)"; // clay shadow
    ctx.beginPath(); ctx.ellipse(cx, baseY + 4 * s, r[0] * s * 1.05, r[0] * s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawPot() {
    const sh = (H * s) / (N - 1) + 1;
    for (let j = 0; j < N - 1; j++) { // cylindrical shading per slice
      const rr = ((r[j] + r[j + 1]) / 2) * s, y = sliceY(j + 1);
      const g = ctx.createLinearGradient(cx - rr, 0, cx + rr, 0);
      g.addColorStop(0, rgb(color, 0.55)); g.addColorStop(0.35, rgb(color, 1.12));
      g.addColorStop(0.6, rgb(color, 0.95)); g.addColorStop(1, rgb(color, 0.5));
      ctx.fillStyle = g; ctx.fillRect(cx - rr, y, rr * 2, sh);
    }
    drawPattern();
    if (state !== "fired") { // throwing lines rotate with the wheel
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 7; k++) {
        const a = theta + (k * Math.PI * 2) / 7, front = Math.cos(a);
        if (front <= 0.05) continue;
        ctx.strokeStyle = rgb(color, 0.6, front * 0.45);
        ctx.beginPath();
        for (let j = 0; j < N; j++) {
          const x = cx + Math.sin(a) * r[j] * s, y = sliceY(j);
          j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    } else { // glossy highlight
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 5 * s; ctx.lineCap = "round";
      ctx.beginPath();
      for (let j = 3; j < N - 3; j++) {
        const x = cx - r[j] * s * 0.45, y = sliceY(j);
        j > 3 ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // outline
    ctx.strokeStyle = "#241d18"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    ctx.beginPath();
    for (let j = 0; j < N; j++) ctx.lineTo(cx - r[j] * s, sliceY(j));
    ctx.moveTo(cx + r[0] * s, sliceY(0));
    for (let j = 0; j < N; j++) ctx.lineTo(cx + r[j] * s, sliceY(j));
    ctx.stroke();
    // rim + opening
    const tr = r[N - 1] * s, ty = sliceY(N - 1);
    ctx.fillStyle = rgb(color, 1.15);
    ctx.beginPath(); ctx.ellipse(cx, ty, tr, tr * 0.24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (tr > 16 * s) {
      const ir = tr - 9 * s;
      ctx.fillStyle = rgb(color, 0.35);
      ctx.beginPath(); ctx.ellipse(cx, ty, ir, ir * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPattern() {
    const pc = decoColor();
    if (deco.pattern === "dots") {
      for (const d of DOTS) {
        const a = d.a + theta, c = Math.cos(a);
        if (c < 0.12) continue;
        const rr = rAt(d.t);
        ctx.fillStyle = rgb(pc, 1, 0.5 + 0.5 * c);
        ctx.beginPath();
        ctx.ellipse(cx + Math.sin(a) * rr * s, yAt(d.t), 5 * s * c, 5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (deco.pattern === "stripes") {
      ctx.lineWidth = 6 * s; ctx.strokeStyle = rgb(pc, 1, 0.85);
      for (const t of [0.22, 0.48, 0.74]) {
        const rr = rAt(t) * s;
        ctx.beginPath(); ctx.ellipse(cx, yAt(t), rr, rr * 0.12, 0, 0.08, Math.PI - 0.08); ctx.stroke();
      }
    } else if (deco.pattern === "wave") {
      ctx.lineWidth = 4 * s; ctx.strokeStyle = rgb(pc, 1, 0.9); ctx.lineCap = "round";
      for (const t0 of [0.35, 0.65]) {
        ctx.beginPath();
        let started = false;
        for (let a = -1.45; a <= 1.45; a += 0.05) {
          const t = t0 + 0.05 * Math.sin(5 * (a - theta));
          const x = cx + Math.sin(a) * rAt(t) * s, y = yAt(t);
          started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true;
        }
        ctx.stroke();
      }
    }
  }

  // decorations that orbit with the wheel; front=true draws the ones facing us
  function drawHandle(front) {
    if (!deco.handle) return;
    const a = theta + Math.PI / 2, c = Math.cos(a), sn = Math.sin(a);
    if ((c >= 0) !== front) return;
    const t1 = 0.68, t2 = 0.3, L = 34;
    const x1 = cx + sn * rAt(t1) * s, y1 = yAt(t1);
    const x2 = cx + sn * rAt(t2) * s, y2 = yAt(t2);
    const ox = sn * L * s, bulge = c * 10 * s;
    const path = () => {
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + ox + bulge, y1 - 6 * s, x2 + ox + bulge, y2 + 6 * s, x2, y2);
    };
    ctx.lineCap = "round";
    ctx.strokeStyle = "#241d18"; ctx.lineWidth = 13 * s; path(); ctx.stroke();
    ctx.strokeStyle = rgb(color, front ? 1 : 0.7); ctx.lineWidth = 8 * s; path(); ctx.stroke();
  }

  function drawCat(front) {
    if (!deco.cat) return;
    const tr = r[N - 1], ty = sliceY(N - 1);
    for (const off of [-0.55, 0.55]) { // ears on the rim
      const a = theta + off, c = Math.cos(a);
      if ((c >= 0) !== front) continue;
      const x = cx + Math.sin(a) * tr * s, y = ty + c * tr * s * 0.2;
      const w = (5 + 11 * Math.abs(c)) * s, h = 24 * s;
      ctx.fillStyle = rgb(color, front ? 1.05 : 0.7); ctx.strokeStyle = "#241d18"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - w, y + 2 * s); ctx.lineTo(x, y - h); ctx.lineTo(x + w, y + 2 * s); ctx.closePath();
      ctx.fill(); ctx.stroke();
      if (front && c > 0.3) {
        ctx.fillStyle = "rgba(243,166,184,.9)";
        ctx.beginPath(); ctx.moveTo(x - w * 0.5, y); ctx.lineTo(x, y - h * 0.6); ctx.lineTo(x + w * 0.5, y); ctx.closePath(); ctx.fill();
      }
    }
    if (!front) return;
    const c = Math.cos(theta); // face
    if (c < 0.25) return;
    const t = 0.62, rr = rAt(t);
    const fx = (da) => cx + Math.sin(theta + da) * rr * s;
    ctx.fillStyle = "#241d18";
    for (const da of [-0.32, 0.32]) {
      ctx.beginPath(); ctx.ellipse(fx(da), yAt(t), 4 * s * c, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#f3a6b8";
    ctx.beginPath(); ctx.ellipse(fx(0), yAt(t - 0.07), 5 * s * c, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#241d18"; ctx.lineWidth = 2;
    for (const side of [-1, 1]) { // whiskers
      ctx.beginPath(); ctx.moveTo(fx(side * 0.2), yAt(t - 0.1)); ctx.lineTo(fx(side * 0.5), yAt(t - 0.08)); ctx.stroke();
    }
  }

  function drawHand() {
    if (!pointer || state !== "wet") return;
    ctx.fillStyle = "rgba(247,205,75,.35)"; ctx.strokeStyle = "#241d18"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 16 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  function drawKiln() {
    const t = Math.min(1, fireT / 2.4);
    const glow = Math.sin(t * Math.PI);
    const g = ctx.createRadialGradient(cx, baseY - H * s * 0.5, 10, cx, baseY - H * s * 0.5, W * 0.7);
    g.addColorStop(0, `rgba(255,170,60,${0.55 * glow})`); g.addColorStop(1, `rgba(200,60,20,${0.35 * glow})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hc);
    ctx.fillStyle = `rgba(36,29,24,${glow})`;
    ctx.font = `700 ${Math.round(22 * s)}px Mali, sans-serif`; ctx.textAlign = "center";
    ctx.fillText(`🔥 ${Math.round(25 + t * 1205)}°C`, cx, 40 * s);
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hc);
    drawWheel();
    drawHandle(false); drawCat(false);
    drawPot();
    drawHandle(true); drawCat(true);
    drawHand();
    if (state === "firing") drawKiln();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    const targetSpeed = spinning ? (state === "fired" ? 0.35 : 1) : 0;
    speed += (targetSpeed - speed) * Math.min(1, dt * 3);
    theta += dt * speed * 7;
    if (state === "wet") { shape(dt); if (speed > 0.2) smooth(); }
    if (state === "firing") {
      fireT += dt;
      const t = Math.min(1, fireT / 2.4), to = GLAZES[glaze].rgb;
      color = CLAY.map((v, i) => v + (to[i] - v) * t);
      if (fireT > 2.6) finishFiring();
    }
    render();
    // keep going while on screen, and always finish a firing even if scrolled away
    if (visible || state === "firing") requestAnimationFrame(frame); else running = false;
  }

  function start() {
    if (running) return;
    running = true; last = performance.now(); requestAnimationFrame(frame);
  }

  function finishFiring() {
    state = "fired";
    say(`เผาเสร็จแล้ว! ได้${fullName()} สี${GLAZES[glaze].name} ชิ้นเดียวในโลก 🎉`);
    saveBtn.hidden = false;
  }

  // ----- input -----
  const pos = (e) => { const b = canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  canvas.addEventListener("pointerdown", (e) => {
    if (state !== "wet") return;
    pointer = pos(e); canvas.setPointerCapture(e.pointerId);
    if (spinning) say("ปั้นอยู่… ลากเข้าให้คอด ลากออกให้บาน");
  });
  canvas.addEventListener("pointermove", (e) => { if (pointer) pointer = pos(e); });
  const up = () => { pointer = null; };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);

  spinBtn.addEventListener("click", () => { spinning = !spinning; syncSpin(); });
  $("wheelUp").addEventListener("click", () => state === "wet" && setHeight(H + 20));
  $("wheelDown").addEventListener("click", () => state === "wet" && setHeight(H - 20));
  $("wheelReset").addEventListener("click", reset);

  const pressGroup = (sel, btn) => document.querySelectorAll(sel).forEach((o) => o.setAttribute("aria-pressed", o === btn));
  document.querySelectorAll("[data-glaze]").forEach((b) => b.addEventListener("click", () => {
    glaze = b.dataset.glaze; pressGroup("[data-glaze]", b);
    if (state === "wet") say(`เลือกสีเคลือบ${GLAZES[glaze].name}แล้ว พร้อมเข้าเตาเมื่อไหร่ก็กดเลย`);
  }));
  document.querySelectorAll("[data-pattern]").forEach((b) => b.addEventListener("click", () => {
    if (state !== "wet") return say("เผาแล้วแก้ลายไม่ได้นะ กดเริ่มใหม่ได้เลย");
    deco.pattern = b.dataset.pattern; pressGroup("[data-pattern]", b);
  }));
  document.querySelectorAll("[data-deco]").forEach((b) => b.addEventListener("click", () => {
    if (state !== "wet") return say("เผาแล้วติดเพิ่มไม่ได้นะ กดเริ่มใหม่ได้เลย");
    const k = b.dataset.deco; deco[k] = !deco[k]; b.setAttribute("aria-pressed", deco[k]);
    if (deco[k]) say(k === "cat" ? "เมี้ยว~ ติดหูแมวกับหน้าแมวแล้ว 🐱" : "ติดหูจับแล้ว ดูมันหมุนรอบแป้นสิ ☕");
  }));

  fireBtn.addEventListener("click", () => {
    if (state !== "wet") return;
    state = "firing"; fireT = 0; pointer = null; fireBtn.disabled = true;
    start();
    say("เข้าเตาเผาแล้ว รอแป๊บนึงนะ… 🔥");
  });
  saveBtn.addEventListener("click", () => {
    const out = document.createElement("canvas");
    out.width = canvas.width; out.height = canvas.height;
    const o = out.getContext("2d");
    o.fillStyle = "#fbf4e6"; o.fillRect(0, 0, out.width, out.height);
    o.drawImage(canvas, 0, 0);
    o.fillStyle = "#241d18"; o.font = `700 ${Math.round(18 * s * dpr)}px Mali, sans-serif`; o.textAlign = "center";
    o.fillText(`${fullName()} · Joon Studio`, out.width / 2, 34 * s * dpr);
    const a = document.createElement("a");
    a.download = "joonstudio-my-pottery.png";
    a.href = out.toDataURL("image/png");
    a.click();
  });

  // only animate while the game is on screen
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) start();
  }).observe(canvas);
  new ResizeObserver(resize).observe(canvas.parentElement);

  resize(); reset();
  start();
})();
