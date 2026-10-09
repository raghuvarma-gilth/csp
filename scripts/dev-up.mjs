/**
 * One command to bring the whole stack up.
 *
 *     node scripts/dev-up.mjs
 *
 * Why this exists: getting EduVerse running locally has four independent
 * failure points — the backend virtualenv, the pinned dependencies against a
 * too-new Python, the four API keys, and two servers on two ports. Each one
 * fails with a different symptom, and "the API is not working" looks identical
 * for all of them. This script does them in order, checks each, and tells you
 * exactly which one stopped it.
 *
 * It is idempotent: already-installed dependencies are skipped, and a port
 * already in use is reported rather than fought over.
 *
 * Flags:
 *   --backend-only    skip the Vite dev server
 *   --frontend-only   skip the API server
 *   --check           report what is installed and configured, start nothing
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const BACKEND = path.join(ROOT, "backend");
const VENV = path.join(BACKEND, ".venv");
const API_PORT = 8000;
const WEB_PORT = 8080;

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has("--check");
const SKIP_WEB = args.has("--backend-only");
const SKIP_API = args.has("--frontend-only");

/* Windows puts the venv executables in Scripts/, POSIX in bin/. */
const IS_WIN = process.platform === "win32";
const venvBin = (name) =>
  path.join(VENV, IS_WIN ? "Scripts" : "bin", IS_WIN ? `${name}.exe` : name);

const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const OFF = "\x1b[0m";

const say = (msg) => console.log(msg);
const step = (msg) => console.log(`\n${BOLD}${msg}${OFF}`);
const ok = (msg) => console.log(`  ${GREEN}OK${OFF}    ${msg}`);
const warn = (msg) => console.log(`  ${YELLOW}WARN${OFF}  ${msg}`);
const fail = (msg) => console.log(`  ${RED}FAIL${OFF}  ${msg}`);
const note = (msg) => console.log(`        ${DIM}${msg}${OFF}`);

/** Resolve on true if something is already listening on `port`. */
const portBusy = (port) =>
  new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (busy) => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(700);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });

/* ------------------------------------------------------------ 1. backend env */

function pythonVersion(exe) {
  const probe = spawnSync(exe, ["--version"], { encoding: "utf8" });
  if (probe.error) return null;
  const text = `${probe.stdout ?? ""}${probe.stderr ?? ""}`.trim();
  const m = text.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? { raw: text, major: +m[1], minor: +m[2] } : null;
}

/** Which third-party packages are present in the venv. */
function installedPackages() {
  const dirs = [
    path.join(VENV, "Lib", "site-packages"),
    path.join(VENV, "lib"),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      // POSIX nests one more level: lib/python3.12/site-packages
      if (entries.some((e) => e.isDirectory() && /^python3/.test(e.name))) {
        const inner = entries.find((e) => /^python3/.test(e.name));
        const sp = path.join(dir, inner.name, "site-packages");
        if (existsSync(sp)) return readdirSync(sp);
        continue;
      }
      return entries.map((e) => e.name);
    } catch {
      /* unreadable; treat as empty */
    }
  }
  return [];
}

const REQUIRED = ["fastapi", "uvicorn", "pydantic", "httpx", "dotenv", "multipart"];

function ensureBackend() {
  step("Backend environment");

  if (!existsSync(BACKEND)) {
    fail("backend/ does not exist");
    return false;
  }

  if (!existsSync(venvBin("python"))) {
    warn("no virtualenv — creating backend/.venv");
    if (CHECK_ONLY) return false;
    const base = pythonVersion("python") ? "python" : "py";
    const made = spawnSync(base, ["-m", "venv", ".venv"], {
      cwd: BACKEND,
      stdio: "inherit",
    });
    if (made.status !== 0) {
      fail("could not create the virtualenv");
      note("install Python 3.11 or 3.12 and re-run");
      return false;
    }
  }

  const py = pythonVersion(venvBin("python"));
  if (!py) {
    fail("the virtualenv's python is not runnable — delete backend/.venv and re-run");
    return false;
  }
  ok(`virtualenv python ${py.raw}`);

  const present = installedPackages().map((n) => n.toLowerCase());
  const missing = REQUIRED.filter(
    (pkg) => !present.some((n) => n === pkg || n.startsWith(`${pkg}-`) || n.startsWith(`${pkg}.`)),
  );

  if (missing.length === 0) {
    ok("dependencies installed");
    return true;
  }

  warn(`missing dependencies: ${missing.join(", ")}`);
  if (CHECK_ONLY) {
    note("run without --check to install them");
    return false;
  }

  /* pydantic-core is a compiled Rust extension. On a Python newer than the
     pinned pydantic supports there is no wheel, so pip tries to build from
     source and needs a Rust toolchain. Try the pinned set first — it is the
     tested one — and fall back to letting pip resolve versions that do have
     wheels for this interpreter. */
  say(`${DIM}        installing pinned requirements…${OFF}`);
  let r = spawnSync(venvBin("python"), ["-m", "pip", "install", "-r", "requirements.txt"], {
    cwd: BACKEND,
    stdio: "inherit",
  });

  if (r.status !== 0) {
    warn("the pinned requirements did not install");
    if (py.major === 3 && py.minor >= 13) {
      note(`Python ${py.major}.${py.minor} is newer than the pinned pydantic supports.`);
      note("retrying unpinned so pip can pick versions with wheels for it…");
      r = spawnSync(
        venvBin("python"),
        [
          "-m", "pip", "install",
          "fastapi", "uvicorn[standard]", "httpx",
          "pydantic", "pydantic-settings", "python-dotenv", "python-multipart",
        ],
        { cwd: BACKEND, stdio: "inherit" },
      );
      if (r.status === 0) {
        warn("installed UNPINNED versions — they differ from requirements.txt");
        note("for the tested set, recreate the venv with Python 3.11 or 3.12");
      }
    }
  }

  if (r.status !== 0) {
    fail("dependency installation failed");
    note("most likely cause: no prebuilt wheel for this Python version");
    note("fix: delete backend/.venv, recreate it with Python 3.11 or 3.12, re-run");
    return false;
  }

  ok("dependencies installed");
  return true;
}

/* ------------------------------------------------------------- 2. the servers */

const children = [];

/**
 * `shell` is needed for npm on Windows (it is a .cmd shim) and must NOT be used
 * for the venv python: under a shell the absolute path is re-parsed, so a
 * directory containing a space would break the command.
 */
function launch(label, cmd, cmdArgs, cwd, useShell = false) {
  const child = spawn(cmd, cmdArgs, { cwd, stdio: "inherit", shell: useShell });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) fail(`${label} exited with code ${code}`);
  });
  children.push({ label, child });
  return child;
}

const shutdown = () => {
  for (const { child } of children) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }
};
process.on("SIGINT", () => {
  say("\nstopping…");
  shutdown();
  process.exit(0);
});
process.on("exit", shutdown);

/* ------------------------------------------------------------- 3. health read */

async function reportHealth() {
  const url = `http://127.0.0.1:${API_PORT}/api/health`;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = await res.json();

      step("API health");
      say(`  status: ${body.status === "ok" ? GREEN : YELLOW}${body.status}${OFF}  (v${body.version})`);

      for (const [feature, enabled] of Object.entries(body.features ?? {})) {
        (enabled ? ok : warn)(feature);
      }

      const langs = body.runnableLanguages ?? [];
      note(langs.length ? `runnable languages: ${langs.join(", ")}` : "no code runtimes found");
      if (body.models?.chatProvider) note(`chat provider: ${body.models.chatProvider} (${body.models.chat})`);

      const missing = body.missingConfiguration ?? [];
      if (missing.length) {
        step("Missing configuration");
        note("add these to backend/.env, then restart the API:");
        for (const item of missing) say(`  ${YELLOW}·${OFF} ${item}`);
      }
      return body;
    } catch {
      /* not up yet */
    }
  }

  step("API health");
  fail(`no response from ${url} after 20s`);
  note("check the uvicorn output above for an import error or a port clash");
  return null;
}

/* ---------------------------------------------------------------- 4. sequence */

say(`${BOLD}EduVerse — bringing the stack up${OFF}`);
note(ROOT);

const backendReady = SKIP_API ? true : ensureBackend();

step("Ports");
const apiBusy = await portBusy(API_PORT);
const webBusy = await portBusy(WEB_PORT);
(apiBusy ? warn : ok)(`:${API_PORT} ${apiBusy ? "already in use — not starting the API" : "free"}`);
(webBusy ? warn : ok)(`:${WEB_PORT} ${webBusy ? "already in use — not starting Vite" : "free"}`);

if (CHECK_ONLY) {
  if (apiBusy) await reportHealth();
  step("Done (--check: nothing was started)");
  process.exit(0);
}

if (!SKIP_API && backendReady && !apiBusy) {
  step(`Starting the API on :${API_PORT}`);
  launch(
    "api",
    venvBin("python"),
    ["-m", "uvicorn", "app.main:app", "--reload", "--port", String(API_PORT)],
    BACKEND,
  );
}

if (!SKIP_WEB && !webBusy) {
  step(`Starting the frontend on :${WEB_PORT}`);
  launch("web", IS_WIN ? "npm.cmd" : "npm", ["run", "dev"], ROOT, true);
}

if (!SKIP_API && (backendReady || apiBusy)) {
  await reportHealth();
}

step("Running");
if (!SKIP_WEB) say(`  frontend  http://localhost:${WEB_PORT}`);
if (!SKIP_API) say(`  API       http://localhost:${API_PORT}/docs`);
note("Ctrl-C stops both");

if (!backendReady && !SKIP_API) {
  step("The API did not start");
  note("the frontend still works: student pages read Supabase directly with the");
  note("anon key. Only /faculty, /research, /industry and /admin need this API.");
}
