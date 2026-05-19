"""
Unified test runner.

Runs pytest (unit + integration) and all e2e sweeps, parses results,
and writes tests/results/latest.json for the admin dashboard.

Usage:
    python tests/run_all.py
    python tests/run_all.py --no-e2e   # skip sweeps (no live server needed)
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
RESULTS_DIR = ROOT / "tests" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

E2E_SWEEPS = [
    ROOT / "tests" / "e2e_api_sweep.py",
    ROOT / "tests" / "e2e_api_sweep2.py",
    ROOT / "tests" / "e2e_api_sweep3.py",
    ROOT / "tests" / "e2e_api_sweep4.py",
    ROOT / "tests" / "e2e_api_sweep5.py",
]

NO_E2E = "--no-e2e" in sys.argv


def _run(cmd: list, cwd=None, timeout=300) -> tuple[int, str]:
    """Run a command, return (exit_code, combined_output)."""
    env = {**os.environ, "PYTHONUTF8": "1"}
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=timeout, cwd=str(cwd or ROOT), env=env,
        )
        return proc.returncode, proc.stdout + proc.stderr
    except subprocess.TimeoutExpired:
        return -1, "TIMEOUT after 300s"
    except Exception as exc:
        return -1, f"ERROR: {exc}"


def _parse_pass_fail(output: str) -> tuple[list[str], list[str]]:
    """Extract PASS/FAIL lines from sweep script stdout."""
    passes = re.findall(r"\[PASS\] (.+)", output)
    failures = re.findall(r"\[FAIL\] (.+)", output)
    return passes, failures


def _parse_pytest_json(output: str, exit_code: int) -> dict:
    """Parse pytest verbose output when --json-report is not available."""
    passed = len(re.findall(r" PASSED", output))
    failed = len(re.findall(r" FAILED", output))
    errors = len(re.findall(r" ERROR", output))

    # Also try the summary line: "5 passed, 2 failed"
    summary = re.search(r"(\d+) passed", output)
    if summary:
        passed = int(summary.group(1))
    summary_fail = re.search(r"(\d+) failed", output)
    if summary_fail:
        failed = int(summary_fail.group(1))

    failure_details = re.findall(r"FAILED (.+?) -", output)

    return {
        "passed": passed,
        "failed": failed + errors,
        "failures": failure_details,
        "exit_code": exit_code,
    }


def run_pytest() -> dict:
    """Run the full pytest suite (unit + integration)."""
    t0 = time.time()
    print("Running pytest ...", flush=True)
    code, output = _run([
        sys.executable, "-m", "pytest",
        "tests/unit", "tests/backend",
        "-v", "--tb=short", "-p", "no:warnings",
    ])
    elapsed = round(time.time() - t0, 1)
    result = _parse_pytest_json(output, code)
    result["name"] = "pytest (unit + integration)"
    result["duration_seconds"] = elapsed
    result["output_tail"] = output[-3000:]  # keep last 3 KB for dashboard
    print(f"  pytest: {result['passed']} passed, {result['failed']} failed [{elapsed}s]")
    return result


def run_sweep(path: Path) -> dict:
    """Run one e2e sweep script."""
    if not path.exists():
        return {
            "name": path.name, "passed": 0, "failed": 0,
            "failures": [f"{path.name} not found"], "exit_code": -1,
            "duration_seconds": 0, "output_tail": "",
        }
    t0 = time.time()
    print(f"Running {path.name} ...", flush=True)
    code, output = _run([sys.executable, str(path)])
    elapsed = round(time.time() - t0, 1)
    passes, failures = _parse_pass_fail(output)
    print(f"  {path.name}: {len(passes)} passed, {len(failures)} failed [{elapsed}s]")
    return {
        "name": path.name,
        "passed": len(passes),
        "failed": len(failures),
        "passes": passes,
        "failures": failures,
        "exit_code": code,
        "duration_seconds": elapsed,
        "output_tail": output[-2000:],
    }


def main():
    overall_t0 = time.time()
    print(f"\n{'='*60}")
    print(f"  Groomnice Test Suite — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    suites = []

    # 1. pytest
    suites.append(run_pytest())

    # 2. E2E sweeps (require live server on :8002)
    if not NO_E2E:
        print("\nRunning e2e sweeps (requires server on :8002) ...")
        for sweep_path in E2E_SWEEPS:
            suites.append(run_sweep(sweep_path))
    else:
        print("\nSkipping e2e sweeps (--no-e2e)")

    total_passed = sum(s["passed"] for s in suites)
    total_failed = sum(s["failed"] for s in suites)
    duration = round(time.time() - overall_t0, 1)

    results = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": duration,
        "total_passed": total_passed,
        "total_failed": total_failed,
        "e2e_included": not NO_E2E,
        "suites": suites,
    }

    out_path = RESULTS_DIR / "latest.json"
    out_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\n{'='*60}")
    print(f"  TOTAL: {total_passed} passed, {total_failed} failed [{duration}s]")
    print(f"  Results saved to {out_path}")
    print(f"{'='*60}\n")

    sys.exit(1 if total_failed else 0)


if __name__ == "__main__":
    main()
