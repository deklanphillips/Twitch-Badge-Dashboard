const timelineScroll = document.getElementById("timelineScroll");
const timeline = document.getElementById("timeline");
const timelineDays = document.getElementById("timelineDays");
const timelineRows = document.getElementById("timelineRows");
const nowLine = document.getElementById("nowLine");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const tabs = document.querySelectorAll("#statusTabs .tab");

const DAY_MS = 86400000;
const DAY_WIDTH = 110; // px per day column
const HEADER_HEIGHT = 44;
const ROW_HEIGHT = 64;

let activeStatus = "all";
let query = "";
let didInitialScroll = false;

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

  const counts = { all: 0, live: 0, upcoming: 0, ended: 0 };
  for (const e of events) {
    if (!matchesQuery(e)) continue;
    counts.all++;
    counts[e.status]++;
  }
  for (const [status, n] of Object.entries(counts)) {
    const el = document.querySelector(`[data-count="${status}"]`);
    if (el) el.textContent = `(${n})`;
  }

  const visible = events
    .filter((e) => matchesQuery(e) && (activeStatus === "all" || e.status === activeStatus))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  emptyState.hidden = visible.length > 0;
  timelineScroll.parentElement.style.display = visible.length ? "" : "none";
  if (!visible.length) return;

  // Window: 3 days before earliest start (and before today) to 3 days after latest end.
  const minStart = Math.min(now, ...visible.map((e) => Date.parse(e.start)));
  const maxEnd = Math.max(now, ...visible.map((e) => Date.parse(e.end)));
  const windowStart = startOfDay(minStart) - 3 * DAY_MS;
  const totalDays = Math.ceil((maxEnd - windowStart) / DAY_MS) + 3;

  timeline.style.width = `${totalDays * DAY_WIDTH}px`;
  timeline.style.height = `${HEADER_HEIGHT + visible.length * ROW_HEIGHT}px`;

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
    // Events with a `badge: {set, version}` field link straight to that badge;
    // otherwise fall back to a badge search for the event name.
    bar.href = event.badge
      ? `badge.html?set=${encodeURIComponent(event.badge.set)}&version=${encodeURIComponent(event.badge.version)}`
      : `badges.html?q=${encodeURIComponent(event.name)}`;
    bar.style.left = `${((start - windowStart) / DAY_MS) * DAY_WIDTH}px`;
    bar.style.width = `${Math.max(((end - start) / DAY_MS) * DAY_WIDTH, 60)}px`;
    bar.style.top = `${HEADER_HEIGHT + i * ROW_HEIGHT + 8}px`;
    bar.title = `${event.name} — @${event.channel}\n${event.requirement}\n${dateFmt.format(new Date(start))} → ${dateFmt.format(new Date(end))}`;

    const title = document.createElement("span");
    title.className = "bar-title";
    title.textContent = event.name;
    const sub = document.createElement("span");
    sub.className = "bar-sub";
    sub.textContent = `${event.emoji} @${event.channel} · ${event.requirement}`;
    bar.append(title, sub);
    timelineRows.append(bar);
  });

  // Current-time line
  const nowX = ((now - windowStart) / DAY_MS) * DAY_WIDTH;
  nowLine.style.left = `${nowX}px`;

  if (!didInitialScroll) {
    timelineScroll.scrollLeft = Math.max(0, nowX - timelineScroll.clientWidth / 3);
    didInitialScroll = true;
  }
}

tabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    activeStatus = tab.dataset.status;
    render();
  })
);

searchInput.addEventListener("input", () => {
  query = searchInput.value.trim().toLowerCase();
  render();
});

render();
setInterval(render, 30000);
