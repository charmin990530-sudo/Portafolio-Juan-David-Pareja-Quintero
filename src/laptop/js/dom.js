const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const root = document.documentElement;
const frame = $(".frame"),
  stage = $(".stage"),
  screen = $(".screen");
const plate = $(".plate"),
  cut = $(".cut"),
  caseplate = $(".caseplate"),
  rig = $(".rig");
const trans = $(".trans"),
  film = $(".project-film"),
  still = $(".project-still");
const contact = $("dialog"),
  phone = matchMedia(
    "(max-width:820px), (max-width:1000px) and (max-height:570px)",
  );
const motion = matchMedia("(prefers-reduced-motion:reduce)");

export {
  $,
  $$,
  root,
  frame,
  stage,
  screen,
  plate,
  cut,
  caseplate,
  rig,
  trans,
  film,
  still,
  contact,
  phone,
  motion,
};
