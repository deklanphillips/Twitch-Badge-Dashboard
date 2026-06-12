const badgeGrid = document.getElementById("badgeGrid");
const statusMessage = document.getElementById("statusMessage");
const channelForm = document.getElementById("channelForm");
const channelInput = document.getElementById("channelInput");
const channelHeading = document.getElementById("channelHeading");
const quickChannels = document.getElementById("quickChannels");

const SUGGESTED_CHANNELS = ["ishowspeed", "kaicenat", "xqc", "gamesdonequick", "pokimane"];

function showStatus(text) {
  statusMessage.textContent = text;
  statusMessage.hidden = !text;
}

function renderBadgeSets(sets, displayName) {
  badgeGrid.replaceChildren();
  channelHeading.hidden = false;
  channelHeading.textContent = `@${displayName}`;
  if (!sets.length) {
    showStatus(`@${displayName} has no custom channel badges.`);
    return;
  }
  showStatus("");
  for (const set of sets) {
    for (const version of set.versions) {
      const tile = document.createElement("article");
      tile.className = "badge-tile";
      const img = document.createElement("img");
      img.src = version.image_url_4x || version.image_url_2x || version.image_url_1x;
      img.alt = version.title || set.set_id;
      img.loading = "lazy";
      const name = document.createElement("p");
      name.className = "badge-title";
      name.textContent = version.title || set.set_id;
      const setLabel = document.createElement("p");
      setLabel.className = "badge-set";
      setLabel.textContent = set.set_id === "subscriber" ? "Subscriber badge" : set.set_id === "bits" ? "Bits badge" : set.set_id;
      tile.append(img, name, setLabel);
      badgeGrid.append(tile);
    }
  }
}

async function loadChannel(login) {
  showStatus(`Loading @${login}'s badges…`);
  channelHeading.hidden = true;
  badgeGrid.replaceChildren();
  try {
    const res = await fetch(`/api/badges/channel?login=${encodeURIComponent(login)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    renderBadgeSets(data.data, data.user ? data.user.display_name : login);
  } catch (err) {
    showStatus(
      err.message.includes("TWITCH_CLIENT_ID")
        ? "Server isn't connected to Twitch yet — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and restart (see README)."
        : `Couldn't load badges: ${err.message}`
    );
  }
}

channelForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const login = channelInput.value.trim().toLowerCase().replace(/^@/, "");
  if (login) {
    history.replaceState(null, "", `?channel=${encodeURIComponent(login)}`);
    loadChannel(login);
  }
});

for (const ch of SUGGESTED_CHANNELS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "quick-chip";
  btn.textContent = ch;
  btn.addEventListener("click", () => {
    channelInput.value = ch;
    history.replaceState(null, "", `?channel=${encodeURIComponent(ch)}`);
    loadChannel(ch);
  });
  quickChannels.append(btn);
}

const initialChannel = new URLSearchParams(location.search).get("channel");
if (initialChannel) {
  channelInput.value = initialChannel;
  loadChannel(initialChannel.toLowerCase());
}
