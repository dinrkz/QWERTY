# Member 1 — source feasibility handoff

Date: 2026-10-18. Branch: `work/data/source-feasibility`, based on `origin/main` commit `155b7e4`. The deliverable commit is the commit containing this file; resolve it with `git log -1 --format=%H -- docs/MEMBER_1_HANDOFF.md`.

## Completed scope

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
2. Team: obtain 2GIS Places access and confirm explicit rights for the intended dataset and AI use. Prioritize its Astana coverage/field checks before expanding fallback work. No 2GIS account was created and no external message was sent.
3. Member 1 next increment: implement the 2GIS collector once access/rights are established, plus normalization/provenance, validation and retrieval against the agreed contract; add a permitted snapshot and behavior tests. Consider supplements only for measured gaps or a concrete blocker.

Human review of this diff and evidence is pending. Member 2 owns integration; do not merge directly to main.
