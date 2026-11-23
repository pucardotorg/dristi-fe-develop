import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  connectOriginsFromEnv,
  contentSecurityPolicy,
  FASTERFIXES_DEFAULT_ORIGIN,
  LOOKUP_ORIGINS,
} from "./csp";

/** directive → its sources. */
function parse(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(";").map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

const KEYWORDS = new Set(["'self'", "'unsafe-inline'", "'unsafe-eval'", "data:", "blob:"]);
const DEV_SOCKETS = ["ws://localhost:*", "ws://127.0.0.1:*"];
const DATA_ORIGIN = "https://data.example.org";

describe("contentSecurityPolicy — nothing loads from another origin", () => {
  for (const dev of [false, true]) {
    it(`names no other origin outside connect-src (${dev ? "dev" : "production"})`, () => {
      const policy = parse(contentSecurityPolicy({ dev, connectOrigins: [DATA_ORIGIN] }));
      for (const [directive, sources] of policy) {
        const allowed = directive === "connect-src" ? [DATA_ORIGIN, ...DEV_SOCKETS] : [];
        for (const source of sources) {
          assert.ok(
            KEYWORDS.has(source) || allowed.includes(source),
            `${directive} must not allow ${source}`,
          );
        }
      }
    });
  }

  it("defaults to this origin, and limits every kind of file it loads", () => {
    const policy = parse(contentSecurityPolicy({ dev: false, connectOrigins: [] }));
    assert.deepEqual(policy.get("default-src"), ["'self'"]);
    for (const directive of [
      "script-src",
      "style-src",
      "img-src",
      "font-src",
      "media-src",
      "frame-src",
      "worker-src",
      "object-src",
    ]) {
      assert.equal(
        policy.get(directive)?.[0],
        "'self'",
        `${directive} is set and starts at 'self'`,
      );
    }
  });

  it("allows eval and the HMR socket in dev only", () => {
    const prod = parse(contentSecurityPolicy({ dev: false, connectOrigins: [] }));
    const dev = parse(contentSecurityPolicy({ dev: true, connectOrigins: [] }));
    assert.ok(!prod.get("script-src")?.includes("'unsafe-eval'"));
    assert.ok(dev.get("script-src")?.includes("'unsafe-eval'"));
    for (const socket of DEV_SOCKETS) {
      assert.ok(!prod.get("connect-src")?.includes(socket));
      assert.ok(dev.get("connect-src")?.includes(socket));
    }
  });

  it("lets the browser call the data origins it is given, once each", () => {
    const policy = parse(
      contentSecurityPolicy({ dev: false, connectOrigins: [DATA_ORIGIN, DATA_ORIGIN] }),
    );
    assert.equal(policy.get("connect-src")?.filter((s) => s === DATA_ORIGIN).length, 1);
  });
});

describe("connectOriginsFromEnv — the data origins this build calls", () => {
  it("is the IFSC and PIN lookups when the feedback widget is off", () => {
    assert.deepEqual(connectOriginsFromEnv({}), LOOKUP_ORIGINS);
    assert.deepEqual(
      connectOriginsFromEnv({ NEXT_PUBLIC_FASTERFIXES_API_ORIGIN: "https://ff.example.org" }),
      LOOKUP_ORIGINS,
    );
    assert.deepEqual(
      connectOriginsFromEnv({ NEXT_PUBLIC_FASTERFIXES_PROJECT_ID: "" }),
      LOOKUP_ORIGINS,
    );
  });

  it("adds FasterFixes' cloud when the widget is on", () => {
    assert.deepEqual(connectOriginsFromEnv({ NEXT_PUBLIC_FASTERFIXES_PROJECT_ID: "proj_x" }), [
      ...LOOKUP_ORIGINS,
      FASTERFIXES_DEFAULT_ORIGIN,
    ]);
  });

  it("adds a self-hosted FasterFixes as its origin alone", () => {
    assert.deepEqual(
      connectOriginsFromEnv({
        NEXT_PUBLIC_FASTERFIXES_PROJECT_ID: "proj_x",
        NEXT_PUBLIC_FASTERFIXES_API_ORIGIN: " https://feedback.internal.example:8443/api/ ",
      }),
      [...LOOKUP_ORIGINS, "https://feedback.internal.example:8443"],
    );
  });

  it("adds nothing for an API origin that is not an http(s) URL", () => {
    for (const bad of ["not a url", "javascript:alert(1)", "ftp://files.example.org"]) {
      assert.deepEqual(
        connectOriginsFromEnv({
          NEXT_PUBLIC_FASTERFIXES_PROJECT_ID: "proj_x",
          NEXT_PUBLIC_FASTERFIXES_API_ORIGIN: bad,
        }),
        LOOKUP_ORIGINS,
      );
    }
  });
});
