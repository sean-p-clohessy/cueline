export type PassageKind =
  | "verse"
  | "chorus"
  | "bridge"
  | "outro"
  | "instrumental";
export interface Passage {
  id: string;
  kind: PassageKind;
  text: string;
  start: number | null;
  estimated: boolean;
}
export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm: number | null;
  intro: number;
  countdown: number;
  notes: string;
  passages: Passage[];
  lyricSource: { type: "user" | "original-demo"; reference?: string };
  updatedAt: number;
}
export interface SetEntry {
  id: string;
  songId: string;
}
export interface Setlist {
  id: string;
  name: string;
  entries: SetEntry[];
  updatedAt: number;
}
export type PlaybackMode = "automatic" | "manual" | "rehearsal";
export interface Settings {
  id: "preferences";
  fontSize: number;
  spacing: number;
  alignment: "left" | "center";
  theme: "charcoal" | "black";
  density: "focus" | "context";
  showArtist: boolean;
  showZones: boolean;
  onboardingDone: boolean;
}
export const defaults: Settings = {
  id: "preferences",
  fontSize: 48,
  spacing: 1.3,
  alignment: "center",
  theme: "charcoal",
  density: "context",
  showArtist: true,
  showZones: false,
  onboardingDone: false,
};
export const uid = () => crypto.randomUUID();
export const emptySong = (): Song => ({
  id: uid(),
  title: "",
  artist: "",
  duration: 240,
  bpm: null,
  intro: 0,
  countdown: 5,
  notes: "",
  passages: [],
  lyricSource: { type: "user" },
  updatedAt: Date.now(),
});
export const newPassage = (text = ""): Passage => ({
  id: uid(),
  text,
  kind: "verse",
  start: null,
  estimated: false,
});
export function splitLyrics(text: string): Passage[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => newPassage(p.trim()));
}
export function estimateTimings(song: Song): Passage[] {
  const step = (song.duration - song.intro) / Math.max(1, song.passages.length);
  return song.passages.map((p, i) => ({
    ...p,
    start: Math.round((song.intro + step * i) * 10) / 10,
    estimated: true,
  }));
}
export function timingIssues(song: Song): string[] {
  const issues: string[] = [];
  let last = -1;
  for (const p of song.passages) {
    if (p.start === null) {
      issues.push(
        "Some passages have no timestamp. Use Manual mode or estimate timings.",
      );
      continue;
    }
    if (
      !Number.isFinite(p.start) ||
      p.start < song.intro ||
      p.start >= song.duration
    )
      issues.push("Cues must fall after the intro and before the song ends.");
    if (p.start <= last)
      issues.push("Passage timestamps must increase in passage order.");
    last = p.start;
  }
  return [...new Set(issues)];
}
export function moveItem<T extends { id: string }>(
  items: T[],
  active: string,
  over: string,
): T[] {
  const from = items.findIndex((i) => i.id === active),
    to = items.findIndex((i) => i.id === over);
  if (from < 0 || to < 0 || from === to) return items;
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
export const time = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(Math.max(0, seconds) % 60)
    .toString()
    .padStart(2, "0")}`;
export function parseTime(value: string): number | null {
  if (!value.trim()) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const match = value.match(/^(\d+):([0-5]\d)(\.\d+)?$/);
  return match
    ? Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0)
    : null;
}
