/**
 * The languages sandbox: a fixed list, read-only. Design owns this file.
 *
 * Mirrors what the dev backend returns today (`GET /languages/?supports=ui`), in its
 * order. Nothing is stored, so nothing survives or reseeds: every call answers the same.
 */

import type { UiLanguage } from "../types";
import type { LanguagesRepository } from "./repository";

const SANDBOX_LANGUAGES: readonly UiLanguage[] = [
  { code: "en", name: "English", nativeName: "English", isDefault: true },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", isDefault: false },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", isDefault: false },
];

export class SandboxLanguagesRepository implements LanguagesRepository {
  async listUiLanguages(): Promise<UiLanguage[]> {
    return [...SANDBOX_LANGUAGES];
  }
}
