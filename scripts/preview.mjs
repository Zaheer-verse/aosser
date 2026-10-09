#!/usr/bin/env node
/**
 * Owns :8081, the built-output QA preview.
 *
 * `vite preview` is strictPort, so a preview left over from an earlier turn
 * both fails the next start and keeps serving the previous build's output.
 * Linux keeps the App Builder /proc ownership behavior. Windows uses native
 * TCP/process inventory and only stops preview commands from this workspace.
 *
 *   node scripts/preview.mjs stop|restart
 */
import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PREVIEW_PORT = 8081;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PID_FILE = join(ROOT, ".grok/preview.pid");
const LOG_FILE = join(ROOT, ".grok/preview.log");
const READY_TIMEOUT_MS = Number(process.env.PREVIEW_READY_TIMEOUT_MS || 60000);
const GRACE_MS = 3000;
const POLL_MS = 100;
const IS_WINDOWS = process.platform === "win32";

export function parsePreviewArgs(argv) {
  const [action, ...rest] = argv;
  if (!action) return { error: "usage: node scripts/preview.mjs stop|restart" };
  if (rest.length > 0) return { error: `unexpected argument: ${rest[0]}` };
  if (!["stop", "restart"].includes(action)) {
    return { error: `unknown action: ${action} (expected stop or restart)` };
  }
  return { action };
}

export function parsePid(text) {
  const pid = Number.parseInt(String(text ?? "").trim(), 10);
  // pid 1 is the sandbox init — never the preview, and dangerous to signal.
  return Number.isInteger(pid) && pid > 1 ? pid : null;
}

/** pgid of a process from its /proc/<pid>/stat line. */
export function parsePgid(stat) {
  const line = String(stat ?? "");
  // The comm field is parenthesised and may itself contain spaces; state, ppid
  // and pgrp are the three fields after it.
  const end = line.lastIndexOf(") ");
  if (end === -1) return null;
  const pgid = Number.parseInt(line.slice(end + 2).split(/\s+/)[2], 10);
  return Number.isInteger(pgid) && pgid > 0 ? pgid : null;
}

const TCP_LISTEN = "0A";

/** Socket inodes of the LISTEN sockets on `port` in a /proc/net/tcp{,6} dump. */
export function parseListenerInodes(procNetTcp, port) {
  const wanted = `:${port.toString(16).toUpperCase().padStart(4, "0")}`;
  const inodes = [];
  for (const line of String(procNetTcp ?? "").split("\n")) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 10 || cols[3] !== TCP_LISTEN || !cols[1].endsWith(wanted)) continue;
    if (/^\d+$/.test(cols[9])) inodes.push(cols[9]);
  }
  return inodes;
}

export function looksLikePreviewProcess(cmdline) {
  // /proc/<pid>/cmdline is NUL-separated.
  const argv = String(cmdline ?? "")
    .split("\0")
    .filter(Boolean)
    .join(" ");
  // The sandbox service runs scripts/preview-thumbnail.mjs in this box, and
  // this script can be running concurrently: neither is ever a target.
  if (/\bpreview[\w-]*\.mjs\b/.test(argv)) return false;
  // The `npm run preview` wrapper (`npm-cli.js run preview`) and its vite child.
  // `preview` must be the whole script name: `run preview:stop`/`preview:restart`
  // are this tooling's own wrappers, and `vite build --outDir preview-dist` is
  // not a server.
  return (
    /\brun\s+preview(?:\s|$)/.test(argv) ||
    /\bvite\b\s+preview\b/.test(argv) ||
    /[\\/]vite[\\/]bin[\\/]vite\.js["']?\s+preview(?:\s|$)/.test(argv)
  );
}

/** Do not treat another project's preview on the same port as ours. */
export function isWindowsWorkspacePreview(commandLine, root) {
  if (!looksLikePreviewProcess(commandLine)) return false;
  const command = String(commandLine ?? "")
    .replaceAll("\\", "/")
    .toLowerCase();
  const workspace = String(root).replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
  if (!workspace) return false;
  const escaped = workspace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}(?:[/\\s"']|$)`).test(command);
}

/** Return unrelated listeners separately so callers fail before signalling. */
export function windowsPreviewOwners({ portPids, pidFilePid, processes, root }) {
  const byPid = new Map(processes.map((record) => [record.pid, record]));
  const own = (pid) => {
    const record = byPid.get(pid);
    if (!record || !looksLikePreviewProcess(record.commandLine)) return false;
    // npm may launch Vite with relative paths. Its --prefix wrapper supplies
    // the workspace identity, so inspect the native parent chain as well.
    const visited = new Set();
    let current = record;
    while (current && !visited.has(current.pid)) {
      if (isWindowsWorkspacePreview(current.commandLine, root)) return true;
      visited.add(current.pid);
      current = byPid.get(current.parentPid);
    }
    return false;
  };
  const owners = new Set(portPids.filter(own));
  if (pidFilePid !== null && own(pidFilePid)) owners.add(pidFilePid);
  return { owners: [...owners], unrelated: portPids.filter((pid) => !own(pid)) };
}

/** npm.cmd cannot be spawned directly without a shell on Windows. */
export function windowsNpmCommand({ execPath, npmExecPath, root, fileExists = existsSync }) {
  const candidates = [
    npmExecPath,
    win32.join(win32.dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  const npmCli = candidates.find(
    (file) => file && win32.basename(file).toLowerCase() === "npm-cli.js" && fileExists(file),
  );
  if (!npmCli) throw new Error("Cannot find npm-cli.js beside Node.js or in npm_execpath.");
  return { command: execPath, args: [npmCli, "--prefix", root, "run", "preview"] };
}

/**
 * Pids to signal. Port owners are owners by definition; the pidfile pid is only
 * a claim left by an earlier run — pids are re-used across hibernate/revive, so
 * signal it only when its command line still looks like the preview.
 */
export function previewOwners({ portPids, pidFilePid, cmdlineOf }) {
  const owners = new Set(portPids);
  if (
    pidFilePid !== null &&
    !owners.has(pidFilePid) &&
    looksLikePreviewProcess(cmdlineOf(pidFilePid))
  ) {
    owners.add(pidFilePid);
  }
  return [...owners];
}

async function waitForExit(pids, { isAlive, sleep, timeoutMs, pollMs }) {
  let remaining = pids.filter((pid) => isAlive(pid));
  for (let waited = 0; remaining.length > 0 && waited < timeoutMs; waited += pollMs) {
    await sleep(pollMs);
    remaining = remaining.filter((pid) => isAlive(pid));
  }
  return remaining;
}

/**
 * SIGTERM every live pid, then SIGKILL whatever outlives the grace period.
 * Returns `{ signalled, killed, stubborn }` — `stubborn` is still alive after
 * the SIGKILL wait, which means the port is not reliably free.
 */
export async function terminatePids(
  pids,
  { kill, isAlive, sleep, graceMs = GRACE_MS, pollMs = POLL_MS },
) {
  const signalled = pids.filter((pid) => isAlive(pid));
  for (const pid of signalled) kill(pid, "SIGTERM");
  const killed = await waitForExit(signalled, { isAlive, sleep, timeoutMs: graceMs, pollMs });
  for (const pid of killed) kill(pid, "SIGKILL");
  const stubborn = await waitForExit(killed, { isAlive, sleep, timeoutMs: graceMs, pollMs });
  return { signalled, killed, stubborn };
}

/**
 * What `stop` reports. `after` is the post-kill port check: `unattributed: true`
 * means a listener exists whose pid could not be resolved, so it may not claim
 * the port is free.
 */
export function stopOutcome({ signalled, stubborn, after }) {
  const held = [...new Set([...stubborn, ...after.pids])];
  if (held.length > 0) {
    return { ok: false, error: `port ${PREVIEW_PORT} is still held by pid(s) ${held.join(", ")}` };
  }
  if (after.unattributed) {
    return {
      ok: false,
      error: `port ${PREVIEW_PORT} is held by a process this script cannot see`,
    };
  }
  const message =
    signalled.length > 0
      ? `stopped pid(s) ${signalled.join(", ")} — port ${PREVIEW_PORT} is free`
      : `nothing was listening on ${PREVIEW_PORT}`;
  return { ok: true, message };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === "EPERM";
  }
}

function pgidOf(pid) {
  try {
    return parsePgid(readFileSync(`/proc/${pid}/stat`, "utf8"));
  } catch {
    return null;
  }
}

function killPid(pid, signal) {
  if (IS_WINDOWS) {
    // Recheck identity immediately before signalling in case a pid was reused.
    let selection;
    try {
      selection = windowsPreviewOwners({
        portPids: [pid],
        pidFilePid: null,
        processes: windowsInventory().processes,
        root: ROOT,
      });
    } catch {
      return;
    }
    if (!selection.owners.includes(pid)) return;
    try {
      process.kill(pid, signal);
    } catch {
      // Exited between identification and the signal.
    }
    return;
  }
  // restart() detaches the server into its own process group, so signal the
  // group to reach `vite` under the `npm` wrapper. Only for a leader: `-pid` on
  // a pid that leads no group still reaches any unrelated group numbered pid.
  if (pgidOf(pid) === pid) {
    try {
      process.kill(-pid, signal);
      return;
    } catch {
      // The group exited between the pgid read and the signal.
    }
  }
  try {
    process.kill(pid, signal);
  } catch {
    // Exited between the liveness check and the signal.
  }
}

function cmdlineOf(pid) {
  if (IS_WINDOWS) {
    if (parsePid(pid) !== pid) return "";
    try {
      return JSON.parse(
        runWindowsPowerShell(
          `$record = Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction Stop; ` +
            `ConvertTo-Json -InputObject ([string]$record.CommandLine) -Compress`,
        ),
      );
    } catch {
      return "";
    }
  }
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8");
  } catch {
    // Usually a dead pid — the stale pidfile this corroboration exists for.
    return "";
  }
}

function readPidFile() {
  try {
    return parsePid(readFileSync(PID_FILE, "utf8"));
  } catch {
    return null;
  }
}

function pidsForSocketInodes(inodes) {
  const targets = new Set([...inodes].map((inode) => `socket:[${inode}]`));
  const pids = [];
  for (const entry of readdirSync("/proc")) {
    const pid = parsePid(entry);
    if (pid === null || pid === process.pid) continue;
    let fds;
    try {
      fds = readdirSync(`/proc/${pid}/fd`);
    } catch {
      // Exited mid-scan, or owned by another user.
      continue;
    }
    for (const fd of fds) {
      try {
        if (targets.has(readlinkSync(`/proc/${pid}/fd/${fd}`))) {
          pids.push(pid);
          break;
        }
      } catch {
        // fd closed mid-scan.
      }
    }
  }
  return pids;
}

function runWindowsPowerShell(script) {
  const powershell = win32.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  return execFileSync(
    powershell,
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); ` +
        `$ErrorActionPreference = 'Stop'; ${script}`,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
  );
}

function windowsInventory() {
  const result = JSON.parse(
    runWindowsPowerShell(
      `$listeners = @(Get-NetTCPConnection -ErrorAction Stop | Where-Object { ` +
        `$_.State -eq 'Listen' -and $_.LocalPort -eq ${PREVIEW_PORT} }); ` +
        `$records = @(Get-CimInstance Win32_Process -ErrorAction Stop | ForEach-Object { ` +
        `[pscustomobject]@{ pid = [int]$_.ProcessId; parentPid = [int]$_.ParentProcessId; commandLine = [string]$_.CommandLine } }); ` +
        `[pscustomobject]@{ pids = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique); ` +
        `processes = $records } | ConvertTo-Json -Depth 4 -Compress`,
    ),
  );
  if (!Array.isArray(result.pids) || !Array.isArray(result.processes)) {
    throw new Error("Windows process inventory did not return valid arrays.");
  }
  const pids = result.pids.map(parsePid).filter((pid) => pid !== null);
  return { pids, processes: result.processes, unattributed: pids.length !== result.pids.length };
}

/**
 * `{ pids, unattributed }` — `unattributed: true` when the port has a listener
 * whose owning pid could not be resolved (an fd dir we may not read).
 */
function portOwners() {
  if (IS_WINDOWS) return windowsInventory();
  const inodes = new Set();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let dump;
    try {
      dump = readFileSync(file, "utf8");
    } catch {
      // tcp6 is absent when the box has no IPv6.
      continue;
    }
    for (const inode of parseListenerInodes(dump, PREVIEW_PORT)) inodes.add(inode);
  }
  const pids = inodes.size > 0 ? pidsForSocketInodes(inodes) : [];
  return { pids, unattributed: inodes.size > 0 && pids.length === 0 };
}

async function stop(announce = true) {
  let initial;
  try {
    initial = portOwners();
  } catch (err) {
    console.error(`[preview] could not inspect port ${PREVIEW_PORT}: ${err.message}`);
    return false;
  }
  let owners;
  if (IS_WINDOWS) {
    const selection = windowsPreviewOwners({
      portPids: initial.pids,
      pidFilePid: readPidFile(),
      processes: initial.processes,
      root: ROOT,
    });
    if (initial.unattributed || selection.unrelated.length > 0) {
      console.error(
        `[preview] port ${PREVIEW_PORT} has an unrelated or unidentified listener; no processes were stopped`,
      );
      return false;
    }
    owners = selection.owners;
  } else {
    owners = previewOwners({ portPids: initial.pids, pidFilePid: readPidFile(), cmdlineOf });
  }
  const { signalled, stubborn } = await terminatePids(owners, { kill: killPid, isAlive, sleep });

  let after;
  try {
    after = portOwners();
  } catch (err) {
    console.error(`[preview] could not verify that port ${PREVIEW_PORT} is free: ${err.message}`);
    return false;
  }
  const outcome = stopOutcome({ signalled, stubborn, after });
  if (!outcome.ok) {
    // Keep the pidfile: a survivor the port scan cannot attribute leaves it as
    // the only record a retry could use.
    console.error(`[preview] ${outcome.error}`);
    return false;
  }
  rmSync(PID_FILE, { force: true });
  if (announce) console.log(`[preview] ${outcome.message}`);
  return true;
}

async function waitForReady(failure) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline && failure() === null) {
    try {
      // Any HTTP response means the server is bound; a 404 is still ready.
      await fetch(PREVIEW_URL, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch {
      await sleep(250);
    }
  }
  return false;
}

async function restart() {
  if (!(await stop())) return 1;

  mkdirSync(dirname(LOG_FILE), { recursive: true });
  let launch;
  try {
    launch = IS_WINDOWS
      ? windowsNpmCommand({
          execPath: process.execPath,
          npmExecPath: process.env.npm_execpath,
          root: ROOT,
        })
      : { command: "npm", args: ["run", "preview"] };
  } catch (err) {
    console.error(`[preview] ${err.message}`);
    return 1;
  }
  const log = openSync(LOG_FILE, "a");
  const child = spawn(launch.command, launch.args, {
    cwd: ROOT,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", log, log],
  });
  closeSync(log);
  child.unref();
  if (child.pid) writeFileSync(PID_FILE, `${child.pid}\n`);

  let failure = null;
  child.on("error", (err) => {
    failure = `npm run preview could not be spawned: ${err.message}`;
  });
  child.on("exit", (code, signal) => {
    failure = `npm run preview exited early (${signal ?? `code ${code}`})`;
  });

  if (!(await waitForReady(() => failure))) {
    const secs = Math.round(READY_TIMEOUT_MS / 1000);
    const why =
      failure ??
      `nothing answered on ${PREVIEW_URL} within ${secs}s — check that vite.config.ts ` +
        `still sets preview.port ${PREVIEW_PORT}`;
    console.error(`[preview] ${why} — see ${LOG_FILE}`);
    // A server that binds a few seconds later would serve a build the agent has
    // already been told to distrust.
    await stop(false);
    return 1;
  }
  console.log(`[preview] serving ${PREVIEW_URL} (pid ${child.pid}, log ${LOG_FILE})`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parsePreviewArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`[preview] ${args.error}`);
    process.exit(1);
  }
  if (!IS_WINDOWS && !existsSync("/proc/self")) {
    console.error("[preview] this helper requires Linux /proc or Windows process inventory");
    process.exit(1);
  }
  process.exitCode = args.action === "stop" ? ((await stop()) ? 0 : 1) : await restart();
}
