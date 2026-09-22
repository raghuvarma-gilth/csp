"""
Running a student's code against real test cases.

This is a *grader*, not a security sandbox. Read that sentence again before
deploying it. It reduces the blast radius as much as a plain subprocess can —
a scratch working directory, a stripped environment, a wall-clock timeout with
a hard kill, and CPU/address-space limits where the OS provides them — but a
determined submission can still do anything the OS lets that user do.

Deploy the backend in a container that:
  * holds no credentials the grader does not need,
  * has no outbound network access, and
  * is disposable.

Set CODE_EXECUTION_ENABLED=false to turn execution off entirely; the API then
returns an honest "code execution is disabled on this server" instead of
pretending to grade. What it will never do is ask a language model whether the
tests passed and record the answer as a result.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass
from typing import Any

from ..config import settings
from ..errors import PublicError

# --- The harness scripts -----------------------------------------------------
# Both implement the same protocol: read a JSON payload from argv[1], write a
# JSON result to argv[2]. The student's own stdout/stderr stay on the real
# stdout/stderr so it can be shown back to them without corrupting the result.

_JS_RUNNER = r"""
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = { results: [], error: null };

const normalise = (value) => {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = normalise(value[key]);
      return acc;
    }, {});
  }
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return value;
};

const equal = (a, b) => JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));

const preview = (value) => {
  try {
    const text = JSON.stringify(normalise(value));
    return text === undefined ? String(value) : text.slice(0, 400);
  } catch {
    return String(value).slice(0, 400);
  }
};

try {
  const factory = new Function(
    `${payload.source}\n;return typeof ${payload.entry} === "function" ? ${payload.entry} : undefined;`
  );
  const fn = factory();
  if (typeof fn !== "function") {
    out.error = `No function named \`${payload.entry}\` was found. Keep the function name from the starter code.`;
  } else {
    for (const testCase of payload.cases) {
      try {
        const args = JSON.parse(JSON.stringify(testCase.args ?? []));
        const received = fn(...args);
        out.results.push({
          passed: equal(received, testCase.expected),
          received: preview(received),
          error: null,
        });
      } catch (err) {
        out.results.push({ passed: false, received: null, error: String(err && err.message ? err.message : err) });
      }
    }
  }
} catch (err) {
  out.error = String(err && err.message ? err.message : err);
}

fs.writeFileSync(process.argv[3], JSON.stringify(out));
"""

_PY_RUNNER = r'''
import json, sys, traceback

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    payload = json.load(handle)

out = {"results": [], "error": None}


def normalise(value):
    if isinstance(value, tuple):
        return [normalise(item) for item in value]
    if isinstance(value, list):
        return [normalise(item) for item in value]
    if isinstance(value, dict):
        return {key: normalise(value[key]) for key in sorted(value, key=str)}
    if isinstance(value, (set, frozenset)):
        return sorted((normalise(item) for item in value), key=repr)
    return value


def preview(value):
    try:
        return json.dumps(normalise(value))[:400]
    except (TypeError, ValueError):
        return repr(value)[:400]


try:
    namespace = {"__name__": "__submission__"}
    exec(compile(payload["source"], "<submission>", "exec"), namespace)
    fn = namespace.get(payload["entry"])
    if not callable(fn):
        out["error"] = (
            "No function named `%s` was found. Keep the function name from the starter code."
            % payload["entry"]
        )
    else:
        for case in payload["cases"]:
            try:
                args = json.loads(json.dumps(case.get("args") or []))
                received = fn(*args)
                out["results"].append({
                    "passed": normalise(received) == normalise(case.get("expected")),
                    "received": preview(received),
                    "error": None,
                })
            except Exception as exc:
                out["results"].append({
                    "passed": False,
                    "received": None,
                    "error": "%s: %s" % (type(exc).__name__, exc),
                })
except Exception as exc:
    out["error"] = "%s: %s" % (type(exc).__name__, exc)
    traceback.print_exc(file=sys.stderr)

with open(sys.argv[2], "w", encoding="utf-8") as handle:
    json.dump(out, handle)
'''


@dataclass(slots=True)
class CaseResult:
    passed: bool
    received: str | None
    error: str | None


@dataclass(slots=True)
class RunOutcome:
    results: list[CaseResult]
    error: str | None
    stdout: str
    timed_out: bool
    language: str

    @property
    def passed_count(self) -> int:
        return sum(1 for result in self.results if result.passed)

    @property
    def all_passed(self) -> bool:
        return bool(self.results) and all(result.passed for result in self.results)


def _python_binary() -> str:
    return settings.python_binary or sys.executable


def runnable_languages() -> list[str]:
    """Which languages this machine can actually execute right now."""
    if not settings.code_execution_enabled:
        return []
    available = []
    if shutil.which(settings.node_binary):
        available.append("javascript")
    if _python_binary():
        available.append("python")
    return available


def _child_env() -> dict[str, str]:
    """
    A deliberately bare environment. Nothing about Supabase, Gemini or Hugging
    Face is inherited, so a submission that reads os.environ finds nothing worth
    stealing.
    """
    keep = ("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "LANG", "LC_ALL", "COMSPEC")
    env = {name: os.environ[name] for name in keep if name in os.environ}
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["NODE_OPTIONS"] = f"--max-old-space-size={settings.code_execution_memory_mb}"
    return env


def _limits():  # pragma: no cover - POSIX only
    """CPU and address-space ceilings. Unavailable on Windows; see the docstring."""
    try:
        import resource
    except ImportError:
        return None

    seconds = int(settings.code_execution_timeout_seconds) + 1
    memory = settings.code_execution_memory_mb * 1024 * 1024

    def apply() -> None:
        resource.setrlimit(resource.RLIMIT_CPU, (seconds, seconds))
        resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
        resource.setrlimit(resource.RLIMIT_NPROC, (64, 64))
        resource.setrlimit(resource.RLIMIT_FSIZE, (4 * 1024 * 1024, 4 * 1024 * 1024))

    return apply


async def run_submission(
    language: str,
    source: str,
    entry: str,
    cases: list[dict[str, Any]],
) -> RunOutcome:
    language = language.lower().strip()

    if not settings.code_execution_enabled:
        raise PublicError(
            "Code execution is disabled on this server, so this submission cannot be graded. "
            "You can still use the mentor and hints.",
            status=503,
            code="code_execution_disabled",
        )

    if language == "javascript":
        binary = shutil.which(settings.node_binary)
        if not binary:
            raise PublicError(
                "This server has no JavaScript runtime installed, so JavaScript submissions "
                "cannot be graded here. Try Python, or ask an administrator to install Node.js.",
                status=503,
                code="language_not_runnable",
            )
        runner_name, runner_source, argv = "runner.js", _JS_RUNNER, [binary, "--no-warnings"]
    elif language == "python":
        binary = _python_binary()
        runner_name, runner_source, argv = "runner.py", _PY_RUNNER, [binary, "-I", "-B"]
    else:
        raise PublicError(
            f"Submissions in {language} cannot be graded on this server. "
            "Python and JavaScript are supported.",
            status=400,
            code="language_not_runnable",
        )

    with tempfile.TemporaryDirectory(prefix="eduverse-run-") as workdir:
        runner_path = os.path.join(workdir, runner_name)
        payload_path = os.path.join(workdir, "payload.json")
        result_path = os.path.join(workdir, "result.json")

        with open(runner_path, "w", encoding="utf-8") as handle:
            handle.write(runner_source)
        with open(payload_path, "w", encoding="utf-8") as handle:
            json.dump({"source": source, "entry": entry, "cases": cases}, handle)

        kwargs: dict[str, Any] = {}
        limits = _limits()
        if limits is not None and os.name != "nt":
            kwargs["preexec_fn"] = limits

        process = await asyncio.create_subprocess_exec(
            *argv,
            runner_path,
            payload_path,
            result_path,
            cwd=workdir,
            env=_child_env(),
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            **kwargs,
        )

        timed_out = False
        try:
            stdout_bytes, _ = await asyncio.wait_for(
                process.communicate(), timeout=settings.code_execution_timeout_seconds
            )
        except asyncio.TimeoutError:
            timed_out = True
            stdout_bytes = b""
            try:
                process.kill()
            except ProcessLookupError:
                pass
            await process.wait()

        stdout = (stdout_bytes or b"").decode("utf-8", errors="replace")[-4000:]

        if timed_out:
            return RunOutcome(
                results=[],
                error=(
                    f"Your code ran for more than {settings.code_execution_timeout_seconds:.0f} "
                    "seconds and was stopped. That usually means a loop never ends."
                ),
                stdout=stdout,
                timed_out=True,
                language=language,
            )

        try:
            with open(result_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, ValueError):
            return RunOutcome(
                results=[],
                error=(
                    "Your code could not be run. It may have crashed before any test "
                    "started — check the output below."
                ),
                stdout=stdout,
                timed_out=False,
                language=language,
            )

        return RunOutcome(
            results=[
                CaseResult(
                    passed=bool(item.get("passed")),
                    received=item.get("received"),
                    error=item.get("error"),
                )
                for item in payload.get("results", [])
            ],
            error=payload.get("error"),
            stdout=stdout,
            timed_out=False,
            language=language,
        )
