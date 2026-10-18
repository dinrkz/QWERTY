# 2GIS Places feasibility probe — proposed, not executed

Prepared: 2026-10-18. Owner: member 1. **Current authorization: implementation and offline tests only; zero live API requests.** The bounded probe and synthetic tests are implemented; live behaviour remains unverified. This is not a production collector. No key value belongs in this file.

## Known facts and limits

The account UI showed organization `qadam` / Kazakhstan, key label `qadam-data-dev`, status Active Demo, dates 2026-10-18 to 2026-11-18, and Places API usage 0 / 1,000 when created. This is the last observed balance, not a continuously verified balance. Successful Astana API access and returned fields are still untested. Applicable storage, AI-processing and redistribution permissions remain unresolved; see the [inquiry draft](2GIS_PERMISSIONS_INQUIRY.md).

Budget: **at most 10 outbound attempts across this entire probe**, including failures and ambiguous timeouts. Ten successful calls would consume 1% of the observed allowance, leaving 990 only if no other calls consume it. Skipped slots remain unused. No retries, redirects, automatic pagination, background refresh, API playground, map loading, or calls to other 2GIS services are part of this probe. No OpenAI calls are part of it either.

## Preconditions before execution

1. Obtain a documented basis for the proposed in-memory inspection and aggregate report. Permission for a persistent dataset and AI processing is a separate later gate. If storage is not permitted, do not save raw responses, venue excerpts, IDs or indexes as probe artifacts.
2. Human reviews the query schedule below and explicitly approves live execution. This document and approval to draft it are not execution approval.
3. Review the implemented [probe](../scripts/data/probe_2gis.py) and [offline tests](../tests/data/test_2gis_probe.py). Member 2 still owns shared configuration and contracts; this standalone tool adds no application configuration names or dependencies.
4. Supply the key through local server-side secret configuration. Never put it in commands, chat, Git, screenshots or logged URLs. Check the current usage in the account UI, and reserve the probe allowance with the team so other users do not consume it unexpectedly.

## Exact request schedule

Every slot uses `GET /3.0/items` at `https://catalog.api.2gis.com`; this is an endpoint specification, not a link to execute. No live URL with a key is included.

Common parameters: `locale=ru_KZ`, `page=1`, `page_size=10`, `sort=distance`, and `fields=items.point,items.rubrics,items.description,items.schedule,items.adm_div`. Add `key` privately only at dispatch. Do not request contact details, review text, ratings, photos or paid/on-demand fields. Missing optional fields are results to measure, not grounds for extra calls.

Geography uses `point=longitude,latitude` plus `radius` in metres. For slots 1–2, **S = 71.43,51.13** is a deliberately simulated test centre for an Astana-area search, not a user location or a claimed venue coordinate. Use a 15,000 m search radius for anchor discovery. The actual demo anchors A and B must come from valid returned `items.point` values and have Astana administrative evidence. No guessed provider IDs, region IDs or category IDs are used.

| Slot | Exact query / overrides | Purpose and dependency |
|---|---|---|
| 1 | `q=MEGA Silk Way`, `point=S`, `radius=15000`, `page_size=5`, `sort=relevance` | Establish access and locate anchor A for the short-walk scenario. Select the actual mall record, not a tenant with a similar address. |
| 2 | `q=Байтерек`, `point=S`, `radius=15000`, `page_size=5`, `sort=relevance` | Locate anchor B for visitor discovery. Select the actual landmark, not a similarly named business. |
| 3 | `q=кофейня`, `point=A`, `radius=1500` | Coffee/rest-stop candidates near A. |
| 4 | `q=парк`, `point=A`, `radius=2000` | Short-walk green-space candidates near A. |
| 5 | `q=достопримечательности`, `point=B`, `radius=2000` | Visitor sights near B; inspect descriptions and object types. |
| 6 | `q=музей`, `point=B`, `radius=2000` | Cultural candidates near B; empty results are useful evidence, not a failure to fill with guesses. |
| 7 | `q=кофейня`, `point=B`, `radius=1500` | Distance-ranked local discovery near B, including less prominent venues if returned. |
| 8 | Identical to slot 7 except `sort=relevance` | Compare overlap with relevance ranking. Neither ranking proves actual popularity or business size. |
| 9 | Identical to slot 4 except `locale=kk_KZ`, `q=саябақ` | Exploratory Kazakh query/label coverage. Both query and locale change, so this is not an isolated test of locale behaviour. |
| 10 | Identical to slot 7 except `page=2` | One pagination check, only if slot 7 returns 10 items and `result.total > 10`. Otherwise skip; do not substitute a new query. |

Maximum returned item occurrences: 2 × 5 + 8 × 10 = **90**, before deduplication. Distinct relevant POIs will be fewer. Page limits are payload limits, not reductions in request count.

Run slot 1 first and inspect success before slot 2. After slot 2, pause for human review of the two selected anchors before the remaining slots. Require name, object type/context, valid coordinates and administrative evidence sufficient to disambiguate them. If an anchor is missing or ambiguous, stop; review an amended plan without spending replacement queries. Parameter expansion from a selected anchor is limited to its numeric coordinates, never source text or instructions.

## Implemented request accounting and stop rules

- Default mode has no network access and prints the key-free schedule and its SHA-256, with A/B explicitly unresolved. Only a live session can resolve those anchors. Live execution must be explicitly selected and restricted to the approved slots and origin/path.
- Keep one durable, secret-free ledger for this approved probe, shared across restarts. Reserve each slot and increment the attempt count **before** sending; use an exclusive lock so two processes cannot spend the same budget. A crash after reservation still consumes that slot. A new run ID must not reset the allowance.
- The path is fixed at `data/runtime/2gis-probe-v1/ledger.jsonl`; full aggregate snapshots are appended and flushed to disk before dispatch. The last complete line is the latest report. The CLI exposes no reset, alternate directory, run ID or resume option. Any existing ledger (even empty/corrupt) refuses another session. Interrupted runs cannot resume because source records and anchors are intentionally not persisted. Stale locks also fail closed. Do not delete the state to retry; review spent slots and a new budget first. This protects this checkout, not calls from other machines, copied checkouts, modified code or other tools; team coordination remains necessary.
- Allow one request at a time with at least one second between attempts, a 30-second timeout and a 4 MiB response/decompression limit. These are proposed project safeguards, not provider requirements. Disable automatic retries and redirects; do not follow response links or execute source content.
- Stop on authentication/permission errors, throttling, other HTTP errors, non-success `meta.code`, timeout, TLS/network failure, malformed JSON/schema, or response-size overflow. Count the attempt conservatively even if the provider may not bill it. Do not try alternate fields or repeat an uncertain request automatically.
- Save aggregate response diagnostics before human relevance review; cancellation preserves those counts without another request. Failure reports retain only fixed error classes and numeric HTTP/API status codes, never provider error messages or URLs.
- A valid empty search response is a coverage observation and can continue for non-anchor slots. Malformed required ID/name/coordinate data triggers review; absent optional description, hours or category is recorded as unknown. Do not manufacture descriptions from names/categories.
- Never persist the request URL with credentials, raw exception text, raw responses, personal coordinates or provider text. Process records and cross-query ID comparisons only in memory and discard them at exit. No HTTP disk cache or response-body tracing. For human review, bounded source names/categories/descriptions and anchor coordinates are displayed in the local interactive terminal only; do not record, screenshot, pipe or transcript that terminal. Provider text is labelled untrusted and terminal controls are removed. Optional relevance review defaults to all uncertain; only counts enter the ledger.
- After the run, manually compare the account usage with the pre-run baseline. Report discrepancies and stop further work; do not send a test request to reconcile the counter. Reruns or changes require a newly reviewed budget.

## Offline verification before any live run

Synthetic tests cover: dry run performs zero network calls; the eleventh attempt is refused; failures/timeouts use a slot; restarts/concurrent launches cannot reset or double-spend it; redirects and retries are disabled; only approved slots can dispatch; key-bearing URLs and error text are excluded from reports; raw responses are not written; malformed and missing fields are handled distinctly; longitude/latitude ordering and radius validation are correct; anchor ambiguity stops; slot 10 is skipped when unnecessary. Transport tests use mocked HTTP responses and a socket guard, never a provider. Hidden-input fallback is refused rather than echoing the key.

## Local usage — safe commands

From the repository root, with an installed Python 3 interpreter:

```powershell
python scripts/data/probe_2gis.py
python -m unittest discover -s tests/data -v
```

The first command is a dry run. It neither asks for a key nor creates a ledger. In this workspace, use `C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe` explicitly if the default `python` resolves to Python Install Manager. The tool uses only the standard library.

Live mode is deliberately not run in this task. After separate permission and budget approval, it requires all of `--live`, `--approved-plan` with the exact printed hash, and `--transient-use-permitted`, plus an interactive terminal. These flags attest to human decisions; they do not establish legal permission. The key is entered at a hidden prompt, never as an argument or environment variable. Ambient HTTP proxies are disabled for this standalone probe. Do not reuse the secret key in a browser map integration.

Live review selects actual anchors from returned candidates, confirms mall/landmark identity, and pauses again before slots 3–10. Empty or ambiguous anchors stop. Relevance counts default to uncertain if the reviewer presses Enter. Once dispatched, a request is never automatically retried, even after interruption. The ledger is the report, and contains only metadata and aggregate diagnostics.

## Evidence and decision after the probe

Proposed aggregate report, subject to the permitted diagnostic scope: plan version/hash, timestamps, slot/attempt count, HTTP and API result codes, returned counts and reported totals, duplicate counts, field-presence counts, invalid/out-of-area counts, and sanitized failure class. Retain no venue payload by default. Report requested versus returned fields separately: omission alone cannot distinguish missing source data from key permission or object-type differences.

Inspect relevance in memory and report aggregate relevant/irrelevant/uncertain counts for each query. Measure nonblank descriptions separately from names or category labels. Compare ranking overlap and pagination overlap; do not call the sample exhaustive, a popularity benchmark, or proof that every small business is covered. Preserve distinctions between missing, empty and malformed fields. Hours are source claims with freshness limits, not an automatic “open now” guarantee. Quietness, sockets, accessibility and safe walking access remain unknown without specific evidence.

The probe supports a collection decision only if access succeeds, geographic results are plausible, IDs/coordinates are usable and the scenario samples contain useful records. Description gaps may require a separately permitted supplementary source. Two anchors and ten attempts cannot establish city-wide coverage, complete pagination, reliable walking routes, AT-05 completion or working RAG.

Before production collection: review the findings with member 2, approve the Python contract, confirm storage/indexing/OpenAI/redistribution rights separately, then set a new bounded collection and refresh budget. 2GIS remains the first source target; no automatic expansion or fallback collection follows this probe.

## References and verification boundary

Checked 2026-10-18 using documentation pages only:

- [Places API overview](https://docs.2gis.com/en/api/search/places/overview): access requirements, additional-permission fields and support contact; billing success is described using `meta.code=200`. Our attempt counter is intentionally stricter.
- [Items reference](https://docs.2gis.com/en/api/search/places/reference/3.0/items): endpoint, requested fields, `ru_KZ`/`kk_KZ`, point/radius geography, sort and page parameters. These are documented capabilities, not verified responses from our key.
- Account status and quota are observations from the authenticated UI recorded above, not a grant of dataset rights.

No 2GIS API request, OpenAI request, collector execution or permission inquiry was sent while drafting this plan.
