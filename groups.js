// Curated badge groupings: badges that belong to one campaign AND share the
// same earn requirement collapse into a single timeline bar (a row of icons)
// that links to a /group campaign page. Keyed by badge set_id -> group id.
//
// RULE: only group badges with the SAME requirement (e.g. all watch-time, like
// the EWC watch tiers). If a campaign mixes requirements (some watch, some sub),
// only the badges sharing a requirement are grouped; the others stay separate.
// The EWC watch tiers are grouped in api/auto-events.json already.
// Both app.js (timeline) and group.js (campaign page) read this.
const BADGE_GROUPS = {
  // Pokémon — kept together as one campaign even though gastly is sub-only
  // and the rest are watch-time (hand-curated exception to the same-req rule).
  pikachu: "pokemon-2026", charizard: "pokemon-2026", charmeleon: "pokemon-2026",
  blastoise: "pokemon-2026", wartortle: "pokemon-2026", venusaur: "pokemon-2026",
  ivysaur: "pokemon-2026", haunter: "pokemon-2026", gengar: "pokemon-2026",
  gastly: "pokemon-2026",

  // TwitchCon San Diego 2026 ticket badges — both "Attend TwitchCon"
  "twitchcon-2026---san-diego---beachball": "twitchcon-sd-2026",
  "twitchcon-2026---san-diego---taco": "twitchcon-sd-2026",
};

const GROUP_LABELS = {
  "pokemon-2026": "Pokémon",
  "twitchcon-sd-2026": "TwitchCon San Diego 2026",
};
