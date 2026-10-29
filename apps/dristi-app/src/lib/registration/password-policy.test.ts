import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadCommonPasswords, passwordOk, passwordProblem } from "./password-policy";

const person = {
  mobile: "9645207107",
  name: "Abhiram Rajilan",
  email: "Abhiram@example.com",
};

describe("password policy (the backend's validators)", () => {
  it("length: fewer than 8 characters fails, 8 passes, after trimming like DRF", () => {
    assert.equal(passwordProblem("courtro", person), "length");
    assert.equal(passwordProblem("", person), "length");
    assert.equal(passwordProblem("        ", person), "length");
    assert.equal(passwordProblem("  courtro  ", person), "length");
    assert.equal(passwordProblem("courtroom12", person), null);
  });

  it("length counts characters, not UTF-16 units", () => {
    assert.equal(passwordProblem("🔒🔒🔒🔒🔒🔒🔒", person), "length");
    assert.equal(passwordProblem("🔒🔒🔒🔒🔒🔒🔒🔒", person), null);
  });

  it("tooLong: more than 128 characters fails", () => {
    assert.equal(passwordProblem("a1".repeat(64), person), null);
    assert.equal(passwordProblem(`${"a1".repeat(64)}x`, person), "tooLong");
  });

  it("no complexity requirement beyond the rules", () => {
    assert.ok(passwordOk("courtroom", person));
    assert.ok(passwordOk("correct horse battery", person));
  });

  it("mobile: too similar to the number the backend stores (+91…)", () => {
    assert.equal(passwordProblem("9645207107", person), "mobile");
    assert.equal(passwordProblem("919645207107", person), "mobile");
    assert.equal(passwordProblem("+919645207107", person), "mobile");
    assert.equal(passwordProblem("96452071071", person), "mobile");
    // Same digits in any order are as similar to the backend (it ignores order).
    assert.equal(passwordProblem("7017025469", person), "mobile");
  });

  it("name: too similar to the name or either part of it", () => {
    assert.equal(passwordProblem("Abhiram Rajilan", person), "name");
    assert.equal(passwordProblem("abhiram rajilan1", person), "name");
    assert.equal(passwordProblem("abhiram12", person), "name");
    assert.equal(passwordProblem("courtroom12", person), null);
  });

  it("email: too similar to the address or a part of it", () => {
    assert.equal(passwordProblem("abhiram@example.com", person), "email");
    assert.equal(passwordProblem("abhiram@example.co", person), "email");
    assert.equal(passwordProblem("example.com", person), "email");
  });

  it("numeric: digits alone fail", () => {
    assert.equal(passwordProblem("73920481", person), "numeric");
    assert.equal(passwordProblem("7392048a", person), null);
  });

  it("common: on the backend's list, ignoring case — once the list is loaded", async () => {
    const common = await loadCommonPasswords();
    assert.equal(passwordProblem("password", person, common), "common");
    assert.equal(passwordProblem("PASSWORD123", person, common), "common");
    assert.equal(passwordProblem("iloveyou2", person, common), "common");
    assert.equal(passwordProblem("correct horse battery", person, common), null);
    // Without the list the rule is skipped; the backend still checks.
    assert.equal(passwordProblem("password", person), null);
  });

  it("the list holds only entries a password of valid length could match", async () => {
    const common = await loadCommonPasswords();
    assert.ok(common.size > 8000);
    for (const entry of common) {
      assert.ok(Array.from(entry).length >= 8, entry);
      assert.equal(entry, entry.toLowerCase());
    }
    assert.equal(await loadCommonPasswords(), common, "loaded once and shared");
  });

  it("reports the first failing rule in policy order", () => {
    // Too short beats everything else.
    assert.equal(passwordProblem("1234", person), "length");
    // The mobile number is all digits too; the more specific reason wins.
    assert.equal(passwordProblem("9645207107", person), "mobile");
  });

  it("identity rules are skipped when the context is empty", () => {
    assert.equal(passwordProblem("Abhiram Rajilan", {}), null);
    assert.equal(passwordProblem("Abhiram Rajilan", { mobile: "" }), null);
  });
});
