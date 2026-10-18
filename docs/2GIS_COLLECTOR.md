# 2GIS collector — offline implementation

Owner: member 1. Updated 2026-10-18. The persistence, normalization, deduplication and resume engine is implemented and tested with synthetic responses. **No new API requests were made.** There is no live CLI option, network adapter, or credential loading in this increment. The existing ten-attempt feasibility ledger is unchanged.

## Run locally

From the repository root, using Python 3.13 (the implementation uses only the standard library):

```powershell
python scripts/data/collect_2gis.py
python -m unittest discover -s tests/data
```

On this machine the installed interpreter is `C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe`; use `& 'C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe'` in place of `python` if the Windows launcher points to the install manager.

The default command prints the draft manifest, hash, paths and budget without creating collection state or reading `.env`. Eight first-page queries cover coffee, parks, museums and sights near Bayterek and Mega Silk Way. Four slots remain unresolved: two hub refinements and two neighborhood queries. A query's intent is not evidence that every returned place belongs to that category. No neighborhood coordinates or category IDs are invented.

After permitted pages have been saved, this command rebuilds derived records without requests:

```powershell
python scripts/data/collect_2gis.py --replay
```

It currently returns `NO_SAVED_COLLECTION` because this task did not collect real pages. Synthetic test outputs use automatically cleaned temporary directories under ignored `data/runtime/2gis-collector-tests/`, separate from the real campaign paths.

## Budget and execution boundary

The fixed campaign `qadam-2gis-v1` allows **12 new attempts**, plus the **10 historical probe attempts** (22 maximum combined). This is a software ceiling, not permission to send requests or a claim about dashboard billing. The production CLI has no root/campaign/reset/limit override. Do not delete, move or replace its accounting files to start another allowance; separate checkouts do not coordinate account-wide usage.

`Collector.collect_one(manifest, request_id, transport, secrets=...)` is the injectable engine boundary. Tests supply local synthetic functions returning `(HTTP status, body bytes)`. No transport implementation in this module can contact 2GIS. A future reviewed live adapter must enforce the exact approved manifest hash, applicable storage basis, timeout/response bounds before buffering, credential redaction, fixed endpoint, no redirects/retries, and current account budget. These are not claimed as implemented live behavior.

Each invocation processes at most one explicit entry. There is no batch loop, automatic pagination, retry or refresh. Before a new entry it verifies/replays all previous pages; parser or disk failure stops before dispatch. First-page quality and coverage decisions remain human-reviewed: the engine does not automatically authorize later pilot pages or calculate enough scenario coverage. Metadata endpoints/category filters are not implemented; adding them requires a reviewed manifest/schema extension and must use the same attempt budget.

## Files and consistency

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

This is an internal staging format, **not member 2's agreed application contract**. All records are marked `demo_eligible=false` pending that contract; even complete records are not automatically published or indexed. Actual category mapping, geographic/scenario eligibility, freshness rules, and rights for storage/indexing/AI/redistribution remain separate work. An immutable manifest records the declared storage basis; the engine does not verify legal rights. Current draft basis is null and no live data collection is enabled.

## Verification

37 collector-specific tests passed on Python 3.13.12 / Windows. The collector commit contains 77 data tests (37 collector plus 40 previously committed probe tests); the local workspace additionally passes 115 tests including earlier uncommitted probe recovery work. Coverage includes save-before-parse, raw and derived disk failures, malformed rows/envelopes, exact-ID dedup/version provenance, cache reuse, deterministic replay, manifest integrity, interrupted journal/response handling, budget exhaustion across restarts, concurrency, secret redaction, and actual child-process exits before/after response persistence. Tests use synthetic transports; no API key is needed. Default CLI dry run passed. No configured type/lint/build command exists; application acceptance checks remain unrun.

The initial test invocation encountered Windows sandbox permissions in its system temporary directory. Tests now use workspace-local temporary directories like the existing probe tests; this changes only test storage, not assertions.
