import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTempRepo } from "./fixtures.js";

test("Rust code: function and struct extraction", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(
      "src/lib.rs",
      [
        "pub fn greet(name: &str) -> String {",
        '    format!("Hello, {}", name)',
        "}",
        "",
        "pub struct User {",
        "    pub name: String,",
        "}",
      ].join("\n"),
    );
    await repo.scan();

    const funcs = repo.store.findByTag({
      tag: "kind/callable/function",
      hierarchical: true,
      limit: 100,
    });
    assert.ok(
      funcs.some((f) => f.anchor?.endsWith("greet")),
      `Expected greet, got: ${funcs.map((f) => f.anchor).join(", ")}`,
    );

    const classes = repo.store.findByTag({
      tag: "kind/type/class",
      hierarchical: true,
      limit: 100,
    });
    assert.ok(
      classes.some((c) => c.anchor?.endsWith("User")),
      `Expected User struct, got: ${classes.map((c) => c.anchor).join(", ")}`,
    );

    // lang/rust tag should be present.
    const fileSym = repo.store.getSymbolById("file:src/lib.rs");
    assert.notEqual(fileSym, null);
    assert.ok(fileSym!.tags.includes("lang/rust"));
  } finally {
    repo.cleanup();
  }
});

test("Go code: function and type extraction", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(
      "main.go",
      [
        "package main",
        "",
        "func Greet(name string) string {",
        '    return "Hello, " + name',
        "}",
        "",
        "type User struct {",
        "    Name string",
        "}",
      ].join("\n"),
    );
    await repo.scan();

    const fileSym = repo.store.getSymbolById("file:main.go");
    assert.notEqual(fileSym, null);
    assert.ok(fileSym!.tags.includes("lang/go"));

    const funcs = repo.store.findByTag({
      tag: "kind/callable/function",
      hierarchical: true,
      limit: 100,
    });
    assert.ok(funcs.some((f) => f.anchor?.endsWith("Greet")));
  } finally {
    repo.cleanup();
  }
});

test("Java code: class and method extraction", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(
      "src/User.java",
      [
        "public class User {",
        "    private String name;",
        "    public String getName() {",
        "        return name;",
        "    }",
        "}",
      ].join("\n"),
    );
    await repo.scan();

    const classes = repo.store.findByTag({
      tag: "kind/type/class",
      hierarchical: true,
      limit: 100,
    });
    assert.ok(classes.some((c) => c.anchor?.endsWith("User")));

    const methods = repo.store.findByTag({
      tag: "kind/callable/method",
      hierarchical: true,
      limit: 100,
    });
    assert.ok(methods.some((m) => m.anchor?.endsWith("getName")));
  } finally {
    repo.cleanup();
  }
});
