import {
  $,
  root,
  frame,
  screen,
  plate,
  cut,
  caseplate,
  rig,
  trans,
  film,
  motion,
} from "./dom.js";
import { session, setBusy } from "./session.js";
import { wait, animate, tween } from "./motion.js";
import { place, gliding } from "./layout.js";
import { heroIn, heroOut } from "./hero.js";
import { projects, applyPending } from "./catalogue.js";
import {
  fillCase,
  setMedia,
  preloadNext,
  flash,
  caseIn,
  caseOut,
} from "./project-view.js";

function photoReady() {
  return caseplate.complete && caseplate.naturalWidth > 0;
}
async function playLanding() {
  // The embedded clip begins after the reference actor has left the shot.
  trans.currentTime = 0;
  trans.playbackRate = 1.5;
  const stop = new AbortController();
  let timeout;
  try {
    const finished = new Promise((resolve) => {
      const options = { once: true, signal: stop.signal };
      trans.addEventListener("ended", resolve, options);
      trans.addEventListener("error", resolve, options);
      motion.addEventListener("change", resolve, options);
      timeout = setTimeout(resolve, 2200);
    });
    await Promise.race([trans.play(), finished]);
    if (!trans.paused && !motion.matches) {
      trans.style.opacity = "1";
      tween(trans, [{ opacity: 0 }, { opacity: 1 }], 420);
      await finished;
    }
  } catch {
    /* The still frame also works when video playback is unavailable. */
  } finally {
    clearTimeout(timeout);
    stop.abort();
    trans.pause();
  }
}
async function toCase() {
  if (session.busy || session.mode === "case") return;
  if (document.activeElement === $(".hint"))
    $("#work").focus({ preventScroll: true });
  applyPending();
  setBusy(true);
  root.setAttribute("data-in", "");
  heroOut();
  session.index = 0;
  fillCase(0);
  await wait(330);
  const moving = !motion.matches;
  const hasClip =
    moving && trans.readyState >= 2 && Number.isFinite(trans.duration);
  gliding(1600);
  place("case");
  if (moving) {
    // The screen in the cutout starts around (980, 520) in frame units.
    rig.style.zIndex = "6";
    rig.style.opacity = "1";
    const lift = animate(
      rig,
      [
        {
          transform:
            "translate(255px,142px) perspective(900px) rotateY(-34deg) rotateZ(-5deg) scale(.22,.28)",
          opacity: 0,
        },
        { opacity: 1, offset: 0.12 },
        {
          transform:
            "translate(90px,28px) perspective(900px) rotateY(-14deg) scale(.68,.75)",
          offset: 0.58,
        },
        { transform: "none" },
      ],
      hasClip ? 1450 : 1600,
      { easing: "cubic-bezier(.36,.02,.18,1)" },
    );
    tween(cut, [{ opacity: 1 }, { opacity: 0, transform: "scale(1.16)" }], 720);
    cut.style.opacity = "0";
    tween(
      plate,
      [{ opacity: 1 }, { opacity: 0, transform: "scale(1.12)" }],
      950,
    );
    plate.style.opacity = "0";
    // Crossfade the moving laptop into the final photograph.
    trans.style.zIndex = "7";
    await Promise.all([
      lift.finished.catch(() => {}),
      hasClip ? playLanding() : Promise.resolve(),
    ]);
    lift.cancel();
  }
  plate.style.visibility = "hidden";
  cut.style.opacity = "0";
  rig.style.zIndex = "";
  caseplate.style.opacity = photoReady() ? "1" : "0";
  rig.style.opacity = photoReady() ? "0" : "1";
  trans.style.opacity = "0";
  trans.pause();
  session.mode = "case";
  document.body.classList.add("is-case");
  screen.style.opacity = "1";
  setMedia(0);
  flash(0.55, 600);
  tween(
    $(".preview"),
    [
      { opacity: 0, transform: "scale(1.06)" },
      { opacity: 1, transform: "none" },
    ],
    700,
  );
  caseIn(true);
  preloadNext();
  await wait(700);
  frame.classList.remove("glide");
  setBusy(false);
}
async function swapTo(n) {
  if (session.busy || session.mode !== "case") return;
  if (n < 0) return toHero();
  setBusy(true);
  await Promise.all([
    caseOut(),
    tween($(".preview"), [{ opacity: 1 }, { opacity: 0 }], 350),
  ]);
  session.index = n % projects.length;
  fillCase(session.index);
  place("case");
  setMedia(session.index);
  flash(0.35, 420);
  tween(
    $(".preview"),
    [
      { opacity: 0, transform: "scale(1.04)" },
      { opacity: 1, transform: "none" },
    ],
    500,
  );
  caseIn(false);
  preloadNext();
  await wait(520);
  setBusy(false);
}
async function toHero() {
  if (session.busy || session.mode === "hero") return;
  setBusy(true);
  film.pause();
  await Promise.all([
    caseOut(),
    tween(screen, [{ opacity: 1 }, { opacity: 0 }], 300),
  ]);
  const front =
    photoReady() && caseplate.style.opacity === "1" ? caseplate : rig;
  const moveFocus = document.activeElement?.closest(
    ".case-ui,.logo,.screen-hit",
  );
  session.mode = "hero";
  document.body.classList.remove("is-case");
  screen.style.opacity = "0";
  plate.style.visibility = "visible";
  plate.style.opacity = "1";
  cut.style.opacity = "1";
  gliding(900);
  place("hero");
  front.style.opacity = "0";
  tween(
    front,
    [
      { opacity: 1, filter: "blur(0px)" },
      { opacity: 0, filter: "blur(12px)" },
    ],
    800,
  );
  tween(
    plate,
    [
      { transform: "scale(1.12)", filter: "blur(8px)" },
      { transform: "none", filter: "blur(0px)" },
    ],
    900,
  );
  tween(cut, [{ opacity: 0 }, { opacity: 1 }], 700, { delay: 150 });
  if (moveFocus) $("#studio").focus({ preventScroll: true });
  await wait(250);
  heroIn(false);
  await wait(1000);
  frame.classList.remove("glide");
  setBusy(false);
  applyPending();
  $("#status").textContent = "Estudio de Juan David";
}
function advance(direction) {
  if (session.mode === "hero") {
    if (direction > 0) toCase();
  } else swapTo(session.index + direction);
}

export { toCase, toHero, advance };
