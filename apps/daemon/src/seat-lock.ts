import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as Fs from "node:fs";
import * as Path from "node:path";

/**
 * Holds an exclusive flock on the seat lock while the human is driving VNC.
 *
 * `nero-desktop` click/type/key already wait on this same inode, so agent
 * inject queues until this process releases (preview blur, idle timeout, or
 * daemon exit). A flag file is not used: flock drops on crash.
 */
const HOLD_PY = `
import fcntl, os, sys
path = sys.argv[1]
parent = os.path.dirname(path)
if parent:
    os.makedirs(parent, exist_ok=True)
fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o644)
fcntl.flock(fd, fcntl.LOCK_EX)
os.write(fd, str(os.getpid()).encode())
sys.stdout.write("ok\\n")
sys.stdout.flush()
sys.stdin.read()
`;

export const HUMAN_DRIVING_IDLE_MS = 20_000;

export class HumanDrivingLock {
  driving = false;
  readonly lockPath: string;
  readonly idleMs: number;
  private child: ChildProcessWithoutNullStreams | undefined;
  private idle: ReturnType<typeof setTimeout> | undefined;

  constructor(lockPath: string, idleMs: number = HUMAN_DRIVING_IDLE_MS) {
    this.lockPath = lockPath;
    this.idleMs = idleMs;
  }

  setDriving(driving: boolean): void {
    if (driving) {
      this.acquire();
      this.bumpIdle();
      return;
    }
    this.release();
  }

  dispose(): void {
    this.release();
  }

  private bumpIdle(): void {
    if (this.idle !== undefined) clearTimeout(this.idle);
    this.idle = setTimeout(() => {
      this.release();
    }, this.idleMs);
    this.idle.unref();
  }

  private acquire(): void {
    this.driving = true;
    if (this.child !== undefined && this.child.exitCode === null) return;
    Fs.mkdirSync(Path.dirname(this.lockPath), { recursive: true });
    const child = spawn("python3", ["-c", HOLD_PY, this.lockPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    child.on("exit", () => {
      if (this.child === child) {
        this.child = undefined;
        this.driving = false;
      }
    });
    child.on("error", () => {
      if (this.child === child) {
        this.child = undefined;
        this.driving = false;
      }
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
