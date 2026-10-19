# Member 1 → member 2: implemented offline retrieval handoff

Prepared 2026-10-19. Status: implemented and reviewed for the user-authorized update to [PR #4](https://github.com/dinrkz/QWERTY/pull/4); private application integration remains pending. Branch `work/data/source-feasibility`; implementation commit `6a8ad7f26a1892242fadf19def69c93ee786f3e9`, based on `4d0971b`. Publication synchronizes `origin/main` at `b6c1e85608be426edb2c8db7dd747753513f5547`, including member 2's application commit `1661770e7e1310b40e696b20570be67818f12f6b` ([PR #5](https://github.com/dinrkz/QWERTY/pull/5)). The merge was conflict-free and its combined code passed the checks below. No direct message or PR comment was sent; the authorized PR update changes branch content and its description.

## Completed member 1 scope

| Files | Deliverable |
|---|---|
| `scripts/data/retrieve_saved_places.py` | Bounded snapshot/review loader, explicit code/policy binding, source-backed relevance, deterministic filters/estimates/ranking |
| `scripts/data/retrieval_json_adapter.py` | UTF-8 stdin/stdout transport; typed errors exit zero; default app mode rejects collected records; distinct private offline envelope |
| `scripts/data/evaluate_saved_retrieval.py` | Explicit private binding and 72-case evaluation; aggregate output, network traps, unchanged-input checks |
| `scripts/data/verify_retrieval_bridge.py` | Actual local Node consumer → Python child → Node validator checks with synthetic data |
| `tests/data/test_saved_places_retrieval.py`, `saved_retrieval_fixtures.py`, `saved_retrieval_bridge.mjs`, `retrieval_child_offline.py` | Synthetic regression fixtures, bridge checks and child network guard |
| `docs/OFFLINE_RETRIEVAL.md`, this handoff, prior plan/interface and member 1 handoff pointers | Current setup/contract reconciliation; prior proposals clearly superseded |

The retrieval increment edits no shared contract, dependency manifest, environment file, application module, collector or private source/review/ledger. The publication merge incorporates member 2's existing main-branch files unchanged.

## Decisions implemented on our side

1. Keep Node app and Python retrieval; adopt existing subprocess JSON transport and `QADAM_RETRIEVAL_COMMAND` argv configuration. Data paths are arguments because custom child environment variables are stripped.
2. Adopt app timing: 4km/h, detour1.3, maximum visit estimate across all mapped categories, return/buffer, radius default3km and limit1–10. Historical audit assumptions are labeled separately.
3. Use app vocabulary, retaining original fine categories/rubrics. Coffee points do not imply seating. Gallery remains unmapped, never falsely labelled museum. No accessibility→wheelchair inference.
4. `first_visit` remains context. Explicit offline `scenario` and `fine_categories` add intersecting filters. Empty interpreted app categories allow all supported reviewed categories; upstream unresolved constraints still need clarification.
5. Keep missing facts null. All amenities/hours/access remain unknown. Hard unknown requirements yield no match. Exact source versions, review reasons/caveats and uncertainty remain distinct.
6. Collected snapshots fail in default app-v1 mode with `DATA_UNAVAILABLE`. Private output is `{status:"offline_evaluation",contract:"qadam-private-retrieval-v1",result:...}`. The actual current validator rejects it. Extra flags on a normal v1 success would not enforce privacy.

These choices reconcile member 1's side without editing member 2-owned files. The private protocol is an application extension awaiting review, not an already accepted shared contract.

## Next scoped member 2 task

Review [the implementation/setup](OFFLINE_RETRIEVAL.md), then define an explicit **offline evaluation path before interpretation or generation** in your shared contract and application-owned tests. Validate the private envelope, nullable facts, version/review/policy identifiers and data-use eligibility; display uncertainty/review caveats; prevent provider processing. Keep the normal live path's source-description/evidence requirements. Decide gallery support and how the UI handles seated-rest requests without supporting evidence.

First reproduce the synthetic bridge against your local checkout. It needs no real dataset. Do not weaken the live validator or route the private envelope through the existing normal recommendation service. Later real-source generation requires a separate data-use decision and authorization. This handoff requests no API call, data transfer or merge.

## Verification evidence

- `python -m unittest discover -s tests/data -q`: **186 passed** (156 prior +30 retrieval), rerun after final code fixes.
- `python scripts/data/verify_retrieval_bridge.py --app-root data/runtime/member2-review-1661770 --node node`: **63 checks passed**, including 48 estimate cases, synthetic success/no-match/typed failures, collected-data blocking and private-envelope rejection by the unchanged app validator; rerun after final fixes.
- `python scripts/data/evaluate_saved_retrieval.py ...`: **72 cases passed**; 73 source records, 45 candidates/seven held/21 excluded; **seven original source/review/accounting files unchanged**. Final private aggregate report/binding: `data/runtime/retrieval-evaluation/report-v2.json` and `binding-v2.json`. Exact commands are in the setup document. Earlier v1 evaluation artifacts remain preserved.

Three independent final reviewers checked relevance/contract, privacy/reliability and setup/test behavior. Accepted fixes cover timezone offsets/ID controls, contextual first-visit behavior, opening/event no-match semantics, preserving review qualifications, common-category filter evidence, isolation of mutable returned data, UTF-16 app string limits and streamed integrity hashing. Tests exercise each behavioral fix. All three reviewers confirmed their final findings resolved by targeted follow-up inspection; the projection reviewer also reran the boundary regression.

Publication verification used an isolated export of the exact staged Git blobs after incorporating main: **186 Python tests, 205 application tests, 63 Node–Python bridge checks and syntax checks for 20 application JavaScript modules plus the bridge passed**. The bridge consumed the application from the same combined export, not a separately cached checkout. The application tests used synthetic fixtures, mocked providers and localhost HTTP; external provider calls were blocked and child environments excluded provider credentials. No actual provider/UI acceptance check is marked complete.

The saved-data evaluation was repeated separately against the unchanged local inputs: **72 cases passed, seven original files unchanged**, with aggregate evidence in ignored `data/runtime/retrieval-evaluation/report-publication.json`. Earlier reports/bindings remain intact. Code publication checks also verified the explicit file scope, local documentation links and synthetic JSON examples. All three publication subagents reported no actionable code/privacy defect; their status, estimate-case wording and exact-byte-binding clarifications were incorporated.

No data-provider API requests, provider credential reads or private-data uploads. GitHub access is limited to the authorized repository/PR publication. Python3.13 and Node24.12 tested. The combined repository uses member 2's existing `scripts/app/check.mjs`; no new dependency/build/type configuration was introduced.

## Remaining limits and data handling

All saved places remain `demo_eligible=false`; 69/73 descriptions and 42/45 candidate descriptions are missing. Verified source links, description languages and reuse references are also absent. Real app-v1 projection remains unavailable. Offline retrieval does not resolve rights, provide missing descriptions, verify pedestrian routes/access or prove recommendation quality.

Snapshot/review files, binding and aggregate report stay ignored. A clean clone runs synthetic tests; real evaluation requires separate authorized local provisioning. No dataset transfer is included. Existing accounting remains collector11/12 plus historical probe10/10; this increment used zero requests and grants no additional collection budget.
