// Featured channel whose badges appear in the "Channel Badges" preview row.
const FEATURED_CHANNEL = "gamesdonequick";
const PREVIEW_COUNT = 6;

const homeStatus = document.getElementById("homeStatus");

function fillRow(rowId, items) {
  const row = document.getElementById(rowId);
  row.replaceChildren();
  for (const item of items.slice(0, PREVIEW_COUNT)) {
    const img = document.createElement("img");
    img.src = item.src;
    img.alt = item.alt;
    img.title = item.alt;
    img.loading = "lazy";
    row.append(img);
  }
  if (!items.length) {
    const note = document.createElement("span");
    note.className = "preview-loading";
    note.textContent = "Nothing to show";
    row.append(note);
  }
}

function rowError(rowId, message) {
  const row = document.getElementById(rowId);
  row.replaceChildren();
  const note = document.createElement("span");
  note.className = "preview-loading";
  note.textContent = message;
  row.append(note);
}

function badgeVersions(sets) {
  const items = [];
  for (const set of sets) {
    for (const version of set.versions) {
      items.push({
        src: version.image_url_2x || version.image_url_1x,
        alt: version.title || set.set_id,
      });
    }
  }
  return items;
}

async function load() {
  try {
    const [global, channel, emotes] = await Promise.allSettled([
      twitchData("/api/badges/global", "api/global-badges.json"),
      twitchData(`/api/badges/channel?login=${FEATURED_CHANNEL}`, `api/channel-badges/${FEATURED_CHANNEL}.json`),
      twitchData("/api/emotes/global", "api/global-emotes.json"),
    ]);

    if (global.status === "fulfilled") fillRow("globalBadgesRow", badgeVersions(global.value.data));
    else rowError("globalBadgesRow", "Couldn't load");

    if (channel.status === "fulfilled") fillRow("channelBadgesRow", badgeVersions(channel.value.data));
    else rowError("channelBadgesRow", "Couldn't load");

    if (emotes.status === "fulfilled")
      fillRow(
        "globalEmotesRow",
        emotes.value.data.map((e) => ({
          src: e.images.url_2x || e.images.url_1x,
          alt: e.name,
        }))
      );
    else rowError("globalEmotesRow", "Couldn't load");

    if (global.status === "rejected" && /TWITCH_CLIENT_ID/.test(global.reason.message)) {
      homeStatus.textContent =
        "Server isn't connected to Twitch yet — set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET and restart (see README).";
      homeStatus.hidden = false;
    }
  } catch (err) {
    homeStatus.textContent = `Couldn't load data: ${err.message}`;
    homeStatus.hidden = false;
  }
}

load();
