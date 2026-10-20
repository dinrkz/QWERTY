# Member 3 handoff: Smart City acceptance baseline

Date: 2026-10-20. Branch: `work/qa/smart-city-acceptance`, based on `origin/main` at `5c36d22`. Regression commit: `f8daeac` (`test(qa): reproduce Smart City constraint and error regressions`). The following documentation commit and PR head identify the complete handoff.

Scope: Member 3 QA under `prompts/11_MEMBER_3_QA_AGENT.md`, excluding video and presentation work at the user's request. English reports and commits; multilingual request fixtures. The supplied PDF's Smart City section was compared with the preserved brief. Three independent read-only reviewers contributed; one reviewed the new tests.

## Changed files and ownership

| Paths | Change |
|---|---|
| `tests/acceptance/smart-city-input.test.mjs` | Three positive controls and eleven failing desired-behavior cases for optional amenities, Russian radius, first-visit/category interaction, durations and exclusions |
| `tests/acceptance/bounded-errors.test.mjs` | Two failing integration regressions through the active AI HTTP endpoint: selected error language and retrieval timeout classification |
| `docs/MEMBER_3_QA_REPORT.md` | Exact checks, baseline/environment, nine severity-ranked findings, reproduction steps, proposed minimum fixes and all acceptance-check statuses |
| `docs/TEST_SCENARIOS_AND_LIMITATIONS.md` | Current results, constraint limitations and corrected tracked-data disclosure |
| `docs/PRIVACY_AND_SAFETY.md` | Separate implemented application privacy controls from the tracked-source-data discrepancy and unverified deployment/history |
| `docs/SUBMISSION_CHECKLIST.md` | Current evidence and blockers; no incomplete artifact marked submitted |
| `docs/MEMBER_3_HANDOFF.md` | This scoped handoff |

No changes to application implementation, data, shared contracts, configuration, dependencies, lockfiles, README, root acceptance specification or existing tests. Private/runtime logs and tooling stay ignored. Existing collected data already tracked by the baseline was not added or removed here.

## Verification and known failures

- Existing application suite: 381 passed using the offline network guard.
- Python data suite: 188 passed with Python 3.14.3; warnings/expected negative-case diagnostics are noted in the report.
- Existing syntax check: 60 modules; both new test files separately pass `node --check`.
- New acceptance suite: **3 passed / 13 failed / 0 skipped / 0 TODO**, exit 1. These are deliberate assertions of the required behavior, not tests asserting that bugs should continue. Application fixes are pending; do not describe this branch as all tests green.
- README synthetic preview: six HTTP cases passed; no visual acceptance or real-world recommendation-quality claim.
- Clean AI startup: exit 1 due to unavailable ignored configuration, with no implicit offline substitution. Real generation/collection/routing was not repeated.
- PDF comparison: Smart City brief matches after whitespace/soft-hyphen normalization. The other CampusPulse track adds no requirements to Qadam.

Reproduce from the checkout root:

```sh
node --import ./scripts/app/offline-network-guard.mjs --test tests/app/*.test.mjs
python -B -m unittest discover -s tests/data -p "test_*.py" -q
node scripts/app/check.mjs
node --check tests/acceptance/smart-city-input.test.mjs
node --check tests/acceptance/bounded-errors.test.mjs
node --import ./scripts/app/offline-network-guard.mjs --test tests/acceptance/*.test.mjs
```

The last command currently exits 1. Shared `npm test`/`check` scripts do not include `tests/acceptance`; only Member 2 should decide and implement their integration. No skip, expected-failure annotation or weaker existing assertion masks these defects.

## Owner requests and next dependency

1. Member 1 / integration lead: QA-01 source publication basis and inaccurate README/setup claims; QA-07 permitted, sourced descriptions for the core scenarios.
2. Member 2: QA-02 through QA-06 request interpretation, QA-08 selected-language errors and QA-09 timeout guidance. The report gives exact inputs and minimum proposed changes.
3. Member 3: after the user assigns fixes and their owner implements them, rerun affected acceptance and existing checks; record human relevance results separately.

Per the user's agreed workflow, this increment reports defects for their next instruction. It does not silently fix another member's code, publish media, call paid generation or merge into `main`. Integrate through a reviewed PR after synchronization; use `git log --graph --oneline --decorate` to inspect the two QA commits and their baseline.
