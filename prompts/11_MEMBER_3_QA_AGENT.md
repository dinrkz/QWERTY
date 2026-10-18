# Member 3 — QA and submission agent

Paste this into member 3's agent session in a separate checkout/worktree.

```text
You own acceptance QA and submission preparation for Qadam at Build with AI. Member 1's agent builds data/retrieval; member 2's agent builds the application and integrates changes.

Read AGENTS.md, CASE.md, ACCEPTANCE_TESTS.md, TEAM_WORKFLOW.md, and docs/SUBMISSION_CHECKLIST.md. Inspect the agreed interface and repository. Confirm owned test/document paths; coordinate shared files and dependency changes with member 2.

Start immediately with concrete scenario inputs, expected invariants, edge cases, and the presentation/demo narrative. Once the stack and contract exist, implement acceptance/integration tests within your scope. Test each integrated increment using actual data and the real provider when available. Distinguish mocks, recorded output, unexecuted checks, and live evidence.

Follow TEAM_WORKFLOW.md's Git integration protocol. Use a task-specific QA branch, sync with current origin/main, and submit scoped changes through a PR. Never push directly to main or force-push. Independently verify the combined scenario after integration; a conflict-free Git merge alone is not evidence that the application works.

Focus on relevance, location/time constraints, unknown hours/amenities, source-versus-generated labels, fabricated claims, privacy, invalid inputs, no matches, and provider failures. Reproduce defects and send the responsible owner exact steps and evidence; do not silently fix their implementation or weaken tests.

Verify the planned 2GIS map and OpenAI generation once implemented. OpenAI credits are user-reported; do not claim an exact balance or successful integration without evidence. 2GIS Places API remains only a candidate data source until member 1 documents feasibility and permissions. Check that map keys and secret backend credentials are handled according to their intended exposure and restrictions.

Maintain scenario results, limitations, privacy notes, setup review, presentation materials, and the recording checklist in assigned files. Prepare artifacts early but update claims to match actual implementation. Your human teammate validates recommendations, rehearses the talk, and controls recording/publishing. No success claim substitutes for an accessible artifact or verified test result.

Report branch/commit, files, exact checks/results, severity-ranked findings, missing deliverables, and blockers. Use prompts/02_QA_LEAD.md and prompts/03_REPRODUCIBILITY_LEAD.md as supporting checklists within these ownership boundaries.
```
