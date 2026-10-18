import { useState, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  WandSparkles,
  Scissors,
  Combine,
  Copy,
  Trash2,
  Play,
  Check,
  Download,
  FileText,
  Clock3,
} from "lucide-react";
import {
  splitLyrics,
  estimateTimings,
  newPassage,
  timingIssues,
  moveItem,
  time,
  parseTime,
  uid,
  type Song,
  type Passage,
} from "./model";
import { SortableList, Modal } from "./ui";
import { downloadJson } from "./backup";

export function Editor({
  initial,
  save,
  back,
  preview,
}: {
  initial: Song;
  save: (song: Song) => Promise<void>;
  back: () => void;
  preview: (song: Song) => void;
}) {
  const [song, setSong] = useState(initial);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState("");
  const [paste, setPaste] = useState(false);
  const [lyrics, setLyrics] = useState("");
  const [replace, setReplace] = useState(false);
  const selections = useRef(new Map<string, number>());
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  function update(next: Song) {
    next = { ...next, updatedAt: Date.now() };
    setSong(next);
    setSaved(false);
    setError("");
    // Serialize immediate writes: rapid edits cannot land out of order.
    const currentRevision = ++revision.current;
    queue.current = queue.current
      .catch(() => {})
      .then(() => save(next))
      .then(() => {
        if (revision.current === currentRevision) setSaved(true);
      })
      .catch(() =>
        setError("Could not save. Export this song now to keep your changes."),
      );
  }
  const change = (patch: Partial<Song>) => update({ ...song, ...patch });
  const passage = (id: string, patch: Partial<Passage>) =>
    change({
      passages: song.passages.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });
  function split(p: Passage) {
    const at = selections.current.get(p.id) ?? Math.floor(p.text.length / 2);
    if (at <= 0 || at >= p.text.length) {
      setError("Place the text cursor where you want to split the passage.");
      return;
    }
    const i = song.passages.indexOf(p);
    const list = [...song.passages];
    list.splice(
      i,
      1,
      { ...p, text: p.text.slice(0, at).trim() },
      { ...newPassage(p.text.slice(at).trim()), kind: p.kind },
    );
    change({ passages: list });
  }
  function merge(index: number) {
    const list = [...song.passages];
    const a = list[index - 1],
      b = list[index];
    list.splice(index - 1, 2, { ...a, text: `${a.text}\n${b.text}` });
    change({ passages: list });
  }
  const issues = timingIssues(song);
  return (
    <div className="editor page-enter">
      <div className="page-top">
        <button className="text-btn" onClick={back}>
          <ArrowLeft size={20} /> Library
        </button>
        <span className="save-status">
          <Check size={16} />
          {error
            ? "Save needs attention"
            : saved
              ? "Saved on this device"
              : "Saving…"}
        </span>
      </div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SONG EDITOR</p>
          <h1>{song.title || "Untitled song"}</h1>
          <p>Make every line easy to find.</p>
        </div>
        <button
          className="btn primary"
          disabled={!song.title.trim() || !saved}
          onClick={() => preview(song)}
        >
          <Play size={18} /> Stage preview
        </button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {song.lyricSource.type === "lrclib" && (
        <p className="helper source-attribution">
          Community lyrics from{" "}
          <a href="https://lrclib.net/" target="_blank" rel="noreferrer">
            LRCLIB
          </a>
          {song.lyricSource.recording ? ` · ${song.lyricSource.recording}` : ""}
          .{" "}
          {song.passages.some((p) => p.estimated)
            ? "Passages are ready; timings are estimates."
            : "Cue timings follow the selected recording."}{" "}
          Your live arrangement may differ.
        </p>
      )}
      <div className="editor-grid">
        <div className="editor-main">
          <section className="panel metadata-grid">
            <label>
              Song title
              <input
                value={song.title}
                maxLength={300}
                onChange={(e) => change({ title: e.target.value })}
                placeholder="Give your song a name"
              />
            </label>
            <label>
              Artist
              <input
                value={song.artist}
                maxLength={300}
                onChange={(e) => change({ artist: e.target.value })}
                placeholder="Artist or band"
              />
            </label>
          </section>
          <div className="section-head">
            <div>
              <h2>
                Lyric passages{" "}
                <span className="count">{song.passages.length}</span>
              </h2>
              <p>One thought at a time. Drag the handle to reorder.</p>
            </div>
            <button className="btn" onClick={() => setPaste(true)}>
              <FileText size={18} /> Paste lyrics
            </button>
          </div>
          <div className="passages">
            <SortableList
              items={song.passages}
              onMove={(a, b) =>
                change({ passages: moveItem(song.passages, a, b) })
              }
            >
              {(p, i, handle) => (
                <section className="passage-card">
                  <div className="passage-head">
                    {handle}
                    <span className="ordinal">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <label className="sr-only" htmlFor={`kind-${p.id}`}>
                      Passage {i + 1} type
                    </label>
                    <select
                      id={`kind-${p.id}`}
                      value={p.kind}
                      onChange={(e) =>
                        passage(p.id, {
                          kind: e.target.value as Passage["kind"],
                        })
                      }
                    >
                      {[
                        "verse",
                        "chorus",
                        "bridge",
                        "outro",
                        "instrumental",
                      ].map((k) => (
                        <option key={k} value={k}>
                          {k[0].toUpperCase() + k.slice(1)}
                        </option>
                      ))}
                    </select>
                    <div className="cue-field">
                      <Clock3 size={16} />
                      <TimeField
                        label={`Passage ${i + 1} start time`}
                        value={p.start}
                        onChange={(start) =>
                          passage(p.id, { start, estimated: false })
                        }
                      />
                      <span className="estimate-label">
                        {p.estimated
                          ? "est."
                          : p.start === null
                            ? "no cue"
                            : "cue"}
                      </span>
                    </div>
                  </div>
                  <textarea
                    aria-label={`Passage ${i + 1} text`}
                    value={p.text}
                    rows={Math.max(3, Math.min(9, p.text.split("\n").length))}
                    placeholder={
                      p.kind === "instrumental"
                        ? "e.g. Guitar solo · 8 bars"
                        : "Write a few lines…"
                    }
                    onSelect={(e) =>
                      selections.current.set(
                        p.id,
                        e.currentTarget.selectionStart,
                      )
                    }
                    onChange={(e) => passage(p.id, { text: e.target.value })}
                  />
                  <div className="passage-actions">
                    <button className="text-btn" onClick={() => split(p)}>
                      <Scissors size={16} /> Split at cursor
                    </button>
                    <button
                      className="text-btn"
                      disabled={i === 0}
                      onClick={() => merge(i)}
                    >
                      <Combine size={16} /> Merge above
                    </button>
                    <button
                      className="icon-btn"
                      title="Repeat passage"
                      aria-label={`Repeat passage ${i + 1}`}
                      onClick={() => {
                        const list = [...song.passages];
                        list.splice(i + 1, 0, {
                          ...p,
                          id: uid(),
                          start: null,
                          estimated: false,
                        });
                        change({ passages: list });
                      }}
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      className="icon-btn danger"
                      aria-label={`Remove passage ${i + 1}`}
                      onClick={() => {
                        if (confirm("Remove this passage?"))
                          change({
                            passages: song.passages.filter(
                              (x) => x.id !== p.id,
                            ),
                          });
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </section>
              )}
            </SortableList>
          </div>
          <button
            className="add-passage"
            onClick={() =>
              change({ passages: [...song.passages, newPassage()] })
            }
          >
            <Plus size={20} /> Add passage
          </button>
        </div>
        <aside className="editor-aside">
          <section className="panel">
            <h2>
              <Clock3 size={19} /> Song timing
            </h2>
            <label>
              Song duration
              <TimeField
                label="Song duration"
                value={song.duration}
                onChange={(v) => {
                  if (v !== null && v > song.intro && v <= 86400)
                    change({ duration: v });
                }}
              />
            </label>
            <div className="two-fields">
              <label>
                Intro (seconds)
                <input
                  type="number"
                  min="0"
                  max={song.duration - 1}
                  value={song.intro}
                  onChange={(e) =>
                    change({
                      intro: Math.max(
                        0,
                        Math.min(song.duration - 1, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
              <label>
                Count-in (seconds)
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={song.countdown}
                  onChange={(e) =>
                    change({
                      countdown: Math.max(
                        0,
                        Math.min(60, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
            </div>
            <label>
              Tempo (BPM, optional)
              <input
                type="number"
                min="1"
                max="500"
                value={song.bpm ?? ""}
                onChange={(e) =>
                  change({
                    bpm: e.target.value
                      ? Math.min(500, Math.max(1, Number(e.target.value)))
                      : null,
                  })
                }
              />
            </label>
            <button
              className="btn full"
              disabled={!song.passages.length}
              onClick={() => {
                if (
                  song.passages.some((p) => p.start !== null) &&
                  !confirm(
                    "Replace current timestamps with evenly spaced estimates?",
                  )
                )
                  return;
                change({ passages: estimateTimings(song) });
              }}
            >
              <WandSparkles size={18} /> Estimate timings
            </button>
            <p className="helper">
              Estimates space passages evenly after the intro. Rehearse to make
              them accurate.
            </p>
            {issues.map((issue) => (
              <p className="notice" key={issue}>
                {issue}
              </p>
            ))}
            {song.passages.some((p) => p.estimated) && (
              <p className="tag amber">
                Estimated cues · rehearse before a gig
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Musician notes</h2>
            <textarea
              aria-label="Musician notes"
              value={song.notes}
              rows={5}
              placeholder="Capo, key, arrangement, reminders…"
              onChange={(e) => change({ notes: e.target.value })}
            />
            <p className="helper">Shown before you start the song.</p>
          </section>
          <button
            className="btn full"
            onClick={() =>
              downloadJson(
                { format: "cueline-song", version: 1, song },
                `${song.title || "song"}.json`,
              )
            }
          >
            <Download size={18} /> Export this song
          </button>
        </aside>
      </div>
      {paste && (
        <Modal title="Paste your lyrics" onClose={() => setPaste(false)} wide>
          <p className="modal-copy">
            Leave a blank line between passages. Use lyrics you wrote or have
            permission to use.
          </p>
          <textarea
            className="paste-area"
            aria-label="Full song lyrics"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={"First verse…\n\nChorus…\n\nNext verse…"}
          />
          {song.passages.length > 0 && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />{" "}
              Replace existing passages
            </label>
          )}
          <div className="modal-footer">
            <span>{splitLyrics(lyrics).length} passages detected</span>
            <button
              className="btn primary"
              disabled={!lyrics.trim()}
              onClick={() => {
                change({
                  passages: [
                    ...(replace ? [] : song.passages),
                    ...splitLyrics(lyrics),
                  ],
                });
                setPaste(false);
                setLyrics("");
              }}
            >
              Create passages
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function TimeField({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display =
    value === null
      ? ""
      : time(value) + (value % 1 ? (value % 1).toFixed(1).slice(1) : "");
  return (
    <input
      aria-label={label}
      className="time-input"
      inputMode="decimal"
      placeholder="mm:ss"
      value={draft ?? display}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        const parsed = parseTime(e.target.value);
        if (parsed !== null || !e.target.value.trim()) onChange(parsed);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
