import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";

export function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

const TRACE_PARAMS = {
  threshold: 128,
  color: "#000000",
  background: "#ffffff",
  turdSize: 12,
  optTolerance: 0.42,
  turnPolicy: "minority",
  blackOnWhite: true,
};

function workerFilename(): string {
  return path.join(process.cwd(), "src/lib/generate/image-worker.cjs");
}

type Pending = {
  resolve: (svg: string) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function dropWorker(reason: string): void {
  const err = new Error(reason);
  for (const job of pending.values()) job.reject(err);
  pending.clear();
  if (worker) {
    worker.removeAllListeners();
    worker.terminate().catch(() => undefined);
    worker = null;
  }
}

function getWorker(): Worker | null {
  if (worker) return worker;
  const file = workerFilename();
  if (!fs.existsSync(file)) return null;
  worker = new Worker(file);
  worker.on("message", (msg: { id: number; svg?: string; error?: string }) => {
    const job = pending.get(msg.id);
    if (!job) return;
    pending.delete(msg.id);
    if (msg.error) job.reject(new Error(msg.error));
    else job.resolve(msg.svg ?? "");
  });
  worker.on("error", (error) => {
    dropWorker(error.message);
  });
  worker.on("exit", (code) => {
    if (pending.size) dropWorker(`trace worker exited (${code})`);
    worker = null;
  });
  return worker;
}

function traceInProcess(png: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // Lazy require so Next can still treat potrace as an external package.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const potrace = require("potrace") as typeof import("potrace");
    const tracer = new potrace.Potrace();
    tracer.setParameters(TRACE_PARAMS);
    tracer.loadImage(png, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(tracer.getSVG());
    });
  });
}

export async function traceToSvgOffThread(png: Buffer): Promise<string> {
  const thread = getWorker();
  if (!thread) return traceInProcess(png);
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    thread.postMessage({ id, png, params: TRACE_PARAMS });
  }).catch(() => traceInProcess(png));
}
