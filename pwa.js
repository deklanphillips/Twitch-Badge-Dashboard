// PWA install + web-push (OneSignal).
//
// The App ID is public/safe to commit; the REST API key is NOT — it lives only
// as a GitHub secret used by the data workflow to send pushes.
var ONESIGNAL_APP_ID = "04dcaa9b-4ff8-4075-b015-7999b9f86e03";

(function () {
  var installBtn = document.getElementById("installBtn");
  var notifyBtn = document.getElementById("notifyBtn");
  var installHint = document.getElementById("installHint");

  var isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  var isiOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  // On iPhone, push notifications only work once the site is INSTALLED to the
  // home screen (Apple's rule). So:
  //   - not installed  -> guide them to Install first
  //   - installed / non-iOS -> offer notifications directly
  var pushUsableHere = isStandalone || !isiOS;

  // ---------- Install button ----------
  // Show only when not already installed. Hidden entirely once installed.
  if (installBtn && !isStandalone) {
    var deferred = null;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferred = e;
      installBtn.hidden = false;
    });
    window.addEventListener("appinstalled", function () {
      installBtn.hidden = true;
    });
    // iOS has no install prompt event — always offer the button there.
    if (isiOS) installBtn.hidden = false;

    installBtn.addEventListener("click", function () {
      if (deferred) {
        deferred.prompt();
        deferred.userChoice.finally(function () {
          deferred = null;
          installBtn.hidden = true;
        });
      } else if (isiOS && installHint) {
        installHint.hidden = !installHint.hidden;
      }
    });
  }

  // ---------- Push (OneSignal) ----------
  if (ONESIGNAL_APP_ID) {
    var s = document.createElement("script");
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    s.defer = true;
    document.head.appendChild(s);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        safari_web_id: "web.onesignal.auto.6a162863-2269-421e-a6d3-46e81aa6d2f4",
        allowLocalhostAsSecureOrigin: true,
      });
      if (!notifyBtn) return;

      function refresh() {
        var subscribed = OneSignal.Notifications.permission === true;
        // Only show the alerts button where push actually works, and only until
        // the user has subscribed.
        notifyBtn.hidden = !pushUsableHere || subscribed;
      }
      refresh();

      notifyBtn.addEventListener("click", async function () {
        await OneSignal.Notifications.requestPermission();
        try { await OneSignal.User.PushSubscription.optIn(); } catch (e) {}
        refresh();
      });
    });
  } else if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
