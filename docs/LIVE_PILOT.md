# Saved-place OpenAI pilot — 2026-10-19

Follow-up: all three core scenarios subsequently passed through the browser main button, consuming three additional attempts and 5,704 tokens. The cumulative count is eight. See [LIVE_INTERFACE_REVIEW.md](LIVE_INTERFACE_REVIEW.md); the five-attempt table below preserves the earlier CLI history.

The real retrieval → OpenAI Responses → validated selection flow succeeded on the fifth total attempt. The first-visit scenario produced three recommendations in 5.2 seconds using `gpt-5.4-mini`: 1,897 input tokens and 420 output tokens. IDs, time budgets and activity labels passed validation. Wording is rendered through application templates from model-selected evidence/reason/activity codes; this is not unrestricted generated prose.

| Total attempt | Scenario | Observed result |
|---|---|---|
| 1 | Coffee near Bayterek | 15-second timeout; remote completion and token usage unknown |
| 2 | Walk near Mega Silk Way | 15-second timeout; remote completion and token usage unknown |
| 3 | First visit near Bayterek | Provider error; original diagnostics did not retain the HTTP status |
| 4 | First visit, separately approved diagnostic | HTTP 401, `invalid_api_key`; no retry |
| 5 | First visit, explicitly requested after key update | `live_rag`, three validated recommendations |

All five attempts remain counted. The original three-attempt pilot and both additional one-attempt allowances are exhausted. None was refunded or reset. Unknown remote processing/billing for attempts 1–2 remains unknown; successful-call token usage is not total account usage or balance. No new 2GIS request was made. Eight original data/review/binding/accounting files were unchanged after every run.

## Reproducible implementation and private evidence

The retained helper is [run-pilot.mjs](../scripts/app/run-pilot.mjs). `prepare` retrieves locally and initializes an exclusively created budget; `run` sends once and writes an aggregate report. `review` requires a completed sole local caller, preserves the unknown reservation/outcome, and writes a hash-bound receipt before unlocking. An explicit timeout extension preserves old authorization/manifest bytes. `prepare-diagnostic` requires an exhausted earlier run and carries its attempt count forward; it requires separate operator authorization, not automatic execution.

Private reports and immutable accounting remain in ignored `data/runtime/openai-pilot-2026-10-19`, `data/runtime/openai-diagnostic-2026-10-19` and `data/runtime/openai-diagnostic-2-2026-10-19`. The last directory contains `first_visit.report.json`. Authorization files contain private record/version IDs and must not enter Git. No raw provider output or key was saved in reports.

The helper reads `OPENAI_API_KEY` from the ignored root `.env` into the process. The browser launcher reads the process environment or an explicit `--env-file` only when activated. Do not confuse this helper with the separate legacy `.env.local` launcher. Neither a configuration change nor a restart replenishes an allowance. `prepare-interface` and `prepare-interactive` validate an exhausted prior budget, carry its count forward and exclusively create a separately authorized allowance; neither is called automatically by the server.

## Boundaries and verification

Requests contain at most five selected names, categories, approved existing descriptions, coarse estimates and structured filters. Dedicated coordinates, raw query, stable IDs and the full snapshot are excluded. Aliases are not anonymity: names and relative distances can identify the area. User transfer approval does not establish source reuse rights; historical eligibility flags remain unchanged.

Output limit stays 1,800 tokens. The first two attempts used 15 seconds; attempt 3 received an explicit reviewed extension to 60 seconds. Subsequent one-attempt authorizations explicitly use 60 seconds. Browser confirmation allows 70 seconds for that deadline plus local work. There are no automatic retries. Safe error diagnostics retain only HTTP status and an allowlisted error code, never provider messages or response bodies.

Before the map follow-up, the full guarded offline suite passed 362 application tests; 47 JavaScript modules passed syntax checks. Earlier unchanged Python/bridge checks passed 188 and 63 respectively. Independent reviewers checked accounting, grounding/privacy and demo readiness. Live UI visual acceptance and human relevance evaluation across all three core scenarios remain pending. This single success does not complete every acceptance check.

Official references checked on 2026-10-19: [model capabilities](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [data controls](https://developers.openai.com/api/docs/guides/your-data). `store:false` is set; it is not a zero-retention guarantee. Account balance and account-specific retention settings were not inspected.
