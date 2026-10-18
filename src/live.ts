import type { Song, PassageKind } from "./model";

export interface LyricLine {
  id: string;
  text: string;
  kind: PassageKind;
  passageIndex: number;
  sectionStart: boolean;
}

// Display lines are derived, so switching views never rewrites saved passages or cues.
export function lyricLines(song: Song): LyricLine[] {
  return song.passages.flatMap((passage, passageIndex) => {
    const lines = passage.text
      .split(/\r?\n/)
      .map((text, index) => ({ text: text.trim(), index }))
      .filter(({ text }) => text.length > 0);
    if (!lines.length && passage.kind === "instrumental")
      lines.push({ text: "Instrumental", index: 0 });
    return lines.map(({ text, index }, lineIndex) => ({
      id: `${passage.id}:${index}`,
      text,
      kind: passage.kind,
      passageIndex,
      sectionStart: lineIndex === 0,
    }));
  });
}

export function clampLine(index: number, count: number): number {
  return Math.max(
    0,
    Math.min(
      Math.max(0, count - 1),
      Number.isFinite(index) ? Math.trunc(index) : 0,
    ),
  );
}

export function nearestLine(centers: number[], viewportCenter: number): number {
  if (!centers.length) return 0;
  let nearest = 0;
  for (let i = 1; i < centers.length; i++) {
    if (
      Math.abs(centers[i] - viewportCenter) <
      Math.abs(centers[nearest] - viewportCenter)
    )
      nearest = i;
  }
  return nearest;
}

export function recoveredLine(
  raw: unknown,
  songId: string,
  entryIndex: number,
  lines: LyricLine[],
): number {
  if (!raw || typeof raw !== "object") return 0;
  const saved = raw as Record<string, unknown>;
  if (
    saved.songId !== songId ||
    saved.entryIndex !== entryIndex ||
    typeof saved.lineId !== "string"
  )
    return 0;
  return Math.max(
    0,
    lines.findIndex((line) => line.id === saved.lineId),
  );
}
