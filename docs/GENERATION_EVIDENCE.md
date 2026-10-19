# Local generation evidence contract and mock flow

Implemented 2026-10-19 at the user's request, based on `be891a9` on `work/data/source-feasibility`. This increment prepares and validates evidence from the existing private retrieval envelope, exercises recommendation selection with a local test double, and renders clearly labeled results. It makes no OpenAI or 2GIS requests and adds no production server route, browser mode, credential configuration or external-processing authorization.

The implementation is in [generation-evidence.mjs](../src/app/generation-evidence.mjs) and [mock-generation.mjs](../src/app/mock-generation.mjs). Python retrieval and its exact-byte policy binding are unchanged. Projection lives on the Node side after independent private-result validation, avoiding a second Python projection or changes to the saved snapshot.

## Run the authored synthetic demonstration

From the repository root:

```powershell
node scripts/app/demo-mock-generation.mjs
```

The command prints one synthetic result with `status:"mock_generation"`, `provider_calls:0` and template wording. It reads no configuration, credentials or dataset files, accepts no arguments, and imports the offline network guard. The displayed place is authored test data. This is an inspectable development demonstration, not real RAG or a recommendation-quality benchmark.

The browser at port 3002 continues to use the existing offline search. The mock service is deliberately not connected to it. A mock is not an OpenAI substitute in a live demo.

## Contract boundary

`createEvidenceSession({input,envelope,expected,now})` accepts ordinary offline form input, the `qadam-private-retrieval-v1` envelope, locally configured expected dataset/hash pins, and a server-controlled timestamp. It validates cloned inputs, so recomputing estimates cannot modify the caller's records. Existing hash, provenance, category, radius, time and hard-constraint checks remain in force. Additional rubric-ID checks ensure mapped categories match the original source rubrics.

The returned session contains a deeply frozen `packet` and local `complete`, `noMatch` and `fallback` operations. Private records, stable IDs, exact source versions and alias mappings remain inside the session closure. `complete` validates the selection and resolves it to local cards. No operation transmits anything.

### Evidence packet

| Field | Contract |
|---|---|
| `contract` | Exactly `qadam-generation-evidence-v1` |
| `mode` | Exactly `local_mock`; this version does not authorize external processing |
| `external_processing_allowed` | Always `false` |
| `context` | Explicit form fields: language, walking mode, category/amenity filters, available time, radius, return, buffer, opening/events flags and first-visit context |
| `candidates` | First zero to five already eligible candidates, preserving retrieval order |

Every candidate contains only these fields:

| Field | Meaning |
|---|---|
| `alias` | Fresh request UUID plus candidate position; no stable source ID |
| `name`, `description`, `description_language` | Source name and nullable description/language; no invented replacement |
| `categories`, `fine_categories`, `category_kind` | Mappings checked against source rubric IDs; kind is `mapped_from_source_rubrics`, not a verbatim publisher claim |
| `estimates` | `kind:"heuristic_not_walking_route"`, distance rounded to 50 metres, outward travel rounded up to minutes, category visit estimate, total rounded up to minutes |
| `unknowns` | Opening hours, amenities, seating, access, operating status and source-update time remain unknown |
| `evidence` | Candidate-specific `{ref,field,kind}` entries for name, categories, estimates, and description only when present |
| `allowed_reason_codes` | Nearby, fits-time, matching selected category; first-visit description reason only when requested and a description exists |
| `allowed_activity_codes` | Existing category-specific observe/stroll/coffee-break/museum-visit vocabulary; no events from these records |

Evidence kinds distinguish source text, mapped categories and computed estimates. Internally each reference resolves to exact source-version and source-field evidence; mapped categories and estimates also bind the retrieval policy. An evidence reference is not permission to invent a factual sentence.

Bounds: 24 KiB UTF-8 serialized packet, five candidates, names up to 1,000 Unicode code points, descriptions up to 4,000. An oversized packet/description fails with `DATA_INVALID` before mock dispatch; source text is not silently truncated. Eligibility uses full-precision calculations before projected/display rounding. Rounded totals need not equal rounded component sums; local cards retain the existing consistent display policy.

No structured coordinates, raw query, lexical terms, stable IDs, snapshot/review/policy hashes, source URLs, raw hours, contacts, reviewer prose, file paths or credentials enter the packet. Missing source links remain null in local cards. Names and descriptions may themselves identify places or contain location text: field minimization and aliases are not anonymization. No raw packet is written by the service or private verifier.

### Mock selection output

The exact output shape is:

```json
{
  "recommendations": [
    {
      "candidate_alias": "current-request:c1",
      "evidence_refs": ["current-request:c1:name", "current-request:c1:categories", "current-request:c1:estimates"],
      "reason_codes": ["nearby", "fits_time"],
      "activity_code": "coffee_break"
    }
  ]
}
```

Aliases here are illustrative; actual aliases must exactly match the current session packet. Output may be a JSON string or JSON-compatible object, bounded to 8 KiB. A nonempty packet requires one to three unique selections. The validator rejects extra keys/prose, invented IDs, a sixth unprojected candidate, previous-session aliases, duplicate selections/references/reasons, foreign evidence and unsupported reasons/activities.

Each selection requires name evidence for identity and category evidence for its activity. `nearby` and `fits_time` additionally require computed-estimate evidence; `interest` needs a matching selected category; `first_visit` needs description evidence. Each selection has one or two reasons and two to four evidence references. No evidence kind supports claims about quietness, sockets, current opening, accessibility, confirmed seating or historical importance.

The local presenter resolves names, source metadata, source-version evidence, caveats and reviewer judgments from validated records. Model-style output cannot supply those values. Reasons and conditional activities use RU/KK/EN templates. Missing descriptions, source URLs, language and source-update dates remain missing.

## Mock service behavior

`createMockGenerationService({retrieve,expected,mock?,now?,timeoutMs?})` returns a local async recommendation function. The path is validated form → existing Python-compatible retrieval → private validation/projection → one local mock invocation → selection validation → local presentation. Empty/invalid results never invoke the mock. Free text is lexical ranking only; structured controls carry hard constraints.

The default `selectForLocalMock` is a deterministic test double selecting up to three candidates. It is not a language model and does not establish recommendation relevance. Custom injected mock functions are allowed only when expected dataset kind is synthetic. Collected records always use the fixed built-in implementation. A supplied function is trusted test code, not a sandbox; tests run under the offline network guard. The deeply frozen packet has no shared mutable references to retained evidence or fallback records.

Mock timeout defaults to one second and is configurable from 1–15,000 ms by trusted test code. There are no retries. Promise timeout bounds the wait for an async mock, not CPU execution by arbitrary test code. No persistent provider-attempt ledger is needed or implemented in this local-only increment.

| Result | Meaning |
|---|---|
| `mock_generation` | Validated local mock selection; activity kind `mock_template_suggestion` |
| `mock_no_match` | Empty eligible set; zero mock/provider calls |
| `mock_retrieval_only` | One mock attempt failed, timed out or returned invalid output; existing retrieval-only template cards |
| `error` | Input, retrieval or projection failed before dispatch; existing bounded error response |

Successful/no-match/fallback results include `generation.mode:"local_mock"`, outcome, mock-call count, `provider_calls:0`, bounded failure code and false processing permission. Dataset `demo_eligible` and `external_processing_allowed` stay false. Errors do not expose untrusted exception messages. No result from this flow is labeled `live_rag`.

## Verification and private evaluation

```powershell
node --import ./scripts/app/offline-network-guard.mjs --test tests/app/*.test.mjs
python -B -m unittest discover -s tests/data -p "test_*.py" -q
python scripts/data/verify_retrieval_bridge.py --app-root . --node "C:/Program Files/nodejs/node.exe"
node scripts/app/check.mjs
node scripts/app/verify-offline.mjs --with-mock-generation
```

The last command requires the existing ignored offline configuration and authorized local data. It reuses the 45-scenario matrix and Python adapter, compares mock results with normal offline results, verifies eight source/review/binding/accounting files are unchanged, and prints only aggregate counts. Mock calls are local functions; the helper does not mount them on the HTTP server. Its HTTP traffic is loopback-only. A sandbox must permit loopback/subprocess execution; external provider requests remain blocked. An optional configuration path may follow the flag.

Verification on 2026-10-19: **295 application tests (45 new evidence/mock tests), 188 Python tests, 63 Node–Python bridge checks (48 estimate cases), and syntax checks for 32 JavaScript modules passed**. The synthetic CLI demonstration also passed. The private matrix passed **45 normal offline and 45 corresponding mock cases**, with 16 local mock invocations, 29 empty cases, eight unchanged files and **zero external requests**. Three independent read-only reviewers found no actionable issues and each reran the 45 focused tests.

These checks provide engineering evidence, not completion of live RAG, source permissions, description coverage, recommendation quality or full hackathon acceptance. The handoff still reports 42/45 candidate descriptions missing.

## Member 2 handoff and remaining work

This user-authorized increment adds scoped Node modules/tests, a synthetic demo and documentation. No Python/core policy, existing private/live validators, production server, browser, dependencies or environment-variable contracts changed. The contract is implemented for local mocks; live adoption remains an integration decision.

For a later external path, member 2 must explicitly implement and test a separate authorization/transport boundary, reviewed payload disclosure, model configuration, persistent bounded attempt accounting, no-retry behavior and live output labels. Do not pass a mock packet to OpenAI, turn its false flag true, or wire an arbitrary callback to collected data. Retain the existing strict live/private boundaries and local-only mode. [The broader integration plan](SAVED_PLACES_RAG_PLAN.md) describes quality review and a future pilot; it grants no requests.

Member 1 supplies data/evidence semantics and private aggregate evaluation; member 2 owns live contract/service/UI integration; member 3 owns independent acceptance and submission evidence. Source enrichment, free-text interpretation and generated factual prose remain separate work. Keep private records/configuration outside Git and public screenshots; share code, authored fixtures and aggregate verification only.
