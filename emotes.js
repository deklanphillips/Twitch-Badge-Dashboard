const emoteGrid = document.getElementById("emoteGrid");
const statusMessage = document.getElementById("statusMessage");
const noResults = document.getElementById("noResults");
const searchInput = document.getElementById("emoteSearchInput");

function filterEmotes(query) {
  const q = query.trim().toLowerCase();
  const cards = emoteGrid.querySelectorAll(".badge-tile");
  let visible = 0;
  for (const card of cards) {
    const name = card.querySelector(".badge-title").textContent.toLowerCase();
    const show = !q || name.includes(q);
    card.hidden = !show;
    if (show) visible++;
  }
  noResults.hidden = visible > 0;
}

searchInput.addEventListener("input", () => filterEmotes(searchInput.value));

function mergeEmotes(live) {
  const byId = new Map();
  const byName = new Map();
  for (const e of live) {
    byId.set(e.id, e);
    byName.set(e.name.toLowerCase(), e);
  }
  for (const e of window.EMOTE_SUPPLEMENT || []) {
    if (byId.has(e.id) || byName.has(e.name.toLowerCase())) continue;
    byId.set(e.id, e);
    byName.set(e.name.toLowerCase(), e);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function loadEmotes() {
  try {
    let live = [];
    try {
      const data = await twitchData("/api/emotes/global", "api/global-emotes.json");
      live = data.data || [];
    } catch (e) {
      // Fall back to the StreamDatabase supplement if the live feed is unavailable.
    }
    const emotes = mergeEmotes(live);
    if (!emotes.length) throw new Error("No emotes available.");

    statusMessage.hidden = true;
    for (const emote of emotes) {
      const card = document.createElement("a");
      card.className = "badge-tile";
      card.href = `emote.html?id=${encodeURIComponent(emote.id)}`;
      const img = document.createElement("img");
      img.src = emote.images.url_2x || emote.images.url_1x;
      img.alt = emote.name;
      img.loading = "lazy";
      const name = document.createElement("p");
      name.className = "badge-title";
      name.textContent = emote.name;
      card.append(img, name);
      emoteGrid.append(card);
    }
    filterEmotes(searchInput.value);
  } catch (err) {
    statusMessage.textContent = err.message.includes("TWITCH_CLIENT_ID")
      ? "Server isn't connected to Twitch yet — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and restart (see README)."
      : `Couldn't load emotes: ${err.message}`;
  }
}

loadEmotes();
