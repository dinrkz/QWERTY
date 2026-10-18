# 2GIS collection template — 12 new attempts maximum

2026-10-18; member 1. The public template is retained below. A separately authorized private campaign has used **11 of 12 attempts**, with one optional slot preserved; ten historical feasibility attempts remain counted. The collection has 73 unique normalized source records, with detailed evidence kept outside Git. No further requests are authorized by this document or the current review/commit task. The ceiling includes failed/uncertain requests: 22 project attempts maximum, not a requirement to use every slot.

Machine-readable plan: [`scripts/data/2gis_collection_plan.json`](../scripts/data/2gis_collection_plan.json). Runner: [`scripts/data/live_2gis_collector.py`](../scripts/data/live_2gis_collector.py). Its default command prints the full plan and current SHA-256 without reading `.env`, creating a ledger, or contacting a provider. The hash changes if the plan or recorded storage basis changes.

## Exact searches

**User-directed local revision, 2026-10-18:** after seven saved requests, the user selected a broader all-category Mega Silk Way search. The private execution manifest replaced only unused slot 8 with `mega-silk-way-all-categories`: same 2 km center/radius, page 1, ten results maximum, but no `q`, category or type filter. The other queries were unchanged. The original template/table below remains historical reference; it is not the active private manifest. Completed requests must remain immutable, and a continuation must use the current local manifest and ledger rather than restart from this template. Revision safeguards are documented in [collector operating notes](2GIS_COLLECTOR.md).

Every query uses `page=1`, `page_size=10`, `sort=distance`, `locale=ru_KZ`, and fields `items.point,items.rubrics,items.description,items.schedule,items.adm_div` at the fixed HTTPS items endpoint. The [official results guide](https://docs.2gis.com/en/api/search/places/examples/results) limits demo keys to ten results per page. The earlier value of 50 incorrectly used the general API ceiling. The live adapter now rejects larger pages before credentials, state or dispatch. Twelve calls can return at most 120 place occurrences before deduplication and validation; actual yield may be lower. Text-query intent does not establish the actual category of any returned row.

| Slot | Request ID | Query | Center | Radius | When to run |
|---|---|---|---|---:|---|
| 1 | `bayterek-coffee` | `кофейня` | Bayterek | 1,500 m | First saved pilot, then stop/review |
| 2 | `bayterek-parks` | `парк` | Bayterek | 2,000 m | After prior saved-page review |
| 3 | `bayterek-museums` | `музей` | Bayterek | 2,000 m | After prior saved-page review |
| 4 | `bayterek-sights` | `достопримечательности` | Bayterek | 2,000 m | Complete pilot, then assess coverage |
| 5 | `mega-silk-way-coffee` | `кофейня` | Mega Silk Way | 1,500 m | Continue if coverage needs it |
| 6 | `mega-silk-way-parks` | `парк` | Mega Silk Way | 2,000 m | After prior saved-page review |
| 7 | `mega-silk-way-museums` | `музей` | Mega Silk Way | 2,000 m | After prior saved-page review |
| 8 | `mega-silk-way-sights` | `достопримечательности` | Mega Silk Way | 2,000 m | After prior saved-page review |
| 9 | `zhetysu-coffee` | `кофейня` | Zhetysu / Shubar | 750 m | Neighborhood sample chosen by user |
| 10 | `zhetysu-parks` | `парк` | Zhetysu / Shubar | 1,000 m | Neighborhood green-space sample |
| 11 | `bayterek-green-space` | `сквер` | Bayterek | 2,000 m | Optional; reviewed green-space gap |
| 12 | `mega-silk-way-green-space` | `сквер` | Mega Silk Way | 2,000 m | Optional; reviewed green-space gap |

Ten slots focus on visitor hubs and two on the selected neighborhood (83% / 17% of the maximum budget). Slots 1–10 are sequential if continuing; stopping early is always allowed. Optional slots 11 and 12 can be independently skipped and can run in either order after the first ten. They refine green-space discovery rather than repeat coffee pages or automatically paginate. No fallback request replaces a skipped or failed slot.

## Public, simulated centers

| Center | Longitude, latitude | Evidence / meaning |
|---|---|---|
| Bayterek monument | `71.430456,51.128301` | Previously reviewed local feasibility-probe transcript; monument candidate, not the similarly named business center |
| Mega Silk Way | `71.405441,51.089347` | Previously reviewed local feasibility-probe transcript, mall candidate |
| Zhetysu / Shubar | `71.439453,51.135968` | Public 2GIS listing for Tanbaly tas inside Zhetysu Park; used as a simulated neighborhood search center |

The [public 2GIS Tanbaly tas listing](https://2gis.kz/astana/geo/70030076166202443/tab/reviews) was found in indexed search with latitude 51.135968 and longitude 71.439453 on 2026-10-18. The [park listing](https://2gis.kz/astana/firm/70000001019586912) identifies Zhetysu Park in Shubar. The center is not asserted to be the park centroid or a verified entrance. No device location is used. The Zhetysu sample overlaps Bayterek; exact-ID deduplication preserves shared records and their multiple query sources. Narrower neighborhood radii limit redundant coverage without claiming the areas are disjoint.

## Review and execution gates

See the [2026-10-18 preflight evidence](2GIS_PREFLIGHT.md): demo page-size corrected, historical quota checked, storage permission still unresolved. Historical observations are not a current balance or execution approval.

The repository template still has `storage_basis=null`. Private execution manifests recorded the user's direction to save locally despite unresolved provider permission; they do not assert a provider grant. A key, an arbitrary confirmation string, or Git exclusion does not establish permission. The code checks that a basis is recorded, not whether its legal interpretation is correct. The user declined outreach; no inquiry has been sent. Indexing, OpenAI processing and redistribution remain separate decisions.

The live runner requires all of the following:

1. Explicit authorization to execute the specified request. Review/commit approval does not authorize provider requests.
2. `--live`, the exact `--approved-manifest` digest, one `--request-id`, and `--max-new-attempts 1`.
3. A nonempty recorded storage basis and a complete twelve-entry manifest with no duplicate query fingerprints.
4. Manually checked `--available-requests` of at least one and `--usage-checked-on YYYY-MM-DD` matching today's Asia/Qyzylorda date. The tool does not fetch balance or assume the old 1,000-request allowance remains.
5. For every new request after the first, `--reviewed-snapshot` equal to the current saved snapshot's SHA-256. Inspect raw source/category evidence and quality first; replay verifies the saved artifacts without requests. A stale token cannot advance the run.
6. For optional refinements, `--green-space-gap-reviewed` after finding insufficient supported public green-space candidates near that hub. Do not infer a park from its name. Skip a refinement if the prior results already cover the scenario.

Manifest approval is an explicit caller attestation; snapshot matching guards against reviewing stale evidence and cannot prove a person actually reviewed it. Manifest/balance checks run before entering the collector; ordering, checkpoint and key checks run under its OS lock before durable reservation. Cached entries replay without reading the key or sending a request. Missing key, failed approval or stale review does not reserve an attempt. Each actual transport dispatch is reserved first, including timeout/HTTP/API failures. No counters reset.

Transport uses a fixed endpoint, no proxies, no redirects/retries, a 30-second socket timeout, identity encoding and a bounded body read. HTTP error bodies are saved and scrubbed when within bounds; authentication, throttle, malformed envelope, unsupported encoding or uncertain network outcomes stop further collection. There is no automatic resumption past an uncertain request.

## Offline commands

```powershell
python scripts/data/live_2gis_collector.py
python -m unittest discover -s tests/data
```

Where private saved pages exist, `python scripts/data/collect_2gis.py --replay` verifies them and rebuilds derived files offline. A clean checkout contains no provider dataset. The live runner returns the exact snapshot token after saving a page. No executable live command is approved in this document. Credentials stay in the ignored `.env` as `TWOGIS_API_KEY` and are read only after all execution gates; never put the key in command arguments.

If another writer advances the collection between completion and report delivery, `REVIEW_SNAPSHOT_CHANGED` prevents pairing the older report with the newer token. The completed request stays counted and saved; replay and review the current snapshot offline rather than issuing a replacement request.

The plan prioritizes collection efficiency, not guaranteed scenario eligibility. Description gaps, category mapping, walking-route validity, and member 2's staging-to-application contract remain unresolved. No actual collector dataset or live transport success is claimed by offline tests.
