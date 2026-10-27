import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildUpstreamUrl, proxyToApi } from "./api-proxy";

const BASE = "http://backend:8000/api/v1";
const ok = { ok: true as const, baseUrl: BASE };

type Captured = { url: string; init: RequestInit };

/** A fetch double that records the call and answers with `response`. */
function fakeFetch(response: () => Response | Promise<Response>) {
  const calls: Captured[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return response();
  }) as typeof fetch;
  return { impl, calls };
}

describe("buildUpstreamUrl", () => {
  it("adds Django's trailing slash and keeps the query", () => {
    assert.equal(
      buildUpstreamUrl(BASE, "/api/v1/locations/abc/children", "?page=2")?.href,
      "http://backend:8000/api/v1/locations/abc/children/?page=2",
    );
    assert.equal(
      buildUpstreamUrl(BASE, "/api/v1/sessions/", "")?.href,
      "http://backend:8000/api/v1/sessions/",
    );
    assert.equal(buildUpstreamUrl(BASE, "/api/v1", "")?.href, "http://backend:8000/api/v1/");
  });

  it("follows the configured base path, whatever it is", () => {
    assert.equal(
      buildUpstreamUrl("https://gw.example.org/dristi/api/v2", "/api/v1/users", "")?.href,
      "https://gw.example.org/dristi/api/v2/users/",
    );
    assert.equal(
      buildUpstreamUrl("https://api.example.org", "/api/v1/users", "")?.href,
      "https://api.example.org/users/",
    );
  });

  it("re-encodes segments safely", () => {
    assert.equal(
      buildUpstreamUrl(BASE, "/api/v1/locations/code/KL%2001", "")?.pathname,
      "/api/v1/locations/code/KL%2001/",
    );
  });

  it("refuses paths that leave the prefix or are malformed", () => {
    for (const path of [
      "/api/v1/../admin",
      "/api/v1/%2e%2e/admin",
      "/api/v1/%2E%2E/%2E%2E/admin",
      "/api/v1/./users",
      "/api/v1/a//b",
      "/api/v1/%E0%A4%A",
      "/api/v10/users",
      "/admin/",
    ]) {
      assert.equal(buildUpstreamUrl(BASE, path, ""), null, path);
    }
  });
});

describe("proxyToApi", () => {
  it("returns 503 with the reason when API_BASE_URL is not usable", async () => {
    const res = await proxyToApi(new Request("http://app/api/v1/health"), {
      api: { ok: false, reason: "API_BASE_URL is not set." },
    });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), {
      detail: "API_BASE_URL is not set.",
      code: "api_not_configured",
    });
  });

  it("returns 400 for a path it will not forward", async () => {
    const { impl, calls } = fakeFetch(() => new Response("{}"));
    const res = await proxyToApi(new Request("http://app/api/v1/%2e%2e/admin"), {
      api: ok,
      fetchImpl: impl,
    });
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });

  it("forwards method, body, cookies and CSRF header; drops hop-by-hop headers", async () => {
    const { impl, calls } = fakeFetch(() => Response.json({ ok: true }, { status: 201 }));
    const res = await proxyToApi(
      new Request("http://localhost:3001/api/v1/sessions?x=1", {
        method: "POST",
        headers: {
          host: "localhost:3001",
          origin: "http://localhost:3001",
          cookie: "sessionid=s; csrftoken=t",
          "x-csrftoken": "t",
          "content-type": "application/json",
          connection: "keep-alive",
          "x-middleware-subrequest": "1",
        },
        body: JSON.stringify({ mobile_number: "+919999999999" }),
      }),
      { api: ok, fetchImpl: impl },
    );

    assert.equal(res.status, 201);
    assert.equal(calls.length, 1);
    const [{ url, init }] = calls;
    assert.equal(url, "http://backend:8000/api/v1/sessions/?x=1");
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "manual");
    assert.equal(
      new TextDecoder().decode(init.body as ArrayBuffer),
      JSON.stringify({ mobile_number: "+919999999999" }),
    );

    const sent = init.headers as Headers;
    assert.equal(sent.get("origin"), "http://localhost:3001", "Origin must reach Django untouched");
    assert.equal(sent.get("cookie"), "sessionid=s; csrftoken=t");
    assert.equal(sent.get("x-csrftoken"), "t");
    assert.equal(sent.get("x-forwarded-host"), "localhost:3001");
    assert.equal(sent.get("x-forwarded-proto"), "http");
    assert.equal(sent.has("host"), false);
    assert.equal(sent.has("connection"), false);
    assert.equal(sent.has("x-middleware-subrequest"), false);
  });

  describe("request body limit", () => {
    /** A POST whose body arrives in `chunks`, with no Content-Length (chunked). */
    const streamed = (chunks: Uint8Array[]) =>
      new Request("http://app/api/v1/advocates", {
        method: "POST",
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.close();
          },
        }),
        duplex: "half",
      } as RequestInit);

    it("refuses a declared Content-Length over the limit with 413, sending nothing", async () => {
      const { impl, calls } = fakeFetch(() => Response.json({}));
      const res = await proxyToApi(
        new Request("http://app/api/v1/advocates", {
          method: "POST",
          headers: { "content-length": "11" },
          body: "small",
        }),
        { api: ok, fetchImpl: impl, maxBodyBytes: 10 },
      );
      assert.equal(res.status, 413);
      assert.deepEqual(await res.json(), {
        detail: "This upload is too large to send.",
        code: "request_too_large",
      });
      assert.equal(calls.length, 0);
    });

    it("refuses a chunked body as soon as it passes the limit", async () => {
      const { impl, calls } = fakeFetch(() => Response.json({}));
      const res = await proxyToApi(streamed([new Uint8Array(6), new Uint8Array(6)]), {
        api: ok,
        fetchImpl: impl,
        maxBodyBytes: 10,
      });
      assert.equal(res.status, 413);
      assert.equal(calls.length, 0);
    });

    it("forwards a body exactly at the limit, whole and in order", async () => {
      const { impl, calls } = fakeFetch(() => Response.json({}, { status: 201 }));
      const res = await proxyToApi(
        streamed([new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8, 9, 10])]),
        { api: ok, fetchImpl: impl, maxBodyBytes: 10 },
      );
      assert.equal(res.status, 201);
      assert.deepEqual([...(calls[0].init.body as Uint8Array)], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it("defaults to the backend nginx's 20 MB", async () => {
      const { MAX_REQUEST_BODY_BYTES } = await import("./api-proxy");
      assert.equal(MAX_REQUEST_BODY_BYTES, 20 * 1024 * 1024);
    });
  });

  it("sends no body for GET", async () => {
    const { impl, calls } = fakeFetch(() => Response.json({}));
    await proxyToApi(new Request("http://app/api/v1/locations"), { api: ok, fetchImpl: impl });
    assert.equal(calls[0].init.body, undefined);
  });

  it("passes every Set-Cookie through separately and drops stale encoding headers", async () => {
    const { impl } = fakeFetch(() => {
      const headers = new Headers({
        "content-type": "application/json",
        "content-encoding": "gzip",
        "content-length": "999",
      });
      headers.append("set-cookie", "sessionid=abc; Path=/; HttpOnly; SameSite=Lax");
      headers.append("set-cookie", "csrftoken=xyz; Path=/; SameSite=Lax");
      return new Response('{"user_id":"u1"}', { status: 201, headers });
    });

    const res = await proxyToApi(new Request("http://app/api/v1/users", { method: "POST" }), {
      api: ok,
      fetchImpl: impl,
    });

    assert.deepEqual(res.headers.getSetCookie(), [
      "sessionid=abc; Path=/; HttpOnly; SameSite=Lax",
      "csrftoken=xyz; Path=/; SameSite=Lax",
    ]);
    assert.equal(res.headers.has("content-encoding"), false);
    assert.equal(res.headers.has("content-length"), false);
    assert.deepEqual(await res.json(), { user_id: "u1" });
  });

  it("passes upstream error statuses through unchanged", async () => {
    const { impl } = fakeFetch(() =>
      Response.json({ detail: "Too many requests." }, { status: 429, headers: { "retry-after": "30" } }),
    );
    const res = await proxyToApi(new Request("http://app/api/v1/auth/otp/request", { method: "POST" }), {
      api: ok,
      fetchImpl: impl,
    });
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("retry-after"), "30");
  });

  it("handles null-body statuses", async () => {
    const { impl } = fakeFetch(() => new Response(null, { status: 204 }));
    const res = await proxyToApi(new Request("http://app/api/v1/sessions", { method: "DELETE" }), {
      api: ok,
      fetchImpl: impl,
    });
    assert.equal(res.status, 204);
    assert.equal(res.body, null);
  });

  it("answers 502 when the backend is unreachable", async (t) => {
    t.mock.method(console, "error", () => {});
    const impl = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const res = await proxyToApi(new Request("http://app/api/v1/health"), { api: ok, fetchImpl: impl });
    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, "upstream_unreachable");
  });

  it("answers 504 when the backend is too slow", async (t) => {
    t.mock.method(console, "error", () => {});
    const impl = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })) as typeof fetch;
    const res = await proxyToApi(new Request("http://app/api/v1/health"), {
      api: ok,
      fetchImpl: impl,
      timeoutMs: 10,
    });
    assert.equal(res.status, 504);
    assert.equal((await res.json()).code, "upstream_timeout");
  });
});
