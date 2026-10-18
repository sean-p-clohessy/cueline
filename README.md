# CueLine

**Your next line, right on cue.** A complete iPad-first lyric prompter and setlist manager. No account, backend, subscription, analytics or audio playback.

Live app: **https://sean-p-clohessy.github.io/cueline/**

Source: https://github.com/sean-p-clohessy/cueline

## Run locally

Requires Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

The terminal prints the local URL. For the real offline PWA, use the production build:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

Service workers require HTTPS, or localhost on the same device. An iPad accessing a development PC's plain HTTP LAN address cannot install a working offline service worker. Use the HTTPS live app to install on an iPad.

## Install on iPad

1. Open the live URL in **Safari**.
2. Choose **Share → Add to Home Screen → Add**.
3. Open CueLine using its new icon while connected. Wait for **Offline ready**.
4. Add/import your songs in this installed app. Safari and installed apps may have separate storage; transfer a JSON backup if needed.
5. Switch to Airplane Mode, reopen CueLine and try your whole set before a gig.

The application shell, icons, songs, settings and setlists work without a network after initial installation. MusicBrainz search is the only optional online feature. Updates wait in Settings and never automatically reload Stage Mode.

## Prepare your songs

Use **Add song** to enter a title, artist, duration, intro, optional BPM, count-in (default 5 seconds) and notes. **Paste lyrics** splits blank-line-separated sections into passages. You can also add passages individually.

Choose Verse, Chorus, Bridge, Outro or Instrumental per passage. Instrumentals can use a label such as “Guitar solo · 8 bars”. Repeat a chorus with its repeat button; it becomes an independent, editable passage. Place the text cursor to split a passage, merge with the preceding passage, or use a handle to reorder. Keyboard dragging uses Space, arrow keys, Space.

**Estimate timings** distributes cues evenly from the intro to the end. These are clearly marked estimates, not synchronisation. Edit a cue as `mm:ss`, `mm:ss.s` or a number of seconds; clear it to remove it. Cues use song-relative time, excluding the initial count-in. Automatic mode requires every cue to be in increasing passage order, at or after the intro and before the end of the song. Fix invalid cues or use Manual mode.

All three included demo songs and all their lyrics were written for this application. They include different intros, repeated choruses and instrumentals. Their timings are illustrative estimates. Use only lyrics you wrote, own or have permission to use. CueLine does not fetch or scrape lyrics.

## Setlists

Create, rename, duplicate and delete named setlists. Add songs from the library, including repeated songs. Each appearance has its own stable entry ID. Drag its handle with a finger or pointer, use the up/down buttons, or use keyboard dragging. Removing a setlist entry preserves the library song. Song count and estimated playing time update automatically. Start Performance opens the ordered set.

## Stage controls

The top switch selects **Automatic**, **Manual** or **Rehearsal**. Play starts the count-in; song time begins at zero after it completes. The intro shows an instrumental prompt before the first lyric cue.

| Control | Action |
| --- | --- |
| Play / Pause, or Space | Start, freeze or resume the timeline, including during the count-in and intro |
| Passage arrows, or Left / Right | Previous / next passage; Automatic mode also moves the timeline to that cue |
| −3s / +3s | Move the Automatic timeline backward / forward by three seconds |
| Restart, or R | Return to the count-in; confirm if playing or discarding a rehearsal |
| Song buttons, or Up / Down | Open the preceding / following song; confirm while playing |
| Display settings | Lyric size, spacing, alignment, context/focus density, artist visibility, manual tap zones and pure-black theme |

In **Manual**, the left half of the lyric area goes back and the right half advances. Rapid taps within 300 ms are ignored. Passages never advance by time in this mode. A keyboard generating these keys can be used as an external controller; no Bluetooth pairing API is required. Shortcuts ignore text fields, native key repeats and open dialogs.

CueLine never plays a recording. Perform or play your music separately. At the song's duration the timeline stops and offers the next song. **It never starts the next song automatically.** Long passages remain scrollable within the lyric area; the page itself is locked on stage. Split long passages to keep a complete cue visible at your chosen text size.

Leaving while playing requires confirmation. Losing page visibility or window focus pauses playback. A long frame suspension over 10 seconds freezes at the last known position. Return and resume explicitly. Reloading the same tab recovers a paused performance, never a running one. Wake Lock is requested while Stage Mode is open; when the browser cannot keep the screen awake, set your device's auto-lock manually for the performance.

## Rehearsal

1. Open a song in Stage Mode and choose **Rehearsal**.
2. Play, let the count-in finish, and perform or listen externally.
3. Press **Tap cue** or Right when each next passage begins.
4. Choose **Review & save timings**, adjust individual timestamps, then **Save timings to song**.
5. Choose Automatic to use them.

Recorded cues are separate from the saved song until you explicitly save. Partial recordings preserve uncaptured saved timings; all resulting cues must remain valid. Reset rehearsal clears the recording after confirmation. Temporary recording and playback recovery use session storage in the current tab. Regularly save recordings; closing the tab or clearing browser data can remove unsaved rehearsal work.

## Storage, privacy and backups

Dexie manages a versioned IndexedDB database named `CueLine`. Version 1 contains songs (with ordered passages), setlists (with ordered entry IDs) and preferences. Playback uses a separate monotonic engine and transient session storage. Meaningful edits write immediately; editor writes are serialized. First launch seeds demos only once, even if you subsequently empty the library.

**Settings → Export full backup** downloads a readable CueLine JSON file with all songs, timings, setlists and settings. The editor also exports single-song JSON files. Keep a copy off the performing device.

**Import backup or song** validates format/version, required fields, bounded numbers, IDs and song references before changing anything. By default it adds copies with fresh song, passage, setlist and entry IDs. Replacement requires a checkbox and a separate confirmation; it replaces the whole library and settings within one IndexedDB transaction. Malformed or failed imports preserve existing data. Compatible wrappers are `{ format: "cueline", version: 1, ... }` and `{ format: "cueline-song", version: 1, song: ... }`; the validators are in `src/backup.ts`.

Storage is specific to the browser, device and site origin. Clearing site data, using a private window, storage eviction, changing the hosting URL or removing the installed app can lose local data. Request persistent storage in Settings where supported and keep exported backups. There is no account sync and no recoverable server copy. GitHub Pages serves only the application files; it receives no library or lyrics upload.

Optional metadata search sends only the entered query to MusicBrainz, never your library or lyrics. It is explicitly submitted, cached, throttled at 1.5 seconds minimum, coordinates its last request across tabs where storage is available, respects server backoff and times out gracefully. It requests an application User-Agent and adds a client identifier. Chromium can replace/drop the User-Agent; browser CORS rules and MusicBrainz availability can limit this optional feature. There is deliberately no proxy/backend. See [MusicBrainz's API policy](https://musicbrainz.org/doc/MusicBrainz_API). Review their commercial-use policy before commercial redistribution.

## Source map

| File | Purpose |
| --- | --- |
| `src/App.tsx` | Library, application navigation, first-run guide, metadata picker |
| `src/Editor.tsx` | Lyric and timing editing, serialized immediate saves |
| `src/Setlists.tsx` | Setlist management and accessible reordering |
| `src/Stage.tsx` | Performance UI, rehearsal review, interruption and wake-lock handling |
| `src/engine.ts` | Framework-independent monotonic timeline engine |
| `src/model.ts` | Typed schema, lyric splitting, estimation and timing validation |
| `src/db.ts` | Dexie versioned schema and atomic library operations |
| `src/backup.ts` | Validation, collision-safe import and downloads |
| `src/Settings.tsx`, `src/ui.tsx` | Preferences, backup UI, native dialogs and drag handles |
| `src/metadata.ts` | Optional metadata transport, independent of lyric sources |
| `src/demo.ts` | Original demonstration content |
| `scripts/qa-*.txt` | Repeatable browser verification functions for Playwright CLI |

## Testing and support limits

See [VALIDATION.md](VALIDATION.md) for automated and browser evidence. The core suite covers countdown, exact cue boundaries, delayed reads, pause/resume, intros, recalibration, nudges, manual navigation, rehearsal capture, interruption recovery, repeated entries, timing validation, backup rejection/collision handling and real IndexedDB semantics via fake-indexeddb. Browser checks exercise real UI workflows, touch input, persistence and the production service worker.

The interface uses Apple's design principles adapted for a web app: explicit navigation, strong contrast, at least 48px controls, adjustable large stage lyrics, visible focus, native modal focus containment, reduced-motion support and button alternatives to setlist dragging. Actual iPad Safari installation, physical foot pedals, VoiceOver and use by older musicians still require hands-on device/user validation. Browser emulation is useful evidence, not a substitute for those checks.

## Deployment

The GitHub Actions workflow runs lint, tests and a production build, then deploys `dist` to GitHub Pages. Relative Vite asset paths and manifest scope support the `/cueline/` project path. Service-worker updates use the prompt strategy: a waiting version is applied only by the user's Settings action. No secrets or environment variables are needed.

The source does not include browser profiles, personal backups or runtime libraries; those remain in ignored `output/`. The committed PNG icons are rebuilt with `python scripts/generate-icons.py` if Pillow is installed (optional development helper).
