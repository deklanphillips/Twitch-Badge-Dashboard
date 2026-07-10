const params = new URLSearchParams(location.search);
const groupId = params.get("id");

const detail = document.getElementById("groupDetail");
const statusMessage = document.getElementById("statusMessage");
const breadcrumb = document.getElementById("breadcrumb");

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "long", day: "numeric", year: "numeric",
  hour: "numeric", minute: "2-digit",
});

async function load() {
  if (!groupId) {
    statusMessage.textContent = "No campaign specified.";
    return;
  }
  try {
    const [events, badges] = await Promise.all([
      fetch("/api/auto-events.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      twitchData("/api/badges/global", "/api/global-badges.json").then((d) => d.data).catch(() => []),
    ]);

    const members = events.filter((e) => e.group === groupId);
    if (!members.length) throw new Error(`Campaign "${groupId}" not found.`);

    const label = members[0].groupLabel || groupId;
    document.title = `${label} — Twitch Badge Dashboard`;
    breadcrumb.textContent = `HOME / EVENTS / ${label.toUpperCase()}`;
    document.getElementById("groupHeading").textContent = label;

    // Span across all member windows.
    const starts = members.map((m) => Date.parse(m.start)).filter((n) => !isNaN(n));
    const ends = members.map((m) => (m.end ? Date.parse(m.end) : NaN)).filter((n) => !isNaN(n));
    const start = Math.min(...starts);
    const end = ends.length ? Math.max(...ends) : null;
    document.getElementById("groupWindow").textContent =
      `${dateFmt.format(new Date(start))} → ${end ? dateFmt.format(new Date(end)) : "ongoing"}`;

    const imgFor = (set) => {
      const s = badges.find((b) => b.set_id === set);
      const v = s && s.versions[0];
      return v ? (v.image_url_4x || v.image_url_2x || v.image_url_1x) : null;
    };

    const list = document.getElementById("tierList");
    for (const m of members) {
      const row = document.createElement("a");
      row.className = "group-tier";
      row.href = `/badge?set=${encodeURIComponent(m.badge.set)}&version=${encodeURIComponent(m.badge.version)}`;

      const icon = document.createElement("div");
      icon.className = "group-tier-icon";
      const src = imgFor(m.badge.set);
      if (src) {
        const i = document.createElement("img");
        i.src = src;
        i.alt = m.name;
        icon.append(i);
      } else {
        const sp = document.createElement("span");
        sp.textContent = m.emoji || "✨";
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
    statusMessage.textContent = err.message.includes("TWITCH_CLIENT_ID")
      ? "Server isn't connected to Twitch yet — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and restart (see README)."
      : `Couldn't load campaign: ${err.message}`;
  }
}

load();
