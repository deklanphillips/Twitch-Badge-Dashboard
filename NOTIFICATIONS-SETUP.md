# Turning on "badge went live" push notifications

Everything is already wired. It stays **off** until you do these one-time steps
(all free). When on, every time a badge goes live on the event calendar, all
opted-in visitors get a push — the same moment the Discord go-live fires.

## 1. Create a free OneSignal app
1. Sign up at <https://onesignal.com> (free).
2. New App/Website → platform **Web** → **Typical Site**.
3. Site URL: `https://badgedrops.com` (name it "BadgeDrops").
4. Finish. OneSignal gives you two values:
   - **App ID** (public, safe to share)
   - **REST API Key** (secret — never commit this)

## 2. Add the App ID to the site
Edit `pwa.js`, top of the file:

```js
var ONESIGNAL_APP_ID = "";   // paste your App ID between the quotes
```

Commit + push. Once GitHub Pages redeploys, a green **"Get Live Alerts"**
button appears on the home page. (The App ID is public — committing it is fine.)

## 3. Add the two secrets to GitHub
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|------|-------|
| `ONESIGNAL_APP_ID` | your App ID |
| `ONESIGNAL_API_KEY` | your REST API Key |

That's it. The data workflow already passes these to the announcer, which calls
OneSignal whenever a badge goes live.

## Test it
- Visit badgedrops.com, click **Get Live Alerts**, allow notifications.
- In the OneSignal dashboard → **Messages → New Push**, send a test — you should
  get it. The next real badge that goes live will fire automatically.

## Notes
- iOS requires the site be **installed** (Add to Home Screen) before it can
  receive push — the Install App button handles that. Android/desktop work in
  the browser directly.
- Segment name: the send targets **"Total Subscriptions"**. If your OneSignal
  account still uses the older name, change `included_segments` in
  `scripts/notify-discord.js` to `["Subscribed Users"]`.
- Free tier covers ~10,000 subscribers.
