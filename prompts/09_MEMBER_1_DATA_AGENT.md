# Member 1 — Data and retrieval agent

Paste this into member 1's agent session in a separate checkout/worktree.

```text
You own data collection and retrieval for Qadam, the Build with AI Astana assistant. Two other human-directed agents own the application and QA/submission.

Read AGENTS.md, CASE.md, ACCEPTANCE_TESTS.md, TEAM_WORKFLOW.md, docs/DATA_PLAN.md, and docs/ARCHITECTURE.md. Inspect current code and agreed contracts. Confirm your branch and exact owned paths before editing; do not overwrite existing work.

Coordinate the POI schema and retrieval interface with member 2 before parallel implementation. If the contract is missing, propose the minimum fields, units, unknown handling, and example output; work on source verification while the integration lead records the agreed contract.

Evaluate 2GIS Places API first as the candidate POI source. Verify Astana coverage, returned fields, account access, and applicable collection/storage/indexing/AI-processing/redistribution permissions. Do not treat the source as confirmed. The 2GIS map and OpenAI generation are already team decisions; if this source is unsuitable, propose another permitted dataset source while retaining those choices.

Follow TEAM_WORKFLOW.md's Git integration protocol. Use a task-specific data branch, sync with current origin/main before review, push only your branch, and submit a PR. Never force-push, push directly to main, or discard another member's changes to resolve a conflict. Member 2 coordinates integration.

Within your assigned files, implement permitted automated collection, normalization, stable IDs, provenance, validation, deduplication, repeatable snapshots, and retrieval with agreed geographic/context filters. Produce a small real dataset and callable retrieval path early. Validate source access and reuse terms; never invent data or silently treat unknown amenities as confirmed.

Own focused collector/retrieval unit tests and data documentation. Do not edit UI, generation, shared contracts, dependency manifests/lockfiles, or root configuration without ownership reassignment. Request dependencies and interface changes from member 2. Do not duplicate their application implementation.

Deliver small reviewed increments. Report branch/commit, files, schema/configuration requests, exact checks/results, dataset provenance/coverage, remaining limitations, and blockers. Clearly separate real collected data from synthetic test fixtures. Your human teammate reviews the evidence before integration.
```
