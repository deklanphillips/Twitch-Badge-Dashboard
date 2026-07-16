// Data layer for the BadgeDrops app.
//
// The app is a thin native client over the same public JSON the website reads
// from GitHub Pages — no separate backend. The GitHub Action refreshes these
// files every ~30 minutes.
//
//   /api/global-badges.json   Twitch global badge catalog (images, titles)
//   /api/global-emotes.json   Twitch global emote catalog
//   /api/events.json          consolidated dated drops (added by the web build;
//                             we fall back to auto-events.json until it exists)
//
import Constants from "expo-constants";

const API_BASE =
  (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ??
  "https://badgedrops.com";

export type BadgeVersion = {
  id: string;
  title?: string;
  description?: string;
  image_url_1x?: string;
  image_url_2x?: string;
  image_url_4x?: string;
};

export type BadgeSet = {
  set_id: string;
  versions: BadgeVersion[];
};

export type Emote = {
  id: string;
  name: string;
  images?: { url_1x?: string; url_2x?: string; url_4x?: string };
};

export type DropEvent = {
  name: string;
  channel?: string;
  description?: string;
  requirement?: string;
  start?: string | null;
  end?: string | null;
  badge: { set: string; version: string };
  where?: { type: string; label?: string; url?: string };
  group?: string;
  groupLabel?: string;
  confirmed?: boolean;
};

export type EventStatus = "live" | "upcoming" | "ended";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchBadges(): Promise<BadgeSet[]> {
  const data = await getJson<{ data: BadgeSet[] }>("/api/global-badges.json");
  return data.data ?? [];
}

export async function fetchEmotes(): Promise<Emote[]> {
  const data = await getJson<{ data: Emote[] }>("/api/global-emotes.json");
  return data.data ?? [];
}

// Prefer the consolidated events.json; fall back to the raw auto-events file
// so the app keeps working before that endpoint ships.
export async function fetchEvents(): Promise<DropEvent[]> {
  try {
    const events = await getJson<DropEvent[]>("/api/events.json");
    if (Array.isArray(events) && events.length) return events.filter((e) => e.confirmed !== false);
  } catch {
    // events.json not published yet — fall through
  }
  const auto = await getJson<DropEvent[]>("/api/auto-events.json");
  return (auto ?? []).filter((e) => e.confirmed !== false);
}

export function badgeImage(set: BadgeSet | undefined, versionId?: string): string | undefined {
  if (!set) return undefined;
  const v = set.versions.find((x) => x.id === versionId) ?? set.versions[0];
  return v?.image_url_4x ?? v?.image_url_2x ?? v?.image_url_1x;
}

export function statusOf(ev: DropEvent, now = Date.now()): EventStatus {
  const start = ev.start ? Date.parse(ev.start) : NaN;
  const end = ev.end ? Date.parse(ev.end) : NaN;
  if (!isNaN(start) && now < start) return "upcoming";
  if (!isNaN(end) && now > end) return "ended";
  return "live";
}

// Live first, then upcoming, then ended; within a band, soonest end first
// (open-ended sinks to the bottom) — the same ordering the website uses.
export function sortEvents(events: DropEvent[], now = Date.now()): DropEvent[] {
  const order: Record<EventStatus, number> = { live: 0, upcoming: 1, ended: 2 };
  return [...events].sort((a, b) => {
    const sd = order[statusOf(a, now)] - order[statusOf(b, now)];
    if (sd !== 0) return sd;
    const ea = a.end ? Date.parse(a.end) : null;
    const eb = b.end ? Date.parse(b.end) : null;
    if (ea === null && eb === null) return Date.parse(a.start ?? "0") - Date.parse(b.start ?? "0");
    if (ea === null) return 1;
    if (eb === null) return -1;
    return ea - eb;
  });
}

export function badgePageUrl(ev: DropEvent): string {
  if (ev.group) return `${API_BASE}/group?id=${encodeURIComponent(ev.group)}`;
  return `${API_BASE}/badge?set=${encodeURIComponent(ev.badge.set)}&version=${encodeURIComponent(ev.badge.version)}`;
}
