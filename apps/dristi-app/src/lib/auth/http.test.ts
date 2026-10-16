import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApiClient } from "@/lib/api";

import { AuthError } from "./errors";
import { HttpAuthService } from "./http";
import { isIndianMobile, toBackendMobile } from "./mobile";
import { SandboxAuthService } from "./sandbox";

const META = { timestamp: "2026-10-15T10:00:00+05:30", app_version: "abc", spec_version: "1.0" };

type Call = { url: string; method: string; body: unknown; headers: Headers };

/** An auth service over the real API client, answered by `respond`. */
function setup(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = {
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      headers: new Headers(init?.headers),
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  const client = createApiClient({ baseUrl: "/api/v1", fetchImpl, getCsrfToken: () => "tok" });
  return { auth: new HttpAuthService(client), calls };
}

async function authError(promise: Promise<unknown>): Promise<AuthError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof AuthError, `expected AuthError, got ${String(error)}`);
    return error;
  }
  assert.fail("expected the call to fail");
}

const accepted = () => Response.json({ detail: "If the number is valid, a code has been sent.", meta: META }, { status: 202 });

describe("mobile numbers", () => {
  it("accepts 10 digits starting 6–9 and adds the country code", () => {
    assert.equal(isIndianMobile("9876543210"), true);
    assert.equal(isIndianMobile("6000000000"), true);
    assert.equal(isIndianMobile("5876543210"), false);
    assert.equal(isIndianMobile("987654321"), false);
    assert.equal(toBackendMobile("9876543210"), "+919876543210");
  });
});

describe("HttpAuthService.requestOtp", () => {
  it("posts the number with its purpose", async () => {
    const { auth, calls } = setup(accepted);
    await auth.requestOtp("9876543210", "register");
    assert.equal(calls[0].url, "/api/v1/auth/otp/request");
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, { mobile_number: "+919876543210", purpose: "register" });
  });

  it("reports the cooldown with its wait", async () => {
    const { auth } = setup(() =>
      Response.json(
        { detail: "A code was already sent to this number.", meta: META },
        { status: 429, headers: { "retry-after": "21" } },
      ),
    );
    const error = await authError(auth.requestOtp("9876543210", "login"));
    assert.equal(error.code, "resend-too-soon");
    assert.equal(error.retryAfterSeconds, 21);
  });

  it("names a number the backend refuses", async () => {
    const { auth } = setup(() =>
      Response.json({ mobile_number: ["Enter a valid number."], meta: META }, { status: 400 }),
    );
    assert.equal((await authError(auth.requestOtp("9876543210", "login"))).code, "invalid-mobile");
  });

  it("treats an unreachable server as unavailable", async () => {
    const { auth } = setup(() => {
      throw new TypeError("Failed to fetch");
    });
    assert.equal((await authError(auth.requestOtp("9876543210", "login"))).code, "unavailable");

    const down = setup(() => Response.json({ detail: "x", code: "upstream_unreachable" }, { status: 502 }));
    assert.equal((await authError(down.auth.requestOtp("9876543210", "login"))).code, "unavailable");
  });
});

describe("HttpAuthService.verifyRegistrationOtp", () => {
  it("returns the new account's state", async () => {
    const { auth, calls } = setup(() =>
      Response.json(
        { user_id: "u1", registration_status: "PENDING_PROFILE", next: "profile", meta: META },
        { status: 201 },
      ),
    );
    const state = await auth.verifyRegistrationOtp("9876543210", "123456");
    assert.equal(calls[0].url, "/api/v1/users");
    assert.deepEqual(calls[0].body, { mobile_number: "+919876543210", otp: "123456" });
    assert.deepEqual(state, {
      userId: "u1",
      registrationStatus: "PENDING_PROFILE",
      next: "profile",
      role: null,
      name: null,
    });
  });

  it("maps a wrong code and a taken number", async () => {
    const wrong = setup(() => Response.json({ detail: "Invalid or expired code." }, { status: 401 }));
    assert.equal((await authError(wrong.auth.verifyRegistrationOtp("9876543210", "000000"))).code, "invalid-code");

    const taken = setup(() =>
      Response.json({ detail: "Account already registered with this mobile number." }, { status: 409 }),
    );
    assert.equal(
      (await authError(taken.auth.verifyRegistrationOtp("9876543210", "123456"))).code,
      "already-registered",
    );
  });
});

describe("HttpAuthService.signIn", () => {
  it("signs in with a password or a code", async () => {
    const { auth, calls } = setup(() =>
      Response.json({ user_id: "u1", registration_status: "COMPLETE", next: null, meta: META }),
    );
    const state = await auth.signIn({ mobile: "9876543210", password: "a long secret" });
    await auth.signIn({ mobile: "9876543210", otp: "123456" });
    assert.equal(calls[0].url, "/api/v1/sessions");
    assert.deepEqual(calls[0].body, { mobile_number: "+919876543210", password: "a long secret" });
    assert.deepEqual(calls[1].body, { mobile_number: "+919876543210", otp: "123456" });
    assert.equal(state.next, null);
    assert.equal(state.registrationStatus, "COMPLETE");
  });

  it("never says which part was wrong", async () => {
    const { auth } = setup(() => Response.json({ detail: "Invalid credentials." }, { status: 401 }));
    assert.equal(
      (await authError(auth.signIn({ mobile: "9876543210", otp: "123456" }))).code,
      "invalid-credentials",
    );
  });

  it("refuses an unexpected body rather than inventing an account", async () => {
    const { auth } = setup(() => Response.json({ ok: true, meta: META }));
    assert.equal(
      (await authError(auth.signIn({ mobile: "9876543210", otp: "123456" }))).code,
      "unavailable",
    );
  });
});

describe("HttpAuthService.completeRegistration", () => {
  const created = () =>
    Response.json(
      { user_id: "u1", role: "LITIGANT", registration_status: "COMPLETE", next: null, meta: META },
      { status: 201 },
    );

  it("registers a litigant with the CSRF header and accepted terms", async () => {
    const { auth, calls } = setup(created);
    const state = await auth.completeRegistration("litigant", {
      name: "  Asha Menon ",
      email: " asha@example.com ",
      password: "a long secret",
    });
    assert.equal(calls[0].url, "/api/v1/litigants");
    assert.equal(calls[0].headers.get("x-csrftoken"), "tok");
    assert.deepEqual(calls[0].body, {
      name: "Asha Menon",
      email: "asha@example.com",
      password: "a long secret",
      terms_accepted: true,
    });
    assert.deepEqual(state, {
      userId: "u1",
      registrationStatus: "COMPLETE",
      next: null,
      role: "LITIGANT",
      name: "Asha Menon",
    });
  });

  it("leaves a blank email out", async () => {
    const { auth, calls } = setup(created);
    await auth.completeRegistration("litigant", { name: "Asha", email: "  ", password: "a long secret" });
    assert.equal("email" in (calls[0].body as object), false);
  });

  it("does not post roles that are not integrated", async () => {
    const { auth, calls } = setup(created);
    for (const role of ["poa", "advocate", "advocateClerk"] as const) {
      const error = await authError(auth.completeRegistration(role, { name: "A", password: "a long secret" }));
      assert.equal(error.code, "not-supported");
    }
    assert.equal(calls.length, 0);
  });

  it("passes the backend's field messages through", async () => {
    const { auth } = setup(() =>
      Response.json(
        { password: ["This password is too common."], email: ["An account with this email already exists."] },
        { status: 400 },
      ),
    );
    const error = await authError(auth.completeRegistration("litigant", { name: "A", password: "password1" }));
    assert.equal(error.code, "invalid-details");
    assert.deepEqual(error.fieldErrors.password, ["This password is too common."]);
    assert.deepEqual(error.fieldErrors.email, ["An account with this email already exists."]);
  });

  it("tells an expired session from a CSRF misconfiguration", async (t) => {
    const expired = setup(() =>
      Response.json({ detail: "Authentication credentials were not provided." }, { status: 403 }),
    );
    assert.equal(
      (await authError(expired.auth.completeRegistration("litigant", { name: "A", password: "a long secret" }))).code,
      "session-expired",
    );

    t.mock.method(console, "error", () => {});
    const csrf = setup(() =>
      Response.json({ detail: "CSRF Failed: Origin checking failed - http://localhost:3000 does not match any trusted origins." }, { status: 403 }),
    );
    assert.equal(
      (await authError(csrf.auth.completeRegistration("litigant", { name: "A", password: "a long secret" }))).code,
      "unavailable",
    );
  });

  it("reports an already finished registration", async () => {
    const { auth } = setup(() => Response.json({ detail: "Registration is already complete." }, { status: 409 }));
    assert.equal(
      (await authError(auth.completeRegistration("litigant", { name: "A", password: "a long secret" }))).code,
      "already-registered",
    );
  });
});

describe("HttpAuthService.signOut", () => {
  it("deletes the session", async () => {
    const { auth, calls } = setup(() => new Response(null, { status: 204 }));
    await auth.signOut();
    assert.equal(calls[0].url, "/api/v1/sessions");
    assert.equal(calls[0].method, "DELETE");
  });
});

describe("SandboxAuthService", () => {
  it("answers like the backend", async () => {
    const sandbox = new SandboxAuthService();
    assert.equal(
      (await authError(sandbox.signIn({ mobile: "9999999999", otp: "123456" }))).code,
      "invalid-credentials",
    );
    assert.equal((await sandbox.signIn({ mobile: "7007663437", otp: "123456" })).role, "LITIGANT");
    assert.equal(
      (await authError(sandbox.verifyRegistrationOtp("7007663437", "123456"))).code,
      "already-registered",
    );
    assert.equal(
      (await authError(new SandboxAuthService().completeRegistration("litigant", { name: "A", password: "x" }))).code,
      "session-expired",
    );

    const fresh = new SandboxAuthService();
    await fresh.verifyRegistrationOtp("9876543210", "123456");
    const done = await fresh.completeRegistration("litigant", { name: " Asha ", password: "a long secret" });
    assert.deepEqual([done.registrationStatus, done.role, done.name], ["COMPLETE", "LITIGANT", "Asha"]);
  });
});
