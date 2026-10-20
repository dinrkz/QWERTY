# Submission checklist

Status on 2026-10-19: collection, private retrieval and all three basic live RAG browser scenarios work. [Interface evidence](LIVE_INTERFACE_REVIEW.md) records the outcomes and eight historical attempts. Full manual acceptance and final deliverables are incomplete; unchecked boxes remain incomplete.

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
| Slides/PDF | Pending |
| Scenarios and limitations | [TEST_SCENARIOS_AND_LIMITATIONS.md](TEST_SCENARIOS_AND_LIMITATIONS.md) — engineering evidence and pending manual acceptance |
| YouTube demo | Pending |
| Local demo video | Recorded October 19: 4:40, 1080p, English captions, three live AI scenarios and two routes; full decoding and sampled visual review passed. Video remains private under ignored `data/runtime/`; reproducible scripts in [scripts/demo](../scripts/demo/README.md). Not uploaded. |
| Collector run and dataset provenance | 73 private records; 45 reviewed candidates, seven held and 21 excluded; [handoff](MEMBER_2_RETRIEVAL_HANDOFF.md) |
| Real RAG | Three browser scenarios passed: two walk, three first-visit and three coffee alternatives; [evidence](LIVE_INTERFACE_REVIEW.md) |
| Acceptance results | Full manual checks pending; automated checks are not a substitute for relevance review |
| Known remaining issues | 42/45 candidate descriptions missing; source-use/redistribution permission unresolved; clean setup, slides, rehearsal, YouTube upload and final judge access pending |

Confirm the actual deadline, exact numerical weights, and submission destination from the organizers when available. Do not substitute the old HackAlem rules. Upload/publish only with user authorization for the relevant destination.
