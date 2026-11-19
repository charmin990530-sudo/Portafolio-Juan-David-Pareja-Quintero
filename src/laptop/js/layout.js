import { $, root, frame, stage, phone } from "./dom.js";
import { duration } from "./motion.js";

let target = "hero";
function place(next) {
  target = next;
  const w = innerWidth,
    h = innerHeight,
    mobile = phone.matches;
  const u = Math.min(w / 1440, h / 900),
    cover = Math.max(w / 1440, h / 810);
  root.style.setProperty("--n", (mobile ? w / 430 : u) + "px");
  root.style.setProperty("--mbs", ($(".m-badge").offsetWidth || 0) / 582);
  const ticketHeight = $(".ticket").offsetHeight,
    descHeight = $(".desc").offsetHeight;
  root.style.setProperty("--th", ticketHeight + "px");
  let x, y, s;
  if (!mobile) {
    if (next === "hero") {
      s = cover;
      y = 0;
    } else {
      const top = 66 * u,
        fit = (h - top - 28 * u) / 683;
      s = Math.min(cover, fit, (w - 490 * u) / 940);
      y = Math.max(top - 79 * s, (h - 840 * s) / 2);
    }
    x = (w - 1440 * s) / 2;
    if (next === "hero") {
      const vl = Math.max(0, -x / s),
        vr = Math.min(1440, (w - x) / s),
        pad = 18 / s;
      const wm = $(".frame .wm"),
        badge = $(".frame .badge");
      wm.style.left = vl + 0.6 * pad + "px";
      wm.style.width = vr - vl - 1.2 * pad + "px";
      badge.style.left = Math.min(986, vr - pad - 417) + "px";
      badge.style.top =
        Math.min(-165, Math.min(810, (h - y) / s) - 56 / s - 935) + "px";
      $(".frame .script").style.left = vl + pad + 52 + "px";
    }
  } else if (next === "hero") {
    s = Math.min(w / 650, (0.67 * h) / 810);
    x = w / 2 - 748 * s;
    y = h - 900 * s;
  } else {
    const compact = h <= 570 && w >= h,
      navH = 0.022 * h + (compact ? 32 : 42) + 18;
    const uiEnd = compact
      ? 62 + Math.max(ticketHeight, descHeight) + 8
      : 62 + ticketHeight + 18 + Math.max(60, descHeight) + 14;
    s = Math.max(0.07, Math.min((w - 16) / 1140, (h - navH - uiEnd) / 683));
    x = w / 2 - 720 * s;
    y = uiEnd + (h - navH - uiEnd - 683 * s) / 2 - 79 * s;
  }
  frame.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
  [stage, frame].forEach((el) =>
    el.classList.toggle("m-case", next === "case"),
  );
  return { x, y, s };
}
function gliding(ms) {
  root.style.setProperty("--glide", duration(ms) / 1000 + "s");
  frame.classList.add("glide");
}
let resizeId = 0;
function resize() {
  cancelAnimationFrame(resizeId);
  resizeId = requestAnimationFrame(() => {
    frame.classList.remove("glide");
    place(target);
  });
}

export { target, place, gliding, resize };
