# CueLine validation

Validation date: 18 October 2026. Windows, Node 24, Edge via Playwright CLI.

## Automated

- Strict TypeScript: passed.
- ESLint with React hooks: passed without warnings.
- Vitest: **52 tests passed**, covering live line derivation, repeat identity, nearest-line selection, recovery, navigation boundaries, the monotonic engine, cue handling, setlist reorder, backup validation, IndexedDB persistence/restore, LRC parsing, automatic passage preparation, source attribution and lyrics-provider reliability.
- Vite production build and generated PWA service worker: passed.

## Earlier release browser workflows (v1.0/v1.1)

- Added an original test song; edited metadata, duration, count-in and intro.
- Pasted lyrics; automatically split blank-line sections; repeated, merged and split passages; estimated cues.
- Played the countdown, paused/resumed it, observed the intro and first timed lyric, manually advanced Automatic mode and verified the timeline stayed recalibrated.
- Manual tap zones ignored a rapid double click; keyboard passage navigation worked.
- Dispatched a visibility change explicitly (headless tabs do not reliably produce OS visibility events); playback paused, and reload recovered paused.
- Rehearsed four cues, reviewed and explicitly saved them; verified the saved song timestamps in the editor.
- Created a setlist with a repeated song; reordered via arrow buttons, pointer drag and Chromium touch input; reloaded and verified persisted order.
- Closed the owned browser process, reopened its persistent profile and verified the edited library and setlists survived.
- Exported JSON, rejected malformed JSON, imported copies without collisions, confirmed full replacement and verified persisted restored data.
- Measured library and stage layouts at 1366×1024, 1024×768, 768×1024, 390×844 and 320×740, including horizontal overflow and effective button targets.
- Production preview: registered the actual generated service worker, disabled browser networking, reloaded the app, opened stage lyrics, played/paused the timeline, reloaded the paused performance and navigated the setlist offline. Passed.
- Public GitHub Pages HTTPS release: correct `/cueline/` service-worker scope; offline reload, setlist, stage timeline, paused recovery and next-song navigation all passed. Live MusicBrainz search returned recording metadata. The hosted browser console reported no errors or warnings.
- Previous-passage text uses its own muted colour rather than reduced opacity, preserving readable contrast for smaller supporting lyrics. Focus and reduced-motion styles are included; physical screen-reader testing remains open.
- GitHub Actions independently passed dependency installation, lint, all 28 tests, production build and Pages deployment: [release run](https://github.com/sean-p-clohessy/cueline/actions/runs/39128252541).

Screenshots and test backups are in ignored `output/playwright/`. They are local QA data and are not published with the app.

## Cover-first update (v1.1)

- Real browser: searched “Addicted to Love”, saw Robert Palmer, Tina Turner and other available artists, and added Robert Palmer with lyrics and saved timestamps in one action.
- Repeated with “Money for Nothing” by Dire Straits. Both imported songs opened directly in Automatic Stage Mode; no lyric paste, splitting or editor setup was required.
- Production PWA: reloaded offline, displayed imported cover lyrics, played/paused and recovered the performance paused after another offline reload.
- Exported/restored a backup containing imported community lyrics, provenance and cues; the collision-safe merge succeeded.
- Added an original by pasting five lines into one form while offline; passages were created automatically and opened ready for Manual mode.
- No commercial lyrics or test backups are committed or shipped in the app shell. Unit fixtures contain original test text only.

## Live performance update (v1.2)

- All new song and setlist launches default to Live, regardless of recording cues. Existing saved passages, source attribution and timings remain unchanged.
- Real Edge browser: tap-to-jump, previous/next line buttons, native wheel scrolling in both directions, CDP touch swipes up/down, and keyboard line navigation passed.
- Selected lyric survived same-tab reload and rotation across 1024×768, 768×1024, 390×844, 320×740 and 844×390. No horizontal overflow; all visible controls measured at least 48×48 CSS pixels. Current lyric remained centered after resize.
- Original one-second test song: held the same lyric beyond its duration; an instrumental solo also stayed open. Last-line navigation stopped without advancing the song.
- Repeated consecutive appearances of the same song reset independently. Rejected leave/song-navigation confirmations preserved position. Empty lyrics displayed a clear explanation with disabled line controls.
- Rapid double-click advanced one line. Testing caught a first-tap debounce initialization issue; corrected it and reran the passing check.
- Pure-black theme, left alignment, larger text and reduced-motion settings passed in the browser. Screenshots inspected at tablet portrait, phone portrait and phone landscape sizes.
- Optional Automatic and Rehearsal remain available through stage display settings: count-in pause/resume, intro, cue progression, manual timestamp recalibration, simulated visibility interruption, paused reload, rehearsal capture/review/save, and return to Live all passed.
- Repeated the real cover search/import for Robert Palmer and Dire Straits; both opened directly in Live with their saved words. No editor or splitting required.
- Production PWA: generated service worker installed, browser networking disabled, offline reload recovered the selected lyric, scrolling and next-song navigation worked, and the library remained available. No runtime errors reported.
- Scripts: `qa-live.txt`, `qa-live-reliability.txt`, `qa-live-timed.txt`, `qa-live-offline.txt`. Fixtures use original text; test data stays in ignored browser profiles/output.

## Device checks still needed

- Physical iPad Safari Add to Home Screen and offline launch.
- Safari/iPadOS-specific wake lock, device lock, orientation and OS interruption behaviour.
- VoiceOver and hands-on usability with an older musician.
- Physical Bluetooth keyboard / foot pedal.
- No claim of live audio synchronisation: this app plays no audio, and estimates must be rehearsed.
