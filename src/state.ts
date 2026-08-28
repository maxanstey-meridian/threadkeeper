import { z } from "zod";

export const Checkpoint = z.object({
  summary: z.string().min(1),
  nextAction: z.string().min(1),
  uncertainties: z.array(z.string().min(1)),
});

export const AlignmentReview = z.object({
  decision: z.enum(["Continue", "Correct", "ReadyForAcceptance", "Stop"]),
  direction: z.string(),
});

export const AcceptanceReview = z.object({
  decision: z.enum(["Accept", "Correct", "Stop"]),
  direction: z.string(),
});

export const State = z.object({
  plan: z.string().min(1),
  workspacePath: z.string().min(1),
  checkpoint: Checkpoint.nullable(),
  alignmentReview: AlignmentReview.nullable(),
  acceptanceReview: AcceptanceReview.nullable(),
  completionRequested: z.boolean(),
});

export type Checkpoint = z.infer<typeof Checkpoint>;
export type AlignmentReview = z.infer<typeof AlignmentReview>;
export type AcceptanceReview = z.infer<typeof AcceptanceReview>;
export type State = z.infer<typeof State>;

export const recordCheckpoint = (state: State, checkpoint: Checkpoint): State => ({
  ...state,
  checkpoint,
  alignmentReview: null,
  acceptanceReview: null,
  completionRequested: false,
});

export const requestCompletion = (state: State, checkpoint: Checkpoint): State => ({
  ...state,
  checkpoint,
  alignmentReview: null,
  acceptanceReview: null,
  completionRequested: true,
});

export const recordAlignmentReview = (state: State, review: AlignmentReview): State => ({
  ...state,
  alignmentReview: review,
  acceptanceReview: null,
  completionRequested:
    review.decision === "Correct" || review.decision === "Stop" ? false : state.completionRequested,
});

export const recordAcceptanceReview = (state: State, review: AcceptanceReview): State => ({
  ...state,
  acceptanceReview: review,
  completionRequested:
    review.decision === "Correct" || review.decision === "Stop" ? false : state.completionRequested,
});

export const alignmentStopped = (state: State): boolean =>
  state.alignmentReview?.decision === "Stop";

export const acceptanceStopped = (state: State): boolean =>
  state.acceptanceReview?.decision === "Stop";

export const failureSummary = (state: State): string =>
  acceptanceStopped(state)
    ? state.acceptanceReview!.direction
    : alignmentStopped(state)
      ? state.alignmentReview!.direction
      : "Threadkeeper failed before the plan was accepted.";
