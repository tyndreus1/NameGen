import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { getSessionSecret } from "./env";
import { startingGrant } from "./credits";
import { hashPassword, verifyPassword, normalizeEmail } from "./password";

export { hashPassword, verifyPassword, normalizeEmail };

const COOKIE = "namegen_session";
const ADMIN_COOKIE = "namegen_admin";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getSessionSecret());
}

export async function createUser(email: string, password: string) {
  const normalized = normalizeEmail(email);
  return prisma.user.create({
    data: {
      email: normalized,
      passwordHash: await hashPassword(password),
      credits: await startingGrant(),
    },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
}

export async function signUserToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, typ: "user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ typ: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());
}

export async function readUserIdFromToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.typ !== "user" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function isAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.typ === "admin";
  } catch {
    return false;
  }
}

export async function setUserCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, await signUserToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearUserCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, await signAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const userId = await readUserIdFromToken(token);
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, credits: true, createdAt: true },
  });
}

export async function isAdminSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return isAdminToken(token);
}
