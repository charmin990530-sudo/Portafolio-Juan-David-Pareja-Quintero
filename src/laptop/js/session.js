export const session = { mode: "hero", busy: false, index: 0 };
export function setBusy(value) {
  session.busy = value;
  document.body.classList.toggle("busy", value);
}
