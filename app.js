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
    const data = await twitchData("/api/badges/global", "/api/global-badges.json");
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

// Auto-detected events (api/auto-events.json) merged with the curated ones.
let autoEvents = [];
async function loadAutoEvents() {
  try {
    const res = await fetch("/api/auto-events.json", { cache: "no-store" });
    if (res.ok) {
      const all = await res.json();
      autoEvents = all.filter(e => e.confirmed !== false);
      render();
    }
  } catch {
    // No auto-events file yet — fine, just the curated list shows.
  }
}

// Build events from the imported availability data (real dates/requirements),
// using the live badge catalog for titles, versions, and images.
function availabilityEvents() {
  if (typeof BADGE_AVAILABILITY === "undefined") return [];
  const out = [];
  for (const [set, info] of Object.entries(BADGE_AVAILABILITY)) {
    if (!info.avail) continue;
    const a = info.avail.find((x) => x.start);
    if (!a) continue;
    const badge = globalBadges.find((b) => b.set === set);
    const requirement =
      a.watch && a.watchMinutes ? `Watch ${a.watchMinutes} minutes`
      : a.subscription || a.subscriptionGift ? "Sub or gift sub"
      : a.bits ? "Cheer bits"
      : a.watch ? "Watch to earn"
      : "See badge page";
    const place = (a.categories && a.categories[0]) || null;
    const chan = (a.channels && a.channels[0]) || null;
    out.push({
      name: badge ? badge.title : set,
      channel: place ? place.name : chan ? chan.name : "Twitch",
      description: "",
      emoji: "✨",
      requirement,
      start: a.start,
      end: a.end || null,
      badge: { set, version: badge ? badge.version : "1" },
      where: place
        ? { type: "category", label: `${place.name} category`, url: place.href }
        : chan
        ? { type: "channel", label: chan.name, url: chan.href }
        : undefined,
    });
  }
  return out;
}

// Merge sources by badge set, in priority order: curated > availability > auto.
function allEvents() {
  const seen = new Set();
  const merged = [];
  // Grouping tags (e.g. the EWC watch tiers) live in the auto-events source.
  // Apply them to whichever source actually provides each badge so grouped
  // bars survive even when availability data supplies the event.
  const groupBySet = {};
  for (const e of autoEvents) {
    if (e.group && e.badge) groupBySet[e.badge.set] = { group: e.group, groupLabel: e.groupLabel };
  }
  for (const list of [BADGE_EVENTS, availabilityEvents(), autoEvents]) {
    for (const e of list) {
      const key = e.badge && e.badge.set;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      const g = key && groupBySet[key];
      merged.push(g ? { ...e, group: g.group, groupLabel: g.groupLabel } : e);
    }
  }
  return merged;
}

// Collapse events sharing a `group` id into one bar that carries every
// member badge (shown as a row of icons). The combined bar spans the
// earliest start to the latest end across its members.
function groupEvents(events) {
  const map = new Map();
  const out = [];
  for (const e of events) {
    if (!e.group) { out.push(e); continue; }
    let g = map.get(e.group);
    if (!g) {
      g = { ...e, name: e.groupLabel || e.name, _badges: [], grouped: true };
      map.set(e.group, g);
      out.push(g);
    }
    if (e.badge) g._badges.push({ set: e.badge.set, version: e.badge.version });
    if (Date.parse(e.start) < Date.parse(g.start)) g.start = e.start;
    if (e.end && (!g.end || Date.parse(e.end) > Date.parse(g.end))) g.end = e.end;
  }
  return out;
}

// End is the badge's end date, or null for open-ended (no known end) events.
function endOf(event) {
  return event.end ? Date.parse(event.end) : null;
}

function getStatus(event, now = Date.now()) {
  const start = Date.parse(event.start);
  const end = endOf(event);
  if (now < start) return "upcoming";
  if (end !== null && now > end) return "ended";
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

// For layout, open-ended events extend 14 days past now so they read as ongoing.
function layoutEnd(event, now) {
  return endOf(event) ?? now + 14 * DAY_MS;
}

function render() {
  const now = Date.now();
  const windowStart = startOfDay(now) - 2 * DAY_MS;
  const events = groupEvents(allEvents()).map((e) => ({ ...e, status: getStatus(e, now) }));

  // Live first, then upcoming, then ended — so live events claim the top rows.
  // Within each group, the soonest-ending badge sits at the top (most urgent);
  // open-ended (no known end) events sink to the bottom.
  // Drop events that ended before the scroll window (unreachable in the past).
  const STATUS_ORDER = { live: 0, upcoming: 1, ended: 2 };
  const visible = events
    .filter((e) => matchesQuery(e) && layoutEnd(e, now) >= windowStart)
    .sort((a, b) => {
      const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (sd !== 0) return sd;
      const ea = endOf(a), eb = endOf(b);
      if (ea === null && eb === null) return Date.parse(a.start) - Date.parse(b.start);
      if (ea === null) return 1;   // open-ended goes last
      if (eb === null) return -1;
      return ea - eb;              // soonest end first
    });

  emptyState.hidden = visible.length > 0;
  timelineScroll.parentElement.style.display = visible.length ? "" : "none";
  if (!visible.length) return;

  // Pack each event into the first row where it doesn't overlap anything.
  // Live events get placed first (top rows); ended events then fill into the
  // same rows wherever their dates don't collide, so no row sits empty.
  const rowIntervals = []; // per row: list of [start, end]
  for (const ev of visible) {
    const s = Date.parse(ev.start), e = layoutEnd(ev, now);
    let row = rowIntervals.findIndex((ivs) => ivs.every(([is, ie]) => ie <= s || is >= e));
    if (row === -1) {
      row = rowIntervals.length;
      rowIntervals.push([]);
    }
    rowIntervals[row].push([s, e]);
    ev._row = row;
  }
  const totalRows = rowIntervals.length;

  // Window: scroll back only 2 days from today, extending forward to cover all
  // events. Long-running events that started earlier still show their current
  // portion (their bar extends in from the left edge).
  const maxEnd = Math.max(now, ...visible.map((e) => layoutEnd(e, now)));
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
    const end = layoutEnd(event, now);
    const endLabel = endOf(event) === null ? "ongoing" : dateFmt.format(new Date(end));
    const bar = document.createElement("a");
    bar.className = `event-bar ${event.status}`;
    bar.style.left = `${((start - windowStart) / DAY_MS) * DAY_WIDTH}px`;
    bar.style.width = `${Math.max(((end - start) / DAY_MS) * DAY_WIDTH, 60)}px`;
    bar.style.top = `${HEADER_HEIGHT + event._row * ROW_HEIGHT + 8}px`;
    const whoText = event.grouped ? `${event._badges.length} badges` : `@${event.channel}`;
    bar.title = `${event.name} — ${whoText}\n${event.requirement}\n${dateFmt.format(new Date(start))} → ${endLabel}`;

    // Resolve badge link + image(s). Grouped events show every member badge's
    // icon in one bar; single events show their one badge (image looked up
    // from the live global catalog).
    const imgFor = (ref) =>
      globalBadges.find((b) => b.set === ref.set && b.version === ref.version);
    const imgEl = document.createElement("div");
    imgEl.className = "bar-badge";
    if (event.grouped && event._badges.length) {
      imgEl.classList.add("bar-badge-group");
      let added = 0;
      for (const ref of event._badges) {
        const gb = imgFor(ref);
        if (gb && gb.image) {
          const im = document.createElement("img");
          im.src = gb.image;
          im.alt = "";
          imgEl.append(im);
          added++;
        }
      }
      if (!added) {
        const s = document.createElement("span");
        s.textContent = event.emoji;
        imgEl.append(s);
      }
      bar.href = `/group?id=${encodeURIComponent(event.group)}`;
    } else {
      const linked = event.badge ? (imgFor(event.badge) || event.badge) : matchBadge(event.name);
      bar.href = linked
        ? `/badge?set=${encodeURIComponent(linked.set)}&version=${encodeURIComponent(linked.version)}`
        : `/badges?q=${encodeURIComponent(event.name)}`;
      const badgeImg = linked && linked.image
        ? (() => { const i = document.createElement("img"); i.src = linked.image; i.alt = ""; return i; })()
        : (() => { const s = document.createElement("span"); s.textContent = event.emoji; return s; })();
      imgEl.append(badgeImg);
    }

    const label = document.createElement("span");
    label.className = "bar-label";
    const title = document.createElement("span");
    title.className = "bar-title";
    title.textContent = event.name;
    const sub = document.createElement("span");
    sub.className = "bar-sub";
    sub.textContent = event.grouped
      ? `${event._badges.length} badges · ${event.requirement}`
      : `@${event.channel} · ${event.requirement}`;
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
loadAutoEvents();
setInterval(render, 30000);
