// Discord announcements + scheduled events for badge drops.
//
// Webhook messages (needs DISCORD_WEBHOOK_URL):
//   1. "New badge added" — a badge first appears in api/auto-events.json
//   2. "Now live"        — a confirmed badge's start time has passed
//
// Scheduled events in the server's Events tab (needs DISCORD_BOT_TOKEN +
// DISCORD_GUILD_ID; bot must be in the guild with "Manage Events"):
//   3. Creates a native Discord scheduled event for each confirmed, UPCOMING
//      badge (grouped campaigns like EWC become a single event). Discord only
//      allows a future start time, so already-live badges are skipped here
//      (the "Now live" webhook covers those).
//
// State lives in api/announced.json so nothing is duplicated. Each capability
// no-ops if its env vars are unset, so the pipeline works without Discord.
//
// Run after fetch-data.js.

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "api");
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
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

async function postWebhook(embed) {
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "BadgeDrops", embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`Discord webhook ${res.status}: ${await res.text()}`);
  await new Promise((r) => setTimeout(r, 500)); // stay under rate limits
}

// ---- 1 & 2: webhook announcements ----
async function runWebhook(events, badges, announced) {
  if (!WEBHOOK) { console.log("DISCORD_WEBHOOK_URL not set — skipping webhook messages"); return false; }
  const detected = new Set(announced.detected || []);
  const live = new Set(announced.live || []);
  const now = Date.now();
  let changed = false;

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
    await postWebhook({
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

  for (const ev of events) {
    const key = ev.badge.set;
    if (ev.confirmed === false || !ev.start) continue;
    const start = Date.parse(ev.start);
    const end = ev.end ? Date.parse(ev.end) : null;
    if (isNaN(start) || start > now) continue;
    if (end !== null && end < now) continue;
    if (live.has(key)) continue;
    live.add(key);
    changed = true;
    const img = badgeImage(badges, ev.badge.set, ev.badge.version);
    await postWebhook({
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

  announced.detected = [...detected];
  announced.live = [...live];
  return changed;
}

// ---- 3: native Discord scheduled events (upcoming badges) ----
async function runScheduledEvents(events, badges, announced) {
  if (!BOT_TOKEN || !GUILD_ID) {
    console.log("DISCORD_BOT_TOKEN / DISCORD_GUILD_ID not set — skipping scheduled events");
    return false;
  }
  const now = Date.now();
  announced.events = announced.events || {};
  let changed = false;

  // Collapse grouped campaigns (EWC etc.) into a single event unit.
  const units = new Map();
  for (const ev of events) {
    if (ev.confirmed === false || !ev.start || !ev.end) continue;
    const start = Date.parse(ev.start), end = Date.parse(ev.end);
    if (isNaN(start) || isNaN(end)) continue;
    const key = ev.group ? `group:${ev.group}` : `set:${ev.badge.set}`;
    let u = units.get(key);
    if (!u) {
      units.set(key, {
        key,
        name: ev.group ? (ev.groupLabel || ev.name) : ev.name,
        start, end,
        link: linkFor(ev),
        description: ev.description || `Earn it by: ${ev.requirement || "see badgedrops.com"}`,
        img: { set: ev.badge.set, version: ev.badge.version },
      });
    } else {
      u.start = Math.min(u.start, start);
      u.end = Math.max(u.end, end);
    }
  }

  for (const u of units.values()) {
    if (announced.events[u.key]) continue; // already created
    if (u.start <= now || u.end <= now) continue; // Discord requires a future start

    let image;
    try {
      const src = badgeImage(badges, u.img.set, u.img.version);
      if (src) {
        const r = await fetch(src);
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          const ct = r.headers.get("content-type") || "image/png";
          image = `data:${ct};base64,${buf.toString("base64")}`;
        }
      }
    } catch { /* cover image is optional */ }

    const body = {
      name: u.name.slice(0, 100),
      privacy_level: 2, // GUILD_ONLY
      scheduled_start_time: new Date(u.start).toISOString(),
      scheduled_end_time: new Date(u.end).toISOString(),
      entity_type: 3, // EXTERNAL
      entity_metadata: { location: u.link.slice(0, 100) },
      description: u.description.slice(0, 1000),
    };
    if (image) body.image = image;

    const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/scheduled-events`, {
      method: "POST",
      headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`scheduled-event create failed for ${u.name}: ${res.status} ${await res.text()}`);
      continue;
    }
    const created = await res.json();
    announced.events[u.key] = created.id;
    changed = true;
    console.log(`created Discord scheduled event: ${u.name} (${created.id})`);
    await new Promise((r) => setTimeout(r, 600));
  }
  return changed;
}

async function main() {
  const events = readJson("auto-events.json", []);
  const badges = readJson("global-badges.json", { data: [] });
  const announced = readJson("announced.json", { detected: [], live: [], events: {} });

  const a = await runWebhook(events, badges, announced);
  const b = await runScheduledEvents(events, badges, announced);

  if (a || b) {
    fs.writeFileSync(
      path.join(OUT_DIR, "announced.json"),
      JSON.stringify(
        { detected: announced.detected || [], live: announced.live || [], events: announced.events || {} },
        null, 1
      ) + "\n"
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
