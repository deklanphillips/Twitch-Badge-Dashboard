const badgeGrid = document.getElementById("badgeGrid");
const statusMessage = document.getElementById("statusMessage");
const sourceTabs = document.querySelectorAll("#sourceTabs .tab");
const channelForm = document.getElementById("channelForm");
const channelInput = document.getElementById("channelInput");

let currentSource = "global";

function showStatus(text) {
  statusMessage.textContent = text;
  statusMessage.hidden = !text;
}

function renderBadgeSets(sets, heading) {
  badgeGrid.replaceChildren();
  if (!sets.length) {
    showStatus(`No badges found${heading ? ` for ${heading}` : ""}.`);
    return;
  }
  showStatus("");
  for (const set of sets) {
    for (const version of set.versions) {
      const link = document.createElement("a");
      link.className = "badge-tile";
      if (currentSource === "global") {
        link.href = `badge.html?set=${encodeURIComponent(set.set_id)}&version=${encodeURIComponent(version.id)}`;
      }
      const img = document.createElement("img");
      img.src = version.image_url_4x || version.image_url_2x || version.image_url_1x;
      img.alt = version.title || set.set_id;
      img.loading = "lazy";
      const name = document.createElement("p");
      name.className = "badge-title";
      name.textContent = version.title || set.set_id;
      const setLabel = document.createElement("p");
      setLabel.className = "badge-set";
      setLabel.textContent = set.set_id;
      link.append(img, name, setLabel);
      badgeGrid.append(link);
    }
  }
}

async function loadBadges(url, heading) {
  showStatus("Loading badges…");
  badgeGrid.replaceChildren();
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    renderBadgeSets(data.data, heading);
  } catch (err) {
    showStatus(
      err.message.includes("TWITCH_CLIENT_ID")
        ? "Server isn't connected to Twitch yet — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and restart (see README)."
        : `Couldn't load badges: ${err.message}`
    );
  }
}

sourceTabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    sourceTabs.forEach((t) => t.classList.toggle("active", t === tab));
    currentSource = tab.dataset.source;
    const isChannel = currentSource === "channel";
    channelForm.hidden = !isChannel;
    if (isChannel) {
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

if (location.hash === "#channel") {
  document.querySelector('[data-source="channel"]').click();
} else {
  loadBadges("/api/badges/global");
}
