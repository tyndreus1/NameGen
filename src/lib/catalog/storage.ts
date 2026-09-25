import fs from "node:fs";
import path from "node:path";
import { getReferenceStorageDir } from "../env";
import { countComponents } from "../generate/connectivity";
import { binaryToPng, pngToBinary } from "../generate/postprocess";

export function referenceStorageDir(): string {
  const dir = path.isAbsolute(getReferenceStorageDir())
    ? getReferenceStorageDir()
    : path.join(process.cwd(), getReferenceStorageDir());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function referenceFilePath(id: string): string {
  return path.join(referenceStorageDir(), `${id}.png`);
}

export async function cleanReferenceUpload(input: Buffer): Promise<{
  png: Buffer;
  onePiece: boolean;
  warning: string | null;
}> {
  const binary = await pngToBinary(input, 160);
  const png = await binaryToPng(binary);
  const components = countComponents(binary);
  const onePiece = components === 1;
  return {
    png,
    onePiece,
    warning: onePiece ? null : `Bu referans tek parça değil (bağlı bileşen: ${components}).`,
  };
}

export function writeReferenceFile(id: string, png: Buffer): string {
  const dest = referenceFilePath(id);
  fs.writeFileSync(dest, png);
  return dest;
}

export function readReferenceFile(id: string): Buffer | null {
  const dest = referenceFilePath(id);
  if (!fs.existsSync(dest)) return null;
  return fs.readFileSync(dest);
}

export function deleteReferenceFile(id: string): void {
  const dest = referenceFilePath(id);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
}

export function referenceDataUrl(id: string): string | null {
  const buf = readReferenceFile(id);
  if (!buf) return null;
  return `data:image/png;base64,${buf.toString("base64")}`;
}
