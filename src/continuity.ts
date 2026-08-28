import type { AgentToolInterceptor } from "@maxanstey-meridian/tandem";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { State } from "./state.js";

const exec = promisify(execFile);

export interface ContinuityPolicy {
  readonly interceptTool: AgentToolInterceptor<State>;
  mark(workspacePath: string): void;
}

export const continuityPolicy = (
  intervalMs: number,
  now: () => number = Date.now,
): ContinuityPolicy => {
  const lastContinuity = new Map<string, number>();

  return {
    mark: (workspacePath) => lastContinuity.set(workspacePath, now()),
    interceptTool: async (state, invocation, { signal }) => {
      if (!lastContinuity.has(state.workspacePath)) {
        lastContinuity.set(state.workspacePath, now());
        return null;
      }
      if (
        !["workspaceMutation", "processExecution"].includes(invocation.effect) ||
        now() - lastContinuity.get(state.workspacePath)! < intervalMs
      ) {
        return null;
      }

      const { stdout } = await exec("git", ["status", "--porcelain"], {
        cwd: state.workspacePath,
        signal,
      });
      if (stdout.trim().length === 0) {
        lastContinuity.set(state.workspacePath, now());
        return null;
      }

      return [
        "CONTINUITY CHECKPOINT REQUIRED.",
        "The attempted operation was not applied.",
        "Stop and call write_checkpoint with what changed, what remains, the exact next planned action, and any repository fact blocking the authored design.",
        "Your current Executor session will be retained while the Reviewer checks alignment with the plan.",
      ].join("\n");
    },
  };
};
