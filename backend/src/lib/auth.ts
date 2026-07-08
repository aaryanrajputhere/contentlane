import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const sessionTtlMs = config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
};

type SessionClaims = {
  sub: string;
  email: string;
  role: AuthUser['role'];
};

function baseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.NODE_ENV === 'production',
    path: '/',
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signSession(user: AuthUser) {
  return jwt.sign(
    { email: user.email, role: user.role },
    config.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: `${config.SESSION_TTL_DAYS}d`,
      subject: user.id,
    },
  );
}

export function verifySession(token: string): SessionClaims {
  const payload = jwt.verify(token, config.JWT_SECRET);
  if (!payload || typeof payload === 'string' || typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new Error('Invalid session');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    role: payload.role === 'ADMIN' ? 'ADMIN' : 'USER',
  };
}

export function setSessionCookie(res: Response, user: AuthUser) {
  res.cookie(config.COOKIE_NAME, signSession(user), {
    ...baseCookieOptions(),
    maxAge: sessionTtlMs,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(config.COOKIE_NAME, baseCookieOptions());
}

export function toAuthUser(user: { id: string; email: string; name: string | null; role: 'USER' | 'ADMIN' }): AuthUser {
  return {
    id: user.id,
    email: normalizeEmail(user.email),
    name: user.name,
    role: user.role,
  };
}
