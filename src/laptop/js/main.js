import { $, motion, film, trans, plate, cut } from "./dom.js";
import { session } from "./session.js";
import { projects, refreshProjects } from "./catalogue.js";
import { place, resize } from "./layout.js";
import { wait } from "./motion.js";
import { entrance, stopHeroAnimations, badges, sway } from "./hero.js";
import { setMedia, fillCase } from "./project-view.js";
import { bindNavigation } from "./navigation.js";

bindNavigation();
window.addEventListener("resize", resize);
motion.addEventListener("change", () => {
  if (motion.matches) {
    stopHeroAnimations();
    trans.pause();
    film.pause();
    film.hidden = true;
  } else {
    if (session.mode === "case") setMedia(session.index);
    else if (!session.busy) badges.forEach(sway);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) film.pause();
  else if (
    session.mode === "case" &&
    !session.busy &&
    !motion.matches &&
    projects[session.index].video
  )
    film.play().catch(() => {});
});
fillCase(0);
$("#status").textContent = "";
place("hero");
const imgReady = (img) =>
  img.complete
    ? Promise.resolve()
    : new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
Promise.race([
  Promise.all([document.fonts.ready, imgReady(plate), imgReady(cut)]),
  wait(2500),
]).then(() => requestAnimationFrame(entrance));
document.fonts.ready.then(resize);
setTimeout(entrance, 4000);
refreshProjects();
