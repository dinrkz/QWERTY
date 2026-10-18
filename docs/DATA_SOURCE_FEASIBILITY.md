# Member 1 source feasibility

Checked: 2026-10-18. These are source research findings, not a completed collector or approved final dataset choice. The user confirmed Python backend and explicitly prioritized 2GIS as a main POI source. A demo key has since been created; API success and data-use rights remain unverified. The map remains 2GIS. Wikidata is a fallback or optional supplement, not the default replacement.

## 2GIS — demo access provisioned; API use and rights unresolved

Platform Manager showed `qadam` / Kazakhstan, `qadam-data-dev`, Active Demo, 2026-10-18 to 2026-11-18, and Places API usage 0 / 1,000. No key value is recorded here. No 2GIS API calls have run. The [permissions inquiry](2GIS_PERMISSIONS_INQUIRY.md) is drafted but unsent; the [ten-attempt probe](2GIS_PROBE_PLAN.md) is implemented with synthetic offline tests and remains unauthorized for live execution. Only documentation pages were consulted during drafting; no source request was needed for implementation or tests.

The [Places API overview](https://docs.2gis.com/en/api/search/places/overview) documents geographic/category search and requires an access key. Some additional fields require separate access. Astana results, descriptions, amenities, pagination, and limits have not been tested with the team's account.

The [directory pricing policy](https://law.2gis.ru/catalog-pay) lists storage capability as a separate pricing component. The [directory API offer, section 3.1](https://law.2gis.ru/webapi-offer) restricts extraction, storage, processing and redistribution outside the contract; caching is not provided under that text. This is evidence that ordinary access is insufficient to assume dataset rights, not a finding that every 2GIS contract prohibits our use. That offer's directory definition refers to the Russian Federation; the agreement applicable to Astana/the team's account must be confirmed separately. No clear grant for our OpenAI processing or public snapshot was verified.

Decision: prioritize 2GIS as the primary candidate and first production-source integration target. Do not collect a persistent 2GIS dataset until the applicable agreement supports it. Ask for access and written coverage of storage, indexing, sending selected records to OpenAI for inference, public demo display, snapshot redistribution, attribution and retention. A free key alone does not answer those questions. A concrete access/rights blocker or measured coverage gap is required before proposing a replacement.

### Next 2GIS checkpoint

1. Demo key creation is complete; local secret configuration and successful API access remain pending. Confirm the applicable agreement for Kazakhstan and the project's intended use.
2. Review the inquiry, probe and offline verification, establish permission for transient inspection, and obtain explicit execution approval. Then run at most ten attempts across cafes, parks, museums and landmarks. Derive actual demo anchors from returned evidence; the initial search centre is simulated, not personal location. Do not persist venue responses until storage rights are established.
3. Report actual success/errors and field coverage: stable IDs, name, coordinates, category, description, hours, source links, and any requested amenities. Richness is a hypothesis to measure: category/marketing text must not imply sockets, quietness, accessibility, or current opening.
4. Check actual pagination, account limits, attribution and refresh requirements. Estimate a small collection scope from observed results and approved quotas, without assuming an unlimited city-wide export.
5. After rights and the shared Python contract are settled, build the 2GIS collector first. Use another source only for an evidenced gap or blocker; preserve separate provenance and reuse terms when combining records.

## Open alternatives — proposals

| Source | Verified basis | Remaining feasibility work |
|---|---|---|
| Wikidata structured entity data | [Licensing policy](https://www.wikidata.org/wiki/Wikidata:Licensing) publishes structured data under CC0. This supports copying and adapting entity data for a snapshot; provenance will still be retained. | Measure relevant Astana coverage, descriptions/languages, coordinates, categories and coffee-stop suitability. Do not import Wikipedia prose or images under the entity-data license. |
| OpenStreetMap data | [Copyright page](https://www.openstreetmap.org/copyright) permits reuse under ODbL with attribution and applicable share-alike requirements. | Choose an export/API with suitable usage rules, inspect actual Astana tags/descriptions, and document dataset distribution obligations before collection. No OSM request or dataset collection has run. |

Recommendation: retain the completed Wikidata probe as fallback/supplement evidence while prioritizing 2GIS. Do not expand a fallback into the default collector merely because it is easier to access. OSM remains an untested alternative. The final usable source combination remains conditional on access, reuse rights and measured scenario coverage.

## Bounded Wikidata probe

`scripts/data/probe_wikidata.py` sends one query for entities within 15 km of the sourced coordinate on [Astana Q1520](https://www.wikidata.org/wiki/Q1520), capped at 200 rows. It requests labels, descriptions, coordinates, and instance types. Multiple types/coordinates can produce multiple rows for one entity. It reports unique entity counts and description/type coverage; it does not infer POI suitability from proximity.

The script follows the [Wikidata data-access guidance](https://www.wikidata.org/wiki/Wikidata:Data_access) and [User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy): an identifying project agent, gzip, one bounded request with timeout, and no automatic retries after errors or throttling. It writes the query, report and successful raw response into a new local directory. Existing runs are never overwritten. Endpoint failure exits nonzero and does not claim successful collection.

Run with an installed Python interpreter from the repository root:

```powershell
python scripts/data/probe_wikidata.py --output-dir data/raw/wikidata-probe-NEW-RUN
python -m unittest discover -s tests/data -v
```

Use a fresh output directory per run. `data/raw/` is ignored by Git. This script is an exploratory source probe, not the AT-05 collector: normalization, suitability/category review, source revisions, complete pagination/coverage policy, refresh behavior and a redistributable demo snapshot remain to be built after the shared contract is agreed.

Local environment: tested interpreter is Python 3.13.12 at `C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe`. The default `python` command resolved to Windows Python Install Manager and failed to find a runtime index in this environment; the explicit installed interpreter works. No project dependency manifest was changed.

## Evidence

- Ten synthetic unit tests cover unique-entity counting, empty results, row-cap warning, malformed response rejection, failure reporting without sensitive exception text, and preservation of existing evidence. Regression cases include numeric entity IDs, null/non-object optional bindings, invalid response/row shapes, and successful handling of omitted optional fields. Malformed consumed fields fail before a response snapshot is written. These do not verify live collection.
- Initial sandbox run returned `URLError`, exit 1, with a failure report under `data/raw/wikidata-probe-20261018-01/`.
- Network-enabled probe succeeded (exit 0) at 2026-10-18T12:25:57.504902+00:00, under `data/raw/wikidata-probe-20261018-02/`. It returned 200 rows, 159 distinct entities, 125 entities with descriptions and 157 with instance types. The row cap was reached; coverage is incomplete and biased by ordering on entity ID. Query SHA-256: `67100ccec588e58f7f67d8b18a65ee1651abfb7fedbf8c9ec8691d2a7a07199a`.
- All project acceptance checks remain NOT RUN. No normalized demo dataset, retrieval service or live RAG is claimed.

Sample inspection found source-described parks, a museum and monuments, alongside many hotels, transport stops and administrative entities. Thus geographic proximity alone is insufficient. Examples below are returned source records, not validated recommendations; current access/hours were not checked.

| Source entity | Returned name | Description observation |
|---|---|---|
| [Q18405670](https://www.wikidata.org/wiki/Q18405670) | Национальный музей Республики Казахстан | Russian description present |
| [Q104866684](https://www.wikidata.org/wiki/Q104866684) | Президентский парк (Нур-Султан) | English description present; name reflects an older city name |
| [Q104866925](https://www.wikidata.org/wiki/Q104866925) | Жетысу | English description present |
| [Q12572863](https://www.wikidata.org/wiki/Q12572863) | Казак ели (монумент) | English description present |
| [Q120868819](https://www.wikidata.org/wiki/Q120868819) | Парк Жеруйык | Description absent in returned language fallback |

Coffee-stop coverage is still unverified; the sample is insufficient to rule it in or out. Further Wikidata work is deferred unless a supplement is needed. Preserve language metadata in the eventual normalized records; a Russian name does not mean its description is Russian.
