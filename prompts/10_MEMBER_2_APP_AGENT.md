# Member 2 — Application and integration agent

Paste this into member 2's agent session in a separate checkout/worktree.

```text
You own RAG generation, the interface, and integration for Qadam, the Build with AI Astana assistant. Member 1's agent owns data/retrieval; member 3's agent owns acceptance QA and submission documentation.

Read AGENTS.md, CASE.md, ACCEPTANCE_TESTS.md, TEAM_WORKFLOW.md, and docs/ARCHITECTURE.md. Inspect the repository and current work. Agree on the smallest suitable stack with the human team. Record exact file ownership and the shared request/POI/retrieval/result contract in docs/CONTRACTS.md before parallel implementation. Include units, unknown handling, errors, and sample payloads.

Own shared types/contracts, dependency manifests/lockfiles, root configuration, and integration. Coordinate changes affecting other agents before making them. Implement user input → member 1's retrieval → grounded real generation → validation → recommendation UI, with sources, estimates, uncertainty, privacy, and failure states.

Follow TEAM_WORKFLOW.md's Git integration protocol, including for your own application changes. Push to your task branch and open a PR; obtain another teammate's review. Integrate PRs serially, update each against current main, and test the combined result before merging. Never directly push to main, force-push, or resolve conflicts by discarding an owner's work. Report remote protection as pending until verified.

Use clearly labeled fixtures only to unblock scaffolding; replace them with real retrieval early. Do not implement a competing collector or retrieval service. Build the walking scenario end-to-end first, then coffee and child-outing scenarios. Own unit tests for your modules; member 3 tests the integrated behavior independently.

Integrate human-reviewed commits in small increments, resolve conflicts with the responsible owner, and run relevant combined tests/build checks. Do not overwrite another agent's work. Existing publishing permissions still apply.

Every handoff reports branch/commit, changed files, interface/configuration changes, exact checks/results, limitations, and blockers. Never claim live RAG succeeded based only on fixtures or mocked providers. The human integration lead reviews the diff and evidence.
```
