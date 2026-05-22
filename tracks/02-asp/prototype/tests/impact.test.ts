import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTempRepo } from "./fixtures.js";
import { makeImpactOp } from "../src/operations/impact.js";

test("impact downstream finds callers via call edges", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(
      "src/lib.py",
      [
        "def login(user):",
        "    return True",
        "",
        "def main():",
        "    login('alice')",
      ].join("\n"),
    );

    await repo.scan();

    // Resolve the `login` symbol id (dotted form).
    const candidates = repo.store.findSymbolsByName("login");
    assert.ok(candidates.length >= 1, "Expected at least one `login` symbol");
    const loginId = candidates.find((id) => id.endsWith(".login"));
    assert.ok(loginId !== undefined, `Expected dotted login id, got ${candidates.join(", ")}`);

    const op = makeImpactOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({ symbol: loginId!, direction: "downstream" });
    assert.ok(
      r.downstream.some((d) => d.id.endsWith(".main")),
      `Expected main to be downstream of login; got: ${r.downstream
        .map((d) => d.id)
        .join(", ")}`,
    );
    assert.equal(r.upstream.length, 0);
    assert.ok(r.totalAffected >= 1);
    assert.ok(r.degradation.some((d) => d.feature === "edge-resolution"));
  } finally {
    repo.cleanup();
  }
});

test("impact upstream finds callees from a caller", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(
      "src/lib.py",
      [
        "def helper():",
        "    return 42",
        "",
        "def caller():",
        "    return helper()",
      ].join("\n"),
    );

    await repo.scan();

    const callerCandidates = repo.store.findSymbolsByName("caller");
    const callerId = callerCandidates.find((id) => id.endsWith(".caller"));
    assert.ok(callerId !== undefined);

    const op = makeImpactOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({ symbol: callerId!, direction: "upstream" });
    assert.ok(
      r.upstream.some((u) => u.id.endsWith(".helper")),
      `Expected helper upstream of caller; got ${r.upstream
        .map((u) => u.id)
        .join(", ")}`,
    );
  } finally {
    repo.cleanup();
  }
});

test("impact returns empty when symbol unknown", async () => {
  const repo = makeTempRepo();
  try {
    const op = makeImpactOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({ symbol: "python:nonexistent.symbol" });
    assert.equal(r.totalAffected, 0);
    assert.equal(r.riskLevel, "low");
  } finally {
    repo.cleanup();
  }
});

test("impact riskLevel reflects affected count", async () => {
  const repo = makeTempRepo();
  try {
    // 6 callers of `target` → medium risk band (5..20).
    const code = [
      "def target():",
      "    return 1",
      "",
      "def c1(): target()",
      "def c2(): target()",
      "def c3(): target()",
      "def c4(): target()",
      "def c5(): target()",
      "def c6(): target()",
    ].join("\n");
    repo.write("src/x.py", code);
    await repo.scan();

    const ids = repo.store.findSymbolsByName("target");
    const targetId = ids.find((id) => id.endsWith(".target"));
    assert.ok(targetId !== undefined);

    const op = makeImpactOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({ symbol: targetId!, direction: "downstream" });
    assert.equal(r.riskLevel, "medium", `total=${r.totalAffected}`);
  } finally {
    repo.cleanup();
  }
});
