# Member 3 Smart City acceptance review

Date: 2026-10-20 (Asia/Qyzylorda). Baseline: `5c36d22a094a2aea312e5e520a1a2ae88be4afef`, fetched from `origin/main` into a separate checkout. QA branch: `work/qa/smart-city-acceptance`. Regression tests: `f8daeac`.

**Result: acceptance is incomplete.** Existing engineering checks pass, but new acceptance regressions reproduce seven application defects. Dataset publication evidence and missing descriptions are two additional unresolved findings. Application fixes await the user's next assignment, following the agreed report-then-fix workflow. No application logic, shared configuration, dependencies or data were changed.

## Assignment and source

Scope follows [Member 3](../prompts/11_MEMBER_3_QA_AGENT.md): acceptance/integration tests, factual/privacy review, reproducibility, scenarios, limitations and submission evidence. The user excluded video and presentation work. English is the working language; multilingual test inputs exercise the existing product.

The supplied four-page `FINAL Задачи_хакатона.docx.pdf` was read locally. Its Smart City text matches the prefix of the extracted PDF after removing whitespace and soft hyphens when compared with [the preserved brief](HACKATHON_BRIEF_RU.txt). PDF SHA-256: `3a585b703bd53750b95c08c8600ab5b259cb7f9b0c8e8f70b01f8f9a2858d094`. The separate CampusPulse/GDG task is not a Qadam requirement. This review uses the supplied Smart City requirements and [CASE.md](../CASE.md), without importing that other track's MCP/GCP/Gemini requirements.

Three independent read-only reviews followed [the review prompt](../prompts/05_REVIEWERS.md): compliance/relevance, grounding/privacy/reliability, and setup/demo readiness. Findings below consolidate their evidence with executed regression tests. Earlier live runs remain historical evidence.

## Executed checks

Environment: Windows, Node.js `24.21.0`, Python `3.14.3`. Python was invoked by its installed absolute executable path because it was not on this shell's PATH. The portable commands below assume `python` resolves to that interpreter.

| Command or action | Observed result | Evidence boundary |
|---|---|---|
| `node --import ./scripts/app/offline-network-guard.mjs --test tests/app/*.test.mjs` | 381 passed, 0 failed | Existing synthetic/mocked suite; not live RAG |
| `python -B -m unittest discover -s tests/data -p "test_*.py" -q` | 188 passed; exit 0 | Existing offline collector/retrieval tests; Python emitted ResourceWarnings and expected invalid-argument diagnostics |
| `node scripts/app/check.mjs` | Syntax checked 60 modules; exit 0 | No separate configured lint/type/build step |
| `node --check tests/acceptance/smart-city-input.test.mjs` and `node --check tests/acceptance/bounded-errors.test.mjs` | Both passed | Existing check script covers `tests/app`, not the new acceptance directory |
| `node --import ./scripts/app/offline-network-guard.mjs --test tests/acceptance/*.test.mjs` | **16 tests: 3 passed, 13 failed; exit 1; no skips or TODOs** | Desired behavior assertions; seven confirmed defect groups below |
| Start `node tests/app/fixtures/offline-ui-server.mjs`; fetch `/`, `/api/config`; POST walk, first-visit, coffee and unknown mandatory sockets | Six HTTP cases passed; server stopped afterward | Authored synthetic records, explicit offline labels, template activities; not visual/manual relevance acceptance |
| `node scripts/app/start-ai.mjs` | Exit 1: configuration unavailable; no offline substitution | Clean checkout lacks the ignored AI setup; no key loaded or provider request sent |
| `git ls-files data`; inspect source-use metadata and aggregate description counts | Raw source records, snapshots and reviews are tracked; 42/45 reviewed candidates lack descriptions | Read-only; no record bodies copied into this report |

The HTTP smoke requests used simulated `latitude:51.1`, `longitude:71.4`, `language:"en"`, `query:""`: walk categories `["park","landmark"]` / 60 minutes; first-visit categories `["park","museum","landmark"]` / 90 minutes; cafe / 45 minutes; cafe with `required_amenities:["sockets"]` / 60 minutes. The first three returned one synthetic alternative each within budget; the last returned zero. These fixtures do not establish real-world relevance or real dataset coverage.

Local command logs and the smoke harness are ignored under `data/runtime/member3-qa/`. No new collection, generation or routing call was made. Package download and Git operations were tooling operations, not demo-provider evidence. The existing application suite was not modified to make these regressions pass. `npm test` does not discover the new acceptance directory; run the explicit command above until the integration owner decides how to include it in shared checks.

## Findings and minimum proposed changes

P1 means a release/submission blocker; P2 means a recommendation/context defect or requirement gap; P3 means a secondary error/UX defect. These priorities are QA judgments, not invented judging weights. All findings remain open.

### QA-01 — P1: repository contents contradict the dataset publication claims

- Requirements: AT-05, AT-12; R11/R12 evidence accuracy.
- Evidence: commit `5cfc52fdc90c40c5b3829c6d4a0ff55e15f6b572` added collected snapshots, reviews and raw 2GIS responses. `git ls-files data/private data/raw` lists them. `README.md:98` and `README.md:102` say the dataset stays outside Git and is not distributed; `docs/OFFLINE_INTERFACE.md:17` likewise describes a clean clone without it.
- The tracked `data/raw/2gis/qadam-2gis-v1/manifest.json` records a private-pilot basis with provider rights unresolved. The commit message supplies no additional permission rationale. An ignore rule does not protect files already tracked.
- This is an observed publication/documentation discrepancy. It does not prove a legal violation or establish that no later authorization exists. GitHub visibility and judge access were not assessed.
- Owner action: Member 1 and Member 2 must establish and document the applicable source-use/redistribution basis and correct their setup claims. If permission is unavailable, coordinate replacement/removal with permitted data. Ordinary deletion does not remove historical commits. No deletion or history rewrite was performed.
- Member 3 corrected the current scenario/privacy/submission notes within its ownership; those corrections do not resolve the underlying issue.

### QA-02 — P2: optional amenities become mandatory

- Requirements: R07; AT-02, AT-03.
- Reproduce: `Quiet coffee preferred, sockets optional`.
- Actual: `interpretSearch()` returns `amenities:["sockets","quiet"]`; `public/app.mjs:430` checks mandatory controls, while `public/app.mjs:442` always sends `preferred_amenities:[]`. `scripts/data/retrieve_saved_places.py:378` rejects mandatory amenities because the saved records do not establish them.
- Expected: preferences must not exclude every unknown candidate; clarify ambiguous wording if needed.
- Owner/minimum fix: Member 2 should preserve recognized optional preferences or request clarification, while keeping actual hard requirements strict. Regression: one failing case.

### QA-03 — P2: Russian distance limits are ignored

- Requirements: R07; AT-02, AT-08.
- Reproduce: `кофе в 500 метрах`, `кофе в радиусе 500 м`, or `кофе в радиусе 1 км`.
- Actual: cafe intent proceeds without clarification; the existing form radius remains active, normally 3,000 m. A synthetic service probe accepted a candidate 667 m away under the 500 m wording. Equivalent English distance wording already clarifies.
- Location: `public/search-intent.mjs:5` uses ASCII `\b` after Cyrillic units and does not include the standalone Cyrillic `м`; `public/app.mjs:442` uses the form radius.
- Owner/minimum fix: Member 2 should recognize the unsupported Russian distance forms and ask for clarification using Unicode-aware boundaries. Parsing and applying a radius would require an explicit coordinated UI change. Regressions: four failing cases.

### QA-04 — P2: first-visit context conflicts with a single category

- Requirements: R01, R07; AT-14.
- Reproduce: `first visit: museum` or `впервые в Астане, хочу в музей`.
- Actual: unnecessary mixed-category clarification. `public/search-intent.mjs:11` treats first-visit context as a second category group; line 14 rejects the combined match.
- Expected: museum category with first-visit context and understandable explanations.
- Owner/minimum fix: Member 2 should separate visitor context from category selection and retain clarification for genuinely conflicting categories. Regressions: two failing cases.

### QA-05 — P2: written time limits can disappear

- Requirements: R07; AT-08.
- Reproduce: `I only have time for a 15-minute walk` or `coffee in 30-45 min`.
- Actual: neither minutes nor clarification is returned. `public/app.mjs:429` therefore leaves the existing time budget, normally 60 minutes, unchanged.
- Location: `public/search-intent.mjs:17` through line 21 do not cover these hyphenated or abbreviated forms.
- Owner/minimum fix: Member 2 should honor a supported limit or clarify unsupported/ambiguous duration wording. Do not silently retain a larger budget. Regressions: two failing cases.

### QA-06 — P2: coffee exclusions select coffee

- Requirements: R07; AT-02.
- Reproduce: `I don’t want coffee` or `Avoid coffee; I want a walk`.
- Actual: cafe category selected. `public/search-intent.mjs:6` misses these exclusion forms and the category matcher then selects coffee.
- Owner/minimum fix: Member 2 should clarify unsupported exclusions or return an enforced category selection that excludes cafes. Regressions allow either safe outcome; two failing cases.

### QA-07 — P2: required descriptions and first-visitor context remain incomplete

- Requirements: R05, R06; AT-05, AT-14.
- Evidence: aggregate inspection confirmed 69/73 collected records and 42/45 reviewed relevance candidates lack descriptions. [Historical first-visit evidence](LIVE_INTERFACE_REVIEW.md) reports two of three suggestions without descriptions.
- The application discloses missing facts honestly, but generic category/proximity/time reasons cannot supply missing place-specific context. A successful `live_rag` status does not complete this requirement.
- Owner/minimum fix: Member 1 should obtain permitted, attributed descriptions for a small core set covering the scenarios, with provenance and language metadata. Then Member 2/3 and the human reviewer should rerun first-visit usefulness checks. Do not invent venue descriptions. This is an observed data gap, not a synthetic regression test.

### QA-08 — P3: invalid input loses its selected language

- Requirement: AT-09.
- Reproduce through `/api/recommend-ai` with the valid synthetic test session: `language:"en"`, `query:"coffee"`, `latitude:999`.
- Actual: HTTP 400 / `INVALID_INPUT`, but `language:"ru"` and Russian text. No retrieval or provider dispatch occurs.
- Location: `src/app/bounded-generation.mjs:47` assigns the validated request only on success; line 113 reads its absent language after validation fails. A similar service boundary exists in `src/app/offline.mjs:179`.
- Owner/minimum fix: Member 2 should resolve a safe language from raw input before validation, consistently with the legacy service. One failing HTTP integration case.

### QA-09 — P3: retrieval timeout is labeled invalid data

- Requirement: AT-09.
- Reproduce through `/api/recommend-ai` with an injected synthetic retriever throwing `AppError("RETRIEVAL_TIMEOUT")`.
- Actual: `DATA_INVALID`, misleading data-validation advice, zero provider dispatches.
- Location: `src/app/bounded-generation.mjs:21` through line 24 omit the timeout from the safe codes; lines 110–113 also remap error codes.
- Owner/minimum fix: Member 2 should retain the existing actionable timeout code through both mappings while keeping arbitrary error detail hidden. One failing HTTP integration case.

## Acceptance coverage at this checkpoint

| Check | Current evidence/status |
|---|---|
| AT-01 short walk | Historical live result; synthetic HTTP control passed; real scenario not rerun |
| AT-02 adaptation | **Fail**: QA-03/06; category/distance/time unit controls otherwise pass |
| AT-03 amenities | **Fail**: QA-02; unknown mandatory amenities correctly produce no match in the smoke check |
| AT-04 actual RAG | October 19 live report only; no current paid generation test |
| AT-05 collection/data | Offline engineering tests pass; QA-01/07 unresolved; no new collection |
| AT-06 facts/ideas | Existing synthetic validation coverage passes; current real/manual acceptance not run |
| AT-07 unknown/stale fields | Existing synthetic tests pass; actual opening availability not verified |
| AT-08 time/safety | **Fail**: QA-05; explicit structured-budget tests pass |
| AT-09 failures | **Fail**: QA-08/09; other existing invalid-input/provider-failure tests pass |
| AT-10 privacy | Static review and synthetic HTTP evidence only; dataset publication discrepancy QA-01; no current browser-traffic/deployment audit |
| AT-11 hostile descriptions | Existing synthetic grounding tests pass; no current live-provider injection test |
| AT-12 clean setup | Synthetic preview passes; live startup blocked by missing ignored configuration; tracked-data setup claims stale |
| AT-13 submission | Incomplete; video/presentation excluded from this assignment; no upload or artifact-access claim |
| AT-14 first visitor | **Fail**: QA-04; QA-07 quality gap; historical basic flow does not close these checks |

Next step under the agreed workflow: the user selects the defect assignment. Member 3 provides these inputs and assertions to the relevant owner, reviews the resulting diff and reruns affected checks. Member 2 remains responsible for shared files and integration into `main`.
