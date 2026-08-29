import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as Fs from "node:fs";
import * as Path from "node:path";

/**
 * Holds an exclusive flock on `/run/nero/seat.lock` while the human is driving.
 * Spawns `nero-desktop hold` so the inode matches agent `click`/`type`/`key`.
 */
export const HUMAN_DRIVING_IDLE_MS = 20_000;
const ACQUIRE_MS = 5_000;

export class HumanDrivingLock {
  driving = false;
  readonly lockPath: string;
  readonly holdBin: string;
  readonly idleMs: number;
  private child: ChildProcessWithoutNullStreams | undefined;
  private idle: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;

  constructor(lockPath: string, holdBin: string, idleMs: number = HUMAN_DRIVING_IDLE_MS) {
    this.lockPath = lockPath;
    this.holdBin = holdBin;
    this.idleMs = idleMs;
  }

  async setDriving(driving: boolean): Promise<{ driving: boolean }> {
    const seq = ++this.seq;
    if (!driving) {
      this.release();
      return { driving: false };
    }
    if (this.child !== undefined && this.child.exitCode === null) {
      this.driving = true;
      this.bumpIdle();
      return { driving: true };
    }
    await this.acquire(seq);
    if (seq !== this.seq) return { driving: this.driving };
    this.bumpIdle();
    return { driving: this.driving };
  }

  dispose(): void {
    this.seq += 1;
    this.release();
  }

  private bumpIdle(): void {
    if (this.idle !== undefined) clearTimeout(this.idle);
    this.idle = setTimeout(() => {
      this.release();
    }, this.idleMs);
    this.idle.unref();
  }

  private acquire(seq: number): Promise<void> {
    return new Promise((resolve) => {
      Fs.mkdirSync(Path.dirname(this.lockPath), { recursive: true });
      const args = ["--lock-file", this.lockPath, "--lock-timeout", "0", "hold"];
      const child = this.holdBin.includes(Path.sep)
        ? spawn("python3", [this.holdBin, ...args], { stdio: ["pipe", "pipe", "pipe"] })
        : spawn(this.holdBin, args, { stdio: ["pipe", "pipe", "pipe"] });
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        finish();
      }, ACQUIRE_MS);
      child.stdout.on("data", (chunk: Buffer | string) => {
        if (!String(chunk).includes("ok")) return;
        clearTimeout(timer);
        if (seq !== this.seq) {
          try {
            child.stdin.end();
          } catch {
            // already closed
          }
          child.kill("SIGTERM");
          finish();
          return;
        }
        this.child = child;
        this.driving = true;
        finish();
      });
      child.on("error", () => {
        clearTimeout(timer);
        if (this.child === child) {
          this.child = undefined;
          this.driving = false;
        }
        finish();
      });
      child.on("exit", () => {
        clearTimeout(timer);
        if (this.child === child) {
          this.child = undefined;
          this.driving = false;
        }
        finish();
      });
    });
  }

  private release(): void {
    this.driving = false;
    if (this.idle !== undefined) {
      clearTimeout(this.idle);
      this.idle = undefined;
    }
    const child = this.child;
    this.child = undefined;
    if (child === undefined) return;
    try {
      child.stdin.end();
    } catch {
      // already closed
    }
    child.kill("SIGTERM");
  }
}
