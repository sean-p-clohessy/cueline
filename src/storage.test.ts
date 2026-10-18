import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { db, initialize, deleteSong, loadLibrary } from "./db";
import { restoreBackup, type Backup } from "./backup";
import { demoSongs, demoSetlist } from "./demo";
import { defaults } from "./model";
import starter from "./default-library.json";
import { validateBackup } from "./backupFormat";

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(async () => {
  await db.delete();
});

describe("IndexedDB persistence", () => {
  it("validates and seeds the supplied songs, set order, repeats and display preferences", async () => {
    const backup = validateBackup(starter);
    await Promise.all([initialize(), initialize()]);
    const data = await loadLibrary();
    expect(data.songs).toHaveLength(31);
    expect(data.setlists).toEqual(backup.setlists);
    expect(JSON.stringify(data.songs)).toBe(JSON.stringify(backup.songs));
    expect(data.setlists[0].entries).toHaveLength(15);
    expect(
      new Set(data.setlists[0].entries.map((entry) => entry.songId)).size,
    ).toBe(14);
    expect(data.settings).toEqual({
      ...backup.settings,
      onboardingDone: false,
    });
  });

  it("keeps existing songs, setlists and preferences unchanged when an update starts", async () => {
    await db.songs.bulkPut(demoSongs());
    const list = demoSetlist();
    await db.setlists.put(list);
    await db.settings.put({ ...defaults, fontSize: 72, theme: "black" });
    await initialize();
    expect(await db.songs.count()).toBe(3);
    expect(await db.setlists.toArray()).toEqual([list]);
    expect((await db.settings.get("preferences"))?.fontSize).toBe(72);
    expect((await db.settings.get("preferences"))?.theme).toBe("black");
  });

  it("does not reseed a library deliberately emptied by its owner", async () => {
    await initialize();
    await db.songs.clear();
    await db.setlists.clear();
    await initialize();
    expect(await db.songs.count()).toBe(0);
    expect(await db.setlists.count()).toBe(0);
  });

  it("recovers missing preferences without inserting starter content over an existing library", async () => {
    const song = demoSongs()[0];
    await db.songs.put(song);
    await initialize();
    expect(await db.songs.toArray()).toEqual([song]);
    expect(await db.setlists.count()).toBe(0);
    expect(await db.settings.get("preferences")).toEqual(defaults);
  });

  it("initializes once, persists edits, restores atomically and cleans setlist references", async () => {
    await initialize();
    await initialize();
    expect(await db.songs.count()).toBe(31);
    const song = (await db.songs.toArray())[0];
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
    expect(await db.songs.count()).toBe(34);
    await restoreBackup(backup, true);
    expect(await db.songs.count()).toBe(3);
    const restoredId = backup.songs[0].id;
    await deleteSong(restoredId);
    const data = await loadLibrary();
    expect(data.songs).toHaveLength(2);
    expect(data.setlists[0].entries.some((e) => e.songId === restoredId)).toBe(
      false,
    );
    await db.songs.clear();
    await db.setlists.clear();
    await initialize();
    expect(await db.songs.count()).toBe(0);
  });
});
