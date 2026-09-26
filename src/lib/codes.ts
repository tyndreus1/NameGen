import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { CODE_VALUES, type CodeValue } from "./constants";

/** Crockford-like alphabet without 0/O/1/I. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ALPHABET_RE = new RegExp(`^[${ALPHABET}]+$`);

export type ParsedCode = {
  credits: CodeValue;
  id: string;
  signature: string;
};

function encodeAlphabet(bytes: Buffer, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i % bytes.length]! % ALPHABET.length];
  }
  return out;
}

function hmacDigest(secret: string, credits: number, id: string): string {
  const digest = createHmac("sha256", secret)
    .update(`NG|${credits}|${id}`)
    .digest();
  return encodeAlphabet(digest, 8);
}

export function isCodeValue(value: number): value is CodeValue {
  return (CODE_VALUES as readonly number[]).includes(value);
}

export function formatCode(credits: CodeValue, id: string, signature: string): string {
  const idGroups = `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}`;
  return `NG${credits}-${idGroups}-${signature}`;
}

export function parseCode(raw: string): ParsedCode | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = code.match(/^NG(60|120|240)-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{8})$/);
  if (!match) return null;
  const credits = Number(match[1]) as CodeValue;
  const id = `${match[2]}${match[3]}${match[4]}`;
  const signature = match[5]!;
  if (!ALPHABET_RE.test(id) || !ALPHABET_RE.test(signature)) return null;
  return { credits, id, signature };
}

export function signCode(secret: string, credits: CodeValue, id?: string): string {
  const codeId = (id ?? encodeAlphabet(randomBytes(16), 12)).toUpperCase();
  if (codeId.length !== 12 || !ALPHABET_RE.test(codeId)) {
    throw new Error("Code id must be 12 alphabet characters");
  }
  const signature = hmacDigest(secret, credits, codeId);
  return formatCode(credits, codeId, signature);
}

export function verifyCode(secret: string, raw: string): ParsedCode | null {
  const parsed = parseCode(raw);
  if (!parsed) return null;
  const expected = hmacDigest(secret, parsed.credits, parsed.id);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parsed.signature, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return parsed;
}

export function normalizeCode(raw: string): string | null {
  const parsed = parseCode(raw);
  if (!parsed) return null;
  return formatCode(parsed.credits, parsed.id, parsed.signature);
}
