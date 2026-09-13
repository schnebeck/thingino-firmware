/* Small DOM patches applied after navigation.js builds the menu - things
 * that aren't worth a generic framework feature for a single camera
 * profile. Currently: point "File manager" at this camera's actual
 * recordings location instead of the filesystem root, since that's the
 * only place on this camera anyone browses files from in practice. */
(function () {
  "use strict";

  var DEFAULT_PATH = "/mnt/mmcblk0p1/raptor";

  function patchFileManagerLink() {
    document.querySelectorAll('a[href="/tool-file-manager.html"]').forEach(function (a) {
      a.href = "/tool-file-manager.html?cd=" + encodeURIComponent(DEFAULT_PATH);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchFileManagerLink, { once: true });
  } else {
    patchFileManagerLink();
  }
  // navigation.js builds the menu on its own DOMContentLoaded handler, whose
  // relative order against this script isn't guaranteed - a rebuild can also
  // happen later (plugin nav merge). Re-run shortly after load to catch
  // links added after this script's own DOMContentLoaded fired.
  window.addEventListener("load", function () {
    setTimeout(patchFileManagerLink, 0);
  });
})();
