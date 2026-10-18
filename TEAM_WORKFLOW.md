# Team workflow

## Three-person ownership
This is the proposed split for the confirmed team of three. Assign names before implementation; choose the integration lead based on backend experience.

| Person / role | Scope | Supporting prompts |
|---|---|---|
| 1 — Data and retrieval | Source verification, automated collector, normalization/provenance, snapshot, retrieval/filtering, data setup documentation | `prompts/01_BUILD_LEAD.md` with this ownership scope |
| 2 — RAG, interface, and integration lead | Request flow, generation, output validation, recommendation UI, integration and runtime configuration | `prompts/01_BUILD_LEAD.md` with this ownership scope |
| 3 — QA and submission | Test cases and evidence, factual/privacy review, clean setup, slides, rehearsal, demo recording and submission checklist | `prompts/02_QA_LEAD.md`, `prompts/03_REPRODUCIBILITY_LEAD.md` |

Coordinate file ownership before concurrent edits. Person 3 tests throughout development, prepares the presentation early, and pairs with the others to reproduce defects. Independent reviewers remain read-only; the responsible implementer fixes application defects.

## First shared checkpoint
Agree on the normalized POI format in `docs/DATA_PLAN.md`, request fields (location, preferences, budget, travel mode), and retrieval output (candidate records, source evidence, distance estimates, unknowns). Record the actual API/module contract after choosing the stack. Person 1 delivers a small real collected dataset early; Person 2 can scaffold against clearly labeled fixtures until it is ready; Person 3 prepares scenario checks immediately. Fixtures do not count as the finished RAG demo.

## Milestones
1. **Data ready:** automated collection succeeds and a validated, attributed snapshot supports at least the walking scenario.
2. **One complete flow:** a location and walking request produce retrieved, grounded recommendations through the actual UI and provider.
3. **Core scenarios verified:** add coffee and child-outing cases; demonstrate changed constraints, missing evidence, no matches, and provider failure.
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
- `01_BUILD_LEAD.md`: implementation
- `02_QA_LEAD.md`: QA and case compliance
- `03_REPRODUCIBILITY_LEAD.md`: setup and submission evidence
- `04_FEATURE_BRAINSTORM.md`: optional ideas
- `05_REVIEWERS.md`: independent read-only review
- `06_FINAL_SUBMISSION_AUDIT.md`: freeze and deliverable audit
- `07_JUDGE_SIMULATION.md`: judge reproduction
- `08_FEATURE_SELECTION_AFTER_MVP.md`: select additions after a verified MVP

The current task only adapts rules. Implementation, presentation generation, and publishing are subsequent work; this document does not claim they are complete.
