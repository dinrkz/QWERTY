# Member 2 — RAG/application handoff

Date: 2026-10-18. Branch: `work/app/rag-interface`, baseline `origin/main` 155b7e4. Resolve the final deliverable commit with `git log -1 --format=%H -- docs/MEMBER_2_HANDOFF.md`. Human review is pending. This increment does not claim a finished live RAG demo or submission.

## Completed scope

- Read all current root/project documents and prompts (excluding superseded `old/`), original Russian brief and member 1's remote source-feasibility/interface/handoff documents at 559b6e7.
- User approved Node.js + JavaScript for member 2 and chose to configure an existing OpenAI key locally. Defined a JSON process boundary preserving member 1's Python work. Member 1 acceptance/implementation of the contract is pending.
- Local HTTP application and RU/KK/EN interface: three walking scenarios, manual/simulated location, explicit optional device location, time/radius/return/buffer and hard amenity/opening/event filters, source/idea/estimate/unknown labels, opt-in 2GIS adapter.
- Real OpenAI Responses adapters for interpretation and structured recommendation composition. `store:false`, bounded output, fixed provider endpoint, no retries, typed failures. No real API call has run.
- Deterministic validation of inputs and member 1's output: stable IDs, provenance, timestamps, source URLs, required attributes, access/closure, arrival plus visit schedule/event intervals, distance/time constraints. A known bad batch fails closed. Unknown fields never satisfy a hard requirement.
- Grounding by retrieved IDs, description evidence IDs, verified reason codes and category-specific activity codes. Factual text/URLs come from source records. Source instructions cannot expand the output vocabulary. Conditional activity ideas avoid access promises.
- Localized templates render the model's composition. Original POI descriptions are shown with source attribution; they are not translated. This is not fine-tuning or unrestricted conversational prose. Human assessment of relevance and language quality remains essential.
- Explicit retrieval-only fallback after generation failure. No invented POIs for empty results. Normal runtime rejects synthetic datasets; test-only injection can render a prominent `synthetic_test` state.

## Changed paths and ownership

Member 2 changes: `.gitignore`, `.env.example`, `package.json`, `package-lock.json`, `README.md`, implementation-status sentences in `CASE.md`, `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, this file, `src/shared/`, `src/app/`, `src/server.mjs`, `public/`, `scripts/app/check.mjs`, `tests/app/`.

No member 1 collector/retrieval/data files or member 3 acceptance/submission files were modified. UI and member 2 unit-test work used separate worktrees/branches; they were integrated into this task branch, never directly into main. Root independently reran the combined checks after integration. Remote protection/reviewer/CI enforcement has not been verified.

## Interface, configuration, dependencies

See [CONTRACTS.md](CONTRACTS.md) for the complete versioned schema. The app needs a bounded JSON retrieval process rather than an in-process Python import; no HTTP data service or database is needed. New requirements for member 1 review: snapshot ID/kind/date; evidence IDs and per-field references; access/operating status; normalized source-backed hours intervals; dated event records; `now`, language, interpreted query terms, opening/event filters. Raw unknown hours are allowed and remain unknown.

Time policy: Haversine, factor 1.3, 4 km/h (2.5 km/h under wheelchair requirement), maximum category visit duration, explicit return and buffer. This policy is heuristic and conservative, not an organizer requirement or routing claim. Freshness thresholds (hours 7 days, events 48 hours, amenities/access 30 days) likewise are disclosed implementation choices. Python calculations should match the shared policy tolerance.

Runtime: Node.js >=22.14.0, no third-party npm dependencies. Configuration: `OPENAI_API_KEY`, `OPENAI_MODEL`, `QADAM_MAP_PUBLIC_KEY`, `QADAM_RETRIEVAL_COMMAND`, `PORT`. The model is explicit with no assumed account access or balance. Browser map configuration accepts only a separate public-use key; known OpenAI-key reuse is rejected. The retrieval child receives an allowlisted environment, not provider credentials, and must not log its inputs.

## Verification evidence

Run on Windows with Node.js v24.21.0:

| Check | Result |
|---|---|
| `npm.cmd ci --ignore-scripts --offline` | PASS; dependency-free lockfile installs offline |
| `npm.cmd test -- --test-reporter=spec` | PASS; 205 tests, 0 failures/cancelled/skipped |
| `npm.cmd run check` | PASS; syntax checked 20 JavaScript modules |
| `git diff --check` | PASS |
| `npm.cmd start` | PASS; loopback app available at 127.0.0.1:3000 with missing configuration handled honestly |
| Chrome, actual local server, simulated input | PASS; missing data state, no fabricated recommendations |
| Chrome, UI unit harness, synthetic candidate and provider doubles | PASS; prominent synthetic banner, source description/links/date, conditional idea, distance/time/unknowns, RU and EN result rendering |
| UI agent Chrome checks | PASS; RU/KK/EN switching, unavailable config, opt-in missing-map-key state; 127 translation keys and 55 HTML keys checked |

Unit scope includes invalid inputs and language prototypes; interpretation merge rules; dates/provenance; unknown/false/stale hard amenities; time/return/buffer; hours and events at arrival plus full visit; non-retrieved/duplicate IDs; source prompt-injection containment; OpenAI request redaction/schema/storage flags/refusal/rate-limit/timeout/malformed output; process timeout/size/secret stripping; HTTP origin/Host/static allowlist/body limits/concurrency; no-match and truthful failure states. Tests use synthetic records or doubles, never the brief's illustrative venues.

Independent read-only review found null-body handling, inherited language keys, and a misleading candidate-count warning. All were fixed; regression tests pass. No valid tests were relaxed to hide application defects. An incorrect test assumption that every error must be Russian was corrected to the detected request language.

No separate linter/type checker/compiler/bundler is configured. The syntax check is not described as those checks. Full clean-machine setup, mobile viewport, real browser provider traffic, device-permission denial, map operation and human recommendation quality remain unverified. Project AT-01–AT-14 remain specifications pending member 3's integrated evidence; these unit checks do not mark them passed.

## Blocking dependencies and next handoff

1. Member 1 reviews the contract, resolves 2GIS source access/rights, provides automated collection, a permitted real POI snapshot and the retrieval JSON adapter. This branch contains no real dataset and no live event feed. Accessibility/events are implemented evidence-handling paths, not verified city coverage.
2. User/team configures the existing key, selects an account-accessible structured-output model, verifies budget and configures a restricted browser-use 2GIS key. No `.env.local` existed at the recorded runtime check; no secret was created or written by this task.
3. Member 2 runs real interpretation → collected-data retrieval → generation and checks latency/model compatibility on safe simulated inputs after those dependencies exist. Current API behavior has only been exercised through doubles.
4. Member 3 independently evaluates real relevance, short useful explanations, RU/KK/EN understanding, unknown/closed/stale cases, privacy/provider traffic and clean setup; updates its assigned evidence/submission artifacts. Human bilingual review is pending, especially Kazakh phrasing and foreign-language source descriptions.
5. Obtain another teammate's PR review before serial integration into current main. No direct main push, force push or history rewrite. Slides/PDF, scenario-results document, uploaded YouTube demo and final submission remain pending.

The final response/PR carries the exact final commit and publication outcome; this document does not assert a PR/merge happened before it was verified.
