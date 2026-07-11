export class RenderScheduler {
  constructor({ maxConcurrent = 3, channelLimits = {}, onChange = null } = {}) {
    this.maxConcurrent = Math.max(1, Number(maxConcurrent) || 3);
    this.channelLimits = { ...channelLimits };
    this.queue = new Map();
    this.active = new Map();
    this.sequence = 0;
    this.paused = false;
    this.resumeTimer = 0;
    this.onChange = typeof onChange === "function" ? onChange : null;
  }

  notify() {
    try { this.onChange?.(this.snapshot()); } catch { /* el diagnóstico nunca debe bloquear el renderizado */ }
  }

  enqueue({ key, channel = "default", priority = 0, run, cancel = null }) {
    if (!key || typeof run !== "function") return false;
    if (this.active.has(key)) return false;

    const current = this.queue.get(key);
    if (current) {
      current.priority = Math.max(current.priority, Number(priority) || 0);
      current.run = run;
      current.cancel = cancel;
      this.notify();
      this.pump();
      return false;
    }

    this.queue.set(key, {
      key,
      channel,
      priority: Number(priority) || 0,
      run,
      cancel,
      sequence: ++this.sequence,
    });
    this.notify();
    this.pump();
    return true;
  }

  cancel(key) {
    const queued = this.queue.get(key);
    if (queued) {
      this.queue.delete(key);
      try { queued.cancel?.(); } catch { /* cancelación defensiva */ }
    }
    const active = this.active.get(key);
    if (active) {
      active.cancelled = true;
      try { active.cancel?.(); } catch { /* la tarea puede haber finalizado */ }
    }
    this.notify();
  }

  cancelChannel(channel) {
    for (const job of [...this.queue.values()]) {
      if (job.channel === channel) this.cancel(job.key);
    }
    for (const job of [...this.active.values()]) {
      if (job.channel === channel) this.cancel(job.key);
    }
  }

  pauseFor(milliseconds = 110) {
    this.paused = true;
    this.notify();
    window.clearTimeout(this.resumeTimer);
    this.resumeTimer = window.setTimeout(() => {
      this.paused = false;
      this.notify();
      this.pump();
    }, Math.max(40, Number(milliseconds) || 110));
  }

  clear() {
    for (const key of [...this.queue.keys(), ...this.active.keys()]) this.cancel(key);
    this.queue.clear();
    this.notify();
  }

  channelActiveCount(channel) {
    let count = 0;
    for (const job of this.active.values()) {
      if (job.channel === channel) count += 1;
    }
    return count;
  }

  canStart(job) {
    if (this.active.size >= this.maxConcurrent) return false;
    const limit = Number(this.channelLimits[job.channel]);
    if (Number.isFinite(limit) && limit > 0 && this.channelActiveCount(job.channel) >= limit) return false;
    return true;
  }

  nextJob() {
    const candidates = [...this.queue.values()]
      .filter((job) => this.canStart(job))
      .sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
    return candidates[0] || null;
  }

  pump() {
    if (this.paused) return;
    let job = this.nextJob();
    while (job && this.active.size < this.maxConcurrent) {
      const activeJob = job;
      this.queue.delete(activeJob.key);
      this.active.set(activeJob.key, activeJob);
      this.notify();
      Promise.resolve()
        .then(() => activeJob.cancelled ? undefined : activeJob.run())
        .catch(() => {})
        .finally(() => {
          if (this.active.get(activeJob.key) === activeJob) this.active.delete(activeJob.key);
          this.notify();
          this.pump();
        });
      job = this.nextJob();
    }
  }

  snapshot() {
    return {
      queued: this.queue.size,
      active: this.active.size,
    };
  }
}
