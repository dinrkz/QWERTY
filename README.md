# Qadam — Build with AI

Qadam (қадам, “step”) helps walkers and first-time visitors choose their next worthwhile stop in Astana. The three core scenarios are a short walk, discovering nearby sights, and a coffee/rest stop. See [the case](CASE.md) and [original competition brief](docs/HACKATHON_BRIEF_RU.txt).

**Current status: member 2 application increment, not a completed live demo.** The local web interface, OpenAI adapter, request interpretation, structured recommendation generation, output validation and failure states are implemented. Member 1's real collector/snapshot/retrieval, source permissions and cross-language adapter are not integrated. OpenAI account/model/balance and the 2GIS map key have not been verified. Tests use clearly labeled synthetic records and provider doubles; they are not evidence of live RAG. Slides, YouTube recording and submission remain pending.

## Run locally

Node.js **22.14+**; development checks run with Node.js 24.21.0. No third-party npm dependencies, framework, database or build step. From the repository root:

```powershell
npm.cmd ci --ignore-scripts --offline
npm.cmd test
npm.cmd run check
npm.cmd start
```

On other shells use `npm` instead of `npm.cmd`. Open **http://127.0.0.1:3000**. The app binds to loopback only. Without configuration it shows the input UI and an honest unavailable-data/AI state; no fake recommendation is substituted.

To configure locally, copy the secret-free example once if `.env.local` does not already exist, then edit that ignored file in your editor. Never paste credentials into chat or Git:

```powershell
Copy-Item .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Existing server-only OpenAI key. User chose to configure it locally. |
| `OPENAI_MODEL` | Explicit account-accessible model supporting Responses API strict structured output. No model/access/balance is presumed or silently selected. |
| `QADAM_MAP_PUBLIC_KEY` | Separate 2GIS key intended for browser map use; restrict it in the provider account. Never reuse the OpenAI or a secret Places key. |
| `QADAM_RETRIEVAL_COMMAND` | JSON array containing member 1's retrieval executable and arguments. See contract below. No shell interpretation. |
| `PORT` | Local port; default `3000`. |

Restart after changing configuration. The UI reports configuration presence only, not verified account access. A single request can make two paid OpenAI calls (interpretation and recommendation composition), with output limits and no automatic retries. The remaining account budget must be checked by the team.

## Data integration — next dependency

Member 1 owns automated collection, normalization, provenance, snapshot and retrieval. Its source-feasibility branch proposes Python; this application's Node server supports a **one-request JSON stdin/stdout process adapter**, preserving Python ownership. The executable does not exist in this branch. Do not point it at a hand-written canned answer.

[CONTRACTS.md](docs/CONTRACTS.md) specifies every request/POI/result field, units, evidence, errors, time/freshness assumptions and exact file ownership. Member 1 must review it and implement the adapter. It accepts one normalized request on stdin and returns retrieved candidates from a real permitted snapshot on stdout. The server independently checks IDs, provenance, estimated distance/time and hard constraints before generation. It rejects synthetic datasets in normal runtime. No competing collector/search implementation has been added here.

The existing member 1 branch contains feasibility research and a Wikidata probe, not a finished permitted snapshot/retrieval service. 2GIS remains the map choice and priority candidate POI source; access and storage/indexing/OpenAI-processing/redistribution rights must be established by member 1 before integration. No ingestion/refresh command is claimed here because that deliverable is absent.

## How recommendations work

Manual/simulated location + text + available time → validated input → model interpretation of constraints → member 1 retrieval/filtering → deterministic output checks → real model composition over retrieved candidates → ID/evidence/activity validation → up to three alternative cards.

This is RAG and constrained composition, **not model fine-tuning**. The model selects retrieved places, evidence, supported reasons and safe activity ideas through a strict schema. Local RU/KK/EN templates render these choices; unrestricted model-authored factual prose is not displayed. Source names and descriptions remain in their original language. Human evaluation of relevance, wording and multilingual usefulness is still pending; template localization is not a claim that source descriptions are translated.

Cards distinguish source facts, generated ideas (or template ideas in an explicitly labeled retrieval-only fallback), distance/time estimates and uncertainty. Known closed/restricted places, expired/cancelled events and unsupported hard amenities cannot pass. Missing hours are unknown. A full visit must fit fresh schedule intervals when opening is required. Neither a venue's wheelchair tag nor geometric proximity proves an accessible walking route.

Travel uses straight-line distance × 1.3 at an assumed 4 km/h (2.5 km/h for a wheelchair requirement), category visit estimates, explicit return travel and buffer. These are planning assumptions, not verified routes or promised arrival times. Each card is an alternative, not a combined itinerary. Price/dietary/stairs/flight-destination constraints that cannot be represented require clarification.

## Try the interface

1. Keep the clearly labeled simulated location or enter approximate coordinates. Device location is optional and requested only by a button.
2. Select RU/KK/EN, a short walk, a first visit, or coffee; enter your available time.
3. Try a mandatory quiet/socket/wheelchair requirement, return time or an event filter. Empty/uncertain results must remain honest.
4. Enable the map only if you want to send the map viewport to 2GIS. Without its public key the rest of the form remains usable.
5. Once member 1 and provider configuration are ready, run [the acceptance scenarios](ACCEPTANCE_TESTS.md) with real data and record actual outcomes through member 3.

## Privacy and provider boundaries

No application accounts, conversation history, analytics, cookies, localStorage or request/provider logging. Location and query are transient. The browser rounds coordinates to three decimals before submission; manual callers can send more precision, which the server does not persist. The local retrieval child receives the request, but no OpenAI/map credentials; its stderr is discarded. The child must also follow the no-logging contract.

OpenAI receives the query (coordinate-like decimals redacted) for interpretation, then interpreted context and selected public POI descriptions/evidence identifiers for composition. It does not receive the dedicated user-coordinate fields. Free text can still contain addresses or personal information; avoid entering them. `store:false` is sent, but provider abuse-monitoring retention can still apply; no zero-retention promise is made. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

2GIS loads only after opt-in and receives map viewport/connection information. The browser-facing map key is intentionally public; backend keys are not served. Source text is rendered as text, not HTML. [2GIS setup](https://docs.2gis.com/en/mapgl/start/first-steps) and [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs) were consulted for the adapters. Live access, key restrictions, provider network requests and real retention/account settings still need verification.

## Verification and team handoff

`npm test` runs member 2 unit tests. `npm run check` checks JavaScript syntax; this is not a separate linter/type checker. No compiler or bundler is configured. Unit tests do not establish recommendation quality, permitted data collection, real API access or completion of project acceptance checks.

See [member 2 handoff](docs/MEMBER_2_HANDOFF.md), [team workflow](TEAM_WORKFLOW.md), [contracts](docs/CONTRACTS.md), [scenario specification](docs/TEST_SCENARIOS_AND_LIMITATIONS.md) and [submission checklist](docs/SUBMISSION_CHECKLIST.md). Work goes through task branches and PR review; no direct main push. `old/` remains an archive.
