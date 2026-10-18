import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chooseRecording,
  groupArtists,
  parseLrc,
  plainPassages,
  prepareLyrics,
  songFromRecord,
  timedPassages,
  type LyricsRecord,
} from "./lyrics";
import { defaults, timingIssues } from "./model";
import { readImport } from "./backup";

const record = (patch: Partial<LyricsRecord> = {}): LyricsRecord => ({
  id: 123,
  trackName: "Lantern Road",
  artistName: "The Northbound",
  albumName: "Evening Stories",
  duration: 120,
  instrumental: false,
  plainLyrics: "An original line\nAnother original line",
  syncedLyrics:
    "[00:08.25]An original line\n[00:12.00]Another original line\n[00:20.00]\n[00:40.00]A returning light",
  ...patch,
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("automatic lyric preparation", () => {
  it('keeps late cues when importing an LRC longer than the default duration',()=>{
    const song=prepareLyrics('Long original','Original artist','[00:05]Early line\n[07:00]Late line');
    expect(song.duration).toBe(430);expect(song.passages.at(-1)?.start).toBe(420);expect(timingIssues(song)).toEqual([]);
  });
  it('preserves all words when provider cues overrun the recording duration',()=>{
    const song=songFromRecord(record({duration:10,syncedLyrics:'[00:02]Early original line\n[00:12]Late original line',plainLyrics:'Early original line\nLate original line'}));
    expect(song.passages.map(p=>p.text).join('\n')).toContain('Late original line'); expect(song.passages.every(p=>p.estimated)).toBe(true);expect(timingIssues(song)).toEqual([]);
  });
  it("preserves fractional timing, sorting, offsets and repeated timestamps", () => {
    expect(
      parseLrc("[offset:-250]\n[00:20.50][00:40.50]Repeat\n[00:03.00]First"),
    ).toEqual([
      { start: 2.75, text: "First" },
      { start: 20.25, text: "Repeat" },
      { start: 40.25, text: "Repeat" },
    ]);
  });
  it("merges simultaneous lines and removes word-level stamps", () => {
    expect(parseLrc("[00:01.00]One\n[00:01.00]<00:01.20>Two")[0]).toEqual({
      start: 1,
      text: "One\nTwo",
    });
  });
  it("ignores metadata and malformed timestamps", () => {
    expect(parseLrc("[ar:The Northbound]\n[00:99]bad\n[bad]none")).toEqual([]);
  });
  it("splits an unformatted paste into manageable prompts without user work", () => {
    const passages = plainPassages(
      "Line one\nLine two\nLine three\nLine four\nLine five\nLine six\nLine seven",
    );
    expect(passages.map((p) => p.text.split("\n").length)).toEqual([3, 3, 1]);
  });
  it("honours stanza labels and preserves repeated choruses with unique IDs", () => {
    const passages = plainPassages(
      "[Chorus]\nAn original refrain\n\n[Chorus]\nAn original refrain",
    );
    expect(passages.map((p) => p.kind)).toEqual(["chorus", "chorus"]);
    expect(passages[0].id).not.toBe(passages[1].id);
  });
  it("turns long timed gaps into instrumental prompts", () => {
    const passages = timedPassages(record().syncedLyrics!, 120);
    expect(passages.map((p) => ({ start: p.start, kind: p.kind }))).toEqual([
      { start: 8.25, kind: "verse" },
      { start: 20, kind: "instrumental" },
      { start: 40, kind: "verse" },
    ]);
  });
  it("uses the first lyric time as the intro and is immediately valid for Automatic mode", () => {
    const song = songFromRecord(record());
    expect(song.intro).toBe(8.25);
    expect(song.passages.every((p) => !p.estimated)).toBe(true);
    expect(timingIssues(song)).toEqual([]);
    expect(song.lyricSource.type).toBe("lrclib");
  });
  it("uses plain text with clearly estimated cues when synced lyrics are malformed", () => {
    const song = songFromRecord(record({ syncedLyrics: "[not a timestamp]" }));
    expect(song.passages[0].text).toBe(record().plainLyrics);
    expect(song.passages.every((p) => p.estimated)).toBe(true);
    expect(timingIssues(song)).toEqual([]);
  });
  it("supports instrumental-only records and refuses an empty import", () => {
    expect(
      songFromRecord(
        record({ instrumental: true, plainLyrics: null, syncedLyrics: null }),
      ).passages[0].kind,
    ).toBe("instrumental");
    expect(() =>
      songFromRecord(record({ plainLyrics: null, syncedLyrics: null })),
    ).toThrow("no usable lyrics");
  });
  it("prepares pasted lyrics without requiring a passage editor", () => {
    const song = prepareLyrics(
      "My tune",
      "My band",
      "Line one\nLine two\n\nLine three",
    );
    expect(song.passages).toHaveLength(2);
    expect(timingIssues(song)).toEqual([]);
  });
  it("prefers timed studio versions over live or untimed versions", () => {
    const studio = record();
    expect(
      chooseRecording([
        record({ id: 4, albumName: "Live at the club" }),
        record({ id: 5, syncedLyrics: null }),
        studio,
      ]),
    ).toBe(studio);
  });
  it("groups recordings by artist instead of listing the same artist repeatedly", () => {
    const groups = groupArtists(
      [
        {
          id: "1",
          title: "Lantern Road",
          artist: "The Northbound",
          duration: 120,
          score: 100,
        },
        {
          id: "2",
          title: "LANTERN ROAD",
          artist: "The Northbound",
          duration: 121,
          score: 100,
        },
        {
          id: "3",
          title: "Lantern Road",
          artist: "Other Artist",
          duration: 130,
          score: 100,
        },
      ],
      "Lantern Road",
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].recordings).toBe(2);
  });
  it("round-trips source attribution and lyrics through existing backups", () => {
    const song = songFromRecord(record());
    const imported = readImport(
      JSON.stringify({
        format: "cueline",
        version: 1,
        exportedAt: "",
        songs: [song],
        setlists: [],
        settings: defaults,
      }),
    );
    expect(imported.songs[0]).toEqual(song);
  });
});
describe("lyrics provider reliability", () => {
  it("identifies the browser client, matches the chosen artist and caches results", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            record(),
            record({ id: 2, artistName: "Wrong artist" }),
          ]),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const { findLyrics } = await import("./lyrics");
    const result = await findLyrics("Lantern Road", "The Northbound");
    await findLyrics("Lantern Road", "The Northbound");
    expect(result).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers["Lrclib-Client"]).toContain(
      "CueLine",
    );
  });
  it("rejects a fresh offline lookup without a network call", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { findLyrics } = await import("./lyrics");
    await expect(findLyrics("Offline song", "Offline band")).rejects.toThrow(
      "Connect once",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("honours Retry-After rather than repeatedly hitting a limited service", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "30" },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const { findLyrics } = await import("./lyrics");
    await expect(findLyrics("Limited lookup", "One artist")).rejects.toThrow(
      "busy",
    );
    await expect(findLyrics("Another lookup", "Other artist")).rejects.toThrow(
      "busy",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
