# Twitch-Badge-Dashboard

A dark-themed dashboard for tracking Twitch badge drop events — live, upcoming, and ended — inspired by streamdatabase.com.

## Run

No build step. Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server
```

## Add events

Edit `data.js` — each event has a name, channel, description, requirement, emoji (placeholder badge art), and ISO start/end dates.
