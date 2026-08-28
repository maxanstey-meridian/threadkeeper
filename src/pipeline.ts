import {
  agent,
  agentTools,
  agentWorkspace,
  capability,
  output,
  pipeline,
  route,
  skill,
  type ChatClient,
} from "@tandem/sdk";
import { continuityPolicy } from "./continuity.js";
import {
  Checkpoint,
  recordCheckpoint,
  AcceptanceReview,
  AlignmentReview,
  acceptanceStopped,
  alignmentStopped,
  failureSummary,
  recordAcceptanceReview,
  recordAlignmentReview,
  requestCompletion,
  State,
  type State as ThreadkeeperState,
} from "./state.js";

export interface ThreadkeeperOptions {
  readonly executor: ChatClient;
  readonly reviewer: ChatClient;
  readonly acceptanceReviewer?: ChatClient;
  readonly checkpointIntervalMs?: number;
  readonly reviewerSkillDirectories?: readonly string[];
  readonly now?: () => number;
  readonly executorContextWindowTokens?: number;
  readonly executorMaxOutputTokens?: number;
  readonly checkpointAtPercent?: number;
  readonly agentTimeoutMs?: number;
}

export const createThreadkeeper = (options: ThreadkeeperOptions) => {
  const continuity = continuityPolicy(options.checkpointIntervalMs ?? 5 * 60_000, options.now);
  const agentTimeoutMs = options.agentTimeoutMs ?? 20 * 60_000;
  const checkpoint = capability({
    name: "write_checkpoint",
    instructions:
      "Record what changed, what remains, the exact next planned action, and any repository fact blocking the authored design.",
    schema: Checkpoint,
    apply: (state: ThreadkeeperState, value) => {
      continuity.mark(state.workspacePath);
      return recordCheckpoint(state, value);
    },
    summarize: (value) => `Checkpoint: ${value.summary}\nNext: ${value.nextAction}`,
  });
  const finish = capability({
    name: "finish",
    instructions: "Request final review after the complete plan has been implemented.",
    schema: Checkpoint,
    apply: (state: ThreadkeeperState, value) => {
      continuity.mark(state.workspacePath);
      return requestCompletion(state, value);
    },
    summarize: (value) => `Completion requested: ${value.summary}`,
  });

  const repository = agentWorkspace<ThreadkeeperState>({ path: (state) => state.workspacePath });
  const executor = agent<ThreadkeeperState>({
    id: "executor",
    instructions: [
      "You are Threadkeeper's Executor, an autonomous coding agent responsible for implementing the complete authored plan.",
      "Investigate the existing implementation, make the required changes, and verify the resulting repository state. Own the complete plan, including affected code and consumers not explicitly named in it.",
      "Implement the authored plan exactly; its decisions, boundaries, and behavior are authoritative.",
      "Do not silently redesign the requested solution, broaden scope, or add unrelated cleanup.",
      "Use the smallest direct implementation and prefer maintained framework or SDK capabilities over hand-rolled commodity machinery.",
      "Inspect existing ownership and consumers before changing contracts, and verify observable behavior.",
      "Tests must encode the intended observable contract, not merely describe the current implementation. Do not delete, invert, weaken, or rewrite expectations just to bless a bug, removed behavior, missing work, or contradictory result.",
      "Work in the supplied workspace as it currently exists. Preserve unrelated changes, and never create or switch worktrees or branches, stash, reset, clean, checkout, commit, or otherwise manage Git state. A dirty tree is context, not a blocker.",
      "Before adding a new abstraction or implementation path, inspect the existing owner and reuse or extend it when that satisfies the plan and repository invariants.",
      "Give brief progress updates before substantial investigation, edits, and verification. State what you learned and what you will do next without narrating routine individual tool calls.",
      "If repository facts make the plan impossible, or two attempts at the same problem fail and no sound correction is repository-discoverable, checkpoint the exact conflict instead of thrashing or redesigning around it.",
      "When checkpointing is required, call write_checkpoint. When the plan is complete and verified, call finish.",
    ].join(" "),
    client: options.executor,
    message: (state) =>
      [
        "PLAN (authoritative):",
        state.plan,
        "PRIOR EXECUTOR CHECKPOINT (UNVERIFIED CONTINUITY):",
        state.checkpoint ? JSON.stringify(state.checkpoint) : "(none)",
        "LATEST REVIEW DIRECTION:",
        state.acceptanceReview
          ? JSON.stringify(state.acceptanceReview)
          : state.alignmentReview
            ? JSON.stringify(state.alignmentReview)
            : "(none)",
      ].join("\n\n"),
    capabilities: [checkpoint, finish],
    workspace: repository.withTools(
      [
        agentTools.always(
          "read_file",
          "ls",
          "grep",
          "git:ro",
          "write_file",
          "delete_file",
          "replace",
          "replace_lines",
          "shell",
        ),
      ],
      { interceptTool: continuity.interceptTool },
    ),
    continueSession: true,
    checkpoint: {
      disableCompaction: true,
      contextWindowTokens: options.executorContextWindowTokens ?? 330_000,
      maxOutputTokens: options.executorMaxOutputTokens ?? 32_000,
      checkpointAtPercent: options.checkpointAtPercent ?? 80,
      capability: checkpoint,
      instructions:
        "Stop work. Call write_checkpoint with what changed, what remains, the exact next planned action, and any repository fact blocking the authored design. Do not continue implementation.",
      message: (_state, currentContextTokens) =>
        `Context window approaching limit: ${currentContextTokens} tokens used. Call write_checkpoint now.`,
      session: "reset",
    },
    timeoutMs: agentTimeoutMs,
    persist: true,
  });

  const reviewWorkspace = repository.withTools([
    agentTools.always("read_file", "ls", "grep", "git:ro"),
  ]);
  const alignmentReviewer = agent<ThreadkeeperState, AlignmentReview>({
    id: "alignment-reviewer",
    instructions: [
      "You are Threadkeeper's Alignment Reviewer, an independent engineering reviewer responsible for identifying divergence while implementation is in progress.",
      "Review the repository work completed so far against the whole authored plan. Inspect the implementation and relevant unchanged code, challenge the Executor's current account, and look for concrete counterexamples to claimed alignment before allowing work to continue.",
      "Assess the cumulative delivery trajectory, not merely whether the Executor's proposed next action sounds reasonable.",
      "Identify incorrect assumptions, regressions, scope drift, unnecessary complexity, and retained invariants that no longer hold. Correct or redirect existing work whenever it is heading toward a plausible but wrong result, even when the proposed next action is locally reasonable.",
      "Only after assessing the implementation so far and its direction, decide whether the proposed next action appropriately advances the whole plan.",
      "Inspect the repository state, owners, consumers, contracts, state transitions, and tests needed to verify those judgments. Use the diff to understand what changed, not as the boundary of the review. Review the supplied workspace as it currently exists, preserve unrelated existing changes, and do not ask Executor to manage Git state.",
      "Enforce the plan's settled decisions and the configured review doctrine. Reject compatibility, provenance, parallel ownership, speculative abstraction, or defensive ceremony without an explicit requirement at a real boundary, while preserving required safety invariants.",
      "Treat checkpoint claims as claims, not proof. Return Continue only when cumulative work, trajectory, retained invariants, and next action all align; otherwise return Correct with direction addressing the underlying divergence. After completion, return ReadyForAcceptance only when the whole plan is aligned.",
      "Return Stop only when repository evidence proves the plan cannot continue without violating its scope or a required external prerequisite is unavailable. Stop is terminal; do not use Correct when no Executor action can resolve the blocker in this workspace.",
    ].join(" "),
    client: options.reviewer,
    message: (state) =>
      [
        "PLAN (authoritative):",
        state.plan,
        "EXECUTOR CHECKPOINT (UNVERIFIED CONTINUITY):",
        JSON.stringify(state.checkpoint),
        `COMPLETION REQUESTED: ${state.completionRequested}`,
      ].join("\n\n"),
    output: {
      instructions:
        "Return Continue, Correct, ReadyForAcceptance, or Stop with concise, concrete direction.",
      schema: AlignmentReview,
      validateFor: (state, review) => {
        if (review.decision === "ReadyForAcceptance" && !state.completionRequested) {
          return [
            {
              path: "$.decision",
              message: "ReadyForAcceptance requires an Executor completion request.",
            },
          ];
        }
        if (review.decision === "Continue" && state.completionRequested) {
          return [
            {
              path: "$.decision",
              message: "A completion alignment review must be ReadyForAcceptance or Correct.",
            },
          ];
        }
        if (
          (review.decision === "Correct" || review.decision === "Stop") &&
          review.direction.trim().length === 0
        ) {
          return [
            {
              path: "$.direction",
              message: `${review.decision} requires concrete direction.`,
            },
          ];
        }
        return [];
      },
      apply: (state, review) => {
        continuity.mark(state.workspacePath);
        return recordAlignmentReview(state, review);
      },
    },
    skills: (options.reviewerSkillDirectories ?? []).map((directory) => skill({ directory })),
    workspace: reviewWorkspace,
    timeoutMs: agentTimeoutMs,
    persist: true,
  });

  const acceptanceReviewer = agent<ThreadkeeperState, AcceptanceReview>({
    id: "acceptance-reviewer",
    instructions: [
      "You are Threadkeeper's Acceptance Reviewer, an independent code-review agent responsible for deciding whether the completed repository change should be accepted.",
      "Review the repository as a production change against the complete authored plan. Inspect the repository state necessary to reach that decision, including relevant unchanged code. Look for concrete counterexamples to claimed completion before accepting.",
      "The repository is the subject of the review. The plan defines the required result. Executor checkpoints, alignment findings, prior decisions, and ledger entries are context, not proof that the implementation is correct or complete.",
      "Use the configured review doctrine and inspect relevant consumers, contracts, configuration, persistence, generated artifacts, and tests where applicable. Use the diff to understand what changed, not as the boundary of the review.",
      "Decide whether the implementation is correct, complete, appropriately owned, as simple as the plan permits, honestly verified, and preserves every required invariant. Existing unrelated changes are not defects unless Executor damaged or misrepresented them.",
      "Return Accept when the work is ready. Return Correct with concrete findings when further Executor work is required.",
      "Return Stop only when repository evidence proves acceptance cannot continue without violating the plan or a required external prerequisite is unavailable. Stop is terminal; do not use Correct when no Executor action can resolve the blocker in this workspace.",
    ].join(" "),
    client: options.acceptanceReviewer ?? options.reviewer,
    message: (state) =>
      [
        "PLAN (authoritative):",
        state.plan,
        "EXECUTOR COMPLETION NOTES (UNVERIFIED):",
        JSON.stringify(state.checkpoint),
        "PRIOR ALIGNMENT DIRECTION:",
        JSON.stringify(state.alignmentReview),
      ].join("\n\n"),
    output: {
      instructions: "Return Accept, Correct, or Stop with a concise engineering assessment.",
      schema: AcceptanceReview,
      validateFor: (_state, review) =>
        (review.decision === "Correct" || review.decision === "Stop") &&
        review.direction.trim().length === 0
          ? [
              {
                path: "$.direction",
                message: `${review.decision} requires concrete direction.`,
              },
            ]
          : [],
      apply: (state, review) => {
        continuity.mark(state.workspacePath);
        return recordAcceptanceReview(state, review);
      },
    },
    skills: (options.reviewerSkillDirectories ?? []).map((directory) => skill({ directory })),
    workspace: reviewWorkspace,
    timeoutMs: agentTimeoutMs,
    persist: true,
  });

  const done = output<ThreadkeeperState>({
    id: "done",
    summary: (state) => state.acceptanceReview?.direction || "Plan implemented and accepted.",
  });
  const failed = output<ThreadkeeperState>({
    id: "failed",
    failed: true,
    summary: failureSummary,
  });

  return pipeline({
    name: "threadkeeper",
    state: State,
    nodes: [executor, alignmentReviewer, acceptanceReviewer, done, failed],
    start: executor,
    routes: [
      route({ from: executor, outcome: "success", to: alignmentReviewer, label: "checkpoint" }),
      route({ from: executor, outcome: "failed", to: failed, label: "executor failed" }),
      route({
        from: alignmentReviewer,
        outcome: "success",
        to: executor,
        when: (state) => state.alignmentReview?.decision === "Continue",
        label: "continue",
      }),
      route({
        from: alignmentReviewer,
        outcome: "success",
        to: executor,
        when: (state) => state.alignmentReview?.decision === "Correct",
        label: "correct",
      }),
      route({
        from: alignmentReviewer,
        outcome: "success",
        to: acceptanceReviewer,
        when: (state) => state.alignmentReview?.decision === "ReadyForAcceptance",
        label: "ready for acceptance",
      }),
      route({
        from: alignmentReviewer,
        outcome: "success",
        to: failed,
        when: alignmentStopped,
        label: "stopped",
      }),
      route({
        from: alignmentReviewer,
        outcome: "failed",
        to: failed,
        label: "alignment review failed",
      }),
      route({
        from: acceptanceReviewer,
        outcome: "success",
        to: executor,
        when: (state) => state.acceptanceReview?.decision === "Correct",
        label: "acceptance corrections",
      }),
      route({
        from: acceptanceReviewer,
        outcome: "success",
        to: done,
        when: (state) => state.acceptanceReview?.decision === "Accept",
        label: "accepted",
      }),
      route({
        from: acceptanceReviewer,
        outcome: "success",
        to: failed,
        when: acceptanceStopped,
        label: "acceptance stopped",
      }),
      route({
        from: acceptanceReviewer,
        outcome: "failed",
        to: failed,
        label: "acceptance review failed",
      }),
    ],
    outputs: [done, failed],
    persist: true,
  });
};
