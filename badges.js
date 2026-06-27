const badgeGrid = document.getElementById("badgeGrid");
const statusMessage = document.getElementById("statusMessage");
const badgeSearchInput = document.getElementById("badgeSearchInput");

let loadedSets = [];
let badgeQuery = "";

function showStatus(text) {
  statusMessage.textContent = text;
  statusMessage.hidden = !text;
}

function renderBadgeSets() {
  badgeGrid.replaceChildren();
  let shown = 0;
  for (const set of loadedSets) {
    for (const version of set.versions) {
      const title = version.title || set.set_id;
      if (badgeQuery && !`${title} ${set.set_id}`.toLowerCase().includes(badgeQuery)) continue;
      shown++;
      const link = document.createElement("a");
      link.className = "badge-tile";
      link.href = `/badge?set=${encodeURIComponent(set.set_id)}&version=${encodeURIComponent(version.id)}`;
      const img = document.createElement("img");
      img.src = version.image_url_4x || version.image_url_2x || version.image_url_1x;
      img.alt = title;
      img.loading = "lazy";
      const name = document.createElement("p");
      name.className = "badge-title";
      name.textContent = title;
      link.append(img, name);
      badgeGrid.append(link);
    }
  }
  showStatus(shown ? "" : badgeQuery ? `No badges match "${badgeQuery}".` : "No badges found.");
}

async function loadBadges() {
  showStatus("Loading badges…");
  try {
    const data = await twitchData("/api/badges/global", "/api/global-badges.json");
    loadedSets = data.data;
    renderBadgeSets();
  } catch (err) {
    showStatus(
      err.message.includes("TWITCH_CLIENT_ID")
        ? "Server isn't connected to Twitch yet — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and restart (see README)."
        : `Couldn't load badges: ${err.message}`
    );
  }
}

badgeSearchInput.addEventListener("input", () => {
  badgeQuery = badgeSearchInput.value.trim().toLowerCase();
  renderBadgeSets();
});

const initialQuery = new URLSearchParams(location.search).get("q");
if (initialQuery) {
  badgeSearchInput.value = initialQuery;
  badgeQuery = initialQuery.trim().toLowerCase();
}

loadBadges();
