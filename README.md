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

The application shell, icons, songs, settings and setlists work without a network after initial installation. Searching for new covers needs a connection; adding a result saves its words and cues locally. Updates wait in Settings and never automatically reload Stage Mode.

## Prepare your songs

**Add song → Find a cover → search the title → Add song beside your artist.** Lyrics, duration, readable passages and available cue timings are prepared and saved immediately. You return to the library with **Open Stage** and **Add to setlist** actions. There is no required editor, copy/paste, lyric splitting or timing form.

Search results group recordings by artist. **Choose a recording** optionally lets you pick an album/version. Automatic preparation prefers a timed studio version when available. Community cue timings follow that recording; a live band's arrangement may differ, so try the song before performing. Every song opens in Live view: scroll or tap individual lines at your band's pace. Saved recording cues remain available in the optional Automatic mode; lyrics-only imports need no timing setup.

For originals or unavailable covers, choose **My own lyrics**: enter a title, paste the whole song, and add it. You can also import TXT or LRC. Plain text is divided into short passages automatically; LRC preserves timestamps. The existing editor remains available for optional changes to duration, intro, BPM, count-in (default 5 seconds), notes and individual passages.

Choose Verse, Chorus, Bridge, Outro or Instrumental per passage. Instrumentals can use a label such as “Guitar solo · 8 bars”. Repeat a chorus with its repeat button; it becomes an independent, editable passage. Place the text cursor to split a passage, merge with the preceding passage, or use a handle to reorder. Keyboard dragging uses Space, arrow keys, Space.

**Estimate timings** distributes cues evenly from the intro to the end. These are clearly marked estimates, not synchronisation. Edit a cue as `mm:ss`, `mm:ss.s` or a number of seconds; clear it to remove it. Cues use song-relative time, excluding the initial count-in. Automatic mode requires every cue to be in increasing passage order, at or after the intro and before the end of the song. Fix invalid cues or use Live view, which needs no timestamps.

All three included demo songs and all their lyrics were written for this application. They include different intros, repeated choruses and instrumentals. Their timings are illustrative estimates. Cover lyrics are fetched from the public LRCLIB API when you explicitly search/add a cover; CueLine does not scrape lyric websites or bundle commercial lyrics. LRCLIB is a community source, not a blanket licence to lyrics or performances. Only add material you are entitled to use. Source and recording attribution stay with the saved song and its backups.

## Setlists

Create, rename, duplicate and delete named setlists. Add songs from the library, including repeated songs. Each appearance has its own stable entry ID. Drag its handle with a finger or pointer, use the up/down buttons, or use keyboard dragging. Removing a setlist entry preserves the library song. Song count and estimated playing time update automatically. Start Performance opens the ordered set.

Both setlist pickers confirm a successful save beside the item with a green checkmark and **Added!**. The confirmation stays visible while the picker is open, including when filtering songs. Rapid repeated taps are blocked briefly; tap the green button again to deliberately add a repeat. Failed saves show an error and allow a retry.

## Stage controls

**Live is the default.** Open a song or start a setlist and the first lyric line is ready. There is no Play step, countdown or elapsed-time limit in Live. Keep a solo open, repeat a chorus or slow down with the drummer; the lyrics only move when you choose.

- **Swipe up / scroll forward** to advance; swipe down / scroll back to return. The line nearest the middle becomes active in amber, with surrounding lines visible.
- **Tap a line** to select it and bring it to the middle.
- **Previous line / Next line** provide large button alternatives. Accidental double taps within 300 ms advance only once.
- **Left / Right** move one line. **Space** also advances when a control does not have keyboard focus. **R** returns to the first line after confirmation.
- Separate **Previous song / Next song** controls follow setlist order. **Up / Down** also change songs, with confirmation partway through a song. The last line never starts another song automatically.

Live song navigation uses full-width paired buttons: 72px tall on tablet, 64px on phone portrait and 56px in short landscape layouts.

The selected line survives rotation and reload in the same tab. Repeated appearances of a song start independently. Display settings adjust lyric size, spacing, alignment, surrounding-lyric emphasis, artist visibility, swipe hints and the pure-black theme. Native touch scrolling remains within the lyric area; the page itself stays locked on stage. All existing phone/tablet orientations remain supported.

**Stage display settings → How to follow your lyrics** also offers **Automatic** and **Rehearsal**. These retain the passage-based timeline and saved cues. Play starts the count-in; song time begins at zero after it completes. The intro displays its instrumental prompt before the first cue.

| Timed control | Action |
| --- | --- |
| Play / Pause, or Space | Start, freeze or resume, including the count-in and intro |
| Passage arrows, or Left / Right | Previous / next passage; Automatic also seeks the timeline to that cue |
| −3s / +3s | Move the Automatic timeline backward / forward by three seconds |
| Restart, or R | Return to the count-in; confirm if playing or discarding a rehearsal |
| Song buttons, or Up / Down | Open the preceding / following song; confirm while playing |

CueLine never plays a recording. In timed modes, reaching the saved duration stops the timeline and offers the next song; it never starts it automatically. Losing visibility or focus pauses timed playback, and a frame suspension over 10 seconds freezes at the last known position. Reloading recovers a paused timeline. Live has no clock to skip forward during an interruption.

Leaving during a song requires confirmation. A keyboard generating these keys can act as an external controller; no Bluetooth pairing API is required. Shortcuts ignore editing fields, native key repeats and open dialogs. Wake Lock is requested while Stage Mode is open; when unavailable, set device auto-lock manually before performing.

## Rehearsal

1. Open a song in Stage Mode, open **Stage display settings**, and choose **Rehearsal**.
2. Play, let the count-in finish, and perform or listen externally.
3. Press **Tap cue** or Right when each next passage begins.
4. Choose **Review & save timings**, adjust individual timestamps, then **Save timings to song**.
5. Choose Automatic to use them.

Recorded cues are separate from the saved song until you explicitly save. Partial recordings preserve uncaptured saved timings; all resulting cues must remain valid. Reset rehearsal clears the recording after confirmation. Temporary recording and playback recovery use session storage in the current tab. Regularly save recordings; closing the tab or clearing browser data can remove unsaved rehearsal work.

## Storage, privacy and backups

Dexie manages a versioned IndexedDB database named `CueLine`. Version 1 contains songs (with ordered passages), setlists (with ordered entry IDs) and preferences. Timed playback uses a separate monotonic engine. Live derives individual display lines from saved passages without rewriting them or their timings. Stable line IDs and the setlist appearance index provide transient session recovery. Meaningful edits write immediately; editor writes are serialized. First launch seeds demos only once, even if you subsequently empty the library.

**Settings → Export full backup** downloads a readable CueLine JSON file with all songs, timings, setlists and settings. The editor also exports single-song JSON files. Keep a copy off the performing device.

**Import backup or song** validates format/version, required fields, bounded numbers, IDs and song references before changing anything. By default it adds copies with fresh song, passage, setlist and entry IDs. Replacement requires a checkbox and a separate confirmation; it replaces the whole library and settings within one IndexedDB transaction. Malformed or failed imports preserve existing data. Compatible wrappers are `{ format: "cueline", version: 1, ... }` and `{ format: "cueline-song", version: 1, song: ... }`; the validators are in `src/backup.ts`.

Storage is specific to the browser, device and site origin. Clearing site data, using a private window, storage eviction, changing the hosting URL or removing the installed app can lose local data. Request persistent storage in Settings where supported and keep exported backups. There is no account sync and no recoverable server copy. GitHub Pages serves only the application files; it receives no library or lyrics upload.

Cover search sends the entered title to LRCLIB. Its results already include the lyrics, so choosing an available artist normally needs no second network request. When needed, a targeted request sends only the selected title/artist. These requests are sequential, spaced by at least 350 ms, identified with the documented `Lrclib-Client` header, cached, bounded by timeouts and respect `Retry-After`. A short server-overload response can be retried once after the specified delay; there is no background crawling or uploading of your library. See [LRCLIB's API documentation](https://lrclib.net/docs).

MusicBrainz provides additional artist discovery when the primary source has no match or is unavailable. It is cached, throttled at 1.5 seconds minimum and uses focused title queries. See [MusicBrainz's API policy](https://musicbrainz.org/doc/MusicBrainz_API). Browser CORS rules, provider availability and catalogue coverage can limit online searches. Failed imports leave the library unchanged, rather than creating an empty song. There is no paid account, secret key, proxy or backend. Neither public API grants blanket rights to the underlying lyrics; review provider and rights requirements before commercial redistribution.

## Source map

| File | Purpose |
| --- | --- |
| `src/App.tsx` | Library, application navigation, first-run guide, metadata picker |
| `src/Editor.tsx` | Lyric and timing editing, serialized immediate saves |
| `src/Setlists.tsx` | Setlist management and accessible reordering |
| `src/Stage.tsx` | Performance UI, rehearsal review, interruption and wake-lock handling |
| `src/LiveLyrics.tsx`, `src/live.ts`, `src/live.css` | Live line view, native scroll selection and position recovery |
| `src/engine.ts` | Framework-independent monotonic timeline engine |
| `src/model.ts` | Typed schema, lyric splitting, estimation and timing validation |
| `src/db.ts` | Dexie versioned schema and atomic library operations |
| `src/backup.ts` | Validation, collision-safe import and downloads |
| `src/Settings.tsx`, `src/ui.tsx` | Preferences, backup UI, native dialogs and drag handles |
| `src/AddSong.tsx` | Search-first artist picker, ready-to-use cover import, simple own-lyrics form |
| `src/lyrics.ts` | LRCLIB provider, LRC parsing, automatic passage preparation and recording selection |
| `src/metadata.ts` | Additional artist discovery, independent of lyric sources |
| `src/demo.ts` | Original demonstration content |
| `scripts/qa-live*.txt` | Current live-view and retained timed-mode browser checks; other QA scripts record earlier release workflows |

## Testing and support limits

See [VALIDATION.md](VALIDATION.md) for automated and browser evidence. The 52-test suite covers live line derivation, repeat identity, scroll selection, recovery and boundaries, plus countdown, exact cue boundaries, delayed reads, pause/resume, intros, recalibration, nudges, manual navigation, rehearsal capture, interruption recovery, repeated entries, timing validation, backup rejection/collision handling and real IndexedDB semantics via fake-indexeddb. Browser checks exercise real UI workflows, touch input, persistence and the production service worker.

The interface uses Apple's design principles adapted for a web app: explicit navigation, strong contrast, at least 48px controls, adjustable large stage lyrics, visible focus, native modal focus containment, reduced-motion support and button alternatives to setlist dragging. Actual iPad Safari installation, physical foot pedals, VoiceOver and use by older musicians still require hands-on device/user validation. Browser emulation is useful evidence, not a substitute for those checks.

## Deployment

The GitHub Actions workflow runs lint, tests and a production build, then deploys `dist` to GitHub Pages. Relative Vite asset paths and manifest scope support the `/cueline/` project path. Service-worker updates use the prompt strategy: a waiting version is applied only by the user's Settings action. No secrets or environment variables are needed.

The source does not include browser profiles, personal backups or runtime libraries; those remain in ignored `output/`. The committed PNG icons are rebuilt with `python scripts/generate-icons.py` if Pillow is installed (optional development helper).
