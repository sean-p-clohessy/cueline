import {
  emptySong,
  estimateTimings,
  newPassage,
  type Passage,
  type Song,
  timingIssues,
} from "./model";
import { searchMetadata, type MetadataResult } from "./metadata";

export interface LyricsRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}
interface TimedLine {
  start: number;
  text: string;
}
export const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Parse common LRC timestamps, repeats and offsets without trusting embedded markup. */
export function parseLrc(text: string): TimedLine[] {
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000;
  const lines: TimedLine[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const stamps = [
      ...raw.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g),
    ];
    if (!stamps.length) continue;
    const content = raw
      .replace(/\[[^\]]*\]/g, "")
      .replace(/<\d+:\d+(?:\.\d+)?>/g, "")
      .trim();
    for (const stamp of stamps) {
      const start = Math.max(
        0,
        Number(stamp[1]) * 60 +
          Number(stamp[2]) +
          Number(`0.${stamp[3] ?? "0"}`) +
          offset,
      );
      lines.push({ start: Math.round(start * 1000) / 1000, text: content });
    }
  }
  const sorted = lines.sort((a, b) => a.start - b.start);
  // Simultaneous lines share one cue, rather than invalid duplicate timestamps.
  return sorted.reduce<TimedLine[]>((all, line) => {
    const last = all.at(-1);
    if (last?.start === line.start)
      last.text = [last.text, line.text].filter(Boolean).join("\n");
    else all.push({ ...line });
    return all;
  }, []);
}

/** Ready-to-read cues: honour stanza breaks, then cap long blocks at 3 lines / 150 characters. */
export function plainPassages(lyrics: string): Passage[] {
  const passages: Passage[] = [];
  for (const stanza of lyrics
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n/)) {
    const section = stanza
      .match(
        /^\s*\[?(verse|chorus|bridge|outro|instrumental)(?:\s+\d+)?\]?\s*:?\s*\n/i,
      )?.[1]
      ?.toLowerCase() as Passage["kind"] | undefined;
    const content = stanza.replace(
      /^\s*\[?(verse|chorus|bridge|outro|instrumental)(?:\s+\d+)?\]?\s*:?\s*\n/i,
      "",
    );
    let block: string[] = [];
    const flush = () => {
      if (block.length)
        passages.push({
          ...newPassage(block.join("\n")),
          kind: section ?? "verse",
        });
      block = [];
    };
    for (const line of content
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (
        block.length >= 3 ||
        (block.length && block.join("\n").length + line.length > 150)
      )
        flush();
      block.push(line);
    }
    flush();
  }
  return passages;
}

export function timedPassages(lrc: string, duration: number): Passage[] {
  const lines = parseLrc(lrc).filter((l) => l.start < duration);
  const result: Passage[] = [];
  let block: TimedLine[] = [];
  const flush = () => {
    if (block.length)
      result.push({
        ...newPassage(block.map((l) => l.text).join("\n")),
        start: block[0].start,
      });
    block = [];
  };
  let gap: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.text) {
      flush();
      if (gap === null) gap = line.start;
      continue;
    }
    // A timed blank followed by a long gap represents a useful instrumental cue.
    if (gap !== null) {
      if (
        result.length &&
        line.start - gap >= 12 &&
        gap > result[result.length - 1].start!
      )
        result.push({
          ...newPassage("Instrumental"),
          kind: "instrumental",
          start: gap,
        });
      gap = null;
    }
    const previous = block.at(-1);
    if (
      block.length >= 3 ||
      (previous &&
        (line.start - previous.start > 9 ||
          block.map((l) => l.text).join("\n").length + line.text.length > 150))
    )
      flush();
    block.push(line);
  }
  flush();
  return result;
}

export function prepareLyrics(
  title: string,
  artist: string,
  lyrics: string,
  duration = 240,
): Song {
  const lastCue=parseLrc(lyrics).filter(l=>l.text).at(-1)?.start;
  const resolvedDuration=lastCue!==undefined && lastCue>=duration ? Math.min(86400,Math.ceil(lastCue+10)) : duration;
  const song = {
    ...emptySong(),
    title: title.trim() || "Untitled song",
    artist: artist.trim(),
    duration:resolvedDuration,
  };
  song.passages = timedPassages(lyrics, resolvedDuration);
  if (song.passages.length) song.intro = song.passages[0].start ?? 0;
  else {
    song.passages = plainPassages(lyrics);
    song.passages = estimateTimings(song);
  }
  return song;
}

export interface ArtistResult extends MetadataResult {
  recordings: number;
}
export function groupArtists(
  records: MetadataResult[],
  query: string,
): ArtistResult[] {
  const q = normalize(query);
  const matching = records.filter(
    (r) => q.includes(normalize(r.title)) || normalize(r.title).includes(q),
  );
  const groups = new Map<string, ArtistResult>();
  for (const r of matching.length ? matching : records) {
    const key = `${normalize(r.title)}|${normalize(r.artist)}`;
    const old = groups.get(key);
    if (old) old.recordings++;
    else groups.set(key, { ...r, recordings: 1 });
  }
  return [...groups.values()].sort(
    (a, b) =>
      (b.score ?? 0) - (a.score ?? 0) ||
      b.recordings - a.recordings ||
      a.artist.localeCompare(b.artist),
  );
}

const resultCache = new Map<string, LyricsRecord[]>();
let requests = Promise.resolve();
let lastRequest = 0;
let backoff = 0;
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
function validRecord(v: unknown): v is LyricsRecord {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<LyricsRecord>;
  return (
    Number.isSafeInteger(r.id) &&
    typeof r.trackName === "string" &&
    r.trackName.length <= 300 &&
    typeof r.artistName === "string" &&
    r.artistName.length <= 300 &&
    typeof r.albumName === "string" &&
    r.albumName.length <= 300 &&
    typeof r.duration === "number" &&
    Number.isFinite(r.duration) &&
    r.duration >= 1 &&
    r.duration <= 86400 &&
    typeof r.instrumental === "boolean" &&
    (r.plainLyrics === null ||
      (typeof r.plainLyrics === "string" && r.plainLyrics.length <= 200000)) &&
    (r.syncedLyrics === null ||
      (typeof r.syncedLyrics === "string" && r.syncedLyrics.length <= 200000))
  );
}
export async function findLyrics(
  title: string,
  artist = "",
): Promise<LyricsRecord[]> {
  const key = `${normalize(title)}|${normalize(artist)}`;
  if (resultCache.has(key)) return resultCache.get(key)!;
  let output: LyricsRecord[] = [];
  // Sequential requests with a 350ms gap and Retry-After handling, per LRCLIB's client requirements.
  const request = requests
    .catch(() => {})
    .then(async () => {
      if (!navigator.onLine)
        throw new Error(
          "Connect once to add a cover. Your saved songs still work offline.",
        );
      if (Date.now() < backoff)
        throw new Error(
          "The lyrics service is busy. Please try again shortly.",
        );
      await sleep(Math.max(0, lastRequest + 350 - Date.now()));
      const params = new URLSearchParams({ track_name: title });
      if (artist) params.set("artist_name", artist);
      for (let attempt = 0; attempt < 2; attempt++) {
        lastRequest = Date.now();
        const response = await fetch(
          `https://lrclib.net/api/search?${params}`,
          {
            headers: {
              Accept: "application/json",
              "Lrclib-Client":
                "CueLine v1.1.0 (https://github.com/sean-p-clohessy/cueline)",
            },
            signal: AbortSignal.timeout(15000),
          },
        );
        if (response.status === 429 || response.status === 503) {
          const retry = response.headers.get("Retry-After");
          const delay =
            retry && Number.isFinite(Number(retry))
              ? Math.max(1, Number(retry)) * 1000
              : retry && Number.isFinite(Date.parse(retry))
                ? Math.max(1000, Date.parse(retry) - Date.now())
                : response.status === 429
                  ? 30000
                  : 1500;
          backoff = Date.now() + delay;
          if (attempt === 0 && response.status === 503 && delay <= 3000) {
            await sleep(delay);
            continue;
          }
          throw new Error(
            "The lyrics service is busy. Please try again shortly.",
          );
        }
        if (!response.ok)
          throw new Error(
            "Could not fetch lyrics. Please try again, or use your own lyrics.",
          );
        const payload: unknown = await response.json();
        if (!Array.isArray(payload))
          throw new Error(
            "The lyrics service returned an unexpected response. Please try again.",
          );
        output = payload
          .filter(validRecord)
          .filter(
            (r) =>
              (!artist || normalize(r.artistName) === normalize(artist)) &&
              normalize(r.trackName) === normalize(title) &&
              (!!r.syncedLyrics?.trim() ||
                !!r.plainLyrics?.trim() ||
                r.instrumental),
          );
        resultCache.set(key, output);
        if (!artist) {
          const byArtist = new Map<string, LyricsRecord[]>();
          for (const row of output) {
            const artistKey = `${normalize(row.trackName)}|${normalize(row.artistName)}`;
            byArtist.set(artistKey, [...(byArtist.get(artistKey) ?? []), row]);
          }
          for (const [artistKey, rows] of byArtist)
            resultCache.set(artistKey, rows);
        }
        break;
      }
    });
  requests = request.catch(() => {});
  await request;
  return output;
}

/** Discover available artists and preload their words in the same request. */
export async function searchCoverSongs(query: string): Promise<ArtistResult[]> {
  try {
    const rows = await findLyrics(query.trim());
    if (rows.length)
      return groupArtists(
        rows.map((r) => ({
          id: `lrclib-${r.id}`,
          title: r.trackName,
          artist: r.artistName,
          duration: r.duration,
          score: 100,
        })),
        query,
      );
  } catch (lyricsError) {
    try {
      const more = groupArtists(await searchMetadata(query), query);
      if (more.length) return more;
    } catch {
      /* Report the original, actionable lyrics-service error. */
    }
    throw lyricsError;
  }
  return groupArtists(await searchMetadata(query), query);
}

function recordScore(r: LyricsRecord): number {
  const lines=parseLrc(r.syncedLyrics ?? '').filter(l=>l.text);
  const synced=lines.length>0 && lines.every(l=>l.start<r.duration);
  return (
    (synced ? 100 : 0) -
    (/\blive\b|remix|karaoke|tribute|broadcast/i.test(
      `${r.trackName} ${r.albumName}`,
    )
      ? 30
      : 0) -
    (/best|greatest|hits|compilation|anthems/i.test(r.albumName) ? 5 : 0)
  );
}
export function chooseRecording(
  records: LyricsRecord[],
): LyricsRecord | undefined {
  return [...records].sort((a, b) => recordScore(b) - recordScore(a))[0];
}
export function songFromRecord(record: LyricsRecord): Song {
  const allLines=parseLrc(record.syncedLyrics ?? '').filter(l=>l.text);
  const hasTimed=allLines.length>0 && allLines.every(l=>l.start<record.duration);
  const song = prepareLyrics(
    record.trackName,
    record.artistName,
    hasTimed ? record.syncedLyrics! : record.plainLyrics || allLines.map(l=>l.text).join('\n'),
    record.duration,
  );
  if (!song.passages.length && record.plainLyrics) {
    song.passages = plainPassages(record.plainLyrics);
    song.passages = estimateTimings(song);
  }
  if (!song.passages.length && record.instrumental)
    song.passages = [
      { ...newPassage("Instrumental"), kind: "instrumental", start: 0 },
    ];
  if (!song.passages.length)
    throw new Error(
      "This version has no usable lyrics. Try another recording.",
    );
  song.lyricSource = {
    type: "lrclib",
    reference: `https://lrclib.net/api/get/${record.id}`,
    recording: record.albumName,
  };
  if (timingIssues(song).length)
    throw new Error("This recording has unusable cues. Try another version.");
  return song;
}
