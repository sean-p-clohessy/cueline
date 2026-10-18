import { useState, useEffect, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  Music2,
  ListMusic,
  Settings2,
  ArrowUpRight,
  Plus,
  Search,
  Play,
  Pencil,
  Copy,
  Trash2,
  ListPlus,
  WifiOff,
  ShieldCheck,
  ChevronRight,
  AudioLines,
  BookOpen,
  X,
  Check,
  Globe,
} from "lucide-react";
import { db, initialize, loadLibrary, deleteSong } from "./db";
import {
  defaults,
  uid,
  time,
  type Song,
  type Setlist,
  type Settings as Preferences,
} from "./model";
import { Editor } from "./Editor";
import { Setlists } from "./Setlists";
import { Stage, readSession, type Session } from "./Stage";
import { Settings } from "./Settings";
import { Empty, Modal } from "./ui";
import { AddSong } from "./AddSong";
import { SetlistAddButton } from "./SetlistAddButton";

type Area = "library" | "setlists" | "settings";
interface LibraryData {
  songs: Song[];
  setlists: Setlist[];
  settings: Preferences;
}
export default function App() {
  const [data, setData] = useState<LibraryData>({
    songs: [],
    setlists: [],
    settings: defaults,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [area, setArea] = useState<Area>("library");
  const [editing, setEditing] = useState<Song | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [guide, setGuide] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [songAdded, setSongAdded] = useState<Song | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [toSet, setToSet] = useState<Song | null>(null);
  const [added, setAdded] = useState("");
  const [addToSetBusy, setAddToSetBusy] = useState(false);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: () => {
      void navigator.serviceWorker.ready.then(() => setCached(true));
    },
    onRegisterError: () =>
      setError(
        "Offline setup could not finish. Reconnect and reload before your gig.",
      ),
  });
  const [cached, setCached] = useState(false);
  const refresh = useCallback(async () => {
    setData(await loadLibrary());
  }, []);
  useEffect(() => {
    void initialize()
      .then(loadLibrary)
      .then((d) => {
        setData(d);
        setReady(true);
        const stored = readSession();
        if (
          stored &&
          stored.songs.some((id) => d.songs.some((s) => s.id === id))
        )
          setSession(stored);
        else if (!d.settings.onboardingDone) setGuide(true);
      })
      .catch(() =>
        setError(
          "CueLine could not open local storage. Try a normal browser window with site storage enabled, then reload.",
        ),
      );
    const connection = () => setOnline(navigator.onLine);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, []);
  const saveSong = useCallback(async (song: Song) => {
    await db.songs.put(song);
    setData((d) => ({
      ...d,
      songs: d.songs.some((s) => s.id === song.id)
        ? d.songs.map((s) => (s.id === song.id ? song : s))
        : [...d.songs, song],
    }));
  }, []);
  const saveSet = async (list: Setlist) => {
    try {
      await db.setlists.put(list);
      setData((d) => ({
        ...d,
        setlists: d.setlists.some((s) => s.id === list.id)
          ? d.setlists.map((s) => (s.id === list.id ? list : s))
          : [...d.setlists, list],
      }));
    } catch {
      setError("Could not save the setlist. Your device storage may be full.");
      throw new Error("Save failed");
    }
  };
  const updateSettings = (s: Preferences) => {
    setData((d) => ({ ...d, settings: s }));
    void db.settings
      .put(s)
      .catch(() =>
        setError(
          "Could not save display settings. Check available device storage.",
        ),
      );
  };
  const openStage = (songs: string[], name: string) => {
    if (!songs.length) return;
    const s: Session = {
      songs,
      name,
      index: 0,
      mode: "manual",
    };
    try {
      sessionStorage.removeItem("cueline-position");
      sessionStorage.removeItem("cueline-live-position");
      sessionStorage.setItem("cueline-session", JSON.stringify(s));
    } catch {
      /* Session recovery unavailable. */
    }
    history.pushState(null, "", "#stage");
    setSession(s);
  };
  const changeArea = (next: Area) => {
    setArea(next);
    setEditing(null);
    history.replaceState(null, "", `#${next}`);
  };
  const addPreparedSong = async (song: Song) => {
    await saveSong(song);
    setSongAdded(song);
    setEditing(null);
    setArea("library");
    setQuery("");
  };
  const closeGuide = () => {
    setGuide(false);
    updateSettings({ ...data.settings, onboardingDone: true });
  };
  if (!ready)
    return (
      <div className="loading-screen">
        <Brand />
        <p>{error || "Setting the stage…"}</p>
        {error && (
          <button className="btn primary" onClick={() => location.reload()}>
            Try again
          </button>
        )}
      </div>
    );
  if (session)
    return (
      <Stage
        allSongs={data.songs}
        session={session}
        settings={data.settings}
        updateSettings={updateSettings}
        saveSong={saveSong}
        exit={() => {
          setSession(null);
          history.replaceState(null, "", `#${area}`);
        }}
      />
    );
  const songs = data.songs
    .filter((s) =>
      `${s.title} ${s.artist}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : b.updatedAt - a.updatedAt,
    );
  const featured = data.setlists[0];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-caption">
          A LITTLE CUE. A LOT OF CONFIDENCE.
        </div>
        <nav aria-label="Main navigation">
          {(
            [
              ["library", Music2, "Song Library"],
              ["setlists", ListMusic, "Setlists"],
              ["settings", Settings2, "Settings"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              aria-current={area === id && !editing ? "page" : undefined}
              className={`nav-item ${area === id && !editing ? "active" : ""}`}
              onClick={() => changeArea(id)}
            >
              <Icon size={22} />
              <span>{label}</span>
              {id !== "settings" && (
                <small>
                  {id === "library" ? data.songs.length : data.setlists.length}
                </small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-note">
            <ShieldCheck size={22} />
            <strong>Made for the moment.</strong>
            <p>
              Your music stays here.
              <br />
              Ready wherever you play.
            </p>
          </div>
          <button className="text-btn" onClick={() => setGuide(true)}>
            <BookOpen size={18} /> Quick guide <ArrowUpRight size={15} />
          </button>
          <div className="version">
            CUELINE <span>v1.2.1</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="app-header">
          <div>
            {editing
              ? "Song Library"
              : area === "library"
                ? "Your workspace"
                : area === "setlists"
                  ? "Your performances"
                  : "Your preferences"}
            <ChevronRight size={15} />
            <strong>{editing ? "Song editor" : "CueLine"}</strong>
          </div>
          <span
            className={`connection ${offlineReady || cached ? "green" : ""}`}
          >
            {!online ? <WifiOff size={15} /> : <span className="status-dot" />}
            {!online
              ? "Offline · local library"
              : offlineReady || cached
                ? "Offline ready"
                : "Saved on this device"}
          </span>
        </header>
        <main id="main" className="main-content">
          {error && (
            <div className="notice error error-bar" role="alert">
              {error}
              <button
                className="icon-btn"
                aria-label="Dismiss message"
                onClick={() => setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {editing ? (
            <Editor
              key={editing.id}
              initial={data.songs.find((s) => s.id === editing.id) ?? editing}
              save={saveSong}
              back={() => setEditing(null)}
              preview={(song) => openStage([song.id], "Song preview")}
            />
          ) : area === "library" ? (
            <div className="page-enter">
              <div className="page-heading library-heading">
                <div>
                  <p className="eyebrow">
                    LESS LOOKING DOWN. MORE BEING THERE.
                  </p>
                  <h1>
                    Your songs. Your stage<span className="heading-dot">.</span>
                  </h1>
                  <p>Keep the words close. Let the music take over.</p>
                </div>
                <button
                  className="btn primary"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus size={20} /> Add song
                </button>
              </div>
              {songAdded && (
                <div className="song-added" role="status">
                  <Check size={23} />
                  <div>
                    <strong>
                      {songAdded.title} · {songAdded.artist}
                    </strong>
                    <span>Added with lyrics · saved for offline use</span>
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => openStage([songAdded.id], "Single song")}
                  >
                    <Play size={18} /> Open Stage
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setAdded("");
                      setToSet(songAdded);
                    }}
                  >
                    <ListPlus size={18} /> Add to setlist
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Dismiss song added message"
                    onClick={() => setSongAdded(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              <div className="library-hero">
                <section className="gig-card">
                  <div className="gig-card-copy">
                    <p className="eyebrow">
                      <span className="status-dot" /> READY FOR YOUR NEXT GIG
                    </p>
                    <h2>{featured?.name ?? "A great set starts here."}</h2>
                    <p>
                      {featured
                        ? `${featured.entries.length} songs · ${time(featured.entries.reduce((n, e) => n + (data.songs.find((s) => s.id === e.songId)?.duration ?? 0), 0))} of music · All on this device`
                        : "Bring your songs together in a setlist."}
                    </p>
                    <div className="gig-actions">
                      <button
                        className="btn primary"
                        disabled={!featured?.entries.length}
                        onClick={() =>
                          featured &&
                          openStage(
                            featured.entries.map((e) => e.songId),
                            featured.name,
                          )
                        }
                      >
                        <Play size={18} fill="currentColor" /> Start Performance
                      </button>
                      <button
                        className="text-btn"
                        onClick={() => changeArea("setlists")}
                      >
                        View setlists <ArrowUpRight size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="vinyl">
                      <div className="vinyl-label">
                        <AudioLines size={34} />
                      </div>
                    </div>
                    <div className="art-line one" />
                    <div className="art-line two" />
                    <span>LIVE IN THE MOMENT.</span>
                  </div>
                </section>
                <section className="quick-tip">
                  <div className="tip-icon">
                    <AudioLines size={25} />
                  </div>
                  <p className="eyebrow">
                    YOUR NEXT LINE,
                    <br />
                    RIGHT ON CUE.
                  </p>
                  <p>
                    Big lyrics. Gentle prompts.
                    <br />
                    Nothing between you
                    <br />
                    and the room.
                  </p>
                  <button className="text-btn" onClick={() => setGuide(true)}>
                    Meet Stage Mode <ArrowUpRight size={17} />
                  </button>
                </section>
              </div>
              <div className="section-head library-tools">
                <div>
                  <h2>
                    Song library{" "}
                    <span className="count">{data.songs.length}</span>
                  </h2>
                  <p>Your repertoire, ready when you are.</p>
                </div>
                <div className="library-search">
                  <div className="search-box">
                    <Search size={20} />
                    <input
                      aria-label="Search song library"
                      placeholder="Search songs or artists"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-btn"
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X size={17} />
                      </button>
                    )}
                  </div>
                  <select
                    aria-label="Sort songs"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="recent">Recently edited</option>
                    <option value="title">Title A–Z</option>
                  </select>
                </div>
              </div>
              <div className="library-table">
                <div className="library-table-head">
                  <span>SONG / ARTIST</span>
                  <span>PASSAGES</span>
                  <span>DURATION</span>
                  <span>YOUR CONTROLS</span>
                </div>
                {songs.map((song, i) => (
                  <article className="library-song" key={song.id}>
                    <button
                      className="song-main"
                      onClick={() => setEditing(song)}
                    >
                      <div className={`song-tile tile-${i % 3}`}>
                        <AudioLines size={26} />
                      </div>
                      <div className="song-name">
                        <strong>{song.title || "Untitled song"}</strong>
                        <span>
                          {song.artist || "Add an artist"}
                          {song.lyricSource.type === "original-demo" && (
                            <span className="demo-label">ORIGINAL DEMO</span>
                          )}
                        </span>
                      </div>
                    </button>
                    <span className="passage-count">
                      {song.passages.length}
                      <small> passages</small>
                    </span>
                    <span className="duration">
                      {time(song.duration)}
                      {song.bpm && <small>{song.bpm} BPM</small>}
                    </span>
                    <div className="row-actions">
                      <button
                        className="icon-btn stage-launch"
                        aria-label={`Stage ${song.title}`}
                        title="Open Stage Mode"
                        onClick={() => openStage([song.id], "Single song")}
                      >
                        <Play size={20} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${song.title}`}
                        title="Edit song"
                        onClick={() => setEditing(song)}
                      >
                        <Pencil size={19} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Add ${song.title} to setlist`}
                        title="Add to setlist"
                        onClick={() => {
                          setAdded("");
                          setToSet(song);
                        }}
                      >
                        <ListPlus size={20} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Duplicate ${song.title}`}
                        title="Duplicate song"
                        onClick={() =>
                          void saveSong({
                            ...song,
                            id: uid(),
                            title: `${song.title} (copy)`,
                            passages: song.passages.map((p) => ({
                              ...p,
                              id: uid(),
                            })),
                            updatedAt: Date.now(),
                          }).catch(() =>
                            setError("Could not duplicate this song."),
                          )
                        }
                      >
                        <Copy size={18} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label={`Delete ${song.title}`}
                        title="Delete song"
                        onClick={() => {
                          if (
                            confirm(
                              `Delete “${song.title}” and remove it from all setlists? Export a backup first if you need a copy.`,
                            )
                          )
                            void deleteSong(song.id)
                              .then(refresh)
                              .catch(() =>
                                setError("Could not delete this song."),
                              );
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!songs.length && (
                <Empty
                  icon={<Music2 size={42} />}
                  title={
                    query
                      ? "No matching songs."
                      : "Your next set starts with one song."
                  }
                >
                  {query
                    ? "Try another title or artist."
                    : "Tap Add song, search for a cover and pick your artist."}
                </Empty>
              )}
              <div className="library-footer">
                <span>
                  <ShieldCheck size={16} /> Local by design. Always yours.
                </span>
                <button className="text-btn" onClick={() => setAddOpen(true)}>
                  <Globe size={17} /> Find a cover song{" "}
                  <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="original-note">
                Demo songs and lyrics are original to CueLine. Add your own
                songs to make this space yours.
              </div>
            </div>
          ) : area === "setlists" ? (
            <Setlists
              songs={data.songs}
              lists={data.setlists}
              save={saveSet}
              remove={(id) =>
                void db.setlists
                  .delete(id)
                  .then(refresh)
                  .catch(() => setError("Could not delete this setlist."))
              }
              stage={(list) =>
                openStage(
                  list.entries.map((e) => e.songId),
                  list.name,
                )
              }
            />
          ) : (
            <Settings
              settings={data.settings}
              songs={data.songs}
              setlists={data.setlists}
              update={updateSettings}
              refresh={refresh}
              offlineReady={offlineReady || cached}
              needRefresh={needRefresh}
              updateApp={() => void updateServiceWorker(true)}
              showHelp={() => setGuide(true)}
            />
          )}
        </main>
        <footer className="workspace-footer">
          <span>LESS SCREEN. MORE STAGE.</span>
          <span>
            Built for the live moment <AudioLines size={14} />
          </span>
        </footer>
      </div>
      {guide && (
        <Modal title="A little cue. A lot of confidence." onClose={closeGuide}>
          <p className="modal-copy">
            Welcome to CueLine. Your lyrics and setlists stay on this device.
            There’s no account to create.
          </p>
          <div className="guide-steps">
            <div>
              <span>1</span>
              <div>
                <h3>Add your songs</h3>
                <p>
                  Search for a cover, pick the artist and add it with lyrics. We
                  prepare passages and available timings. You can add your own
                  lyrics too.
                </p>
              </div>
            </div>
            <div>
              <span>2</span>
              <div>
                <h3>Build your set</h3>
                <p>
                  Add songs to a setlist. Drag a handle, or use the arrows to
                  change the order.
                </p>
              </div>
            </div>
            <div>
              <span>3</span>
              <div>
                <h3>Take the stage</h3>
                <p>
                  Scroll through individual lines at your own pace, or tap a
                  line to jump to it. Timed modes are in stage settings.
                </p>
              </div>
            </div>
          </div>
          <p className="notice">
            CueLine shows lyrics; it doesn’t play music. Three original demo
            songs are ready to try.
          </p>
          <button className="btn primary full" onClick={closeGuide}>
            Let’s make some music <ChevronRight size={19} />
          </button>
          <p className="helper center">
            Find this guide any time in the sidebar or Settings.
          </p>
        </Modal>
      )}
      {addOpen && (
        <AddSong
          close={() => setAddOpen(false)}
          save={addPreparedSong}
          existing={data.songs}
        />
      )}
      {toSet && (
        <Modal
          title={`Add “${toSet.title}” to a setlist`}
          onClose={() => setToSet(null)}
        >
          {data.setlists.map((list) => (
            <div className="picker-row" key={list.id}>
              <strong>{list.name}</strong>
              <SetlistAddButton
                label={`Add to ${list.name}`}
                disabled={addToSetBusy}
                add={async () => {
                  setAddToSetBusy(true);
                  try {
                    await saveSet({
                      ...list,
                      updatedAt: Date.now(),
                      entries: [
                        ...list.entries,
                        { id: uid(), songId: toSet.id },
                      ],
                    });
                    setAdded(
                      `Added to ${list.name}. Tap its green button again for a repeat.`,
                    );
                  } finally {
                    setAddToSetBusy(false);
                  }
                }}
              />
            </div>
          ))}
          {!data.setlists.length && <p>Create a setlist first in Setlists.</p>}
          <div className="modal-footer">
            <span role="status">{added}</span>
            <button className="btn primary" onClick={() => setToSet(null)}>
              <Check size={18} /> Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <span />
        <Play size={19} fill="currentColor" />
      </span>
      CueLine<span className="brand-period">.</span>
    </div>
  );
}
