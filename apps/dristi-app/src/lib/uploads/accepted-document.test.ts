import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAcceptedDocument, MAX_FILE_SIZE } from "./accepted-document";

/** A file of `size` bytes, named and typed as given. */
function file(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("isAcceptedDocument", () => {
  it("accepts a JPG, JPEG, PNG or PDF with its usual type", () => {
    assert.equal(isAcceptedDocument(file("bar-id.jpg", "image/jpeg")), true);
    assert.equal(isAcceptedDocument(file("bar-id.jpeg", "image/jpeg")), true);
    assert.equal(isAcceptedDocument(file("bar-id.png", "image/png")), true);
    assert.equal(isAcceptedDocument(file("bar-id.pdf", "application/pdf")), true);
  });

  it("ignores the case of the extension", () => {
    assert.equal(isAcceptedDocument(file("SCAN.PDF", "application/pdf")), true);
  });

  it("refuses a file whose type the browser left empty, as the backend does", () => {
    // Sent as application/octet-stream, which the backend refuses whatever the name.
    assert.equal(isAcceptedDocument(file("bar-id.pdf", "")), false);
    assert.equal(isAcceptedDocument(file("bar-id.docx", "")), false);
  });

  it("refuses other formats", () => {
    assert.equal(isAcceptedDocument(file("photo.heic", "image/heic")), false);
    assert.equal(isAcceptedDocument(file("id.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")), false);
    assert.equal(isAcceptedDocument(file("id.gif", "image/gif")), false);
  });

  it("refuses a name and type that disagree", () => {
    // A renamed file: the type says Word, the name says PDF.
    assert.equal(isAcceptedDocument(file("id.pdf", "application/msword")), false);
    // An accepted type under a name without an accepted extension.
    assert.equal(isAcceptedDocument(file("id", "application/pdf")), false);
    // Both accepted, but not each other's: a PNG name declared as JPEG.
    assert.equal(isAcceptedDocument(file("id.png", "image/jpeg")), false);
    assert.equal(isAcceptedDocument(file("id.jpg", "application/pdf")), false);
  });

  it("reads the extension the way the backend does", () => {
    // Only the last extension counts; a name that is only a dot-extension has none.
    assert.equal(isAcceptedDocument(file("id.final.pdf", "application/pdf")), true);
    assert.equal(isAcceptedDocument(file("id.pdf.docx", "application/pdf")), false);
    assert.equal(isAcceptedDocument(file(".pdf", "application/pdf")), false);
  });

  it("accepts exactly 10 MB and refuses one byte more", () => {
    assert.equal(isAcceptedDocument(file("big.pdf", "application/pdf", MAX_FILE_SIZE)), true);
    assert.equal(isAcceptedDocument(file("big.pdf", "application/pdf", MAX_FILE_SIZE + 1)), false);
  });
});
