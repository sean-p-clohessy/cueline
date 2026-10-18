import { db } from "./db";
import { remapBackup, type Backup } from "./backupFormat";
export {
  validateBackup,
  readImport,
  remapBackup,
  type Backup,
} from "./backupFormat";
export async function restoreBackup(backup: Backup, replace: boolean) {
  const data = replace ? backup : remapBackup(backup);
  await db.transaction("rw", db.songs, db.setlists, db.settings, async () => {
    if (replace) {
      await db.songs.clear();
      await db.setlists.clear();
      await db.settings.put({ ...data.settings, onboardingDone: true });
    }
    await db.songs.bulkPut(data.songs);
    await db.setlists.bulkPut(data.setlists);
  });
}
export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
