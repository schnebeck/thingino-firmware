(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('petcam-feed-preview-btn');
    if (!btn) return;
    var poll = null;

    function setBusy(busy) {
      btn.disabled = busy;
      btn.classList.toggle('btn-primary', !busy);
      btn.classList.toggle('btn-secondary', busy);
    }

    function checkStatus() {
      fetch('/x/json-feed.cgi', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          setBusy(!!d.in_motion);
          if (!d.in_motion && poll) {
            clearInterval(poll);
            poll = null;
          }
        })
        .catch(function () {});
    }

    btn.addEventListener('click', function () {
      setBusy(true);
      fetch('/x/json-feed.cgi', { method: 'POST', credentials: 'same-origin' })
        .then(function () {
          poll = setInterval(checkStatus, 1000);
        })
        .catch(function () { setBusy(false); });
    });

    checkStatus();
  });
})();
