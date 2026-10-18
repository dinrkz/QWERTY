# Member 1 interface proposal

Status: proposal for member 2, not the agreed application contract. Python backend was confirmed by member 1 on 2026-10-18. Framework and Python minimum version remain for the integration lead to record. `docs/CONTRACTS.md` does not exist at this checkpoint.

## Ownership for this increment

Member 1 owns `scripts/data/`, `tests/data/`, `docs/DATA_PLAN.md`, this proposal, `docs/DATA_SOURCE_FEASIBILITY.md`, and `docs/MEMBER_1_HANDOFF.md`. Local exploratory evidence is under ignored `data/raw/`. Production module paths and redistributable snapshot paths need coordination with member 2 before parallel application edits.

No dependency is required by the source probe beyond the Python standard library. The probe does not establish a shared application schema. Member 2 owns the final types, configuration names, manifests, and application contract.

## Proposed boundary

Start with an in-process Python retrieval function over a validated local snapshot. No separate HTTP service or database is needed for the first integration. Member 2 interprets the user request into structured constraints; member 1 retrieves and deterministically filters/ranks. Member 2 generates and validates grounded explanations.

Proposed shape: `retrieve(request, snapshot) -> RetrievalResult`. Exact import path and Python types are pending agreement.

| Request field | Proposed meaning |
|---|---|
| `latitude`, `longitude` | Finite decimal degrees, explicit named fields; reject booleans, missing/non-numeric values and out-of-range values |
| `query` | Nonblank text used for relevance; transient, never logged by default |
| `categories` | Optional list of agreed normalized categories; empty means no category restriction |
| `available_minutes` | Positive finite total budget including travel, visit, and explicit buffers |
| `travel_mode` | `walking` for the MVP; reject unsupported modes rather than silently substituting |
| `max_distance_m` | Optional positive straight-line radius; not verified walking distance |
| `required_amenities` | Hard requirements; only positive sourced evidence satisfies them |
| `preferred_amenities` | Ranking preferences; unknown values remain visible |
| `return_to_start` | Explicit boolean; when true, budget a return leg under the same disclosed heuristic |
| `buffer_minutes` | Nonnegative reserved time; must be smaller than the total budget |
| `limit` | Bounded retrieval count for generation, proposed default 10, maximum 20; UI shows up to 3 |

## POI records

Retain the fields in [DATA_PLAN.md](DATA_PLAN.md). Proposed conventions:

- `id` is a source-namespaced stable string, such as `wikidata:Q...`; keep original `source_id` separately.
- `name`, a nonempty source description, coordinates, and at least one source-supported category/tag are required for demo eligibility. Keep incomplete source records in collection diagnostics; do not manufacture narrative descriptions to pass validation.
- Preserve original descriptions and their language. `description_kind = source`; a generated summary is a separate field if introduced later.
- Optional facts use `null` for unknown. An empty contacts list must not imply that the business has no contact details. Unrecognized source values stay raw with a warning.
- An amenity has `value: true | false | null` and evidence references. `false` requires contrary evidence; missing is `null`.
- Evidence references identify source URL, field/source property, collection time, and source update time when supplied. Collection time is not the last time a fact was verified by its publisher.
- `opening_hours` preserves source text and timezone evidence. Until a supported parser and freshness policy exist, availability stays `unknown`; member 2 must not turn raw hours into an “open now” badge.
- Cross-source duplicates require an explicit mapping. Never merge on place name alone.

## Retrieval results

Return `status: ok | no_match`, `candidates`, and `warnings`. Invalid inputs and unavailable/corrupt snapshots are typed errors, not successful empty results. Proposed error codes: `INVALID_INPUT`, `UNSUPPORTED_MODE`, `DATA_UNAVAILABLE`, `DATA_INVALID`.

Each candidate contains the original POI/evidence, `distance_m`, `distance_kind: straight_line`, `travel_minutes_estimate`, `visit_minutes_estimate`, `total_minutes_estimate`, and the assumptions used. Include ranking factors (matched category/query terms and supported preferences) without presenting the relevance score as a probability. Use stable ID as the tie-breaker.

The team must agree walking speed, distance multiplier, and category visit estimates before filtering by time. These are versioned heuristics, never POI-source facts. If a visit estimate cannot be assigned under the agreed policy, mark it unknown and do not claim time feasibility. Use unrounded values for eligibility and round only for display.

Each candidate is an alternative. For one option, total time is outward travel + visit + explicit return estimate + buffer. A combined itinerary needs a separate calculation; summing alternative cards is not an itinerary. A hard requirement with missing evidence excludes that candidate. Return fewer candidates or `no_match` when necessary.

Proposed minimal empty-result example (synthetic, not a live response):

```json
{
  "status": "no_match",
  "candidates": [],
  "warnings": ["No candidate has sourced evidence for the required socket amenity."]
}
```

## Decisions requested from member 2

1. Record the approved schema, exact module paths, and ownership in `docs/CONTRACTS.md`.
2. Confirm category vocabulary, time-estimate policy, and whether opening-hours evaluation is in the initial increment.
3. Prioritize 2GIS as the first source integration target per the user's explicit direction, subject to access/rights and measured coverage in [source feasibility](DATA_SOURCE_FEASIBILITY.md). Wikidata is a fallback/supplement. 2GIS map remains the confirmed map provider.

Once agreed, member 1 implements the collector, normalization, snapshot validation, and retrieval against that boundary. The initial quality checks cover invalid coordinates, deduplication, missing descriptions, unknown hard amenities, no matches, time budgets, repeatability, and explicit collection failures.
