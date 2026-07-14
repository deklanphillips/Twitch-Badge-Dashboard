// Discord announcements + scheduled events for badge & emote drops.
//
// Channels (each falls back to DISCORD_WEBHOOK_URL, and no-ops if unset):
//   Badges  (DISCORD_WEBHOOK_BADGES)  — "New badge added"
//   Events  (DISCORD_WEBHOOK_EVENTS)  — "Now live", with the Discord event +
//                                        Twitch links (falls back to badges).
//   Emotes  (DISCORD_WEBHOOK_EMOTES)  — "New emote added"
// Role pings: DISCORD_ROLE_BADGES / _EVENTS / _EMOTES.
//
// Native scheduled events (DISCORD_BOT_TOKEN + DISCORD_GUILD_ID; bot needs
// "Manage Events"): for each confirmed badge, creates/updates/deletes a Discord
// scheduled event. name = badge name, description = how to earn, location =
// the Twitch channel. Grouped campaigns (EWC) collapse into one event.
// Discord only allows a FUTURE start, so events are created for upcoming
// badges; already-live ones are handled by the "Now live" message.
//
// State lives in api/announced.json. Run after fetch-data.js.

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "api");
const FALLBACK = process.env.DISCORD_WEBHOOK_URL;
const WH_BADGES = process.env.DISCORD_WEBHOOK_BADGES || FALLBACK;
const WH_EVENTS = process.env.DISCORD_WEBHOOK_EVENTS || WH_BADGES;
const WH_EMOTES = process.env.DISCORD_WEBHOOK_EMOTES || FALLBACK;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const SITE = process.env.SITE_URL || "https://badgedrops.com";
const WATCH_URL = process.env.TWITCH_WATCH_URL || "https://www.twitch.tv/transforms";
const ROLE_BADGES = process.env.DISCORD_ROLE_BADGES || "1403074914562478241";
const ROLE_EMOTES = process.env.DISCORD_ROLE_EMOTES || "1445526534096945337";
const ROLE_EVENTS = process.env.DISCORD_ROLE_EVENTS || ROLE_BADGES;
const COLOR_NEW = 0x9147ff;
const COLOR_LIVE = 0x00c853;
const COLOR_EMOTE = 0xff9800;

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

const stamp = (iso) => (iso ? `<t:${Math.floor(Date.parse(iso) / 1000)}:F>` : null);
const howToEarn = (ev) => `How to earn: ${ev.requirement || "see badgedrops.com"}`;

function linkFor(ev) {
  return ev.group
    ? `${SITE}/group?id=${encodeURIComponent(ev.group)}`
    : `${SITE}/badge?set=${encodeURIComponent(ev.badge.set)}&version=${encodeURIComponent(ev.badge.version)}`;
}

function eventKey(ev) {
  return ev.group ? `group:${ev.group}` : `set:${ev.badge.set}`;
}

async function post(url, embed, roleId) {
  const payload = { username: "BadgeDrops", embeds: [embed] };
  if (roleId) {
    payload.content = `<@&${roleId}>`;
    payload.allowed_mentions = { parse: [], roles: [roleId] };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Discord webhook ${res.status}: ${await res.text()}`);
  await new Promise((r) => setTimeout(r, 500));
}

// Plain-content message (no embed) so a Discord event link unfurls into its card.
async function postContent(url, content, roleId) {
  const payload = { username: "BadgeDrops", content: roleId ? `<@&${roleId}> ${content}` : content };
  if (roleId) payload.allowed_mentions = { parse: [], roles: [roleId] };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Discord webhook ${res.status}: ${await res.text()}`);
  await new Promise((r) => setTimeout(r, 500));
}

async function discordApi(method, suffix, body) {
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/scheduled-events${suffix}`, {
    method,
    headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  await new Promise((r) => setTimeout(r, 600));
  return res;
}

// ---- Badges channel: newly added ----
async function runBadges(events, badges, announced) {
  if (!WH_BADGES) { console.log("No badges webhook — skipping new-badge messages"); return false; }
  const detected = new Set(announced.detected || []);
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
    await post(WH_BADGES, {
      title: `🆕 New badge added: ${ev.name}`,
      url: linkFor(ev),
      description: ev.description || howToEarn(ev),
      color: COLOR_NEW,
      thumbnail: img ? { url: img } : undefined,
      fields,
      footer: { text: "badgedrops.com" },
    }, ROLE_BADGES);
    console.log(`announced NEW badge: ${ev.name}`);
  }
  announced.detected = [...detected];
  return changed;
}

// ---- Events channel: badge goes live (StreamDatabase-style content message) ----
async function runLive(events, announced) {
  if (!WH_EVENTS) { console.log("No events webhook — skipping go-live messages"); return false; }
  const live = new Set(announced.live || []);
  const now = Date.now();
  let changed = false;
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

    const rec = (announced.events || {})[eventKey(ev)];
    const category = ev.channel || "—";
    const channels = ev.where && ev.where.type === "channel" ? ev.channel : "Any";
    const lines = [
      `Twitch global badge now available: **${ev.name}**`,
      "",
      "**Objective**",
      `- ${ev.requirement || "See badge page"}`,
      "",
      "**Category**",
      `- ${category}`,
      "",
      "**Channels**",
      `- ${channels}`,
    ];
    if (ev.end) {
      const u = Math.floor(end / 1000);
      lines.push("", `The event ends <t:${u}:F> (<t:${u}:R>)`);
    }
    lines.push("", "Good luck!");
    // A Discord event link unfurls into the event card; otherwise link the site.
    lines.push("", rec && rec.id && GUILD_ID
      ? `https://discord.com/events/${GUILD_ID}/${rec.id}`
      : linkFor(ev));

    await postContent(WH_EVENTS, lines.join("\n"), ROLE_EVENTS);
    console.log(`announced LIVE badge: ${ev.name}`);
  }
  announced.live = [...live];
  return changed;
}

// ---- Emotes channel ----
async function runEmotes(emotes, announced) {
  if (!WH_EMOTES) { console.log("No emotes webhook — skipping emote messages"); return false; }
  const seen = new Set(announced.emotes || []);
  let changed = false;
  for (const em of emotes.data || []) {
    if (seen.has(em.id)) continue;
    seen.add(em.id);
    changed = true;
    const img = em.images && (em.images.url_4x || em.images.url_2x || em.images.url_1x);
    await post(WH_EMOTES, {
      title: `😀 New emote added: ${em.name}`,
      url: `${SITE}/emote?id=${encodeURIComponent(em.id)}`,
      description: "A new global Twitch emote is now available to everyone.",
      color: COLOR_EMOTE,
      thumbnail: img ? { url: img } : undefined,
      footer: { text: "badgedrops.com" },
    }, ROLE_EMOTES);
    console.log(`announced NEW emote: ${em.name}`);
  }
  announced.emotes = [...seen];
  return changed;
}

// ---- Native scheduled events: create / update / delete ----
async function coverImage(badges, ref) {
  try {
    const src = badgeImage(badges, ref.set, ref.version);
    if (!src) return undefined;
    const r = await fetch(src);
    if (!r.ok) return undefined;
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:${r.headers.get("content-type") || "image/png"};base64,${buf.toString("base64")}`;
  } catch { return undefined; }
}

async function runScheduledEvents(events, badges, announced) {
  if (!BOT_TOKEN || !GUILD_ID) {
    console.log("DISCORD_BOT_TOKEN / DISCORD_GUILD_ID not set — skipping scheduled events");
    return false;
  }
  const now = Date.now();
  announced.events = announced.events || {};
  let changed = false;

  // One unit per badge/campaign.
  const units = new Map();
  for (const ev of events) {
    if (ev.confirmed === false || !ev.start || !ev.end) continue;
    const start = Date.parse(ev.start), end = Date.parse(ev.end);
    if (isNaN(start) || isNaN(end)) continue;
    const key = eventKey(ev);
    let u = units.get(key);
    if (!u) {
      units.set(key, {
        key, name: ev.group ? (ev.groupLabel || ev.name) : ev.name,
        start, end, requirement: ev.requirement || "see badgedrops.com",
        img: { set: ev.badge.set, version: ev.badge.version },
      });
    } else {
      u.start = Math.min(u.start, start);
      u.end = Math.max(u.end, end);
    }
  }

  // CREATE new + UPDATE changed
  for (const u of units.values()) {
    const rec = announced.events[u.key];
    if (!rec) {
      if (u.end <= now) continue; // already ended — no event to create
      // Discord requires a future start; for badges that are already live,
      // nudge the event start a couple minutes out so it can still be created.
      const startMs = u.start > now ? u.start : now + 2 * 60 * 1000;
      const image = await coverImage(badges, u.img);
      const body = {
        name: u.name.slice(0, 100),
        privacy_level: 2,
        scheduled_start_time: new Date(startMs).toISOString(),
        scheduled_end_time: new Date(u.end).toISOString(),
        entity_type: 3,
        entity_metadata: { location: WATCH_URL.slice(0, 100) },
        description: `How to earn: ${u.requirement}`.slice(0, 1000),
      };
      if (image) body.image = image;
      const res = await discordApi("POST", "", body);
      if (!res.ok) { console.error(`create failed ${u.name}: ${res.status} ${await res.text()}`); continue; }
      const created = await res.json();
      announced.events[u.key] = { id: created.id, start: u.start, end: u.end, name: u.name, requirement: u.requirement };
      changed = true;
      console.log(`created event: ${u.name} (${created.id})`);
    } else if (rec.start !== u.start || rec.end !== u.end || rec.name !== u.name || rec.requirement !== u.requirement) {
      const body = {
        name: u.name.slice(0, 100),
        entity_metadata: { location: WATCH_URL.slice(0, 100) },
        description: `How to earn: ${u.requirement}`.slice(0, 1000),
        scheduled_end_time: new Date(u.end).toISOString(),
      };
      // Only move the start if the event hasn't begun yet (Discord rejects otherwise).
      if (u.start > now) body.scheduled_start_time = new Date(u.start).toISOString();
      const res = await discordApi("PATCH", `/${rec.id}`, body);
      if (!res.ok) { console.error(`update failed ${u.name}: ${res.status} ${await res.text()}`); continue; }
      announced.events[u.key] = { id: rec.id, start: u.start, end: u.end, name: u.name, requirement: u.requirement };
      changed = true;
      console.log(`updated event: ${u.name} (${rec.id})`);
    }
  }

  // DELETE events whose badge is no longer a confirmed event (cancelled/removed)
  for (const key of Object.keys(announced.events)) {
    if (units.has(key)) continue;
    const rec = announced.events[key];
    const res = await discordApi("DELETE", `/${rec.id}`);
    if (res.ok || res.status === 404) {
      delete announced.events[key];
      changed = true;
      console.log(`deleted event: ${rec.name || key} (${rec.id})`);
    } else {
      console.error(`delete failed ${key}: ${res.status} ${await res.text()}`);
    }
  }

  return changed;
}

async function main() {
  const events = readJson("auto-events.json", []);
  const badges = readJson("global-badges.json", { data: [] });
  const emotes = readJson("global-emotes.json", { data: [] });
  const announced = readJson("announced.json", { detected: [], live: [], emotes: [], events: {} });

  // Scheduled events first, so "Now live" can link to the created event.
  const c = await runScheduledEvents(events, badges, announced);
  const a = await runBadges(events, badges, announced);
  const l = await runLive(events, announced);
  const b = await runEmotes(emotes, announced);

  if (a || b || c || l) {
    fs.writeFileSync(
      path.join(OUT_DIR, "announced.json"),
      JSON.stringify({
        detected: announced.detected || [],
        live: announced.live || [],
        emotes: announced.emotes || [],
        events: announced.events || {},
      }, null, 1) + "\n"
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
