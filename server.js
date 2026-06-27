// Minimal server: serves the static site and proxies Twitch Helix badge
// endpoints so the client secret never reaches the browser.
//
// Setup:
//   1. Create an app at https://dev.twitch.tv/console/apps (any OAuth
//      redirect URL works, e.g. http://localhost).
//   2. Run with credentials:
//        TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=yyy node server.js
//   3. Open http://localhost:3000

// Optionally load a local .env file for development. In production
// (GitHub Actions / Render) the env vars are injected directly and dotenv
// isn't installed, so we ignore it if it's missing.
try { require("dotenv").config(); } catch (_) {}

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

let cachedToken = null; // { token, expiresAt }

async function getAppToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }
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
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

async function helix(endpoint) {
  const token = await getAppToken();
  const res = await fetch(`https://api.twitch.tv/helix/${endpoint}`, {
    headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Helix ${endpoint} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function handleApi(req, res, url) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Server is missing TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET" }));
    return;
  }
  try {
    if (url.pathname === "/api/badges/global") {
      const data = await helix("chat/badges/global");
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" });
      res.end(JSON.stringify(data));
      return;
    }
    if (url.pathname === "/api/badges/channel") {
      const login = (url.searchParams.get("login") || "").toLowerCase();
      if (!/^[a-z0-9_]{1,25}$/.test(login)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid channel login" }));
        return;
      }
      const users = await helix(`users?login=${login}`);
      if (!users.data.length) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Channel "${login}" not found` }));
        return;
      }
      const user = users.data[0];
      const badges = await helix(`chat/badges?broadcaster_id=${user.id}`);
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" });
      res.end(JSON.stringify({ user: { id: user.id, login: user.login, display_name: user.display_name }, ...badges }));
      return;
    }
    if (url.pathname === "/api/emotes/global") {
      const data = await helix("chat/emotes/global");
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" });
      res.end(JSON.stringify(data));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unknown API route" }));
  } catch (err) {
    console.error(err);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function serveStatic(req, res, url) {
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  // Clean URLs: a path with no file extension maps to its folder's index.html
  // (e.g. /events -> /events/index.html), matching GitHub Pages behavior.
  if (!path.extname(filePath)) {
    filePath = filePath.replace(/\/$/, "") + "/index.html";
  }
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(__dirname, filePath);
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fullPath)] || "application/octet-stream" });
    res.end(content);
  });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  })
  .listen(PORT, () => {
    console.log(`Badge dashboard running at http://localhost:${PORT}`);
    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.warn("⚠ TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set — /api/badges will return 503");
    }
  });
