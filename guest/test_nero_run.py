#!/usr/bin/env python3
"""Parse tests for guest/nero-run. Does not talk to systemd."""
from __future__ import annotations

import os
import subprocess
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "nero-run"


def run_dry(*cmd: str, job_id: str | None = None) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["NERO_RUN_DRY"] = "1"
    if job_id is None:
        env.pop("NERO_JOB_ID", None)
    else:
        env["NERO_JOB_ID"] = job_id
    return subprocess.run(
        [str(SCRIPT), *cmd],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )


class NeroRunTests(unittest.TestCase):
    def test_usage_exit(self):
        proc = run_dry()
        self.assertEqual(proc.returncode, 2)
        self.assertIn("usage:", proc.stderr)

    def test_prints_scope_slice(self):
        proc = run_dry("blender", "-b", "scene.blend", "-f", "1")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        line = proc.stdout.strip()
        self.assertTrue(line.startswith("systemd-run --user --scope --slice=nero-job.slice"))
        self.assertIn("-p MemoryHigh=48G", line)
        self.assertIn("-p MemoryMax=64G", line)
        self.assertIn("-p CPUWeight=100", line)
        self.assertIn("--collect", line)
        self.assertTrue(line.endswith("-- blender -b scene.blend -f 1"))

    def test_job_id_unit(self):
        proc = run_dry("sleep", "1", job_id="bake")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("--unit=nero-job-bake.scope", proc.stdout)
        self.assertIn("-- sleep 1", proc.stdout)

    def test_no_unit_without_id(self):
        proc = run_dry("true")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertNotIn("--unit=", proc.stdout)

    def test_job_id_rejects_slash(self):
        proc = run_dry("true", job_id="foo/bar")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("NERO_JOB_ID", proc.stderr)

    def test_job_id_rejects_space(self):
        proc = run_dry("true", job_id="bake one")
        self.assertEqual(proc.returncode, 2)

    def test_script_posts_job_heartbeat(self):
        text = SCRIPT.read_text()
        self.assertIn("job-heartbeat", text)
        self.assertIn("NERO_HOST_TOKEN", text)
        self.assertIn("host.docker.internal", text)


if __name__ == "__main__":
    unittest.main()
