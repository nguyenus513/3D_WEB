const COOKIE_NAME = '2fa-verified';

export interface TwoFactorCookiePayload {
  userId: string;
  email?: string | null;
  sessionFingerprint?: string | null;
  verifiedAt: number;
}

interface CookieLike {
  get(name: string): { value?: string } | undefined;
}

function base64UrlEncode(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return new Uint8Array([...binary].map((char) => char.charCodeAt(0)));
}

async function sign(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

export function getTwoFactorCookieName() {
  return COOKIE_NAME;
}

export function getTwoFactorSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
}

export async function hashTwoFactorSession(value?: string | null) {
  if (!value) return '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}

export async function getTwoFactorSessionFingerprint(cookies: CookieLike) {
  const token = cookies.get('__Secure-authjs.session-token')?.value
    || cookies.get('authjs.session-token')?.value
    || cookies.get('__Host-authjs.session-token')?.value
    || cookies.get('next-auth.session-token')?.value
    || cookies.get('__Secure-next-auth.session-token')?.value;
  return hashTwoFactorSession(token);
}

export async function createTwoFactorCookie(payload: Omit<TwoFactorCookiePayload, 'verifiedAt'>, secret = getTwoFactorSecret()) {
  if (!secret) throw new Error('Missing auth secret');
  const fullPayload: TwoFactorCookiePayload = { ...payload, verifiedAt: Date.now() };
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = await sign(body, secret);
  return `${body}.${signature}`;
}

export async function verifyTwoFactorCookie(
  value: string | undefined,
  expected: Pick<TwoFactorCookiePayload, 'userId'> & { email?: string | null; sessionFingerprint?: string | null },
  secret = getTwoFactorSecret(),
) {
  if (!value || !secret) return false;
  const [body, signature] = value.split('.');
  if (!body || !signature) return false;
  const expectedSignature = await sign(body, secret);
  if (!timingSafeEqual(signature, expectedSignature)) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as TwoFactorCookiePayload;
    return payload.userId === expected.userId
      && (payload.email || '') === (expected.email || '')
      && (payload.sessionFingerprint || '') === (expected.sessionFingerprint || '');
  } catch {
    return false;
  }
}
