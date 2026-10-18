import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { db, initialize, deleteSong, loadLibrary } from "./db";
import { restoreBackup, type Backup } from "./backup";
import { demoSongs, demoSetlist } from "./demo";
import { defaults } from "./model";
describe("IndexedDB persistence", () => {
  it("initializes once, persists edits, restores atomically and cleans setlist references", async () => {
    await db.delete();
    await db.open();
    await initialize();
    await initialize();
    expect(await db.songs.count()).toBe(3);
    const song = demoSongs()[0];
    song.title = "Persisted edit";
    await db.songs.put(song);
    db.close();
    await db.open();
    expect((await db.songs.get(song.id))?.title).toBe("Persisted edit");
    const backup: Backup = {
      format: "cueline",
      version: 1,
      exportedAt: "",
      songs: demoSongs(),
      setlists: [demoSetlist()],
      settings: defaults,
    };
    await restoreBackup(backup, false);
    expect(await db.songs.count()).toBe(6);
    await restoreBackup(backup, true);
    expect(await db.songs.count()).toBe(3);
    await deleteSong(song.id);
    const data = await loadLibrary();
    expect(data.songs).toHaveLength(2);
    expect(data.setlists[0].entries.some((e) => e.songId === song.id)).toBe(
      false,
    );
    await db.songs.clear();
    await db.setlists.clear();
    await initialize();
    expect(await db.songs.count()).toBe(0);
    await db.delete();
  });
});
