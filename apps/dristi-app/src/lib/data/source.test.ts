import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isNotIntegratedError,
  NotIntegratedError,
  parseAuthSource,
  parseDataSource,
  selectRepository,
  type OnlyContract,
} from "./source";

describe("parseDataSource", () => {
  const cases: Array<[string | undefined, string | undefined, "sandbox" | "api"]> = [
    ["sandbox", undefined, "sandbox"],
    ["api", "sandbox", "api"],
    [undefined, "sandbox", "sandbox"],
    [undefined, "api", "api"],
    [undefined, undefined, "api"],
    ["", "sandbox", "sandbox"],
    ["", undefined, "api"],
    [" sandbox ", undefined, "sandbox"],
    ["Sandbox", undefined, "api"],
    ["mock", undefined, "api"],
  ];
  for (const [data, auth, expected] of cases) {
    it(`data=${JSON.stringify(data)} auth=${JSON.stringify(auth)} → ${expected}`, () => {
      assert.equal(parseDataSource(data, auth), expected);
    });
  }
});

describe("parseAuthSource", () => {
  const cases: Array<[string | undefined, "sandbox" | "api", "sandbox" | "api"]> = [
    ["sandbox", "api", "sandbox"],
    ["api", "sandbox", "api"],
    [undefined, "sandbox", "sandbox"],
    [undefined, "api", "api"],
    ["", "sandbox", "sandbox"],
    ["other", "sandbox", "sandbox"],
  ];
  for (const [auth, data, expected] of cases) {
    it(`auth=${JSON.stringify(auth)} data=${data} → ${expected}`, () => {
      assert.equal(parseAuthSource(auth, data), expected);
    });
  }

  it("today's defaults: sandbox data with real sign-in (.env.development)", () => {
    const data = parseDataSource("sandbox", "api");
    assert.deepEqual([data, parseAuthSource("api", data)], ["sandbox", "api"]);
  });

  it("a designer's dev:sandbox: both in the sandbox", () => {
    const data = parseDataSource("sandbox", "sandbox");
    assert.deepEqual([data, parseAuthSource("sandbox", data)], ["sandbox", "sandbox"]);
  });

  it("nothing set: both on the backend", () => {
    const data = parseDataSource(undefined, undefined);
    assert.deepEqual([data, parseAuthSource(undefined, data)], ["api", "api"]);
  });
});

type Contract = {
  listTasks(): Promise<string[]>;
  listPeople(): Promise<string[]>;
};

class Sandbox implements Contract {
  async listTasks() {
    return ["sandbox task"];
  }
  async listPeople() {
    return ["sandbox person"];
  }
}

class Http implements Partial<Contract> {
  #prefix = "backend";
  async listTasks() {
    return [`${this.#prefix} task`];
  }
}

describe("selectRepository", () => {
  it("sandbox: returns the sandbox object itself and never builds the http one", () => {
    const sandbox = new Sandbox();
    let httpBuilt = false;
    const repo = selectRepository<Contract>("sandbox", "tasks", {
      sandbox: () => sandbox,
      http: () => {
        httpBuilt = true;
        return new Http();
      },
    });
    assert.equal(repo, sandbox);
    assert.equal(httpBuilt, false);
  });

  it("api: never builds the sandbox", () => {
    let sandboxBuilt = false;
    selectRepository<Contract>("api", "tasks", {
      sandbox: () => {
        sandboxBuilt = true;
        return new Sandbox();
      },
      http: () => new Http(),
    });
    assert.equal(sandboxBuilt, false);
  });

  it("api: a method http.ts implements answers, with private fields intact", async () => {
    const repo = selectRepository<Contract>("api", "tasks", {
      sandbox: () => new Sandbox(),
      http: () => new Http(),
    });
    assert.deepEqual(await repo.listTasks(), ["backend task"]);
    assert.equal(repo.listTasks, repo.listTasks, "the same function on every read");
  });

  it("api: a method http.ts lacks rejects with NotIntegratedError, never throws", async () => {
    const repo = selectRepository<Contract>("api", "tasks", {
      sandbox: () => new Sandbox(),
      http: () => new Http(),
    });
    assert.equal(typeof repo.listPeople, "function");
    let pending: Promise<string[]> | undefined;
    assert.doesNotThrow(() => {
      pending = repo.listPeople();
    });
    await assert.rejects(pending ?? Promise.resolve(), (error: unknown) => {
      assert.ok(error instanceof NotIntegratedError);
      assert.equal(error.operation, "tasks.listPeople");
      assert.match(error.message, /tasks\.listPeople is not connected to the backend yet/);
      return true;
    });
  });

  it("api: awaiting, serialising or stringifying the repository does not reject", async () => {
    const repo = selectRepository<Contract>("api", "tasks", {
      sandbox: () => new Sandbox(),
      http: () => new Http(),
    });
    assert.equal(await Promise.resolve(repo), repo);
    assert.equal(JSON.stringify({ repo }), '{"repo":{}}');
    assert.equal(typeof String(repo), "string");
  });
});

describe("NotIntegratedError", () => {
  it("is an Error with its own name", () => {
    const error = new NotIntegratedError("filing.listDrafts");
    assert.ok(error instanceof Error);
    assert.equal(error.name, "NotIntegratedError");
  });

  it("isNotIntegratedError checks the name, so it survives a lost class", () => {
    const crossed = Object.assign(new Error("tasks.x is not connected to the backend yet."), {
      name: "NotIntegratedError",
    });
    assert.equal(isNotIntegratedError(crossed), true);
    assert.equal(isNotIntegratedError(new Error("network down")), false);
    assert.equal(isNotIntegratedError("NotIntegratedError"), false);
  });
});

/* OnlyContract is checked by `npm run typecheck`, not at run time. */
class HttpWithStaleMethod implements Partial<Contract> {
  async listTasks() {
    return [];
  }
  async getAllTasks() {
    return [];
  }
}

export const typeChecks = [
  new Http() satisfies OnlyContract<Http, Contract>,
  // @ts-expect-error getAllTasks is not in the contract, so the build fails here.
  new HttpWithStaleMethod() satisfies OnlyContract<HttpWithStaleMethod, Contract>,
];
