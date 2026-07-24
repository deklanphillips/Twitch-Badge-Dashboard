// Non-destructive merge of a StreamDatabase global-badges HTML snapshot into
// availability-data.js. Only adds NEW badges and updates badges whose data
// actually CHANGED; every unchanged entry is left exactly as-is (same order,
// same formatting), so git shows a minimal diff.
//
// Usage:  node scripts/merge-availability.js path/to/snapshot.html
//
// Re-run after uploading a fresh snapshot. Manual edits to unchanged badges
// are preserved because we never touch entries that match the snapshot.

const fs = require("fs");
const path = require("path");

const SKIP = /staff|leader|clips?-|twitchiversary|intern|social-media|moderator|subscriber|bits|broadcaster|predictions|hype-train|no_audio|no_video|prime|turbo|partner/i;

function parseSnapshot(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find __NEXT_DATA__ in HTML.");
  const data = JSON.parse(m[1]);
  const findKey = (o, key) => {
    if (!o || typeof o !== "object") return null;
    if (key in o) return o[key];
    for (const k in o) { const r = findKey(o[k], key); if (r) return r; }
    return null;
  };
  // Two export shapes are supported:
  //   Global Badges page: props...twitchGlobalBadges = [{current, availability}]
  //   Events page:        props...initialData = [{ ..., twitch_global_badges }]
  // For the Events shape, flatten to badges and merge windows for badges that
  // appear across multiple events (e.g. multi-phase drops).
  let arr = findKey(data.props, "twitchGlobalBadges");
  if (!arr) {
    // The Events export has been shipped under a few key names over time:
    // initialData (older) and initialEvents (current).
    const events = findKey(data.props, "initialData") || findKey(data.props, "initialEvents");
    if (!events) throw new Error("Neither twitchGlobalBadges, initialData, nor initialEvents found in snapshot.");
    const byId = new Map();
    for (const ev of events) {
      for (const b of ev.twitch_global_badges || []) {
        const id = b.current && b.current.set_id;
        if (!id) continue;
        if (!byId.has(id)) {
          byId.set(id, { current: b.current, availability: [...(b.availability || [])], history: b.history || [] });
        } else {
          const seen = byId.get(id);
          for (const a of b.availability || []) {
            const dup = seen.availability.some((x) => x.start_at_date === a.start_at_date && x.end_at_date === a.end_at_date);
            if (!dup) seen.availability.push(a);
          }
        }
      }
    }
    arr = [...byId.values()];
  }

  const out = {};
  for (const b of arr) {
    const set_id = b.current.set_id;
    if (SKIP.test(set_id)) continue;
    const added = (b.history || [])[0]?.timestamp || null;
    const entry = { added };
    if (b.availability && b.availability.length) {
      entry.avail = b.availability.map((a) => {
        const o = {
          start: a.start_at_date ? a.start_at_date + "T" + (a.start_at_time || "00:00:00").replace(".000", "") + "Z" : null,
          end: a.end_at_date ? a.end_at_date + "T" + (a.end_at_time || "23:59:59").replace(".999", "") + "Z" : null,
          subscription: !!a.subscription, subscriptionGift: !!a.subscription_gift,
          bits: !!a.bits, watch: !!a.watch, watchMinutes: a.watch_minutes || 0,
          clip: !!a.clip, turbo: !!a.turbo, twitchcon: !!a.twitchcon,
        };
        const cats = (a.categories || []).map((c) => ({ name: c.game?.name || c.category?.name || "", href: c.href || "" })).filter((c) => c.name);
        if (cats.length) o.categories = cats;
        const chans = (a.channels || []).map((c) => ({ name: c.user?.display_name || c.user?.login || "", href: "https://www.twitch.tv/" + (c.user?.login || "") })).filter((c) => c.name);
        // EWC lists ~1,387 eligible channels per tier — don't store them all;
        // flag it so the detail page links to our own stream instead. Every
        // other badge keeps its normal channel list.
        if (chans.length) {
          if (/^ewc-2026-/i.test(set_id)) o.broadChannels = true;
          else o.channels = chans;
        }
        return o;
      // Drop empty windows (no dates, no categories, no channels) — sparse
      // exports emit these and they carry no information worth merging.
      }).filter((o) => o.start || o.categories || o.channels);
      if (!entry.avail.length) delete entry.avail;
    }
    out[set_id] = entry;
  }
  return out;
}

function main() {
  const htmlPath = process.argv[2];
  if (!htmlPath) { console.error("Usage: node scripts/merge-availability.js <snapshot.html>"); process.exit(1); }

  const dataPath = path.join(__dirname, "..", "availability-data.js");
  delete require.cache[require.resolve(dataPath)];
  // availability-data.js declares `const BADGE_AVAILABILITY = {...}` with no export.
  const src = fs.readFileSync(dataPath, "utf8");
  const current = eval("(" + src.replace(/^[\s\S]*?const BADGE_AVAILABILITY\s*=\s*/, "").replace(/;\s*$/, "") + ")");

  const snapshot = parseSnapshot(htmlPath);

  // Field-preserving merge: take fresh dates/flags from the snapshot, but keep
  // existing categories/channels when the snapshot doesn't carry them (some
  // exports, e.g. the Global Badges page, omit that detail — we must not wipe
  // it). Matches avail entries by index (badges almost always have one).
  function mergeEntry(existing, incoming) {
    if (!incoming.avail) {
      // Snapshot has no window; never downgrade a richer existing entry.
      return existing && existing.avail ? existing : incoming;
    }
    const out = { ...incoming };
    out.avail = incoming.avail.map((a, i) => {
      const old = existing && existing.avail && existing.avail[i];
      const m = { ...a };
      if (!old) return m;
      // Prefer the snapshot's value, but never overwrite a real existing value
      // with an empty one (sparse exports omit dates/minutes/channels).
      if (!m.start && old.start) m.start = old.start;
      if (!m.end && old.end) m.end = old.end;
      if (!m.watchMinutes && old.watchMinutes) m.watchMinutes = old.watchMinutes;
      if ((!m.categories || !m.categories.length) && old.categories && old.categories.length) m.categories = old.categories;
      // Don't retain an old channel list when the new window is broad-channel
      // (thousands of eligible channels) — that campaign links to our stream.
      if (!m.broadChannels && (!m.channels || !m.channels.length) && old.channels && old.channels.length) m.channels = old.channels;
      return m;
    });
    return out;
  }

  const added = [], updated = [];
  const merged = { ...current };
  const sortedKeys = Object.keys(snapshot).sort();
  for (const set_id of sortedKeys) {
    const incoming = snapshot[set_id];
    const existing = current[set_id];
    if (!existing) {
      // Don't add brand-new badges that carry no window (dates/categories/
      // channels) — an empty {added} entry adds nothing and would shadow the
      // auto-events availability on the detail page.
      if (!incoming.avail) continue;
      merged[set_id] = incoming;
      added.push(set_id);
    } else {
      const result = mergeEntry(existing, incoming);
      if (JSON.stringify(existing) !== JSON.stringify(result)) {
        merged[set_id] = result;
        updated.push(set_id);
      }
    }
    // identical -> leave untouched
  }

  if (!added.length && !updated.length) {
    console.log("No changes — every badge already up to date.");
    return;
  }

  const fmt = (obj) => Object.entries(obj)
    .map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v, null, 2).split("\n").join("\n ")}`)
    .join(",\n");
  fs.writeFileSync(dataPath,
    `// Twitch global badge availability data (dates, earn methods, categories).\n` +
    `// Generated from a community-tracked snapshot; regenerate by re-importing a\n` +
    `// newer snapshot. Keyed by badge set_id.\nconst BADGE_AVAILABILITY = {\n${fmt(merged)}\n};\n`);

  console.log(`Added ${added.length}:`, added.join(", ") || "(none)");
  console.log(`Updated ${updated.length}:`, updated.join(", ") || "(none)");
}

main();
