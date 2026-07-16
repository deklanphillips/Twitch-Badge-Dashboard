// Shared visual tokens, matched to badgedrops.com's dark look.
export const theme = {
  bg: "#0e0e10",
  card: "#18181b",
  cardAlt: "#1f1f23",
  border: "#2a2a2e",
  text: "#efeff1",
  muted: "#adadb8",
  purple: "#9147ff",
  green: "#00c853",
  orange: "#ff9800",
  red: "#e53935",
};

export const statusColor: Record<string, string> = {
  live: theme.green,
  upcoming: theme.purple,
  ended: theme.muted,
};
