// Registers the service worker (makes the site installable) and, on the home
// page only, wires the "Install app" button. The button element exists only in
// index.html, so this no-ops elsewhere.
(function () {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }

  var btn = document.getElementById("installBtn");
  if (!btn) return; // not the home page

  var isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (isStandalone) return; // already installed — no need to show the button

  var isiOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  var deferred = null;

  // Android / desktop Chrome: capture the install prompt and show the button.
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });

  window.addEventListener("appinstalled", function () {
    btn.hidden = true;
  });

  // iOS Safari has no install prompt — show the button and explain the
  // Share -> Add to Home Screen flow when tapped.
  if (isiOS) btn.hidden = false;

  btn.addEventListener("click", function () {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.finally(function () {
        deferred = null;
        btn.hidden = true;
      });
    } else if (isiOS) {
      var hint = document.getElementById("installHint");
      if (hint) hint.hidden = !hint.hidden;
    }
  });
})();
