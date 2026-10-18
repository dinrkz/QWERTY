# Offline walking-scenario audit

Member 1 owns `scripts/data/review_walking_dataset.py`, its focused tests and this documentation. This audit reads the collected snapshot and writes a separate, private assessment. It does not change the application contract, source records, collector ledger or demo-eligibility flags. No network, credentials, embeddings, retrieval index or generated descriptions are used.

## Reproduce locally

Use an existing content-addressed collector snapshot. Output must be a **new** directory beneath `data/private` or `data/runtime`, outside the input snapshot. These locations are Git-ignored. Reusing an existing output directory fails instead of overwriting it. A clean checkout can run the synthetic tests without a dataset; auditing real places requires the separate private input files.

```powershell
python scripts/data/review_walking_dataset.py --snapshot data/private/2gis/7be51dabbc0dfbb224700678cbaf795d834cd9c973ebffa348cb3bc81aaca7cc --annotations data/runtime/walking-review/annotations.json --output data/private/walking-review-rerun
python -m unittest discover -s tests/data
```

The snapshot and reviewer annotations are private local artifacts, not included in Git. Without `--annotations`, the utility performs a conservative automated assessment and holds every nonempty source schedule comment for interpretation. It never assumes such a comment establishes unrestricted availability. The independently reviewed annotations can resolve those holds, while preserving the source comment, automated decision and reviewer caveats. No-category, generic, building and unsupported-type records cannot be promoted to candidates.

Review annotations are tied to the snapshot, file hash, exact ID set and each source version. Changing data requires a new review; stale or incomplete annotations fail. The snapshot content hash and all version hashes are checked before assessment. Same-address/nearby records are flagged for review, never automatically merged.

An annotation file contains `source_snapshot` (snapshot directory's content hash), `input_pois_sha256` (SHA-256 of the exact `pois.jsonl` bytes), and an `assessments` array with exactly one entry per input record. Each entry requires `id`, `source_version`, `status` (`candidate`, `review` or `exclude`) and a nonempty `reason`; `caveats` and `review_source` can preserve the review evidence. Keep annotations private because they can contain source facts. Omitting annotations produces the automated assessment rather than the independently reviewed counts below.

## Meaning of results

- **Candidate:** source-category relevance supports consideration for at least one selected scenario. It does not establish current access, hours, route suitability or application readiness.
- **Review:** category/entity evidence or visit conditions are unresolved. Held out of scenario candidate lists.
- **Exclude:** outside the selected scenarios or duplicate/context-only representation. Retained unchanged in the original dataset.

Categories use observed source rubric IDs, not venue names or search-query intent. Galleries remain distinct from museums; coffee points remain distinct from coffeehouses. Administrative-area park records can qualify through an explicit park rubric; city/district context and name-only green areas do not qualify merely because they appeared in a search. Source text and comments remain untrusted data.

Each of three simulated anchors is evaluated for a short walk (30/60 minutes), first visit (60/90 minutes), and coffee stop (30/45 minutes). The audit uses a 2 km straight-line screen, compares unrounded distances, and assumes round-trip travel at 80 m/min with a 1.3 distance multiplier. These are analyst assumptions, not verified walking routes. Visit-time assumptions are recorded per category in `review.json`; travel plus visit must fit. Candidates are alternatives, not a multi-stop route. Changing return assumptions or pace would change counts.

No opening-hours engine or current availability claim is implemented. Missing schedule days remain unknown. Seating, quietness, sockets, accessibility and child suitability are unverified in this snapshot. Any requested hard amenity yields no supported match; coffee category alone cannot satisfy a seated-rest requirement. This audit is not a production retrieval API or a completed acceptance test.

## Current reviewed snapshot — 2026-10-18

All 73 records reviewed independently across coffee and noncoffee scopes: **45 relevance candidates, seven held for review, 21 excluded from the selected scenarios**. Candidate categories comprise 25 coffeehouses, four coffee points, six parks, two museums, five galleries and three sights. These counts precede distance/time filtering. The seven held records include a name-only coffeehouse, appointment-dependent museum, three name-only green areas, football-field area and historical EXPO context.

Main findings:

- Bayterek supports the strongest first-visit sample. Named sights and parks are available, but most factual descriptions remain absent.
- Mega's walking sample is thin: one candidate fits the illustrative 60-minute round trip. Do not fabricate extra options or substitute residential complexes for parks.
- Zhetysu supports nearby walking. A 30-minute round trip plus the assumed 20-minute coffee visit does not fit the collected coffee locations; the 45-minute check shows the effect of a larger budget.
- A generic building duplicates a named garden in the private evidence; suppress it as an additional destination while retaining both source IDs. Exact source facts and IDs remain in the local review.
- Malls, containing administrative areas, historic EXPO text, residential buildings and unrelated businesses do not become primary walking destinations just because the search returned them.
- All 30 coffee-related records lack descriptions and verified seating/quietness/sockets. Overall, 69/73 records lack descriptions. Do not fill these gaps with invented venue facts.

Detailed records, reviewer caveats, per-scenario exclusions and estimates are stored locally in `data/private/walking-review-final/`. Independent source reviews and reproducible helpers remain in `data/runtime/walking-review/`. Provider rights and the integration lead's shared contract remain unresolved; all records retain their original demo-ineligible status. No additional provider request was made: collection accounting remains 11/12, with ten historical probe attempts.

Verification: **110 offline data tests passed in a clean export of the staged file set**, including 12 focused audit tests; the offline `--help` command also passed. The full working tree previously passed 154 tests, including earlier uncommitted probe/collector work; that is not this commit's test count. Audit tests cover misleading names, unknown amenities, source comments, distance/time boundaries, invalid input, no-merge behavior, snapshot preservation, stale reviews and unsupported-type promotions. Independent code review identified the latter promotion guard; it was fixed and regression-tested. A precommit subagent rebuilt the final private report using the collector module from committed HEAD and obtained the identical result, proving independence from local collector edits. No configured lint/type/build checks exist for this standalone data tooling.
