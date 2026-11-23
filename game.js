// Pottery wheel mini-game: shape spinning clay, pick a glaze, fire it.
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

  let W = 400, Hc = 380, s = 1, cx = 200, baseY = 320, dpr = 1;
  let r = [], H = 0, theta = 0, spinning = true, speed = 0;
  let pointer = null, glaze = "sky", state = "wet"; // wet | firing | fired
  let fireT = 0, color = CLAY.slice(), visible = true, last = 0;

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

  // ----- drawing -----
  const rgb = (c, k = 1, a = 1) => `rgba(${c.map((v) => Math.round(Math.max(0, Math.min(255, v * k)))).join(",")},${a})`;
  const sliceY = (j) => baseY - (j / (N - 1)) * H * s;

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
    if (state !== "fired") { // throwing lines rotate with the wheel
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 7; k++) {
        const a = theta * 1.0 + (k * Math.PI * 2) / 7, front = Math.cos(a);
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hc);
    drawWheel(); drawPot(); drawHand();
    if (state === "firing") drawKiln();
    if (visible) requestAnimationFrame(frame);
  }

  function finishFiring() {
    state = "fired";
    say(`เผาเสร็จแล้ว! ได้${potName()}สี${GLAZES[glaze].name} ชิ้นเดียวในโลก 🎉`);
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
  document.querySelectorAll("[data-glaze]").forEach((b) => {
    b.addEventListener("click", () => {
      glaze = b.dataset.glaze;
      document.querySelectorAll("[data-glaze]").forEach((o) => o.setAttribute("aria-pressed", o === b));
      if (state === "wet") say(`เลือกสีเคลือบ${GLAZES[glaze].name}แล้ว พร้อมเข้าเตาเมื่อไหร่ก็กดเลย`);
    });
  });
  fireBtn.addEventListener("click", () => {
    if (state !== "wet") return;
    state = "firing"; fireT = 0; pointer = null; fireBtn.disabled = true;
    say("เข้าเตาเผาแล้ว รอแป๊บนึงนะ… 🔥");
  });
  saveBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = "joonstudio-my-pottery.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  });

  // only animate while the game is on screen
  new IntersectionObserver(([en]) => {
    const was = visible; visible = en.isIntersecting;
    if (visible && !was) { last = performance.now(); requestAnimationFrame(frame); }
  }).observe(canvas);
  new ResizeObserver(resize).observe(canvas.parentElement);

  resize(); reset();
  requestAnimationFrame(frame);
})();
