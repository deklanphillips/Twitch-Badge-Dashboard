const badgeGrid = document.getElementById("badgeGrid");
const statusMessage = document.getElementById("statusMessage");
const sourceTabs = document.querySelectorAll("#sourceTabs .tab");
const channelForm = document.getElementById("channelForm");
const channelInput = document.getElementById("channelInput");
const badgeSearchWrap = document.getElementById("badgeSearchWrap");
const badgeSearchInput = document.getElementById("badgeSearchInput");

let currentSource = "global";
let loadedSets = [];
let loadedHeading = "";
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
      if (currentSource === "global") {
        link.href = `badge.html?set=${encodeURIComponent(set.set_id)}&version=${encodeURIComponent(version.id)}`;
      }
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
  if (!shown) {
    showStatus(
      badgeQuery
        ? `No badges match "${badgeQuery}".`
        : `No badges found${loadedHeading ? ` for ${loadedHeading}` : ""}.`
    );
  } else {
    showStatus("");
  }
}

async function loadBadges(url, heading) {
  showStatus("Loading badges…");
  badgeGrid.replaceChildren();
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    loadedSets = data.data;
    loadedHeading = heading || "";
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

sourceTabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    sourceTabs.forEach((t) => t.classList.toggle("active", t === tab));
    currentSource = tab.dataset.source;
    const isChannel = currentSource === "channel";
    channelForm.hidden = !isChannel;
    if (isChannel) {
      loadedSets = [];
      showStatus("Enter a channel name above to load its badges.");
      badgeGrid.replaceChildren();
      channelInput.focus();
    } else {
      loadBadges("/api/badges/global");
    }
  })
);

channelForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const login = channelInput.value.trim().toLowerCase();
  if (login) loadBadges(`/api/badges/channel?login=${encodeURIComponent(login)}`, login);
});

const initialQuery = new URLSearchParams(location.search).get("q");
if (initialQuery) {
  badgeSearchInput.value = initialQuery;
  badgeQuery = initialQuery.trim().toLowerCase();
}

if (location.hash === "#channel") {
  document.querySelector('[data-source="channel"]').click();
} else {
  loadBadges("/api/badges/global");
}
