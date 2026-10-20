# Qadam — Build with AI

Qadam (қадам, “step”) helps walkers and first-time visitors choose their next worthwhile stop in Astana. The three core scenarios are a short walk, discovering nearby sights, and a coffee/rest stop. See [the case](CASE.md) and [original competition brief](docs/HACKATHON_BRIEF_RU.txt).

**Current status: the main interface runs real RAG over saved places.** Three live browser checks passed: two walk options, three first-visit options and three coffee options. See [scenario results and eight-attempt accounting](docs/LIVE_INTERFACE_REVIEW.md). Collection, reviewed snapshots, Python retrieval and the JSON adapter work. Full human acceptance, source reuse permissions and final submission artifacts remain pending.

For the configured private dataset, run `npm.cmd run start:offline` and open the URL printed at startup (**http://127.0.0.1:3002** on the current computer). See [offline setup and limits](docs/OFFLINE_INTERFACE.md). The dataset and configuration stay outside Git; a clean clone runs synthetic tests and requires authorized local data provisioning for real offline searches.

For the current private live demo, use the [explicit activation command](docs/BOUNDED_INTERFACE.md#start) and open **http://127.0.0.1:3003**. The [map interface](docs/MAP_INTERFACE.md) has sidebar search, matching suggestion pins and pedestrian routes on selection. The main button retrieves saved places and asks AI to select grounded suggestions. [OpenStreetMap](docs/OPENSTREETMAP.md) loads on opening; choosing a suggestion sends rounded endpoints to FOSSGIS / Valhalla for a walking route. The verified model is `gpt-5.4-mini`.

A separate [evidence contract and mocked generation flow](docs/GENERATION_EVIDENCE.md) is implemented for local development. Run `node scripts/app/demo-mock-generation.mjs` for an authored synthetic example. It uses no API, key or private dataset and is not connected to the browser interface.

**AI stays enabled by default for the current private demo. Start it with `node scripts/app/start-ai.mjs`.** Its [bounded connector](docs/BOUNDED_INTERFACE.md) uses the saved 100-request allowance, one in flight and no automatic retries. All 11 prior attempts remain counted. Starting or restarting never creates a new allowance. Historical pilot commands retain three-attempt defaults. The explicitly local `start-bounded.mjs` command without activation and the synthetic demo remain available for offline development; neither replaces the user's AI-default startup choice. The legacy live setup below does not use this budget.

## Run locally

Node.js **22.14+**; this integration was checked with Node.js 24.12 and Python 3.13. No third-party npm dependencies, framework, database or build step. For the separate live application setup, from the repository root:

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

## Data integration

Member 1 owns collection, normalization, provenance and Python retrieval. The Node server uses a **one-request JSON stdin/stdout process adapter**. The implementation is `scripts/data/retrieval_json_adapter.py`; its default live-app projection rejects saved private records. A separate isolated entry point and offline service consume its private envelope without provider interpretation or generation.

[CONTRACTS.md](docs/CONTRACTS.md) specifies the live protocol and offline extension. The server independently checks IDs, provenance, distance/time and hard constraints. The live validator remains strict; private nullable records are accepted only by the offline validator. Synthetic test records remain separately labeled.

2GIS is the prioritized source used for the saved collection. Access was exercised in earlier authorized probes/collection, but storage/indexing/OpenAI-processing/redistribution permissions remain unresolved. Offline evaluation does not authorize publication or external processing. See [retrieval setup](docs/OFFLINE_RETRIEVAL.md) and its collection/review references; starting the interface requires no new collection requests.

## Separate live recommendation flow

The following describes the implemented live-mode pipeline, whose real-provider acceptance remains pending. Private offline mode skips interpretation, generation and external map/device-location access; follow the offline setup above for saved records.

Manual/simulated location + text + available time → validated input → model interpretation of constraints → member 1 retrieval/filtering → deterministic output checks → real model composition over retrieved candidates → ID/evidence/activity validation → up to three alternative cards.

This is RAG and constrained composition, **not model fine-tuning**. The model selects retrieved places, evidence, supported reasons and safe activity ideas through a strict schema. Local RU/KK/EN templates render these choices; unrestricted model-authored factual prose is not displayed. Source names and descriptions remain in their original language. Human evaluation of relevance, wording and multilingual usefulness is still pending; template localization is not a claim that source descriptions are translated.

Cards distinguish source facts, generated ideas (or template ideas in an explicitly labeled retrieval-only fallback), distance/time estimates and uncertainty. Known closed/restricted places, expired/cancelled events and unsupported hard amenities cannot pass. Missing hours are unknown. A full visit must fit fresh schedule intervals when opening is required. Neither a venue's wheelchair tag nor geometric proximity proves an accessible walking route.

Travel uses straight-line distance × 1.3 at an assumed 4 km/h (2.5 km/h for a wheelchair requirement), category visit estimates, explicit return travel and buffer. These are planning assumptions, not verified routes or promised arrival times. Each card is an alternative, not a combined itinerary. Price/dietary/stairs/flight-destination constraints that cannot be represented require clarification.

## Try the separately configured live interface

1. Keep the clearly labeled simulated location or enter approximate coordinates. Device location is optional and requested only by a button.
2. Select RU/KK/EN, a short walk, a first visit, or coffee; enter your available time.
3. Try a mandatory quiet/socket/wheelchair requirement, return time or an event filter. Empty/uncertain results must remain honest.
4. Enable the map only if you want to send the map viewport to 2GIS. Without its public key the rest of the form remains usable.
5. Once permitted live-data and provider integration are ready, run [the acceptance scenarios](ACCEPTANCE_TESTS.md) with real data and record actual outcomes through member 3.

## Live-mode privacy and provider boundaries

No application accounts, conversation history, analytics, cookies, localStorage or request/provider logging. Location and query are transient. The browser rounds coordinates to three decimals before submission; manual callers can send more precision, which the server does not persist. The local retrieval child receives the request, but no OpenAI/map credentials; its stderr is discarded. The child must also follow the no-logging contract.

OpenAI receives the query (coordinate-like decimals redacted) for interpretation, then interpreted context and selected public POI descriptions/evidence identifiers for composition. It does not receive the dedicated user-coordinate fields. Free text can still contain addresses or personal information; avoid entering them. `store:false` is sent, but provider abuse-monitoring retention can still apply; no zero-retention promise is made. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

2GIS loads only after opt-in and receives map viewport/connection information. The browser-facing map key is intentionally public; backend keys are not served. Source text is rendered as text, not HTML. [2GIS setup](https://docs.2gis.com/en/mapgl/start/first-steps) and [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs) were consulted for the adapters. Live access, key restrictions, provider network requests and real retention/account settings still need verification.

## Verification and team handoff

`npm test` runs application tests, including the offline extension. `npm run check` checks JavaScript syntax; this is not a separate linter/type checker. No compiler or bundler is configured. Unit tests do not establish recommendation quality, permitted data collection, real API access or completion of project acceptance checks. Current offline verification evidence is in [OFFLINE_INTERFACE.md](docs/OFFLINE_INTERFACE.md).

See [member 2 handoff](docs/MEMBER_2_HANDOFF.md), [team workflow](TEAM_WORKFLOW.md), [contracts](docs/CONTRACTS.md), [scenario specification](docs/TEST_SCENARIOS_AND_LIMITATIONS.md) and [submission checklist](docs/SUBMISSION_CHECKLIST.md). Work goes through task branches and PR review; no direct main push. `old/` remains an archive.
