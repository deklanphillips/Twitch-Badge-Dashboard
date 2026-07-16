// Personal drop tracker — 100% on-device, no backend.
//
// Users "star" badges they want and mark ones they've earned. State lives in
// AsyncStorage. Starring a badge schedules a local "ending soon" reminder from
// the badge's end date (see notifications.ts). Nothing leaves the phone.
import AsyncStorage from "@react-native-async-storage/async-storage";

const WANT_KEY = "bd.want";
const EARNED_KEY = "bd.earned";

async function readSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

async function writeSet(key: string, set: Set<string>): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify([...set]));
}

export async function getWanted(): Promise<Set<string>> {
  return readSet(WANT_KEY);
}

export async function getEarned(): Promise<Set<string>> {
  return readSet(EARNED_KEY);
}

export async function setWanted(setId: string, wanted: boolean): Promise<Set<string>> {
  const s = await readSet(WANT_KEY);
  if (wanted) s.add(setId);
  else s.delete(setId);
  await writeSet(WANT_KEY, s);
  return s;
}

export async function setEarned(setId: string, earned: boolean): Promise<Set<string>> {
  const s = await readSet(EARNED_KEY);
  if (earned) s.add(setId);
  else s.delete(setId);
  await writeSet(EARNED_KEY, s);
  return s;
}
