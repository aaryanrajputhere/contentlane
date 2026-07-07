import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

type UserRole = 'USER' | 'ADMIN';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function sessionCookie(response: Response) {
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie, 'expected session cookie');
  return cookie.split(';', 1)[0];
}

export async function allowEmail(email: string) {
  return prisma.allowedEmail.upsert({
    where: { email: normalizeEmail(email) },
    update: {},
    create: { email: normalizeEmail(email) },
  });
}

export async function createUserAccount(input: { email: string; password: string; name?: string; role?: UserRole }) {
  const email = normalizeEmail(input.email);
  await allowEmail(email);
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(input.password, 12),
      name: input.name ?? null,
      role: input.role ?? 'USER',
    },
  });
}

export async function signupAndGetCookie(baseUrl: string, input: { email: string; password: string; name?: string }) {
  await allowEmail(input.email);
  const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      name: input.name ?? 'Test User',
    }),
  });
  assert.equal(response.status, 201);
  return sessionCookie(response);
}

export async function loginAndGetCookie(baseUrl: string, input: { email: string; password: string }) {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  assert.equal(response.status, 200);
  return sessionCookie(response);
}
