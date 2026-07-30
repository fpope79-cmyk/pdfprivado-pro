#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const home = path.resolve(runtimeDir, '..');
const config = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8'));
let latest = null;
try { latest = JSON.parse(fs.readFileSync(path.join(home, 'latest-status.json'), 'utf8')); } catch {}
let lock = null;
try { lock = JSON.parse(fs.readFileSync(path.join(home, 'agent.lock'), 'utf8')); } catch {}

console.log('============================================================');
console.log(' PDFPRIVADO PRO - PDF→WORD AUTOPILOT');
console.log('============================================================');
console.log(`Baseline local: ${config.activeBaseline}`);
console.log(`Agente: ${lock?.pid ? `activo (PID ${lock.pid})` : 'sin lock activo'}`);
if (!latest) {
  console.log('Último experimento: todavía ninguno.');
  process.exit(0);
}
console.log(`Último experimento: ${latest.jobId}`);
console.log(`Resultado: ${latest.outcome}`);
if (latest.summary?.candidate) {
  const c = latest.summary.candidate;
  if (typeof c.strictSsim === 'number') console.log(`SSIM: ${c.strictSsim.toFixed(12)}`);
  if (typeof c.deltaVsR3P === 'number') console.log(`Delta vs R3P: ${c.deltaVsR3P >= 0 ? '+' : ''}${c.deltaVsR3P.toFixed(12)}`);
  if (typeof c.deltaVsV23 === 'number') console.log(`Delta vs v23: ${c.deltaVsV23 >= 0 ? '+' : ''}${c.deltaVsV23.toFixed(12)}`);
}
console.log(`Aplicado como baseline: ${latest.keptApplied ? 'SÍ' : 'NO'}`);
console.log(`Finalizado: ${latest.finishedAt || '-'}`);
