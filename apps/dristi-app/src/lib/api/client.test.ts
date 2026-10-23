import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApiClient } from "./client";
import { ApiError } from "./errors";

const META = { timestamp: "2026-10-14T10:00:00+05:30", app_version: "abc", spec_version: "1.0" };

type Captured = { url: string; init: RequestInit };

function setup(response: () => Response | Promise<Response>, csrf: string | null = "tok") {
  const calls: Captured[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return response();
  }) as typeof fetch;
  const client = createApiClient({ baseUrl: "/api/v1/", fetchImpl, getCsrfToken: () => csrf });
  return { client, calls };
}

/** A fetch that never answers, and rejects on abort exactly as the real one does. */
const hangingFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    const fail = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    if (signal?.aborted) return fail();
    signal?.addEventListener("abort", fail, { once: true });
  })) as typeof fetch;

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof ApiError, `expected ApiError, got ${String(error)}`);
    return error;
  }
  assert.fail("expected the call to fail");
}

describe("api client: requests", () => {
  it("builds the URL without trailing slashes and with a query", async () => {
    const { client, calls } = setup(() => Response.json({ data: [], meta: META }));
    await client.get("/locations/abc/children/", {
      query: { page: 2, level: ["state", "district"], skip: undefined, none: null },
    });
    assert.equal(calls[0].url, "/api/v1/locations/abc/children?page=2&level=state&level=district");
    assert.equal(calls[0].init.method, "GET");
    assert.equal(calls[0].init.credentials, "same-origin");
  });

  it("sends JSON with the CSRF header on writes only", async () => {
    const { client, calls } = setup(() => Response.json({ ok: true, meta: META }));
    await client.post("auth/otp/request", { mobile_number: "+919999999999", purpose: "login" });
    await client.get("locations");

    const post = new Headers(calls[0].init.headers);
    assert.equal(post.get("content-type"), "application/json");
    assert.equal(post.get("x-csrftoken"), "tok");
    assert.equal(calls[0].init.body, '{"mobile_number":"+919999999999","purpose":"login"}');

    const get = new Headers(calls[1].init.headers);
    assert.equal(get.has("x-csrftoken"), false);
    assert.equal(get.get("accept"), "application/json");
  });

  it("leaves multipart uploads to the browser", async () => {
    const { client, calls } = setup(() => Response.json({ id: "f1", meta: META }));
    const form = new FormData();
    form.append("file", new Blob(["pdf"]), "notice.pdf");
    await client.post("dristi-requests", form);
    assert.equal(calls[0].init.body, form);
    assert.equal(new Headers(calls[0].init.headers).has("content-type"), false);
  });

  it("refuses absolute URLs", async () => {
    const { client } = setup(() => Response.json({}));
    await assert.rejects(client.get("https://evil.example/x"), TypeError);
    await assert.rejects(client.get("//evil.example/x"), TypeError);
  });
});

describe("api client: responses", () => {
  it("strips meta from objects and unwraps lists", async () => {
    const one = setup(() => Response.json({ id: "u1", meta: META }));
    assert.deepEqual(await one.client.get("users/u1"), { id: "u1" });

    const list = setup(() => Response.json({ data: [{ id: "1" }], meta: META }));
    assert.deepEqual(await list.client.get("locations"), [{ id: "1" }]);
  });

  it("returns meta, status and headers from request()", async () => {
    const { client } = setup(() =>
      Response.json({ user_id: "u1", meta: META }, { status: 201, headers: { "x-a": "1" } }),
    );
    const res = await client.request<{ user_id: string }>("POST", "users", { body: {} });
    assert.equal(res.status, 201);
    assert.deepEqual(res.data, { user_id: "u1" });
    assert.deepEqual(res.meta, META);
    assert.equal(res.headers.get("x-a"), "1");
  });

  it("returns null for 204", async () => {
    const { client } = setup(() => new Response(null, { status: 204 }));
    assert.equal(await client.delete("sessions"), null);
  });

  it("reads blobs for downloads", async () => {
    const { client } = setup(() => new Response("%PDF", { headers: { "content-type": "application/pdf" } }));
    const blob = await client.get<Blob>("dristi-requests/1/documents/2", { responseType: "blob" });
    assert.equal(await blob.text(), "%PDF");
  });
});

describe("api client: failures", () => {
  it("turns DRF errors into ApiError with field errors", async () => {
    const { client } = setup(() =>
      Response.json({ otp: ["Invalid OTP."], meta: META }, { status: 400 }),
    );
    const error = await rejection(client.post("users", {}));
    assert.equal(error.kind, "http");
    assert.equal(error.status, 400);
    assert.equal(error.fieldError("otp"), "Invalid OTP.");
  });

  it("reads Retry-After on 429", async () => {
    const { client } = setup(() =>
      Response.json({ detail: "Please wait." }, { status: 429, headers: { "retry-after": "42" } }),
    );
    const error = await rejection(client.post("auth/otp/request", {}));
    assert.equal(error.message, "Please wait.");
    assert.equal(error.retryAfterSeconds, 42);
  });

  it("survives a non-JSON error page", async () => {
    const { client } = setup(() => new Response("<html>502</html>", { status: 502 }));
    const error = await rejection(client.get("health"));
    assert.equal(error.status, 502);
    assert.equal(error.message, "Something went wrong. Please try again.");
  });

  it("reports a network failure", async () => {
    const { client } = setup(() => {
      throw new TypeError("Failed to fetch");
    });
    const error = await rejection(client.get("health"));
    assert.equal(error.kind, "network");
    assert.equal(error.status, 0);
  });

  it("reports a 2xx body that is not JSON", async () => {
    const { client } = setup(() => new Response("not json", { status: 200 }));
    assert.equal((await rejection(client.get("health"))).kind, "invalid-response");
  });

  it("times out", async () => {
    const client = createApiClient({
      baseUrl: "/api/v1",
      fetchImpl: hangingFetch,
      defaultTimeoutMs: 10,
    });
    assert.equal((await rejection(client.get("health"))).kind, "timeout");
  });

  it("reports a caller's cancellation as aborted", async () => {
    const client = createApiClient({ baseUrl: "/api/v1", fetchImpl: hangingFetch });
    const controller = new AbortController();
    const pending = client.get("health", { signal: controller.signal });
    controller.abort();
    assert.equal((await rejection(pending)).kind, "aborted");

    const already = new AbortController();
    already.abort();
    assert.equal((await rejection(client.get("health", { signal: already.signal }))).kind, "aborted");
  });
});
