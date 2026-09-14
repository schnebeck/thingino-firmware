/* Appends one small button per enabled quick-play sound slot into the
 * control bar, after control-bar.js has built it. Kept out of
 * control-bar.js itself (unlike the Motion/Audio Alarm/VPN buttons there)
 * since the number of buttons here is dynamic (0-5, from config) rather
 * than a fixed single button - a job for a small companion script, same
 * idea as raptor-nav-patches.js and audio-alarm-control.js.
 */
(function () {
  "use strict";

  function playSlot(button, slot) {
    button.classList.add("pending");
    fetch("/x/play-sound.cgi?slot=" + slot)
      .then((r) => r.json())
      .then((data) => {
        if (data.error && typeof window.showAlert === "function") {
          window.showAlert("danger", "Play failed: " + data.error, 3000);
        }
      })
      .catch(() => {})
      .finally(() => button.classList.remove("pending"));
  }

  function buildButtons(buttons) {
    // Preview page has its own dedicated row under the video (added
    // specifically so 5 sound buttons don't cram into the shared action
    // bar alongside Motion/Privacy/VPN/etc. - that bar's flex-wrap just
    // pushed everything onto an ugly second line). Other pages that have
    // the shared bar but not this dedicated one keep the old behavior.
    const dedicated = document.getElementById("sound-buttons-bar");
    const bar = dedicated || document.getElementById("button-bar");
    if (!bar) return;
    const btnClass = dedicated ? "btn btn-secondary btn-sm" : "btn btn-secondary flex-fill";
    let added = 0;
    buttons.forEach((btn, slot) => {
      if (!btn || btn.enabled !== true || !btn.file) return;
      const el = document.createElement("button");
      el.type = "button";
      el.className = btnClass;
      el.title = btn.tooltip || btn.label || "Play sound";
      el.innerHTML =
        '<i class="bi bi-volume-up-fill"></i> ' +
        (btn.label ? "<span>" + btn.label + "</span>" : "");
      el.addEventListener("click", () => playSlot(el, slot));
      bar.appendChild(el);
      added++;
    });
    if (dedicated && added > 0) dedicated.style.display = "";
  }

  function init() {
    fetch("/x/json-sound-buttons.cgi", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.buttons)) buildButtons(data.buttons);
      })
      .catch(() => {});
  }

  // control-bar.js mounts on navigation.js's own DOMContentLoaded chain
  // (ensureControlBarScript(), triggered from mountNavigation()) - wait for
  // the full page load rather than racing that, then a tick more so the
  // bar element actually exists in the DOM.
  window.addEventListener("load", function () {
    setTimeout(init, 50);
  });
})();
