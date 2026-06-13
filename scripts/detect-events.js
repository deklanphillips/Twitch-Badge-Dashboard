// Detects newly-appeared global badges by diffing the freshly fetched catalog
// against the previously saved one, then auto-generates Events-timeline entries
// for the new badges (start = first seen now; requirement + category parsed
// from the badge description). Persisted to api/auto-events.json so events stay
// on the site permanently, even after Twitch later changes the catalog.

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "api");

// Built-in / non-event badges that should never become timeline events.
const BUILTIN_SETS = new Set([
  "broadcaster", "moderator", "subscriber", "sub-gifter", "sub-gift-leader",
  "bits", "bits-leader", "bits-charity", "clip-cheer", "turbo", "partner",
  "premium", "staff", "admin", "global_mod", "hype-train", "predictions",
  "moments", "no_audio", "no_video", "vip", "ambassador", "twitchcon",
  "artist-badge", "bot-badge", "anonymous-cheerer", "extension",
  "game-developer-conference", "twitch-recap-2023",
]);
const SKIP_SET_RE = /staff|leader|clips?-|twitchiversary|intern|social-media|anniversary-as/i;

function isSkippable(setId, desc) {
  if (BUILTIN_SETS.has(setId)) return true;
  if (SKIP_SET_RE.test(setId)) return true;
  if (/twitchcon/i.test(setId) && !setId.includes("2026")) return true;
  if (/\bdonat|charity|for good\b/i.test(desc)) return true;
  return false;
}

// Pull a game/category name out of the badge description, mirroring badge.js.
function parseCategory(desc) {
  const m =
    desc.match(/\bin the (.+?) category\b/i) ||
    desc.match(/\bin the ([^,.!?]+?) game\b/i) ||
    desc.match(/\bto an? ([^,.!?]+?) streamer/i) ||
    desc.match(/\b(?:playing|watching) (?:\d+ (?:minutes?|hours?) of )?([^,.!?]+?)(?: during| at| on| in\b| streams?\b|[,.!?]|$)/i);
  if (!m) return null;
  const name = m[1].trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { name, url: `https://www.twitch.tv/directory/category/${slug}` };
}

function parseRequirement(desc) {
  const d = desc.toLowerCase();
  const watch = d.match(/(\d+)\s*(minutes?|hours?)/);
  if (/\bsub|gift/.test(d)) return "Sub or gift sub";
  if (/\bbits?\b/.test(d)) return "Cheer bits";
  if (watch) return `Watch ${watch[1]} ${watch[2]}`;
  if (/\bwatch/.test(d)) return "Watch to earn";
  return null;
}

// Returns { added: [...newEvents], events: [...allAutoEvents] }
function detectNewEvents(previousBadges, currentBadges) {
  const knownSets = new Set((previousBadges?.data || []).map((s) => s.set_id));

  const autoPath = path.join(OUT_DIR, "auto-events.json");
  let autoEvents = [];
  try { autoEvents = JSON.parse(fs.readFileSync(autoPath, "utf8")); } catch {}
  const haveEvent = new Set(autoEvents.map((e) => e.badge && e.badge.set));

  const added = [];
  const nowIso = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  for (const set of currentBadges.data || []) {
    if (knownSets.has(set.set_id)) continue;     // not new since last run
    if (haveEvent.has(set.set_id)) continue;     // already recorded
    const version = set.versions[0];
    if (!version) continue;
    const desc = version.description || "";
    if (isSkippable(set.set_id, desc)) continue;

    const requirement = parseRequirement(desc);
    const category = parseCategory(desc);
    // Only treat as a drop event if it looks earnable (has a requirement or category).
    if (!requirement && !category) continue;

    const event = {
      name: version.title || set.set_id,
      channel: category ? category.name : "Twitch",
      description: desc,
      emoji: "✨",
      requirement: requirement || "See badge page",
      start: nowIso,
      end: null, // unknown — Twitch doesn't expose end dates; stays open-ended
      badge: { set: set.set_id, version: version.id },
      auto: true,
    };
    if (category) {
      event.where = { type: "category", label: `${category.name} category`, url: category.url };
    }
    autoEvents.push(event);
    added.push(event);
  }

  if (added.length) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(autoPath, JSON.stringify(autoEvents, null, 1));
  }
  return { added, events: autoEvents };
}

module.exports = { detectNewEvents, parseCategory, parseRequirement, isSkippable };
