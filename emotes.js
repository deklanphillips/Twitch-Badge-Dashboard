const emoteGrid = document.getElementById("emoteGrid");
const statusMessage = document.getElementById("statusMessage");

async function loadEmotes() {
  try {
    const res = await fetch("/api/emotes/global");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

    statusMessage.hidden = true;
    for (const emote of data.data) {
      const card = document.createElement("article");
      card.className = "badge-tile";
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
  } catch (err) {
    statusMessage.textContent = err.message.includes("TWITCH_CLIENT_ID")
      ? "Server isn't connected to Twitch yet — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and restart (see README)."
      : `Couldn't load emotes: ${err.message}`;
  }
}

loadEmotes();
