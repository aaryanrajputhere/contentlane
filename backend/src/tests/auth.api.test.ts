import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import test, { before, beforeEach } from "node:test";
import prisma from "../lib/prisma";
import {
  allowEmail,
  createUserAccount,
  loginAndGetCookie,
  sessionCookie,
} from "./test-helpers";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://ContentLane:ContentLane@localhost:5432/ContentLane?schema=public";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "error";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

let createApp: typeof import("../app.js").createApp;

before(async () => {
  ({ createApp } = await import("../app.js"));
});

beforeEach(async () => {
  await prisma.project.deleteMany({
    where: { website: { startsWith: "https://auth-" } },
  });
  await prisma.allowedEmail.deleteMany({
    where: { email: { startsWith: "auth-" } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: "auth-" } } });
});

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("signup is restricted to allowlisted beta emails and bootstraps the session", async () => {
  await withServer(async (baseUrl) => {
    const rejected = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "auth-blocked@example.com",
        password: "password123",
        name: "Blocked",
      }),
    });
    assert.equal(rejected.status, 403);

    await allowEmail("auth-allowed@example.com");
    const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "auth-allowed@example.com",
        password: "password123",
        name: "Allowed User",
      }),
    });
    assert.equal(response.status, 201);
    const cookie = sessionCookie(response);

    const meResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie },
    });
    assert.equal(meResponse.status, 200);
    const me = (await meResponse.json()) as {
      user: { email: string; role: "USER" | "ADMIN" };
    };
    assert.equal(me.user.email, "auth-allowed@example.com");
    assert.equal(me.user.role, "USER");
  });
});

test("login, logout, and invalid credentials behave correctly", async () => {
  await withServer(async (baseUrl) => {
    await createUserAccount({
      email: "auth-login@example.com",
      password: "password123",
      name: "Login User",
    });

    const badLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "auth-login@example.com",
        password: "wrong-password",
      }),
    });
    assert.equal(badLogin.status, 401);

    const cookie = await loginAndGetCookie(baseUrl, {
      email: "auth-login@example.com",
      password: "password123",
    });

    const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { cookie },
    });
    assert.equal(logoutResponse.status, 204);

    const meAfterLogout = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert.equal(meAfterLogout.status, 401);
  });
});
