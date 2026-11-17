import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "@/lib/api";

import { cmsLoadFailure, toCmsPage, toContentType, type CmsPageResponse } from "./cms-page";

const response: CmsPageResponse = {
  id: "p1",
  slug: "privacy",
  title: "Privacy policy",
  sub_title: "How we use your data",
  main_image_url: "https://cms.example/privacy.png",
  content_type: "markdown",
  content: "## Data we keep\n\nOnly what the court needs.",
  categories: [{ id: "c1", name: "Legal", slug: "legal" }],
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-02T00:00:00Z",
};

describe("toCmsPage", () => {
  it("maps the backend shape to the app's", () => {
    assert.deepEqual(toCmsPage(response), {
      id: "p1",
      slug: "privacy",
      title: "Privacy policy",
      subtitle: "How we use your data",
      imageUrl: "https://cms.example/privacy.png",
      contentType: "markdown",
      content: "## Data we keep\n\nOnly what the court needs.",
      categories: [{ id: "c1", name: "Legal", slug: "legal" }],
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-02T00:00:00Z",
    });
  });

  it("treats missing, null and blank optional fields as absent", () => {
    for (const blank of [undefined, null, "", "   "]) {
      const page = toCmsPage({ ...response, sub_title: blank, main_image_url: blank });
      assert.equal(page.subtitle, null);
      assert.equal(page.imageUrl, null);
    }
  });

  it("defaults missing categories to an empty list", () => {
    assert.deepEqual(toCmsPage({ ...response, categories: undefined }).categories, []);
    assert.deepEqual(toCmsPage({ ...response, categories: null }).categories, []);
  });

  it("reads the content type without regard to case, and keeps others as unknown", () => {
    assert.equal(toCmsPage({ ...response, content_type: "Markdown" }).contentType, "markdown");
    assert.equal(toCmsPage({ ...response, content_type: "html" }).contentType, "html");
  });
});

describe("toCmsPage content", () => {
  it("keeps string content as it is", () => {
    assert.equal(toCmsPage(response).content, response.content);
  });

  it("turns structured content into formatted JSON, never an object", () => {
    const content = { blocks: [{ type: "paragraph", text: "Hi" }] };
    assert.equal(
      toCmsPage({ ...response, content_type: "json", content }).content,
      JSON.stringify(content, null, 2),
    );
  });

  it("treats missing content as empty", () => {
    assert.equal(toCmsPage({ ...response, content: null }).content, "");
    assert.equal(toCmsPage({ ...response, content: undefined }).content, "");
  });
});

describe("toContentType", () => {
  it("recognises markdown, html and json", () => {
    assert.equal(toContentType("markdown"), "markdown");
    assert.equal(toContentType("html"), "html");
    assert.equal(toContentType("json"), "json");
  });

  it("ignores case and surrounding space", () => {
    assert.equal(toContentType("  HTML "), "html");
    assert.equal(toContentType("Json"), "json");
  });

  it("calls anything else unknown", () => {
    for (const value of ["", "text", "text/markdown", "rich-text"]) {
      assert.equal(toContentType(value), "unknown");
    }
  });
});

describe("cmsLoadFailure", () => {
  it("ignores a cancelled load", () => {
    assert.equal(cmsLoadFailure(new ApiError({ kind: "aborted", message: "x" })), null);
  });

  it("calls a 404 not found", () => {
    assert.equal(
      cmsLoadFailure(new ApiError({ kind: "http", status: 404, message: "x" })),
      "not-found",
    );
  });

  it("calls everything else a failure", () => {
    assert.equal(
      cmsLoadFailure(new ApiError({ kind: "http", status: 500, message: "x" })),
      "failed",
    );
    assert.equal(cmsLoadFailure(new ApiError({ kind: "network", message: "x" })), "failed");
    assert.equal(cmsLoadFailure(new ApiError({ kind: "timeout", message: "x" })), "failed");
    assert.equal(cmsLoadFailure(new Error("boom")), "failed");
  });
});
