import { $, contact } from "./dom.js";
import { session } from "./session.js";
import { toHero, toCase, advance } from "./tour.js";

export function bindNavigation() {
  let wheelReady = 0;
  $("#studio").onclick = toHero;
  $(".logo").onclick = toHero;
  $("#work").onclick = toCase;
  $(".hint").onclick = toCase;
  $(".next").onclick = () => advance(1);
  $(".prev").onclick = () => advance(-1);
  $(".screen-hit").onclick = () => advance(1);
  $("#contact").onclick = () => contact.showModal();
  $(".close").onclick = () => contact.close();
  contact.addEventListener("click", (event) => {
    if (event.target === contact) {
      const r = contact.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        contact.close();
    }
  });
  window.addEventListener(
    "wheel",
    (event) => {
      if (contact.open || event.ctrlKey) return;
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (
        Math.abs(delta) < 18 ||
        performance.now() < wheelReady ||
        session.busy
      )
        return;
      wheelReady = performance.now() + 900;
      advance(Math.sign(delta));
    },
    { passive: false },
  );
  let start = null,
    suppressClickUntil = 0;
  window.addEventListener(
    "touchstart",
    (event) => {
      start =
        !contact.open && event.touches.length === 1
          ? [event.touches[0].clientX, event.touches[0].clientY]
          : null;
    },
    { passive: true },
  );
  window.addEventListener("touchcancel", () => {
    start = null;
  });
  window.addEventListener(
    "touchend",
    (event) => {
      if (!start || contact.open) return;
      const touch = event.changedTouches[0],
        dx = touch.clientX - start[0],
        dy = touch.clientY - start[1];
      start = null;
      const d =
        Math.abs(dy) >= Math.abs(dx) ? dy : session.mode === "case" ? dx : 0;
      if (Math.abs(d) >= 40) {
        suppressClickUntil = performance.now() + 400;
        advance(d < 0 ? 1 : -1);
      }
    },
    { passive: true },
  );
  document.addEventListener(
    "click",
    (e) => {
      if (performance.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true },
  );
  window.addEventListener("keydown", (event) => {
    if (contact.open || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "Space" && event.target.closest("button,a")) return;
    const down = ["ArrowDown", "PageDown", "Space"],
      up = ["ArrowUp", "PageUp"];
    if (session.mode === "case") {
      down.push("ArrowRight");
      up.push("ArrowLeft");
    }
    if (down.includes(event.code) || up.includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) advance(down.includes(event.code) ? 1 : -1);
    }
    if (event.key === "Escape" && session.mode === "case") toHero();
  });
}
