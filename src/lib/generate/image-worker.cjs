"use strict";

const { parentPort } = require("node:worker_threads");
const potrace = require("potrace");

if (!parentPort) {
  throw new Error("image-worker must run as a worker thread");
}

parentPort.on("message", (msg) => {
  const { id, png, params } = msg;
  const tracer = new potrace.Potrace();
  tracer.setParameters(params);
  tracer.loadImage(Buffer.from(png), (error) => {
    if (error) {
      parentPort.postMessage({ id, error: String(error.message || error) });
      return;
    }
    try {
      parentPort.postMessage({ id, svg: tracer.getSVG() });
    } catch (err) {
      parentPort.postMessage({ id, error: String(err instanceof Error ? err.message : err) });
    }
  });
});
