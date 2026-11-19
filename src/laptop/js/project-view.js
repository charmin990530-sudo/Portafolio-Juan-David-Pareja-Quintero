import { $, $$, film, still, motion } from "./dom.js";
import { tween, easeOut } from "./motion.js";
import { projects } from "./catalogue.js";
import { session } from "./session.js";

let preloaded;
const pad = (value) => String(value).padStart(2, "0");
function fillCase(n) {
  const item = projects[n];
  $(".ticket h2").textContent = item.title;
  $$(".rows div").forEach(
    (row, i) =>
      (row.textContent = [item.category, item.language, item.year][i]),
  );
  $(".desc strong").textContent = "// " + item.title.toLocaleLowerCase("es");
  $(".desc p").textContent = "— " + item.description;
  $(".num").textContent = pad(n + 1) + " / " + pad(projects.length);
  $(".prev").classList.toggle("dim", n === 0);
  $(".prev .nav-label").textContent =
    n === 0 ? "mi estudio" : "anterior proyecto";
  $(".prev").setAttribute(
    "aria-label",
    n === 0 ? "Volver al estudio" : "Proyecto anterior",
  );
  $("#repo").href = item.url;
  $("#demo").hidden = !item.demo;
  if (item.demo) $("#demo").href = item.demo;
  else $("#demo").removeAttribute("href");
  $(".repo-cover h3").textContent = item.title;
  $(".repo-cover p").textContent = item.language + " / " + item.year;
  $("#status").textContent =
    item.title + ", proyecto " + (n + 1) + " de " + projects.length;
}
function setMedia(n) {
  film.pause();
  film.hidden = true;
  still.hidden = true;
  const asset = projects[n];
  if (!asset.poster) {
    film.removeAttribute("src");
    film.load();
    return;
  }
  still.src = asset.poster;
  still.alt = "Vista previa de " + projects[n].title;
  still.hidden = false;
  if (motion.matches) return;
  film.src = asset.video;
  film.currentTime = 0;
  film.onplaying = () => {
    if (!motion.matches && !document.hidden && session.mode === "case")
      film.hidden = false;
  };
  film.onerror = () => {
    film.hidden = true;
  };
  film.play().catch(() => {
    film.hidden = true;
  });
}
function preloadNext() {
  const asset = projects[(session.index + 1) % projects.length];
  if (!asset.video || motion.matches) return;
  preloaded ||= document.createElement("video");
  preloaded.preload = "auto";
  preloaded.src = asset.video;
}
function caseIn(first) {
  tween(
    $(".ticket"),
    [
      { opacity: 0, transform: "translateY(-60px) rotate(-6deg)" },
      { opacity: 1, transform: "translateY(6px) rotate(1.2deg)", offset: 0.7 },
      { opacity: 1, transform: "none" },
    ],
    800,
    { delay: first ? 150 : 0 },
  );
  [...$(".desc").children].forEach((el, k) =>
    tween(
      el,
      [
        { opacity: 0, transform: "translateY(14px)" },
        { opacity: 1, transform: "none" },
      ],
      600,
      { delay: (first ? 250 : 80) + 70 * k },
    ),
  );
}
function caseOut() {
  const animations = [
    tween(
      $(".ticket"),
      [
        { opacity: 1 },
        { opacity: 0, transform: "translateY(-40px) rotate(4deg)" },
      ],
      380,
      { easing: easeOut },
    ),
  ];
  [...$(".desc").children].forEach((el, k) =>
    animations.push(
      tween(
        el,
        [{ opacity: 1 }, { opacity: 0, transform: "translateY(-10px)" }],
        300,
        { delay: k * 35 },
      ),
    ),
  );
  return Promise.all(animations);
}
function flash(peak, time) {
  if (!motion.matches)
    tween(
      $(".flash"),
      [{ opacity: 0 }, { opacity: peak, offset: 0.25 }, { opacity: 0 }],
      time,
    );
}

export { setMedia, preloadNext, fillCase, caseIn, caseOut, flash };
