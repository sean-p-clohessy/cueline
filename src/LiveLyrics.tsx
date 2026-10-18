import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowUp,
  ArrowDown,
  SkipBack,
  SkipForward,
  Music2,
} from "lucide-react";
import type { Settings, Song } from "./model";
import { clampLine, lyricLines, nearestLine, recoveredLine } from "./live";
import "./live.css";

interface Props {
  song: Song;
  entryIndex: number;
  songCount: number;
  settings: Settings;
  suspended: boolean;
  navigate: (delta: number) => void;
  onPosition: (index: number, count: number) => void;
}

export function LiveLyrics({
  song,
  entryIndex,
  songCount,
  settings,
  suspended,
  navigate,
  onPosition,
}: Props) {
  const lines = useMemo(() => lyricLines(song), [song]);
  const [active, setActive] = useState(() => {
    try {
      return recoveredLine(
        JSON.parse(sessionStorage.getItem("cueline-live-position") ?? "null"),
        song.id,
        entryIndex,
        lines,
      );
    } catch {
      return 0;
    }
  });
  const activeRef = useRef(active);
  const scroll = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const spacers = useRef<(HTMLDivElement | null)[]>([]);
  const target = useRef<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef(0);
  const touch = useRef({ y: 0, moved: false, ended: 0 });
  const lastKey = useRef(-Infinity);
  const lastStep = useRef(-Infinity);

  const remember = useCallback(
    (value: number) => {
      const next = clampLine(value, lines.length);
      activeRef.current = next;
      setActive(next);
      onPosition(next, lines.length);
      try {
        sessionStorage.setItem(
          "cueline-live-position",
          JSON.stringify({
            songId: song.id,
            entryIndex,
            lineId: lines[next]?.id,
          }),
        );
      } catch {
        /* Lyric navigation still works without session recovery. */
      }
    },
    [lines, song.id, entryIndex, onPosition],
  );

  const center = useCallback((index: number, smooth = false) => {
    const viewport = scroll.current;
    const row = rows.current[index];
    if (!viewport || !row) return;
    const top =
      viewport.scrollTop +
      row.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      row.offsetHeight / 2 -
      viewport.clientHeight / 2;
    target.current = index;
    clearTimeout(settle.current);
    viewport.scrollTo({
      top,
      behavior:
        smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "instant",
    });
    settle.current = setTimeout(() => {
      target.current = null;
    }, 800);
  }, []);

  const select = useCallback(
    (index: number) => {
      const next = clampLine(index, lines.length);
      remember(next);
      center(next, true);
    },
    [remember, center, lines.length],
  );
  const step = (delta: number) => {
    if (performance.now() - lastStep.current < 300) return;
    lastStep.current = performance.now();
    select(activeRef.current + delta);
  };

  useLayoutEffect(() => {
    const viewport = scroll.current;
    if (!viewport) return;
    const resize = () => {
      // Make even the first and last line reachable at the center. Recenter on rotation,
      // font changes or wrapping without resetting the musician's chosen line.
      if (spacers.current[0])
        spacers.current[0].style.height = `${Math.max(0, (viewport.clientHeight - (rows.current[0]?.offsetHeight ?? 0)) / 2)}px`;
      if (spacers.current[1])
        spacers.current[1].style.height = `${Math.max(0, (viewport.clientHeight - (rows.current[lines.length - 1]?.offsetHeight ?? 0)) / 2)}px`;
      center(activeRef.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    for (const row of rows.current) if (row) observer.observe(row);
    return () => observer.disconnect();
  }, [
    center,
    lines.length,
    settings.fontSize,
    settings.spacing,
    settings.alignment,
  ]);

  useEffect(() => {
    remember(activeRef.current);
  }, [remember]);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(settle.current);
    },
    [],
  );

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        suspended ||
        event.repeat ||
        (event.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"],dialog',
        ) ||
        ((event.target as HTMLElement).closest("button") &&
          event.code === "Space")
      )
        return;
      if (!["ArrowLeft", "ArrowRight", "Space", "KeyR"].includes(event.code))
        return;
      event.preventDefault();
      if (performance.now() - lastKey.current < 250) return;
      lastKey.current = performance.now();
      if (event.code === "KeyR") {
        if (activeRef.current > 0 && !confirm("Return to the first line?"))
          return;
        select(0);
      } else select(activeRef.current + (event.code === "ArrowLeft" ? -1 : 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [select, suspended]);

  const userScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const viewport = scroll.current;
      if (!viewport || target.current !== null) return;
      const midpoint =
        viewport.getBoundingClientRect().top + viewport.clientHeight / 2;
      const next = nearestLine(
        rows.current.map((row) =>
          row
            ? row.getBoundingClientRect().top + row.offsetHeight / 2
            : Infinity,
        ),
        midpoint,
      );
      if (next !== activeRef.current) remember(next);
    });
  };

  return (
    <>
      <div className="live-follow-status">
        <span>
          <span className="status-dot" /> Live · You set the pace
        </span>
        <span aria-live="off">
          {lines.length
            ? `Line ${active + 1} of ${lines.length}`
            : "No lyrics yet"}
        </span>
      </div>
      <main
        className={`live-lyric-view live-density-${settings.density}`}
        style={
          {
            "--live-size": `${settings.fontSize}px`,
            "--live-spacing": settings.spacing,
            textAlign: settings.alignment,
          } as CSSProperties
        }
      >
        {lines.length ? (
          <>
            <div className="live-center-guide" aria-hidden="true" />
            <div
              className="live-scroll"
              ref={scroll}
              role="region"
              aria-label="Song lyrics. Scroll to change the active line"
              onScroll={userScroll}
              onWheel={() => {
                target.current = null;
              }}
              onTouchStart={(event) => {
                target.current = null;
                touch.current = {
                  y: event.touches[0].clientY,
                  moved: false,
                  ended: 0,
                };
              }}
              onTouchMove={(event) => {
                if (Math.abs(event.touches[0].clientY - touch.current.y) > 8)
                  touch.current.moved = true;
              }}
              onTouchEnd={() => {
                if (touch.current.moved)
                  touch.current.ended = performance.now();
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== "touch") target.current = null;
              }}
            >
              <div
                ref={(node) => {
                  spacers.current[0] = node;
                }}
                aria-hidden="true"
              />
              {lines.map((line, i) => (
                <button
                  key={line.id}
                  ref={(node) => {
                    rows.current[i] = node;
                  }}
                  className={`live-line ${i === active ? "is-active" : ""} ${Math.abs(i - active) <= 2 ? "is-near" : ""} ${line.sectionStart ? "section-start" : ""}`}
                  aria-label={`Line ${i + 1}: ${line.text}`}
                  aria-current={i === active ? "true" : undefined}
                  onClick={() => {
                    if (
                      touch.current.moved &&
                      performance.now() - touch.current.ended < 400
                    )
                      return;
                    select(i);
                  }}
                >
                  <span
                    className={
                      line.kind === "instrumental" ? "instrumental-line" : ""
                    }
                  >
                    {line.kind === "instrumental" && (
                      <Music2 size={22} aria-hidden="true" />
                    )}{" "}
                    {line.text}
                  </span>
                </button>
              ))}
              <div
                ref={(node) => {
                  spacers.current[1] = node;
                }}
                aria-hidden="true"
              />
            </div>
          </>
        ) : (
          <div className="live-empty">
            <Music2 size={36} />
            <h2>No lyrics in this song</h2>
            <p>Add lyrics in the song editor, then come back to the stage.</p>
          </div>
        )}
      </main>
      <div className="live-line-controls">
        <button
          className="btn"
          disabled={!lines.length || active === 0}
          onClick={() => step(-1)}
        >
          <ArrowUp size={23} /> Previous line
        </button>
        <button
          className="btn primary"
          disabled={!lines.length || active === lines.length - 1}
          onClick={() => step(1)}
        >
          Next line <ArrowDown size={23} />
        </button>
      </div>
      <div className="live-follow-hint">
        {lines.length && active === lines.length - 1
          ? "Last line. Take your time."
          : settings.showZones
            ? "Swipe up to go forward · Swipe down to go back · Tap any line to jump"
            : "Scroll or tap a line · No clock to follow"}
      </div>
      {songCount > 1 && (
        <nav className="live-song-navigation" aria-label="Setlist songs">
          <button
            className="btn"
            disabled={entryIndex === 0}
            onClick={() => navigate(-1)}
          >
            <SkipBack size={24} /> Previous song
          </button>
          <button
            className="btn"
            disabled={entryIndex === songCount - 1}
            onClick={() => navigate(1)}
          >
            Next song <SkipForward size={24} />
          </button>
        </nav>
      )}
    </>
  );
}
