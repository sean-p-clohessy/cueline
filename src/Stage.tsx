import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  RotateCcw,
  X,
  SlidersHorizontal,
  Minus,
  Plus,
  Maximize,
  Keyboard,
  ShieldCheck,
  Mic2,
  Check,
  Eye,
} from "lucide-react";
import { CueClock, type ClockView } from "./engine";
import {
  type Song,
  type Settings,
  type PlaybackMode,
  time,
  timingIssues,
} from "./model";
import { Modal } from "./ui";
import { TimeField } from "./Editor";
import { DisplaySettings } from "./Settings";

interface Session {
  songs: string[];
  name: string;
  index: number;
  mode: PlaybackMode;
}
export function readSession(): Session | null {
  try {
    const raw: unknown = JSON.parse(
      sessionStorage.getItem("cueline-session") ?? "null",
    );
    if (
      raw &&
      typeof raw === "object" &&
      "songs" in raw &&
      Array.isArray(raw.songs) &&
      "name" in raw &&
      typeof raw.name === "string" &&
      "index" in raw &&
      typeof raw.index === "number" &&
      "mode" in raw &&
      ["automatic", "manual", "rehearsal"].includes(String(raw.mode))
    )
      return raw as Session;
  } catch {
    /* Unavailable storage: stage still works. */
  }
  return null;
}
function store(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Session recovery is best effort; library stays in IndexedDB. */
  }
}
export function Stage({
  allSongs,
  session,
  settings,
  updateSettings,
  saveSong,
  exit,
}: {
  allSongs: Song[];
  session: Session;
  settings: Settings;
  updateSettings: (s: Settings) => void;
  saveSong: (s: Song) => Promise<void>;
  exit: () => void;
}) {
  const songs = session.songs
    .map((id) => allSongs.find((s) => s.id === id))
    .filter((s): s is Song => !!s);
  const [index, setIndex] = useState(Math.min(session.index, songs.length - 1));
  const [mode, setMode] = useState<PlaybackMode>(session.mode);
  const [options, setOptions] = useState(false);
  const [help, setHelp] = useState(false);
  const [review, setReview] = useState(false);
  const [wake, setWake] = useState("Screen sleep follows your device settings");
  const [captures, setCaptures] = useState<Record<string, number>>({});
  const capturesRef = useRef(captures);
  capturesRef.current = captures;
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const song = songs[index];
  const clock = useMemo(() => new CueClock(song, mode), [song, mode]);
  const [view, setView] = useState<ClockView>(() => clock.read());
  const latest = useRef(view);
  const lastTap = useRef(0);
  const lastPersist = useRef(0);
  const action = useCallback(
    (operation: () => void) => {
      operation();
      const next = clock.read();
      latest.current = next;
      setView(next);
      store("cueline-position", {
        songId: song.id,
        mode,
        view: next,
        captures: capturesRef.current,
      });
    },
    [clock, song.id, mode],
  );
  useEffect(() => {
    store("cueline-session", { ...session, index, mode });
    let recovered = clock.read();
    try {
      const snapshot = JSON.parse(
        sessionStorage.getItem("cueline-position") ?? "null",
      ) as {
        songId: string;
        mode: PlaybackMode;
        view: ClockView;
        captures: Record<string, number>;
      } | null;
      if (
        snapshot?.songId === song.id &&
        snapshot.mode === mode &&
        Number.isFinite(snapshot.view.elapsed)
      ) {
        clock.interruptAt(snapshot.view);
        recovered = clock.read();
        setCaptures(snapshot.captures ?? {});
      } else setCaptures({});
    } catch {
      /* Start fresh if transient data cannot be restored. */
    }
    latest.current = recovered;
    setView(recovered);
    let frame = 0;
    let previous = performance.now();
    const tick = () => {
      const now = performance.now();
      // A long device suspension never consumes the rest of a performance.
      if (now - previous > 10000 && latest.current.state === "playing")
        clock.interruptAt(latest.current);
      previous = now;
      const next = clock.read();
      latest.current = next;
      setView(next);
      if (now - lastPersist.current > 500) {
        store("cueline-position", {
          songId: song.id,
          mode,
          view: next,
          captures: capturesRef.current,
        });
        lastPersist.current = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const interrupt = () => {
      if (latest.current.state === "playing") {
        clock.pause(true);
        latest.current = clock.read();
        setView(latest.current);
        store("cueline-position", {
          songId: song.id,
          mode,
          view: latest.current,
          captures: capturesRef.current,
        });
      }
    };
    const hidden = () => {
      if (document.hidden) interrupt();
    };
    const pagehide = () => {
      if (latest.current.state === "playing") clock.pause(true);
      store("cueline-position", {
        songId: song.id,
        mode,
        view: clock.read(),
        captures: capturesRef.current,
      });
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (clock.read().state === "playing") e.preventDefault();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", interrupt);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("beforeunload", unload);
    return () => {
      cancelAnimationFrame(frame);
      clock.pause();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", interrupt);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("beforeunload", unload);
    };
    // Only the current song and playback mode reset the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, song.id, mode, index]);
  useEffect(() => {
    document.body.classList.add("on-stage");
    return () => document.body.classList.remove("on-stage");
  }, []);
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    let cancelled = false;
    async function request() {
      if (!("wakeLock" in navigator)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await next.release();
          return;
        }
        lock = next;
        setWake("Screen stays awake");
        next.addEventListener("release", () => {
          if (!cancelled)
            setWake("Screen lock released · check device sleep settings");
        });
      } catch {
        setWake("Wake lock unavailable · check device sleep settings");
      }
    }
    void request();
    const visible = () => {
      if (!document.hidden) void request();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      void lock?.release();
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  const navigate = useCallback(
    (delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= songs.length) return;
      if (
        clock.read().state === "playing" &&
        !confirm(`Pause this song and open “${songs[target].title}”?`)
      )
        return;
      if (
        Object.keys(capturesRef.current).length &&
        !confirm(
          "Leave this rehearsal recording? Save the timings first to keep them.",
        )
      )
        return;
      clock.pause();
      clock.restart();
      try {
        sessionStorage.removeItem("cueline-position");
      } catch {
        /* unavailable */
      }
      setIndex(target);
      setMessage("");
      capturesRef.current = {};
      setCaptures({});
    },
    [index, songs, clock],
  );
  const toggle = useCallback(
    () =>
      action(() =>
        clock.read().state === "playing" ? clock.pause() : clock.play(),
      ),
    [action, clock],
  );
  const restart = useCallback(() => {
    if (
      (clock.read().state === "playing" ||
        Object.keys(capturesRef.current).length) &&
      !confirm("Restart this song and clear this rehearsal recording?")
    )
      return;
    capturesRef.current = {};
    setCaptures({});
    action(() => clock.restart());
    setMessage("");
  }, [action, clock]);
  const nextPassage = useCallback(
    (delta: number) => {
      if (performance.now() - lastTap.current < 300) return;
      lastTap.current = performance.now();
      if (mode === "rehearsal") {
        if (delta < 0) return;
        const cue = clock.capture();
        if (cue) {
          const next = {
            ...capturesRef.current,
            [song.passages[cue.index].id]: cue.seconds,
          };
          capturesRef.current = next;
          setCaptures(next);
          const nextView = clock.read();
          latest.current = nextView;
          setView(nextView);
          store("cueline-position", {
            songId: song.id,
            mode,
            view: nextView,
            captures: next,
          });
        }
      } else action(() => clock.passage(delta));
    },
    [action, clock, mode, song.passages, song.id],
  );
  const leave = useCallback(() => {
    if (
      clock.read().state === "playing" &&
      !confirm("Pause the performance and leave Stage Mode?")
    )
      return;
    if (
      Object.keys(capturesRef.current).length &&
      !confirm("Leave without saving your rehearsal timings?")
    )
      return;
    clock.pause();
    try {
      sessionStorage.removeItem("cueline-session");
      sessionStorage.removeItem("cueline-position");
    } catch {
      /* unavailable */
    }
    exit();
  }, [clock, exit]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.repeat ||
        options ||
        help ||
        review ||
        target.closest(
          'input,textarea,select,[contenteditable="true"],dialog',
        ) ||
        (target.closest("button") && e.code === "Space")
      )
        return;
      if (
        [
          "Space",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "KeyR",
        ].includes(e.code)
      )
        e.preventDefault();
      if (e.code === "Space") toggle();
      if (e.code === "ArrowLeft") nextPassage(-1);
      if (e.code === "ArrowRight") nextPassage(1);
      if (e.code === "ArrowUp") navigate(-1);
      if (e.code === "ArrowDown") navigate(1);
      if (e.code === "KeyR") restart();
    };
    const back = () => {
      history.pushState(null, "", "#stage");
      leave();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("popstate", back);
    };
  }, [toggle, nextPassage, navigate, restart, options, help, review, leave]);
  const current = song.passages[view.index];
  const upcoming = song.passages[view.index + 1];
  const previous = song.passages[view.index - 1];
  const countdown = view.countdown > 0;
  const issues = timingIssues(song);
  const safeAutomatic = song.passages.length > 0 && issues.length === 0;
  const displayText = countdown
    ? view.state === "ready"
      ? "Your next line.\nRight on cue."
      : `${Math.ceil(view.countdown)}`
    : current?.text ||
      (view.intro
        ? "Instrumental Intro"
        : mode === "rehearsal"
          ? "Tap when the first passage begins"
          : mode === "manual"
            ? "Tap right for your first passage"
            : "Your first line is coming");
  async function saveRecording() {
    const next = {
      ...song,
      updatedAt: Date.now(),
      passages: song.passages.map((p) =>
        captures[p.id] !== undefined
          ? { ...p, start: captures[p.id], estimated: false }
          : p,
      ),
    };
    const problems = timingIssues(next);
    if (problems.length) {
      setMessage(problems.join(" "));
      return;
    }
    setSaving(true);
    try {
      await saveSong(next);
      capturesRef.current = {};
      setCaptures({});
      store("cueline-position", {
        songId: song.id,
        mode,
        view: clock.read(),
        captures: {},
      });
      setMessage("Rehearsal timings saved. Ready for Automatic mode.");
      setReview(false);
    } catch {
      setMessage("Could not save. Your recording is still here; try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className={`stage theme-${settings.theme}`}>
      <header className="stage-header">
        <button className="text-btn" aria-label="Leave stage" onClick={leave}>
          <X size={22} /> <span>Leave stage</span>
        </button>
        <div className="stage-song-title">
          <h1>{song.title}</h1>
          {settings.showArtist && <p>{song.artist}</p>}
        </div>
        <div className="stage-top-right">
          <span className="tag">
            {index + 1} / {songs.length}
          </span>
          <button
            className="icon-btn"
            aria-label="Stage display settings"
            onClick={() => setOptions(true)}
          >
            <SlidersHorizontal size={22} />
          </button>
        </div>
      </header>
      <div className="stage-status">
        <span
          className={`live-state ${view.state === "playing" ? "active" : ""}`}
        >
          <span className="status-dot" />
          {view.state === "ready"
            ? "Ready when you are"
            : view.state === "ended"
              ? "Song complete"
              : view.state === "paused"
                ? "Paused"
                : countdown
                  ? "Counting in"
                  : view.intro
                    ? "Instrumental intro"
                    : "Playing timeline"}
        </span>
        <div className="mode-switch" aria-label="Playback mode">
          {(["automatic", "manual", "rehearsal"] as const).map((m) => (
            <button
              key={m}
              className={mode === m ? "selected" : ""}
              onClick={() => {
                if (m === mode) return;
                if (
                  clock.read().state === "playing" &&
                  !confirm("Pause and restart in the new mode?")
                )
                  return;
                if (
                  Object.keys(captures).length &&
                  !confirm("Discard these unsaved rehearsal timings?")
                )
                  return;
                clock.pause();
                try {
                  sessionStorage.removeItem("cueline-position");
                } catch {
                  /* unavailable */
                }
                setCaptures({});
                setMode(m);
              }}
            >
              {m === "automatic"
                ? "Automatic"
                : m === "manual"
                  ? "Manual"
                  : "Rehearsal"}
            </button>
          ))}
        </div>
        <span className="stage-clock">
          {time(view.elapsed)} <span>/ {time(song.duration)}</span>
        </span>
      </div>
      {view.interrupted && (
        <div className="stage-notice" role="status">
          Playback paused after an interruption. Resume when you’re ready.
        </div>
      )}
      {mode === "automatic" && !safeAutomatic && (
        <div className="stage-notice">
          {song.passages.length
            ? "This song needs valid, ordered timestamps. Choose Manual or Rehearsal."
            : "This song has no passages yet. Add lyrics in the editor."}
        </div>
      )}
      {mode === "rehearsal" && (
        <div className="rehearsal-bar">
          <span>
            <Mic2 size={18} /> {Object.keys(captures).length} /{" "}
            {song.passages.length} cues captured
          </span>
          <button
            className="btn"
            disabled={!Object.keys(captures).length}
            onClick={() => {
              action(() => clock.pause());
              setReview(true);
            }}
          >
            Review & save timings
          </button>
        </div>
      )}
      <main
        className={`stage-lyrics density-${settings.density}`}
        style={
          {
            textAlign: settings.alignment,
            "--lyric-size": `${settings.fontSize}px`,
            "--lyric-spacing": settings.spacing,
          } as React.CSSProperties
        }
      >
        {settings.density === "context" && (
          <div className="context-passage previous">
            <span className="cue-label">
              {previous
                ? "PREVIOUS"
                : view.state === "ready"
                  ? "TAKE A BREATH. YOU KNOW THIS."
                  : " "}
            </span>
            <p>{previous?.text}</p>
          </div>
        )}
        <div
          className={`current-passage ${countdown && view.state !== "ready" ? "counting" : ""}`}
          key={`${song.id}-${view.index}-${countdown ? Math.ceil(view.countdown) : "lyric"}`}
        >
          <span className="cue-label">
            {countdown
              ? view.state === "ready"
                ? `${song.countdown} SECOND COUNT-IN · ${song.intro} SECOND INTRO`
                : "GET READY"
              : current
                ? `${current.kind.toUpperCase()} · PASSAGE ${view.index + 1}`
                : view.intro
                  ? "LET IT BREATHE"
                  : "UP NEXT"}
          </span>
          <p>{displayText}</p>
          {view.state === "ready" && song.notes && (
            <div className="stage-notes">{song.notes}</div>
          )}
        </div>
        {(settings.density === "context" ||
          view.intro ||
          countdown ||
          mode === "rehearsal") && (
          <div className="context-passage upcoming">
            <span className="cue-label">
              {upcoming ? "UP NEXT" : "END OF SONG"}
            </span>
            <p>
              {upcoming?.text ??
                (song.passages.length
                  ? "Let it ring."
                  : "Add lyrics in the song editor.")}
            </p>
          </div>
        )}
        {mode === "manual" && (
          <div className={`touch-zones ${settings.showZones ? "visible" : ""}`}>
            <button
              aria-label="Tap zone: previous passage"
              onClick={() => nextPassage(-1)}
            >
              {settings.showZones && <span>← Previous</span>}
            </button>
            <button
              aria-label="Tap zone: next passage"
              onClick={() => nextPassage(1)}
            >
              {settings.showZones && <span>Next →</span>}
            </button>
          </div>
        )}
      </main>
      <footer className="stage-footer">
        <div className="timeline-track">
          <div style={{ width: `${(view.elapsed / song.duration) * 100}%` }} />
          {song.passages
            .filter((p) => p.start !== null)
            .map((p) => (
              <span
                key={p.id}
                style={{ left: `${(p.start! / song.duration) * 100}%` }}
              />
            ))}
        </div>
        {view.state === "ended" && (
          <div className="song-ended">
            <span>Song complete. Take your time.</span>
            {index < songs.length - 1 && (
              <button className="btn primary" onClick={() => navigate(1)}>
                Open next song <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}
        <div className="transport">
          <div className="song-navigation">
            <button
              className="btn"
              aria-label="Previous song"
              disabled={index === 0}
              onClick={() => navigate(-1)}
            >
              <SkipBack size={18} />
              <span>Previous song</span>
            </button>
            <button
              className="btn"
              aria-label="Next song"
              disabled={index >= songs.length - 1}
              onClick={() => navigate(1)}
            >
              <span>Next song</span>
              <SkipForward size={18} />
            </button>
          </div>
          <div className="passage-transport">
            <button
              className="icon-btn"
              aria-label="Restart song"
              onClick={restart}
            >
              <RotateCcw size={22} />
            </button>
            <button
              className="icon-btn passage-nav"
              aria-label="Previous passage"
              disabled={mode === "rehearsal" || view.index < 0}
              onClick={() => nextPassage(-1)}
            >
              <ChevronLeft size={32} />
            </button>
            <button
              className="play-control"
              aria-label={
                view.state === "playing" ? "Pause timeline" : "Play timeline"
              }
              disabled={
                view.state === "ended" ||
                (mode === "automatic" && !safeAutomatic)
              }
              onClick={toggle}
            >
              {view.state === "playing" ? (
                <Pause size={28} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" />
              )}
            </button>
            <button
              className={`icon-btn passage-nav ${mode === "rehearsal" ? "capture-control" : ""}`}
              aria-label={
                mode === "rehearsal" ? "Capture next cue" : "Next passage"
              }
              disabled={
                !song.passages.length ||
                (mode === "rehearsal" &&
                  (view.state !== "playing" ||
                    countdown ||
                    Object.keys(captures).length === song.passages.length))
              }
              onClick={() => nextPassage(1)}
            >
              {mode === "rehearsal" ? (
                <>
                  <Mic2 size={25} />
                  <span>Tap cue</span>
                </>
              ) : (
                <ChevronRight size={32} />
              )}
            </button>
          </div>
          <div className="timing-nudges">
            <button
              className="btn"
              aria-label="Move timeline back 3 seconds"
              disabled={mode !== "automatic" || countdown}
              onClick={() => action(() => clock.nudge(-3))}
            >
              <Minus size={16} />
              3s
            </button>
            <button
              className="btn"
              aria-label="Move timeline forward 3 seconds"
              disabled={mode !== "automatic" || countdown}
              onClick={() => action(() => clock.nudge(3))}
            >
              <Plus size={16} />
              3s
            </button>
          </div>
        </div>
        <div className="stage-bottom">
          <span>
            <ShieldCheck size={15} />
            {wake}
          </span>
          <span className="stage-set-name">
            {session.name} · Visual timeline only
          </span>
          <div>
            <button className="text-btn" onClick={() => setHelp(true)}>
              <Keyboard size={17} /> Controls
            </button>
            <button
              className="icon-btn"
              aria-label="Toggle full screen"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else
                  void document.documentElement
                    .requestFullscreen?.()
                    .catch(() =>
                      setMessage(
                        "Use Safari’s Add to Home Screen for a full-screen experience.",
                      ),
                    );
              }}
            >
              <Maximize size={17} />
            </button>
          </div>
        </div>
        {message && (
          <p className="stage-notice" role="status">
            {message}
          </p>
        )}
      </footer>
      {options && (
        <Modal title="Make the stage yours" onClose={() => setOptions(false)}>
          <DisplaySettings settings={settings} update={updateSettings} />
          <p className="helper">
            <Eye size={16} /> Changes are saved on this device.
          </p>
        </Modal>
      )}
      {help && (
        <Modal title="Stage controls" onClose={() => setHelp(false)}>
          <p className="modal-copy">
            CueLine provides visual prompts. Play or perform your music
            separately.
          </p>
          <div className="shortcut-list">
            {[
              ["Space", "Play / pause"],
              ["← / →", "Previous / next passage (capture in Rehearsal)"],
              [
                "↑ / ↓",
                "Previous / next song, with confirmation while playing",
              ],
              ["R", "Restart song"],
            ].map(([key, value]) => (
              <div key={key}>
                <kbd>{key}</kbd>
                <span>{value}</span>
              </div>
            ))}
          </div>
          <p className="notice">
            Manual mode: tap the right side for the next passage, or the left
            side to go back. Rapid double-taps are ignored.
          </p>
          <p className="helper">
            Automatic mode: passage buttons move the timeline to that cue. −3s
            and +3s adjust the timeline. Returning from another app always
            leaves playback paused.
          </p>
          <button className="btn primary full" onClick={() => setHelp(false)}>
            Got it
          </button>
        </Modal>
      )}
      {review && (
        <Modal
          title="Review rehearsal timings"
          onClose={() => setReview(false)}
          wide
        >
          <p className="modal-copy">
            Your saved song stays unchanged until you choose Save timings.
            Uncaptured cues keep their previous values.
          </p>
          <div className="cue-review">
            {song.passages.map((p, i) => (
              <div className="review-row" key={p.id}>
                <span className="ordinal">{i + 1}</span>
                <span>
                  {p.text.split("\n")[0] || p.kind}
                  <small>
                    {captures[p.id] !== undefined
                      ? "Recorded cue"
                      : "Previous timing"}
                  </small>
                </span>
                <TimeField
                  label={`Recorded passage ${i + 1} time`}
                  value={captures[p.id] ?? p.start}
                  onChange={(value) => {
                    if (value !== null) {
                      const next = { ...capturesRef.current, [p.id]: value };
                      capturesRef.current = next;
                      setCaptures(next);
                      store("cueline-position", {
                        songId: song.id,
                        mode,
                        view: clock.read(),
                        captures: next,
                      });
                    }
                  }}
                />
              </div>
            ))}
          </div>
          <p className="helper">
            Times are mm:ss (or seconds). Cues must increase in order and follow
            the intro.
          </p>
          <div className="modal-footer">
            <button
              className="btn"
              onClick={() => {
                restart();
                if (!Object.keys(capturesRef.current).length) setReview(false);
              }}
            >
              Reset rehearsal
            </button>
            <button
              className="btn primary"
              disabled={saving}
              onClick={() => void saveRecording()}
            >
              <Check size={18} /> {saving ? "Saving…" : "Save timings to song"}
            </button>
          </div>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
export type { Session };
