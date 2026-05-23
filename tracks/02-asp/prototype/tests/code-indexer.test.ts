import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTempRepo } from "./fixtures.js";

test("code indexer extracts Python functions and classes", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(
      "src/auth.py",
      [
        "def login(user):",
        "    return True",
        "",
        "class Session:",
        "    def open(self):",
        "        pass",
        "    def close(self):",
        "        pass",
      ].join("\n"),
    );

    const stats = await repo.scan();
    assert.equal(stats.filesProcessed, 1);
    // 1 file + 1 function (login) + 1 class (Session) + 2 methods (open, close)
    // Note: method_definition node type is TS/JS specific; in Python the
    // class body uses function_definition for methods too, so the same rule
    // emits 2 more function symbols inside the class.
    assert.ok(stats.symbolsIndexed >= 4);

    // File symbol with lang/python.
    const fileSym = repo.store.getSymbolById("file:src/auth.py");
    assert.notEqual(fileSym, null);
    assert.ok(fileSym!.tags.includes("lang/python"));

    // Find functions by kind tag.
    const funcs = repo.store.findByTag({
      tag: "kind/callable/function",
      hierarchical: true,
      limit: 100,
    });
    const names = new Set(funcs.map((f) => f.anchor));
    assert.ok(
      names.has("src.auth.login"),
      `Expected login symbol, got: ${[...names].join(", ")}`,
    );

    // Class symbol present.
    const classes = repo.store.findByTag({
      tag: "kind/type/class",
      hierarchical: true,
      limit: 100,
    });
    assert.ok(classes.some((c) => c.anchor?.endsWith("Session")));
  } finally {
    repo.cleanup();
  }
});

test("code indexer extracts TypeScript interface and function", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(
      "src/types.ts",
      [
        "export interface User {",
        "  id: number;",
        "  name: string;",
        "}",
        "",
        "export function greet(u: User): string {",
        '  return "hi";',
        "}",
      ].join("\n"),
    );

    await repo.scan();

    const interfaces = repo.store.findByTag({
      tag: "kind/type/interface",
      hierarchical: true,
      limit: 100,
    });
    assert.ok(interfaces.some((i) => i.anchor?.endsWith("User")));

    const funcs = repo.store.findByTag({
      tag: "kind/callable/function",
      hierarchical: true,
      limit: 100,
    });
    assert.ok(funcs.some((f) => f.anchor?.endsWith("greet")));
  } finally {
    repo.cleanup();
  }
});
