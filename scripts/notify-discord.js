// Sends Discord announcements for badge drops via a webhook. Two triggers:
//   1. "New badge added"  — a badge first appears in api/auto-events.json
//   2. "Now live"         — a confirmed badge's start time has passed
//
// State is tracked in api/announced.json (committed by the Action) so each
// badge is announced at most once per trigger. No-ops if DISCORD_WEBHOOK_URL
// is unset, so the pipeline still works without Discord configured.
//
// Run after fetch-data.js:  DISCORD_WEBHOOK_URL=... node scripts/notify-discord.js

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "api");
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const SITE = process.env.SITE_URL || "https://badgedrops.com";
const COLOR_NEW = 0x9147ff;  // purple
const COLOR_LIVE = 0x00c853; // green

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(OUT_DIR, file), "utf8")); }
  catch { return fallback; }
}

function badgeImage(badges, set, version) {
  const s = (badges.data || []).find((b) => b.set_id === set);
  if (!s) return null;
  const v = s.versions.find((x) => x.id === version) || s.versions[0];
  return v ? (v.image_url_4x || v.image_url_2x || v.image_url_1x) : null;
}

// Discord renders <t:unix:F> in each viewer's own timezone.
const stamp = (iso) => (iso ? `<t:${Math.floor(Date.parse(iso) / 1000)}:F>` : null);

function linkFor(ev) {
  return ev.group
    ? `${SITE}/group?id=${encodeURIComponent(ev.group)}`
    : `${SITE}/badge?set=${encodeURIComponent(ev.badge.set)}&version=${encodeURIComponent(ev.badge.version)}`;
}

async function post(embed) {
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "BadgeDrops", embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`Discord webhook ${res.status}: ${await res.text()}`);
  await new Promise((r) => setTimeout(r, 500)); // stay under Discord rate limits
}

async function main() {
  if (!WEBHOOK) {
    console.log("DISCORD_WEBHOOK_URL not set — skipping Discord notifications");
    return;
  }

  const events = readJson("auto-events.json", []);
  const badges = readJson("global-badges.json", { data: [] });
  const announced = readJson("announced.json", { detected: [], live: [] });
  const detected = new Set(announced.detected || []);
  const live = new Set(announced.live || []);
  const now = Date.now();
  let changed = false;

  // 1) Newly detected badges (announce once per set, incl. unconfirmed).
  for (const ev of events) {
    const key = ev.badge.set;
    if (detected.has(key)) continue;
    detected.add(key);
    changed = true;
    const img = badgeImage(badges, ev.badge.set, ev.badge.version);
    const fields = [];
    if (ev.confirmed && ev.start) fields.push({ name: "Starts", value: stamp(ev.start), inline: true });
    if (ev.confirmed && ev.end) fields.push({ name: "Ends", value: stamp(ev.end), inline: true });
    if (!ev.confirmed) fields.push({ name: "Dates", value: "TBA", inline: true });
    await post({
      title: `🆕 New badge added: ${ev.name}`,
      url: linkFor(ev),
      description: ev.description || `Earn it by: ${ev.requirement || "see badge page"}`,
      color: COLOR_NEW,
      thumbnail: img ? { url: img } : undefined,
      fields,
      footer: { text: "badgedrops.com" },
    });
    console.log(`announced NEW: ${ev.name}`);
  }

  // 2) Confirmed badges whose start has passed and haven't ended (announce once).
  for (const ev of events) {
    const key = ev.badge.set;
    if (ev.confirmed === false || !ev.start) continue;
    const start = Date.parse(ev.start);
    const end = ev.end ? Date.parse(ev.end) : null;
    if (isNaN(start) || start > now) continue;   // not started yet
    if (end !== null && end < now) continue;      // already ended
    if (live.has(key)) continue;
    live.add(key);
    changed = true;
    const img = badgeImage(badges, ev.badge.set, ev.badge.version);
    await post({
      title: `🔴 Now live: ${ev.name}`,
      url: linkFor(ev),
      description: `**How to earn:** ${ev.requirement || "See badge page"}`,
      color: COLOR_LIVE,
      thumbnail: img ? { url: img } : undefined,
      fields: ev.end ? [{ name: "Available until", value: stamp(ev.end) }] : [],
      footer: { text: "badgedrops.com" },
    });
    console.log(`announced LIVE: ${ev.name}`);
  }

  if (changed) {
    fs.writeFileSync(
      path.join(OUT_DIR, "announced.json"),
      JSON.stringify({ detected: [...detected], live: [...live] }, null, 1) + "\n"
    );
    console.log("updated announced.json");
  } else {
    console.log("no new announcements");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
