import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

const jwtSecretEnv = process.env.JWT_SECRET;
if (!jwtSecretEnv) {
  throw new Error(
    "JWT_SECRET is required. Generate one with `openssl rand -hex 32` " +
    "and set it in your environment. See .ai/SECURITY.md."
  );
}
if (jwtSecretEnv.length < 32) {
  console.warn(
    "[auth] JWT_SECRET is shorter than 32 characters — this is insecure. " +
    "Regenerate with `openssl rand -hex 32`."
  );
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretEnv);

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = await createToken(userId);
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return token;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token));

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user || user.deletedAt) return null;

  return { user, session };
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  cookieStore.delete("session");
}

export function requireAuth(allowedRoles?: string[]) {
  return async function checkAuth() {
    const session = await getSession();
    
    if (!session) {
      return { redirect: "/connexion" };
    }

    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
      return { redirect: "/" };
    }

    return { user: session.user };
  };
}
