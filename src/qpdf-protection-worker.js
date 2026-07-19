(function () {
  "use strict";

  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);
  let capturedLines = null;
  let modulePromise = null;

  console.log = (...parts) => {
    if (capturedLines) capturedLines.push(parts.join(" "));
    else originalLog(...parts);
  };
  console.error = (...parts) => {
    if (capturedLines) capturedLines.push(parts.join(" "));
    else originalError(...parts);
  };

  importScripts("./vendor/qpdf/qpdf.js");

  function ensureModule() {
    if (!modulePromise) {
      modulePromise = self.Module({
        locateFile: () => "./vendor/qpdf/qpdf.wasm",
        noInitialRun: true,
      });
    }
    return modulePromise;
  }

  function safeUnlink(module, path) {
    try {
      module.FS.unlink(path);
    } catch {
      // El archivo temporal no existe.
    }
  }

  function scrubLines(lines, secrets) {
    return lines.map((line) => {
      let safe = String(line);
      secrets.filter(Boolean).forEach((secret) => {
        safe = safe.split(secret).join("[oculta]");
      });
      return safe.replace(/--password=[^\s]+/g, "--password=[oculta]");
    });
  }

  function callQpdf(module, args, secrets) {
    const lines = [];
    capturedLines = lines;
    let exitCode = 0;
    try {
      const result = module.callMain(args);
      exitCode = Number.isInteger(result) ? result : 0;
    } catch (error) {
      exitCode = Number.isInteger(error?.status) ? error.status : -1;
    } finally {
      capturedLines = null;
    }
    return { exitCode, lines: scrubLines(lines, secrets) };
  }

  function detectEncrypted(module, inputPath) {
    const result = callQpdf(module, ["--is-encrypted", inputPath], []);
    const output = result.lines.join("\n");
    return result.exitCode === 0 || /invalid password/i.test(output);
  }

  function readPageCount(module, inputPath, password) {
    const args = [];
    if (password !== null && password !== undefined) {
      args.push(`--password=${password}`);
    }
    args.push("--show-npages", inputPath);

    const result = callQpdf(module, args, [password]);
    const output = result.lines.join("\n");

    if (result.exitCode !== 0 && result.exitCode !== 3) {
      const error = new Error(/invalid password/i.test(output) ? "wrongPassword" : "incompatible");
      error.code = error.message;
      throw error;
    }

    const pageLine = result.lines.find((line) => /^\s*\d+\s*$/.test(line));
    const pages = Number.parseInt(pageLine || "", 10);
    if (!Number.isInteger(pages) || pages < 1) {
      const error = new Error("incompatible");
      error.code = "incompatible";
      throw error;
    }
    return pages;
  }

  function randomOwnerPassword() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function processPdf(message) {
    const module = await ensureModule();
    const inputPath = "/pdfprivado-pro-input.pdf";
    const outputPath = "/pdfprivado-pro-output.pdf";
    const password = String(message.password || "");
    const requestedOwnerPassword = String(message.ownerPassword || "");
    const permissions = message.permissions && typeof message.permissions === "object"
      ? message.permissions
      : {};
    let ownerPassword = "";

    safeUnlink(module, inputPath);
    safeUnlink(module, outputPath);

    try {
      module.FS.writeFile(inputPath, new Uint8Array(message.buffer));
      const encrypted = detectEncrypted(module, inputPath);

      if (message.operation === "protect" && encrypted) {
        const error = new Error("alreadyEncrypted");
        error.code = "alreadyEncrypted";
        throw error;
      }
      if (message.operation === "unlock" && !encrypted) {
        const error = new Error("notEncrypted");
        error.code = "notEncrypted";
        throw error;
      }

      const pages = readPageCount(
        module,
        inputPath,
        message.operation === "unlock" ? password : null
      );

      let args;
      if (message.operation === "protect") {
        ownerPassword = requestedOwnerPassword || randomOwnerPassword();

        const printPermission = ["full", "low", "none"].includes(permissions.print)
          ? permissions.print
          : "full";

        args = [
          "--password-mode=unicode",
          "--encrypt",
          password,
          ownerPassword,
          "256",
          `--print=${printPermission}`,
          `--extract=${permissions.extract === false ? "n" : "y"}`,
          `--annotate=${permissions.annotate === false ? "n" : "y"}`,
          `--form=${permissions.form === false ? "n" : "y"}`,
          `--assemble=${permissions.assemble === false ? "n" : "y"}`,
          `--modify-other=${permissions.modifyOther === false ? "n" : "y"}`,
          "--",
          inputPath,
          outputPath,
        ];
      } else {
        args = [
          `--password=${password}`,
          "--decrypt",
          inputPath,
          outputPath,
        ];
      }

      const result = callQpdf(module, args, [password, ownerPassword]);
      if (result.exitCode !== 0 && result.exitCode !== 3) {
        const output = result.lines.join("\n");
        const code = /invalid password/i.test(output) ? "wrongPassword" : "incompatible";
        const error = new Error(code);
        error.code = code;
        throw error;
      }

      let output;
      try {
        output = new Uint8Array(module.FS.readFile(outputPath));
      } catch {
        const error = new Error("incompatible");
        error.code = "incompatible";
        throw error;
      }

      return { pages, output };
    } finally {
      ownerPassword = "";
      safeUnlink(module, inputPath);
      safeUnlink(module, outputPath);
    }
  }

  self.addEventListener("message", async (event) => {
    const message = event.data || {};

    if (message.type === "init") {
      try {
        await ensureModule();
        self.postMessage({ type: "ready" });
      } catch {
        self.postMessage({ type: "init-error" });
      }
      return;
    }

    if (message.type !== "process") return;

    try {
      const result = await processPdf(message);
      self.postMessage(
        {
          type: "result",
          requestId: message.requestId,
          pages: result.pages,
          buffer: result.output.buffer,
        },
        [result.output.buffer]
      );
    } catch (error) {
      self.postMessage({
        type: "error",
        requestId: message.requestId,
        code: error?.code || "incompatible",
      });
    }
  });
})();
