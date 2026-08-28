#!/usr/bin/env python3
"""Parse/plan tests for nero-desktop. No display required."""
from __future__ import annotations

import contextlib
import importlib.machinery
import importlib.util
import io
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCRIPT = ROOT / "nero-desktop"


def load_mod():
    loader = importlib.machinery.SourceFileLoader("nero_desktop", str(SCRIPT))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    assert spec is not None
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


class ParseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = load_mod()

    def test_click_default_left(self):
        args = self.m.parse_args(["click", "100", "200"])
        self.assertEqual(args.cmd, "click")
        self.assertEqual(args.x, 100)
        self.assertEqual(args.y, 200)
        self.assertEqual(args.button_num, 1)
        self.assertEqual(
            self.m.tool_argv(args),
            ["xdotool", "mousemove", "--sync", "100", "200", "click", "1"],
        )

    def test_click_right_double(self):
        args = self.m.parse_args(["click", "--button", "right", "--double", "8", "9"])
        self.assertEqual(args.button_num, 3)
        argv = self.m.tool_argv(args)
        self.assertEqual(
            argv,
            ["xdotool", "mousemove", "--sync", "8", "9", "click", "--repeat", "2", "--delay", "80", "3"],
        )

    def test_click_bad_button(self):
        with self.assertRaises(SystemExit):
            self.m.parse_args(["click", "--button", "thumb", "1", "1"])

    def test_type_and_leading_dash(self):
        args = self.m.parse_args(["type", "--delay", "5", "--", "--flag"])
        self.assertEqual(args.text, "--flag")
        self.assertEqual(
            self.m.tool_argv(args),
            ["xdotool", "type", "--clearmodifiers", "--delay", "5", "--", "--flag"],
        )

    def test_type_empty_rejected(self):
        with self.assertRaises(SystemExit):
            self.m.parse_args(["type", ""])

    def test_key_combo(self):
        args = self.m.parse_args(["key", "ctrl+s", "Return"])
        self.assertEqual(
            self.m.tool_argv(args),
            ["xdotool", "key", "--clearmodifiers", "--", "ctrl+s", "Return"],
        )

    def test_key_requires_args(self):
        with self.assertRaises(SystemExit):
            with contextlib.redirect_stderr(io.StringIO()):
                self.m.parse_args(["key"])

    def test_shot_stdout_and_file(self):
        args = self.m.parse_args(["shot"])
        self.assertEqual(self.m.tool_argv(args), ["scrot", "--overwrite", "--file", "-"])
        args = self.m.parse_args(["shot", "--out", "/tmp/a.png"])
        self.assertEqual(self.m.tool_argv(args), ["scrot", "--overwrite", "--file", "/tmp/a.png"])

    def test_lock_strips_ddash(self):
        args = self.m.parse_args(["lock", "--", "sleep", "1"])
        self.assertEqual(args.command, ["sleep", "1"])

    def test_lock_requires_command(self):
        with self.assertRaises(SystemExit):
            self.m.parse_args(["lock"])

    def test_missing_subcommand(self):
        with self.assertRaises(SystemExit):
            with contextlib.redirect_stderr(io.StringIO()):
                self.m.parse_args([])

    def test_dry_run_plan_string(self):
        args = self.m.parse_args(["--dry-run", "--display", ":1", "click", "1", "2"])
        self.assertTrue(args.dry_run)
        plan = self.m.format_plan(args)
        self.assertIn("DISPLAY=:1", plan)
        self.assertIn("xdotool", plan)
        self.assertIn("mousemove", plan)

    def test_display_env_fallback(self):
        old = os.environ.get("NERO_SEAT_DISPLAY")
        os.environ["NERO_SEAT_DISPLAY"] = ":7"
        try:
            args = self.m.parse_args(["shot"])
            self.assertEqual(args.display, ":7")
        finally:
            if old is None:
                os.environ.pop("NERO_SEAT_DISPLAY", None)
            else:
                os.environ["NERO_SEAT_DISPLAY"] = old

    def test_main_dry_run_no_display(self):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = self.m.main(["--dry-run", "key", "Return"])
        self.assertEqual(rc, 0)
        self.assertIn("xdotool key", buf.getvalue())


class LockTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = load_mod()

    def test_lock_serializes(self):
        fd, path = tempfile.mkstemp(prefix="nero-seat-")
        os.close(fd)
        order: list[str] = []

        def hold(tag: str, delay: float) -> None:
            with self.m.seat_lock(path, timeout=2.0):
                order.append(f"{tag}-in")
                time.sleep(delay)
                order.append(f"{tag}-out")

        t1 = threading.Thread(target=hold, args=("a", 0.15))
        t2 = threading.Thread(target=hold, args=("b", 0.01))
        t1.start()
        time.sleep(0.03)
        t2.start()
        t1.join()
        t2.join()
        os.unlink(path)
        self.assertEqual(order[0], "a-in")
        self.assertEqual(order[1], "a-out")
        self.assertEqual(order[2], "b-in")
        self.assertEqual(order[3], "b-out")

    def test_lock_timeout(self):
        fd, path = tempfile.mkstemp(prefix="nero-seat-")
        os.close(fd)
        entered = threading.Event()

        def holder() -> None:
            with self.m.seat_lock(path, timeout=2.0):
                entered.set()
                time.sleep(0.4)

        t = threading.Thread(target=holder)
        t.start()
        self.assertTrue(entered.wait(1.0))
        with self.assertRaises(SystemExit):
            with self.m.seat_lock(path, timeout=0.05):
                pass
        t.join()
        os.unlink(path)

    def test_lock_subcommand_holds_during_spawn(self):
        fd, path = tempfile.mkstemp(prefix="nero-seat-")
        os.close(fd)
        marker = path + ".ready"
        proc = subprocess.Popen(
            [
                sys.executable,
                str(SCRIPT),
                "--lock-file",
                path,
                "--lock-timeout",
                "2",
                "lock",
                "--",
                sys.executable,
                "-c",
                f"open({marker!r}, 'w').close(); import time; time.sleep(0.5)",
            ]
        )
        try:
            deadline = time.monotonic() + 2.0
            while not os.path.exists(marker) and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(os.path.exists(marker), "lock helper never started")
            with self.assertRaises(SystemExit):
                with self.m.seat_lock(path, timeout=0.15):
                    pass
            self.assertEqual(proc.wait(timeout=2), 0)
            with self.m.seat_lock(path, timeout=0.5):
                pass
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait(timeout=2)
            for leftover in (path, marker):
                try:
                    os.unlink(leftover)
                except OSError:
                    pass


if __name__ == "__main__":
    unittest.main()
