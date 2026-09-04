import type { APIContext } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'mysteam_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const hmacSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return secret;
};

interface SessionPayload {
  userId: string;
  steamId: string;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString();
}

function sign(data: string): string {
  return createHmac('sha256', hmacSecret()).update(data).digest('base64url');
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expected = sign(payloadB64);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as SessionPayload & {
      exp: number;
    };
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) {
      return null;
    }
    return { userId: payload.userId, steamId: payload.steamId };
  } catch {
    return null;
  }
}

export function getSession(context: APIContext): SessionPayload | null {
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setSession(context: APIContext, payload: SessionPayload): void {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const body = { ...payload, exp };
  const payloadB64 = base64UrlEncode(JSON.stringify(body));
  const token = `${payloadB64}.${sign(payloadB64)}`;

  context.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSession(context: APIContext): void {
  context.cookies.delete(SESSION_COOKIE, { path: '/' });
}
