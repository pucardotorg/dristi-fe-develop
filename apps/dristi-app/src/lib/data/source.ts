/**
 * Where the app's data comes from: the one switch every feature reads.
 *
 * `NEXT_PUBLIC_DATA_SOURCE` picks `sandbox` (data lives in this browser: IndexedDB,
 * fixtures, demo seeding, for design work and demos) or `api` (the DRISTI backend
 * through `lib/api`). Each feature's `lib/<feature>/data/index.ts` asks
 * `chooseRepository` for its implementation, so a screen is the same file in both modes.
 *
 * Both settings are read with their full literal names: Next copies `NEXT_PUBLIC_*` into
 * the bundle when it builds or starts the dev server, so a change needs a restart or a
 * rebuild. Every variable is documented in `apps/dristi-app/.env.example`.
 */

export type DataSource = "sandbox" | "api";

/** `"sandbox"` or `"api"` after trimming; anything else (unset, empty, a typo) is null. */
function asSource(raw: string | undefined): DataSource | null {
  const value = raw?.trim();
  return value === "sandbox" || value === "api" ? value : null;
}

/**
 * The data source from the two settings. A valid `NEXT_PUBLIC_DATA_SOURCE` wins. When it
 * is unset, empty or unrecognised, a sandbox sign-in setting still means sandbox (that
 * was the whole app's switch before this one existed). Everything else is `api`, so a
 * build with nothing set never shows demo data.
 */
export function parseDataSource(dataEnv: string | undefined, authEnv: string | undefined): DataSource {
  return asSource(dataEnv) ?? (asSource(authEnv) === "sandbox" ? "sandbox" : "api");
}

/**
 * Who answers sign-in and registration. A valid `NEXT_PUBLIC_AUTH_SOURCE` wins, so one
 * build can pair real sign-in with sandbox data while features are being connected;
 * otherwise sign-in follows the data source.
 */
export function parseAuthSource(authEnv: string | undefined, dataSource: DataSource): DataSource {
  return asSource(authEnv) ?? dataSource;
}

export const DATA_SOURCE: DataSource = parseDataSource(
  process.env.NEXT_PUBLIC_DATA_SOURCE,
  process.env.NEXT_PUBLIC_AUTH_SOURCE
);

export const AUTH_SOURCE: DataSource = parseAuthSource(process.env.NEXT_PUBLIC_AUTH_SOURCE, DATA_SOURCE);

/** A contract method the backend implementation (`http.ts`) does not have yet. */
export class NotIntegratedError extends Error {
  readonly operation: string;

  constructor(operation: string) {
    // No closing full stop: screens put the message inside their own sentence.
    super(`${operation} is not connected to the backend yet`);
    this.name = "NotIntegratedError";
    this.operation = operation;
  }
}

/**
 * True for a `NotIntegratedError`, checked by name so it also holds for an error that
 * lost its class on the way from server to client (in development; production replaces
 * server errors with a generic one before they reach the browser).
 */
export function isNotIntegratedError(error: unknown): boolean {
  return error instanceof Error && error.name === "NotIntegratedError";
}

type ExtraKeys<Impl, Contract> = Exclude<keyof Impl, keyof Contract>;

/**
 * Build-time guard for `http.ts`: it may implement any part of the contract but nothing
 * the contract does not have. Renaming or removing a contract method that `http.ts`
 * still implements fails the type check, naming the method, on the PR that did it.
 *
 *   new HttpTasksRepository() satisfies OnlyContract<HttpTasksRepository, TasksRepository>
 */
export type OnlyContract<Impl, Contract> = [ExtraKeys<Impl, Contract>] extends [never]
  ? Impl
  : { "http.ts implements a method the contract no longer has": ExtraKeys<Impl, Contract> };

export type RepositoryFactories<T extends object> = {
  sandbox: () => T;
  /** May implement only part of the contract while the backend is being connected. */
  http: () => Partial<T>;
};

/** Read by `await`, `JSON.stringify` and React's element check; never contract methods. */
const NOT_METHODS = new Set(["then", "toJSON", "$$typeof"]);

/**
 * The repository for a source: the sandbox as it is, or the backend implementation
 * standing in for the whole contract. A method `http.ts` does not have yet is a function
 * that rejects with `NotIntegratedError` ("tasks.listPeople is not connected to the
 * backend yet."), so the screen shows its error state instead of crashing on
 * "undefined is not a function". Pure: tests pass the source in.
 */
export function selectRepository<T extends object>(
  source: DataSource,
  feature: string,
  make: RepositoryFactories<T>
): T {
  if (source === "sandbox") return make.sandbox();
  const http = make.http();
  // One function per method name, so a method reads the same on every access.
  const methods = new Map<string, unknown>();
  const proxy = new Proxy(http, {
    get(target, key) {
      if (typeof key === "symbol") return Reflect.get(target, key);
      if (key in target) {
        const member: unknown = Reflect.get(target, key);
        // Data is read fresh each time; only methods are bound and kept.
        if (typeof member !== "function") return member;
        if (!methods.has(key)) {
          // Bound to the real object, so private fields work when called through the proxy.
          methods.set(key, member.bind(target));
        }
        return methods.get(key);
      }
      if (NOT_METHODS.has(key)) return undefined;
      if (!methods.has(key)) {
        methods.set(key, () => Promise.reject(new NotIntegratedError(`${feature}.${key}`)));
      }
      return methods.get(key);
    },
  });
  // Safe: every property read returns either the http implementation's own member
  // (whose type `Partial<T>` checks against the contract) or a stand-in with the
  // contract's call shape that rejects, so callers never meet an undefined method.
  return proxy as T;
}

/** The repository for this build's `DATA_SOURCE`. Call it lazily, from `getRepository()`. */
export function chooseRepository<T extends object>(feature: string, make: RepositoryFactories<T>): T {
  return selectRepository(DATA_SOURCE, feature, make);
}
