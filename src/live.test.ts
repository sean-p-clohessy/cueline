import { describe, expect, it } from "vitest";
import { emptySong, newPassage } from "./model";
import { clampLine, lyricLines, nearestLine, recoveredLine } from "./live";

describe("live lyric lines", () => {
  it("derives individual lines without changing saved passages or timestamps", () => {
    const song = {
      ...emptySong(),
      passages: [
        { ...newPassage("First line\r\nSecond line\n\nThird line"), start: 12 },
      ],
    };
    const before = JSON.stringify(song);
    expect(lyricLines(song).map((line) => line.text)).toEqual([
      "First line",
      "Second line",
      "Third line",
    ]);
    expect(JSON.stringify(song)).toBe(before);
  });
  it("keeps repeated words and choruses independently selectable", () => {
    const song = {
      ...emptySong(),
      passages: [newPassage("Again\nAgain"), newPassage("Again")],
    };
    const lines = lyricLines(song);
    expect(new Set(lines.map((line) => line.id)).size).toBe(3);
    expect(lines.map((line) => line.passageIndex)).toEqual([0, 0, 1]);
    expect(lines.map((line) => line.sectionStart)).toEqual([true, false, true]);
  });
  it("keeps instrumental labels and provides a fallback for an empty instrumental", () => {
    const song = {
      ...emptySong(),
      passages: [
        { ...newPassage("Long guitar solo"), kind: "instrumental" as const },
        { ...newPassage(""), kind: "instrumental" as const },
        newPassage(" \n "),
      ],
    };
    expect(lyricLines(song).map((line) => line.text)).toEqual([
      "Long guitar solo",
      "Instrumental",
    ]);
    expect(lyricLines(emptySong())).toEqual([]);
  });
  it("clamps manual navigation at both ends and handles invalid positions", () => {
    expect(clampLine(-1, 10)).toBe(0);
    expect(clampLine(10, 10)).toBe(9);
    expect(clampLine(5, 0)).toBe(0);
    expect(clampLine(NaN, 10)).toBe(0);
    expect(clampLine(3.8, 10)).toBe(3);
  });
  it("selects the line nearest the viewport center in either scroll direction", () => {
    expect(nearestLine([40, 120, 240, 360], 230)).toBe(2);
    expect(nearestLine([40, 120, 240, 360], 100)).toBe(1);
    expect(nearestLine([], 100)).toBe(0);
    expect(nearestLine([40, 120], 80)).toBe(0);
  });
  it("recovers a stable line only for the same song and setlist appearance", () => {
    const song = { ...emptySong(), passages: [newPassage("One\nTwo\nThree")] };
    const lines = lyricLines(song);
    const saved = { songId: song.id, entryIndex: 2, lineId: lines[1].id };
    expect(recoveredLine(saved, song.id, 2, lines)).toBe(1);
    expect(recoveredLine(saved, song.id, 3, lines)).toBe(0);
    expect(recoveredLine(saved, "other", 2, lines)).toBe(0);
    expect(
      recoveredLine({ ...saved, lineId: "removed" }, song.id, 2, lines),
    ).toBe(0);
    expect(recoveredLine(null, song.id, 2, lines)).toBe(0);
    expect(recoveredLine("broken", song.id, 2, lines)).toBe(0);
  });
});
