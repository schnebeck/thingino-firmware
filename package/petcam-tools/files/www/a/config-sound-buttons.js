(function () {
  "use strict";

  const CONFIG_ENDPOINT = "/x/json-sound-buttons.cgi";
  const UPLOAD_ENDPOINT = "/x/json-sound-upload.cgi";
  const SLOT_COUNT = 5;

  const slotsEl = document.getElementById("sb-slots");
  const saveBtn = document.getElementById("save_all");
  let knownFiles = [];

  function toast(type, msg, ms) {
    if (typeof window.showAlert === "function") window.showAlert(type, msg, ms);
    else console.log("[sound-buttons]", type + ":", msg);
  }

  function fileOptionsHtml(selected) {
    let html = '<option value="">- none -</option>';
    knownFiles.forEach((f) => {
      html += `<option value="${f}"${f === selected ? " selected" : ""}>${f}</option>`;
    });
    return html;
  }

  function renderSlot(i, btn) {
    const div = document.createElement("div");
    div.className = "card mb-3";
    div.innerHTML = `
      <div class="card-header">Slot ${i + 1}</div>
      <div class="card-body">
        <p class="form-switch">
          <input class="form-check-input me-2" type="checkbox" id="sb_enabled_${i}">
          <label class="form-check-label" for="sb_enabled_${i}">Enabled</label>
        </p>
        <p class="row">
          <label class="col-3 form-label" for="sb_label_${i}">Button label</label>
          <input class="col form-control" type="text" id="sb_label_${i}" placeholder="e.g. Treat sound" maxlength="24">
        </p>
        <p class="row">
          <label class="col-3 form-label" for="sb_tooltip_${i}">Tooltip</label>
          <input class="col form-control" type="text" id="sb_tooltip_${i}" placeholder="Optional description">
        </p>
        <p class="row">
          <label class="col-3 form-label" for="sb_file_${i}">Sound file</label>
          <select class="col form-select" id="sb_file_${i}">${fileOptionsHtml(btn.file)}</select>
        </p>
        <p class="row">
          <label class="col-3 form-label" for="sb_upload_${i}">Upload new file</label>
          <input class="col form-control" type="file" id="sb_upload_${i}" accept=".wav,.mp3,.aac,.m4a,.opus,.ogg">
        </p>
        <button type="button" class="btn btn-outline-secondary btn-sm" id="sb_test_${i}">
          <i class="bi bi-play-fill"></i> Test
        </button>
      </div>`;
    slotsEl.appendChild(div);

    document.getElementById(`sb_enabled_${i}`).checked = btn.enabled === true;
    document.getElementById(`sb_label_${i}`).value = btn.label || "";
    document.getElementById(`sb_tooltip_${i}`).value = btn.tooltip || "";

    document.getElementById(`sb_upload_${i}`).addEventListener("change", (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const form = new FormData();
      form.append("form", "sound");
      form.append("file", file);
      toast("info", `Uploading ${file.name}...`, 2000);
      fetch(UPLOAD_ENDPOINT, { method: "POST", body: form })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          knownFiles.push(data.file);
          const sel = document.getElementById(`sb_file_${i}`);
          sel.innerHTML = fileOptionsHtml(data.file);
          toast("success", `Uploaded as ${data.file}`, 3000);
        })
        .catch((err) => toast("danger", "Upload failed: " + (err.message || err)));
    });

    document.getElementById(`sb_test_${i}`).addEventListener("click", () => {
      fetch(`/x/play-sound.cgi?slot=${i}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
        })
        .catch((err) => toast("danger", "Play failed: " + (err.message || err)));
    });
  }

  function load() {
    fetch(CONFIG_ENDPOINT, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        knownFiles = data.files || [];
        const buttons = data.buttons || [];
        slotsEl.innerHTML = "";
        for (let i = 0; i < SLOT_COUNT; i++) {
          renderSlot(i, buttons[i] || {});
        }
      })
      .catch((err) => toast("danger", "Failed to load: " + (err.message || err)));
  }

  function save() {
    const buttons = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      buttons.push({
        enabled: document.getElementById(`sb_enabled_${i}`).checked,
        label: document.getElementById(`sb_label_${i}`).value.trim(),
        tooltip: document.getElementById(`sb_tooltip_${i}`).value.trim(),
        file: document.getElementById(`sb_file_${i}`).value,
      });
    }
    fetch(CONFIG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buttons }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        toast("success", "Settings saved.", 3000);
      })
      .catch((err) => toast("danger", "Save failed: " + (err.message || err)));
  }

  saveBtn.addEventListener("click", save);
  load();
})();
