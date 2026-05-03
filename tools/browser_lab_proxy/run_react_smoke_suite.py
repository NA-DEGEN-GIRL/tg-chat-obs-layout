#!/usr/bin/env python3
"""Run the Browser Lab React compatibility smoke suite.

This is intentionally a thin orchestrator around the individual smoke tests so
each scenario remains easy to debug alone while the full React gate can be run
with one command.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List


REPO_ROOT = Path(__file__).resolve().parents[2]
TMP_PYCACHE = Path("/tmp/tg-browser-lab-pycache")

PY_COMPILE_TARGETS = [
    "tools/browser_lab_proxy/server.py",
    "tools/browser_lab_proxy/react_smoke_test.py",
    "tools/browser_lab_proxy/react_client_smoke_test.py",
    "tools/browser_lab_proxy/react_hydration_smoke_test.py",
    "tools/browser_lab_proxy/react19_smoke_test.py",
    "tools/browser_lab_proxy/react_suspense_smoke_test.py",
    "tools/browser_lab_proxy/react_action_state_smoke_test.py",
    "tools/browser_lab_proxy/run_real_chrome.py",
    "tools/browser_lab_proxy/run_react_smoke_suite.py",
]

SMOKE_TESTS = [
    "tools/browser_lab_proxy/react_smoke_test.py",
    "tools/browser_lab_proxy/react_client_smoke_test.py",
    "tools/browser_lab_proxy/react_hydration_smoke_test.py",
    "tools/browser_lab_proxy/react19_smoke_test.py",
    "tools/browser_lab_proxy/react_suspense_smoke_test.py",
    "tools/browser_lab_proxy/react_action_state_smoke_test.py",
]

JS_CHECKS = [
    "static_videochat/browser_lab.js",
]


def suite_env() -> Dict[str, str]:
    env = os.environ.copy()
    env["PYTHONPYCACHEPREFIX"] = str(TMP_PYCACHE)
    return env


def run_command(label: str, command: List[str], timeout: int = 180) -> Dict[str, Any]:
    started = time.monotonic()
    result = subprocess.run(
        command,
        cwd=REPO_ROOT,
        env=suite_env(),
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    elapsed = round(time.monotonic() - started, 2)
    item: Dict[str, Any] = {
        "label": label,
        "command": command,
        "returncode": result.returncode,
        "elapsed_sec": elapsed,
    }
    stdout = result.stdout.strip()
    stderr = result.stderr.strip()
    if stdout:
        item["stdout"] = stdout[-4000:]
        try:
            item["json"] = json.loads(stdout)
        except json.JSONDecodeError:
            pass
    if stderr:
        item["stderr"] = stderr[-4000:]
    return item


def main() -> int:
    started = time.monotonic()
    checks: List[Dict[str, Any]] = []

    checks.append(
        run_command(
            "python-compile",
            [sys.executable, "-m", "py_compile", *PY_COMPILE_TARGETS],
            timeout=120,
        )
    )

    for path in JS_CHECKS:
        checks.append(run_command(f"node-check:{path}", ["node", "--check", path], timeout=60))

    for path in SMOKE_TESTS:
        checks.append(run_command(f"smoke:{path}", [sys.executable, path], timeout=240))

    ok = all(item["returncode"] == 0 for item in checks)
    payload = {
        "ok": ok,
        "elapsed_sec": round(time.monotonic() - started, 2),
        "checks": checks,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    if sys.version_info < (3, 9):
        raise SystemExit("Python 3.9+ is required.")
    raise SystemExit(main())
