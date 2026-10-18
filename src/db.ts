import Dexie, { type EntityTable } from "dexie";
import { defaults, type Settings, type Song, type Setlist } from "./model";
import { demoSongs, demoSetlist } from "./demo";

export class CueDatabase extends Dexie {
  songs!: EntityTable<Song, "id">;
  setlists!: EntityTable<Setlist, "id">;
  settings!: EntityTable<Settings, "id">;
  constructor(name = "CueLine") {
    super(name);
    this.version(1).stores({
      songs: "id,title,artist,updatedAt",
      setlists: "id,name,updatedAt",
      settings: "id",
    });
  }
}
export const db = new CueDatabase();
export async function initialize() {
  await db.transaction("rw", db.songs, db.setlists, db.settings, async () => {
    if (!(await db.settings.get("preferences"))) {
      await db.songs.bulkPut(demoSongs());
      await db.setlists.put(demoSetlist());
      await db.settings.put(defaults);
    }
  });
}
export async function loadLibrary() {
  const [songs, setlists, settings] = await Promise.all([
    db.songs.toArray(),
    db.setlists.toArray(),
    db.settings.get("preferences"),
  ]);
  return { songs, setlists, settings: settings ?? defaults };
}
export async function deleteSong(id: string) {
  await db.transaction("rw", db.songs, db.setlists, async () => {
    await db.songs.delete(id);
    for (const list of await db.setlists.toArray())
      if (list.entries.some((e) => e.songId === id))
        await db.setlists.put({
          ...list,
          entries: list.entries.filter((e) => e.songId !== id),
          updatedAt: Date.now(),
        });
  });
}
