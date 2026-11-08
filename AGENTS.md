## Important!!!
- Whenever you are going to stop the current taskflow to ask a question, always use the AskQuestion tool.
- Only end the conversation when the task has been verify to be completed and ready to be deployed(always REMEMBER this, this is the most important rule). Otherwise, use AskQuestion tool and let user choose to continue or not.
- Use the AskQuestion tool for any interaction requiring user input like choosing between options, confirming a proposed action, or clarifying an ambiguous request.
- Only spin up subagent for really large task that is not possible to complete in one go. Prefer using the main agent for small and medium tasks.
- When spinning up subagents, use muse wonder model, only if this model is not available, then use opus 4.6 model model.
- Keep the analysis of file structure, codebase, and project context in ARCHITECTURE.md file. Always update this file when you are done with the task. This file is for reference whenever you are working on the project.
- When implemeting features and fixing bugs, always prepare test cases and conduct e2e tests based on multiple user journeys, not just happy path, use mock data for external calls(like ai call).
- Always adopt the architecture that is best for user experience, performance and software maintainability. No need to consider the cost of the architecture and backward compatibility.
- Always update the docs page whenever architecture and functionality changes.
- Always ask for my review before asking whether you should execute or build the plan.


- When conductng e2e tests, take screenshots of the browser and save them to the `screenshots` directory with clear naming as proof and use for documentation.
- Use `humanizer` skill for general copywriting and content creation.
- Use `frontend-skill` skill for UI/UX design.
- Use `impeccable` skill when brainstorming UI/UX design.
- Use `critique` skill when reviewing UI/UX design.
- Use `clarity` skill for copywriting in UI/UX components.
- Use `emil-design-eng` skill for animation design.
- When a feature or changes is ready to be deployed, update the versioning in package.json following semver rules.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch (use the `_BRANCH` value printed by the preamble — NOT any branch from conversation history or gitStatus), and the current plan/task. (1-2 sentences)
2. **Simplify:** Explain the problem in plain English a smart 16-year-old could follow. No raw function names, no internal jargon, no implementation details. Use concrete examples and analogies. Say what it DOES, not what it's called.
3. **Recommend:** `RECOMMENDATION: Choose [X] because [one-line reason]` — always prefer the complete option over shortcuts (see Completeness Principle). Include `Completeness: X/10` for each option. Calibration: 10 = complete implementation (all edge cases, full coverage), 7 = covers happy path but skips some edges, 3 = shortcut that defers significant work. If both options are 8+, pick the higher; if one is ≤5, flag it.
4. **Options:** Lettered options: `A) ... B) ... C) ...` — when an option involves effort, show both scales: `(human: ~X / CC: ~Y)`

Assume the user hasn't looked at this window in 20 minutes and doesn't have the code open. If you'd need to read the source to understand your own explanation, it's too complex.

Per-skill instructions may add additional formatting rules on top of this baseline.

## Completeness Principle — Boil the Lake

AI makes completeness near-free. Always recommend the complete option over shortcuts — the delta is minutes with AI tooling. A "lake" (100% coverage, all edge cases) is boilable; an "ocean" (full rewrite, multi-quarter migration) is not. Boil lakes, flag oceans.

**Effort reference** — always show both scales:

| Task type | Human team | AI-assisted | Compression |
|-----------|-----------|-----------|-------------|
| Boilerplate | 2 days | 15 min | ~100x |
| Tests | 1 day | 15 min | ~50x |
| Feature | 1 week | 30 min | ~30x |
| Bug fix | 4 hours | 15 min | ~20x |

Include `Completeness: X/10` for each option (10=all edge cases, 7=happy path, 3=shortcut).

## Repo Ownership — See Something, Say Something
- You own everything. Investigate and offer to fix proactively.
- Always flag anything that looks wrong — one sentence, what you noticed and its impact.
