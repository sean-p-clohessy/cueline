import { useState, type ChangeEvent } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  Smartphone,
  Monitor,
  HardDrive,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { type Settings as Preferences, type Song, type Setlist } from "./model";
import { type Backup, readImport, restoreBackup, downloadJson } from "./backup";
import { Modal } from "./ui";

export function DisplaySettings({
  settings: s,
  update,
}: {
  settings: Preferences;
  update: (s: Preferences) => void;
}) {
  const change = (patch: Partial<Preferences>) => update({ ...s, ...patch });
  return (
    <div className="display-settings">
      <label>
        Lyric size <span>{s.fontSize}px</span>
        <input
          aria-label="Lyric font size"
          type="range"
          min="24"
          max="96"
          step="2"
          value={s.fontSize}
          onChange={(e) => change({ fontSize: Number(e.target.value) })}
        />
      </label>
      <label>
        Line spacing <span>{s.spacing.toFixed(1)}</span>
        <input
          aria-label="Passage line spacing"
          type="range"
          min="1"
          max="2"
          step="0.1"
          value={s.spacing}
          onChange={(e) => change({ spacing: Number(e.target.value) })}
        />
      </label>
      <div className="two-fields">
        <label>
          Text alignment
          <select
            aria-label="Text alignment"
            value={s.alignment}
            onChange={(e) =>
              change({ alignment: e.target.value as Preferences["alignment"] })
            }
          >
            <option value="center">Centred</option>
            <option value="left">Left aligned</option>
          </select>
        </label>
        <label>
          Display density
          <select
            aria-label="Display density"
            value={s.density}
            onChange={(e) =>
              change({ density: e.target.value as Preferences["density"] })
            }
          >
            <option value="context">Surrounding lyrics</option>
            <option value="focus">Focus on the active lyric</option>
          </select>
        </label>
      </div>
      <label>
        Stage theme
        <select
          aria-label="Stage theme"
          value={s.theme}
          onChange={(e) =>
            change({ theme: e.target.value as Preferences["theme"] })
          }
        >
          <option value="charcoal">Warm charcoal</option>
          <option value="black">Pure black · high contrast</option>
        </select>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={s.showArtist}
          onChange={(e) => change({ showArtist: e.target.checked })}
        />{" "}
        Show artist on stage
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={s.showZones}
          onChange={(e) => change({ showZones: e.target.checked })}
        />{" "}
        Show swipe instructions on stage
      </label>
      <div
        className={`lyric-sample theme-${s.theme}`}
        style={{
          fontSize: Math.min(s.fontSize, 44),
          textAlign: s.alignment,
          lineHeight: s.spacing,
        }}
      >
        Keep a little amber
        <br />
        in the night.
      </div>
    </div>
  );
}
export function Settings({
  settings,
  songs,
  setlists,
  update,
  refresh,
  offlineReady,
  needRefresh,
  updateApp,
  showHelp,
}: {
  settings: Preferences;
  songs: Song[];
  setlists: Setlist[];
  update: (s: Preferences) => void;
  refresh: () => Promise<void>;
  offlineReady: boolean;
  needRefresh: boolean;
  updateApp: () => void;
  showHelp: () => void;
}) {
  const [importing, setImporting] = useState<Backup | null>(null);
  const [replace, setReplace] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function fileChanged(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 25_000_000)
        throw new Error("This file is too large (25 MB maximum).");
      setImporting(readImport(await file.text()));
      setReplace(false);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not read this backup.",
      );
    }
    e.target.value = "";
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SET UP. THEN FORGET ABOUT IT.</p>
          <h1>
            Settings<span className="heading-dot">.</span>
          </h1>
          <p>Comfort on stage. Confidence in your backup.</p>
        </div>
        <span className="tag">
          <ShieldCheck size={16} /> Yours, on this device
        </span>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="section-heading">
            <Monitor size={22} />
            <div>
              <h2>Your stage display</h2>
              <p>Find the view that feels effortless.</p>
            </div>
          </div>
          <DisplaySettings settings={settings} update={update} />
        </section>
        <div className="settings-stack">
          <section className="panel">
            <div className="section-heading">
              <HardDrive size={22} />
              <div>
                <h2>Library & backups</h2>
                <p>No account. No cloud. No subscription.</p>
              </div>
            </div>
            <p>
              Your {songs.length} songs and {setlists.length} setlists live in
              this browser’s storage. Export a backup before a gig or moving to
              another device.
            </p>
            <div className="button-stack">
              <button
                className="btn primary"
                onClick={() => {
                  downloadJson(
                    {
                      format: "cueline",
                      version: 1,
                      exportedAt: new Date().toISOString(),
                      songs,
                      setlists,
                      settings,
                    },
                    `CueLine-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  );
                  setMessage(
                    "Backup exported. Keep it somewhere you can find it.",
                  );
                }}
              >
                <Download size={19} /> Export full backup
              </button>
              <label className="btn file-button">
                <Upload size={19} /> Import backup or song
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => void fileChanged(e)}
                />
              </label>
              <button
                className="text-btn"
                onClick={async () => {
                  const granted = await navigator.storage?.persist?.();
                  setMessage(
                    granted
                      ? "Persistent storage enabled. Keep exporting backups too."
                      : "Your browser manages storage automatically. Keep a regular exported backup.",
                  );
                }}
              >
                <ShieldCheck size={18} /> Request persistent storage
              </button>
            </div>
            <p className="helper">
              Clearing site data, private browsing or removing an installed app
              can erase local data. A JSON backup is your safety net.
            </p>
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <Smartphone size={23} />
              <div>
                <h2>Take CueLine to the gig</h2>
                <p>Install once. Perform offline.</p>
              </div>
            </div>
            <ol className="install-steps">
              <li>
                <span>1</span>Open CueLine in Safari on your iPad.
              </li>
              <li>
                <span>2</span>Tap Share, then Add to Home Screen.
              </li>
              <li>
                <span>3</span>Open the icon once while online and check that
                “Offline ready” appears.
              </li>
              <li>
                <span>4</span>Switch to Airplane Mode and try your set before
                the gig.
              </li>
            </ol>
            <p className={`tag ${offlineReady ? "green" : ""}`}>
              <Check size={16} />
              {offlineReady
                ? "Offline ready · app shell saved"
                : "Offline caching requires the production app over HTTPS"}
            </p>
            {needRefresh && (
              <button className="btn full" onClick={updateApp}>
                Install available update
              </button>
            )}
            <p className="helper">
              Updates wait for you in Settings. They never reload a live
              performance.
            </p>
          </section>
          <button className="btn full" onClick={showHelp}>
            Show the getting started guide <ArrowUpRight size={18} />
          </button>
        </div>
      </div>
      {importing && (
        <Modal
          title="Restore your music"
          onClose={() => {
            if (!busy) setImporting(null);
          }}
        >
          <p className="modal-copy">
            This file contains <strong>{importing.songs.length} songs</strong>{" "}
            and <strong>{importing.setlists.length} setlists</strong>.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />{" "}
            Replace my entire library and settings
          </label>
          <p className="notice">
            {replace
              ? "This removes the current songs and setlists. Export a backup first."
              : "Songs and setlists will be added as new copies. Your current library and settings stay safe."}
          </p>
          <div className="modal-footer">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setImporting(null)}
            >
              Cancel
            </button>
            <button
              className={`btn ${replace ? "destructive" : "primary"}`}
              disabled={busy}
              onClick={async () => {
                if (
                  replace &&
                  !confirm(
                    "Replace your entire library, setlists and settings with this backup? This cannot be undone.",
                  )
                )
                  return;
                setBusy(true);
                try {
                  await restoreBackup(importing, replace);
                  await refresh();
                  setImporting(null);
                  setMessage(
                    "Import complete. Your music is saved on this device.",
                  );
                } catch {
                  setMessage(
                    "Import failed. The transaction was rolled back; your library is unchanged.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? "Importing…"
                : replace
                  ? "Replace library"
                  : "Add to my library"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
