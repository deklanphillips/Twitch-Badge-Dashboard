const params = new URLSearchParams(location.search);
const emoteId = params.get("id");

const detail = document.getElementById("emoteDetail");
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

async function load() {
  if (!emoteId) {
    statusMessage.textContent = "No emote specified.";
    return;
  }
  try {
    let live = [];
    try {
      const data = await twitchData("/api/emotes/global", "api/global-emotes.json");
      live = data.data || [];
    } catch (e) {
      // Fall back to the StreamDatabase supplement below.
    }
    const emote =
      live.find((e) => e.id === emoteId) ||
      (window.EMOTE_SUPPLEMENT || []).find((e) => e.id === emoteId);
    if (!emote) throw new Error(`Emote "${emoteId}" not found.`);

    breadcrumb.textContent = `HOME / TWITCH / GLOBAL-EMOTES / ${emote.name.toUpperCase()}`;
    document.title = `${emote.name} — Twitch Badge Dashboard`;

    const sizePreviews = document.getElementById("sizePreviews");
    for (const [label, url] of [
      ["1x", emote.images.url_1x],
      ["2x", emote.images.url_2x],
      ["4x", emote.images.url_4x],
    ]) {
      if (!url) continue;
      const wrap = document.createElement("div");
      wrap.className = "size-wrap";
      const img = document.createElement("img");
      img.src = url;
      img.alt = `${emote.name} ${label}`;
      const lbl = document.createElement("span");
      lbl.textContent = label.toUpperCase();
      wrap.append(img, lbl);
      sizePreviews.append(wrap);
    }

    const detailFields = document.getElementById("detailFields");
    detailFields.append(
      field("Name", emote.name),
      field("Emote ID", emote.id),
      field("Formats", (emote.format || []).join(", ")),
      field("Scales", (emote.scale || []).join(", ")),
      field("Themes", (emote.theme_mode || []).join(", ")),
    );

    statusMessage.hidden = true;
    detail.hidden = false;
  } catch (err) {
    statusMessage.textContent = err.message.includes("TWITCH_CLIENT_ID")
      ? "Server isn't connected to Twitch yet — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and restart (see README)."
      : `Couldn't load emote: ${err.message}`;
  }
}

load();
