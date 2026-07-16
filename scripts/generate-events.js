// Emit api/events.json — one consolidated, dated drop list for the mobile app.
//
// The website builds its event list in the browser from three sources
// (curated data.js, availability-data.js, api/auto-events.json). The app wants
// a single JSON endpoint, so we do the same merge here at build time:
//   auto-events.json (confirmed, has group tags) is the base;
//   any badge with dates in availability-data.js but missing/undated in
//   auto-events is added or upgraded from the availability window.
//
// Run in the GitHub Action after fetch-data.js / merge steps.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "api", "events.json");

const BUILTIN = /^(subscriber|bits|moderator|broadcaster|vip|staff|admin|global_mod|turbo|premium|partner|no_audio|no_video|sub-gifter|sub-gift-leader|bits-leader|bits-charity|clip-cheer|hype-train|predictions|ambassador|artist-badge|extension|anonymous-cheerer|game-developer)$/i;

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

function loadAvailability() {
  try {
    const src = fs.readFileSync(path.join(ROOT, "availability-data.js"), "utf8");
    return new Function(`${src}; return BADGE_AVAILABILITY;`)();
  } catch { return {}; }
}

function availWindow(entry) {
  let start = null, end = null, win = null;
  for (const w of (entry && entry.avail) || []) {
    const s = w.start ? Date.parse(w.start) : NaN;
    const e = w.end ? Date.parse(w.end) : NaN;
    if (isNaN(s) || isNaN(e)) continue;
    if (start === null || s < start) start = s;
    if (end === null || e > end) end = e;
    if (!win) win = w;
  }
  return start !== null && end !== null ? { start, end, win } : null;
}

function requirementOf(w) {
  if (!w) return "See badge page";
  if (w.subscription || w.subscriptionGift) return "Sub or gift sub";
  if (w.watch) return w.watchMinutes ? `Watch ${w.watchMinutes} minutes` : "Watch to earn";
  if (w.bits) return "Cheer with Bits";
  if (w.twitchcon) return "Attend TwitchCon";
  return "See badge page";
}

function main() {
  const auto = readJson(path.join(ROOT, "api", "auto-events.json"), []);
  const badges = readJson(path.join(ROOT, "api", "global-badges.json"), { data: [] });
  const avail = loadAvailability();
  const now = Date.now();

  const out = [];
  const bySet = new Set();

  // Base: confirmed auto-events; confirm/upgrade undated ones from availability.
  for (const ev of auto) {
    const w = availWindow(avail[ev.badge.set]);
    let e = { ...ev };
    if ((e.confirmed === false || !e.start || !e.end) && w) {
      e.start = new Date(w.start).toISOString();
      e.end = new Date(w.end).toISOString();
      e.confirmed = true;
      if (!e.requirement || e.requirement === "TBA") e.requirement = requirementOf(w.win);
    }
    if (e.confirmed === false) continue; // still no dates — hide
    out.push(e);
    bySet.add(e.badge.set);
  }

  // Availability-only badges the detector never saw (current/upcoming only).
  for (const set of badges.data || []) {
    if (bySet.has(set.set_id) || BUILTIN.test(set.set_id)) continue;
    const w = availWindow(avail[set.set_id]);
    if (!w || w.end <= now) continue;
    const v = set.versions[0] || {};
    const cat = w.win.categories && w.win.categories[0] && w.win.categories[0].name;
    out.push({
      name: v.title || set.set_id,
      channel: cat || (w.win.twitchcon ? "TwitchCon" : "Twitch"),
      description: v.description || "",
      requirement: requirementOf(w.win),
      start: new Date(w.start).toISOString(),
      end: new Date(w.end).toISOString(),
      badge: { set: set.set_id, version: v.id || "1" },
      confirmed: true,
    });
    bySet.add(set.set_id);
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  console.log(`wrote api/events.json (${out.length} events)`);
}

main();
