const emoteGrid = document.getElementById("emoteGrid");
const statusMessage = document.getElementById("statusMessage");
const emoteSearchInput = document.getElementById("emoteSearchInput");

let loadedEmotes = [];
let emoteQuery = "";

function showStatus(text) {
  statusMessage.textContent = text;
  statusMessage.hidden = !text;
}

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

function renderEmotes() {
  emoteGrid.replaceChildren();
  let shown = 0;
  for (const emote of loadedEmotes) {
    if (emoteQuery && !emote.name.toLowerCase().includes(emoteQuery)) continue;
    shown++;
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
  showStatus(shown ? "" : emoteQuery ? `No emotes match "${emoteQuery}".` : "No emotes found.");
}

async function loadEmotes() {
  showStatus("Loading emotes…");
  try {
    let live = [];
    try {
      const data = await twitchData("/api/emotes/global", "api/global-emotes.json");
      live = data.data || [];
    } catch (e) {
      // Fall back to the StreamDatabase supplement if the live feed is unavailable.
    }
    loadedEmotes = mergeEmotes(live);
    if (!loadedEmotes.length) throw new Error("No emotes available.");
    renderEmotes();
  } catch (err) {
    showStatus(
      err.message.includes("TWITCH_CLIENT_ID")
        ? "Server isn't connected to Twitch yet — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and restart (see README)."
        : `Couldn't load emotes: ${err.message}`
    );
  }
}

emoteSearchInput.addEventListener("input", () => {
  emoteQuery = emoteSearchInput.value.trim().toLowerCase();
  renderEmotes();
});

loadEmotes();
