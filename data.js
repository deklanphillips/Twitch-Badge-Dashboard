// Real Twitch badge drop events, curated from official announcements and
// community trackers (Twitch's API does not expose event dates/requirements,
// so this list is maintained by hand — edit it to add new events).
// Dates are ISO 8601 (UTC). `badge: { set, version }` links an event directly
// to its Twitch badge detail page from the schedule.
const BADGE_EVENTS = [
  {
    name: "QSMP Season 2",
    channel: "QSMP",
    description:
      "Watch 60 minutes of any eligible QSMP channel to earn the QSMP2 badge.",
    emoji: "🟩",
    requirement: "Watch 60 minutes",
    start: "2026-03-14T17:00:00Z",
    end: "2026-07-01T14:59:00Z",
    badge: { set: "qsmp2", version: "1" },
  },
  {
    name: "Brawlhalla Fest 2026",
    channel: "Brawlhalla",
    description:
      "Subscribe or gift a sub to any eligible channel streaming in the Brawlhalla category to earn the BrawlhallAwoo badge.",
    emoji: "⚔️",
    requirement: "Sub or gift sub",
    start: "2026-05-20T16:00:00Z",
    end: "2026-06-16T15:58:00Z",
    badge: { set: "brawlhallawoo", version: "1" },
  },
  {
    name: "007 First Light Launch",
    channel: "007 First Light",
    description:
      "Subscribe or gift a sub to any eligible channel streaming in the 007 First Light category to earn the 007 Gun Barrel badge. Watching 1–2 hours also earns free in-game outfit drops.",
    emoji: "🔫",
    requirement: "Sub or gift sub",
    start: "2026-05-26T14:00:00Z",
    end: "2026-06-23T13:59:00Z",
    badge: { set: "007-gun-barrel", version: "1" },
  },
  {
    name: "Rematch US",
    channel: "REMATCH",
    description:
      "Earned in eligible channels streaming in the REMATCH category during the promotion window (regional Rematch badges were also available, e.g. France).",
    emoji: "⚽",
    requirement: "See badge page",
    start: "2026-06-11T08:00:00Z",
    end: "2026-07-09T07:59:00Z",
    badge: { set: "rematch-us", version: "1" },
  },
  {
    name: "Crimson Butterfly",
    channel: "FATAL FRAME II REMAKE",
    description:
      "Awarded to people who subscribed (Prime doesn't count) or gifted a subscription to any eligible channel streaming in the FATAL FRAME II: Crimson Butterfly REMAKE category.",
    emoji: "🦋",
    requirement: "Sub or gift sub",
    start: "2026-03-12T07:00:00Z",
    end: "2026-03-23T04:59:00Z",
    badge: { set: "crimson-butterfly", version: "1" },
  },
];
