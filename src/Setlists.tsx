import { useState } from "react";
import {
  Plus,
  ListMusic,
  Play,
  Copy,
  Trash2,
  Pencil,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  Clock3,
} from "lucide-react";
import { uid, moveItem, time, type Song, type Setlist } from "./model";
import { Modal, SortableList, Empty } from "./ui";
export function Setlists({
  songs,
  lists,
  save,
  remove,
  stage,
}: {
  songs: Song[];
  lists: Setlist[];
  save: (s: Setlist) => Promise<void>;
  remove: (id: string) => void;
  stage: (list: Setlist) => void;
}) {
  const [selected, setSelected] = useState(lists[0]?.id ?? "");
  const [naming, setNaming] = useState<"new" | "rename" | null>(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState("");
  const active = lists.find((s) => s.id === selected) ?? lists[0];
  const total = (s: Setlist) =>
    s.entries.reduce(
      (n, e) => n + (songs.find((x) => x.id === e.songId)?.duration ?? 0),
      0,
    );
  const update = (s: Setlist) => void save({ ...s, updatedAt: Date.now() });
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE THE NIGHT YOURS</p>
          <h1>
            Setlists<span className="heading-dot">.</span>
          </h1>
          <p>A little preparation. A lot more presence.</p>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            setName("");
            setNaming("new");
          }}
        >
          <Plus size={20} /> New setlist
        </button>
      </div>
      <div className="setlists-layout">
        <aside className="setlist-index">
          {lists.map((list) => (
            <button
              key={list.id}
              className={`setlist-tab ${active?.id === list.id ? "selected" : ""}`}
              onClick={() => setSelected(list.id)}
            >
              <ListMusic size={23} />
              <span>
                <strong>{list.name}</strong>
                <small>
                  {list.entries.length} songs · {time(total(list))}
                </small>
              </span>
            </button>
          ))}
          {!lists.length && (
            <p className="helper">Your setlists will appear here.</p>
          )}
        </aside>
        <section className="setlist-detail panel">
          {active ? (
            <>
              <div className="setlist-title">
                <div>
                  <p className="eyebrow">THE RUNNING ORDER</p>
                  <h2>{active.name}</h2>
                  <p>
                    <span>{active.entries.length} songs</span>
                    <span>·</span>
                    <Clock3 size={16} />
                    {time(total(active))} playing time
                  </p>
                </div>
                <div className="row-actions">
                  <button
                    className="icon-btn"
                    aria-label="Rename setlist"
                    onClick={() => {
                      setName(active.name);
                      setNaming("rename");
                    }}
                  >
                    <Pencil size={19} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Duplicate setlist"
                    onClick={() => {
                      const id = uid();
                      update({
                        ...active,
                        id,
                        name: `${active.name} (copy)`,
                        entries: active.entries.map((e) => ({
                          ...e,
                          id: uid(),
                        })),
                      });
                      setSelected(id);
                    }}
                  >
                    <Copy size={19} />
                  </button>
                  <button
                    className="icon-btn danger"
                    aria-label="Delete setlist"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete “${active.name}”? Your songs will stay in the library.`,
                        )
                      )
                        remove(active.id);
                    }}
                  >
                    <Trash2 size={19} />
                  </button>
                </div>
              </div>
              <div className="setlist-start">
                <span>
                  <span className="status-dot" />{" "}
                  {active.entries.length
                    ? "Your stage is ready"
                    : "Add a few songs to get started"}
                </span>
                <button
                  className="btn primary"
                  disabled={!active.entries.length}
                  onClick={() => stage(active)}
                >
                  <Play size={18} /> Start Performance
                </button>
              </div>
              {active.entries.length ? (
                <SortableList
                  items={active.entries}
                  onMove={(a, b) =>
                    update({
                      ...active,
                      entries: moveItem(active.entries, a, b),
                    })
                  }
                >
                  {(entry, i, handle) => {
                    const song = songs.find((s) => s.id === entry.songId);
                    return (
                      <div className="set-song">
                        {handle}
                        <span className="ordinal">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className={`song-tile tile-${i % 3}`}>
                          <ListMusic size={21} />
                        </div>
                        <div className="song-name">
                          <strong>{song?.title ?? "Missing song"}</strong>
                          <span>{song?.artist || "Unknown artist"}</span>
                        </div>
                        <span className="duration">
                          {time(song?.duration ?? 0)}
                        </span>
                        <div className="reorder-arrows">
                          <button
                            className="icon-btn"
                            disabled={i === 0}
                            aria-label={`Move ${song?.title} up`}
                            onClick={() =>
                              update({
                                ...active,
                                entries: moveItem(
                                  active.entries,
                                  entry.id,
                                  active.entries[i - 1].id,
                                ),
                              })
                            }
                          >
                            <ArrowUp size={17} />
                          </button>
                          <button
                            className="icon-btn"
                            disabled={i === active.entries.length - 1}
                            aria-label={`Move ${song?.title} down`}
                            onClick={() =>
                              update({
                                ...active,
                                entries: moveItem(
                                  active.entries,
                                  entry.id,
                                  active.entries[i + 1].id,
                                ),
                              })
                            }
                          >
                            <ArrowDown size={17} />
                          </button>
                        </div>
                        <button
                          className="icon-btn danger"
                          aria-label={`Remove ${song?.title} from setlist`}
                          onClick={() =>
                            update({
                              ...active,
                              entries: active.entries.filter(
                                (e) => e.id !== entry.id,
                              ),
                            })
                          }
                        >
                          <X size={18} />
                        </button>
                      </div>
                    );
                  }}
                </SortableList>
              ) : (
                <Empty
                  icon={<ListMusic size={38} />}
                  title="Every good night starts with a song."
                >
                  Add songs from your library to build the set.
                </Empty>
              )}
              <button
                className="add-passage"
                onClick={() => {
                  setQuery("");
                  setAdding(true);
                }}
              >
                <Plus size={20} /> Add songs from library
              </button>
              <p className="helper center">
                Saved automatically. Drag a handle, or use the arrows to
                reorder. Repeats are welcome.
              </p>
            </>
          ) : (
            <Empty icon={<ListMusic size={42} />} title="Build your first set.">
              Create a named setlist, add your songs and take the stage.
            </Empty>
          )}
        </section>
      </div>
      {naming && (
        <Modal
          title={naming === "new" ? "New setlist" : "Rename setlist"}
          onClose={() => setNaming(null)}
        >
          <label>
            Setlist name
            <input
              form="setlist-name-form"
              autoFocus
              value={name}
              maxLength={300}
              placeholder="e.g. Saturday Wedding"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim())
                  e.currentTarget.form?.requestSubmit();
              }}
            />
          </label>
          <form
            id="setlist-name-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const id = naming === "new" ? uid() : active!.id;
              update(
                naming === "new"
                  ? {
                      id,
                      name: name.trim(),
                      entries: [],
                      updatedAt: Date.now(),
                    }
                  : { ...active!, name: name.trim() },
              );
              setSelected(id);
              setNaming(null);
            }}
          >
            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setNaming(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={!name.trim()}
              >
                Save setlist
              </button>
            </div>
          </form>
        </Modal>
      )}
      {adding && active && (
        <Modal title="Add songs to the set" onClose={() => setAdding(false)}>
          <div className="search-box">
            <Search size={20} />
            <input
              aria-label="Find a song for the setlist"
              placeholder="Find a song or artist"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="picker-list">
            {songs
              .filter((s) =>
                `${s.title} ${s.artist}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((song) => (
                <div className="picker-row" key={song.id}>
                  <div>
                    <strong>{song.title}</strong>
                    <small>
                      {song.artist} · {time(song.duration)}
                    </small>
                  </div>
                  <button
                    className="btn"
                    aria-label={`Add ${song.title}`}
                    onClick={() => {
                      update({
                        ...active,
                        entries: [
                          ...active.entries,
                          { id: uid(), songId: song.id },
                        ],
                      });
                      setAdded(`${song.title} added`);
                    }}
                  >
                    <Plus size={19} /> Add
                  </button>
                </div>
              ))}
          </div>
          <div className="modal-footer">
            <span role="status">
              {added || "You can add a song more than once."}
            </span>
            <button className="btn primary" onClick={() => setAdding(false)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
