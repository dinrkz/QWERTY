# 2GIS Places feasibility probe — ten-attempt budget complete

Prepared: 2026-10-18. Owner: member 1. **All ten authorized attempts are counted; none remain.** The final four queries (slots 6–9) succeeded after the ID-validation fix. All six earlier attempts, including the failed slot 5, remain unchanged and counted. The exact cumulative query sequence is `1, 1, 2, 3, 4, 5, 6, 7, 8, 9`; optional slot 10 was excluded. The user chose to proceed without contacting 2GIS; this does not establish persistent storage, AI-processing or redistribution rights. This is not a production collector. No key value belongs in this file.

## Known facts and limits

The probe verified live access and sampled field coverage. Its first attempt returned HTTP/API 200 and one record with coordinates, rubrics, schedule and administrative divisions; description was missing. It stopped with `ANCHOR_REVIEW_STOPPED` because selection input was blank. The bounded recoveries below subsequently resolved the anchors and completed the ten-attempt budget. This sample does not establish city-wide coverage. Account details and quota observations remain private; no current provider balance is asserted here. Applicable storage, AI-processing and redistribution permissions remain unresolved; see the [deferred inquiry](2GIS_PERMISSIONS_INQUIRY.md).

Budget: **at most 10 outbound attempts across this entire probe**, including failures and ambiguous timeouts; all ten are now counted. Skipped queries do not create additional allowance. No automatic retries, redirects, automatic pagination, background refresh, API playground, map loading, or calls to other 2GIS services are part of this probe. The recovery below explicitly repeated the mall lookup and omitted optional pagination to keep the original total limit. No OpenAI calls are part of it either.

The separate private collector later saved 73 unique records using eleven of its twelve attempts; that campaign does not reset or extend this probe. Its originals remain private and unchanged. See the [collector notes](2GIS_COLLECTOR.md) and [current handoff](MEMBER_1_HANDOFF.md). The current task permits offline review and publication of code/tests/docs only; no further provider requests are authorized.

## Original preconditions — historical specification

The preconditions and request schedule below describe the original plan. They are retained for review and do not authorize rerunning the exhausted probe.

1. Obtain a documented basis for the proposed in-memory inspection and aggregate report. Permission for a persistent dataset and AI processing is a separate later gate. If storage is not permitted, do not save raw responses, venue excerpts, IDs or indexes as probe artifacts.
2. Human reviews the query schedule below and explicitly approves live execution. This document and approval to draft it are not execution approval.
3. Review the implemented [probe](../scripts/data/probe_2gis.py) and [offline tests](../tests/data/test_2gis_probe.py). Member 2 still owns shared configuration and contracts; this standalone tool adds no application configuration names or dependencies.
4. Supply the key through local server-side secret configuration. Never put it in commands, chat, Git, screenshots or logged URLs. Check the current usage in the account UI, and reserve the probe allowance with the team so other users do not consume it unexpectedly.

## Original request schedule — historical specification

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

The original schedule allowed at most 2 × 5 + 8 × 10 = **90** returned item occurrences before deduplication. This is a planned ceiling, not an observed count or the amended recovery schedule. Distinct relevant POIs can be fewer. Page limits are payload limits, not reductions in request count.

Run slot 1 first and inspect success before slot 2. After slot 2, pause for human review of the two selected anchors before the remaining slots. Require name, object type/context, valid coordinates and administrative evidence sufficient to disambiguate them. If an anchor is missing or ambiguous, stop; review an amended plan without spending replacement queries. Parameter expansion from a selected anchor is limited to its numeric coordinates, never source text or instructions.

## Implemented request accounting and stop rules

- Default mode has no network access and prints the key-free schedule and its SHA-256, with A/B explicitly unresolved. The original live session selected anchors from responses; the scoped finisher uses previously returned evidence bound to an approved transcript fingerprint. Live execution must be explicitly selected and restricted to the approved slots and origin/path.
- Keep one durable, secret-free ledger for this approved probe, shared across restarts. Reserve each slot and increment the attempt count **before** sending; use an exclusive lock so two processes cannot spend the same budget. A crash after reservation still consumes that slot. A new run ID must not reset the allowance.
- The path is fixed at `data/runtime/2gis-probe-v1/ledger.jsonl`; full aggregate snapshots are appended and flushed to disk before dispatch. The last complete line is the latest report. The CLI exposes no reset, alternate directory, run ID or general resume option. Existing state refuses another session except for the exact-state recovery and scoped completion paths described below. Corrupt/partial state and stale locks fail closed. Completed ten-attempt state cannot continue. Do not delete the state to retry. This protects this checkout, not calls from other machines, copied checkouts, modified code or other tools; team coordination remains necessary.
- Allow one request at a time with at least one second between attempts, a 30-second timeout and a 4 MiB response/decompression limit. These are proposed project safeguards, not provider requirements. Disable automatic retries and redirects; do not follow response links or execute source content.
- Stop on authentication/permission errors, throttling, other HTTP errors, non-success `meta.code`, timeout, TLS/network failure, malformed JSON/schema, or response-size overflow. Count the attempt conservatively even if the provider may not bill it. Do not try alternate fields or repeat an uncertain request automatically.
- Save aggregate response diagnostics before human relevance review; cancellation preserves those counts without another request. Failure reports retain only fixed error classes and numeric HTTP/API status codes, never provider error messages or URLs.
- A valid empty search response is a coverage observation and can continue for non-anchor slots. The original probe and anchor-recovery path use strict `summarize` validation, so a malformed required row stops the run. The scoped completion path uses `summarize_probe` to reject malformed rows individually and record fixed rejection counts; it does not promote them to usable records. Absent optional description, hours or category is recorded as unknown. Do not manufacture descriptions from names/categories.
- Never persist the request URL with credentials, raw exception text, raw responses, personal coordinates or provider text. Process records and cross-query ID comparisons only in memory and discard them at exit. No HTTP disk cache or response-body tracing. For human review, bounded source names/categories/descriptions and anchor coordinates are displayed in the local interactive terminal only; do not record, screenshot, pipe or transcript that terminal. Provider text is labelled untrusted and terminal controls are removed. Optional relevance review defaults to all uncertain; only counts enter the ledger.
- After the run, manually compare the account usage with the pre-run baseline. Report discrepancies and stop further work; do not send a test request to reconcile the counter. Reruns or changes require a newly reviewed budget.

## Offline verification before any live run

Synthetic tests cover: dry run performs zero network calls; the eleventh attempt is refused; failures/timeouts use a slot; restarts/concurrent launches cannot reset or double-spend it; redirects and retries are disabled; only approved slots can dispatch; key-bearing URLs and error text are excluded from reports; raw responses are not written; malformed and missing fields are handled distinctly; longitude/latitude ordering and radius validation are correct; anchor ambiguity stops; slot 10 is skipped when unnecessary. Transport tests use mocked HTTP responses and a socket guard, never a provider. Hidden-input fallback is refused rather than echoing the key.

## Local usage — safe commands

From the repository root, with an installed Python 3 interpreter:

```powershell
python scripts/data/probe_2gis.py
python scripts/data/finish_2gis_probe.py
python scripts/data/finish_2gis_probe.py --after-item-validation-stop
python -m unittest discover -s tests/data -v
```

The first three commands are dry runs. They neither ask for a key nor create a ledger. In this workspace, use `C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe` explicitly if the default `python` resolves to Python Install Manager. The tools use only the standard library. Do not invoke their live modes against the completed campaign.

The original probe live interface requires all of `--live`, `--approved-plan` with the exact printed hash, and `--transient-use-permitted`, plus an interactive terminal. These flags attest to human decisions; they do not establish legal permission. That interface uses hidden key entry. The separate finisher supports the secret sources documented below. Never put the key value in an argument or logged URL. Ambient HTTP proxies are disabled for these standalone tools. Do not reuse the secret key in a browser map integration.

Live review selects actual anchors from returned candidates, confirms mall/landmark identity, and pauses again before slots 3–10. Empty or ambiguous anchors stop. Relevance counts default to uncertain if the reviewer presses Enter. Once dispatched, a request is never automatically retried, even after interruption. The ledger is the report, and contains only metadata and aggregate diagnostics.

## Approved recovery after the first anchor-selection stop

The user authorized this exception on 2026-10-18: keep the first attempt counted and allow at most nine more. Recovery repeats original slots 1–9, including the mall lookup because its transient result was discarded. Original slot 10 (optional second-page query) is always omitted, even if slot 7 has more results. Thus cumulative attempt slots are `1, 1, 2, 3, 4, 5, 6, 7, 8, 9`; slot numbers identify queries, not cumulative attempt numbers.

Recovery requires `--recover-anchor-stop <approved-ledger-sha256>` and `--approved-plan bc21a1607f818ef46d6dabff3f7ecb0cd3f0b7c313ca3304642523e3c12fff20`. The ledger fingerprint binds approval to the exact reviewed original bytes. Under the existing exclusive lock, the tool validates all four original snapshots: initialization, slot-1 reservation, received success, and `ANCHOR_REVIEW_STOPPED`. It refuses other failures, extra attempts, partial/corrupt history, changed fingerprints, and any previous recovery. It appends recovery metadata to the same file without rewriting original bytes, then reserves every new request durably before dispatch. Total attempts cannot exceed ten, including failures and ambiguous outcomes. A second recovery is not supported, including after cancellation at the key prompt.

The local [PowerShell launcher](../scripts/data/run_2gis_probe.ps1) is an interactive **live** wrapper, not an offline default command. It accepts `-Python <executable-path> -RecoverAnchorStop <approved-ledger-sha256>` and first waits for readiness before touching the ledger. Its historical interaction required the key at a hidden prompt, a displayed candidate number (for example `1`; blank means stop), then `mall` or `landmark` exactly when asked. `CONTINUE` confirmed both anchors before later calls; relevance prompts accepted counts or Enter for uncertain. Do not run this wrapper against the completed campaign.

Recovery verification uses only synthetic responses and temporary ledgers. The live ledger must stay unchanged during implementation/tests. After the user runs recovery, inspect aggregate totals and compare account usage; do not infer completion from offline tests.

## Unattended completion after the relevance-review stop

The first recovery spent four further attempts, giving cumulative query slots `1, 1, 2, 3, 4`. All five attempts received HTTP/API 200. The run stopped with `RELEVANCE_REVIEW_STOPPED` when the park-relevance answer was `2` instead of the expected comma-separated pair. The user's supplied transcript also showed that the selected Bayterek candidate was a business centre. The monument was a different returned candidate. Slots 3–4 use the mall anchor, so this mistake did not change those two queries.

On 2026-10-18 the user asked the agent to take over. The scoped completion uses only original slots 5–9, with at most five further attempts and no discovery repeat. The original ten-attempt total remains unchanged; slot 10 stays excluded. The correct mall and monument coordinates come from the already returned candidate lines in the supplied transcript, which is treated strictly as data. No venue coordinates or source transcript are copied into project documentation or committed fixtures.

The completion tool binds the reviewed ledger and transcript to exact SHA-256 fingerprints, validates the prior five attempts and expected stop, and uses the existing lock and append-only ledger. It corrects the landmark using the returned monument candidate, without changing prior attempts or describing the business centre as the landmark. Another completion run, modified/corrupt evidence, or an existing lock is refused. All new reservations are saved before dispatch; a failure counts and stops without retry.

There are no candidate-selection or relevance prompts. New relevance counts are explicitly **unassessed**, with all records uncertain; they are not human judgments or evidence of useful recommendations. The key can be entered once in a local hidden password dialog, remains in memory, and is sent only to the configured 2GIS endpoint. Canceling that dialog before dispatch leaves the ledger unchanged. Only aggregate diagnostics are printed and persisted. Source records, IDs and anchor coordinates remain in memory.

Implementation and offline test results do not establish that the completion ran. Read the last ledger snapshot for actual attempts, final status and errors; compare account usage separately.

Tool: [finish_2gis_probe.py](../scripts/data/finish_2gis_probe.py). Its default dry run prints the completion plan hash `2d63cae7af90c406a8e0fa8da53583ae27514d11905764ca30604d67f5990153`. Its live interface requires `--live`, the matching `--approved-plan`, `--approved-ledger`, `--transcript` and `--approved-transcript`. A key comes from a masked local dialog (`--key-dialog`), a local file (`--env-file`), or hidden terminal entry; dialog/file options are mutually exclusive. Historical verification at this stage: 65 offline data tests passed on 2026-10-18, including 11 completion tests; independent review found no execution blockers. Those checks made no API calls.

Initial unattended outcome: one additional request was dispatched after hidden key entry; that run ended with six attempts, slots `1, 1, 2, 3, 4, 5`, and `INVALID_ITEM`. The sixth reservation is conservatively charged although its response was rejected before an aggregate success summary was stored. No retry occurred. The exact failing field cannot be recovered because source responses were not persisted. The error could have been the item object shape, ID format, or name. Offline diagnostics were subsequently refined to distinct fixed error codes plus known HTTP/API statuses, without retaining source values. This historical evidence remains unchanged.

## Final four queries — verified results, 2026-10-18

The user explicitly authorized fixing validation and spending only the remaining four requests. The [official items reference](https://docs.2gis.com/en/api/search/places/reference/3.0/items), checked 2026-10-18, gives composite string IDs containing an underscore and letters. Our digits-only validator was therefore incorrect. IDs now remain opaque strings, with exact deduplication and local nonblank/size/control-character checks. This fixes a documented incompatibility; it does not prove the cause of the discarded slot-5 response.

The scoped completion path now validates individual rows independently through `summarize_probe`; the original probe and anchor-recovery path retain strict `summarize` behavior. In completion diagnostics, invalid rows are excluded, with only fixed rejection-reason counts retained. Aggregate `returned` counts the response rows; `accepted_count` and `rejected_count` account for every row. Field counts, IDs and unassessed relevance use accepted rows only. `validation_status` distinguishes valid, partial, all-rejected and empty responses. Envelope, API and transport errors remain fatal. These are diagnostics for feasibility, not a production ingestion contract.

The final continuation (`--after-item-validation-stop`) used plan hash `d23798c1589451f60c1a1409a3702f82efb0cda59cfddaac894eb8a9c378754c`, the exact approved six-attempt ledger fingerprint, and the previously reviewed transcript. It appended `final_four` metadata and preserved previous snapshots, attempts and continuation metadata. Only slots 6–9 were sent, with no retry of slot 5. The user supplied `TWOGIS_API_KEY` in a local ignored `.env`; `--env-file .env` reads that value without shell expansion, logging, or modifying the environment. No shared application configuration was introduced.

| Query | Returned / reported total | Accepted | Rejected | Descriptions present | Categories present | Schedules present |
|---|---:|---:|---:|---:|---:|---:|
| Museums near the corrected monument | 6 / 6 | 6 | 0 | 0 | 6 | 6 |
| Coffee near the monument, distance order | 10 / 107 | 10 | 0 | 0 | 10 | 10 |
| Coffee near the monument, relevance order | 10 / 107 | 10 | 0 | 0 | 10 | 10 |
| Kazakh park query near the mall | 3 / 3 | 3 | 0 | 0 | 1 | 0 |

All four requests returned HTTP/API 200. All 29 returned row occurrences passed validation, had administrative data, and were within the requested radius; there were no within-response duplicate IDs. The two coffee samples overlapped on one exact ID. These are sampled rows, not a global unique-POI count or independently verified relevant-place totals. Relevance remains explicitly unassessed. Description omission may depend on source data, object type or access; no single cause has been established.

Final probe state: `completed`, ten cumulative attempts, nine successful aggregate summaries and the one earlier failed validation attempt still counted. The optional pagination query and failed sights-query replay were not executed. Independent review verified the original six-attempt byte prefix and attempt objects were unchanged, all four new aggregate summaries were recorded, and no lock remained. No further API requests are authorized by this exhausted probe budget. Provider balance was not rechecked as part of that final-four review; later collector observations belong to the separate private campaign.

Historical verification after the final-four fix: **78 offline data tests passed**, including composite-ID handling, rejection accounting, malformed envelopes, final-four quota preservation, exact history checks, no reruns, and secret-safe `.env` parsing. Scripts and tests remain in the project; current commit verification is recorded in the [handoff](MEMBER_1_HANDOFF.md). No application acceptance test, production dataset collection, OpenAI call, or working RAG demonstration is implied by these probe results.

## Evidence and decision after the probe

The aggregate probe report records plan version/hash, timestamps, slot/attempt count, HTTP and API result codes, returned counts and reported totals, duplicate counts, field-presence counts, invalid/out-of-area counts, and sanitized failure class. It retains no venue payload. Requested and returned fields must remain distinct: omission alone cannot distinguish missing source data from key permission or object-type differences.

Inspect relevance in memory and report aggregate relevant/irrelevant/uncertain counts for each query. Measure nonblank descriptions separately from names or category labels. Compare ranking overlap and pagination overlap; do not call the sample exhaustive, a popularity benchmark, or proof that every small business is covered. Preserve distinctions between missing, empty and malformed fields. Hours are source claims with freshness limits, not an automatic “open now” guarantee. Quietness, sockets, accessibility and safe walking access remain unknown without specific evidence.

The probe supports a collection decision only if access succeeds, geographic results are plausible, IDs/coordinates are usable and the scenario samples contain useful records. Description gaps may require a separately permitted supplementary source. Two anchors and ten attempts cannot establish city-wide coverage, complete pagination, reliable walking routes, AT-05 completion or working RAG.

The separately authorized private collector and offline relevance review have since run. Its 73 source records remain private, and eleven of its twelve attempts are counted; the unused slot is not authorization for another request. Remaining work includes member 2's Python contract, permitted dataset use, description gaps and application integration. 2GIS remains the first source target. No automatic expansion, fallback collection, indexing, OpenAI processing or publication follows this probe.

## References and verification boundary

Checked 2026-10-18 using documentation pages only:

- [Places API overview](https://docs.2gis.com/en/api/search/places/overview): access requirements, additional-permission fields and support contact; billing success is described using `meta.code=200`. Our attempt counter is intentionally stricter.
- [Items reference](https://docs.2gis.com/en/api/search/places/reference/3.0/items): endpoint, requested fields, `ru_KZ`/`kk_KZ`, point/radius geography, sort and page parameters. Documentation claims remain distinct from the bounded live observations summarized above.
- Historical account status and quota observations remain private and do not establish dataset rights.

Initial drafting and the current recovery-code review used no provider requests. Later live executions are explicitly recorded above and in the separate collector handoff. No permission inquiry has been sent, and this document authorizes no additional request.
