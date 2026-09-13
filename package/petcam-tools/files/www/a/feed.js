(function () {
  "use strict";

  const btn = document.getElementById("feed-btn");
  const status = document.getElementById("feed-status");
  let poll = null;

  function setBusy(busy) {
    btn.disabled = busy;
    status.textContent = busy ? "Status: running..." : "Status: ready";
  }

  function checkStatus() {
    fetch("/x/json-feed.cgi", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        setBusy(!!d.in_motion);
        if (!d.in_motion && poll) {
          clearInterval(poll);
          poll = null;
        }
      })
      .catch(() => {});
  }

  btn.addEventListener("click", function () {
    setBusy(true);
    fetch("/x/json-feed.cgi", { method: "POST", credentials: "same-origin" })
      .then((r) => r.json())
      .then(() => {
        poll = setInterval(checkStatus, 1000);
      })
      .catch(() => setBusy(false));
  });

  checkStatus();
})();
