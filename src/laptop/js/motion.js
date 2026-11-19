import { motion } from "./dom.js";

const ease = "cubic-bezier(.2,.8,.2,1)",
  easeOut = "cubic-bezier(.5,0,.75,0)";
const duration = (ms) => (motion.matches ? 0 : ms);
const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, duration(ms)));
function animate(el, keyframes, ms, options = {}) {
  const animation = el.animate(keyframes, {
    duration: duration(ms),
    easing: ease,
    fill: "both",
    ...options,
    delay: duration(options.delay || 0),
  });
  return animation;
}
function tween(el, keyframes, ms, options) {
  const animation = animate(el, keyframes, ms, options);
  return animation.finished.catch(() => {}).finally(() => animation.cancel());
}

export { duration, wait, animate, tween, easeOut };
