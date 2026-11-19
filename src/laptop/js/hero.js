import { $, $$, root, motion } from "./dom.js";
import { animate, tween, easeOut } from "./motion.js";
import { session } from "./session.js";
import { target } from "./layout.js";

$(".m-badge").append($(".frame .badge").cloneNode(true));
const badges = $$(".badge"),
  heroElements = $$(".wm,.script,.badge");
$$(".lanyard").forEach((img) => {
  const showLanyard = () => img.parentElement.classList.add("has-lanyard");
  if (img.complete && img.naturalWidth) showLanyard();
  else img.addEventListener("load", showLanyard, { once: true });
});
function stopHeroAnimations() {
  heroElements.forEach((el) =>
    el.getAnimations().forEach((anim) => anim.cancel()),
  );
}
function sway(badge) {
  if (motion.matches || target !== "hero") return;
  badge.animate(
    [{ transform: "rotate(-1.1deg)" }, { transform: "rotate(1.1deg)" }],
    {
      duration: 3200,
      iterations: Infinity,
      direction: "alternate",
      easing: "ease-in-out",
    },
  );
}
badges.forEach((badge) =>
  badge.querySelector(".hit").addEventListener("pointerenter", () => {
    if (session.mode === "hero" && !session.busy && !motion.matches)
      badge.animate(
        [
          { transform: "rotate(0)" },
          { transform: "rotate(-6deg)" },
          { transform: "rotate(4deg)" },
          { transform: "rotate(-2deg)" },
          { transform: "rotate(0)" },
        ],
        { duration: 1400, easing: "ease-out", composite: "add" },
      );
  }),
);
function heroIn(first) {
  stopHeroAnimations();
  heroElements.forEach((el) => {
    el.style.opacity = "1";
    if (motion.matches) return;
    if (el.matches(".badge")) {
      const drop = animate(
        el,
        [
          { opacity: 0, transform: "translateY(-110%) rotate(8deg)" },
          {
            opacity: 1,
            transform: "translateY(0) rotate(-3deg)",
            offset: 0.62,
          },
          { transform: "rotate(1.6deg)", offset: 0.82 },
          { opacity: 1, transform: "rotate(0)" },
        ],
        first ? 1500 : 1100,
        { delay: first ? 700 : 0 },
      );
      drop.onfinish = () => {
        drop.cancel();
        sway(el);
      };
    } else if (el.matches(".wm")) {
      tween(
        el,
        [
          {
            opacity: 0,
            transform: "translateY(50px)",
            clipPath: "inset(100% 0 0 0)",
          },
          { opacity: 1, transform: "none", clipPath: "inset(0)" },
        ],
        first ? 1100 : 700,
        { delay: first ? 260 : 0 },
      );
    } else {
      tween(
        el,
        [
          { opacity: 0, clipPath: "inset(0 100% 0 0)" },
          { opacity: 1, clipPath: "inset(0)" },
        ],
        900,
        { delay: first ? 1050 : 250 },
      );
    }
  });
}
function entrance() {
  if (root.hasAttribute("data-in")) return;
  root.setAttribute("data-in", "");
  if (target !== "hero" || session.busy) return;
  heroIn(true);
  $$(".tag").forEach((el, i) =>
    tween(
      el,
      [
        { opacity: 0, transform: "translateY(-40px) rotate(-4deg)" },
        { opacity: 1, transform: "none" },
      ],
      700,
      { delay: 120 + i * 80, easing: "cubic-bezier(.3,1.5,.5,1)" },
    ),
  );
  tween($(".hint"), [{ opacity: 0 }, { opacity: 0.85 }], 600, { delay: 1800 });
}
function heroOut() {
  stopHeroAnimations();
  heroElements.forEach((el) => {
    const end = el.matches(".badge")
      ? { transform: "translateY(-110%) rotate(-6deg)" }
      : el.matches(".wm")
        ? { transform: "translateY(-40px)" }
        : {};
    el.style.opacity = "0";
    tween(el, [{ opacity: 1 }, { opacity: 0, ...end }], 380, {
      easing: easeOut,
    });
  });
}

export { heroIn, heroOut, entrance, stopHeroAnimations, sway, badges };
