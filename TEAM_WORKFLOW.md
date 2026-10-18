# Team workflow

## Three-person ownership
Each of the three human members directs an AI coding agent. Humans own scope decisions, review, and handoffs; agents implement and verify their assigned work. Assign names before implementation; choose the integration lead based on backend experience.

| Person / role | Scope | Supporting prompts |
|---|---|---|
| 1 — Human + data/retrieval agent | Source verification, automated collector, normalization/provenance, snapshot, retrieval/filtering, data setup documentation | `prompts/09_MEMBER_1_DATA_AGENT.md` |
| 2 — Human + RAG/interface agent; integration lead | Request flow, generation, output validation, recommendation UI, integration and runtime configuration | `prompts/10_MEMBER_2_APP_AGENT.md` |
| 3 — Human + QA/submission agent | Test cases and evidence, factual/privacy review, clean setup, slides, rehearsal, demo recording and submission checklist | `prompts/11_MEMBER_3_QA_AGENT.md` |

Coordinate file ownership before concurrent edits. Person 3 tests throughout development, prepares the presentation early, and pairs with the others to reproduce defects. Independent reviewers remain read-only; the responsible implementer fixes application defects.

## Agent coordination
- Start each agent with its member-specific prompt. The generic Build Lead prompt is background guidance, not permission for every agent to rebuild the whole project.
- Use separate clones or worktrees, each on a task branch from the same agreed baseline. Suggested branch prefixes: `work/data/`, `work/app/`, `work/qa/`; use a fresh branch per deliverable, such as `work/data/collector`. These are proposed names; this document does not create branches or launch agents.
- Before parallel edits, the integration lead records concrete file ownership and the shared interface in `docs/CONTRACTS.md`. That file is a planned artifact, not an existing API specification. Choose the stack together, then define types, units, null/unknown handling, errors, and an example request/retrieval result.
- Only the integration lead edits shared contracts, dependency manifests/lockfiles, root configuration, and shared setup files. Other agents request needed changes. Member 1 owns collector/retrieval modules and their unit tests; member 2 owns application/generation/UI modules and their unit tests; member 3 owns acceptance/integration tests and assigned submission documents. Record exact paths after scaffolding.
- Each agent works in small, reviewable increments, runs checks for its scope, and reports blockers promptly. It may inspect other modules but must not silently edit them or redefine their interface.
- Each human checks the diff and evidence before handing off. The integration lead merges reviewed work, resolves conflicts with the owner, and runs combined checks; member 3 independently tests the integrated result.
- Integrate the first real data-to-answer flow early. Reviewers may find issues; fixes stay with the relevant implementation owner unless ownership is explicitly reassigned.
- Humans supply credentials through local configuration, verify recommendations make sense, choose product tradeoffs, rehearse, and control final publishing. Agent claims of success need command results or observable evidence.

## Handoff format
Every handoff includes: branch and commit; completed scope; changed files; interface/configuration/dependency changes; exact checks and outcomes; known limitations; blockers and the next dependency. Do not include keys or personal location history. Mark anything not tested explicitly.

## Git integration protocol
Separate task branches prevent members' ordinary pushes from updating the same branch. They do not guarantee conflict-free integration: shared files and incompatible interfaces can still conflict.

1. **Start from current main.** With a clean working tree, fetch `origin` and create a new task branch from `origin/main`. Each branch has one writer. Separate machines use separate clones; simultaneous agents on one machine use separate worktrees/checkouts.
2. **Stay within ownership.** Declare exact paths in the task handoff before editing. Member 2 owns shared contracts, manifests, lockfiles, and root configuration. For a shared-file change, send the required change to the owner instead of having two agents edit it independently. Coordinate moves/renames before making them.
3. **Commit only your work.** Inspect the diff, stage explicit owned paths, and run the relevant checks. Avoid broad staging that could capture another agent's edits. Keep unrelated formatting or refactoring out of the task.
4. **Sync before review.** Fetch again and merge `origin/main` into the task branch with a clean working tree. Resolve any conflicts with the affected owner and rerun checks. Use merges for published task branches so synchronization does not require rewriting history.
5. **Push your branch and open a PR.** Never push directly to `main`. Include the handoff evidence and changed contract/dependency details. Do not force-push. If a normal push is rejected, fetch and inspect the unexpected remote changes; do not overwrite them.
6. **Integrate one PR at a time.** Member 2 reviews ownership, contract compatibility, and test evidence. Immediately before merging, ensure the PR includes current `main` and that the combined result has been tested. If `main` changes, update and retest the next PR before merging it.
7. **Start the next task from updated main.** After a PR merges, create a new task branch from the updated remote baseline. Do not keep stacking unrelated work onto the merged branch.

If a conflict occurs, pause only the affected merge, inspect both changes with their owners, and preserve the intended behavior of both. Never use a blanket “ours/theirs” resolution or reset away a teammate's work. Even when Git reports no conflicts, member 3 must check the integrated scenario because interface and behavior conflicts may not overlap lines.

### Example commands
Run from a clean checkout; branch names below are examples. Execute commands step by step and stop on errors or conflicts.

```sh
git fetch origin
git switch -c work/data/collector origin/main
```

After committing and testing your scoped changes, synchronize and publish the task branch:

```sh
git fetch origin
git merge origin/main
# Resolve any conflicts with the owner, then rerun the relevant checks.
git push -u origin work/data/collector
```

Open a pull request targeting `main`. Member 2 coordinates the merge; other members continue independently on their own branches.

### Remote enforcement — pending configuration
Repository-admin setup target: protect `main`, require PR review by another teammate, block force pushes/deletion, and require the actual configured CI checks against current `main` when available. Do not claim enforcement until repository settings have been inspected and enabled. No protection settings, CI workflow, or access restrictions have been configured by this planning document. Exact account identities and runnable checks must be known before configuring reviewer ownership or required checks.

## First shared checkpoint
Audience decision: prioritize walkers and first-time visitors to Astana. Walking is the default; Qadam's “step” naming rationale means nearby discovery, not fitness tracking. Member 1 prioritizes source coverage for the three core walking scenarios; member 2 makes explanations understandable without local knowledge; member 3 tests walking budgets and first-visit usefulness as well as factual grounding.

Confirmed choices: **2GIS map** and **OpenAI API**, with API credits reported available by the user. **2GIS Places API is a candidate data source**, pending feasibility and permission checks. Member 1 investigates that source; member 2 owns map and OpenAI integration and verifies usable access/model/budget; member 3 verifies the integrated behavior and updates submission evidence. Do not spend time reselecting the confirmed providers unless a concrete blocker requires a team decision.

Agree on the normalized POI format in `docs/DATA_PLAN.md`, request fields (location, preferences, budget, travel mode), and retrieval output (candidate records, source evidence, distance estimates, unknowns). Record the actual API/module contract after choosing the stack. Person 1 delivers a small real collected dataset early; Person 2 can scaffold against clearly labeled fixtures until it is ready; Person 3 prepares scenario checks immediately. Fixtures do not count as the finished RAG demo.

## Milestones
1. **Data ready:** automated collection succeeds and a validated, attributed snapshot supports at least the walking scenario.
2. **One complete flow:** a location and walking request produce retrieved, grounded recommendations through the actual UI and provider.
3. **Core scenarios verified:** add first-time visitor discovery and coffee/rest-stop cases; demonstrate changed constraints, missing evidence, no matches, and provider failure. Child-outing and other brief examples remain secondary checks.
4. **Submission ready:** clean setup, documented test results/limitations, rehearsed 5–7 minute slides, and an uploaded accessible YouTube demo.

The first goal is milestone 2. Do not delay integration until each person's entire component is finished. Schedule these milestones once the actual remaining time is known.

## Execution sequence
1. Read the supplied brief, `CASE.md`, `AGENTS.md`, and acceptance checks. Record actual deadline, team availability, and available credentials when known.
2. Choose permitted POI sources and the smallest suitable stack. Verify source access/reuse and collect enough real data for the chosen scenarios.
3. Build one full flow: location/preferences → retrieval → constrained candidates → grounded generation → understandable result.
4. Add the other core scenarios and handle missing data, no matches, invalid input, and provider failure.
5. Run acceptance checks, verify retrieval relevance with human review, and use `prompts/05_REVIEWERS.md` after the core works.
6. Consider at most two justified additions using `prompts/08_FEATURE_SELECTION_AFTER_MVP.md`.
7. Freeze features relative to the actual deadline; reserve time for clean setup, documentation, presentation rehearsal, recording, and upload.
8. Run judge simulation and final audit; record links and unresolved limitations in the submission checklist.

## Prompt index
- `09_MEMBER_1_DATA_AGENT.md`: member 1's scoped starting prompt
- `10_MEMBER_2_APP_AGENT.md`: member 2's scoped starting prompt
- `11_MEMBER_3_QA_AGENT.md`: member 3's scoped starting prompt
- `01_BUILD_LEAD.md`: implementation
- `02_QA_LEAD.md`: QA and case compliance
- `03_REPRODUCIBILITY_LEAD.md`: setup and submission evidence
- `04_FEATURE_BRAINSTORM.md`: optional ideas
- `05_REVIEWERS.md`: independent read-only review
- `06_FINAL_SUBMISSION_AUDIT.md`: freeze and deliverable audit
- `07_JUDGE_SIMULATION.md`: judge reproduction
- `08_FEATURE_SELECTION_AFTER_MVP.md`: select additions after a verified MVP

The current task only adapts rules. Implementation, presentation generation, and publishing are subsequent work; this document does not claim they are complete.
