const grid = document.getElementById("eventGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const tabs = document.querySelectorAll("#statusTabs .tab");
const cardTemplate = document.getElementById("cardTemplate");

const calendarView = document.getElementById("calendarView");
const calendarGrid = document.getElementById("calendarGrid");
const calTitle = document.getElementById("calTitle");
const viewTabs = document.querySelectorAll("#viewTabs .tab");

let activeStatus = "all";
let query = "";
let activeView = "calendar";
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function getStatus(event, now = Date.now()) {
  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "live";
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function countdownText(event, status, now = Date.now()) {
  if (status === "upcoming") return `Starts in ${formatDuration(Date.parse(event.start) - now)}`;
  if (status === "live") return `Live now — ends in ${formatDuration(Date.parse(event.end) - now)}`;
  return "Event ended";
}

function matchesQuery(event) {
  if (!query) return true;
  const haystack = `${event.name} ${event.channel} ${event.description}`.toLowerCase();
  return haystack.includes(query);
}

function statusRank(status) {
  return { live: 0, upcoming: 1, ended: 2 }[status];
}

const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function renderCalendar(events) {
  calTitle.textContent = monthFmt.format(calMonth);
  calendarGrid.replaceChildren();

  const today = new Date();
  const firstWeekday = calMonth.getDay();
  const gridStart = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1 - firstWeekday);

  // 6 weeks covers every month layout
  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dayStart = day.getTime();
    const dayEnd = dayStart + 86400000;

    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (day.getMonth() !== calMonth.getMonth()) cell.classList.add("other-month");
    if (sameDay(day, today)) cell.classList.add("today");

    const num = document.createElement("span");
    num.className = "cal-daynum";
    num.textContent = day.getDate();
    cell.append(num);

    for (const event of events) {
      const start = Date.parse(event.start);
      const end = Date.parse(event.end);
      if (start >= dayEnd || end < dayStart) continue;
      const chip = document.createElement("div");
      chip.className = `cal-chip ${event.status}`;
      if (start >= dayStart) chip.classList.add("chip-start");
      if (end < dayEnd) chip.classList.add("chip-end");
      chip.textContent = `${event.emoji} ${event.name}`;
      chip.title = `${event.name} — @${event.channel}\n${event.requirement}\n${dateFmt.format(new Date(event.start))} → ${dateFmt.format(new Date(event.end))}`;
      cell.append(chip);
    }

    calendarGrid.append(cell);
  }
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
    .sort(
      (a, b) =>
        statusRank(a.status) - statusRank(b.status) ||
        Date.parse(a.start) - Date.parse(b.start)
    );

  grid.replaceChildren(
    ...visible.map((event) => {
      const card = cardTemplate.content.cloneNode(true);
      card.querySelector(".badge-art").textContent = event.emoji;
      const pill = card.querySelector(".status-pill");
      pill.textContent = event.status;
      pill.classList.add(event.status);
      card.querySelector(".event-name").textContent = event.name;
      card.querySelector(".channel").textContent = `@${event.channel}`;
      card.querySelector(".description").textContent = event.description;
      card.querySelector(".start-time").textContent = dateFmt.format(new Date(event.start));
      card.querySelector(".end-time").textContent = dateFmt.format(new Date(event.end));
      card.querySelector(".requirement").textContent = event.requirement;
      const countdown = card.querySelector(".countdown");
      countdown.textContent = countdownText(event, event.status, now);
      countdown.classList.add(event.status);
      return card;
    })
  );

  emptyState.hidden = visible.length > 0 || activeView === "calendar";

  calendarView.hidden = activeView !== "calendar";
  grid.hidden = activeView !== "cards";
  if (activeView === "calendar") renderCalendar(visible);
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

viewTabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    viewTabs.forEach((t) => t.classList.toggle("active", t === tab));
    activeView = tab.dataset.view;
    render();
  })
);

document.getElementById("prevMonth").addEventListener("click", () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
  render();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
  render();
});

document.getElementById("todayBtn").addEventListener("click", () => {
  calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  render();
});

render();
setInterval(render, 30000);
