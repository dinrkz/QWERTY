# Member 1 source feasibility

Updated: 2026-10-18. These findings distinguish source research, completed bounded tooling and remaining application work. The user confirmed Python backend and prioritizes 2GIS as a main POI source. Ten probe attempts are counted, with nine successful aggregate summaries and one validation failure. A separate collector retained 73 unique source records privately using eleven of twelve allowed attempts. Access and sampled field coverage are verified; persistent data-use rights and production retrieval remain unresolved. The map remains 2GIS. Wikidata is a fallback or optional supplement, not the default replacement.

## 2GIS — bounded private collection completed; integration unresolved

The [ten-attempt probe](2GIS_PROBE_PLAN.md) exhausted its authorized budget. All six earlier attempts were preserved, including a failed validation request, and the final four succeeded. No raw venue dataset was saved under that transient-only design. The later [collector](2GIS_COLLECTOR.md) saved raw responses and normalized records under separate project-owner authorization; that authorization is not a provider grant. The dataset, account details and credentials remain private and excluded from Git. The inquiry is deferred at the user's request; no email was sent.

The [Places API overview](https://docs.2gis.com/en/api/search/places/overview), reviewed during the original research, documents geographic/category search and requires an access key; some fields require additional access. Astana coffee, park and museum samples returned usable coordinates and varying category/hour coverage. Descriptions were absent from every successful probe summary; in the separate collected dataset, 69 of 73 records lack descriptions. Pagination, rich amenities, applicable reuse permission and production retrieval remain unverified. The documented composite-ID format justified fixing the probe's numeric-only ID validation, without proving the exact cause of its discarded failed response.

The [directory pricing policy](https://law.2gis.ru/catalog-pay) lists storage capability as a separate pricing component. The [directory API offer, section 3.1](https://law.2gis.ru/webapi-offer) restricts extraction, storage, processing and redistribution outside the contract; caching is not provided under that text. This is evidence that ordinary access is insufficient to assume dataset rights, not a finding that every 2GIS contract prohibits our use. That offer's directory definition refers to the Russian Federation; the agreement applicable to Astana/the team's account must be confirmed separately. No clear grant for our OpenAI processing or public snapshot was verified.

The later [Kazakhstan preflight](2GIS_PREFLIGHT.md) records the applicable published-term concerns and lack of a verified account-specific exception. No permission claim is inferred from successful requests, private storage or the user's authorization. Existing source evidence is retained as historical research; no terms were fetched again during this offline review.

Decision: keep 2GIS as the preferred main source and integration target while preserving the private originals and documenting unresolved storage, indexing, OpenAI processing, display, redistribution, attribution and retention rights. Email is not a mandatory step and remains deferred. The measured description gap supports considering a narrowly scoped supplement without replacing 2GIS. Neither this decision nor the unused collector slot authorizes further requests or data transfers.

### Current offline checkpoint

1. Preserve the 73 private source records and all original accounting. The collector remains at **11/12 attempts**, with ten earlier probe attempts unchanged; no live request is authorized now.
2. Use the implemented offline persistence, normalization, deduplication and replay tools. The [walking audit](WALKING_DATASET_REVIEW.md) assessed 45 relevance candidates, seven needing review and 21 excluded for the sample scenarios; these are relevance judgments, not verified accessible or demo-ready destinations.
3. Agree member 2's description/record contract and application integration. Keep missing descriptions, schedules and amenities unknown; do not turn generated ideas into source facts.
4. Keep rights and retention questions explicit before any new use, indexing, external AI processing or redistribution. User authorization for local work does not supply provider permission.
5. Assess scenario and description gaps offline. Any later collection or supplement needs its own reviewed scope and applicable source terms; do not spend the remaining slot automatically.

## Open alternatives — proposals

| Source | Verified basis | Remaining feasibility work |
|---|---|---|
| Wikidata structured entity data | [Licensing policy](https://www.wikidata.org/wiki/Wikidata:Licensing) publishes structured data under CC0. This supports copying and adapting entity data for a snapshot; provenance will still be retained. | Measure relevant Astana coverage, descriptions/languages, coordinates, categories and coffee-stop suitability. Do not import Wikipedia prose or images under the entity-data license. |
| OpenStreetMap data | [Copyright page](https://www.openstreetmap.org/copyright) permits reuse under ODbL with attribution and applicable share-alike requirements. | Choose an export/API with suitable usage rules, inspect actual Astana tags/descriptions, and document dataset distribution obligations before collection. No OSM request or dataset collection has run. |

Recommendation: retain the completed Wikidata probe as fallback/supplement evidence while prioritizing 2GIS. Do not expand a fallback into the default collector merely because it is easier to access. OSM remains an untested alternative. The final usable source combination remains conditional on access, reuse rights and measured scenario coverage.

## Bounded Wikidata probe

`scripts/data/probe_wikidata.py` sends one query for entities within 15 km of the sourced coordinate on [Astana Q1520](https://www.wikidata.org/wiki/Q1520), capped at 200 rows. It requests labels, descriptions, coordinates, and instance types. Multiple types/coordinates can produce multiple rows for one entity. It reports unique entity counts and description/type coverage; it does not infer POI suitability from proximity.

The script follows the [Wikidata data-access guidance](https://www.wikidata.org/wiki/Wikidata:Data_access) and [User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy): an identifying project agent, gzip, one bounded request with timeout, and no automatic retries after errors or throttling. It writes the query, report and successful raw response into a new local directory. Existing runs are never overwritten. Endpoint failure exits nonzero and does not claim successful collection.

Historical reproduction command, shown for documentation only; it sends a live source request and is **not authorized by the current offline task**:

```powershell
python scripts/data/probe_wikidata.py --output-dir data/raw/wikidata-probe-NEW-RUN
```

Offline verification uses `python -m unittest discover -s tests/data -v` and does not run the live command above.

Use a fresh output directory per run. `data/raw/` is ignored by Git. This script is an exploratory source probe, not the AT-05 collector: normalization, suitability/category review, source revisions, complete pagination/coverage policy, refresh behavior and a redistributable demo snapshot remain to be built after the shared contract is agreed.

Local environment: tested interpreter is Python 3.13.12 at `C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe`. The default `python` command resolved to Windows Python Install Manager and failed to find a runtime index in this environment; the explicit installed interpreter works. No project dependency manifest was changed.

## Evidence

- Ten synthetic unit tests cover unique-entity counting, empty results, row-cap warning, malformed response rejection, failure reporting without sensitive exception text, and preservation of existing evidence. Regression cases include numeric entity IDs, null/non-object optional bindings, invalid response/row shapes, and successful handling of omitted optional fields. Malformed consumed fields fail before a response snapshot is written. These do not verify live collection.
- Initial sandbox run returned `URLError`, exit 1, with a failure report under `data/raw/wikidata-probe-20261018-01/`.
- Network-enabled probe succeeded (exit 0) at 2026-10-18T12:25:57.504902+00:00, under `data/raw/wikidata-probe-20261018-02/`. It returned 200 rows, 159 distinct entities, 125 entities with descriptions and 157 with instance types. The row cap was reached; coverage is incomplete and biased by ordering on entity ID. Query SHA-256: `67100ccec588e58f7f67d8b18a65ee1651abfb7fedbf8c9ec8691d2a7a07199a`.
- All project acceptance checks remain NOT RUN. No normalized demo dataset, retrieval service or live RAG is claimed.

Sample inspection found source-described parks, a museum and monuments, alongside many hotels, transport stops and administrative entities. Thus geographic proximity alone is insufficient. Descriptions use mixed languages, some are absent, and some labels reflect historical naming. Record examples remain in the ignored local evidence rather than this document. Current access and hours were not checked.

Coffee-stop coverage is still unverified; the sample is insufficient to rule it in or out. Further Wikidata work is deferred unless a supplement is needed. Preserve language metadata in the eventual normalized records; a Russian name does not mean its description is Russian.
