import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

// Evaluate the real server/session modules in an isolated process, mocking only
// database and auth-library boundaries. No dependency installs, database calls,
// or provider requests are needed. Never serialize credential values.
async function probeWorker() {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { stripTypeScriptTypes } = await import("node:module");
  const { SourceTextModule, SyntheticModule, createContext } =
    await import("node:vm");
  const rootPath = process.argv[1];
  const environment = JSON.parse(process.argv[2]);
  let sessionCalls = 0;
  const oauthClients = [];
  const context = createContext({
    process: { env: environment },
    console: { error() {} },
    Buffer,
    Headers,
    Request,
    URL,
  });
  const modules = new Map();
  const stubs = {
    "better-auth": {
      betterAuth: () => ({
        api: {
          async getSession() {
            sessionCalls += 1;
            return environment.TEST_USER_ID
              ? { user: { id: environment.TEST_USER_ID, email: null } }
              : null;
          },
        },
      }),
    },
    "better-auth/plugins": {
      bearer: () => ({ id: "bearer" }),
      genericOAuth: (options) => {
        oauthClients.push(...options.config);
        return { id: "generic-oauth" };
      },
    },
    "better-auth/tanstack-start": {
      tanstackStartCookies: () => ({ id: "cookies" }),
    },
    "@tanstack/react-start/server": {
      getCookie: () => undefined,
      getRequest: () => new Request("http://localhost:8080"),
    },
    "node:crypto": {
      randomBytes: (length) => Buffer.alloc(length, 1),
    },
    pg: { Pool: class Pool {} },
    "../db": {
      ensureDbReady: async () => {},
      getPglite: () => ({}),
    },
    "./email-password": { emailAndPasswordEnabled: false },
    "./gate-session.server": {
      GATE_PROVIDER_ID: "grok-gate",
      gateIdentitySessions: () => ({ id: "gate" }),
    },
    "./providers": {
      GROK_PROVIDERS: [{ providerId: "google", idp: "google" }],
    },
    "./pglite-dialect": { pgliteDialect: () => ({}) },
    "./gate-identity.server": {
      gateIdentityEnabled: () =>
        environment.VITE_AUTH_ENABLED?.trim() !== "false",
    },
  };

  function sourceModule(relativePath) {
    if (!modules.has(relativePath)) {
      const source = readFileSync(join(rootPath, relativePath), "utf8");
      modules.set(
        relativePath,
        new SourceTextModule(stripTypeScriptTypes(source), {
          context,
          identifier: relativePath,
        }),
      );
    }
    return modules.get(relativePath);
  }

  async function linker(specifier) {
    if (specifier === "./server") {
      return sourceModule("src/lib/auth/server.ts");
    }
    if (specifier === "./preview") {
      return sourceModule("src/lib/auth/preview.ts");
    }
    if (!Object.hasOwn(stubs, specifier)) {
      throw new Error("Unexpected dependency in auth probe: " + specifier);
    }
    const key = "mock:" + specifier;
    if (!modules.has(key)) {
      const values = stubs[specifier];
      modules.set(
        key,
        new SyntheticModule(
          Object.keys(values),
          function () {
            for (const [name, value] of Object.entries(values)) {
              this.setExport(name, value);
            }
          },
          { context },
        ),
      );
    }
    return modules.get(key);
  }

  try {
    const verification = sourceModule("src/lib/auth/verify.server.ts");
    await verification.link(linker);
    await verification.evaluate();
    const result = {
      authConfigured: verification.namespace.authConfigured,
      oauthClientCount: oauthClients.length,
      usesExplicitOAuthCredentials:
        oauthClients.length > 0 &&
        oauthClients.every(
          (client) =>
            client.clientId === environment.GROK_AUTH_CLIENT_ID?.trim() &&
            client.clientSecret === environment.GROK_AUTH_CLIENT_SECRET?.trim(),
        ),
    };
    try {
      result.userId = await verification.namespace.requireUserId();
    } catch (error) {
      result.requestError = error.message;
    }
    result.sessionCalls = sessionCalls;
    console.log(JSON.stringify(result));
  } catch (error) {
    console.log(JSON.stringify({ configurationError: error.message }));
  }
}

async function probe(environment) {
  const { stdout } = await runFile(
    process.execPath,
    [
      "--experimental-vm-modules",
      "--input-type=module",
      "-e",
      "(" + probeWorker.toString() + ")()",
      root,
      JSON.stringify(environment),
    ],
    { maxBuffer: 128 * 1024 },
  );
  return JSON.parse(stdout.trim());
}

for (const flag of ["true", "1"]) {
  test("enabled auth (" + flag + ") rejects a missing OAuth secret", async () => {
    const result = await probe({ VITE_AUTH_ENABLED: flag });
    assert.match(result.configurationError ?? "", /GROK_AUTH_CLIENT_SECRET/);
    assert.equal(result.userId, undefined);
  });
}

test("enabled auth rejects a whitespace-only OAuth secret", async () => {
  const result = await probe({
    VITE_AUTH_ENABLED: "true",
    GROK_AUTH_CLIENT_SECRET: "   ",
  });
  assert.match(result.configurationError ?? "", /GROK_AUTH_CLIENT_SECRET/);
});

test("an unset auth flag cannot silently accept missing OAuth credentials", async () => {
  const result = await probe({});
  assert.match(result.configurationError ?? "", /GROK_AUTH_CLIENT_SECRET/);
});

test("configured auth uses explicit credentials and the verified session user", async () => {
  const result = await probe({
    VITE_AUTH_ENABLED: "true",
    GROK_AUTH_CLIENT_ID: " example ",
    GROK_AUTH_CLIENT_SECRET: " example ",
    TEST_USER_ID: "verified-user",
  });
  assert.equal(result.configurationError, undefined);
  assert.equal(result.authConfigured, true);
  assert.equal(result.oauthClientCount, 1);
  assert.equal(result.usesExplicitOAuthCredentials, true);
  assert.equal(result.userId, "verified-user");
  assert.equal(result.sessionCalls, 1);
});

test("configured auth rejects a signed-out request instead of using the dev user", async () => {
  const result = await probe({
    VITE_AUTH_ENABLED: "1",
    GROK_AUTH_CLIENT_ID: "example",
    GROK_AUTH_CLIENT_SECRET: "example",
  });
  assert.equal(result.authConfigured, true);
  assert.equal(result.userId, undefined);
  assert.equal(result.requestError, "Unauthorized");
  assert.equal(result.sessionCalls, 1);
});

test("explicitly disabled auth preserves the local dev-user mode without credentials", async () => {
  const result = await probe({ VITE_AUTH_ENABLED: "false" });
  assert.equal(result.configurationError, undefined);
  assert.equal(result.authConfigured, false);
  assert.equal(result.oauthClientCount, 0);
  assert.equal(result.userId, "dev-user");
  assert.equal(result.sessionCalls, 0);
});

test("disabled auth with a real database continues to reject the dev-user fallback", async () => {
  const result = await probe({
    VITE_AUTH_ENABLED: "false",
    DATABASE_URL: "postgres://example.invalid/example",
  });
  assert.equal(result.authConfigured, false);
  assert.equal(result.userId, undefined);
  assert.match(result.requestError ?? "", /refusing to fall back/);
});

