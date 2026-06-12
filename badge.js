const params = new URLSearchParams(location.search);
const setId = params.get("set");
const versionId = params.get("version");

const detail = document.getElementById("badgeDetail");
const statusMessage = document.getElementById("statusMessage");
const breadcrumb = document.getElementById("breadcrumb");

function field(label, value) {
  const wrap = document.createElement("div");
  wrap.className = "detail-field";
  const l = document.createElement("p");
  l.className = "detail-label";
  l.textContent = label;
  const v = document.createElement("p");
  v.className = "detail-value";
  v.textContent = value || "N/A";
  wrap.append(l, v);
  return wrap;
}

function chip(text, muted = false) {
  const el = document.createElement("span");
  el.className = muted ? "avail-chip muted" : "avail-chip";
  el.textContent = text;
  return el;
}

function availRow(label, value) {
  const row = document.createElement("div");
  row.className = "avail-row";
  const l = document.createElement("p");
  l.className = "detail-label";
  l.textContent = label;
  const v = document.createElement("p");
  v.className = "detail-value";
  v.textContent = value;
  row.append(l, v);
  return row;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "long", day: "numeric", year: "numeric",
  hour: "numeric", minute: "2-digit",
});

async function load() {
  if (!setId || !versionId) {
    statusMessage.textContent = "No badge specified.";
    return;
  }

  try {
    const res = await fetch("/api/badges/global");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

    const set = data.data.find((s) => s.set_id === setId);
    if (!set) throw new Error(`Badge set "${setId}" not found.`);

    const version = set.versions.find((v) => v.id === versionId);
    if (!version) throw new Error(`Version "${versionId}" not found in set "${setId}".`);

    breadcrumb.textContent = `HOME / TWITCH / GLOBAL-BADGES / ${setId.toUpperCase()} / ${versionId}`;
    document.title = `${version.title || setId} — Twitch Badge Dashboard`;

    // Size previews
    const sizePreviews = document.getElementById("sizePreviews");
    for (const [label, url] of [
      ["1x", version.image_url_1x],
      ["2x", version.image_url_2x],
      ["4x", version.image_url_4x],
    ]) {
      if (!url) continue;
      const wrap = document.createElement("div");
      wrap.className = "size-wrap";
      const img = document.createElement("img");
      img.src = url;
      img.alt = `${version.title} ${label}`;
      img.className = `badge-preview-${label.replace("x", "")}`;
      const lbl = document.createElement("span");
      lbl.textContent = label.toUpperCase();
      wrap.append(img, lbl);
      sizePreviews.append(wrap);
    }

    // Metadata fields
    const detailFields = document.getElementById("detailFields");
    detailFields.append(
      field("Title", version.title),
      field("Description", version.description),
      field("Set ID", set.set_id),
      field("Version ID", version.id),
      field("Click Action", version.click_action),
      field("Click URL", version.click_url),
    );

    // Match against local event data
    const eventInfo = document.getElementById("eventInfo");
    const matchedEvents = typeof BADGE_EVENTS !== "undefined"
      ? BADGE_EVENTS.filter((e) =>
          e.name.toLowerCase().includes((version.title || "").toLowerCase()) ||
          (version.description || "").toLowerCase().includes(e.name.toLowerCase())
        )
      : [];

    // Availability section — from matched event if any, otherwise show API data
    const availSection = document.createElement("div");
    availSection.className = "avail-section";
    const availTitle = document.createElement("h2");
    availTitle.className = "section-heading";
    availTitle.textContent = "Availability";
    availSection.append(availTitle);

    if (matchedEvents.length) {
      for (const ev of matchedEvents) {
        const start = new Date(ev.start);
        const end = new Date(ev.end);
        const chips = document.createElement("div");
        chips.className = "avail-chips";
        chips.append(chip(`From: ${dateFmt.format(start)}`), chip(`To: ${dateFmt.format(end)}`));
        availSection.append(chips);

        // Where to earn: link to the Twitch category or specific streamer
        if (ev.where) {
          const whereWrap = document.createElement("div");
          whereWrap.className = "where-earn";
          const whereLabel = document.createElement("p");
          whereLabel.className = "detail-label";
          whereLabel.textContent = ev.where.type === "channel" ? "Earned on channel" : "Earned in";
          const whereLink = document.createElement("a");
          whereLink.className = "where-link";
          whereLink.href = ev.where.url;
          whereLink.target = "_blank";
          whereLink.rel = "noopener";
          whereLink.textContent = `${ev.where.label} ↗`;
          whereWrap.append(whereLabel, whereLink);
          availSection.append(whereWrap);
        }

        const grid = document.createElement("div");
        grid.className = "avail-grid";

        const requirement = ev.requirement.toLowerCase();
        const isWatch = requirement.includes("watch");
        const isBits = requirement.includes("bit");
        const isSub = requirement.includes("sub") || requirement.includes("gift");

        grid.append(
          availRow("Subscription", isSub ? `Yes` : "No"),
          availRow("Subscription (Prime)", "No"),
          availRow("Subscription (Gift)", isSub ? "Yes" : "No"),
          availRow("Bits", isBits ? "Yes" : "No"),
          availRow("Watch", isWatch ? `Yes — ${ev.requirement}` : "No"),
          availRow("Clip", "No"),
          availRow("Turbo", "No"),
          availRow("TwitchCon", "No"),
        );

        if (ev.description) {
          const ctxSection = document.createElement("div");
          ctxSection.className = "avail-section ctx-section";
          const ctxTitle = document.createElement("h2");
          ctxTitle.className = "section-heading";
          ctxTitle.textContent = "Context";
          const ctxBody = document.createElement("p");
          ctxBody.className = "ctx-body";
          ctxBody.textContent = ev.description;
          ctxSection.append(ctxTitle, ctxBody);
          availSection.append(grid, ctxSection);
        } else {
          availSection.append(grid);
        }
      }
    } else {
      // No local event match — show a generic availability note from description
      const note = document.createElement("p");
      note.className = "ctx-body";
      note.textContent = version.description
        ? version.description
        : "No availability details found for this badge. Add an entry to data.js to enrich this page.";
      availSection.append(note);

      // Fallback: parse the category name from the Twitch description, or skip
      // entirely for built-in badges that don't relate to a game/category.
      const BUILTIN_SETS = new Set([
        "broadcaster", "moderator", "subscriber", "sub-gifter", "sub-gift-leader",
        "bits", "bits-leader", "bits-charity", "clip-cheer", "turbo", "partner",
        "premium", "staff", "admin", "global_mod", "hype-train", "predictions",
        "moments", "no_audio", "no_video", "vip", "ambassador", "twitchcon",
        "overwatch-league-2019", "game-developer-conference", "twitch-recap-2023",
      ]);

      // TwitchCon badges are skipped except 2026, which is still earnable by
      // buying a TwitchCon ticket.
      const isOldTwitchCon = /twitchcon/i.test(set.set_id) && !set.set_id.includes("2026");
      const desc = version.description || "";
      // Donation/charity badges aren't tied to a game category either.
      const isDonation = /\bdonat|charity|for good\b/i.test(desc);
      if (!BUILTIN_SETS.has(set.set_id) && !/staff|leader|clips?-|twitchiversary|intern/i.test(set.set_id) && !isOldTwitchCon && !isDonation) {
        // Try to extract the category name from common description phrasings:
        // "in the X category" / "in the X game" / "to a(n) X streamer"
        const catMatch =
          desc.match(/\bin the ([^,.!?]+?) (?:category|game)\b/i) ||
          desc.match(/\bto an? ([^,.!?]+?) streamer/i) ||
          desc.match(/\b(?:playing|watching) (?:\d+ (?:minutes?|hours?) of )?([^,.!?]+?)(?: during| at| on| in\b| streams?\b|[,.!?]|$)/i);
        const whereWrap = document.createElement("div");
        whereWrap.className = "where-earn";
        const whereLabel = document.createElement("p");
        whereLabel.className = "detail-label";
        const whereLink = document.createElement("a");
        whereLink.className = "where-link";
        whereLink.target = "_blank";
        whereLink.rel = "noopener";

        if (catMatch) {
          const catName = catMatch[1].trim();
          const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          whereLabel.textContent = "Earned in category";
          whereLink.href = `https://www.twitch.tv/directory/category/${slug}`;
          whereLink.textContent = `${catName} category ↗`;
        } else {
          whereLabel.textContent = "Find on Twitch";
          whereLink.href = `https://www.twitch.tv/search?term=${encodeURIComponent(version.title || set.set_id)}`;
          whereLink.textContent = `Search "${version.title || set.set_id}" on Twitch ↗`;
        }
        whereWrap.append(whereLabel, whereLink);
        availSection.append(whereWrap);
      }
    }

    eventInfo.append(availSection);
    statusMessage.hidden = true;
    detail.hidden = false;

  } catch (err) {
    statusMessage.textContent = err.message.includes("TWITCH_CLIENT_ID")
      ? "Server isn't connected to Twitch yet — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and restart (see README)."
      : `Couldn't load badge: ${err.message}`;
  }
}

load();
