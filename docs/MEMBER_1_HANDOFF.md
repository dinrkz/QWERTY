# Member 1 — source feasibility handoff

Date: 2026-10-18. Branch: `work/data/source-feasibility`, based on `origin/main` commit `155b7e4`. The deliverable commit is the commit containing this file; resolve it with `git log -1 --format=%H -- docs/MEMBER_1_HANDOFF.md`.

## Current increment — offline walking relevance audit

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

Created organization `qadam` / Kazakhstan and demo key `qadam-data-dev` with the user's explicit authorization. UI evidence: Active Demo, expires 2026-11-18, Places API 0 / 1,000 at creation. Successful API calls are still untested. Drafted an unsent permissions inquiry and a maximum-ten-attempt probe specification; user currently authorizes planning only. No 2GIS or OpenAI API request was sent. No new script, fixture, shared contract, configuration or dependency was added. Existing Wikidata code is unchanged.

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
2. Team: 2GIS demo key creation is now complete; review the [unsent inquiry](2GIS_PERMISSIONS_INQUIRY.md), confirm the applicable permissions, and review the [probe plan](2GIS_PROBE_PLAN.md) before live execution. API response coverage is untested. No external message has been sent.
3. Member 1 next increment: implement the 2GIS collector once access/rights are established, plus normalization/provenance, validation and retrieval against the agreed contract; add a permitted snapshot and behavior tests. Consider supplements only for measured gaps or a concrete blocker.

Human review of this diff and evidence is pending. Member 2 owns integration; do not merge directly to main.
