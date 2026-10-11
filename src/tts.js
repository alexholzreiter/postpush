import fs from "node:fs";
import { spawn } from "node:child_process";

export function synthesizeSpeech(text, destination, options = {}) {
  const command = options.command ?? process.env.PIPER_COMMAND ?? "piper";
  const model = options.model ?? process.env.PIPER_MODEL;
  const timeoutMs = options.timeoutMs ?? 60000;
  if (!model) return Promise.reject(new Error("PIPER_MODEL is not configured."));

  const temporary = `${destination}.tmp.wav`;
  fs.rmSync(temporary, { force: true });

  return new Promise((resolve, reject) => {
    const child = spawn(command, ["--model", model, "--output_file", temporary], {
      stdio: ["pipe", "ignore", "pipe"],
    });
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      fs.rmSync(temporary, { force: true });
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) {
        fs.rmSync(temporary, { force: true });
        reject(
          new Error(
            `Speech generation failed (${signal || `code ${code}`}): ${stderr.trim()}`
          )
        );
        return;
      }
      fs.renameSync(temporary, destination);
      resolve(destination);
    });
    child.stdin.end(`${text}\n`);
  });
}
