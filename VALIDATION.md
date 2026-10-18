# CueLine validation

Validation date: 18 October 2026. Windows, Node 24, Edge via Playwright CLI.

## Automated

- Strict TypeScript: passed.
- ESLint with React hooks: passed without warnings.
- Vitest: **28 tests passed**, covering the monotonic engine, cue handling, setlist reorder, backup validation and IndexedDB persistence/restore.
- Vite production build and generated PWA service worker: passed.

## Real-browser workflows

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

Screenshots and test backups are in ignored `output/playwright/`. They are local QA data and are not published with the app.

## Device checks still needed

- Physical iPad Safari Add to Home Screen and offline launch.
- Safari/iPadOS-specific wake lock, device lock, orientation and OS interruption behaviour.
- VoiceOver and hands-on usability with an older musician.
- Physical Bluetooth keyboard / foot pedal.
- No claim of live audio synchronisation: this app plays no audio, and estimates must be rehearsed.
