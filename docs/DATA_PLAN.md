# Automated POI collection plan

Updated: 2026-10-18. Owner: member 1. The [collector engine](2GIS_COLLECTOR.md) and gated live adapter have saved a user-authorized private collection: **73 unique normalized source records from 11 of 12 allowed collector attempts**. Ten historical feasibility attempts remain counted; the unused optional slot is preserved. Offline replay and relevance review have run, while provider reuse rights, application integration and live RAG remain unresolved. Source pages, records, private manifests and detailed findings stay outside Git. The current task authorizes offline review/commit only, with no provider requests. Default commands never load credentials or contact a provider.

## Why the probe did not produce a dataset

The probe used transient inspection and aggregate reporting while storage/reuse terms were unresolved. Source records were discarded when its processes ended. This verified access, field gaps and a composite-ID validation defect, but prevents offline reprocessing of those responses. The ledger cannot reconstruct them. The collector must save permitted response bodies before normalization so parser fixes and review cost no new requests.

## User direction: focus on visitor hubs

The original plan allocated roughly 80% of the request budget near major visitor destinations and 20% to neighborhood discovery. This is a sampling decision, not a measured popularity ranking.

Start with **Bayterek monument** and **EXPO / Mega Silk Way**, using the already reviewed source coordinates and retaining their provenance. No new anchor lookup is needed. Collect smaller cafes, parks, museums and sights around these destinations, not just the landmarks themselves.

Hub radii: coffee 1,500 m; parks, museums and sights 2,000 m. Geographic distance is not a verified walking route. The user selected Zhetysu Park / Shubar for the neighborhood sample; its sourced simulated center and narrower 750 m coffee / 1,000 m park radii are recorded in the [finalized request plan](2GIS_LIVE_PLAN.md). It is not a personal location. Overlap with Bayterek is expected and deduplicated.

Add other hubs only to address a measured scenario gap, replacing lower-priority work inside the budget. Do not spread a small initial dataset across the whole city.

## Campaign ceiling: 12 collector attempts

The table records the original allocation, not new execution approval. All ten historical attempts remain counted; fully spending this ceiling would make 22 project attempts. The campaign used eleven and stopped after review. Any later collection requires separate authorization and a fresh quota check; historical dashboard observations are not a current balance.

| Stage | Maximum attempts | Purpose |
|---|---:|---|
| Saved Bayterek pilot | 4 | One first page each for coffee, parks, museums and sights. The first response also verifies durable saving and offline replay. |
| Second hub and targeted gaps | 6 | Four first pages around EXPO/Mega Silk Way, plus two optional `сквер` refinements (one per hub) only after a reviewed green-space gap. |
| Neighborhood sample | 2 | Coffee and park discovery around Zhetysu Park / Shubar. |
| Total | **12** | At most ten hub-related attempts and two neighborhood attempts. Failures and uncertain timeouts count. |

The public template contains first-page text queries only. The private execution manifest replaced the unused eighth query with a spatial query without `q`, retaining its center, 2 km radius and ten-result page. Neither plan adds metadata calls, category IDs, detail requests or pagination. Guarded pending-plan revisions preserve all counted requests and the same ceiling; see [the live plan](2GIS_LIVE_PLAN.md). Any future lookup, adjusted query or extra page consumes the same bounded allowance. Never invent IDs.

Use one locale (`ru_KZ`) and one ranking initially. The [official results guide](https://docs.2gis.com/en/api/search/places/examples/results) limits demo keys to `page_size=10`; the prepared plan now uses ten. The earlier proposal of fifty was based on the general ceiling and is superseded. This does not promise ten usable places per response. Avoid repeating language/ranking experiments or fetching per-place details initially.

The campaign began with one saved coffee page and offline replay before continuing. Preserve that checkpoint rule for any authorized continuation: review saved evidence, normalization and coverage before another dispatch. The available budget is a ceiling, not a target to exhaust.

Request another page only when more results exist, a category/area still lacks coverage, and the last page added useful unique records. Stop on a short/empty page, zero useful new IDs, or adequate category coverage. Do not exhaust a large coffee result set simply because it exists. Use category/type evidence: a name containing “Park” does not establish a public park.

## Offline implementation and tests

The resumable collector is separate from the one-off probe recovery scripts. Its default dry run prints the exact manifest, destinations, maximum attempts and unresolved inputs. No dependency or agreed application contract changes are part of these collector fixes. Member 2 owns the shared contract.

Synthetic tests cover response persistence before normalization, malformed records, disk failures, interrupted writes, crash/resume, cached-page reuse, duplicate queries, concurrent runners, budget exhaustion, composite IDs and secret redaction. The current fixes also cover the demo page limit, absent-query spatial searches and guarded changes to unused requests. No real API key or networking is needed. The exact staged file set passed 118 offline tests and both default dry runs; see [the handoff](MEMBER_1_HANDOFF.md).

## Save first, normalize later

The collector saves these private outputs; a clean checkout contains none of the provider data:

| Output | Implemented path |
|---|---|
| Source response pages | `data/raw/2gis/<collection-id>/responses/<request-fingerprint>.json` |
| Key-free query manifest and checksums | `data/raw/2gis/<collection-id>/manifest.json` |
| Durable reservations and resumable state | `data/runtime/2gis-collection/ledger.jsonl` |
| Normalized places | `data/private/2gis/<snapshot-id>/pois.jsonl` |
| Quality and rejection report | `data/private/2gis/<snapshot-id>/quality.json` |

These directories are ignored by Git. Public sharing or copying to `data/demo/` requires appropriate redistribution terms. Git exclusion alone does not establish storage or AI-processing rights.

Under one exclusive lock, reserve each attempt durably **before dispatch**. Save the bounded, credential-scrubbed response body through a temporary file and atomic finalization; record the stored-body checksum before normalization. Preserve permitted source rows even when normalization rejects them. Do not save key-bearing URLs/headers or uncontrolled exception text. A save failure stops further requests.

Fingerprint canonical endpoint/parameters without the key. Cache successful pages by request identity, preserving their collection/provider context. A parser/schema change reprocesses the saved body instead of invalidating the network cache. Resumes reconcile stored files/checksums, then issue only unsent manifest entries. Reserved requests with no recoverable body remain spent/uncertain; never resend them automatically. No automatic retries, silent fallback requests, periodic refresh or counter resets.

Stop the whole run on authentication/permission failure, throttling, an unexpected API envelope or an uncertain network outcome. Keep that attempt charged and preserve any permitted response; do not continue spending the remaining allowance on likely systematic failures. Individual malformed rows are excluded and reported separately without discarding valid rows or the saved source page.

## Record format and quality

Preserve exact opaque source ID, sourced name, coordinates, object type, source and mapped categories, available address, optional source description/language, raw hours, collection time, provider date/revision when supplied, attribution/reuse basis, and field provenance back to saved response/item. Missing values stay unknown. Source text and generated summaries remain separate.

Deduplicate by exact source-namespaced ID, retaining differing versions and all request provenance. Similar names/coordinates are review candidates, not automatic merges. Do not truncate composite-ID suffixes. Reject malformed records from usable output, but retain their permitted evidence and fixed rejection reasons for offline repair.

Initial target: **50–100 distinct useful places**, with coffee, green spaces and cultural/sightseeing categories represented. This is an aspiration, not a guaranteed yield. Stop early when each of the three core scenarios has at least three supported candidates within its constraints and enough variety to demonstrate adaptation. Report shortfalls instead of automatically expanding the budget.

## Description gaps and the member 2 contract

No descriptions appeared in the probe summaries. Do not keep requesting the same field hoping it will become populated. Preserve `source_description=null`; clearly labeled search text built from name/category/address is derived text, not a sourced narrative description or historical evidence.

The [interface proposal](DATA_INTERFACE_PROPOSAL.md) currently requires a nonempty source description for demo eligibility. It is not an agreed contract; `docs/CONTRACTS.md` is still absent. Member 2 must decide how structured-only records are handled. Save incomplete records without silently marking them demo-eligible.

For a small set of landmark/museum explanations, first inspect the already saved Wikidata sample. Match identity using evidence and coordinates, not name alone, and preserve per-field provenance/terms. New supplementary collection needs its own reviewed scope and budget. Never label model-written prose as a source description.

## Data-use basis before persistent collection

Check the terms attached to the Kazakhstan account for raw/normalized storage, retention/expiry, indexing, attribution, and separately OpenAI processing and redistribution. The user declined outreach; email is not mandatory if applicable published/account terms establish the needed uses. No inquiry will be sent without instruction.

The [Kazakhstan directory API terms](https://law.2gis.kz/api-rules), section 5.2, were reviewed during the 2026-10-18 preflight and prohibit saving results, including temporary caching. No account-specific exception has been verified. The public template retains `storage_basis=null`; private execution manifests record the user's instruction to save locally while provider permission remains unresolved. That instruction is not a provider grant. See the [preflight evidence](2GIS_PREFLIGHT.md) for the retained rights and retention limitations.

## Next action and completion evidence

Collector saving and offline replay have been exercised on the private campaign. The [offline walking review](WALKING_DATASET_REVIEW.md) assesses relevance separately without altering original source records. Keep the source pages, ledger and private review evidence intact; do not spend the preserved request to repeat checks that can run offline.

Remaining integration work includes member 2's record/description contract, supported handling of missing descriptions, permitted data use and a redistribution-permitted repeatable demo snapshot. Relevance candidates do not establish current access, opening hours, a verified walking route or readiness for RAG. No full application acceptance check or working live RAG is claimed. This collector-fixes review passed **118 offline tests in an isolated staged-file export** and both default dry runs; details are in the handoff.
