import { describe, it, expect, beforeEach } from "vitest";
import { CueClock } from "./engine";
import {
  emptySong,
  newPassage,
  estimateTimings,
  splitLyrics,
  moveItem,
  timingIssues,
  parseTime,
  type Song,
} from "./model";
import { demoSongs, demoSetlist } from "./demo";
import { validateBackup, readImport, remapBackup, type Backup } from "./backup";
import { defaults } from "./model";

let now = 0;
const song = (): Song => ({
  ...emptySong(),
  title: "Test",
  duration: 60,
  countdown: 5,
  intro: 8,
  passages: [8, 20, 40].map((start, i) => ({
    ...newPassage(`Passage ${i}`),
    start,
  })),
});
const clock = (mode: "automatic" | "manual" | "rehearsal" = "automatic") =>
  new CueClock(song(), mode, () => now);
beforeEach(() => {
  now = 0;
});
describe("monotonic transport", () => {
  it("counts down before the song timeline starts", () => {
    const c = clock();
    c.play();
    now = 3000;
    expect(c.read()).toMatchObject({ countdown: 2, elapsed: 0, index: -1 });
    now = 5000;
    expect(c.read()).toMatchObject({ countdown: 0, elapsed: 0, intro: true });
  });
  it("pauses and resumes partway through countdown", () => {
    const c = clock();
    c.play();
    now = 2000;
    c.pause();
    now = 20000;
    expect(c.read().countdown).toBe(3);
    c.play();
    now = 23000;
    expect(c.read().elapsed).toBe(0);
    now = 24000;
    expect(c.read().elapsed).toBe(1);
  });
  it("handles intro then the first cue, including an exact boundary", () => {
    const c = clock();
    c.play();
    now = 12999;
    expect(c.read().intro).toBe(true);
    now = 13000;
    expect(c.read()).toMatchObject({ intro: false, index: 0, elapsed: 8 });
  });
  it("uses actual elapsed time when rendering is delayed", () => {
    const c = clock();
    c.play();
    now = 45600;
    expect(c.read()).toMatchObject({ index: 2, elapsed: 40.6 });
  });
  it("does not advance while paused during the intro", () => {
    const c = clock();
    c.play();
    now = 8000;
    c.pause();
    now = 23000;
    expect(c.read().elapsed).toBe(3);
    c.play();
    now = 25000;
    expect(c.read().elapsed).toBe(5);
  });
  it("recalibrates automatic playback to a manual passage change", () => {
    const c = clock();
    c.play();
    now = 14000;
    c.passage(1);
    expect(c.read()).toMatchObject({ index: 1, elapsed: 20, state: "playing" });
    now = 16000;
    expect(c.read()).toMatchObject({ index: 1, elapsed: 22 });
    c.passage(-1);
    now = 17000;
    expect(c.read()).toMatchObject({ index: 0, elapsed: 9 });
  });
  it("nudges the authoritative clock in both directions", () => {
    const c = clock();
    c.play();
    now = 20000;
    c.nudge(3);
    expect(c.read().elapsed).toBe(18);
    c.nudge(-3);
    expect(c.read().elapsed).toBe(15);
    now = 21000;
    expect(c.read().elapsed).toBe(16);
  });
  it("ends at song duration and does not restart itself", () => {
    const c = clock();
    c.play();
    now = 80000;
    expect(c.read()).toMatchObject({ state: "ended", elapsed: 60 });
    c.play();
    now = 90000;
    expect(c.read().state).toBe("ended");
    c.restart();
    expect(c.read()).toMatchObject({ state: "ready", countdown: 5 });
  });
  it("manual passages never progress automatically and clamp at ends", () => {
    const c = clock("manual");
    c.play();
    now = 15000;
    expect(c.read().index).toBe(-1);
    c.passage(1);
    now = 30000;
    expect(c.read().index).toBe(0);
    c.passage(-1);
    expect(c.read().index).toBe(0);
    for (let i = 0; i < 20; i++) c.passage(1);
    expect(c.read().index).toBe(2);
  });
  it("rehearsal rejects countdown/paused taps then captures exact cues", () => {
    const c = clock("rehearsal");
    expect(c.capture()).toBeNull();
    c.play();
    now = 2000;
    expect(c.capture()).toBeNull();
    now = 13000;
    expect(c.capture()).toEqual({ index: 0, seconds: 8 });
    now = 25050;
    expect(c.capture()).toEqual({ index: 1, seconds: 20.1 });
    c.pause();
    expect(c.capture()).toBeNull();
    c.restart();
    c.play();
    now += 13000;
    expect(c.capture()).toEqual({ index: 0, seconds: 8 });
  });
  it("interruptions freeze at a known position until resumed", () => {
    const c = clock();
    c.play();
    now = 15000;
    const v = c.read();
    now = 999999;
    c.interruptAt(v);
    expect(c.read()).toMatchObject({
      state: "paused",
      elapsed: 10,
      interrupted: true,
    });
    c.play();
    now += 1000;
    expect(c.read().elapsed).toBe(11);
  });
  it("restores countdown after reload without silently starting", () => {
    const c = clock();
    c.play();
    now = 2000;
    const v = c.read();
    const resumed = clock();
    resumed.interruptAt(v);
    now = 100000;
    expect(resumed.read()).toMatchObject({ state: "paused", countdown: 3 });
  });
  it("handles zero countdown and zero intro", () => {
    const s = song();
    s.countdown = 0;
    s.intro = 0;
    s.passages[0].start = 0;
    const c = new CueClock(s, "automatic", () => now);
    c.play();
    expect(c.read()).toMatchObject({ countdown: 0, intro: false, index: 0 });
  });
  it("supports an empty song in Manual mode", () => {
    const s = song();
    s.passages = [];
    const c = new CueClock(s, "manual", () => now);
    c.passage(1);
    expect(c.read().index).toBe(-1);
  });
});
describe("passages and setlists", () => {
  it("splits on blank lines and gives repeats unique IDs", () => {
    const p = splitLyrics("One\nline\n\nChorus\n\nChorus");
    expect(p.map((x) => x.text)).toEqual(["One\nline", "Chorus", "Chorus"]);
    expect(new Set(p.map((x) => x.id)).size).toBe(3);
    expect(splitLyrics("   ")).toEqual([]);
  });
  it("estimates evenly across available duration after the intro", () => {
    const s = song();
    expect(estimateTimings(s).map((p) => p.start)).toEqual([8, 25.3, 42.7]);
    expect(estimateTimings(s).every((p) => p.estimated)).toBe(true);
  });
  it("flags missing, decreasing, pre-intro and out-of-bounds times", () => {
    const s = song();
    s.passages[0].start = null;
    s.passages[1].start = 70;
    s.passages[2].start = -1;
    expect(timingIssues(s)).toHaveLength(3);
  });
  it("reorders entries by stable entry ID while preserving repeated song IDs", () => {
    const e = [
      { id: "a", songId: "same" },
      { id: "b", songId: "other" },
      { id: "c", songId: "same" },
    ];
    expect(moveItem(e, "c", "a").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(e.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(moveItem(e, "missing", "a")).toBe(e);
  });
  it("parses mm:ss and fractional seconds and rejects invalid input", () => {
    expect(parseTime("1:20.5")).toBe(80.5);
    expect(parseTime("12.4")).toBe(12.4);
    expect(parseTime("1:99")).toBeNull();
    expect(parseTime("-3")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
});
const backup = (): Backup => ({
  format: "cueline",
  version: 1,
  exportedAt: new Date().toISOString(),
  songs: demoSongs(),
  setlists: [demoSetlist()],
  settings: defaults,
});
describe("backup validation and collision handling", () => {
  it("preserves an unfinished song draft in exported backups", () => {
    const b = backup(); b.songs.push(emptySong());
    expect(() => readImport(JSON.stringify(b))).not.toThrow();
  });
  it("round trips a full backup", () => {
    const b = backup();
    expect(readImport(JSON.stringify(b))).toEqual(b);
  });
  it("rejects malformed JSON, unknown versions and missing fields", () => {
    expect(() => readImport("{bad")).toThrow("valid JSON");
    expect(() => validateBackup({ ...backup(), version: 99 })).toThrow();
    expect(() => validateBackup({})).toThrow();
  });
  it("rejects invalid numbers and broken setlist references", () => {
    const b = backup();
    b.songs[0].duration = NaN;
    expect(() => validateBackup(b)).toThrow();
    const c = backup();
    c.setlists[0].entries[0].songId = "missing";
    expect(() => validateBackup(c)).toThrow("missing songs");
  });
  it("rejects duplicate song, entry and passage IDs", () => {
    const a = backup();
    a.songs.push(a.songs[0]);
    expect(() => validateBackup(a)).toThrow();
    const b = backup();
    b.setlists[0].entries.push(b.setlists[0].entries[0]);
    expect(() => validateBackup(b)).toThrow();
    const c = backup();
    c.songs[0].passages.push(c.songs[0].passages[0]);
    expect(() => validateBackup(c)).toThrow();
  });
  it("merges with fresh IDs and preserves references including repeats", () => {
    const b = backup();
    b.setlists[0].entries.push({ ...b.setlists[0].entries[0], id: "repeat" });
    const result = remapBackup(b);
    expect(result.songs[0].id).not.toBe(b.songs[0].id);
    expect(result.setlists[0].entries[0].songId).toBe(result.songs[0].id);
    expect(result.setlists[0].entries[3].songId).toBe(result.songs[0].id);
    expect(() => validateBackup(result)).not.toThrow();
  });
  it("imports a single song wrapper", () => {
    const s = demoSongs()[0];
    expect(
      readImport(
        JSON.stringify({ format: "cueline-song", version: 1, song: s }),
      ).songs,
    ).toEqual([s]);
  });
  it("rejects invalid settings and unreasonably large collections", () => {
    const b = backup();
    b.settings.fontSize = 500;
    expect(() => validateBackup(b)).toThrow();
    expect(() => readImport("x".repeat(25_000_001))).toThrow("large");
  });
});
