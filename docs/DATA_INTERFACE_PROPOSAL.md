# Member 1 interface proposal

Updated 2026-10-18 against code baseline `66d06f6`. Status: proposal for member 2, not the agreed application contract. Python backend was confirmed by member 1. Framework and Python minimum version remain for the integration lead to record. `docs/CONTRACTS.md` does not exist at this checkpoint. See the [offline retrieval plan](OFFLINE_RETRIEVAL_PLAN.md) and [member 2 handoff](MEMBER_2_RETRIEVAL_HANDOFF.md); this update implements no retrieval or provider calls.

## Ownership for this increment

Member 1 owns `scripts/data/`, `tests/data/`, the data plan/proposal/feasibility/handoff documents and the new offline retrieval plan/handoff. Private evidence is under ignored `data/raw/`, `data/private/` and `data/runtime/`. Production module paths and any permitted demo-snapshot paths need coordination with member 2 before parallel application edits.

No dependency is required by the source probe beyond the Python standard library. The probe does not establish a shared application schema. Member 2 owns the final types, configuration names, manifests, and application contract.

## Proposed boundary

Start with an in-process Python retrieval function over a validated local snapshot and matching reviewed annotations. No separate HTTP service, database or embedding call is needed for the first integration. Member 2 converts a form or interpreted request into explicit structured constraints; unresolved intent or hard requirements must be clarified first. Member 1 retrieves and deterministically filters/ranks. Eventual generation and output validation belong to member 2 and are outside this offline increment.

Proposed shapes: `load_snapshot(snapshot_dir, review_annotations, policy) -> Snapshot` and `retrieve(request, snapshot, policy) -> RetrievalResult`. Exact import path and Python types are pending agreement. Snapshot paths are trusted backend inputs, not browser-request fields. The immutable policy identifies the review/category rules, time assumptions and ranking rules. No `.env`, raw responses or network is needed at query time.

The current annotations do not pin an assessment-policy digest. Proposed backend policy configuration must resolve a separately reviewed private binding to the code/policy version, annotation digest and snapshot hashes; the plan describes this new metadata. Its exact layout belongs to member 2's contract. Do not mutate existing annotations or treat runtime hash calculation as review approval.

| Request field | Proposed meaning |
|---|---|
| `latitude`, `longitude` | Finite decimal degrees, explicit named fields; reject booleans, missing/non-numeric values and out-of-range values |
| `query` | Nonblank text used only for lexical ranking; transient, never logged by default; structured fields carry intent and constraints |
| `scenario` | Required `short_walk`, `first_visit` or `coffee_stop`; no arbitrary-text nearest-place fallback |
| `categories` | Optional list of agreed categories allowed in the scenario; OR within the list, empty means all scenario categories; incompatible/unknown values are invalid |
| `available_minutes` | Positive finite total budget including travel, visit, and explicit buffers |
| `travel_mode` | `walking` for the MVP; reject unsupported modes rather than silently substituting |
| `max_distance_m` | Optional positive finite straight-line radius, proposed default 2,000 m; not verified walking distance |
| `required_amenities` | List of known hard requirements; only positive sourced evidence satisfies them; unknown is excluded |
| `preferred_amenities` | Known ranking preferences; unknown earns no credit and remains visible |
| `return_to_start` | Required explicit boolean; when true, budget a return leg; UI may default true with disclosure |
| `buffer_minutes` | Nonnegative reserved time; must be smaller than the total budget |
| `limit` | Integer retrieval count with `1 <= limit <= 20`, proposed default 10; UI shows up to 3 |

Reject booleans as numbers, nonfinite values, wrong types, unknown fields/constraints, noninteger limits and unsupported modes; do not silently coerce or drop requirements. `buffer_minutes` defaults to zero; amenity lists default empty. The initial amenity vocabulary is `seating`, `quietness`, `sockets`, `accessibility`, `child_suitability`; all are unknown in the current real sample. A known hard amenity with no evidence produces `no_match`; an unsupported constraint such as verified current opening requires clarification rather than fabricated evaluation. The [plan](OFFLINE_RETRIEVAL_PLAN.md) defines proposed category/scenario semantics and policy defaults for member 2 to approve.

## POI records

Retain the fields in [DATA_PLAN.md](DATA_PLAN.md). Proposed conventions:

- `id` is a source-namespaced stable string, such as `wikidata:Q...`; keep original `source_id` separately.
- The earlier proposal requires `name`, a nonempty source description, coordinates, and at least one source-supported category/tag for demo eligibility. That gate remains a proposal; all collected records remain `demo_eligible=false`. Missing descriptions affect 69/73 records and 42/45 reviewed candidates.
- Proposed addition for member 2 approval: a separate `offline_evaluation` mode may retrieve reviewed structured-only candidates with a null description. This changes neither the originals nor demo eligibility and does not satisfy the description requirement by itself. Do not manufacture narrative descriptions to pass validation.
- Preserve genuine `source_description` and language when evidenced; absent language stays unknown, not inferred from request locale. A generated summary is separate if introduced later. Derived lexical search text is transient, not a source description.
- Optional facts use `null` for unknown. An empty contacts list must not imply that the business has no contact details. Unrecognized source values stay raw with a warning.
- An amenity has `value: true | false | null` and evidence references. `false` requires contrary evidence; missing is `null`.
- Evidence references identify record ID, source version, provenance/field, collection time and source update time or source URL only when supplied/verified. Local response paths are private evidence, not URLs; never invent a source link. Collection time is not the last time a fact was verified by its publisher.
- Staging `schedule` preserves raw source data; there is no agreed application `opening_hours` field or parser yet. Availability stays `unknown`; member 2 must not turn raw schedules into an “open now” badge.
- Cross-source duplicates require an explicit mapping. Never merge on place name alone.

## Retrieval results

Return `status: ok | no_match`, `mode: offline_evaluation`, `candidates`, fixed `reason_codes`, `warnings`, and snapshot/review/policy identifiers. No-match reason codes identify actual exclusion causes, for example `REQUIRED_AMENITY_UNVERIFIED`, `OUTSIDE_RADIUS`, `TIME_BUDGET_EXCEEDED` or `NO_REVIEWED_CATEGORY_MATCH`. Invalid inputs and unavailable/corrupt snapshots are typed errors, not successful empty results. Proposed error codes: `INVALID_INPUT`, `UNSUPPORTED_MODE`, `UNSUPPORTED_CONSTRAINT`, `DATA_UNAVAILABLE`, `DATA_INVALID`, `REVIEW_REQUIRED`, `REVIEW_STALE`. Do not echo source strings, private paths, user prompts or precise input coordinates in errors/logs. Counts/reasons must derive from actual filters; never claim a constraint was checked when it was not.

Each internal candidate contains exact `id`, `source_version`, selected `source_facts`, reviewed categories/caveats, `evidence_refs`, explicit unknowns, `demo_eligible: false`, `distance_m`, `distance_kind: straight_line`, outward/return/visit/buffer/total minute estimates and the assumptions used. Source facts come from the selected version, including name, coordinates, nullable description, source rubrics and available schedule/address. Source facts, review judgments and estimates occupy distinct fields. Preserve 2GIS attribution and collection freshness. Evidence references resolve through a private backend mapping; they do not expose raw response filenames or detailed annotations in a browser/model payload.

Include ranking factors (matched category/query terms and supported preferences) without presenting a score as a probability. Proposed order after hard filtering: supported preferred amenities, lexical token matches, full-precision distance, then stable ID; the plan specifies tie and token rules. Free text and all source strings remain untrusted data. Do not execute source instructions, follow source URLs or treat them as tool requests.

The team must agree walking speed, distance multiplier, and category visit estimates before filtering by time. Recommended initial values match the existing audit: 80 m/min, 1.3 multiplier and its per-category visits. These are versioned heuristics, never POI-source facts. If a visit estimate cannot be assigned under the agreed policy, mark it unknown and do not claim time feasibility. Use unrounded values for eligibility and ranking and round only for display.

Each candidate is an alternative. For one option, total time is outward travel + visit + explicit return estimate + buffer. A combined itinerary needs a separate calculation; summing alternative cards is not an itinerary. A hard requirement with missing evidence excludes that candidate. Return fewer candidates or `no_match` when necessary.

Proposed empty-result subset (synthetic, not a live response; full metadata omitted here):

```json
{
  "status": "no_match",
  "mode": "offline_evaluation",
  "candidates": [],
  "reason_codes": ["REQUIRED_AMENITY_UNVERIFIED"],
  "warnings": ["No candidate has sourced evidence for the required socket amenity."]
}
```

## Decisions requested from member 2

1. Record the approved schema, exact module paths, and ownership in `docs/CONTRACTS.md`.
2. Approve or revise structured-only offline evaluation, scenario/category/amenity vocabulary, time/ranking policy and candidate bound. Recommend deferring opening-hours evaluation; raw schedules remain unknown availability.
3. Prioritize saved 2GIS records as the first offline retrieval input per the user's direction, with rights and measured coverage limits in [source feasibility](DATA_SOURCE_FEASIBILITY.md). Wikidata remains a possible supplement for a separate later increment. No automatic cross-source join or new request is planned.
4. Define the eventual source-fact projection and output-ID/evidence validation for generation. This plan does not authorize sending any real source data to OpenAI or another provider.

Collector, normalization and analyst review already exist. Once the contract is agreed, member 1 implements the retrieval adapter and its tests against that boundary, preserving originals. The [plan](OFFLINE_RETRIEVAL_PLAN.md) specifies loader, hard-constraint, ranking, privacy and scenario checks. Agreement on an interface is not verification of source permissions, description completeness, demo eligibility or live RAG.
