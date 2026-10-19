# Saved-place retrieval and member 2 JSON adapter

**Interface follow-up:** the user subsequently authorized application integration and its PR #4 update. The implementation now has a dedicated private offline UI; see [OFFLINE_INTERFACE.md](OFFLINE_INTERFACE.md). Historical integration-pending statements below refer to the earlier retrieval-only publication. The live validator and data-use restrictions remain unchanged.

Implemented on 2026-10-19, based on member 1 commit `4d0971b` and member 2 commit `1661770e7e1310b40e696b20570be67818f12f6b` ([PR #5](https://github.com/dinrkz/QWERTY/pull/5)). Publication preflight found the application merged into `origin/main` at `b6c1e85`. This document supersedes the executable-boundary proposals in [the earlier plan](OFFLINE_RETRIEVAL_PLAN.md) and [interface proposal](DATA_INTERFACE_PROPOSAL.md). Member 1 has not edited member 2's shared/application implementation; the private offline extension still needs their integration review.

## Implemented behavior

Python loads the immutable collector snapshot and matching annotations, validates bounded strict JSON, IDs, versions, provenance and field types, then checks a separately prepared code/policy binding. Only reviewed candidates with source-backed category/entity evidence enter retrieval. Hard filters precede deterministic ranking: distinct lexical token matches, full-precision distance, then full ID. Unknown preferred amenities earn zero credit. Retrieved text is untrusted data; names or text matches cannot promote held/excluded records.

No network, credential loading, embedding service, database or dependency installation is needed. The saved sample has 73 records: 45 relevance candidates, seven held and 21 excluded. All remain ineligible for demo/external processing. Missing facts stay null. Source-version evidence, reviewer reasons/caveats and source schedule comments remain separate. Local raw-response paths and user requests are not included in results.

## Reconciled contract

| Topic | Member 1 implementation |
|---|---|
| Runtime | Python standard library and member 2's existing Node app. Tested on Python3.13 and Node24.12; other versions unverified. |
| Core | `scripts.data.retrieve_saved_places.load_snapshot(folder, annotations, binding)` and `retrieve(request, snapshot)` |
| Transport | `scripts/data/retrieval_json_adapter.py`: one UTF-8 JSON request on stdin and one response on stdout. Input <=16 KiB; output <=512 KiB; no logs/prompts/tracebacks. Typed errors exit zero. |
| Configuration | Trusted arguments `--snapshot`, `--annotations`, `--binding`, optional `--mode offline`. Use the existing `QADAM_RETRIEVAL_COMMAND` JSON argv array; the app strips custom child environment variables. No new env file or shared configuration edits. |
| Request | Member 2's normalized fields, vocabulary and bounds, including timezone-qualified `now`; limit1–10. Reject booleans as numbers, malformed timestamps and unsupported fields. Outside coverage maps to `INVALID_INPUT` under the existing four-code process contract. |
| Defaults | Walking, radius3,000m, return false, buffer zero. Empty interpreted categories means all supported reviewed categories. `first_visit` is contextual, not a category filter. Upstream interpretation must resolve ambiguous text/hard requirements. |
| Offline extensions | Optional explicit `scenario`: `short_walk`, `first_visit`, `coffee_stop`; optional `fine_categories` from the original audit. These add intersecting filters; the existing app need not supply them. |
| Time | Haversine R=6,371,000m; outward=distance×1.3÷(4000/60 m/min), or 2500/60 if wheelchair required. Visit=max across ALL mapped POI categories: park20, museum45, landmark15, cafe25, event30. Total adds outward, visit, requested return and buffer. No pre-filter rounding. |
| Constraints | Amenities/access/operating status remain unknown. Required amenities, opening and current events yield `no_match` with reason codes. Unsupported travel mode gives `UNSUPPORTED_MODE`. Seating is not representable in app v1 and is rejected, never ignored. |
| Result | Core returns `ok`/`no_match`, candidates, total eligible count, warnings/reasons and snapshot/review/binding/policy identifiers. Candidate has `poi`, estimates, separate review metadata and uncertainty. Source POI coordinates are returned; original query/user coordinates are not echoed. |

Category mapping is an interpretation for retrieval, not a replacement for provider rubrics:

| Preserved fine category | App bucket |
|---|---|
| coffeehouse, coffee_point | cafe; coffee-point seating remains unknown |
| park | park |
| museum | museum |
| viewpoint, interesting_building, fountain, sculpture | landmark |
| gallery | Unmapped; excluded with `CATEGORY_MAPPING_UNSUPPORTED`, never relabelled museum |

Scenario/fine/broad category filters must match common evidence. Emitted categories and visit estimates still cover all mapped source categories to match member 2's independent validation. Original rubrics and fine categories remain visible in offline results. No accessibility→wheelchair inference occurs.

The old audit's 80m/min and fine-category visits are historical assumptions. Evaluation compares old/new estimates at the same explicit 2km radius and round trip; changed counts are recorded rather than forced to match. Places are alternatives, not stops of a verified walking route.

## Enforced private boundary

Default `app-v1` mode returns this for every collected snapshot, including records with descriptions:

```json
{"status":"error","code":"DATA_UNAVAILABLE"}
```

Only authored synthetic snapshots (`quality.source="Synthetic"`, every ID prefixed `synthetic:`) can use the v1 projection. Reserved `.invalid` URLs, description language and fixture-use statements are authored test metadata. They are never filled into real records. Missing descriptions or app-incompatible string lengths fail; synthetic success stays `dataset_kind="synthetic"`.

Explicit `--mode offline` wraps the core result:

```json
{"status":"offline_evaluation","contract":"qadam-private-retrieval-v1","result":{"status":"no_match","candidates":[]}}
```

This is a minimal shape illustration. The actual result carries the metadata described above. Member 2's current validator rejects the top-level status. Merely adding `demo_eligible=false` to a v1 success would be insufficient: the existing validator ignores extra flags. Do not connect private output to the normal recommendation service. Member 2 needs a distinct offline path before interpretation/generation that validates the envelope and never sends its data to providers.

Missing descriptions, verified description languages, URLs, source-update times and permission references remain null. Request locale is not source-language evidence. Raw schedules do not establish opening; no event/hours normalization or positive amenity evidence exists in this increment. Source/review data in private results remains untrusted text.

## Reproduce offline checks

From the repository root:

```powershell
python -m unittest discover -s tests/data -q
python scripts/data/verify_retrieval_bridge.py --app-root . --node node
```

The synchronized PR branch includes member 2's application, so `--app-root .` works from its clean checkout. It can also point to a separately provisioned local checkout of the reviewed member 2 commit. The helper fetches nothing and installs nothing. It imports member 2's actual retrieval transport, validator and policy; Node/Python child network traps remain active. All fixtures are synthetic. Child environments contain only required OS variables. Scratch fixtures are isolated under ignored `data/runtime/retrieval-bridge-tests/`; failures retain a synthetic-only diagnostic file there.

Private evaluation requires local snapshot/review provisioning. No dataset is provided by a clean clone. Existing local inputs:

- `data/private/2gis/7be51dabbc0dfbb224700678cbaf795d834cd9c973ebffa348cb3bc81aaca7cc/`
- `data/runtime/walking-review/annotations.json`

After reviewing the exact implementation/policy, explicitly prepare a NEW binding and aggregate report:

```powershell
python scripts/data/evaluate_saved_retrieval.py --snapshot data/private/2gis/7be51dabbc0dfbb224700678cbaf795d834cd9c973ebffa348cb3bc81aaca7cc --annotations data/runtime/walking-review/annotations.json --binding data/runtime/retrieval-evaluation/binding-v2.json --output data/runtime/retrieval-evaluation/report-v2.json --prepare-binding --now 2026-10-19T00:00:00Z
```

These filenames identify this increment's final local evaluation. To repeat without rebinding, omit `--prepare-binding` and choose a NEW output filename. After code changes, review them and choose NEW binding/report filenames. Existing files are never overwritten. Binding pins snapshot/file hashes, canonical annotations, assessment implementation and retrieval implementation/policy. Code hashes cover exact source bytes: Git CRLF/LF conversion or another checkout can invalidate a binding even at the same commit. Review the destination checkout and prepare a new local binding there; do not edit an old binding to bypass validation. It grants neither legal permission nor team-wide contract approval. Retrieval never refreshes it automatically or follows mutable `current.json`.

The evaluator traps network access, writes aggregates only under ignored storage, streams integrity fingerprints and verifies original source/review/accounting files before/after. Its 72 cases cover three simulated anchors, six scenario/budget combinations, return/buffer variants and six unknown-evidence constraints per anchor. The separate offline JSON adapter returns actual place data to its trusted local caller: keep that output private and out of tracked files. Do not persist personal-location requests through these evaluation tools.

## Verification and limits

Final commands/results and independent review fixes are recorded in [the member 2 handoff](MEMBER_2_RETRIEVAL_HANDOFF.md). This is tested offline retrieval and process transport, not live application integration. Source rights, description completeness, source links/language, gallery support and a redistribution-permitted demo snapshot remain unresolved. No full application/provider/UI acceptance check is marked complete. The original implementation used no network. The subsequent user-authorized publication permits GitHub fetch/push and PR #4 metadata updates, while data-provider API calls, provider credential reads and private-data transfer remain excluded. Member 2 owns the eventual PR merge.
