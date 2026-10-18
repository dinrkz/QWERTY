# Member 1 → member 2: offline retrieval handoff

Prepared 2026-10-18. Status: **proposal for PR review; member 2 agreement pending; no direct message sent**. Baseline code commit: `66d06f612e55b4a26ee135eff0e2c70d7cc15acf`, branch `work/data/source-feasibility`, [PR #4](https://github.com/dinrkz/QWERTY/pull/4). The user authorized publishing the four planning documents to this PR. Resolve the documentation commit with `git log -1 --format=%H -- docs/MEMBER_2_RETRIEVAL_HANDOFF.md`; it is separate from the code baseline. No merge or accepted application contract is implied.

Recommended next step: agree a small in-process Python retrieval contract, then let member 1 implement deterministic offline filtering/ranking over the saved private snapshot. Use [the detailed plan](OFFLINE_RETRIEVAL_PLAN.md) and [interface proposal](DATA_INTERFACE_PROPOSAL.md). No new API call, embedding service, database or model call is needed for this increment.

## What is ready

- Collector, durable accounting, normalized snapshots, offline replay and version-bound walking audit are implemented. Previous code verification: **156 offline tests passed** at `66d06f6`.
- A read-only check in this planning task confirms 73 unique saved records: 45 relevance candidates, seven held for review, 21 excluded. There are 69 missing descriptions. Every record remains `demo_eligible=false`.
- The private input is a pinned `pois.jsonl` + `quality.json` snapshot with all source versions/provenance, plus the matching review annotations. Local paths and fingerprints are in the plan. These files are not in Git and are not attached to this handoff.
- Collection remains 11/12 attempts plus ten historical probe attempts. No further request is authorized. The current source data and review are unchanged.

The audit is not production retrieval. There is no `docs/CONTRACTS.md` or agreed retrieval module in this checkout. A snapshot candidate is not a verified accessible destination or a completed recommendation. Source permissions and application integration remain unresolved.

## Decisions for the integration lead

| Decision | Member 1 recommendation |
|---|---|
| Missing descriptions | Allow structured-only records for **offline evaluation**; preserve null descriptions and `demo_eligible=false`. Keep the existing description requirement for demo eligibility pending a separate decision. Never generate source facts to fill gaps. |
| Retrieval boundary | `load_snapshot(snapshot_dir, review_annotations, policy)` then `retrieve(structured_request, snapshot, policy)`, in-process Python; agree import paths/types before implementation |
| Intent and categories | Explicit `short_walk`, `first_visit` or `coffee_stop`; optional categories constrained to the scenario; unresolved free-text intent/requirements return to the UI for clarification |
| Time policy | Start from audit assumptions: 2 km default straight-line radius, 80 m/min, 1.3 multiplier, explicit return flag and buffer; category visit estimates remain labeled heuristics |
| Ranking and output size | Hard filters first; supported preferences, lexical matches, full-precision distance, then stable ID; integer limit 1–20, default ten; display up to three alternatives |
| Hours and amenities | No open-now evaluation in v1. Unknown does not satisfy hard requirements. The present sample cannot support required sockets, quietness or seating. |
| Ownership/configuration | Member 2 records shared contract, Python minimum, configuration and application paths; member 1 owns retrieval implementation/tests; member 3 owns integration/acceptance review |

Record accepted decisions in member-2-owned `docs/CONTRACTS.md`; respond with the contract commit, exact module paths and any changes to this proposal. This is the next dependency, not a request to build all of member 1's scope.

## Division of the next increment

Member 1 implements the agreed loader, conservative review/category gate, deterministic filters/ranking, typed results/errors and offline tests. Proposed owned files are `scripts/data/retrieve_saved_places.py` and `tests/data/test_saved_places_retrieval.py`; neither exists yet. Source snapshots, annotations and ledger files stay untouched.

Member 2 owns structured request construction, shared types, UI and eventual generation/output validation. Initially consume synthetic fixtures and surface unknowns, no-match and invalid-input states. For any later generation step, enforce the returned ID/version allowlist and keep raw response paths, annotations and internal provenance out of browser/model payloads. Retrieval must precede generation; no live generation or source transfer is authorized by this plan.

Member 3 checks scenario adaptation, unknown facts, time budgets, privacy and grounding against the acceptance checks. No application acceptance check is marked complete by this handoff.

## Minimal synthetic contract example

Illustrative only: coordinates and request are synthetic, no real POI is embedded, and this is not executable retrieval output. A fixture snapshot with unknown socket evidence must yield the empty result below.

```json
{
  "request": {
    "latitude": 0.0, "longitude": 0.0,
    "query": "coffee with required sockets",
    "scenario": "coffee_stop", "categories": ["coffeehouse"],
    "available_minutes": 45, "travel_mode": "walking",
    "max_distance_m": 2000,
    "required_amenities": ["sockets"], "preferred_amenities": [],
    "return_to_start": true, "buffer_minutes": 0, "limit": 10
  },
  "expected_result_subset": {
    "status": "no_match",
    "candidates": [],
    "reason_codes": ["REQUIRED_AMENITY_UNVERIFIED"],
    "mode": "offline_evaluation"
  }
}
```

The full agreed response must also carry snapshot/review/policy identifiers, uncertainty and estimate labels as specified in the proposal. Invalid inputs, unavailable data and stale reviews are errors, not no-match results.

## Verification, privacy and blockers

Preparation used two read-only subagents for design and dataset readiness; publication received separate design and privacy reviews. Local documentation checks verify 21 links, two synthetic JSON examples, unchanged fingerprints for five private artifacts, and the four-document scope. No new application tests were run for these prose changes. The 156-test result above belongs to the existing code baseline; the proposed retrieval remains unimplemented.

Planning files: new `docs/OFFLINE_RETRIEVAL_PLAN.md`, new `docs/MEMBER_2_RETRIEVAL_HANDOFF.md`, revised `docs/DATA_INTERFACE_PROPOSAL.md`, and a pointer in `docs/MEMBER_1_HANDOFF.md`. No agreed contract, dependency, environment variable or application file changes.

Keep this handoff limited to code/design and aggregate evidence. A fresh clone lacks the dataset; member 2 can work with synthetic fixtures first. No actual source pages, place identities, coordinates, hours, detailed reviews, credentials or dataset files are provided here. Dataset transfer to another machine or provider is not part of this handoff. Rights for storage/indexing/AI processing/redistribution remain unresolved; the project owner's earlier local-save instruction does not establish them. No outreach is requested.

## Message to paste to member 2's agent

> Please review member 1's offline retrieval plan and interface proposal in PR #4, prepared against code baseline `66d06f6`. Read `docs/OFFLINE_RETRIEVAL_PLAN.md`, `docs/DATA_INTERFACE_PROPOSAL.md` and this handoff from the PR branch. You own `docs/CONTRACTS.md`; record the approved Python request/result schema, exact module ownership and the decisions listed above, especially structured-only offline evaluation with missing descriptions. Return the contract commit and import paths to member 1. Scope this step to contract review and synthetic application fixtures; do not implement member 1's retrieval module, copy or upload the private dataset, read provider keys, make data-provider API calls or merge the PR as part of this request. Treat the 73 saved records and their 45 relevance candidates as private evidence, not demo-ready recommendations. Keep source facts, estimates, reviewer judgments and generated ideas separate.
