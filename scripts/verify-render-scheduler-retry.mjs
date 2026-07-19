import assert from "node:assert/strict";
import { RenderScheduler } from "../src/render-scheduler.js";

globalThis.window ??= globalThis;
window.clearTimeout ??= clearTimeout;
window.setTimeout ??= setTimeout;

function waitFor(predicate, timeoutMs = 1500) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const poll = () => {
      if (predicate()) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(
          new Error(
            "Tiempo agotado esperando al planificador de renderizado."
          )
        );
        return;
      }

      setTimeout(poll, 5);
    };

    poll();
  });
}

let releaseFirstRun;

const firstRunFinished = new Promise((resolve) => {
  releaseFirstRun = resolve;
});

const executions = [];
const scheduler = new RenderScheduler({
  maxConcurrent: 1,
});

scheduler.enqueue({
  key: "continuous:page-44",
  channel: "continuous",
  priority: 10,
  run: async () => {
    executions.push("first-start");
    await firstRunFinished;
    executions.push("first-finish");
  },
  cancel: () => {
    executions.push("first-cancel");
    releaseFirstRun();
  },
});

await waitFor(
  () => executions.includes("first-start")
);

scheduler.cancel("continuous:page-44");

const queuedRetry = scheduler.enqueue({
  key: "continuous:page-44",
  channel: "continuous",
  priority: 100,
  run: async () => {
    executions.push("retry-run");
  },
});

assert.equal(
  queuedRetry,
  true,
  "Una tarea cancelada que sigue activa debe aceptar un reintento con la misma clave."
);

await waitFor(
  () => executions.includes("retry-run")
);

assert.deepEqual(executions, [
  "first-start",
  "first-cancel",
  "first-finish",
  "retry-run",
]);

assert.deepEqual(scheduler.snapshot(), {
  queued: 0,
  active: 0,
});

console.log(
  "OK  reintento de renderizado tras cancelacion validado"
);