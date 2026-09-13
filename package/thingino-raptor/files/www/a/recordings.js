/* recordings.js - browse/play/download/delete the raptor SD motion clips
 * listed by /x/json-recordings.cgi (a filesystem helper, rmr's own "motion"
 * mode clip storage). Playback + download stream the clip from the same
 * CGI (?file=<rel>). Dependency-free. Adapted from timps's recordings.js. */
(function () {
  "use strict";

  if (!document.body || document.body.id !== "page-recordings") return;

  var LIST = "/x/json-recordings.cgi";
  var listEl = document.getElementById("rec-list");
  var infoEl = document.getElementById("rec-info");
  var reloadBtn = document.getElementById("rec-reload");
  var video = document.getElementById("rec-video");
  var modalEl = document.getElementById("recModal");
  var modal = null;

  function toast(type, msg, ms) {
    if (typeof window.showAlert === "function") window.showAlert(type, msg, ms);
    else console.log("[recordings]", type + ":", msg);
  }

  function human(bytes) {
    var b = Number(bytes) || 0;
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
    if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
    return (b / 1073741824).toFixed(2) + " GB";
  }

  // "2026-09-12/14-30-05.mp4" (rmr's own <date>/<time>.mp4 layout) -> a
  // readable local timestamp; fall back to the file mtime otherwise.
  function labelFor(rel, mtime) {
    var m = /(\d{4}-\d{2}-\d{2})\/(\d{2})-(\d{2})-(\d{2})/.exec(rel);
    if (m) return m[1] + " " + m[2] + ":" + m[3] + ":" + m[4];
    if (mtime) return new Date(Number(mtime) * 1000).toLocaleString();
    return rel;
  }

  function url(action, rel) {
    return LIST + "?" + action + "=" + encodeURIComponent(rel);
  }

  function play(rel, label) {
    if (!video) return;
    video.src = url("file", rel);
    var title = document.getElementById("recModalTitle");
    if (title) title.textContent = label;
    if (!modal && window.bootstrap) modal = new window.bootstrap.Modal(modalEl);
    if (modal) modal.show();
    video.play().catch(function () { /* user can press play */ });
  }

  function del(rel, tr) {
    if (!window.confirm("Delete this recording?\n" + rel)) return;
    fetch(url("del", rel), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function () { if (tr) tr.remove(); toast("success", "Recording deleted.", 2500); })
      .catch(function (e) { toast("danger", "Delete failed: " + (e.message || e)); });
  }

  function render(files) {
    listEl.innerHTML = "";
    if (!files.length) {
      listEl.innerHTML = '<tr><td colspan="4" class="text-secondary">No recordings found.</td></tr>';
      return;
    }
    files.forEach(function (f) {
      var label = labelFor(f.file, f.mtime);
      var tr = document.createElement("tr");
      var actions = document.createElement("td");
      actions.className = "text-end";

      var playBtn = document.createElement("button");
      playBtn.className = "btn btn-sm btn-primary me-1";
      playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
      playBtn.title = "Play";
      playBtn.addEventListener("click", function () { play(f.file, label); });

      var dl = document.createElement("a");
      dl.className = "btn btn-sm btn-outline-secondary me-1";
      dl.href = url("file", f.file);
      dl.setAttribute("download", f.file.replace(/\//g, "_"));
      dl.title = "Download";
      dl.innerHTML = '<i class="bi bi-download"></i>';

      var delBtn = document.createElement("button");
      delBtn.className = "btn btn-sm btn-outline-danger";
      delBtn.innerHTML = '<i class="bi bi-trash"></i>';
      delBtn.title = "Delete";
      delBtn.addEventListener("click", function () { del(f.file, tr); });

      actions.appendChild(playBtn); actions.appendChild(dl); actions.appendChild(delBtn);

      var tdWhen = document.createElement("td"); tdWhen.textContent = label;
      var tdSeg = document.createElement("td");
      var segSpan = document.createElement("span");
      segSpan.className = "text-secondary small";
      segSpan.textContent = f.file;
      tdSeg.appendChild(segSpan);
      var tdSize = document.createElement("td"); tdSize.className = "text-end"; tdSize.textContent = human(f.size);

      tr.appendChild(tdWhen); tr.appendChild(tdSeg); tr.appendChild(tdSize); tr.appendChild(actions);
      listEl.appendChild(tr);
    });
  }

  function load() {
    listEl.innerHTML = '<tr><td colspan="4" class="text-secondary">Loading...</td></tr>';
    fetch(LIST, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        render(data.files || []);
        var info = (data.files || []).length + " clip(s) · " + (data.base || "");
        if (typeof data.free_mb === "number" && data.free_mb >= 0) {
          info += " · " + human(data.free_mb * 1048576) + " free";
        }
        if (infoEl) infoEl.textContent = info;
      })
      .catch(function (e) {
        listEl.innerHTML = '<tr><td colspan="4" class="text-danger">Failed to list recordings: ' +
          (e.message || e) + "</td></tr>";
      });
  }

  if (modalEl) modalEl.addEventListener("hidden.bs.modal", function () {
    if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
  });
  if (reloadBtn) reloadBtn.addEventListener("click", load);

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", load, { once: true });
  else load();
})();
