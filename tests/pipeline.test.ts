import type { ChatClient } from "@tandem/sdk";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createThreadkeeper } from "../src/pipeline.js";

const client = {
  kind: "openai-compatible",
  version: 1,
  endpoint: "http://localhost/v1",
  model: "test-model",
  wireApi: "responses",
} as const satisfies ChatClient;

type ExecutorCheckpoint = {
  contextWindowTokens: number;
  maxOutputTokens: number;
  checkpointAtPercent: number;
  disableCompaction?: boolean;
  session?: "retain" | "reset";
};

const executorCheckpoint = (options: Parameters<typeof createThreadkeeper>[0]) => {
  const pipeline = createThreadkeeper(options);
  const executor = pipeline.nodes.find((node) => node.id === "executor") as unknown as {
    checkpoint: ExecutorCheckpoint;
  };
  return executor.checkpoint;
};

const agentDefinition = (id: string) => {
  const pipeline = createThreadkeeper({ executor: client, reviewer: client });
  return pipeline.nodes.find((node) => node.id === id) as unknown as {
    instructions: string;
    message: (state: {
      plan: string;
      workspacePath: string;
      checkpoint: { summary: string; nextAction: string; uncertainties: string[] } | null;
      alignmentReview: { decision: string; direction: string } | null;
      acceptanceReview: { decision: string; direction: string } | null;
      completionRequested: boolean;
    }) => string;
    continueSession: boolean;
  };
};

test("Executor uses current context limits with compaction disabled and session reset", () => {
  assert.partialDeepStrictEqual(executorCheckpoint({ executor: client, reviewer: client }), {
    contextWindowTokens: 330_000,
    maxOutputTokens: 32_000,
    checkpointAtPercent: 80,
    disableCompaction: true,
    session: "reset",
  });
});

test("Executor numeric context options override the defaults", () => {
  const checkpoint = executorCheckpoint({
    executor: client,
    reviewer: client,
    executorContextWindowTokens: 100_000,
    executorMaxOutputTokens: 10_000,
    checkpointAtPercent: 70,
  });

  assert.equal(checkpoint.contextWindowTokens, 100_000);
  assert.equal(checkpoint.maxOutputTokens, 10_000);
  assert.equal(checkpoint.checkpointAtPercent, 70);
  assert.equal(checkpoint.disableCompaction, true);
  assert.equal(checkpoint.session, "reset");
});

test("roles have concrete engineering identities and honest repository framing", () => {
  const executor = agentDefinition("executor");
  const alignment = agentDefinition("alignment-reviewer");
  const acceptance = agentDefinition("acceptance-reviewer");

  assert.match(executor.instructions, /autonomous coding agent/);
  assert.match(executor.instructions, /affected code and consumers not explicitly named/);
  assert.doesNotMatch(executor.instructions, /authoritative working state/);

  assert.match(alignment.instructions, /independent engineering reviewer/);
  assert.match(alignment.instructions, /relevant unchanged code/);
  assert.match(alignment.instructions, /concrete counterexamples/);
  assert.match(alignment.instructions, /not as the boundary of the review/);

  assert.match(acceptance.instructions, /independent code-review agent/);
  assert.match(acceptance.instructions, /repository is the subject of the review/);
  assert.match(acceptance.instructions, /relevant unchanged code/);
  assert.match(acceptance.instructions, /concrete counterexamples/);
  assert.match(acceptance.instructions, /ledger entries are context, not proof/);
  assert.match(acceptance.instructions, /not as the boundary of the review/);
  assert.equal(alignment.continueSession, false);
  assert.equal(acceptance.continueSession, false);
});

test("dynamic messages label participant material without presenting it as repository truth", () => {
  const state = {
    plan: "Implement the plan",
    workspacePath: "/workspace",
    checkpoint: { summary: "claimed work", nextAction: "next", uncertainties: [] },
    alignmentReview: { decision: "ReadyForAcceptance", direction: "looks aligned" },
    acceptanceReview: null,
    completionRequested: true,
  };

  assert.match(
    agentDefinition("executor").message(state),
    /PRIOR EXECUTOR CHECKPOINT \(UNVERIFIED CONTINUITY\)/,
  );
  assert.match(
    agentDefinition("alignment-reviewer").message(state),
    /EXECUTOR CHECKPOINT \(UNVERIFIED CONTINUITY\)/,
  );
  const acceptanceMessage = agentDefinition("acceptance-reviewer").message(state);
  assert.match(acceptanceMessage, /EXECUTOR COMPLETION NOTES \(UNVERIFIED\)/);
  assert.match(acceptanceMessage, /PRIOR ALIGNMENT DIRECTION/);
});
