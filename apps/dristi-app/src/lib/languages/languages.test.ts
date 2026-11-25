import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isLanguageCode, parseLanguageCode } from "@/lib/locale/cookie";

import { fallbackLanguages, languagePair, renderLocale, toUiLanguages } from "./languages";
import type { UiLanguage } from "./types";

const lang = (code: string, isDefault = false): UiLanguage => ({
  code,
  name: code,
  nativeName: code,
  isDefault,
});

describe("toUiLanguages", () => {
  it("maps the backend's rows, in order", () => {
    const rows = [
      { code: "en", name: "English", native_name: "English", is_default: true, supports: ["ui"] },
      { code: "ml", name: "Malayalam", native_name: "മലയാളം", is_default: false, supports: ["ui"] },
    ];
    assert.deepEqual(toUiLanguages(rows), [
      { code: "en", name: "English", nativeName: "English", isDefault: true },
      { code: "ml", name: "Malayalam", nativeName: "മലയാളം", isDefault: false },
    ]);
  });

  it("keeps only languages that declare ui support", () => {
    const rows = [
      { code: "en", name: "English", native_name: "English", is_default: true, supports: ["ui"] },
      { code: "ta", name: "Tamil", native_name: "தமிழ்", is_default: false, supports: ["ocr"] },
      { code: "kn", name: "Kannada", native_name: "ಕನ್ನಡ", is_default: false },
    ];
    assert.deepEqual(
      toUiLanguages(rows).map((l) => l.code),
      ["en"],
    );
  });

  it("drops malformed and repeated codes, and lowercases codes", () => {
    const rows = [
      { code: "EN-IN", name: "English", supports: ["ui"] },
      { code: "en-in", name: "English again", supports: ["ui"] },
      { code: "<script>", name: "Bad", supports: ["ui"] },
      { name: "No code", supports: ["ui"] },
      null,
      "hi",
    ];
    assert.deepEqual(
      toUiLanguages(rows).map((l) => l.code),
      ["en-in"],
    );
  });

  it("falls back to the English name, then the code, for missing names", () => {
    const [onlyName, nothing] = toUiLanguages([
      { code: "gu", name: "Gujarati", native_name: " ", supports: ["ui"] },
      { code: "pa", supports: ["ui"] },
    ]);
    assert.equal(onlyName?.nativeName, "Gujarati");
    assert.equal(nothing?.nativeName, "pa");
  });
});

describe("language codes", () => {
  it("accepts BCP 47 tags and refuses anything else", () => {
    for (const code of ["en", "ml", "en-in", "kok"]) assert.equal(isLanguageCode(code), true);
    for (const code of ["", "EN", "e", "en_IN", "en;x=1", undefined, 42])
      assert.equal(isLanguageCode(code), false);
  });

  it("reads a stale cookie as English", () => {
    assert.equal(parseLanguageCode(undefined), "en");
    assert.equal(parseLanguageCode("x y"), "en");
    assert.equal(parseLanguageCode("ta"), "ta");
  });

  it("renders a language the app has no text for in English", () => {
    assert.equal(renderLocale("hi"), "hi");
    assert.equal(renderLocale("ml"), "ml");
    assert.equal(renderLocale("ta"), "en");
  });
});

describe("fallbackLanguages", () => {
  it("shows English and Hindi before a language is chosen", () => {
    assert.deepEqual(
      fallbackLanguages("en").map((l) => [l.code, l.nativeName]),
      [
        ["en", "English"],
        ["hi", "हिन्दी"],
      ],
    );
  });

  it("keeps the chosen language beside English, by code when the app can't name it", () => {
    assert.deepEqual(
      fallbackLanguages("ta").map((l) => [l.code, l.nativeName]),
      [
        ["en", "English"],
        ["ta", "ta"],
      ],
    );
  });
});

describe("languagePair", () => {
  const list = [lang("en", true), lang("ml"), lang("hi")];

  it("puts the default first and Hindi beside it", () => {
    const pair = languagePair(list, { selected: "en", chosenSecond: null });
    assert.equal(pair?.primary.code, "en");
    assert.equal(pair?.second?.code, "hi");
    assert.deepEqual(
      pair?.choices.map((l) => l.code),
      ["ml", "hi"],
    );
  });

  it("prefers the language put there, then the one being read", () => {
    assert.equal(languagePair(list, { selected: "hi", chosenSecond: "ml" })?.second?.code, "ml");
    assert.equal(languagePair(list, { selected: "ml", chosenSecond: null })?.second?.code, "ml");
  });

  it("ignores choices the backend no longer offers", () => {
    const pair = languagePair(list, { selected: "pa", chosenSecond: "gu" });
    assert.equal(pair?.second?.code, "hi");
  });

  it("takes the first other language when Hindi isn't offered", () => {
    const pair = languagePair([lang("en", true), lang("ta"), lang("ml")], {
      selected: "en",
      chosenSecond: null,
    });
    assert.equal(pair?.second?.code, "ta");
  });

  it("uses the first language when none is marked default", () => {
    assert.equal(
      languagePair([lang("ml"), lang("en")], { selected: "en", chosenSecond: null })?.primary.code,
      "ml",
    );
  });

  it("handles one language and none", () => {
    assert.equal(
      languagePair([lang("en", true)], { selected: "en", chosenSecond: null })?.second,
      null,
    );
    assert.equal(languagePair([], { selected: "en", chosenSecond: null }), null);
  });
});
