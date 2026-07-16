// PWA install + web-push (OneSignal).
//
// SETUP: paste your OneSignal App ID below. Until you do, push stays off and
// the site just registers the plain caching service worker (nothing breaks).
// The App ID is public/safe to commit; the REST API key is NOT — it lives only
// as a GitHub secret used by the data workflow to send pushes.
var ONESIGNAL_APP_ID = "04dcaa9b-4ff8-4075-b015-7999b9f86e03";

(function () {
  var installBtn = document.getElementById("installBtn");
  var notifyBtn = document.getElementById("notifyBtn");

  // ---------- Install button (home page only) ----------
  if (installBtn) {
    var isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (!isStandalone) {
      var isiOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      var deferred = null;
      window.addEventListener("beforeinstallprompt", function (e) {
        e.preventDefault();
        deferred = e;
        installBtn.hidden = false;
      });
      window.addEventListener("appinstalled", function () {
        installBtn.hidden = true;
      });
      if (isiOS) installBtn.hidden = false;
      installBtn.addEventListener("click", function () {
        if (deferred) {
          deferred.prompt();
          deferred.userChoice.finally(function () {
            deferred = null;
            installBtn.hidden = true;
          });
        } else if (isiOS) {
          var hint = document.getElementById("installHint");
          if (hint) hint.hidden = !hint.hidden;
        }
      });
    }
  }

  // ---------- Push (OneSignal) ----------
  if (ONESIGNAL_APP_ID) {
    // Load the OneSignal SDK; it registers OneSignalSDKWorker.js for us.
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
        var on = OneSignal.Notifications.permission === true;
        notifyBtn.hidden = on; // hide once they're subscribed
      }
      refresh();

      notifyBtn.addEventListener("click", async function () {
        await OneSignal.Notifications.requestPermission();
        try { await OneSignal.User.PushSubscription.optIn(); } catch (e) {}
        refresh();
      });
    });
  } else if ("serviceWorker" in navigator) {
    // No push configured yet — just register the caching worker.
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
