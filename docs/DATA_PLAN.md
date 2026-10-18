# Automated POI collection plan

Updated: 2026-10-18. Owner: member 1. **Live collection remains a proposal: no collection requests authorized or sent by this plan.** The [offline collector engine and tests](2GIS_COLLECTOR.md) are implemented; no network adapter/live CLI is enabled. 2GIS remains the preferred main source. The completed feasibility probe used all ten authorized attempts; its aggregate ledger stays intact. No reusable 2GIS place dataset was saved. See [probe evidence](2GIS_PROBE_PLAN.md).

## Why the probe did not produce a dataset

The probe used transient inspection and aggregate reporting while storage/reuse terms were unresolved. Source records were discarded when its processes ended. This verified access, field gaps and a composite-ID validation defect, but prevents offline reprocessing of those responses. The ledger cannot reconstruct them. The collector must save permitted response bodies before normalization so parser fixes and review cost no new requests.

## User direction: focus on visitor hubs

Allocate roughly 80% of the proposed request budget near major visitor destinations and 20% to neighborhood discovery. This is a sampling decision, not a measured popularity ranking.

Start with **Bayterek monument** and **EXPO / Mega Silk Way**, using the already reviewed source coordinates and retaining their provenance. No new anchor lookup is needed. Collect smaller cafes, parks, museums and sights around these destinations, not just the landmarks themselves.

Initial geographic radii: coffee 1,500 m; parks, museums and sights 2,000 m. Geographic distance is not a verified walking route. Select one additional residential walking area and include its exact simulated center in the manifest before execution. Do not use a personal location or choose an arbitrary center mid-run.

Add other hubs only to address a measured scenario gap, replacing lower-priority work inside the budget. Do not spread a small initial dataset across the whole city.

## Proposed ceiling: 12 new attempts

This is a proposal, not live execution approval. All ten historical attempts remain counted; fully spending this ceiling would make 22 project attempts. Check actual dashboard usage before running; do not assume 990 requests remain.

| Stage | Maximum attempts | Purpose |
|---|---:|---|
| Saved Bayterek pilot | 4 | One first page each for coffee, parks, museums and sights. The first response also verifies durable saving and offline replay. |
| Second hub and targeted gaps | 6 | Up to four first pages around EXPO/Mega Silk Way; up to two category refinements, metadata lookups or extra pages. |
| Neighborhood sample | 2 | Coffee and green-space discovery around the selected residential center. |
| Total | **12** | At most ten hub-related attempts and two neighborhood attempts. Failures and uncertain timeouts count. |

Metadata discovery, adjusted queries and pagination all consume this ceiling; none are free setup. Use verified category/region IDs from documentation or saved responses where available. Otherwise allocate a metadata lookup from the hub allowance or stop and revise the manifest; never invent IDs.

Use one locale (`ru_KZ`) and one ranking initially. The [items reference](https://docs.2gis.com/en/api/search/places/reference/3.0/items) documents `page_size` up to 50; propose 50 subject to actual key support. This does not promise 50 usable places per response. Avoid repeating language/ranking experiments or fetching per-place details initially.

Start with **one saved coffee page**. Before dispatching another request, verify that the response can be reloaded, normalized and reported offline without secrets in the stored artifact. Then finish the four-query pilot and assess real unique/category coverage before proceeding.

Request another page only when more results exist, a category/area still lacks coverage, and the last page added useful unique records. Stop on a short/empty page, zero useful new IDs, or adequate category coverage. Do not exhaust a large coffee result set simply because it exists. Use category/type evidence: a name containing “Park” does not establish a public park.

## Build and test offline first

Build a normal resumable collector separately from the one-off probe recovery scripts. Its default dry run prints the exact manifest, destinations, maximum attempts and unresolved inputs. Do not add dependencies or change the shared application contract without member 2.

Synthetic tests must cover response persistence before normalization, malformed records, disk failures, interrupted writes, crash/resume, cached-page reuse, duplicate queries, concurrent runners, budget exhaustion, composite IDs and secret redaction. No API key or networking is needed for these tests.

## Save first, normalize later

The offline engine implements these outputs, but no real collection dataset exists yet:

| Output | Proposed path |
|---|---|
| Source response pages | `data/raw/2gis/<collection-id>/responses/<request-id>.json` |
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

The [Russian directory offer](https://law.2gis.ru/webapi-offer), section 3.1, restricts extraction/storage outside its contract and says caching is not provided. Its directory definition refers to Russia, so it does not establish this Kazakhstan account's agreement. Record the actual applicable basis; neither “all storage is forbidden” nor “private storage is automatically permitted” has been established for this account.

## Next action and completion evidence

Offline collector, persistence/resume tests and dry-run manifest are implemented; see the [operating notes and verification](2GIS_COLLECTOR.md). Next resolve the account's storage basis and member 2's record/description contract, finalize unresolved manifest entries as needed, and review live adapter/approval binding before the first saved pilot call. Keep the first-page checkpoint and 12-attempt ceiling.

Completion evidence still needed: actual saved source files and checksums; real unique usable POIs by area/category/scenario; missing-field, duplicate and rejection reports; exact attempt counts; attribution/reuse evidence; and a permitted integration snapshot. Offline engine behavior is verified with synthetic fixtures; a live collector run, real dataset and working RAG remain unverified.
