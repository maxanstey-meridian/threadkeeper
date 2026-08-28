#!/usr/bin/env node
import type { ChatClient } from "@maxanstey-meridian/tandem";
import { runCli } from "@maxanstey-meridian/tandem/cli";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createThreadkeeper } from "./pipeline.js";
import type { State } from "./state.js";

const [planArgument] = process.argv.slice(2);
if (!planArgument) {
  process.stderr.write("Usage: threadkeeper <plan.md>\n");
  process.exit(2);
}

const planPath = resolve(planArgument);
const workspacePath = resolve(process.env.THREADKEEPER_WORKSPACE ?? process.cwd());
const plan = await readFile(planPath, "utf8");
if (plan.trim().length === 0) {
  process.stderr.write(`Plan is empty: ${planPath}\n`);
  process.exit(2);
}
const executor = {
  kind: "openai-compatible",
  version: 1,
  endpoint: process.env.THREADKEEPER_EXECUTOR_ENDPOINT ?? "http://127.0.0.1:10531/v1",
  model: process.env.THREADKEEPER_EXECUTOR_MODEL ?? "gpt-5.6-sol",
  wireApi: "responses",
  verifyModel: true,
} as const satisfies ChatClient;
const reviewer = {
  kind: "openai-compatible",
  version: 1,
  endpoint: process.env.THREADKEEPER_REVIEWER_ENDPOINT ?? "http://127.0.0.1:10531/v1",
  model: process.env.THREADKEEPER_REVIEWER_MODEL ?? "gpt-5.6-sol",
  wireApi: "responses",
  verifyModel: true,
} as const satisfies ChatClient;

const initial: State = {
  plan,
  workspacePath,
  checkpoint: null,
  alignmentReview: null,
  acceptanceReview: null,
  completionRequested: false,
};
const ledgerPath = resolve(process.env.THREADKEEPER_LEDGER ?? ".threadkeeper.sqlite3");
await runCli(
  createThreadkeeper({
    executor,
    reviewer,
    reviewerSkillDirectories: [
      process.env.THREADKEEPER_REVIEW_SKILL ?? "/Users/max/.config/opencode/skills/meridian",
    ],
  }),
  initial,
  {
    ledgerPath,
    terminal: {
      truncatedToolNames: [
        "write_checkpoint",
        "file_access_write",
        "file_access_replace",
        "file_access_replace_lines",
      ],
    },
    formatResult: (result) =>
      [
        result.succeeded ? "Accepted." : "Failed.",
        `Run: ${result.runId}`,
        `Ledger: ${ledgerPath}`,
        `Summary: ${result.summary}`,
      ].join("\n"),
  },
);
