// Fetches Twitch badge/emote data and writes it to api/*.json so the site
// can be hosted statically (GitHub Pages). Run by the GitHub Action in
// .github/workflows/update-data.yml with credentials from repo secrets:
//   TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=yyy node scripts/fetch-data.js

const fs = require("fs");
const path = require("path");

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// Channels pre-fetched for the channel badges page + home preview.
const CHANNELS = ["ishowspeed", "kaicenat", "xqc", "gamesdonequick", "pokimane"];

const OUT_DIR = path.join(__dirname, "..", "api");

async function getAppToken() {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set");
    process.exit(1);
  }
  const token = await getAppToken();

  async function helix(endpoint) {
    const res = await fetch(`https://api.twitch.tv/helix/${endpoint}`, {
      headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Helix ${endpoint} failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  function write(file, data) {
    const full = path.join(OUT_DIR, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify(data));
    console.log(`wrote api/${file}`);
  }

  write("global-badges.json", await helix("chat/badges/global"));
  write("global-emotes.json", await helix("chat/emotes/global"));

  for (const login of CHANNELS) {
    try {
      const users = await helix(`users?login=${login}`);
      if (!users.data.length) {
        console.warn(`channel not found: ${login}`);
        continue;
      }
      const user = users.data[0];
      const badges = await helix(`chat/badges?broadcaster_id=${user.id}`);
      write(`channel-badges/${login}.json`, {
        user: { id: user.id, login: user.login, display_name: user.display_name },
        ...badges,
      });
    } catch (err) {
      console.warn(`failed for ${login}: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
