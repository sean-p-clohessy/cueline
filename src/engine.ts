import type { PlaybackMode, Song } from "./model";

export type TransportState = "ready" | "playing" | "paused" | "ended";
export interface ClockView {
  state: TransportState;
  countdown: number;
  elapsed: number;
  index: number;
  intro: boolean;
  interrupted: boolean;
}

/** Authoritative time is a monotonic anchor plus an accumulated offset, never a tick count. */
export class CueClock {
  private offset: number;
  private anchor = 0;
  private state: TransportState = "ready";
  private manualIndex = -1;
  private interrupted = false;
  constructor(
    readonly song: Song,
    readonly mode: PlaybackMode,
    private now: () => number = () => performance.now(),
  ) {
    this.offset = -song.countdown;
  }
  private position() {
    return (
      this.offset +
      (this.state === "playing" ? (this.now() - this.anchor) / 1000 : 0)
    );
  }
  read(): ClockView {
    const position = this.position();
    if (position >= this.song.duration && this.state === "playing") {
      this.offset = this.song.duration;
      this.state = "ended";
    }
    const elapsed = Math.min(this.song.duration, Math.max(0, position));
    let index = -1;
    if (position >= 0) {
      if (this.mode === "automatic") {
        this.song.passages.forEach((p, i) => {
          if (
            p.start !== null &&
            p.start <= elapsed &&
            p.start >= this.song.intro
          )
            index = i;
        });
      } else index = this.manualIndex;
    }
    return {
      state: this.state,
      countdown: Math.max(0, -position),
      elapsed,
      index,
      intro: position >= 0 && elapsed < this.song.intro,
      interrupted: this.interrupted,
    };
  }
  play() {
    if (this.state === "ended") return;
    if (this.state !== "playing") {
      this.anchor = this.now();
      this.state = "playing";
      this.interrupted = false;
    }
  }
  pause(interrupted = false) {
    if (this.state === "playing") {
      this.offset = Math.min(this.song.duration, this.position());
      this.state = this.offset >= this.song.duration ? "ended" : "paused";
      this.interrupted = interrupted;
    }
  }
  restart() {
    this.offset = -this.song.countdown;
    this.state = "ready";
    this.manualIndex = -1;
    this.interrupted = false;
  }
  seek(seconds: number) {
    this.offset = Math.max(0, Math.min(this.song.duration, seconds));
    this.anchor = this.now();
    if (this.offset >= this.song.duration) this.state = "ended";
    else if (this.state === "ended" || this.state === "ready")
      this.state = "paused";
  }
  nudge(seconds: number) {
    this.seek(Math.max(0, this.position()) + seconds);
  }
  passage(delta: number) {
    const current = this.read();
    if (!this.song.passages.length) return;
    const index = Math.max(
      0,
      Math.min(this.song.passages.length - 1, current.index + delta),
    );
    if (this.mode === "automatic")
      this.seek(this.song.passages[index].start ?? current.elapsed);
    else {
      this.manualIndex = index;
      if (current.countdown > 0) this.seek(0);
    }
  }
  capture(): { index: number; seconds: number } | null {
    const view = this.read();
    if (
      this.mode !== "rehearsal" ||
      view.state !== "playing" ||
      view.countdown > 0 ||
      this.manualIndex >= this.song.passages.length - 1
    )
      return null;
    this.manualIndex++;
    return {
      index: this.manualIndex,
      seconds: Math.round(view.elapsed * 10) / 10,
    };
  }
  restore(elapsed: number, index: number) {
    this.seek(elapsed);
    this.manualIndex = index;
    this.state = "paused";
    this.interrupted = true;
  }
  interruptAt(view: ClockView) {
    this.offset = view.countdown > 0 ? -view.countdown : view.elapsed;
    this.manualIndex = view.index;
    this.state = "paused";
    this.interrupted = true;
  }
}
