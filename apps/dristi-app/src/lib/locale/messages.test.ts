import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {describe, it} from "node:test";

import {
  getMessages,
  resolveMessageKey,
  translateMessage,
} from "../../i18n/messages";
import {pick, ui} from "../onboarding/content";


describe("next-intl message catalogs", () => {
  it("keeps Hindi as an exact, usable copy of English", () => {
    const en = getMessages("en");
    const hi = getMessages("hi");
    assert.deepEqual(hi, en);
    assert.ok(Object.keys(en).length > 9000);
    for (const message of Object.values(en)) assert.equal(typeof message, "string");
  });

  it("resolves keys and legacy shared source text with an English fallback", () => {
    assert.equal(translateMessage("en", "onboarding_close"), "Close");
    assert.equal(translateMessage("hi", "onboarding_close"), "Close");
    assert.equal(translateMessage("hi", "Close"), "Close");
    const closeKey = resolveMessageKey("hi", "Close");
    assert.ok(closeKey);
    assert.equal(translateMessage("hi", closeKey), "Close");
    assert.equal(getMessages("gu"), getMessages("en"));
    assert.equal(translateMessage("hi", "An uncatalogued value"), "An uncatalogued value");
  });

  it("formats extracted ICU placeholders", () => {
    assert.equal(
      translateMessage("en", "accusedSection_accusedValue0", {value0: 2}),
      "Accused 2",
    );
  });

  it("retains existing Malayalam content while using catalogs for English and Hindi", () => {
    assert.equal(pick(ui.close, "en"), "Close");
    assert.equal(pick(ui.close, "hi"), "Close");
    assert.equal(pick(ui.close, "ml"), "അടയ്ക്കുക");
  });

  it("has a catalog entry for every generated message reference", () => {
    const messages = getMessages("en");
    const missing = new Set<string>();
    const pattern = /(?:__t|LocalizedText id=)\(?["']([A-Za-z][A-Za-z0-9_]*)["']/g;

    function scan(directory: string) {
      for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          scan(file);
        } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(file, "utf8");
          for (const match of source.matchAll(pattern)) {
            if (!Object.hasOwn(messages, match[1])) missing.add(match[1]);
          }
        }
      }
    }

    scan(path.resolve("src"));
    assert.deepEqual([...missing], []);
  });
});
