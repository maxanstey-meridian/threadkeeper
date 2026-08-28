import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptanceStopped,
  alignmentStopped,
  failureSummary,
  recordAcceptanceReview,
  recordAlignmentReview,
  recordCheckpoint,
  requestCompletion,
  State,
} from "../src/state.js";

const initial = State.parse({
  plan: "Do exactly this.",
  workspacePath: "/tmp/repository",
  checkpoint: null,
  alignmentReview: null,
  acceptanceReview: null,
  completionRequested: false,
});
const checkpoint = { summary: "Implemented A.", nextAction: "Implement B.", uncertainties: [] };

test("checkpoint and completion are explicit application facts", () => {
  assert.equal(recordCheckpoint(initial, checkpoint).completionRequested, false);
  assert.equal(requestCompletion(initial, checkpoint).completionRequested, true);
});

test("a correction reopens implementation", () => {
  const completed = requestCompletion(initial, checkpoint);
  const corrected = recordAcceptanceReview(completed, {
    decision: "Correct",
    direction: "Remove the redesign.",
  });
  assert.equal(corrected.completionRequested, false);
  assert.equal(corrected.acceptanceReview?.direction, "Remove the redesign.");
});

test("alignment readiness preserves completion for independent acceptance", () => {
  const completed = requestCompletion(initial, checkpoint);
  const aligned = recordAlignmentReview(completed, {
    decision: "ReadyForAcceptance",
    direction: "Executor followed the plan.",
  });
  assert.equal(aligned.completionRequested, true);
  assert.equal(aligned.alignmentReview?.decision, "ReadyForAcceptance");
});

test("a verified blocker stops instead of returning to Executor", () => {
  const stopped = recordAlignmentReview(initial, {
    decision: "Stop",
    direction: "Required sibling package does not compile.",
  });

  assert.equal(alignmentStopped(stopped), true);
  assert.equal(acceptanceStopped(stopped), false);
  assert.equal(failureSummary(stopped), "Required sibling package does not compile.");
});
