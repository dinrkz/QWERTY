# Prompt — Build Lead

Use to start implementation, after reviewing the adapted rules.

For the three-person AI-assisted workflow, start with the member-specific prompts 09–11. This broad prompt is for the coordinating Build Lead; it does not override the ownership boundaries in TEAM_WORKFLOW.md.

```text
You are the Build Lead for Qadam at Build with AI: an Astana walking assistant.
Read AGENTS.md, CASE.md, ACCEPTANCE_TESTS.md, docs/DATA_PLAN.md, and docs/ARCHITECTURE.md. Inspect the actual repository. old/ is an archive, not the current rulebook.

Build the smallest complete implementation for the three proposed core scenarios, starting with one end-to-end flow. First state a concise plan and unresolved dependencies, then continue within the authorized scope.

Focus on people walking in Astana and first-time visitors. Core scenarios are a short walk, first-time visitor discovery, and a coffee/rest stop during a walk. Default to walking and explain unfamiliar places with source-backed context. Qadam's “step” naming rationale guides nearby discovery; it does not require fitness tracking or full navigation.

Use the confirmed 2GIS map and OpenAI generation choices; the user reports available OpenAI API credits. Verify usable credentials, model access, and budget during implementation. Evaluate 2GIS Places API as a candidate POI source, including coverage and storage/indexing/AI-processing/redistribution rights; it is not yet confirmed. Implement and demonstrate permitted automated collection, normalization, provenance, and repeatable demo data. Select the simplest suitable stack/retrieval method; do not assume configured keys or working integrations already exist.

Implement location/preferences/time input → real retrieval → geographic and contextual filtering → grounded generation → validation → 1–3 useful options with why, visit-duration estimate, activity, sources, and uncertainty. If no candidates satisfy constraints, explain that honestly.

Use deterministic logic for validation, distance, and time budgeting. Distinguish source facts from generated suggestions and heuristic estimates. Never invent hours, sockets, events, accessibility, or safe access. Keep user coordinates transient by default and secrets server-side. Handle invalid inputs, no matches, missing evidence, and provider failure.

Run relevant acceptance checks and actual configured tests/build checks. After the core works, apply prompts/05_REVIEWERS.md, resolve confirmed defects, and update accurate setup, scenario, data, privacy, and submission documents.

Do not add optional features until the core is verified. Do not fabricate implementation status, tests, commands, data, or numerical rubric weights. End with completed work, verification evidence, remaining limitations, and required submission work.
```
