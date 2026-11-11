/**
 * The filing repository against the DRISTI backend. Engineering owns this file.
 *
 * It implements the contract (`repository.ts`) one method at a time, as the backend's
 * endpoints arrive, calling them through `@/lib/api` and translating backend shapes
 * into the app's types (`../types.ts`) here, so backend naming never reaches a screen.
 * Until a method exists, calling it rejects with `NotIntegratedError`
 * ("filing.listDrafts is not connected to the backend yet").
 *
 * No endpoints yet: none are guessed. Bulk filing (`lib/bulk/*-repository.ts`) is a
 * sandbox-only demo with its own browser and demo-server storage, and is not switched.
 */

import type { FilingRepository } from "./repository";

export class HttpFilingRepository implements Partial<FilingRepository> {}
