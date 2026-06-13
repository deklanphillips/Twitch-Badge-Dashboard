// Real Twitch badge drop events, curated from official announcements and
// community trackers (Twitch's API does not expose event dates/requirements,
// so this list is maintained by hand — edit it to add new events).
// Dates are ISO 8601 (UTC). `badge: { set, version }` links an event directly
// to its Twitch badge detail page from the schedule.
// `where: { type: "category" | "channel" | "event", label, url }` points to
// the Twitch category (or specific streamer) the badge is earned in.
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
    where: { type: "event", label: "Eligible QSMP channels", url: "https://www.twitch.tv/search?term=QSMP" },
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
    where: { type: "category", label: "Brawlhalla category", url: "https://www.twitch.tv/directory/category/brawlhalla" },
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
    where: { type: "category", label: "007 First Light category", url: "https://www.twitch.tv/directory/category/007-first-light" },
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
    where: { type: "category", label: "REMATCH category", url: "https://www.twitch.tv/directory/category/rematch" },
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
    where: { type: "category", label: "FATAL FRAME II REMAKE category", url: "https://www.twitch.tv/search?term=FATAL%20FRAME%20II%20Crimson%20Butterfly%20REMAKE" },
  },

  // ── Historical events below: dates/set IDs from memory, NOT yet verified.
  // Double-check against Twitch announcements before trusting exact times.
  {
    name: "Minecraft 15th Anniversary",
    channel: "Minecraft",
    description:
      "Watch 15 minutes of any channel streaming in the Minecraft category during the 15th anniversary celebration to earn the badge.",
    emoji: "⛏️",
    requirement: "Watch 15 minutes",
    start: "2024-05-28T17:00:00Z",
    end: "2024-06-13T16:59:00Z",
    badge: { set: "minecraft-15th-anniversary-celebration", version: "1" },
    where: { type: "category", label: "Minecraft category", url: "https://www.twitch.tv/directory/category/minecraft" },
  },
  {
    name: "La Velada del Año IV",
    channel: "ibai",
    description:
      "Awarded for watching Ibai's La Velada del Año IV boxing event live on Twitch.",
    emoji: "🥊",
    requirement: "Watch the event",
    start: "2024-07-13T16:00:00Z",
    end: "2024-07-14T04:00:00Z",
    badge: { set: "la-velada-iv", version: "1" },
    where: { type: "channel", label: "twitch.tv/ibai", url: "https://www.twitch.tv/ibai" },
  },
  {
    name: "Destiny 2: The Final Shape Raid Race",
    channel: "Destiny 2",
    description:
      "Earned by watching coverage of the Salvation's Edge world-first raid race in the Destiny 2 category.",
    emoji: "🛡️",
    requirement: "Watch the raid race",
    start: "2024-06-07T17:00:00Z",
    end: "2024-06-09T17:00:00Z",
    badge: { set: "destiny-2-final-shape-raid-race", version: "1" },
    where: { type: "category", label: "Destiny 2 category", url: "https://www.twitch.tv/directory/category/destiny-2" },
  },
  {
    name: "The First Descendant Launch",
    channel: "The First Descendant",
    description:
      "Earned by subscribing to a streamer playing The First Descendant during launch week.",
    emoji: "🚀",
    requirement: "Sub or gift sub",
    start: "2025-08-07T00:00:00Z",
    end: "2025-08-21T00:00:00Z",
    badge: { set: "the-first-descendant-badge", version: "1" },
    where: { type: "category", label: "The First Descendant category", url: "https://www.twitch.tv/directory/category/the-first-descendant" },
  },
  {
    name: "Share the Love",
    channel: "Twitch",
    description:
      "Earned by gifting subscriptions during Twitch's Share the Love Valentine's promotion.",
    emoji: "💜",
    requirement: "Gift a sub",
    start: "2025-02-14T00:00:00Z",
    end: "2025-02-21T00:00:00Z",
    badge: { set: "share-the-love", version: "1" },
  },
];
