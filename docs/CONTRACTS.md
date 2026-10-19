# Qadam application contract v1

## Local generation evidence extension — 2026-10-19

The user authorized an evidence contract and mocked generation increment. [GENERATION_EVIDENCE.md](GENERATION_EVIDENCE.md) defines implemented `qadam-generation-evidence-v1`: up to five validated private candidates, request-local aliases, field-specific source/derived evidence, nullable facts and strict selection validation. It is explicitly `local_mock` with `external_processing_allowed:false`; its result statuses are `mock_generation`, `mock_no_match` and `mock_retrieval_only`, never `live_rag`.

Projection follows the existing private validation on the Node side; Python and the original contracts below are unchanged. The service is not mounted in the production server or browser. Collected records can use only its fixed local test double; injected mocks require synthetic data. No live authorization, provider transport or request budget is added. See the extension document for exact fields, bounds, evidence rules, setup and verification.

## Private offline extension — 2026-10-19

The user authorized scoped interface integration after `510a8e5`. [OFFLINE_INTERFACE.md](OFFLINE_INTERFACE.md) documents the implemented extension and local setup. The original live contract below remains unchanged.

- Select offline mode only through `scripts/app/start-offline.mjs` and its ignored JSON configuration (`python`, `snapshot`, `annotations`, `binding`, optional `port`). It fixes `--mode offline` and isolated Python arguments. No dotenv/provider configuration is read.
- `GET /api/config` in this mode returns `{mode:"offline",map_public_key:"",generation_configured:false,retrieval_configured:true}` when the command is configured. Presence is not proof the snapshot is usable; search validates its binding.
- `POST /api/recommend` accepts the normal structured input fields, with empty `query` additionally allowed. Query text is lexical ranking only; constraints are exclusively structured controls. No interpretation or generation occurs. Requests/clocks/paths cannot be configured by client-supplied extra fields.
- The private Python envelope is `{status:"offline_evaluation",contract:"qadam-private-retrieval-v1",result}`. Its snapshot/review/policy/binding hashes must match local configuration. Nullable facts and version evidence are checked by a separate validator; broad/fine categories must agree and unverified hard requirements cannot pass. The strict live validator still rejects this envelope.
- Browser results use `status:"offline_evaluation"`, including empty matches. Existing card fields remain, with null source descriptions/URLs, `activity.kind:"template_suggestion"`, source/version/evidence IDs, reviewer metadata, uncertainty codes and false eligibility flags in `dataset`. No input coordinates/raw query or local paths are returned. Synthetic kind, where used by tests, is visibly labeled; the production launcher accepts collected bindings only.
- Maps/device geolocation/external source links are disabled; offline CSP allows local resources. No private record enters an OpenAI call. This mode does not resolve storage, redistribution or external AI-processing permission.

## Original live contract

Member 2 implementation boundary, 2026-10-18. The user approved Node.js + JavaScript for member 2 in this session. Member 1's `work/data/source-feasibility` (559b6e7) proposes Python for data/retrieval; keep that work in Python and exchange JSON. Member 1 must review/implement this boundary before live integration. This is not a claim of team-wide acceptance or working retrieval.

## Ownership

| Owner | Paths |
|---|---|
| Member 2 | `src/app/`, `src/shared/`, `src/server.mjs`, `public/`, `tests/app/`, `scripts/app/`, `docs/CONTRACTS.md`, `docs/MEMBER_2_HANDOFF.md`, README/setup, root config/manifests/lockfiles |
| Member 1 | `scripts/data/`, future `qadam_data/`, `tests/data/`, `data/demo/`, DATA_PLAN and member 1 source/interface/handoff documents |
| Member 3 | future `tests/acceptance/`, scenario/results/privacy/submission/presentation documents |

No competing collector, snapshot, or ranking implementation belongs in member 2's app. Shared safety validation rejects invalid retrieval output; it does not search records. This contract adapts member 1's proposal, retaining named latitude/longitude, units, nullable facts, estimates, provenance and typed errors.

## Request

`POST /api/recommend`, JSON, maximum 16 KiB. Required: numeric `latitude` [-90,90], `longitude` [-180,180], nonblank `query` (1–1000 characters), integer `available_minutes` [5,480]. No coercion of booleans/strings to numbers. The service is Astana-focused; coordinates outside latitude [50.9,51.35], longitude [71.15,71.75] receive `OUTSIDE_COVERAGE` (coarse product boundary, not an administrative polygon).

Optional fields and defaults:

```json
{
  "latitude": 51.1, "longitude": 71.4,
  "query": "Хочу прогуляться рядом", "available_minutes": 60,
  "language": "auto", "travel_mode": "walking", "categories": [],
  "required_amenities": [], "preferred_amenities": [],
  "max_distance_m": 3000, "return_to_start": false, "buffer_minutes": 0,
  "require_open": false, "events_only": false, "first_visit": false
}
```

Example coordinates are simulated, not a landmark assertion. Languages: `auto|ru|kk|en`; automatic detection prioritizes Kazakh letters, then Cyrillic, then English. Explicit language selection is authoritative. Categories: `park|museum|landmark|cafe|event`. Amenities: `sockets|quiet|child_friendly|wheelchair`. Mobility restrictions beyond the evidence-backed wheelchair field require clarification. Unsupported travel modes fail explicitly.

The model interprets the text into these fields; validation preserves form hard constraints, takes the smaller time/radius and larger buffer, unions required amenities and combines true flags. Unrepresentable restrictions, conflicting categories, flight/departure timing, or unsupported modes request clarification. User text is untrusted. Do not log request bodies/coordinates. No conversation history is stored.

## Retrieval process (member 1)

`QADAM_RETRIEVAL_COMMAND` is a JSON array of executable and argument strings, set by the developer. Spawn without a shell, write one request as JSON to stdin, close stdin; read one JSON response from stdout. Timeout 8 seconds, stdout bounded to 512 KiB, stderr discarded and never returned/logged. No OpenAI/map credentials in the child environment. Use a local snapshot so retrieval needs no network credentials. No process or file creation occurs per request except the configured retrieval child. Exit nonzero means `DATA_UNAVAILABLE`.

The normalized request adds `limit: 10`, `now` (server ISO UTC), `query_terms` (up to 12 short interpreted search terms) and uses resolved `language`. Raw query and coordinates stay transient/local; member 1 must not log them. Return:

```json
{
  "status": "ok", "dataset_kind": "collected",
  "snapshot_id": "source-and-revision", "collected_at": "2026-10-18T00:00:00Z",
  "candidates": [], "warnings": []
}
```

`ok` requires 1–10 candidates; `no_match` requires none. `dataset_kind` is `collected|synthetic`; synthetic is allowed only in tests and must never produce `live_rag`. Errors: `{ "status":"error", "code":"DATA_UNAVAILABLE|DATA_INVALID|INVALID_INPUT|UNSUPPORTED_MODE" }`. Warnings are bounded strings from the local adapter and displayed as data, never executed.

### POI and candidate

Each candidate: `{poi, distance_m, distance_kind:"straight_line", travel_minutes_estimate, visit_minutes_estimate, total_minutes_estimate}`. Numbers are finite and unrounded for eligibility. Member 1 may also return `ranking_factors` for diagnostics, but v1 does not display or trust arbitrary ranking explanations. The app independently verifies category/preference matches before using those reasons; a category match is never described as proof of a specific historical/cultural interest. POI:

```json
{
  "id": "source:stable-id", "source_id": "stable-id", "name": "Sourced name",
  "latitude": 51.101, "longitude": 71.401,
  "description": "Original source description", "description_kind": "source",
  "description_language": "ru", "categories": ["park"], "tags": [],
  "source_url": "https://example.org/record", "collected_at": "2026-10-18T00:00:00Z",
  "source_updated_at": null, "attribution": "Publisher", "reuse_terms": "Documented permission reference",
  "evidence": [{"id":"e1", "source_url":"https://example.org/record", "source_field":"description", "collected_at":"2026-10-18T00:00:00Z", "source_updated_at":null}],
  "description_evidence_ids": ["e1"],
  "amenities": {}, "opening_hours": null, "event": null,
  "access": {"value":"unknown", "evidence_ids":[]},
  "operating_status": {"value":"unknown", "evidence_ids":[]}
}
```

This is a synthetic schema illustration, never demo data. Missing amenity key means unknown. Present amenity: `{value:true|false|null, evidence_ids:[...]}`; true/false require evidence. `access.value`: `public|restricted|unknown`; `operating_status.value`: `operating|temporarily_closed|permanently_closed|unknown`. Known restricted/closed places are excluded. Unknown access is disclosed, never presented as safe/accessible.

Hours: `null` or `{text, timezone, evidence_ids, intervals:[{start,end}]}`. Preserve source text; normalized intervals are ISO instants with timezone offsets, created by member 1 only when source interpretation is supported. Empty/uninterpretable/stale intervals mean unknown, never open. Evaluate the full estimated arrival/visit interval; closing during a visit fails `require_open`. Even supported intervals mean “according to the collected schedule”, not guaranteed access.

Event: `null` or `{starts_at, ends_at, status:"scheduled|cancelled|unknown", evidence_ids}`. Scheduled events must cover the full estimated visit after arrival, have fresh evidence, and not be cancelled. No invented events or future events shown as current. Event source collection belongs to member 1; no live event feed is implied.

Evidence IDs are unique within a POI. Source URLs must be HTTPS/HTTP without credentials. Dates must be valid timezone-qualified instants, not future collection/update dates. Source text is untrusted, escaped in UI and never used as instructions. Provenance is retained per factual field. Contacts/ratings/popularity may be added by member 1 but are not consumed by v1.

## Versioned estimate/evidence policy

Team implementation assumptions, not source facts: Haversine earth radius 6,371,000 m; walking distance heuristic = straight-line × 1.3; speed = 4 km/h, or 2.5 km/h for a wheelchair requirement (a conservative planning assumption, not a personal ability claim). Travel = distance × 1.3 / metres per minute. Visit defaults: park 20, museum 45, landmark 15, cafe 25, event 30 minutes; use the maximum across a POI's categories, independent of tag order. Total = outward travel + visit + (outward travel if return requested) + explicit buffer. Values must fit both distance and total budget before rounding. Shared policy in `src/shared/policy.mjs` is the specification; Python should match within 1 metre / 0.05 minute tolerance.

Each card is an alternative, not one stop of a combined route. Distance/time are estimates, not pedestrian routing. A wheelchair tag does not prove route accessibility. No safety/flight/access guarantees.

Evidence freshness uses the older of collection and source-update timestamps (when supplied): hours 7 days, events 48 hours, amenities/access 30 days. These conservative product thresholds are not publisher guarantees. Unknown source-update time is disclosed. A source field with missing/stale evidence cannot satisfy a hard requirement. Raw historical description can remain displayed with its date. Member 2 revalidates member 1 eligibility before generation and rejects corrupt batches as `DATA_INVALID`.

## Generation and output

Use real OpenAI Responses requests with strict JSON schema and `store:false`; explicit `OPENAI_MODEL`, no presumed access/balance. Interpretation precedes retrieval; recommendation generation follows retrieval. Requests do not send coordinate fields. Decimal coordinate-like text is redacted before interpretation; user-entered addresses can remain in text (disclosed). Generation receives only interpreted interests/context and up to 10 public POI descriptions/eligible evidence identifiers/estimates. No tools, external actions, secret values or raw instructions from POIs are accepted.

Grounding is structural: the model composes 1–3 recommendations by selecting retrieved `poi_id`, description `evidence_ids`, allowed `reason_codes` and an `activity_code` from an eligible category-specific vocabulary. The app renders short RU/KK/EN explanations and activities from this validated structure. No unrestricted model-authored factual prose is displayed. This is constrained recommendation generation, not fine-tuning or a general chat assistant. Source names/descriptions remain verbatim and are labeled with their source language. Human language/usefulness evaluation is still required.

Model result: `{recommendations:[{poi_id,evidence_ids,reason_codes,activity_code}]}`. Reasons: `nearby|fits_time|interest|first_visit|amenity|event`; every reason must be true for the request/candidate. The card also presents the place-specific original source description with attribution, not invented local context. Activities: `stroll|observe|museum_visit|coffee_break|attend_event`, restricted by category. All activities are conditional on confirming access; unknown access is clearly disclosed, not converted into an assertion that a venue can be entered. Restricted/closed places have already failed eligibility. Conditional coffee ideas are not evidence of open hours.

Application result: `{status,language,message,context_used,recommendations,warnings}`. Status: `live_rag|retrieval_only|no_match|needs_clarification|error|synthetic_test`. Context excludes exact user coordinates and raw query; reports filters, language, time, return/buffer and location source (`manual_or_device_ephemeral`). Cards contain `poi_id,name,latitude,longitude,source_facts,why,activity,estimates,sources,caveats`. `source_facts` are source data; `why` is grounded composition; `activity` is labeled a generated suggestion in live mode and a template suggestion in fallback; estimates have their own label. Sources are reconstructed from records, never model URLs.

No candidates means no recommendation call. Generation timeout/refusal/invalid output yields explicitly labeled `retrieval_only`, never fake success. Missing key/model before interpretation gives `PROVIDER_NOT_CONFIGURED`. Missing retrieval command gives `DATA_UNAVAILABLE`. Interpretation failure gives a clear error; ambiguous constraints request clarification. No claim of live RAG with synthetic candidates.

## Browser and providers

`GET /api/config` returns only `{map_public_key, generation_configured, retrieval_configured}`; never backend secrets. 2GIS script loads only after the user enables the map; it receives map viewport/connection information. Device geolocation is an explicit separate button, rounded to 3 decimal places before submitting (approximate 100 m latitude precision); manual inputs are also rounded in the UI. Server does not persist bodies, coordinates, chats or provider responses. No analytics/localStorage/cookies. Browser cache disabled for API responses. OpenAI `store:false` is not a promise of zero provider retention; see official data controls.

Sources checked 2026-10-18: [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data), [2GIS MapGL setup](https://docs.2gis.com/en/mapgl/start/first-steps). Live provider/model/map access and account restrictions remain unverified.
