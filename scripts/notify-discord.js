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

async function discordApi(method, suffix, body, attempt = 0) {
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/scheduled-events${suffix}`, {
    method,
    headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  // Respect Discord rate limits: on 429, wait retry_after and try again.
  if (res.status === 429 && attempt < 6) {
    const info = await res.clone().json().catch(() => ({}));
    const wait = Math.ceil((info.retry_after || 1) * 1000) + 300;
    await new Promise((r) => setTimeout(r, wait));
    return discordApi(method, suffix, body, attempt + 1);
  }
  await new Promise((r) => setTimeout(r, 600));
  return res;
}

// ---- Availability data (merged from StreamDatabase HTML) ----
// auto-events.json only gets confirmed dates when Twitch's API exposes them;
// most dates arrive via the StreamDatabase merge into availability-data.js.
// Read that too so those badges still get scheduled events + go-live posts.
function loadAvailability() {
  try {
    const src = fs.readFileSync(path.join(__dirname, "..", "availability-data.js"), "utf8");
    return new Function(`${src}; return BADGE_AVAILABILITY;`)();
  } catch { return {}; }
}

// Overall window across a badge's availability entries: earliest start → latest end.
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

function availRequirement(w) {
  if (!w) return null;
  if (w.subscription || w.subscriptionGift) return "Sub or gift sub";
  if (w.watch) return w.watchMinutes ? `Watch ${w.watchMinutes} minutes` : "Watch to earn";
  if (w.bits) return "Cheer with Bits";
  if (w.twitchcon) return "Attend TwitchCon";
  return null;
}

// Confirm unconfirmed auto-events from availability dates, and synthesize
// events for catalog badges that have dates but were never auto-detected
// (e.g. badges that existed before detection started). Mutates/extends events.
function enrichEvents(events, badges, avail) {
  const now = Date.now();
  const bySet = new Set(events.map((e) => e.badge.set));

  for (const ev of events) {
    if (ev.confirmed !== false && ev.start && ev.end) continue;
    const w = availWindow(avail[ev.badge.set]);
    if (!w) continue;
    ev.start = new Date(w.start).toISOString();
    ev.end = new Date(w.end).toISOString();
    ev.confirmed = true;
    if (!ev.requirement || ev.requirement === "TBA") ev.requirement = availRequirement(w.win) || ev.requirement;
    console.log(`confirmed from availability: ${ev.name}`);
  }

  for (const set of badges.data || []) {
    if (bySet.has(set.set_id) || BUILTIN_BADGE.test(set.set_id)) continue;
    const w = availWindow(avail[set.set_id]);
    if (!w || w.end <= now) continue; // only current/upcoming windows matter
    const v = set.versions[0] || {};
    const cat = w.win.categories && w.win.categories[0] && w.win.categories[0].name;
    events.push({
      name: v.title || set.set_id,
      channel: cat || (w.win.twitchcon ? "TwitchCon" : "Twitch"),
      description: v.description || "",
      requirement: availRequirement(w.win) || "See badge page",
      start: new Date(w.start).toISOString(),
      end: new Date(w.end).toISOString(),
      badge: { set: set.set_id, version: v.id || "1" },
      confirmed: true,
    });
    console.log(`event from availability: ${v.title || set.set_id}`);
  }
  return events;
}

// Built-in / system badges that shouldn't announce (they never really "arrive").
const BUILTIN_BADGE = /^(subscriber|bits|moderator|broadcaster|vip|staff|admin|global_mod|turbo|premium|partner|no_audio|no_video|sub-gifter|sub-gift-leader|bits-leader|bits-charity|clip-cheer|hype-train|predictions|ambassador|artist-badge|extension|anonymous-cheerer|game-developer)$/i;

// ---- Badges channel: any badge newly added to the catalog (the site) ----
async function runBadges(events, badges, announced) {
  if (!WH_BADGES) { console.log("No badges webhook — skipping new-badge messages"); return false; }
  const detected = new Set(announced.detected || []);
  const autoBySet = new Map((events || []).map((e) => [e.badge.set, e]));
  let changed = false;
  for (const set of badges.data || []) {
    const key = set.set_id;
    if (detected.has(key)) continue;
    detected.add(key);            // track everything so it only announces once
    if (BUILTIN_BADGE.test(key)) { changed = true; continue; } // skip system badges
    changed = true;

    const v = set.versions[0] || {};
    const ev = autoBySet.get(key); // richer info if it's a known drop/event
    const name = (ev && ev.name) || v.title || key;
    const img = v.image_url_4x || v.image_url_2x || v.image_url_1x;
    const url = ev ? linkFor(ev) : `${SITE}/badge?set=${encodeURIComponent(key)}&version=${encodeURIComponent(v.id || "1")}`;
    const fields = [];
    if (ev && ev.confirmed && ev.start) fields.push({ name: "Starts", value: stamp(ev.start), inline: true });
    if (ev && ev.confirmed && ev.end) fields.push({ name: "Ends", value: stamp(ev.end), inline: true });
    await post(WH_BADGES, {
      title: `🆕 New badge added: ${name}`,
      url,
      description: (ev && ev.description) || v.description || "A new Twitch global badge is now available.",
      color: COLOR_NEW,
      thumbnail: img ? { url: img } : undefined,
      fields,
      footer: { text: "badgedrops.com" },
    }, ROLE_BADGES);
    console.log(`announced NEW badge: ${name}`);
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
        // Use the badge's own description (as shown on the detail page); fall
        // back to a short "How to earn" line only when there's no description.
        description: ev.description || `How to earn: ${ev.requirement || "see badgedrops.com"}`,
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
        description: u.description.slice(0, 1000),
      };
      if (image) body.image = image;
      const res = await discordApi("POST", "", body);
      if (!res.ok) { console.error(`create failed ${u.name}: ${res.status} ${await res.text()}`); continue; }
      const created = await res.json();
      announced.events[u.key] = { id: created.id, start: u.start, end: u.end, name: u.name, requirement: u.requirement, description: u.description };
      changed = true;
      console.log(`created event: ${u.name} (${created.id})`);
    } else if (rec.start !== u.start || rec.end !== u.end || rec.name !== u.name || rec.requirement !== u.requirement || rec.description !== u.description) {
      const body = {
        name: u.name.slice(0, 100),
        entity_metadata: { location: WATCH_URL.slice(0, 100) },
        description: u.description.slice(0, 1000),
        scheduled_end_time: new Date(u.end).toISOString(),
      };
      // Only move the start if the event hasn't begun yet (Discord rejects otherwise).
      if (u.start > now) body.scheduled_start_time = new Date(u.start).toISOString();
      const res = await discordApi("PATCH", `/${rec.id}`, body);
      if (!res.ok) { console.error(`update failed ${u.name}: ${res.status} ${await res.text()}`); continue; }
      announced.events[u.key] = { id: rec.id, start: u.start, end: u.end, name: u.name, requirement: u.requirement, description: u.description };
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
  const badges = readJson("global-badges.json", { data: [] });
  const events = enrichEvents(readJson("auto-events.json", []), badges, loadAvailability());
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
