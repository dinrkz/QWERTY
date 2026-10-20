# Live interface verification — 2026-10-19

Three real OpenAI requests were made through the main browser button, using private saved-place retrieval and `gpt-5.4-mini`. Each returned `live_rag`; there were no retries. Source names, records and credentials are excluded from this report.

| Scenario | Simulated starting area / budget | Cards | Displayed total-minute estimates | Input / output tokens |
|---|---|---:|---|---|
| Short walk | Mega Silk Way / 60 min | 2 | 40, 51.8 | 882 / 276 |
| First visit | Bayterek / 90 min | 3 | 15.9, 48.5, 41.7 | 1,985 / 472 |
| Coffee stop | Bayterek / 45 min | 3 | 25.8, 29, 29.6 | 1,682 / 407 |

All eight displayed alternatives fit their individual time budgets; cards are alternatives, not a combined route. Walking estimates are heuristic, not verified paths. Walk results were park-category records. First-visit results included one record with a source description; two lacked descriptions. Coffee results disclosed unknown seating/takeaway evidence. Unknown hours/access and missing descriptions remained visible. ID/evidence checks ran before display. This establishes the three basic live flows, not full human acceptance of every constraint or multilingual scenario.

These requests consumed 5,704 reported tokens. Five earlier attempts remain counted, making eight total attempts, including failed/uncertain calls. See [earlier pilot history](LIVE_PILOT.md). Token usage is not the remaining account balance. The exhausted UI test ledger remains in ignored `data/runtime/openai-interface-test-2026-10-19`; no allowance was reset. Eight original source/review/binding/accounting files matched their pre-run hashes. No new 2GIS request was made.

## UX changes and review

- The main button performs retrieval and AI selection directly, with a short transfer disclosure; the technical preview panel is hidden in active AI mode.
- Named starting points come first. Optional keyword search and coordinate editing use expandable sections; invalid hidden inputs expand for correction.
- The form shows remaining requests and explicitly changes to local search when exhausted. A pending request locks controls until accounting refresh completes, then restores their original enabled states.
- Typography and spacing were tightened. Source details retain estimate assumptions and an explicit explanation that AI selections use application wording templates.

Independent read-only agents reviewed UX, accounting and request-state behavior. Findings fixed: prior-budget integrity is validated before a new allowance; controls restore even if readiness changes; every browser module is served; tablet layout stacks before cards become cramped; important text is larger; and errors receive focus. The final guarded application suite passed 368 tests; 53 JavaScript modules passed syntax checks. No further provider call was used for these fixes.

The map now supports choosing a start by click or keyboard panning plus **Use map centre**. Both were verified in the browser, updating the local point/green marker without changing the AI request count or snapping the viewport. Inputs are rounded to three decimals; out-of-coverage picks are rejected. Selection clears old results and waits for an explicit search. Manual coordinates and named presets remain available.

A separate interactive allowance was prepared with three attempts, all 45 reviewed candidate records and the same five-record maximum per request. It carries the eight earlier attempts forward. The UI displays its current remaining count; user clicks may spend it. Read-only accounting can be rechecked with `node scripts/app/review-interface-run.mjs data/runtime/openai-interactive-2026-10-19`; no key/provider is needed.

## Remaining limits

The local review contains 45 candidate places, with descriptions missing for 42. Opening/access, amenities and routes are not assumed. The interface uses structured filters rather than model interpretation of free-text constraints. Selected evidence is sent to OpenAI only on the AI action; the full dataset remains private and outside Git. Operator approval does not establish 2GIS reuse rights. Submission slides/video, clean-environment setup and full acceptance remain incomplete.
