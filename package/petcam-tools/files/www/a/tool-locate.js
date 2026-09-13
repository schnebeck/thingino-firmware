(function () {
  "use strict";

  const statusEl = document.getElementById("locate-status");
  const resultEl = document.getElementById("locate-result");
  const coordsEl = document.getElementById("locate-coords");
  const accuracyEl = document.getElementById("locate-accuracy");
  const updatedEl = document.getElementById("locate-updated");
  const mapLink = document.getElementById("locate-map-link");
  const btn = document.getElementById("locate-btn");
  const enabledCheckbox = document.getElementById("locate-enabled");

  function applyEnabledState(enabled) {
    btn.disabled = !enabled;
    if (!enabled) {
      statusEl.classList.remove("d-none");
      statusEl.textContent = "Location is disabled.";
      resultEl.classList.add("d-none");
    }
  }

  function render(data) {
    if (!data || !data.known) {
      if (data && data.enabled) {
        statusEl.textContent = "Not yet located.";
      }
      resultEl.classList.add("d-none");
      return;
    }
    statusEl.classList.add("d-none");
    resultEl.classList.remove("d-none");
    coordsEl.textContent = data.lat.toFixed(5) + ", " + data.lng.toFixed(5);
    accuracyEl.textContent = data.accuracy != null ? Math.round(data.accuracy) : "?";
    updatedEl.textContent = data.updated
      ? new Date(data.updated * 1000).toLocaleString()
      : "?";
    mapLink.href =
      "https://www.openstreetmap.org/?mlat=" + data.lat + "&mlon=" + data.lng + "#map=16/" + data.lat + "/" + data.lng;
  }

  function load() {
    fetch("/x/json-locate.cgi", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        enabledCheckbox.checked = !!(data && data.enabled);
        applyEnabledState(enabledCheckbox.checked);
        render(data);
      })
      .catch(() => {});
  }

  enabledCheckbox.addEventListener("change", () => {
    const enabled = enabledCheckbox.checked;
    enabledCheckbox.disabled = true;
    fetch("/x/json-locate.cgi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: enabled }),
    })
      .then((r) => r.json())
      .then(() => {
        applyEnabledState(enabled);
      })
      .catch(() => {
        enabledCheckbox.checked = !enabled;
      })
      .finally(() => {
        enabledCheckbox.disabled = false;
      });
  });

  btn.addEventListener("click", () => {
    btn.disabled = true;
    statusEl.classList.remove("d-none");
    statusEl.textContent = "Scanning nearby WiFi networks...";
    resultEl.classList.add("d-none");
    fetch("/x/json-locate.cgi", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          statusEl.textContent = "Failed: " + (data.detail || data.error);
          resultEl.classList.add("d-none");
          return;
        }
        render(data);
      })
      .catch(() => {
        statusEl.textContent = "Request failed.";
      })
      .finally(() => {
        btn.disabled = enabledCheckbox.checked ? false : true;
      });
  });

  load();
})();
