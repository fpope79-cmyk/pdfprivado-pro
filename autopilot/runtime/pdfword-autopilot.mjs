#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.0.1';
const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const homeDir = path.resolve(runtimeDir, '..');
const configPath = path.join(homeDir, 'config.json');
const statePath = path.join(homeDir, 'state.json');
const latestPath = path.join(homeDir, 'latest-status.json');
const lockPath = path.join(homeDir, 'agent.lock');
const logPath = path.join(homeDir, 'agent.log');

function now() { return new Date().toISOString(); }
function log(message) {
  const line = `[${now()}] ${message}`;
  console.log(line);
  try { fs.appendFileSync(logPath, `${line}\n`, 'utf8'); } catch {}
}
function readJson(p, fallback = null) {
  try {
    const text = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/u, '');
    return JSON.parse(text);
  } catch { return fallback; }
}
function writeJsonAtomic(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, p);
}
function sha256File(p) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(p));
  return hash.digest('hex');
}
function run(command, args, opts = {}) {
  const cp = spawnSync(command, args, {
    cwd: opts.cwd,
    env: opts.env || process.env,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: opts.timeoutMs,
  });
  return {
    status: cp.status ?? 1,
    stdout: cp.stdout || '',
    stderr: cp.stderr || '',
    error: cp.error ? String(cp.error.message || cp.error) : null,
  };
}
function git(args, cwd, options = {}) {
  const r = run('git', args, { cwd, timeoutMs: options.timeoutMs || 120000 });
  if (!options.allowFailure && r.status !== 0) {
    throw new Error(`git ${args.join(' ')} fallo (${r.status}): ${r.stderr || r.stdout}`);
  }
  return r;
}
function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function acquireLock() {
  if (fs.existsSync(lockPath)) {
    const old = readJson(lockPath, {});
    if (isProcessAlive(old.pid)) {
      throw new Error(`Ya hay un agente PDFWord activo (PID ${old.pid}).`);
    }
  }
  writeJsonAtomic(lockPath, { pid: process.pid, startedAt: now(), version: VERSION });
}
function releaseLock() {
  try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch {}
}
function expandEnv(input) {
  return String(input || '').replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? `%${name}%`);
}
function baselineManifest(home, name) {
  return path.join(home, 'baselines', name, 'manifest.json');
}
function verifyBaseline(config) {
  const manifestPath = baselineManifest(homeDir, config.activeBaseline);
  const manifest = readJson(manifestPath);
  if (!manifest) throw new Error(`No existe baseline local ${config.activeBaseline}.`);
  const mismatches = [];
  for (const file of manifest.files || []) {
    const actualPath = path.join(config.project, file.relativePath);
    if (!fs.existsSync(actualPath)) {
      mismatches.push({ file: file.relativePath, expected: file.sha256, actual: null });
      continue;
    }
    const actual = sha256File(actualPath);
    if (actual !== file.sha256) mismatches.push({ file: file.relativePath, expected: file.sha256, actual });
  }
  return { ok: mismatches.length === 0, manifest, mismatches };
}
function restoreBaseline(config, manifest) {
  const root = path.dirname(baselineManifest(homeDir, config.activeBaseline));
  for (const file of manifest.files || []) {
    const src = path.join(root, 'files', file.relativePath);
    const dst = path.join(config.project, file.relativePath);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}
function snapshotBaseline(config, name, note = '') {
  const root = path.join(homeDir, 'baselines', name);
  const filesRoot = path.join(root, 'files');
  fs.mkdirSync(filesRoot, { recursive: true });
  const files = [];
  for (const rel of config.protectedFiles) {
    const src = path.join(config.project, rel);
    if (!fs.existsSync(src)) throw new Error(`No existe archivo protegido: ${src}`);
    const dst = path.join(filesRoot, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    files.push({ relativePath: rel, sha256: sha256File(src) });
  }
  writeJsonAtomic(path.join(root, 'manifest.json'), { name, createdAt: now(), note, files });
  return { name, files };
}
function safeSummary(result) {
  if (!result || typeof result !== 'object') return null;
  const out = {};
  for (const key of ['experiment', 'pass', 'decision', 'promotionAllowed', 'note']) {
    if (key in result && ['string','boolean','number'].includes(typeof result[key])) out[key] = result[key];
  }
  if (result.candidate && typeof result.candidate === 'object') {
    out.candidate = {};
    for (const key of ['pages','strictSsim','deltaVsR3P','deltaVsV23','eligiblePages','wordTables','tableGroups','formGroups']) {
      if (key in result.candidate && ['number','boolean','string'].includes(typeof result.candidate[key])) out.candidate[key] = result.candidate[key];
    }
  }
  if (result.baseline && typeof result.baseline === 'object') {
    out.baseline = {};
    for (const key of ['v23','r3p','r3pRerendered']) {
      if (key in result.baseline && ['number','boolean','string'].includes(typeof result.baseline[key])) out.baseline[key] = result.baseline[key];
    }
  }
  if (result.gates && typeof result.gates === 'object') {
    out.gates = {};
    for (const [k, v] of Object.entries(result.gates)) {
      if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') out.gates[k] = v;
    }
  }
  return out;
}
function discoverResult(job, startedMs) {
  const disc = job.resultDiscovery;
  if (!disc) return null;
  const root = expandEnv(disc.root);
  if (!fs.existsSync(root)) return null;
  const prefix = disc.prefix || '';
  const filename = disc.file || 'RESULTADO.json';
  let best = null;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
    const candidate = path.join(root, entry.name, filename);
    if (!fs.existsSync(candidate)) continue;
    const st = fs.statSync(candidate);
    if (st.mtimeMs + 120000 < startedMs) continue;
    if (!best || st.mtimeMs > best.mtimeMs) best = { path: candidate, mtimeMs: st.mtimeMs };
  }
  if (!best) return null;
  const raw = readJson(best.path);
  return raw ? { path: best.path, raw, summary: safeSummary(raw) } : null;
}
function outcomeFrom(exitCode, result) {
  if (result?.summary?.pass === true) return 'PASS';
  if (result?.summary?.pass === false) return 'FAIL';
  if (exitCode === 0) return 'PASS_NO_RESULT';
  if (exitCode === 2) return 'FAIL';
  return 'TECHNICAL_FAIL';
}
function publishResult(config, payload) {
  const control = config.controlRepo;
  const stamp = payload.finishedAt.replace(/[:.]/g, '-');
  const rel = path.posix.join('autopilot', 'results', payload.jobId, `${stamp}.json`);
  const abs = path.join(control, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  for (let attempt = 1; attempt <= 3; attempt++) {
    git(['pull', '--rebase', '--autostash', 'origin', config.controlBranch], control, { allowFailure: true });
    git(['add', '--', rel], control);
    const commit = git(['commit', '-m', `autopilot: result ${payload.jobId} ${payload.outcome}`], control, { allowFailure: true });
    if (commit.status !== 0 && !`${commit.stdout}\n${commit.stderr}`.includes('nothing to commit')) {
      throw new Error(`No se pudo crear commit de resultado: ${commit.stderr || commit.stdout}`);
    }
    const push = git(['push', 'origin', config.controlBranch], control, { allowFailure: true, timeoutMs: 180000 });
    if (push.status === 0) return rel;
    log(`Push de resultado intento ${attempt} fallo; reintentando.`);
  }
  throw new Error('No se pudo publicar el resultado tras 3 intentos.');
}
function refreshControl(config) {
  const control = config.controlRepo;
  const r = git(['pull', '--ff-only', 'origin', config.controlBranch], control, { allowFailure: true, timeoutMs: 120000 });
  if (r.status !== 0) log(`Advertencia al actualizar control: ${r.stderr || r.stdout}`);
}
function executeJob(config, state, queue, job) {
  const startedAt = now();
  const startedMs = Date.now();
  const baselineCheck = verifyBaseline(config);
  if (!baselineCheck.ok) {
    const payload = {
      schemaVersion: 1, agentVersion: VERSION, jobId: job.id, title: job.title,
      startedAt, finishedAt: now(), outcome: 'BLOCKED_BASELINE_MISMATCH',
      activeBaseline: config.activeBaseline,
      mismatchCount: baselineCheck.mismatches.length,
      summary: null,
    };
    writeJsonAtomic(latestPath, payload);
    state.processed[job.id] = payload;
    writeJsonAtomic(statePath, state);
    publishResult(config, payload);
    log(`${job.id}: bloqueado porque el motor no coincide con ${config.activeBaseline}.`);
    return;
  }

  const scriptPath = path.join(config.controlRepo, ...job.script.split('/'));
  if (!scriptPath.startsWith(path.resolve(config.controlRepo) + path.sep)) throw new Error('Ruta de trabajo fuera de controlRepo.');
  if (!fs.existsSync(scriptPath)) throw new Error(`No existe job: ${scriptPath}`);
  const actualSha = sha256File(scriptPath);
  const canonicalSha = crypto.createHash('sha256')
    .update(Buffer.from(
      fs.readFileSync(scriptPath, 'utf8')
        .replace(/^\uFEFF/u, '')
        .replace(/\r\n/g, '\n'),
      'utf8'
    ))
    .digest('hex');

  if (
    job.sha256 &&
    actualSha !== job.sha256 &&
    canonicalSha !== job.sha256
  ) {
    throw new Error(`SHA256 de job incorrecto para ${job.id}. raw=${actualSha} canonical=${canonicalSha}`);
  }

  const runDir = path.join(homeDir, 'runs', job.id, startedAt.replace(/[:.]/g, '-'));
  fs.mkdirSync(runDir, { recursive: true });
  const consolePath = path.join(runDir, 'console.log');

  let command, args;
  if (job.shell === 'powershell') {
    command = 'powershell.exe';
    args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath];
  } else if (job.shell === 'node') {
    command = process.execPath;
    args = [scriptPath];
  } else {
    throw new Error(`Shell no permitido: ${job.shell}`);
  }

  log(`${job.id}: inicio.`);
  const cp = run(command, args, {
    cwd: config.project,
    timeoutMs: Math.max(1, Number(job.timeoutMinutes || 180)) * 60 * 1000,
    env: { ...process.env, PDFWORD_AUTOPILOT: '1', PDFWORD_AUTOPILOT_JOB: job.id },
  });
  fs.writeFileSync(consolePath, `${cp.stdout}${cp.stderr ? `\n--- STDERR ---\n${cp.stderr}` : ''}`, 'utf8');

  const result = discoverResult(job, startedMs);
  let outcome = outcomeFrom(cp.status, result);
  const keepOnPass = job.keepAppliedOnPass === true && outcome === 'PASS';

  if (!keepOnPass) {
    restoreBaseline(config, baselineCheck.manifest);
    const afterRestore = verifyBaseline(config);
    if (!afterRestore.ok) outcome = 'TECHNICAL_FAIL_ROLLBACK';
  } else {
    const nextName = job.nextBaselineName || job.id;
    snapshotBaseline(config, nextName, `Promovido solo como baseline local por ${job.id}; no commit/tag.`);
    config.activeBaseline = nextName;
    writeJsonAtomic(configPath, config);
  }

  const finishedAt = now();
  const payload = {
    schemaVersion: 1,
    agentVersion: VERSION,
    jobId: job.id,
    title: job.title,
    startedAt,
    finishedAt,
    outcome,
    exitCode: cp.status,
    activeBaselineBefore: baselineCheck.manifest.name,
    activeBaselineAfter: config.activeBaseline,
    keptApplied: keepOnPass,
    summary: result?.summary || null,
    privacy: { consoleUploaded: false, artifactsUploaded: false, documentsUploaded: false },
  };
  writeJsonAtomic(latestPath, payload);
  state.processed[job.id] = payload;
  writeJsonAtomic(statePath, state);
  const remoteResult = publishResult(config, payload);
  log(`${job.id}: ${outcome}. Resultado publicado en ${remoteResult}.`);
}
function cycle(config, state) {
  refreshControl(config);
  const queuePath = path.join(config.controlRepo, 'autopilot', 'control', 'queue.json');
  const queue = readJson(queuePath);
  if (!queue || queue.schemaVersion !== 1 || !Array.isArray(queue.jobs)) {
    throw new Error('queue.json invalido o incompatible.');
  }
  const closed = new Set(queue.closedIds || []);
  for (const job of queue.jobs) {
    if (!job?.id || job.enabled === false) continue;
    if (closed.has(job.id)) continue;
    if (state.processed[job.id]) continue;
    executeJob(config, state, queue, job);
    return true;
  }
  return false;
}
async function main() {
  if (!fs.existsSync(configPath)) throw new Error(`Falta configuración: ${configPath}`);
  const config = readJson(configPath);
  config.project = path.resolve(config.project);
  config.controlRepo = path.resolve(config.controlRepo);
  config.controlBranch ||= 'pdfword-autopilot';
  config.pollSeconds ||= 60;
  config.protectedFiles ||= ['src/pdf-word-structural-docx.js', 'src/convert-export-formats.js'];

  const state = readJson(statePath, { schemaVersion: 1, processed: {} });
  state.processed ||= {};
  acquireLock();
  process.on('exit', releaseLock);
  process.on('SIGINT', () => { releaseLock(); process.exit(0); });
  process.on('SIGTERM', () => { releaseLock(); process.exit(0); });

  const daemon = process.argv.includes('--daemon');
  log(`PDFWord Autopilot ${VERSION} iniciado. Baseline=${config.activeBaseline}.`);
  do {
    try { cycle(config, state); } catch (err) { log(`ERROR: ${err.stack || err}`); }
    if (!daemon) break;
    await new Promise(r => setTimeout(r, config.pollSeconds * 1000));
  } while (true);
}

main().catch(err => { log(`FATAL: ${err.stack || err}`); releaseLock(); process.exitCode = 1; });
