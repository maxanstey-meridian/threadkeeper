---
name: threadkeeper-packet-authoring
description: Turn agreed coding intent into a self-contained Markdown plan that Threadkeeper can implement and review in a real repository.
---

# Threadkeeper Packet Authoring

Turn decisions already reached with the human into one authoritative Markdown plan for Threadkeeper. Use the conversation context already available; do not make the human restate it through a questionnaire.

The plan is the complete handoff to Executor, Alignment Reviewer, and Acceptance Reviewer. It preserves desired behavior, settled decisions, material constraints, repository context, and honest verification. It should give a capable coding agent enough intent to work autonomously without scripting every implementation step.

## Central Invariant

A capable Executor, starting with only the plan and the selected repository workspace, can understand what the human wants, inspect the real implementation, make appropriate local decisions, complete the work, and prove it without reconstructing missing conversation context.

The plan must not depend on:

- prior conversation being visible during execution;
- unstated product or engineering decisions;
- external research that Executor cannot perform;
- local documents that are referenced but unavailable;
- the author remembering an important exception later;
- reviewers inferring what “done” was supposed to mean.

## Before Writing

1. Recover the agreed intent from the conversation:
   - desired result;
   - decisions already made;
   - reasons that materially constrain implementation;
   - explicit exclusions;
   - observable completion evidence;
   - unresolved human decisions.
2. Read the target repository’s instructions and established tooling.
3. Inspect enough implementation context to distinguish settled intent from assumptions and to name real ownership boundaries when they matter.
4. Discover exact verification commands from checked-in tooling. Never invent commands from framework familiarity.
5. Identify external facts the work requires. Threadkeeper has no web-search tool unless the selected workspace explicitly provides one, so include approved research directly when execution cannot discover it locally.
6. Decide whether the selected workspace is safe:
   - use a clean worktree when unrelated changes could be overwritten or confused with this delivery;
   - when intentional existing changes are part of the starting point, state that fact and what must be preserved;
   - never assume Threadkeeper creates or cleans a worktree.
7. Stop and ask the human when product, UX, security, permission, data, migration, legal, compliance, or release intent remains unresolved.

## Authoring Standard

Write for a capable senior coding agent, not a literal task runner.

Include decisions whose omission would invite a materially different implementation. Leave repository-discoverable details for Executor to inspect. The plan should constrain outcomes and important boundaries, not dictate every class, helper, test name, or edit sequence.

### Simplicity and Replacement Discipline

Simplicity is a default acceptance boundary, not an optional style preference. Author the smallest delivery that replaces or changes the requested behavior at its existing owner.

- When the human asks to replace or remove behavior, require the old path to be removed. Do not permit an adjacent `v2`, parallel implementation, feature flag, adapter, alias, fallback, or second source of truth unless the human explicitly requested coexistence.
- Do not add backward compatibility, migration, dual-read/write behavior, legacy deserialization, or deprecation scaffolding without a concrete persisted-data, shipped-consumer, or rollout requirement stated by the human.
- Reject provenance theatre: evidence DTOs, receipts, hashes, manifests, audit trails, ledgers, copied assessments, model self-attestation, or other machinery that records claims about facts already owned by production state. Require provenance only when a real external trust boundary or named consumer needs it. Tests and reviewers inspecting production state are not consumers that justify a second proof model.
- Do not turn sequential local state into a generalized workflow, event history, revision protocol, or state machine. Do not add abstractions, seams, helpers, wrappers, ports, or dependencies merely to make a small change look architecturally complete.
- Do not harden against impossible internal states or speculative future failures. Defensive checks must protect a plausible failure at an actual input, persistence, concurrency, process, network, filesystem, security, or publication boundary.
- Do not preserve removed concepts under new names. If correctness still needs part of the old mechanism, state the exact invariant and retain only the smallest state or check that owns it.
- Distinguish behavior being removed from correctness boundaries that remain. Reviewers must be able to reject both a compatibility-preserving non-replacement and an overcorrection that deletes real safety.
- Prefer direct production-path behavior and aggregate verification over prompt wording, mock choreography, validator ceremony, implementation-detail assertions, or redundant proof objects.

These are standing defaults. A plan should state task-specific exceptions only when the human explicitly chose them; it should not invite Executor to rediscover or negotiate an exception.

Good specificity:

- the behavior that must exist;
- settled ownership and dependency direction;
- compatibility or migration requirements explicitly chosen by the human;
- which existing mechanism must be reused;
- exact public names or contracts the human chose;
- meaningful exclusions;
- exact verification commands;
- external API facts already researched and approved.

Bad specificity:

- speculative file lists presented as mandatory;
- pseudocode for implementation that repository inspection should determine;
- generic “best practice” instructions;
- exhaustive prohibitions responding to one imagined failure mode;
- commands copied from memory rather than repository tooling;
- instructions for Threadkeeper’s routing, checkpointing, sessions, or review protocol.

## File

Threadkeeper accepts any readable Markdown file. There is no required schema, filename, directory, or frontmatter.

Store operator-authored Threadkeeper plans in the shared Cadence plan shelf:

```text
~/.cadence/threadkeeper/<short-kebab-slug>.md
```

Do not place plans in repository-local `.threadkeeper/plans/` directories. Always pass the intended workspace explicitly because the plan lives outside the target repository.

Write the file but do not start Threadkeeper automatically. The human initiates the model run.

## Recommended Shape

Use only sections that earn their keep. A useful default is:

```markdown
# Task

One sentence naming the desired delivery.

## Desired result

- Observable behavior that must be true.
- Important preservation behavior.

## Settled decisions

- Decisions already made with the human.
- Reasons when they prevent an attractive but incorrect alternative.

## Known context

- Confirmed repository or external facts needed for implementation.

## Inspect

- Real owner files or symbols that provide a useful starting point.

## Scope

- Explicit exclusions or boundaries.

## Verification

- `task check`
```

This is a guide, not a contract. Small work may need only Task, Desired result, and Verification. Complex work may need more context. Do not add empty sections.

## Desired Result

- Describe what must be observably true when work is accepted.
- Separate independent behaviors when that improves reviewability.
- Include important failure and preservation behavior.
- Do not make “tests pass” the desired result; tests are evidence of behavior.
- Avoid vague outcomes such as “support X,” “clean up Y,” or “make it robust” without saying what changes for a user, caller, operator, or maintainer.

## Settled Decisions

- State decisions as decisions, not suggestions.
- Include the reason only when it helps Executor reject a tempting but incorrect alternative.
- Preserve exact names, protocol shapes, boundaries, and compatibility behavior the human chose.
- Do not convert preferences mentioned during discussion into immutable requirements.
- Do not reopen settled design by asking Executor to choose between alternatives already resolved.

## Known Context

- Include facts verified from repository code, tooling, official documentation, or approved research.
- Distinguish confirmed facts from implementation suggestions.
- Inline external facts required for delivery when Executor cannot search for them.
- Include package names, versions, supported APIs, and relevant limitations when dependency integration relies on prior research.
- Do not instruct Executor to “Google it” unless web tools are actually available in the selected workspace.
- Do not paste large documentation dumps; include only facts that affect implementation and review.

## Repository Context

Name a small set of useful ownership points when already known. Executor can and should inspect their direct collaborators and consumers.

Do not force a narrow inspection list when the task genuinely requires broader repository understanding. Conversely, do not hand off a vague repository-wide archaeology exercise when a little authoring recon can identify the real seam.

If the repository contains intentional starting changes, state:

- that they are part of the baseline;
- what they are intended to accomplish;
- which unrelated changes must remain untouched.

## Commands and Verification

- Use exact commands supported by checked-in repository tooling.
- Prefer aggregate task or package scripts over raw framework commands when the repository provides them.
- Identify code-generation, migration, formatting, or contract commands that may modify the workspace.
- Identify the final read-only or expected aggregate gate separately.
- Do not include destructive Git or host-management commands.
- Do not require live credentials or network access in ordinary tests unless the human explicitly chose an integration test requiring them.
- Explain any manual evidence that remains after automated verification.

## Scope and Unknowns

State exclusions only when they prevent plausible scope expansion. Do not build a wall of broad negatives.

Classify meaningful unknowns:

- **repository-discoverable**: Executor can resolve through implementation and consumer inspection;
- **reviewable engineering judgment**: Executor may choose a local implementation and reviewers can assess it against plan and repository evidence;
- **human-required**: implementation must not begin until the human decides.

Threadkeeper has no interactive human or Planner consultation route. Do not encode “ask later” for a human-required decision. Resolve it before running or state an exact stop condition. Executor checkpoints the blocker, the read-only reviewer verifies it, and the reviewer returns terminal `Stop` rather than another correction when no in-workspace action can resolve it.

## Run Fit

The plan may describe substantial coding work. Threadkeeper checkpoints periodically, retains continuity across alignment review, and rotates exhausted model context separately. Do not split coherent work merely to fit an arbitrary prompt-size rule.

Split only when work contains genuinely independent deliveries, conflicting success criteria, different repositories, separate human decisions, or verification boundaries that should be accepted independently.

## Hard Rejects

Do not present a plan as ready when:

- desired behavior is not observable;
- a human-required decision remains unresolved;
- required external facts are absent and web access is unavailable;
- the selected workspace cannot be identified safely;
- the plan relies on unavailable local files or conversation context;
- implementation and verification requirements contradict each other;
- commands are invented or unsupported by repository tooling;
- the plan requires credentials the human has not agreed to provide;
- reviewers could not distinguish completion from a plausible but wrong implementation.
- it leaves replacement semantics ambiguous enough to permit an adjacent implementation while retaining the old path;
- it invites compatibility, migration, provenance, ceremony, speculative abstraction, or defensive hardening without an explicit requirement and real owning boundary;
- it protects removed machinery more strongly than the behavior the human actually requested.

Report the smallest blocker instead of writing around it.

## Final Review

Re-read the plan as the only authoritative intent available to all three agents. Ask:

- Could Executor produce a reasonable but materially wrong solution while claiming compliance?
- Did the plan preserve every settled decision that prevents that outcome?
- Did the author accidentally prescribe an implementation choice that repository inspection should own?
- Are external facts sufficient without web search?
- Is the workspace expectation honest about existing changes?
- Can Alignment Reviewer determine whether Executor followed the plan?
- Can Acceptance Reviewer determine whether the completed work is actually correct and verified?
- Does replacement remove the old path rather than add a neighboring version or compatibility route?
- Does every new abstraction, compatibility path, provenance record, or hardening check protect a stated requirement at a real boundary?
- Did the plan preserve only actual correctness invariants rather than the ceremony of the previous implementation?
- Are the named commands real and sufficient?

Repair mechanical and wording problems that do not change human intent. Ask the human when a repair requires a new decision.

## Finish

Report:

```text
Plan: <path>
Workspace: <intended repository path or “selected at run time”>
Verification:
- <exact command>

Assumptions: <none or explicit list>
Blockers: <none or exact unresolved decision>
```

Do not start Threadkeeper, modify the target repository, create a worktree, or install credentials unless the human explicitly asks.
