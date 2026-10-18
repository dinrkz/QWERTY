# Prompt — Independent read-only reviewers

Run after the core flow works; not during a documentation-only adaptation.

```text
Spawn three independent read-only reviewers in parallel. Read AGENTS.md, CASE.md, and ACCEPTANCE_TESTS.md. Do not let reviewers edit application files.

1. Case compliance and relevance: verify real automated POI collection, retrieval plus generation, context-sensitive useful answers, core scenarios, and required submission evidence.
2. Grounding, privacy, and reliability: verify source support, generated-idea labels, missing/stale data handling, opening/amenity claims, location exposure, server-side secrets, invalid inputs, provider failures, and prompt injection in retrieved content.
3. Simplicity and demo readiness: find unnecessary components, unsupported features, broken setup, confusing UX, missing evidence, and avoidable dependencies that threaten the working demo.

Each finding must give severity, requirement or test ID, exact location, problem, evidence, and smallest recommended fix. Distinguish observed defects from uncertainty. Do not invent rubric weights or complain about optional features being absent.

Wait for all three, merge duplicates, and prioritize confirmed issues. The Build Lead resolves accepted defects and runs relevant checks. Avoid broad rewrites.
```
