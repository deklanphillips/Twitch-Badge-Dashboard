const timelineScroll = document.getElementById("timelineScroll");
const timeline = document.getElementById("timeline");
const timelineDays = document.getElementById("timelineDays");
const timelineRows = document.getElementById("timelineRows");
const nowLine = document.getElementById("nowLine");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

const DAY_MS = 86400000;
const DAY_WIDTH = 110; // px per day column
const HEADER_HEIGHT = 44;
const ROW_HEIGHT = 68;

let query = "";
let didInitialScroll = false;
let globalBadges = []; // { set, version, title, image } from the Twitch API

function tokens(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
}

// Find the global badge whose title best matches the event name.
function matchBadge(eventName) {
  const evTokens = new Set(tokens(eventName));
  let best = null;
  let bestScore = 0;
  for (const b of globalBadges) {
    const bTokens = tokens(b.title);
    if (!bTokens.length) continue;
    const overlap = bTokens.filter((t) => evTokens.has(t)).length;
    const score = overlap / bTokens.length;
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

async function loadGlobalBadges() {
  try {
    const data = await twitchData("/api/badges/global", "api/global-badges.json");
    globalBadges = data.data.flatMap((set) =>
      set.versions.map((v) => ({
        set: set.set_id,
        version: v.id,
        title: v.title || set.set_id,
        image: v.image_url_2x || v.image_url_1x,
      }))
    );
    render();
  } catch {
    // Offline or not connected to Twitch — bars fall back to search links.
  }
}

function getStatus(event, now = Date.now()) {
  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "live";
}

const dayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function matchesQuery(event) {
  if (!query) return true;
  return `${event.name} ${event.channel} ${event.description}`.toLowerCase().includes(query);
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function render() {
  const now = Date.now();
  const events = BADGE_EVENTS.map((e) => ({ ...e, status: getStatus(e, now) }));

  // Live first, then upcoming, then ended — so live events claim the top rows.
  const STATUS_ORDER = { live: 0, upcoming: 1, ended: 2 };
  const visible = events
    .filter((e) => matchesQuery(e))
    .sort((a, b) => {
      const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      return sd !== 0 ? sd : Date.parse(a.start) - Date.parse(b.start);
    });

  emptyState.hidden = visible.length > 0;
  timelineScroll.parentElement.style.display = visible.length ? "" : "none";
  if (!visible.length) return;

  // Pack each event into the first row where it doesn't overlap anything.
  // Live events get placed first (top rows); ended events then fill into the
  // same rows wherever their dates don't collide, so no row sits empty.
  const rowIntervals = []; // per row: list of [start, end]
  for (const ev of visible) {
    const s = Date.parse(ev.start), e = Date.parse(ev.end);
    let row = rowIntervals.findIndex((ivs) => ivs.every(([is, ie]) => ie <= s || is >= e));
    if (row === -1) {
      row = rowIntervals.length;
      rowIntervals.push([]);
    }
    rowIntervals[row].push([s, e]);
    ev._row = row;
  }
  const totalRows = rowIntervals.length;

  // Window: at least 14 days before today, extending to cover all events.
  const minStart = Math.min(now, ...visible.map((e) => Date.parse(e.start)));
  const maxEnd = Math.max(now, ...visible.map((e) => Date.parse(e.end)));
  const windowStart = Math.min(startOfDay(minStart) - 3 * DAY_MS, startOfDay(now) - 14 * DAY_MS);
  const totalDays = Math.ceil((maxEnd - windowStart) / DAY_MS) + 3;

  timeline.style.width = `${totalDays * DAY_WIDTH}px`;
  timeline.style.height = `${HEADER_HEIGHT + totalRows * ROW_HEIGHT}px`;

  // Day header + grid columns
  timelineDays.replaceChildren();
  const todayStart = startOfDay(now);
  for (let i = 0; i < totalDays; i++) {
    const dayTs = windowStart + i * DAY_MS;
    const col = document.createElement("div");
    col.className = "day-col";
    if (dayTs === todayStart) col.classList.add("today");
    col.style.left = `${i * DAY_WIDTH}px`;
    col.style.width = `${DAY_WIDTH}px`;
    const label = document.createElement("span");
    label.className = "day-label";
    label.textContent = dayFmt.format(new Date(dayTs));
    col.append(label);
    timelineDays.append(col);
  }

  // Event bars, one row each
  timelineRows.replaceChildren();
  visible.forEach((event, i) => {
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    const bar = document.createElement("a");
    bar.className = `event-bar ${event.status}`;
    bar.style.left = `${((start - windowStart) / DAY_MS) * DAY_WIDTH}px`;
    bar.style.width = `${Math.max(((end - start) / DAY_MS) * DAY_WIDTH, 60)}px`;
    bar.style.top = `${HEADER_HEIGHT + event._row * ROW_HEIGHT + 8}px`;
    bar.title = `${event.name} — @${event.channel}\n${event.requirement}\n${dateFmt.format(new Date(start))} → ${dateFmt.format(new Date(end))}`;

    // Resolve badge link + image. An explicit `badge` field only has
    // {set, version}, so look up its image from the live global badge list.
    let linked = null;
    if (event.badge) {
      linked =
        globalBadges.find((b) => b.set === event.badge.set && b.version === event.badge.version) ||
        event.badge;
    } else {
      linked = matchBadge(event.name);
    }
    bar.href = linked
      ? `badge.html?set=${encodeURIComponent(linked.set)}&version=${encodeURIComponent(linked.version)}`
      : `badges.html?q=${encodeURIComponent(event.name)}`;
    const imgEl = document.createElement("div");
    imgEl.className = "bar-badge";
    const badgeImg = linked && linked.image
      ? (() => { const i = document.createElement("img"); i.src = linked.image; i.alt = ""; return i; })()
      : (() => { const s = document.createElement("span"); s.textContent = event.emoji; return s; })();
    imgEl.append(badgeImg);

    const label = document.createElement("span");
    label.className = "bar-label";
    const title = document.createElement("span");
    title.className = "bar-title";
    title.textContent = event.name;
    const sub = document.createElement("span");
    sub.className = "bar-sub";
    sub.textContent = `@${event.channel} · ${event.requirement}`;
    label.append(title, sub);
    const content = document.createElement("span");
    content.className = "bar-content";
    content.append(imgEl, label);
    bar.append(content);
    timelineRows.append(bar);
  });

  // Current-time line — clicking it scrolls to it
  const nowX = ((now - windowStart) / DAY_MS) * DAY_WIDTH;
  nowLine.style.left = `${nowX}px`;
  nowLine.onclick = () => scrollToNow(nowX);

  if (!didInitialScroll) {
    scrollToNow(nowX);
    didInitialScroll = true;
  }
  updateBarLabels();
}

// Keep bar content (badge image + text) visible when a bar starts left of
// the scrolled viewport.
function updateBarLabels() {
  const scrollX = timelineScroll.scrollLeft;
  for (const bar of timelineRows.children) {
    const content = bar.querySelector(".bar-content");
    if (!content) continue;
    const barLeft = parseFloat(bar.style.left);
    const barWidth = parseFloat(bar.style.width);
    const maxShift = Math.max(0, barWidth - content.offsetWidth - 24);
    const shift = Math.min(Math.max(0, scrollX - barLeft), maxShift);
    content.style.transform = `translateX(${shift}px)`;
  }
}

function scrollToNow(nowX) {
  timelineScroll.scrollLeft = Math.max(0, nowX - timelineScroll.clientWidth / 3);
}

timelineScroll.addEventListener("scroll", updateBarLabels, { passive: true });

document.getElementById("jumpNowBtn").addEventListener("click", () => {
  const nowX = parseFloat(nowLine.style.left);
  if (!isNaN(nowX)) {
    timelineScroll.scrollTo({ left: Math.max(0, nowX - timelineScroll.clientWidth / 3), behavior: "smooth" });
  }
});

searchInput.addEventListener("input", () => {
  query = searchInput.value.trim().toLowerCase();
  render();
});

render();
loadGlobalBadges();
setInterval(render, 30000);
