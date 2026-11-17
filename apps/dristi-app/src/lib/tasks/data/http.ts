/**
 * The tasks repository against the DRISTI backend. Engineering owns this file.
 *
 * It implements the contract (`repository.ts`) one method at a time, as the backend's
 * endpoints arrive, calling them through `@/lib/api` and translating backend shapes
 * into the app's types (`../types.ts`) here, so backend naming never reaches a screen.
 * Until a method exists, calling it rejects with `NotIntegratedError`
 * ("tasks.listTasks is not connected to the backend yet").
 *
 * No endpoints yet: the Tasks API is not defined, and none are guessed.
 */

import type { TasksRepository } from "./repository";

export class HttpTasksRepository implements Partial<TasksRepository> {}
