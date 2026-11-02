const params = new URLSearchParams(location.search);
const groupId = params.get("id");

const detail = document.getElementById("groupDetail");
const statusMessage = document.getElementById("statusMessage");
const breadcrumb = document.getElementById("breadcrumb");

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "long", day: "numeric", year: "numeric",
  hour: "numeric", minute: "2-digit",
});

// Requirement text from an availability window (same wording as elsewhere).
function reqFromAvail(w) {
  if (!w) return null;
  if (w.subscription || w.subscriptionGift) return "Sub or gift sub";
  if (w.watch) return w.watchMinutes ? `Watch ${w.watchMinutes} minutes` : "Watch to earn";
  if (w.bits) return "Cheer with Bits";
  if (w.twitchcon) return "Attend TwitchCon";
  return null;
}

async function load() {
  if (!groupId) {
    statusMessage.textContent = "No campaign specified.";
    return;
  }
  try {
    // Resolve members from ALL sources (curated, availability, auto-events) so a
    // campaign page works even after it has ended — unlike events.json, which
    // drops ended drops.
    const [autoEvents, badges] = await Promise.all([
      fetch("/api/auto-events.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      twitchData("/api/badges/global", "/api/global-badges.json").then((d) => d.data).catch(() => []),
    ]);
    const autoBySet = new Map(autoEvents.filter((e) => e.badge).map((e) => [e.badge.set, e]));
    const curated = typeof BADGE_EVENTS !== "undefined" ? BADGE_EVENTS : [];
    const avail = typeof BADGE_AVAILABILITY !== "undefined" ? BADGE_AVAILABILITY : {};

    // Every badge assigned to this campaign, from the curated/auto group maps
    // and from any group tag carried on an event.
    const memberSets = new Set();
    for (const map of [typeof BADGE_GROUPS !== "undefined" ? BADGE_GROUPS : null,
                       typeof AUTO_BADGE_GROUPS !== "undefined" ? AUTO_BADGE_GROUPS : null]) {
      if (!map) continue;
      for (const [set, gid] of Object.entries(map)) if (gid === groupId) memberSets.add(set);
    }
    for (const e of [...autoEvents, ...curated]) if (e.group === groupId && e.badge) memberSets.add(e.badge.set);

    if (!memberSets.size) throw new Error(`Campaign "${groupId}" not found.`);

    const catOf = (set) => badges.find((b) => b.set_id === set);
    const member = (set) => {
      const cat = catOf(set);
      const ver = cat && cat.versions[0];
      const ce = curated.find((e) => e.badge && e.badge.set === set);
      const ae = autoBySet.get(set);
      const aw = avail[set] && avail[set].avail && avail[set].avail.find((x) => x.start);
      return {
        name: (ce && ce.name) || (ae && ae.name) || (ver && ver.title) || set,
        start: (ce && ce.start) || (aw && aw.start) || (ae && ae.start) || null,
        end: (ce && ce.end) || (aw && aw.end) || (ae && ae.end) || null,
        requirement: (ce && ce.requirement) || reqFromAvail(aw) || (ae && ae.requirement) || "See badge page",
        description: (ce && ce.description) || (ae && ae.description) || (ver && ver.description) || "",
        badge: { set, version: ver ? ver.id : "1" },
        img: ver ? (ver.image_url_4x || ver.image_url_2x || ver.image_url_1x) : null,
      };
    };
    const members = [...memberSets].map(member)
      .sort((a, b) => Date.parse(a.start || 0) - Date.parse(b.start || 0));

    const label =
      (typeof GROUP_LABELS !== "undefined" && GROUP_LABELS[groupId]) ||
      (typeof AUTO_GROUP_LABELS !== "undefined" && AUTO_GROUP_LABELS[groupId]) ||
      (autoEvents.find((e) => e.group === groupId) || {}).groupLabel || groupId;
    document.title = `${label} — Twitch Badge Dashboard`;
    breadcrumb.textContent = `HOME / EVENTS / ${label.toUpperCase()}`;
    document.getElementById("groupHeading").textContent = label;

    // Span across all member windows.
    const starts = members.map((m) => Date.parse(m.start)).filter((n) => !isNaN(n));
    const ends = members.map((m) => (m.end ? Date.parse(m.end) : NaN)).filter((n) => !isNaN(n));
    const start = starts.length ? Math.min(...starts) : null;
    const end = ends.length ? Math.max(...ends) : null;
    document.getElementById("groupWindow").textContent = start
      ? `${dateFmt.format(new Date(start))} → ${end ? dateFmt.format(new Date(end)) : "ongoing"}`
      : "";

    const list = document.getElementById("tierList");
    for (const m of members) {
      const row = document.createElement("a");
      row.className = "group-tier";
      row.href = `/badge?set=${encodeURIComponent(m.badge.set)}&version=${encodeURIComponent(m.badge.version)}`;

      const icon = document.createElement("div");
      icon.className = "group-tier-icon";
      if (m.img) {
        const i = document.createElement("img");
        i.src = m.img;
        i.alt = m.name;
        icon.append(i);
      } else {
        const sp = document.createElement("span");
        sp.textContent = "✨";
        icon.append(sp);
      }

      const txt = document.createElement("div");
      txt.className = "group-tier-text";
      const h = document.createElement("h3");
      h.className = "group-tier-title";
      h.textContent = m.name;
      const p = document.createElement("p");
      p.className = "group-tier-desc";
      p.textContent = m.description || m.requirement;
      txt.append(h, p);

      row.append(icon, txt);
      list.append(row);
    }

    statusMessage.hidden = true;
    detail.hidden = false;
  } catch (err) {
    statusMessage.textContent = `Couldn't load campaign: ${err.message}`;
  }
}

load();
