// Open / closed badge (open Thu–Mon 09:00–17:00, Bangkok time)
(function openBadge() {
  const el = document.getElementById("openBadge");
  if (!el) return;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const day = now.getDay(); // 0 Sun … 6 Sat
  const mins = now.getHours() * 60 + now.getMinutes();
  const openDay = ![2, 3].includes(day); // closed Tue, Wed
  const isOpen = openDay && mins >= 540 && mins < 1020;
  el.innerHTML = '<span class="dot"></span>' + (isOpen
    ? "ตอนนี้ร้านเปิดอยู่ · มาเลย!"
    : openDay && mins < 540 ? "วันนี้เปิด 9 โมงนะ" : "ตอนนี้ร้านปิด · เปิด พฤหัส–จันทร์");
  el.classList.toggle("is-closed", !isOpen);
})();

document.getElementById("year").textContent = new Date().getFullYear();

// Reveal on scroll
const revealables = document.querySelectorAll(".section-head, .card, .tile, .group, .visit-card, .study-intro, .topics");
revealables.forEach((el) => el.classList.add("reveal"));
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  });
}, { threshold: 0.15 });
revealables.forEach((el) => io.observe(el));

// Draggable fridge magnets (mouse + touch)
const board = document.getElementById("fridgeBoard");
let zTop = 10;
board.querySelectorAll(".magnet").forEach((m) => {
  m.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const maxX = board.clientWidth - m.offsetWidth;
    const maxY = board.clientHeight - m.offsetHeight;
    const offX = e.clientX - m.offsetLeft;
    const offY = e.clientY - m.offsetTop;
    let x = m.offsetLeft, y = m.offsetTop, frame = 0;
    m.setPointerCapture(e.pointerId);
    m.classList.add("dragging");
    m.style.zIndex = ++zTop;
    const paint = () => { frame = 0; m.style.left = x + "px"; m.style.top = y + "px"; };
    const move = (ev) => {
      x = Math.max(0, Math.min(ev.clientX - offX, maxX));
      y = Math.max(0, Math.min(ev.clientY - offY, maxY));
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const end = () => {
      m.classList.remove("dragging");
      m.style.setProperty("--r", (Math.random() * 10 - 5).toFixed(1) + "deg");
      m.removeEventListener("pointermove", move);
      m.removeEventListener("pointerup", end);
      m.removeEventListener("pointercancel", end);
    };
    m.addEventListener("pointermove", move);
    m.addEventListener("pointerup", end);
    m.addEventListener("pointercancel", end);
  });
});
