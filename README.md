# Twitch-Badge-Dashboard

A dark-themed dashboard for tracking Twitch badge drop events, plus a live
badge browser powered by the official Twitch API.

## Pages

- **Events** (`index.html`) — curated badge drop events with live/upcoming/ended
  status, search, and countdowns. Twitch has no public API for upcoming badge
  events, so this list is hand-maintained in `data.js`.
- **Badges** (`badges.html`) — real badge data and images fetched live from the
  Twitch Helix API: all global badges, or any channel's badges by name.

## Connect to Twitch

1. Go to <https://dev.twitch.tv/console/apps> and click **Register Your Application**
   (you'll need a Twitch account with two-factor auth enabled).
2. Name it anything, set the OAuth Redirect URL to `http://localhost`, and pick
   any category. Save, then copy the **Client ID** and generate a **Client Secret**.
3. Run the server with those credentials (Node 18+ required):

   ```sh
   TWITCH_CLIENT_ID=your_client_id TWITCH_CLIENT_SECRET=your_secret node server.js
   ```

4. Open <http://localhost:3000> and click the **Badges** tab.

The secret stays on the server — the browser only talks to `/api/badges/*`,
which the server proxies to Twitch with a cached app access token.

## Run without Twitch credentials

The Events page works with no setup at all — open `index.html` directly or run
`node server.js` (the Badges page will show a "not connected" message).

## Add events

Edit `data.js` — each event has a name, channel, description, requirement,
emoji (placeholder badge art), and ISO start/end dates.
