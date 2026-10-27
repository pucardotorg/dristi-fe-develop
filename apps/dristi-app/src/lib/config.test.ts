import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { appBaseUrl, appUrl } from "./config";

/* `appBaseUrl` reads `NEXT_PUBLIC_APP_BASE_URL` and, when it is unset, the browser's
   address (`window.location.origin`). Tests run in Node, where there is no `window`,
   so each test sets up what it needs and `afterEach` puts everything back. */
const g = globalThis as { window?: unknown };

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_BASE_URL;
  delete g.window;
});

describe("appBaseUrl", () => {
  it("uses the configured address", () => {
    process.env.NEXT_PUBLIC_APP_BASE_URL = "https://fe.dristi-dev.in";
    assert.equal(appBaseUrl(), "https://fe.dristi-dev.in");
  });

  it("drops trailing slashes and surrounding spaces from the configured address", () => {
    process.env.NEXT_PUBLIC_APP_BASE_URL = "  https://fe.dristi-dev.in//  ";
    assert.equal(appBaseUrl(), "https://fe.dristi-dev.in");
  });

  it("falls back to the address the browser is on when unset or blank", () => {
    g.window = { location: { origin: "http://localhost:3000" } };
    assert.equal(appBaseUrl(), "http://localhost:3000");
    process.env.NEXT_PUBLIC_APP_BASE_URL = "   ";
    assert.equal(appBaseUrl(), "http://localhost:3000");
  });

  it("is empty on the server when unset (no browser to ask)", () => {
    assert.equal(appBaseUrl(), "");
  });
});

describe("appUrl", () => {
  it("puts the path after the base address", () => {
    process.env.NEXT_PUBLIC_APP_BASE_URL = "https://fe.dristi-dev.in/";
    assert.equal(appUrl("/sign/abc?step=preview"), "https://fe.dristi-dev.in/sign/abc?step=preview");
  });

  it("stays a relative path when there is no base address", () => {
    assert.equal(appUrl("/sign/abc"), "/sign/abc");
  });
});
