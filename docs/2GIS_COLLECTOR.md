# 2GIS collector — private collection and offline replay

Owner: member 1. Updated 2026-10-18. The persistence, normalization, deduplication and resume engine and a separate gated live adapter are implemented. User-authorized private collection has subsequently run; current execution evidence is in [the member 1 handoff](MEMBER_1_HANDOFF.md). Default commands stay offline; live calls require separate execution approval. The existing ten-attempt feasibility ledger is unchanged. See [the concrete plan and execution gates](2GIS_LIVE_PLAN.md).

## Run locally

From the repository root, using Python 3.13 (the implementation uses only the standard library):

```powershell
python scripts/data/collect_2gis.py
python scripts/data/live_2gis_collector.py
python -m unittest discover -s tests/data
```

On this machine the installed interpreter is `C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe`; use `& 'C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe'` in place of `python` if the Windows launcher points to the install manager.

Default commands print the selected manifest/hash and budget without creating collection state or reading `.env`. The public template has eight first-page queries near Bayterek and Mega Silk Way, two near Zhetysu Park / Shubar, and two optional `сквер` refinements near the main hubs. Its parameters and simulated-anchor provenance are in `scripts/data/2gis_collection_plan.json`; its storage basis remains unset. The private execution manifest revised an unused query as described in [the live plan](2GIS_LIVE_PLAN.md). A query's intent is not evidence that every returned place belongs to that category.

After permitted pages have been saved, this command rebuilds derived records without requests:

```powershell
python scripts/data/collect_2gis.py --replay
```

It returns `NO_SAVED_COLLECTION` on a clean checkout without local data; where authorized pages exist it verifies and rebuilds them without a request. Synthetic test outputs use automatically cleaned temporary directories under ignored `data/runtime/2gis-collector-tests/`, separate from the real campaign paths.

## Budget and execution boundary

The fixed campaign `qadam-2gis-v1` allows **12 new attempts**, plus the **10 historical probe attempts** (22 maximum combined). This is a software ceiling, not permission to send requests or a claim about dashboard billing. The production CLI has no root/campaign/reset/limit override. Do not delete, move or replace its accounting files to start another allowance; separate checkouts do not coordinate account-wide usage.

`Collector.collect_one(manifest, request_id, transport, secrets=..., before_dispatch=..., approved_previous_manifest=None)` is the injectable engine boundary. Tests supply local synthetic functions returning `(HTTP status, body bytes)`. The engine module has no network transport. `live_2gis_collector.py` supplies the adapter, checking exact manifest approval, declared storage basis, current manual balance/date, ordering and reviewed snapshot before loading a key. The pre-dispatch gate runs under the existing lock before reservation. Its fixed-endpoint HTTP transport disables proxies/retries/redirects and bounds response reads. Private collection and offline replay have run; synthetic tests separately exercise failure paths and safeguards without provider requests.

Each invocation processes at most one explicit entry. There is no batch loop, automatic pagination, retry or refresh. Before a new entry it verifies/replays all previous pages; parser or disk failure stops before dispatch. The live adapter requires the current snapshot token after the first page, plus a gap-review attestation for either optional refinement. Category and scenario coverage decisions still require actual evidence review; the code cannot prove that review occurred. Metadata endpoints/category filters are not implemented; adding them requires a reviewed manifest/schema extension and must use the same attempt budget.

## Files and consistency

### Broad spatial queries and explicit pending-plan revisions

The query surface permits `q` to be omitted, while an explicitly blank/null query remains invalid. All other fixed spatial/field/locale/sort constraints remain; live demo pages stay at most ten results and radii at most 2 km. Omitting the query imposes no category or object-type filter. It may return administrative areas, buildings and facilities as well as businesses; structural acceptance does not establish walking relevance or that representative coordinates lie inside the search circle. The [official items reference](https://docs.2gis.com/en/api/search/places/reference/3.0/items) documents a 2 km maximum radius without a search query and distance ordering based on object geometry. Returned counts are not a guarantee of useful or exhaustive coverage.

By default, stored manifest queries remain append-only. A user-requested change to unreserved slots can be passed through `--revise-pending-from <exact-current-manifest-hash>` (engine keyword `approved_previous_manifest`). Under the existing OS lock, the collector requires that hash to match the current stored manifest. Every uncached new dispatch, including one without the revision flag, compares all counted request entries against their immutable original manifests. Changing/removing a counted request is rejected, and an existing campaign with a missing current manifest cannot dispatch. A stale revision approval or missing prior manifest is rejected. These checks occur before credential loading or a new reservation; the existing exhausted-budget check retains priority. The proposed manifest still needs its own exact approval, ordering, quota and reviewed-snapshot checks. Earlier ledger events, raw pages and manifest archives remain intact; the 12-attempt ceiling does not reset. Cached repeats only replay saved data and do not persist a proposed revision.

Offline regression coverage includes unchanged historical fingerprints, invalid broad parameters, missing/stale revision approval, reserved-query immutability with and without a revision flag, a missing current manifest in an existing campaign, preserved ledger prefixes and a broad eighth request after seven synthetic saved calls. **118 offline tests passed in a clean export of the exact staged file set**, including 66 collector/live-adapter tests; see [the handoff](MEMBER_1_HANDOFF.md). Earlier full-workspace totals include separate probe recovery changes and are not evidence for this commit's file set.

| Artifact | Local path |
|---|---|
| Scrubbed response bodies and metadata | `data/raw/2gis/qadam-2gis-v1/responses/<request-fingerprint>.json` |
| Latest manifest | `data/raw/2gis/qadam-2gis-v1/manifest.json` |
| Immutable manifests, linked by each reservation/response | `data/raw/2gis/qadam-2gis-v1/manifests/<sha256>.json` |
| Durable request journal | `data/runtime/2gis-collection/ledger.jsonl` |
| OS lock file | `data/runtime/2gis-collection/run.lock` |
| Normalized, versioned records | `data/private/2gis/<snapshot-id>/pois.jsonl` |
| Counts, duplicates, missing descriptions and rejection reasons | `data/private/2gis/<snapshot-id>/quality.json` |
| Pointer to a complete derived snapshot | `data/runtime/2gis-collection/current.json` |

All these paths are already ignored by Git. The engine saves a bounded UTF-8 body, with known secret values and recognized credential fields scrubbed, before envelope/record validation. JSON representation may change during scrubbing; it is not a byte-for-byte wire archive. Malformed bodies are also retained when they are within bounds and can be safely decoded/scrubbed. Oversized/invalid-encoding/transport failures leave a counted reservation without a usable page. Provider exception text, request headers and key-bearing request URLs are never stored by the engine.

The journal is append-only, hash-linked and fsynced before transport. Atomic file replacement finalizes responses; a checksum receipt follows. Raw pages are reconciled against reservation, manifest, query and checksum on resume. A process crash after the raw file was finalized but before its receipt is recoverable without another request. A crash before a complete raw page exists leaves an uncertain, spent attempt and stops further collection. Never automatically resend it.

An OS advisory lock prevents overlapping writers and releases on process exit, including abrupt exit. `run.lock` remains on disk intentionally; its existence alone does not mean a process is running, and it must not be deleted to bypass a running collector. Windows byte-range locking was tested; the POSIX lock branch has not been executed here. Use a local filesystem; this is not a distributed lock or a guarantee against hardware/filesystem power-loss behavior.

Failed HTTP/API status or malformed envelopes preserve the available body and stop the campaign. Missing/tampered artifacts or a partial journal fail closed. Do not delete the ledger, edit saved pages, or reset counters to resolve such a stop. Repair a parser by replaying intact evidence. Uncertain dispatch or damaged journal recovery requires a separately reviewed repair that preserves every spent reservation; there is no automatic repair command.

Normalization writes immutable content-addressed snapshot folders. `current.json` changes only after both POIs and quality files are complete; a failed write leaves the prior complete snapshot selected. Replay is deterministic for the same source evidence and normalizer. API/schema fixes do not change network cache identity.

## Record and contract boundary

The local staging format groups records by **exact `2gis:<source_id>`**. Composite suffixes remain intact. Same-name places with different IDs stay separate. Each distinct normalized version retains its fields and every response/item provenance reference; the last observed version is explicitly selected. Full scrubbed provider rows, including fields not normalized yet, remain in the source page.

Name, ID and coordinates are required. Bad rows are excluded from normalized output and counted; the raw page remains available for repair. Malformed optional values become null with warnings. Missing/empty descriptions remain `source_description=null`; no generated description or category inference is substituted. Original rubrics, object type, address, hours and administrative divisions are retained when structurally available. Descriptions are untrusted text and never executed.

This is an internal staging format, **not member 2's agreed application contract**. All records are marked `demo_eligible=false` pending that contract; even complete records are not automatically published or indexed. [Offline relevance review](WALKING_DATASET_REVIEW.md) is separate from source preservation and does not establish access, freshness or provider rights. An immutable manifest records the declared storage basis; the engine does not verify legal rights. The public template retains `storage_basis=null` and cannot execute unchanged. Private execution manifests recorded the user's direction to save locally while provider permission remained unresolved; that direction is not a provider grant. This review/commit authorizes no further collection.

## Verification

For this collector-fixes increment, **118 tests passed in an isolated export of the exact staged file set**. Both default CLI dry runs passed with live execution disabled. Two reserved-history regressions failed before the fix and passed afterward. Independent final code review passed, including all 43 collector engine tests. The suite uses synthetic responses and credentials, with socket connections blocked; it does not load the real `.env` or verify current account rights, dashboard balance or provider behavior. No configured type/lint/build command exists; application acceptance checks remain separate and unrun.

Historical live-adapter preparation: 21 new offline tests passed for approval/order/checkpoint/key gates, transport bounds, HTTP errors/redirects, fixed endpoint, timeout, optional refinements and final 12-attempt accounting. That committed scope contained 98 data tests; the broader local workspace contained 136 including separate probe recovery work. Tests ran on Windows / Python 3.13.12. Two review regressions reproduced and fixed incomplete-plan dispatch through direct runner use and mismatched report/snapshot output after another writer advances.

Prior published collector increment:

37 collector-specific tests passed on Python 3.13.12 / Windows. The collector commit contains 77 data tests (37 collector plus 40 previously committed probe tests); the local workspace additionally passes 115 tests including earlier uncommitted probe recovery work. Coverage includes save-before-parse, raw and derived disk failures, malformed rows/envelopes, exact-ID dedup/version provenance, cache reuse, deterministic replay, manifest integrity, interrupted journal/response handling, budget exhaustion across restarts, concurrency, secret redaction, and actual child-process exits before/after response persistence. Tests use synthetic transports; no API key is needed. Default CLI dry run passed. No configured type/lint/build command exists; application acceptance checks remain unrun.

The initial test invocation encountered Windows sandbox permissions in its system temporary directory. Tests now use workspace-local temporary directories like the existing probe tests; this changes only test storage, not assertions.
