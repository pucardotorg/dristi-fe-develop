import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApiClient } from "@/lib/api";

import { AuthError } from "./errors";
import { HttpAuthService } from "./http";
import { isIndianMobile, toBackendMobile } from "./mobile";
import { SandboxAuthService } from "./sandbox";

const META = { timestamp: "2026-10-15T10:00:00+05:30", app_version: "abc", spec_version: "1.0" };

type Call = { url: string; method: string; body: unknown; raw: unknown; headers: Headers };

/** An auth service over the real API client, answered by `respond`. */
function setup(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = {
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      raw: init?.body,
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
      approvalStatus: null,
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
      approvalStatus: null,
      role: "LITIGANT",
      name: "Asha Menon",
      awaitingApproval: false,
      applicationNumber: null,
    });
  });

  it("leaves a blank email out", async () => {
    const { auth, calls } = setup(created);
    await auth.completeRegistration("litigant", { name: "Asha", email: "  ", password: "a long secret" });
    assert.equal("email" in (calls[0].body as object), false);
  });

  it("does not post power of attorney yet", async () => {
    const { auth, calls } = setup(created);
    const error = await authError(auth.completeRegistration("poa", { name: "A", password: "a long secret" }));
    assert.equal(error.code, "not-supported");
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

describe("HttpAuthService: advocates and clerks", () => {
  const pdf = () => new File(["%PDF-1.7"], "bar-id.pdf", { type: "application/pdf" });
  const pending = (role: string) => () =>
    Response.json(
      { user_id: "u2", role, registration_status: "COMPLETE", next: null, application_id: "3f2a…", meta: META },
      { status: 201 },
    );

  it("posts an advocate as multipart with flat profile keys and the document", async () => {
    const { auth, calls } = setup(pending("ADVOCATE"));
    const document = pdf();
    const outcome = await auth.completeRegistration("advocate", {
      name: " Anjali Nair ",
      email: "",
      password: "a long secret",
      registrationNumber: " K/1234/2020 ",
      document,
    });

    assert.equal(calls[0].url, "/api/v1/advocates");
    assert.ok(calls[0].raw instanceof FormData);
    const form = calls[0].raw as FormData;
    assert.equal(form.get("name"), "Anjali Nair");
    assert.equal(form.get("password"), "a long secret");
    assert.equal(form.get("terms_accepted"), "true");
    assert.equal(form.get("profile.bar_registration_id"), "K/1234/2020");
    assert.equal(form.has("email"), false, "a blank email is left out");
    assert.equal((form.get("bar_id_document") as File).name, "bar-id.pdf");
    // The browser sets the multipart boundary; the client must not set a JSON type.
    assert.equal(calls[0].headers.has("content-type"), false);
    assert.equal(calls[0].headers.get("x-csrftoken"), "tok");

    assert.equal(outcome.awaitingApproval, true);
    assert.equal(outcome.role, "ADVOCATE");
    // The UUID application_id is never shown; only a readable application_number would be.
    assert.equal(outcome.applicationNumber, null);
  });

  it("posts a clerk as JSON without a document and as multipart with one", async () => {
    const { auth, calls } = setup(pending("CLERK"));
    await auth.completeRegistration("advocateClerk", {
      name: "Ravi",
      password: "a long secret",
      registrationNumber: "CL-77",
    });
    assert.deepEqual(calls[0].body, {
      name: "Ravi",
      password: "a long secret",
      terms_accepted: true,
      profile: { clerk_registration_number: "CL-77" },
    });

    await auth.completeRegistration("advocateClerk", {
      name: "Ravi",
      password: "a long secret",
      registrationNumber: "CL-77",
      document: pdf(),
    });
    const form = calls[1].raw as FormData;
    assert.equal(calls[1].url, "/api/v1/clerks");
    assert.equal(form.get("profile.clerk_registration_number"), "CL-77");
    assert.ok(form.get("bar_id_document") instanceof File);
  });

  it("reads a readable application number when the backend sends one", async () => {
    const { auth } = setup(() =>
      Response.json(
        { user_id: "u2", role: "ADVOCATE", registration_status: "COMPLETE", next: null, application_number: "ADV-2026-000123" },
        { status: 201 },
      ),
    );
    const outcome = await auth.completeRegistration("advocate", {
      name: "A", password: "a long secret", registrationNumber: "K/1", document: pdf(),
    });
    assert.equal(outcome.applicationNumber, "ADV-2026-000123");
  });

  it("maps field errors in the standard shape, including the document", async () => {
    const { auth } = setup(() =>
      Response.json(
        {
          errors: [
            { code: "E00002", message: "This field is required.", field: "profile.bar_registration_id" },
            { code: "E00001", message: "The file content does not match its type.", field: "bar_id_document" },
          ],
          meta: META,
        },
        { status: 400 },
      ),
    );
    const error = await authError(
      auth.completeRegistration("advocate", { name: "A", password: "a long secret", registrationNumber: "", document: pdf() }),
    );
    assert.equal(error.code, "invalid-details");
    assert.deepEqual(error.fieldErrors["profile.bar_registration_id"], ["This field is required."]);
    assert.deepEqual(error.fieldErrors.bar_id_document, ["The file content does not match its type."]);
  });

  it("reports a request too large for the server on the document field", async () => {
    const { auth } = setup(
      () =>
        new Response("<html><head><title>413 Request Entity Too Large</title></head></html>", {
          status: 413,
          headers: { "content-type": "text/html" },
        }),
    );
    const error = await authError(
      auth.completeRegistration("advocate", { name: "A", password: "a long secret", registrationNumber: "K/1", document: pdf() }),
    );
    assert.equal(error.code, "document-too-large");
  });
});

describe("HttpAuthService.signIn for advocates and clerks", () => {
  it("reports approval pending — old shape and standard shape", async () => {
    const old = setup(() =>
      Response.json(
        { detail: "Account approval is pending", user_id: "u2", registration_status: "COMPLETE", approval_status: "PENDING", next: null },
        { status: 403 },
      ),
    );
    assert.equal((await authError(old.auth.signIn({ mobile: "9876543210", otp: "123456" }))).code, "approval-pending");

    const standard = setup(() =>
      Response.json({ errors: [{ code: "E01013", message: "Account approval is pending." }], meta: META }, { status: 403 }),
    );
    assert.equal(
      (await authError(standard.auth.signIn({ mobile: "9876543210", otp: "123456" }))).code,
      "approval-pending",
    );
  });

  it("passes a rejected account's next step and approval status through", async () => {
    const { auth } = setup(() =>
      Response.json({ user_id: "u2", registration_status: "COMPLETE", approval_status: "REJECTED", next: "resubmit", meta: META }),
    );
    const state = await auth.signIn({ mobile: "9876543210", password: "a long secret" });
    assert.equal(state.next, "resubmit");
    assert.equal(state.approvalStatus, "REJECTED");
  });

  it("reads invalid credentials in the standard shape too", async () => {
    const { auth } = setup(() =>
      Response.json({ errors: [{ code: "E01003", message: "Invalid credentials." }], meta: META }, { status: 401 }),
    );
    assert.equal(
      (await authError(auth.signIn({ mobile: "9876543210", password: "nope-nope-nope" }))).code,
      "invalid-credentials",
    );
  });
});

describe("HttpAuthService: correcting a rejected registration", () => {
  const current = {
    application_id: "3f2a-uuid",
    approval_status: "REJECTED",
    role: "CLERK",
    officer_message: "Clerk ID unreadable",
    rejected_at: "2026-10-14T10:00:00Z",
    name: "Ravi",
    email: null,
    mobile_number: "+919876543210",
    registration_number: "CL-77",
    document: { file_id: "f1", file_name: "clerk-id.png" },
    meta: META,
  };

  it("loads the rejected registration in screen terms", async () => {
    const { auth, calls } = setup(() => Response.json(current));
    const rejected = await auth.getRejectedRegistration();
    assert.equal(calls[0].url, "/api/v1/registrations/current");
    assert.equal(calls[0].method, "GET");
    assert.deepEqual(rejected, {
      role: "advocateClerk",
      mobile: "9876543210",
      name: "Ravi",
      email: "",
      registrationNumber: "CL-77",
      documentName: "clerk-id.png",
      officerMessage: "Clerk ID unreadable",
      rejectedAt: "2026-10-14T10:00:00Z",
      applicationNumber: null,
      flagged: [],
    });
  });

  it("reports nothing to resubmit (409 / E01012)", async () => {
    const { auth } = setup(() =>
      Response.json({ errors: [{ code: "E01012", message: "There is no rejected registration to resubmit." }] }, { status: 409 }),
    );
    assert.equal((await authError(auth.getRejectedRegistration())).code, "nothing-to-resubmit");
  });

  it("resubmits as JSON, or multipart with a new document", async () => {
    const { auth, calls } = setup(() => Response.json({ application_id: "3f2a-uuid", approval_status: "PENDING", meta: META }));
    const result = await auth.resubmitRegistration({ name: " Ravi ", email: "", registrationNumber: "CL-78" });
    assert.equal(calls[0].url, "/api/v1/registrations/current/resubmit");
    assert.deepEqual(calls[0].body, { name: "Ravi", registration_number: "CL-78" });
    assert.equal(result.applicationNumber, null);

    await auth.resubmitRegistration({
      name: "Ravi",
      registrationNumber: "CL-78",
      document: new File(["\x89PNG"], "clerk-id.png", { type: "image/png" }),
    });
    const form = calls[1].raw as FormData;
    assert.equal(form.get("registration_number"), "CL-78");
    assert.equal((form.get("bar_id_document") as File).name, "clerk-id.png");
  });

  it("maps a taken registration number to its field", async () => {
    const { auth } = setup(() =>
      Response.json(
        { errors: [{ code: "E00010", message: "This registration number is already registered.", field: "registration_number" }] },
        { status: 400 },
      ),
    );
    const error = await authError(auth.resubmitRegistration({ name: "Ravi", registrationNumber: "CL-1" }));
    assert.equal(error.code, "invalid-details");
    assert.deepEqual(error.fieldErrors.registration_number, ["This registration number is already registered."]);
  });
});

describe("HttpAuthService.getCurrentAccount", () => {
  it("reads role, name and terms from /users/me", async () => {
    const { auth, calls } = setup(() =>
      Response.json({
        id: "u2",
        mobile_number: "+919876543210",
        name: "Anjali Nair",
        role: "ADVOCATE",
        registration_status: "COMPLETE",
        has_current_terms: true,
        profile: { bar_registration_id: "K/1234/2020" },
        meta: META,
      }),
    );
    assert.deepEqual(await auth.getCurrentAccount(), {
      role: "ADVOCATE",
      name: "Anjali Nair",
      hasCurrentTerms: true,
    });
    assert.equal(calls[0].url, "/api/v1/users/me");
    assert.equal(calls[0].method, "GET");
  });

  it("resolves null — never throws — when it cannot say", async () => {
    const notDeployed = setup(() => new Response("<h1>Not Found</h1>", { status: 404 }));
    assert.equal(await notDeployed.auth.getCurrentAccount(), null);
    const offline = setup(() => {
      throw new TypeError("Failed to fetch");
    });
    assert.equal(await offline.auth.getCurrentAccount(), null);
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
      (await authError(sandbox.signIn({ mobile: "9111111111", otp: "123456" }))).code,
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

    const pendingDemo = new SandboxAuthService();
    assert.equal(
      (await authError(pendingDemo.signIn({ mobile: "8888888888", otp: "123456" }))).code,
      "approval-pending",
    );
    const rejectedDemo = new SandboxAuthService();
    assert.equal((await rejectedDemo.signIn({ mobile: "9999999999", otp: "123456" })).next, "resubmit");
    assert.equal((await rejectedDemo.getRejectedRegistration()).role, "advocate");
    await rejectedDemo.resubmitRegistration({ name: "A", registrationNumber: "K/1" });
    assert.equal((await authError(rejectedDemo.getRejectedRegistration())).code, "session-expired");

    const fresh = new SandboxAuthService();
    await fresh.verifyRegistrationOtp("9876543210", "123456");
    const done = await fresh.completeRegistration("litigant", { name: " Asha ", password: "a long secret" });
    assert.deepEqual([done.registrationStatus, done.role, done.name], ["COMPLETE", "LITIGANT", "Asha"]);
  });
});
