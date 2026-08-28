# Threadkeeper

A dead-simple coding loop built on top of [Tandem](https://github.com/maxanstey-meridian/tandem) to keep LLMs on track.

One agent does the work. It is forced to check in periodically with a second agent, which reviews the work so far and
corrects it when it starts drifting from the plan. When the executor thinks it is finished, a final review either signs
off the result or sends it back for correction.

Give Threadkeeper a Markdown plan and a workspace. It keeps going until the work is accepted or a real blocker stops it.

```sh
pnpm install
pnpm start /absolute/path/to/plan.md
```

Use `skills/packet-authoring/SKILL.md` when turning agreed intent into a self-contained Threadkeeper plan.
