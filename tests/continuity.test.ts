import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { continuityPolicy } from "../src/continuity.js";

test("dirty elapsed work blocks process execution until continuity is marked", async () => {
  const directory = mkdtempSync(join(tmpdir(), "threadkeeper-continuity-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: directory });
    writeFileSync(join(directory, "plan.txt"), "changed");
    let now = 0;
    const policy = continuityPolicy(100, () => now);
    policy.mark(directory);
    now = 100;

    const blocked = await policy.interceptTool(
      {
        plan: "Plan",
        workspacePath: directory,
        checkpoint: null,
        alignmentReview: null,
        acceptanceReview: null,
        completionRequested: false,
      },
      { name: "shell", effect: "processExecution", arguments: {} },
      { signal: new AbortController().signal },
    );
    assert.match(blocked!, /CONTINUITY CHECKPOINT REQUIRED/);

    policy.mark(directory);
    assert.equal(
      await policy.interceptTool(
        {
          plan: "Plan",
          workspacePath: directory,
          checkpoint: null,
          alignmentReview: null,
          acceptanceReview: null,
          completionRequested: false,
        },
        { name: "write_file", effect: "workspaceMutation", arguments: {} },
        { signal: new AbortController().signal },
      ),
      null,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the first operation establishes the continuity window", async () => {
  const directory = mkdtempSync(join(tmpdir(), "threadkeeper-initial-continuity-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: directory });
    writeFileSync(join(directory, "existing.txt"), "already dirty");
    const policy = continuityPolicy(100, () => 1_000);

    assert.equal(
      await policy.interceptTool(
        {
          plan: "Plan",
          workspacePath: directory,
          checkpoint: null,
          alignmentReview: null,
          acceptanceReview: null,
          completionRequested: false,
        },
        { name: "write_file", effect: "workspaceMutation", arguments: {} },
        { signal: new AbortController().signal },
      ),
      null,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
