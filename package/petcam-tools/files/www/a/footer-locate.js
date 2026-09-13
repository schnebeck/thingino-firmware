/* Fills footer.js's empty #footer-location placeholder with a Google
 * Maps link to the last known WiFi-based approximate location, next to
 * the uptime line - same small-companion-script pattern as
 * sound-buttons-control.js and raptor-nav-patches.js. Read-only here
 * (GET only, never triggers a fresh scan) - use the "Locate" page under
 * Tools to actually request a new fix.
 */
(function () {
  "use strict";

  function init() {
    const el = document.getElementById("footer-location");
    if (!el) return;
    fetch("/x/json-locate.cgi", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.known) return;
        const link = document.createElement("a");
        link.href = "https://www.google.com/maps?q=" + data.lat + "," + data.lng;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Location: " + data.lat.toFixed(5) + ", " + data.lng.toFixed(5);
        el.appendChild(link);
      })
      .catch(() => {});
  }

  window.addEventListener("load", function () {
    setTimeout(init, 50);
  });
})();
