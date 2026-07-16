# BadgeDrops mobile app

Native iOS + Android app (Expo / React Native) for badgedrops.com. It's a thin
client over the same public JSON the website reads from GitHub Pages — there is
no separate backend to run or pay for.

## Features

- **Events / Badges / Emotes / Tracker** tabs, reading `badgedrops.com/api/*.json`.
- **Personal tracker** — star badges you want, mark ones you've earned. Stored
  on-device (AsyncStorage). No account, no server.
- **Ending-soon reminders** — starring a badge schedules a local notification
  24h before it ends. Fully offline; fires even if the app is closed.
- **New-badge push** (topic-based) — scaffolded; needs the server side wired
  once (see below).

## Run it locally

```bash
cd mobile
npm install
npx expo start      # press i / a for iOS / Android, or scan the QR in Expo Go
```

Local reminders and all browsing work in Expo Go. Remote push and store builds
need a development build (`npx expo run:ios` / `run:android`) or EAS.

## Data feed

The app calls:

- `/api/global-badges.json`, `/api/global-emotes.json` — catalogs
- `/api/events.json` — consolidated dated drops, produced by
  `scripts/generate-events.js` in the data workflow (falls back to
  `/api/auto-events.json` until that file is published)

## New-badge push — the near-free path (to wire once)

The goal: when a new badge is detected, one push goes to everyone, with **no
per-user token database**. Use a Firebase Cloud Messaging **topic**:

1. Create a free Firebase project. Add the iOS + Android apps
   (`com.badgedrops.app`). Download `GoogleService-Info.plist` /
   `google-services.json` into `mobile/` (they're gitignored).
2. On launch the app subscribes every device to the topic `new-badges`.
3. Add a step to `.github/workflows/update-data.yml` that, when
   `scripts/notify-discord.js` reports a newly-added badge, calls the FCM HTTP
   v1 API to send one message to the `new-badges` topic. Store the Firebase
   service-account JSON as a GitHub secret.

That reuses the detection the Action already does. Running cost: **$0**.

## Publishing (accounts are the only real cost)

- **Apple Developer Program** — $99/year (required for the App Store).
- **Google Play Developer** — $25 one-time.
- Build + submit with EAS (free tier): `npx eas build` / `npx eas submit`.

## Assets

`app.json` references `assets/icon.png`, `assets/splash.png`,
`assets/adaptive-icon.png`. Drop 1024×1024 PNGs there before building — reuse
the site's favicon artwork (Twitch glitch + "BD").
