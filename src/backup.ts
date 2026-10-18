import { defaults, uid, type Settings, type Song, type Setlist } from "./model";
import { db } from "./db";
export interface Backup {
  format: "cueline";
  version: 1;
  exportedAt: string;
  songs: Song[];
  setlists: Setlist[];
  settings: Settings;
}
const fail = (message: string): never => {
  throw new Error(message);
};
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 200000): v is string =>
  typeof v === "string" && v.length <= max;
const num = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
function validateSong(v: unknown): Song {
  if (
    !record(v) ||
    !str(v.id, 200) ||
    !v.id ||
    !str(v.title, 300) ||
    !str(v.artist, 300) ||
    !str(v.notes) ||
    !num(v.duration, 1, 86400) ||
    !num(v.intro, 0, v.duration - 0.001) ||
    !num(v.countdown, 0, 60) ||
    !(v.bpm === null || num(v.bpm, 1, 500)) ||
    !Array.isArray(v.passages) ||
    v.passages.length > 2000
  )
    return fail("A song has missing or invalid fields.");
  const ids = new Set<string>();
  for (const p of v.passages) {
    if (
      !record(p) ||
      !str(p.id, 200) ||
      !p.id ||
      ids.has(p.id) ||
      !str(p.text) ||
      !["verse", "chorus", "bridge", "outro", "instrumental"].includes(
        String(p.kind),
      ) ||
      !(p.start === null || num(p.start, 0, v.duration)) ||
      typeof p.estimated !== "boolean"
    )
      return fail("A lyric passage has invalid text, timing or ID.");
    ids.add(p.id);
  }
  if (
    !record(v.lyricSource) ||
    !["user", "original-demo"].includes(String(v.lyricSource.type)) ||
    !(
      v.lyricSource.reference === undefined ||
      str(v.lyricSource.reference, 2000)
    )
  )
    return fail("Invalid lyric source.");
  if (!num(v.updatedAt, 0, Number.MAX_SAFE_INTEGER))
    return fail("Invalid song date.");
  return v as unknown as Song;
}
function validateSettings(value: unknown): Settings {
  if (!record(value)) return fail("Invalid settings.");
  const s = { ...defaults, ...value };
  if (
    !num(s.fontSize, 24, 96) ||
    !num(s.spacing, 1, 2) ||
    !["left", "center"].includes(s.alignment) ||
    !["charcoal", "black"].includes(s.theme) ||
    !["focus", "context"].includes(s.density) ||
    typeof s.showArtist !== "boolean" ||
    typeof s.showZones !== "boolean" ||
    typeof s.onboardingDone !== "boolean"
  )
    return fail("Invalid display settings.");
  return { ...s, id: "preferences" };
}
export function validateBackup(value: unknown): Backup {
  if (
    !record(value) ||
    value.format !== "cueline" ||
    value.version !== 1 ||
    !Array.isArray(value.songs) ||
    !Array.isArray(value.setlists) ||
    value.songs.length > 10000 ||
    value.setlists.length > 2000
  )
    return fail("This is not a supported CueLine v1 backup.");
  const songs = value.songs.map(validateSong);
  const songIds = new Set(songs.map((s) => s.id));
  if (songIds.size !== songs.length)
    return fail("The backup contains duplicate song IDs.");
  const setIds = new Set<string>();
  const entryIds = new Set<string>();
  const setlists = value.setlists.map((v) => {
    if (
      !record(v) ||
      !str(v.id, 200) ||
      !v.id ||
      setIds.has(v.id) ||
      !str(v.name, 300) ||
      !v.name.trim() ||
      !num(v.updatedAt, 0, Number.MAX_SAFE_INTEGER) ||
      !Array.isArray(v.entries) ||
      v.entries.length > 10000
    )
      return fail("Invalid setlist.");
    setIds.add(v.id);
    for (const e of v.entries) {
      if (
        !record(e) ||
        !str(e.id, 200) ||
        !e.id ||
        entryIds.has(e.id) ||
        typeof e.songId !== "string" ||
        !songIds.has(e.songId)
      )
        return fail("Setlist entries contain invalid IDs or missing songs.");
      entryIds.add(e.id);
    }
    return v as unknown as Setlist;
  });
  return {
    format: "cueline",
    version: 1,
    exportedAt: str(value.exportedAt, 100) ? value.exportedAt : "",
    songs,
    setlists,
    settings: validateSettings(value.settings),
  };
}
export function readImport(text: string): Backup {
  if (text.length > 25_000_000)
    return fail("This file is too large (25 MB maximum).");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail("The file is not valid JSON. Your library has not changed.");
  }
  if (record(value) && value.format === "cueline-song" && value.version === 1) {
    return {
      format: "cueline",
      version: 1,
      exportedAt: "",
      songs: [validateSong(value.song)],
      setlists: [],
      settings: defaults,
    };
  }
  return validateBackup(value);
}
export function remapBackup(backup: Backup): Backup {
  const map = new Map(backup.songs.map((s) => [s.id, uid()]));
  return {
    ...backup,
    songs: backup.songs.map((s) => ({
      ...s,
      id: map.get(s.id)!,
      passages: s.passages.map((p) => ({ ...p, id: uid() })),
    })),
    setlists: backup.setlists.map((s) => ({
      ...s,
      id: uid(),
      entries: s.entries.map((e) => ({
        id: uid(),
        songId: map.get(e.songId)!,
      })),
    })),
  };
}
export async function restoreBackup(backup: Backup, replace: boolean) {
  const data = replace ? backup : remapBackup(backup);
  await db.transaction("rw", db.songs, db.setlists, db.settings, async () => {
    if (replace) {
      await db.songs.clear();
      await db.setlists.clear();
      await db.settings.put({ ...data.settings, onboardingDone: true });
    }
    await db.songs.bulkPut(data.songs);
    await db.setlists.bulkPut(data.setlists);
  });
}
export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
