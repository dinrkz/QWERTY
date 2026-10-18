# Offline retrieval from saved places — proposed next increment

Prepared 2026-10-18 against code baseline `66d06f612e55b4a26ee135eff0e2c70d7cc15acf` on `work/data/source-feasibility`, for review in PR #4. This is a reviewed implementation proposal, not an implemented retrieval service or agreed contract. The documentation publication commit is the commit containing this file; resolve it with `git log -1 --format=%H -- docs/OFFLINE_RETRIEVAL_PLAN.md`. Preparing and publishing these documents makes no data-provider calls, builds no index, changes no source data and sends no message to member 2. Member 2 owns `docs/CONTRACTS.md`, which is absent at this checkpoint.

Start with an in-process Python scan of the existing private snapshot. Apply evidence-based category and constraint filters, then deterministic lexical ranking. The first increment needs no new collection, embeddings, database, credentials or generation call. Use [the interface proposal](DATA_INTERFACE_PROPOSAL.md) for the proposed request/result boundary and [the member 2 handoff](MEMBER_2_RETRIEVAL_HANDOFF.md) for decisions and ownership.

## Verified starting point

The collector and walking audit exist; production retrieval and live RAG do not. A read-only check of the saved snapshot and its review confirmed:

| Observation | Current local evidence |
|---|---|
| Saved records | 73 unique full source-namespaced IDs |
| Reviewed scenario relevance | 45 candidates, seven held for review, 21 excluded |
| Missing fields | 69 descriptions, 18 rubric lists, 25 schedules, 18 addresses |
| Amenities | Seating, quietness, sockets, accessibility and child suitability remain unknown |
| Eligibility | All source versions and review rows remain `demo_eligible=false` |
| Request accounting | Collector 11/12; historical probe 10/10; total 21 counted attempts |

Candidate counts precede distance/time filtering. Review status is an analyst judgment, not a source fact or permission to display a live recommendation. One unused collector attempt remains a ceiling, not an instruction to spend it. Root architecture/case status paragraphs predate the collection work; this checkpoint records observed data/tooling without claiming the application works.

The original interface proposal requires a source description for demo eligibility. **Recommend allowing structured-only records for offline retrieval evaluation**, while preserving `source_description=null`, missing-field warnings and `demo_eligible=false`. This is a proposed policy addition for member 2 to approve, not a relaxation of the demo gate or proof that the description requirement is satisfied. Of the 45 reviewed candidates, 42 lack descriptions; a strict description screen would leave at most three before geography/time filtering.

## Private input boundary

Use an explicit immutable snapshot and matching annotations, pinned for the whole evaluation. The current pointer is for local discovery only; do not reload a mutable pointer midway through a request.

| Artifact | Local relative path | Use |
|---|---|---|
| Snapshot selection | `data/runtime/2gis-collection/current.json` | Discover the snapshot ID once, then pin it |
| Source staging records | `data/private/2gis/<snapshot-id>/pois.jsonl` | All versions, current-version pointer and provenance |
| Quality report | Same folder, `quality.json` | Required part of the snapshot hash; collection limitations |
| Reviewed annotations | `data/runtime/walking-review/annotations.json` | Complete, version-bound candidate/hold/exclusion decisions |
| Existing analyst report | `data/private/walking-review-final/review.json` | Reference evaluation evidence; not the runtime source of POI facts |

Current snapshot: `7be51dabbc0dfbb224700678cbaf795d834cd9c973ebffa348cb3bc81aaca7cc`.
Exact POI-file SHA-256: `c2ce8797e8574aaf94ab0361098c7e9f940ea858389a0d8a3b968ba40336d21c`.
These fingerprints identify local artifacts; they are not source records, provider credentials or access links.

Proposed loader sequence:

1. Parse bounded local files strictly: reject duplicate JSON keys, nonfinite values, malformed schemas and unsupported schema versions. Limits must be explicit in code and tested. Paths come from trusted backend setup, never directly from a browser request.
2. Verify the canonical snapshot hash over records plus quality, exact IDs, version hashes, current-version selection and nonempty structurally valid provenance. Validate the consumed field types and coordinates as well as hashes: a matching hash alone does not establish semantic validity.
3. Read the selected `versions[].fields` and its provenance. Preserve all historical versions on disk. The selected version means last observed during collection, not guaranteed current provider truth. `locale` is request metadata, not verified description language.
4. Recompute the existing conservative category assessment in memory, then validate/apply the complete annotations against the snapshot, exact POI-file hash, ID set and each selected source version. Reject missing, stale or invalid annotations for this reviewed-snapshot mode; do not silently fall back to a looser automatic mode. Version the rubric/assessment policy as well: a changed mapping requires re-review even when source bytes are unchanged.
5. Admit only reviewed `candidate` records with supported category/entity evidence. Preserve annotation reasons and caveats separately from provider facts. Query text, names or proximity cannot promote held/excluded records. Unknown or unsupported entities remain held.

The current annotations contain `source_snapshot`, `input_pois_sha256` and `assessments`; neither they nor the existing report carries an assessment-policy digest. Policy pinning is **new proposed metadata**. During implementation, prepare a separate private evaluation manifest binding the approved policy/code version, canonical annotation digest and snapshot/file hashes, without editing the originals. The backend policy input must carry or resolve that reviewed binding; member 2 defines its exact layout in the contract. Changed assessment rules require a newly reviewed binding, not merely a new hash silently generated at load time.

Reuse `load_snapshot`, `assess` and `apply_annotations` mechanics carefully after checking their validation coverage. They are analyst helpers, not the complete loader contract. Add adapter validation rather than assuming all malformed inputs are already handled. Do not use `scenario_rows()` as production retrieval: it fixes round-trip assumptions and sorts rounded display distances.

No raw response pages, collector/probe ledgers, transcript or `.env` are required for normal retrieval. Provenance paths remain private server-side references. Do not follow URLs, read arbitrary paths referenced by source text, call collector replay, or modify the current pointer to answer a query.

## Filtering and ranking policy v1 — awaiting member 2

Member 2 supplies a structured request from a form or explicitly tested interpretation step. Free text is a lexical preference, not executable instructions or authority to invent hard constraints. Unresolved intent/constraints must be clarified before retrieval; an arbitrary sentence must not silently become a nearest-place search.

1. Validate the request. Require a recognized scenario (`short_walk`, `first_visit`, `coffee_stop`), finite coordinates and positive total minutes. Support walking only. Reject unsupported constraints/fields instead of ignoring them. Known but unsupported-by-evidence amenities are valid requests that can yield `no_match`.
2. Restrict to the scenario's categories. An optional categories list means OR within that list, intersected with the scenario vocabulary; incompatible categories are invalid input. An empty list means all categories allowed by that scenario. Initial vocabulary and mappings come from the audit's explicit rubric policy: coffeehouse, coffee point, park, museum, gallery, viewpoint, interesting building, fountain and sculpture. Preserve gallery versus museum and coffee point versus coffeehouse.
3. Apply straight-line radius, evidence-backed hard amenities and total-time constraints. Unknown/false does not satisfy a hard requirement. Quiet coffee with required sockets, or a required seated rest, currently has no supported match. No opening-hours evaluator is included; requests requiring verified current opening are an unsupported constraint, not permission to infer it from raw schedules.
4. Rank only eligible records. Proposed ascending tuple: `(-supported_preference_count, -lexical_match_count, distance_m_full_precision, id)`. Count distinct supported preferred amenities and distinct matched query tokens. Unknown preferences earn no credit. Category relevance is enforced before ranking. Do not call the tuple confidence or popularity.
5. Tokenize with Unicode normalization, case folding and word boundaries. Match name, source rubric labels, address and genuine source description when present. Keep the derived search text transient and separate from source fields. A versioned, explicit category-alias table may support Russian/English/Kazakh terms; it adds matching rules, not new place facts. No stemming or semantic-quality claim is needed initially.
6. Zero lexical overlap is acceptable when the explicit scenario/category constraints establish intent. If intent is only in unrecognized free text, member 2 must clarify it. Do not broaden categories or hard requirements to fill the requested count.
7. Require an integer limit with `1 <= limit <= 20`, default ten; member 2 displays up to three supported alternatives. Return fewer or `no_match` honestly. Stable full IDs break exact ranking ties; shuffled input order must not affect results. Preserve separate IDs for nearby/similar names; no fuzzy merging or new site clustering in v1.

The 45 reviewed candidates are an evaluation baseline, not a list to hardcode in the implementation. Every run derives eligibility from the validated snapshot and review. Hashes/ID counts in evidence are not special-case answers.

## Time estimates and unknowns

Recommend retaining the audit's initial assumptions for comparison: 2,000 m default straight-line radius, 80 m/min walking speed, 1.3 distance multiplier, and explicit return-to-start. The UI can default return-to-start to true but must disclose it and send an explicit boolean. A different radius is an explicit request/policy choice, never extra collection.

```text
outward_minutes = distance_m × 1.3 / 80
return_minutes = outward_minutes if return_to_start else 0
total_minutes = outward_minutes + visit_minutes + return_minutes + buffer_minutes
eligible only if distance_m <= radius and total_minutes <= available_minutes
```

Use full precision for ranking and eligibility; round only presentation values. A buffer is nonnegative and smaller than the budget. Default visit estimates, all analyst assumptions: coffeehouse 20, coffee point 10, park 20, museum 45, gallery 30, viewpoint 20, interesting building 15, fountain 10 and sculpture 10 minutes. For multiple applicable requested categories, use the conservative maximum. An unknown visit estimate cannot establish time feasibility.

Each candidate is an alternative starting at the same origin. These estimates do not constitute a walking route, combined itinerary, verified entrance, access guarantee or airport-arrival promise. Raw schedules may be retained as source evidence, but availability remains unknown. Preserve freshness and access caveats even when the estimate fits.

## Proposed implementation sequence and ownership

| Step | Owner | Reviewable deliverable |
|---|---|---|
| 1. Agree the boundary | Member 2, with member 1 input | `docs/CONTRACTS.md`: schema, policy, import paths, ownership, Python version and structured-only evaluation decision |
| 2. Build the loader and filters | Member 1 after agreement | Proposed `scripts/data/retrieve_saved_places.py`, `tests/data/test_saved_places_retrieval.py`; no shared/application edits |
| 3. Rank and expose evidence | Member 1 | Deterministic in-process result, fixed errors, private evidence references, uncertainty/estimate labels |
| 4. Verify offline behavior | Member 1; member 3 reviews test cases | Synthetic regression suite plus private scenario evaluation against pinned inputs; no live providers |
| 5. Connect the application boundary | Member 2 | Synthetic retrieval contract consumer and output-ID validation first; real-source generation is separate future work |

Paths are proposals, not existing modules or agreed ownership changes. No runtime environment-variable name, web framework, HTTP endpoint or dependency is selected here. After agreement, member 1 should work on a dedicated retrieval branch based on the integration lead's reviewed baseline, following [TEAM_WORKFLOW.md](../TEAM_WORKFLOW.md). Do not overwrite the application agent's work or assume PR #4 has merged.

## Offline verification and completion criteria

Tests must demonstrate behavior rather than mirror sorting code:

| Check | Required evidence |
|---|---|
| Snapshot/review integrity | Missing files, corruption, schema errors, composite/duplicate IDs, invalid selected versions/provenance, missing/stale/unsupported annotations and changed policy fail with fixed errors |
| Honest relevance | Name-only category hints and injected instructions cannot promote held/excluded records; categories and record identity remain source-backed |
| Hard/soft constraints | Unknown and contrary amenities fail hard requirements; unknown preferences earn no credit; unsupported modes/constraints are distinct from `no_match` |
| Boundaries and adaptation | Exact radius/time boundary, just-outside boundary, boolean/nonfinite inputs, return flag, buffer, differing category visits; changed location/category/budget changes eligibility |
| Ranking | Repeated/shuffled inputs produce identical IDs/order; distances that round equally still rank by full precision; empty and partial results are honest |
| Factual separation | Missing descriptions remain null; raw hours do not imply opening; derived lexical text/estimates/review judgments are separate from provider facts |
| Privacy and offline execution | Socket/HTTP traps, no `.env` access, unchanged dataset/review/ledger hashes, no precise request coordinates/prompts or private paths in logs/errors |
| Member 2 integration fixture | Clearly synthetic request/results, ID/version/evidence mapping and no-match/error cases; later generation rejects IDs outside the retrieved set |

Privately evaluate the existing audit matrix: three simulated anchors, short walks at 30/60 minutes, first visits at 60/90, and coffee at 30/45, plus unknown-amenity and no-return/buffer variations. Compare eligible sets under the identical audit policy; explain differences instead of forcing old counts or exact venue answers. Review relevance/ordering with humans; test success alone is not recommendation quality. Keep per-place outputs and annotations in ignored local storage; public summaries contain aggregates and limitations only.

This increment is done when the approved contract is implemented, offline tests pass, private evaluation is reproducible, originals are unchanged and member 2 can consume the synthetic contract fixtures. Retrieval contributes evidence toward AT-01/02/03/07/08/09/10/11/14; it does not complete full application acceptance, description coverage, source permissions or real RAG.

## Handoff and use limits

Provider storage/indexing/AI-processing/redistribution permissions remain unresolved as recorded in [the existing preflight](2GIS_PREFLIGHT.md). No terms were rechecked in this task. Private local storage and code publication do not establish those rights. The current work prepares a design only; it does not authorize external processing or public use of the records.

Member 2 can review this plan, the code and synthetic fixtures without the dataset. A clean clone has no private data. Do not attach source files to the PR, send them in chat, copy them to `data/demo/` or upload them to any provider. No dataset transfer is included in this handoff. If a later authorized local evaluation uses a separate checkout, its private snapshot and matching annotations must be provisioned separately and verified; never work around missing data by calling the API.

## Verification of this planning increment

Two read-only subagents reviewed design and local data readiness during preparation; separate design and privacy reviewers checked the documentation for publication. Snapshot/version/review checks confirmed the aggregate starting point and existing false eligibility flags without changing files. Review clarified that policy binding is proposed metadata, absent from the current annotations. Documentation checks passed: 21 local links resolve, two synthetic JSON examples parse, five private artifact fingerprints remain unchanged, and the commit scope contains only the four planning documents. The verification helper is retained locally at `data/runtime/verify_retrieval_planning_docs.py`. No application tests were rerun for prose-only changes. The existing baseline previously passed 156 offline tests at `66d06f6`; that is prior code evidence, not a test of the proposed retrieval. The user authorized the documentation commit and PR #4 update; no retrieval implementation, provider request, index, dataset transfer or direct message is included.
