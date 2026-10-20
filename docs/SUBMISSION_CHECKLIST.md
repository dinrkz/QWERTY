# Submission checklist

Status on 2026-10-20: acceptance remains incomplete. [Member 3 QA](MEMBER_3_QA_REPORT.md) records 381 passing application tests, 188 passing Python tests, 60 syntax-checked modules and 13 failing new acceptance cases across seven application defects. Dataset publication evidence and missing descriptions remain unresolved. [Interface evidence](LIVE_INTERFACE_REVIEW.md) records historical live runs, not a new verification. Unchecked boxes remain incomplete.

The current Member 3 assignment excludes video and presentation creation/review/upload. These remain official submission requirements, with their status retained separately; exclusion from this assignment does not waive them.

## Required by the supplied brief
- [ ] Product concept and target-user scenarios match the implemented demo.
- [ ] Interactive prototype demonstrates several real or simulated requests/locations.
- [ ] Automated collection of real POI data is demonstrated and documented.
- [ ] High-level RAG explanation matches actual retrieval and generation.
- [ ] Recommendations show why, visit duration, activity, grounding, and uncertainty.
- [ ] Test-scenario and limitations document contains actual evidence and expected response types.
- [ ] Ethics/privacy notes describe actual location handling, misinformation controls, and user safety.
- [ ] Presentation PDF/slides exist and the talk is rehearsed to 5–7 minutes, including business idea, risks, limitations, and roadmap.
- [ ] Repository link or prototype archive is ready and accessible to judges.
- [ ] Demo is uploaded to YouTube and accessible by link.

## Team engineering checks
- [ ] All acceptance checks have a recorded result; unresolved failures are visible.
- [ ] Source access/reuse, attribution, and dataset redistribution terms have been checked.
- [ ] Clean setup works using only the README, actual configuration example, and documented data steps.
- [ ] Actual tests and applicable type/lint/build checks pass.
- [ ] No credentials or personal location histories appear in tracked files or recording.
- [ ] A dated valid dataset snapshot or permitted reproducible fetch supports the demo.

## Links and evidence
| Artifact | Current status / location |
|---|---|
| Repository | https://github.com/dinrkz/QWERTY — final submission content/access not yet verified |
| Slides/PDF | Previously reported locally in the README; not reviewed in this assignment |
| Scenarios and limitations | [TEST_SCENARIOS_AND_LIMITATIONS.md](TEST_SCENARIOS_AND_LIMITATIONS.md) and [current QA results](MEMBER_3_QA_REPORT.md) — reproducible failures, historical live evidence and pending manual acceptance |
| YouTube demo | Pending |
| Local demo video | Previously reported for October 19: 4:40, 1080p, English captions, three live AI scenarios and two routes; decoding and sampled visual review passed then. Historical location: ignored `data/runtime/`; [workflow](../scripts/demo/README.md). Not inspected or uploaded in this assignment |
| Collector run and dataset provenance | 73 collected records; tracked at inspected baseline. 45 reviewed candidates, seven held and 21 excluded; [handoff](MEMBER_2_RETRIEVAL_HANDOFF.md); publication-basis discrepancy in QA-01 |
| Real RAG | Historical October 19 browser evidence: two walk, three first-visit and three coffee alternatives; [evidence](LIVE_INTERFACE_REVIEW.md). Current clean-checkout AI startup lacks ignored configuration; no provider call was repeated |
| Acceptance results | New synthetic regressions: 3 pass / 13 fail, no skips; full manual relevance checks pending; [report](MEMBER_3_QA_REPORT.md) |
| Clean setup | README synthetic server and six HTTP smoke cases passed. Live configured setup remains unverified; no visual/browser acceptance claimed |
| Known remaining issues | QA-01 through QA-09: tracked source data versus unresolved publication evidence; optional/negative/time/distance request handling; first-visit category conflict; 42/45 descriptions missing; error language and timeout guidance. Final artifact availability and judge access remain unverified |

Confirm the actual deadline, exact numerical weights, and submission destination from the organizers when available. Do not substitute the old HackAlem rules. Upload/publish only with user authorization for the relevant destination.
