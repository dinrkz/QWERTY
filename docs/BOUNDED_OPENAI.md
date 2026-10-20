# Bounded OpenAI connection

**Current follow-up:** [LIVE_INTERFACE_REVIEW.md](LIVE_INTERFACE_REVIEW.md) records all three successful real browser scenarios and eight historical attempts. [BOUNDED_INTERFACE.md](BOUNDED_INTERFACE.md) documents direct main-button RAG and its separately prepared interactive allowance. The sections below preserve the earlier connector-only checkpoint; no-live-call, unmounted-interface, pending-activation and 15-second statements are historical. Current explicit authorizations may allow up to 60 seconds; original ledgers were not reset.

Implemented locally on 2026-10-19, based on commit `54efe58`. This increment is uncommitted. The backend connector is disabled by default and is **not mounted on either server launcher or the browser interface**. Tests use authored synthetic records and a fake HTTP responder. No OpenAI, 2GIS or other external API requests were made for this increment; no credential, model access, balance or provider compatibility check was performed.

This follows [the evidence contract](GENERATION_EVIDENCE.md) and [saved-places integration plan](SAVED_PLACES_RAG_PLAN.md). The original private data, review, accounting and false eligibility flags are preserved. There is no collected-data authorization or real request budget initialized by this work.

## Implemented limits

| Boundary | Behavior |
|---|---|
| Persistent attempt ceiling | Explicit authorizations allow 1–100 attempts; pilot defaults remain three. Existing manifests retain their original caps. The current AI-default successor allows 100 and retains 11 earlier attempts. |
| Concurrency | One in-flight request per shared budget directory, across service instances and processes |
| Retries | None, including HTTP 429, timeouts, redirects and invalid output |
| Reservation | Exclusive, flushed reservation file before dispatch; every reservation stays counted, even if dispatch never happens |
| Restart | Existing manifest and slots are reused; missing, mismatched or corrupt state blocks dispatch |
| Unknown outcome | Network error, timeout, interrupted body or response exceeding the byte limit keeps the run locked |
| Output/time | At most 1,800 output tokens and 15 seconds per attempt; authorization can choose lower bounds (minimum 128 tokens / 10 ms) |
| Payload | At most five candidates, 24 KiB evidence packet, 32 KiB full request body |
| Response | 256 KiB streamed response, 8 KiB selection; strict alias, evidence and allowed-code validation |
| Destination | Fixed Responses endpoint, redirect rejection, `store:false`, no model tools |

These are attempt and size limits, not a verified monetary allowance. Model token accounting, prices, access and provider handling remain unverified. A local timeout cannot guarantee that remote work or billing stopped. The lock prevents subsequent attempts in that run when the outcome is uncertain.

The cap belongs to one explicitly initialized directory and its authorization hash. All callers in a pilot must share it. Trusted operators must preserve it: creating another directory or manually modifying/deleting files could bypass local accounting. This is not an account-wide quota or protection against a local administrator. There is no automatic reset, stale-lock clearing, refund or recovery command. Stop and review an uncertain run before any later explicitly authorized work; do not delete its lock or ledger to continue.

## Service and authorization contract

`createBoundedGenerationService({retrieve, expected, enabled=false, authorization=null, budgetDirectory=null, model='', apiKey='', now?})` returns a recommendation function using the existing offline structured input. Server code supplies configuration; browser input cannot enable generation or set the model, authorization, paths or clock. The function does not read environment variables or files containing credentials. A separate `testFetch` argument is allowed only with synthetic records and labels all results as tests; collected records require the default transport.

Flow: validate input/configuration/authorization → local retrieval → validate private envelope and project evidence → check exact approved records/versions → reserve persistent slot → recheck expiry → one transport call → validate selection → render local cards → persist aggregate outcome. Empty results do not reserve a slot or call the provider. Free text remains local retrieval input; this service makes no interpretation request.

The private authorization object has exactly these fields:

| Field | Required value |
|---|---|
| `schema_version`, `provider`, `purpose` | `1`, `openai`, `walking_recommendations` |
| `model` | Explicit selected model, matching service configuration; no default model |
| `expected` | Exact `dataset_kind`, `snapshot_id`, `review_id`, `binding_id`, `policy_id`; hashes are 64 lowercase hex characters |
| `records` | 1–100 distinct `{id, source_version}` entries; every projected candidate/version must be approved |
| `fields` | `name`, `categories`, `estimates`, optionally `description`; no other fields |
| `expires_at` | Future timezone-qualified instant, checked before and after retrieval and after reservation |
| `decision` | `{operator_approved:true, source_use_basis:...}` with a nonempty recorded basis |
| `limits` | `{max_attempts, max_output_tokens, timeout_ms}` within the limits above |

`checkGenerationAuthorization` produces a canonical SHA-256 binding and budget specification. `initializeRequestBudget(absoluteDirectory, specification)` creates a new directory exclusively; its parent must exist. It never resets an existing directory and is not called automatically during recommendation requests. Initialization is a separate trusted operator step for a later approved pilot. No real activation command or authorization file is supplied here. The [synthetic fixture](../tests/app/fixtures/bounded-provider.mjs) demonstrates the exact object without private IDs or secrets.

The decision records an operator's stated basis; code cannot establish source-use rights. Saved 2GIS processing/redistribution permissions remain unresolved, and no permission is inferred from possession of an API key. A later provider transfer requires a separately reviewed decision and explicit activation. Original `demo_eligible=false` and `external_processing_allowed=false` remain historical dataset metadata; they are never rewritten as approval.

## Outbound evidence and local storage

The outgoing contract is `qadam-openai-evidence-v1`, separate from the local-only mock packet. It includes selected structured preferences, time/return/buffer context, fresh per-request aliases, names, source-backed categories, coarse estimates, explicit unknowns and allowed evidence/reason/activity codes. Only an approved existing description is eligible; opting out also removes its evidence and `first_visit` reason. Missing descriptions/languages remain null. The session retains stable IDs, source versions and attribution locally for validation and presentation.

No full snapshot, precise user/POI coordinate fields, raw query, lexical terms, stable IDs, private paths, source URLs, reviewer prose, raw hours, contacts, ratings or credentials enter the evidence body. Names, descriptions and relative distances can still identify places and the area: minimization and aliases are not anonymity. A real call necessarily discloses its selected facts/context to OpenAI. `store:false` does not establish zero retention; current official documentation and account settings must be checked before activation.

Budget files contain only the authorization hash and limits, numbered reservations with timestamps, an active lock, and outcome codes with optional numeric token usage. No key, raw prompt/response, place name, coordinate or request text is logged. The authorization object itself contains private record IDs and must remain in ignored local configuration. Keep any later real ledger under ignored `data/runtime/`, with local access restrictions. Tests and the synthetic demo create only authored synthetic ledgers there.

## Results and failure behavior

| Status | Meaning |
|---|---|
| `live_rag` | Only after collected evidence receives a valid real provider selection; AI selects alternatives, application templates render wording |
| `synthetic_provider_test` | Injected fake responder with authored records; never live RAG |
| `retrieval_only` | Valid local candidates but provider, authorization or budget blocked/failed; activity ideas are templates |
| `no_match` | No eligible candidates; no reservation or provider request |
| `error` | Invalid input, configuration or data before a usable session |

`generation` reports mode, outcome, attempt number, this invocation's `reserved_attempts` and `dispatch_attempts`, `external_requests` attempted, and a bounded failure code. These are invocation counts, not remaining account quota; the persistent slots are the run accounting. A pre-dispatch expiry can consume one reservation while dispatch remains zero. Provider/network exception text is never returned. Invalid aliases, foreign/omitted evidence, duplicate selections or arbitrary factual prose are rejected. Existing deterministic filters and unknown-field rules still apply.

Completed HTTP failures or fully read invalid/refused responses consume their slot and release the lock. Uncertain outcomes retain it; interrupted outcome writes also block further dispatch. No fallback is labeled successful AI generation. No unrestricted model-written factual prose, new descriptions, routing or free-text interpretation is added.

## Offline verification

Run from the project root; no installation or provider configuration is needed:

```powershell
node --import ./scripts/app/offline-network-guard.mjs --test tests/app/bounded-generation.test.mjs
node scripts/app/demo-bounded-generation.mjs
node --import ./scripts/app/offline-network-guard.mjs --test tests/app/*.test.mjs
python -B -m unittest discover -s tests/data -p "test_*.py" -q
python -B scripts/data/verify_retrieval_bridge.py --app-root . --node "C:/Program Files/nodejs/node.exe"
node scripts/app/check.mjs
```

The demo takes no arguments, reads no credentials/configuration/private data and imports the offline network guard. It retains a new synthetic ledger under `data/runtime/bounded-generation-demo/`, performs three fake responses, and proves the fourth is blocked. The wider application suite uses loopback HTTP; the external network guard stays enabled. Tests cover expiry, lower limits, restart/concurrent-process accounting, reservation/outcome write failures, payload minimization, description opt-out, malformed/refused output, timeouts and broken streams.

Final verification on 2026-10-19: **339 application tests (44 new connector tests), 188 Python tests, 63 Node–Python bridge checks and syntax checks for 40 JavaScript modules passed**. The synthetic demo completed three fake responses and blocked the fourth with `BUDGET_EXHAUSTED`; zero external requests. Documentation checks passed for six documents and 53 local links, including fenced JSON examples.

Private-data regression used the existing `verify-offline.mjs --with-mock-generation` matrix and aggregate hash comparison: **45 offline plus 45 corresponding local mock cases passed**, with 16 local mock invocations, 29 empty cases and **eight original source/review/binding/accounting files unchanged**. This check does not send private evidence to the new connector. No provider credentials or real authorization were used.

Three independent read-only reviewers inspected accounting, privacy/grounding and offline behavior/documentation. Fixed findings: broken response streams now keep the lock; ledger inspection now occurs after exclusive lock acquisition, avoiding a race with another process finishing its outcome. The two concurrency tests passed five consecutive reviewer runs (10/10 executions) after the fix. Final reviews reported no unresolved code findings; the stale next-step documentation was corrected. These checks do not establish live provider compatibility, recommendation quality or source-use permission.

## Integration handoff and remaining work

New modules: [authorization/projector](../src/app/generation-authorization.mjs), [request budget](../src/app/request-budget.mjs), [transport](../src/app/evidence-openai.mjs), [bounded service](../src/app/bounded-generation.mjs). Tests and retained helpers: [focused suite](../tests/app/bounded-generation.test.mjs), [provider fixture](../tests/app/fixtures/bounded-provider.mjs), [process-race fixture](../tests/app/fixtures/budget-race.mjs), [synthetic demo](../scripts/app/demo-bounded-generation.mjs).

Member 2's next integration task is to review this contract, add an explicit disabled-by-default server/UI path with selected-evidence disclosure, and preserve the independent offline launcher. No server, browser, Python policy, dependency or environment-variable contract changed here. **The legacy `npm start` pipeline does not use this budget and may make two calls per search; these new limits do not govern it.** Do not use that legacy path to activate private saved-place RAG.

Before a live pilot: verify current provider/model compatibility and account handling, prepare a reviewed local transfer decision and payload preview, select an explicit small attempt allowance, and obtain authorization to activate that specific run. Those steps are pending, not requests performed by this implementation. Description coverage, real recommendation quality, source permissions and full hackathon acceptance remain unresolved. No commit, push, PR update or dataset publication is part of this increment.
