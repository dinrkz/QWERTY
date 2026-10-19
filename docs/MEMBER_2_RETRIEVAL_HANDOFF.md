# Member 1 → member 2: implemented offline retrieval handoff

Prepared 2026-10-19. Status: implemented and reviewed for the user-authorized commit and update to [PR #4](https://github.com/dinrkz/QWERTY/pull/4); private application integration remains pending. Branch `work/data/source-feasibility`, implementation base `4d0971b6f88b2dfe3cc7d906e0fab53990215bc3`. Resolve the implementation commit with `git log -1 --format=%H -- scripts/data/retrieve_saved_places.py`. Tested consumer: member 2 commit `1661770e7e1310b40e696b20570be67818f12f6b` ([PR #5](https://github.com/dinrkz/QWERTY/pull/5)). Publication preflight fetched `origin/main` at `b6c1e85`, which includes that application. No direct message or PR comment was sent; the authorized PR update changes branch content and its description.

## Completed member 1 scope

| Files | Deliverable |
|---|---|
| `scripts/data/retrieve_saved_places.py` | Bounded snapshot/review loader, explicit code/policy binding, source-backed relevance, deterministic filters/estimates/ranking |
| `scripts/data/retrieval_json_adapter.py` | UTF-8 stdin/stdout transport; typed errors exit zero; default app mode rejects collected records; distinct private offline envelope |
| `scripts/data/evaluate_saved_retrieval.py` | Explicit private binding and 72-case evaluation; aggregate output, network traps, unchanged-input checks |
| `scripts/data/verify_retrieval_bridge.py` | Actual local Node consumer → Python child → Node validator checks with synthetic data |
| `tests/data/test_saved_places_retrieval.py`, `saved_retrieval_fixtures.py`, `saved_retrieval_bridge.mjs`, `retrieval_child_offline.py` | Synthetic regression fixtures, bridge checks and child network guard |
| `docs/OFFLINE_RETRIEVAL.md`, this handoff, prior plan/interface and member 1 handoff pointers | Current setup/contract reconciliation; prior proposals clearly superseded |

No shared contract, dependency manifest, environment file, application module, collector or private source/review/ledger changed.

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

No data-provider API requests, provider credential reads or private-data uploads. GitHub access is limited to the authorized repository/PR publication. Python3.13 and Node24.12 tested. No new lint/build/type configuration exists in member 1's scope. The app's earlier 205-test result is separate prior evidence until the synchronized branch's checks are recorded. No full app/provider/UI acceptance check is marked complete.

## Remaining limits and data handling

All saved places remain `demo_eligible=false`; 69/73 descriptions and 42/45 candidate descriptions are missing. Verified source links, description languages and reuse references are also absent. Real app-v1 projection remains unavailable. Offline retrieval does not resolve rights, provide missing descriptions, verify pedestrian routes/access or prove recommendation quality.

Snapshot/review files, binding and aggregate report stay ignored. A clean clone runs synthetic tests; real evaluation requires separate authorized local provisioning. No dataset transfer is included. Existing accounting remains collector11/12 plus historical probe10/10; this increment used zero requests and grants no additional collection budget.
