// Curated badge groupings: badges that belong to one campaign collapse into a
// single timeline bar (a row of icons) that links to a /group campaign page.
// Keyed by badge set_id -> group id. Labels below name each group.
//
// Only group badges that are genuinely one campaign (same drop window). The EWC
// watch tiers are grouped in api/auto-events.json already and don't need to be
// repeated here. Both app.js (timeline) and group.js (campaign page) read this.
const BADGE_GROUPS = {
  // Pokémon campaign — Oct 2026 → Jan 2027
  pikachu: "pokemon-2026", charizard: "pokemon-2026", charmeleon: "pokemon-2026",
  blastoise: "pokemon-2026", wartortle: "pokemon-2026", venusaur: "pokemon-2026",
  ivysaur: "pokemon-2026", gastly: "pokemon-2026", haunter: "pokemon-2026",
  gengar: "pokemon-2026",

  // Vaultbreakers — watch + sub tiers
  vaultbreakers: "vaultbreakers-2026", "vaultbreakers-golden": "vaultbreakers-2026",

  // Alien: Isolation
  "seegson-synthetics": "alien-isolation", "sevastopol-station": "alien-isolation",

  // TwitchCon San Diego 2026 ticket badges
  "twitchcon-2026---san-diego---beachball": "twitchcon-sd-2026",
  "twitchcon-2026---san-diego---taco": "twitchcon-sd-2026",

  // Dragon's Dogma II
  frekifriend: "dragons-dogma-ii", thedragonsdogma: "dragons-dogma-ii",

  // Dungeons & Dragons
  ampersand: "dnd-2026", d20: "dnd-2026",
};

const GROUP_LABELS = {
  "pokemon-2026": "Pokémon",
  "vaultbreakers-2026": "Vaultbreakers",
  "alien-isolation": "Alien: Isolation",
  "twitchcon-sd-2026": "TwitchCon San Diego 2026",
  "dragons-dogma-ii": "Dragon's Dogma II",
  "dnd-2026": "Dungeons & Dragons",
};
