# Member 1 — source feasibility handoff

Date: 2026-10-18. Branch: `work/data/source-feasibility`, based on `origin/main` commit `155b7e4`. The deliverable commit is the commit containing this file; resolve it with `git log -1 --format=%H -- docs/MEMBER_1_HANDOFF.md`.

## Current increment — probe recovery, validation and offline tests

The user authorized review, commit and PR #4 update of the remaining probe recovery work, with no provider requests and no dataset publication. This increment publishes the previously local recovery tooling and tests; it does not run the historical probe again. Current status here supersedes the earlier preparation-stage statements below.

The first-anchor recovery preserves the first spent attempt and permits at most nine additional attempts. The transcript-bound completion path preserves five attempts; its final-four variant preserves all six attempts, including the failed validation dispatch, and never repeats that slot. Exact ledger/transcript approvals, exclusive locking, durable reservations before dispatch and refusal of repeat recovery retain the cumulative ten-attempt ceiling. Opaque provider IDs remain intact; malformed rows produce fixed aggregate quality counters without persisting source records or provider error text. The PowerShell helper is an explicitly interactive live launcher; the Python probe/completion CLIs default to offline dry runs.

Owned changes: `scripts/data/probe_2gis.py`, `scripts/data/finish_2gis_probe.py`, `scripts/data/run_2gis_probe.ps1`, `tests/data/test_2gis_probe.py`, `tests/data/test_2gis_finish.py`, `tests/data/test_2gis_recovery.py`, `docs/2GIS_PROBE_PLAN.md`, `docs/2GIS_PERMISSIONS_INQUIRY.md`, `docs/DATA_SOURCE_FEASIBILITY.md`, and this focused handoff. Documentation distinguishes historical runs from current status and retains the optional, unsent permissions inquiry. No shared contracts, dependencies, application modules or collector behavior changed. Private chronological handoff observations are preserved in ignored `data/runtime/`, not included in the public handoff.

Verification: **156 offline tests passed in an isolated export of the exact staged file set**: 68 2GIS probe/recovery, ten Wikidata probe, 66 collector/live-adapter and 12 walking-audit tests. Independent read-only code review passed the 68 probe/recovery tests with no actionable findings; a separate documentation review corrected stale claims and removed private source/account details. All three Python probe/completion default dry-run variants passed with zero network requests; PowerShell syntax and embedded approval hashes checked successfully. No configured application lint/type/build checks exist. Provider requests, real credentials and application acceptance checks were not used in this review.

The historical probe remains exhausted at ten counted attempts. The separate private collector remains at **11/12** attempts and **73 unique records**, with the original snapshot and probe ledger unchanged. Nothing under `data/`, no credentials and no source payloads are included in this increment. Storage/indexing/AI-processing/redistribution rights and the integration lead's shared contract remain unresolved; publishing these tools grants no new execution budget.

## Previous increment — collector limits and safe pending-query revisions

The user authorized review, commit and PR #4 update of the remaining collector fixes with no provider calls and no dataset publication. Corrected all twelve public-plan demo pages from 50 to 10 and reject larger live pages before key reads or dispatch. Added bounded spatial searches with omitted `q` (blank/null remain invalid), and an explicit prior-manifest hash for changes to unreserved requests. Existing query fingerprints, attempt accounting and raw-response archives remain stable.

Independent review found that the original revision guard protected counted requests only when the revision flag was supplied. The fix compares every counted request with its immutable archived original before every uncached dispatch, even if the mutable current manifest was changed. A missing current manifest stops continuation before credential/transport gates; an exhausted budget still reports exhaustion. Cached repeats remain offline. Both new regressions failed before the fix and passed afterward.

Owned changes: `scripts/data/collect_2gis.py`, `scripts/data/live_2gis_collector.py`, `scripts/data/2gis_collection_plan.json`, their two collector test files, `docs/2GIS_COLLECTOR.md`, `docs/2GIS_LIVE_PLAN.md`, `docs/DATA_PLAN.md`, historical `docs/2GIS_PREFLIGHT.md`, and this focused handoff. No shared contracts, dependencies or application modules changed. Earlier probe-recovery code/tests and detailed private collection history are excluded. The public preflight retains technical limitations and historical source references; account-specific observations and source records stay private.

Verification: **118 offline tests passed in an isolated export of the exact staged file set**, including 43 collector and 23 live-adapter tests. Both default CLI dry runs passed with live execution disabled and zero requests. The public template digest is `73a19dc0e195ace500f769363754fa6bd8c50aef26a1f3df34608a5724bc198f`. Independent final code review passed all 43 collector engine tests; the combined collector/live suite passed 66. No 2GIS/OpenAI request, key read, collection retry or dataset change occurred. Private integrity review still reports 73 unique records and 11/12 collector attempts, with ten historical probe attempts unchanged. Provider rights and application integration remain unresolved. These changes neither reset the budget nor authorize additional live execution.

## Previous increment — offline walking relevance audit

User authorized offline filtering of all saved places, preservation of originals and no further API calls. Added owned `scripts/data/review_walking_dataset.py`, `tests/data/test_walking_dataset_review.py` and [audit documentation](WALKING_DATASET_REVIEW.md). No shared interface, dependency or configuration changes. Separate independent coffee/noncoffee reviews cover all 73 records: **45 relevance candidates, seven review, 21 excluded** from these scenarios, with all originals retained. Version-bound private annotations preserve evidence, caveats and automated decisions; invalid/stale reviews cannot promote unsupported records. Private final report: `data/private/walking-review-final/README.md` and `review.json`; review helpers/annotations remain in `data/runtime/walking-review/`.

The audit screens short walks, first visits and coffee stops at three simulated anchors using explicit round-trip travel/visit assumptions. Bayterek is the strongest visitor sample; Mega has only one candidate for the illustrative 60-minute round trip. Quietness, sockets and seating are unverified. No fabricated descriptions, current-opening claims or live-RAG success. A raw-evidenced duplicate garden building is excluded from additional destination candidates; galleries and coffee points retain their distinct categories. Every source record, including excluded/review records, stays in the original snapshot.

Verification: **110 offline data tests passed in an isolated export of the staged file set**, including 12 new audit behavior tests; offline `--help` passed. The full local workspace previously passed 154 tests, which includes separate uncommitted work. Independent code review found an annotation promotion guard gap; fixed with a regression test. Precommit review reproduced the identical private report using the already committed collector helpers. Original snapshot remains `7be51dabbc0dfbb224700678cbaf795d834cd9c973ebffa348cb3bc81aaca7cc`; collector stays **11/12** plus ten historical attempts. No provider API request, embedding/index creation or OpenAI call occurred. Only the audit script/tests/documentation are included in this commit; earlier collector/probe changes remain local. Provider rights and the integration lead's shared contract remain unresolved. Audit counts are relevance assessments, not 45 verified accessible or demo-ready destinations.

## Previous increment — live adapter and finalized plan, no execution

2026-10-18. Branch `work/data/source-feasibility`; resolve this commit with `git log -1 --format=%H -- scripts/data/live_2gis_collector.py`. New owned files: `scripts/data/live_2gis_collector.py`, `scripts/data/2gis_collection_plan.json`, `tests/data/test_2gis_live_collector.py`, `docs/2GIS_LIVE_PLAN.md`; updated the collector's locked pre-dispatch hook/default displayed plan, collector operating notes, data plan and this handoff. No shared application contracts, dependency manifests or root configuration changed. Earlier probe recovery work remains local and excluded from this commit.

The user selected Zhetysu Park / Shubar for two neighborhood queries. The finalized ceiling contains eight main-hub first pages, two neighborhood first pages, and two optional `сквер` hub refinements. All exact parameters and public/simulated anchor provenance are recorded. Manifest digest at preparation: `3eb0f080102f290fc6330154d7c5b80017dc1618386511f10b6da1cd26d31f3c`; adding a valid storage basis changes it and requires fresh approval.

Prepared adapter requires exact manifest approval, one explicit request/one-attempt invocation, a recorded storage basis, current manually checked dashboard balance/date, ordered first-page execution and the current reviewed-snapshot token for continuation. Optional refinements additionally require a reviewed green-space gap. It loads a key only after locked state/quota/checkpoint checks, uses the existing twelve-attempt ledger, saves bounded HTTP error bodies, and never retries or follows redirects. Default commands remain offline and key-free.

Verification: **21 new live-adapter tests passed**; the committed file set contains 98 data tests, and the full local workspace contains 136 including uncommitted probe recovery tests. All tests use synthetic data and block networking. Default prepared-plan dry run passed; no real key was read, no new Places/OpenAI request was sent, and the ten-attempt historical ledger remains unchanged. Review regressions reproduced incomplete-plan dispatch through direct runner use and report/token mismatch after concurrent progress; both were fixed and retested. Independent read-only review checked dispatch ordering, quota/credential boundaries and redirect/error persistence. No live success or application acceptance completion is claimed. Prepared storage basis is still null; actual dashboard balance and explicit execution approval remain required before running.

## Published increment — offline collector saving, deduplication and resume

2026-10-18. Branch `work/data/source-feasibility`; resolve the collector commit with `git log -1 --format=%H -- scripts/data/collect_2gis.py`. New owned paths: `scripts/data/collect_2gis.py`, `tests/data/test_2gis_collector.py`, `docs/2GIS_COLLECTOR.md`; updated `docs/DATA_PLAN.md` and this handoff. No application modules, shared contracts, dependency manifests or root configuration changed. Earlier probe recovery code/tests and supporting evidence remain local and are excluded from this collector commit.

Implemented a standard-library offline collector engine with 12-new-attempt campaign accounting plus the ten historical probe attempts, reserve-before-dispatch, atomic credential-scrubbed response persistence, exact-ID deduplication with version/provenance preservation, immutable query manifests, cache reuse and deterministic offline replay. OS locks release on abrupt process exit; completed raw files reconcile after a crash, while uncertain attempts remain charged and stop further collection. Derived snapshots are selected only after both record and quality files are complete.

Default CLI prints the eight-query hub draft with four unresolved slots and no state mutation; `--replay` rebuilds saved pages offline. No network adapter/live CLI or credential loading is enabled. Injected synthetic transports exercise the collection engine. No new 2GIS/OpenAI calls or real collector outputs occurred in this increment. Records are staging data and marked demo-ineligible pending member 2's contract; storage basis remains unresolved.

Verification: **37 collector tests passed** including two real child-process crash tests; the committed scope contains 77 data tests, while the local 115-test suite additionally includes uncommitted recovery work. Default dry run passed. Read-only subagent review identified recovery, manifest integrity, encoded-secret redaction and serialized-size issues; these were fixed and regression-tested. See [collector operating notes](2GIS_COLLECTOR.md) for commands, files, scope and limitations. No application acceptance checks or live provider behavior were verified.

## Earlier increment — 2GIS probe implementation, offline only

Date: 2026-10-18. Branch: `work/data/source-feasibility`. This increment is prepared for [PR #4](https://github.com/dinrkz/QWERTY/pull/4); resolve its commit with the lookup above after committing. The user authorized review, commit and PR update, but no live 2GIS/OpenAI calls.

Owned changed paths: `scripts/data/probe_2gis.py`, `tests/data/test_2gis_probe.py`, `docs/2GIS_PROBE_PLAN.md`, `docs/DATA_PLAN.md`, `docs/DATA_SOURCE_FEASIBILITY.md`, and this handoff. The previously drafted `docs/2GIS_PERMISSIONS_INQUIRY.md` remains unsent. No shared contracts, dependencies, root configuration or Wikidata code changed.

Implemented a standard-library probe with network-free default, exact-plan approval gates, hidden key entry, fixed endpoint/queries, bounded response handling, no retry/redirect, and human anchor/relevance review. A fixed append-only ledger reserves attempts before dispatch; a lock prevents concurrent sessions, and existing or corrupt state refuses a new run. Failures/timeouts spend a slot. A 10-attempt ceiling and conditional slot 10 protect the budget within this checkout. Source records remain in memory; only aggregate diagnostics are saved. The guarded live path has not been executed.

Verification with Python 3.13.12:

```powershell
& 'C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe' -m unittest discover -s tests/data -v
& 'C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe' scripts/data/probe_2gis.py
git diff --check
```

Results: **40 tests passed** (30 new 2GIS tests, 10 existing tests); dry run printed the ten-slot manifest with zero requests and no secret prompt. Whitespace checks passed. No configured lint/type/build checks exist. The first ledger design encountered intermittent Windows `PermissionError` during file replacement; it stopped before further dispatch. Replaced that design with fsynced append-only JSONL snapshots; five repeated 26-test runs then passed, followed by expanded regression coverage. Tests use fake transport/responses and block socket connections; no live data or key was used.

Review fixes: persist aggregate response diagnostics before asking for relevance input, so cancellation does not lose information from a spent request; preserve numeric HTTP/API error codes while excluding provider messages and credential-bearing URLs. Both regressions failed before the fixes and passed afterward.

A read-only subagent reviewed quota enforcement, durable reservations, concurrency, redirects, response limits, secret handling and test coverage after these fixes; it reported no additional actionable findings. It made no edits or external calls. This does not replace human integration review or verify real provider responses.

Remaining: human code review, permission basis for transient inspection/diagnostics, and explicit live-budget approval. Rights for persistent storage/indexing/OpenAI/public redistribution remain separate unresolved gates. Live API behaviour, Astana field coverage, production collector/retrieval and all application acceptance checks remain unverified. No permission inquiry was sent and **zero 2GIS API requests** were made.

## Earlier planning update — 2GIS access and quota preservation, 2026-10-18

Local draft changes on `work/data/source-feasibility`; not committed or published by this drafting task. Owned paths for this increment: `docs/2GIS_PERMISSIONS_INQUIRY.md`, `docs/2GIS_PROBE_PLAN.md`, and updates to this handoff, `docs/DATA_PLAN.md`, `docs/DATA_SOURCE_FEASIBILITY.md`.

Created Kazakhstan demo access with the user's explicit authorization. Account-specific observations remain private. At this historical preparation stage, successful API calls were still untested. Drafted an unsent permissions inquiry and a maximum-ten-attempt probe specification; user currently authorizes planning only. No 2GIS or OpenAI API request was sent. No new script, fixture, shared contract, configuration or dependency was added. Existing Wikidata code is unchanged.

Verification for this documentation increment: checked official Places overview/items reference and local cross-references; `git diff --check` passed. No application tests or live probes were run for these prose changes. The future 2GIS script, offline quota tests, permission response and explicit live-run approval remain pending. Historical verification below belongs to the earlier Wikidata increment.

## Completed scope of the earlier source-feasibility increment

- Checked 2GIS source documentation and storage restrictions; account access and the applicable Astana agreement remain unresolved. The user explicitly prioritizes 2GIS as a main data source and first collector target; Wikidata is fallback/supplement evidence.
- Added a dependency-free Python Wikidata source probe and obtained a bounded live sample: 200 rows / 159 unique entities, including 125 with descriptions. This is exploratory evidence, not the final dataset.
- Proposed a Python retrieval boundary and POI/evidence conventions for member 2 to approve and record in the shared contract.
- Added focused tests for coverage reporting, malformed source data, failure handling and existing-run preservation.

## Changed files

- `scripts/data/probe_wikidata.py`
- `tests/data/test_source_probe.py`
- `docs/DATA_SOURCE_FEASIBILITY.md`
- `docs/DATA_INTERFACE_PROPOSAL.md`
- `docs/DATA_PLAN.md`
- `docs/MEMBER_1_HANDOFF.md`

The two local probe runs live under ignored `data/raw/`; they are not part of the commit. The source query is embedded in the script and successful collection can be reproduced subject to endpoint availability. Fresh source results may differ.

## Contract/configuration changes

No agreed application contract, runtime manifest, root config, or shared type was changed. Python backend was confirmed by the user; exact framework/minimum version remains pending. Source probe needs only the standard library. No keys or environment variables are required. Member 2 needs to record module paths, the accepted field/error definitions, category vocabulary and time-budget policy in `docs/CONTRACTS.md`.

## Verification

Commands run from the repository root with installed Python 3.13.12:

```powershell
& 'C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe' -m unittest discover -s tests/data -v
& 'C:/Users/arlan/AppData/Local/Programs/Python/Python313/python.exe' scripts/data/probe_wikidata.py --output-dir data/raw/wikidata-probe-20261018-02
git diff --check
```

Results: ten unit tests passed; whitespace check passed. The earlier live probe exited 0; the initial sandbox probe failed with `URLError` and correctly exited 1. Source details and timestamps are in [DATA_SOURCE_FEASIBILITY.md](DATA_SOURCE_FEASIBILITY.md). No application lint/type/build commands are configured. AT-05 and other project acceptance checks remain NOT RUN; this increment does not satisfy the complete collector acceptance check.

An intermediate test run hit Windows sandbox permissions in the system temporary directory. Tests now create and clean their temporary fixtures in ignored workspace-local `data/runtime/source-probe-tests/`; all six passed on rerun without changing assertions.

PR #4 review fix: added explicit validation of response objects, row objects, entity identifiers and consumed binding values. Numeric IDs and null/non-object optional bindings now produce a sanitized failure report and exit 1; omitted optional bindings remain valid unknowns. New regression cases reproduced failures before the fix; all ten tests passed afterward. This verification used synthetic responses and did not repeat the live network request. Tests assert that invalid responses produce no response snapshot or success counts and do not echo source text.

## Blockers and next dependency

1. Member 2: review [interface proposal](DATA_INTERFACE_PROPOSAL.md), record the agreed contract and production module ownership. Member 1 must not create competing shared types or edit application modules.
2. Team: provider storage/indexing/AI-processing/redistribution rights remain unresolved. The [optional inquiry](2GIS_PERMISSIONS_INQUIRY.md) is unsent; existing private collection does not establish those rights or authorize publication.
3. Member 1: use the saved private records and [offline review](WALKING_DATASET_REVIEW.md) to assess coverage and implement retrieval once the shared contract is agreed. No additional provider requests are authorized by this handoff.

Human review of this diff and evidence is pending. Member 2 owns integration; do not merge directly to main.
