import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { createTranslator, type IntlError } from "next-intl";

import { getMessageCatalog, translateMessage } from "../../i18n/messages";

/* Tests run from apps/dristi-app (`npm test -w @pucar/dristi-app`). */
const APP_ROOT = process.cwd();

function readCatalog(locale: string): Record<string, unknown> {
  const file = path.join(APP_ROOT, "messages", `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const en = readCatalog("en");
const hi = readCatalog("hi");

/** `{name}`, `{count, plural, …}` → "name", "count". */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{\s*([A-Za-z0-9_]+)/g)].map((m) => m[1]).sort();
}

/** `<link>…</link>` → "link". */
function tags(message: string): string[] {
  return [...new Set([...message.matchAll(/<([A-Za-z0-9_]+)>/g)].map((m) => m[1]))].sort();
}

/** `file_name` — a camelCase file prefix, an underscore, then the name. Never a dot. */
const KEY_FORMAT = /^[a-z][A-Za-z0-9]*_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/;

describe("message catalogs", () => {
  it("are flat maps of string messages", () => {
    for (const [locale, catalog] of [["en", en], ["hi", hi]] as const) {
      for (const [key, message] of Object.entries(catalog)) {
        assert.equal(typeof message, "string", `${locale}: ${key} is not a string`);
      }
    }
  });

  it("use file-prefixed keys without dots", () => {
    const bad = Object.keys(en).filter((key) => !KEY_FORMAT.test(key));
    assert.deepEqual(bad, []);
  });

  it("give Hindi exactly the keys English has", () => {
    assert.deepEqual(Object.keys(hi).sort(), Object.keys(en).sort());
  });

  it("keep every placeholder and tag in the Hindi translation", () => {
    const broken = Object.keys(en).filter((key) => {
      const source = String(en[key]);
      const target = String(hi[key] ?? "");
      return (
        placeholders(source).join() !== placeholders(target).join() ||
        tags(source).join() !== tags(target).join()
      );
    });
    assert.deepEqual(broken, []);
  });

  /*
   * TEMPORARY — the current requirement is that hi.json is an English copy. Delete this
   * test when reviewed Hindi translations start landing; the parity tests above stay.
   */
  it("keeps Hindi as an exact copy of English for now", () => {
    assert.deepEqual(hi, en);
  });

  it("formats every English message without error", () => {
    const errors: string[] = [];
    const t = createTranslator({
      locale: "en",
      messages: en as Record<string, string>,
      onError: (error: IntlError) => errors.push(error.message),
    });
    for (const [key, message] of Object.entries(en)) {
      const values: Record<string, unknown> = {};
      for (const name of placeholders(String(message))) values[name] = 1;
      for (const tag of tags(String(message))) values[tag] = (chunks: string) => chunks;
      t.markup(key, values as Parameters<typeof t.markup>[1]);
    }
    assert.deepEqual(errors, []);
  });
});

describe("translateMessage", () => {
  it("returns an unknown key unchanged instead of guessing", () => {
    assert.equal(translateMessage("en", "noSuch_key"), "noSuch_key");
    assert.equal(translateMessage("hi", "Draft"), "Draft");
  });

  it("gives every locale without a catalog the English one", () => {
    assert.equal(getMessageCatalog("gu"), getMessageCatalog("en"));
    assert.equal(getMessageCatalog("pa"), getMessageCatalog("en"));
    assert.equal(getMessageCatalog("ml"), getMessageCatalog("en"));
  });

  it("fills every key in the Hindi catalog, falling back to English", () => {
    const merged = getMessageCatalog("hi");
    for (const key of Object.keys(en)) assert.ok(Object.hasOwn(merged, key), key);
  });
});

describe("keys referenced in code", () => {
  /*
   * TypeScript already checks `t("…")` against en.json. This catches what it cannot:
   * keys held in plain strings, such as `Copy.en` read through `pick` / `fillCopy`.
   * Only key-shaped strings (`file_name`) count, so English text is never mistaken
   * for a key.
   */
  it("all exist in en.json", () => {
    const pattern = /\bt(?:\.rich|\.markup)?\(\s*["']([a-z][A-Za-z0-9]*_[A-Za-z0-9_]+)["']/g;
    const missing = new Set<string>();

    function scan(directory: string) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) scan(file);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          for (const match of fs.readFileSync(file, "utf8").matchAll(pattern)) {
            if (!Object.hasOwn(en, match[1])) missing.add(match[1]);
          }
        }
      }
    }

    scan(path.join(APP_ROOT, "src"));
    assert.deepEqual([...missing], []);
  });
});
