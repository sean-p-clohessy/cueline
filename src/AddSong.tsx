import { useRef, useState } from "react";
import {
  Search,
  Plus,
  Music2,
  FileText,
  Check,
  WifiOff,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import { Modal } from "./ui";
import {
  chooseRecording,
  findLyrics,
  searchCoverSongs,
  prepareLyrics,
  songFromRecord,
  type ArtistResult,
  type LyricsRecord,
} from "./lyrics";
import { time, type Song } from "./model";

export function AddSong({
  close,
  save,
  existing,
}: {
  close: () => void;
  save: (song: Song) => Promise<void>;
  existing: Song[];
}) {
  const [tab, setTab] = useState<"cover" | "own">("cover");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArtistResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [duration, setDuration] = useState(240);
  const [versions, setVersions] = useState<{
    artist: ArtistResult;
    records: LyricsRecord[];
  } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const guard = useRef(false);
  const closed = useRef(false);
  const closeSafe = () => {
    closed.current = true;
    close();
  };
  async function persist(record: LyricsRecord) {
    const song = songFromRecord(record);
    await save(song);
    close();
  }
  async function add(result: ArtistResult, chooseVersion = false) {
    if (guard.current) return;
    guard.current = true;
    setAdding(result.id);
    setError("");
    try {
      const records = await findLyrics(result.title, result.artist);
      if (closed.current) return;
      const best = chooseRecording(records);
      if (!best)
        throw new Error(
          "No lyrics were found for this artist’s version. Try another artist, or choose My own lyrics. Nothing has been added.",
        );
      if (chooseVersion) {
        setVersions({ artist: result, records });
        setSelected(best.id);
      } else await persist(best);
    } catch (e) {
      setError(
        e instanceof Error &&
          e.name !== "TypeError" &&
          e.name !== "TimeoutError"
          ? e.message
          : "Could not reach the lyrics service. Please try again when connected. Nothing has been added.",
      );
    } finally {
      setAdding(null);
      guard.current = false;
    }
  }
  return (
    <Modal title="Add a song" onClose={closeSafe} wide>
      <div
        className="add-song-tabs"
        role="tablist"
        aria-label="How to add a song"
        onKeyDown={(e) => {
          if (adding) return;
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          e.preventDefault();
          const next =
            e.key === "Home"
              ? "cover"
              : e.key === "End"
                ? "own"
                : tab === "cover"
                  ? "own"
                  : "cover";
          setTab(next);
          document.getElementById(`add-${next}-tab`)?.focus();
        }}
      >
        <button
          role="tab"
          id="add-cover-tab"
          aria-controls="add-song-panel"
          tabIndex={tab === "cover" ? 0 : -1}
          disabled={!!adding}
          aria-selected={tab === "cover"}
          className={tab === "cover" ? "selected" : ""}
          onClick={() => {
            setTab("cover");
            setError("");
          }}
        >
          <Search size={20} /> Find a cover
        </button>
        <button
          role="tab"
          id="add-own-tab"
          aria-controls="add-song-panel"
          tabIndex={tab === "own" ? 0 : -1}
          disabled={!!adding}
          aria-selected={tab === "own"}
          className={tab === "own" ? "selected" : ""}
          onClick={() => {
            setTab("own");
            setError("");
          }}
        >
          <FileText size={20} /> My own lyrics
        </button>
      </div>
      {tab === "cover" ? (
        <div
          role="tabpanel"
          id="add-song-panel"
          aria-labelledby="add-cover-tab"
        >
          <p className="modal-copy cover-intro">
            Find the song. Pick the artist. You’re ready.
          </p>
          <form
            className="cover-search"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!query.trim() || searching || adding) return;
              setSearching(true);
              setError("");
              setVersions(null);
              setResults([]);
              try {
                setResults(await searchCoverSongs(query));
                setSearched(true);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Search is unavailable. Try again when connected.",
                );
              } finally {
                setSearching(false);
              }
            }}
          >
            <label className="sr-only" htmlFor="cover-query">
              Find a cover song
            </label>
            <div className="search-box">
              <Search size={22} />
              <input
                autoFocus
                id="cover-query"
                value={query}
                maxLength={300}
                placeholder="Song title, e.g. Addicted to Love"
                autoComplete="off"
                enterKeyHint="search"
                disabled={searching || !!adding}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setError("");
                  setSearched(false);
                  setResults([]);
                  setVersions(null);
                }}
              />
            </div>
            <button
              className="btn primary"
              disabled={!query.trim() || searching || !!adding}
            >
              {searching ? (
                <>
                  <LoaderCircle className="spinner" size={20} /> Searching…
                </>
              ) : (
                <>
                  <Search size={20} /> Search
                </>
              )}
            </button>
          </form>
          {!navigator.onLine && (
            <p className="notice">
              <WifiOff size={17} /> Connect once to find new covers. Songs
              already saved on your device still work offline.
            </p>
          )}
          {searching && (
            <div className="cover-search-empty" role="status">
              <LoaderCircle className="spinner" size={30} />
              <p>Finding artists and recordings…</p>
            </div>
          )}
          {!searching && !searched && !results.length && (
            <div className="cover-search-empty">
              <Music2 size={35} />
              <h3>Your next cover is a search away.</h3>
              <p>
                Lyrics, passages and available cue timings
                <br />
                are prepared for you.
              </p>
            </div>
          )}
          {!!results.length && (
            <div className="cover-result-heading">
              <h3>Choose your artist</h3>
              <span>{results.length} matches</span>
            </div>
          )}
          <div className="cover-results" aria-busy={!!adding}>
            {results.map((r) => {
              const already = existing.find(
                (s) =>
                  s.title.toLowerCase() === r.title.toLowerCase() &&
                  s.artist.toLowerCase() === r.artist.toLowerCase() &&
                  s.passages.length,
              );
              return (
                <div className="cover-result" key={r.id}>
                  <div className="cover-result-text">
                    <strong>{r.artist || "Unknown artist"}</strong>
                    <span>{r.title}</span>
                    {r.version && <small>{r.version}</small>}
                    <button
                      className="text-btn recording-choice"
                      disabled={!!adding}
                      onClick={() => void add(r, true)}
                    >
                      {r.recordings > 1
                        ? "Choose a recording"
                        : "View recording"}
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  <button
                    className="btn primary"
                    aria-label={`Add ${r.title} by ${r.artist}`}
                    disabled={!!adding || !!already}
                    onClick={() => void add(r)}
                  >
                    {adding === r.id ? (
                      <>
                        <LoaderCircle className="spinner" size={19} />{" "}
                        Preparing…
                      </>
                    ) : already ? (
                      <>
                        <Check size={19} /> Added
                      </>
                    ) : (
                      <>
                        <Plus size={20} /> Add song
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          {searched && !searching && !results.length && !error && (
            <p className="notice">
              No matching recordings found. Try the song title without the
              artist’s name.
            </p>
          )}
          {versions && (
            <section className="recording-picker panel">
              <h3>{versions.artist.artist} · choose a recording</h3>
              <label>
                Album / version
                <select
                  aria-label="Recording version"
                  value={selected ?? ""}
                  onChange={(e) => setSelected(Number(e.target.value))}
                >
                  {versions.records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.albumName || "Unnamed recording"} · {time(r.duration)}{" "}
                      · {r.syncedLyrics ? "Timed lyrics" : "Lyrics only"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn primary full"
                disabled={!!adding}
                onClick={async () => {
                  const record = versions.records.find(
                    (r) => r.id === selected,
                  );
                  if (!record || guard.current) return;
                  guard.current = true;
                  setAdding(versions.artist.id);
                  setError("");
                  try {
                    await persist(record);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Could not save this song.",
                    );
                  } finally {
                    setAdding(null);
                    guard.current = false;
                  }
                }}
              >
                Add this recording
              </button>
            </section>
          )}
          {adding && (
            <p className="helper" role="status">
              Fetching lyrics, making readable passages and saving on this
              device…
            </p>
          )}
          <p className="cover-source-note">
            Community lyrics by{" "}
            <a href="https://lrclib.net/" target="_blank" rel="noreferrer">
              LRCLIB
            </a>
            . Use songs you’re entitled to perform. Saved songs work offline.
          </p>
        </div>
      ) : (
        <form
          role="tabpanel"
          id="add-song-panel"
          aria-labelledby="add-own-tab"
          onSubmit={async (e) => {
            e.preventDefault();
            if (guard.current || !title.trim() || !lyrics.trim()) return;
            guard.current = true;
            setAdding("own");
            setError("");
            try {
              await save(prepareLyrics(title, artist, lyrics, duration));
              close();
            } catch {
              setError(
                "Could not save this song. Your lyrics are still here; try again.",
              );
            } finally {
              setAdding(null);
              guard.current = false;
            }
          }}
        >
          <p className="modal-copy cover-intro">
            Paste or import your lyrics. We’ll make the passages.
          </p>
          <div className="two-fields">
            <label>
              Song title
              <input
                required
                value={title}
                maxLength={300}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Artist
              <input
                value={artist}
                maxLength={300}
                onChange={(e) => setArtist(e.target.value)}
              />
            </label>
          </div>
          <label>
            Lyrics
            <textarea
              aria-label="Your song lyrics"
              value={lyrics}
              required
              rows={7}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Paste the whole song. No need to split it yourself."
            />
          </label>
          <div className="own-lyrics-options">
            <label className="btn file-button">
              <FileText size={19} /> Import TXT or LRC
              <input
                type="file"
                accept=".txt,.lrc,text/plain"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 200000) {
                    setError("Choose a lyrics file under 200 KB.");
                    return;
                  }
                  setLyrics(await file.text());
                  if (!title.trim())
                    setTitle(file.name.replace(/\.[^.]+$/, ""));
                  e.target.value = "";
                }}
              />
            </label>
            <label>
              Duration (seconds)
              <input
                type="number"
                min="1"
                max="86400"
                value={duration}
                onChange={(e) =>
                  setDuration(
                    Math.min(86400, Math.max(1, Number(e.target.value))),
                  )
                }
              />
            </label>
          </div>
          <p className="helper">
            TXT is split into short prompts automatically. LRC files keep their
            cue timings. You can refine either in the editor later.
          </p>
          <button
            className="btn primary full"
            disabled={!title.trim() || !lyrics.trim() || !!adding}
            type="submit"
          >
            {adding ? "Saving…" : "Add song"}
          </button>
        </form>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
