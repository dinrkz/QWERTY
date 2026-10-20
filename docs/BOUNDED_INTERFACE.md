# Saved-place AI interface

Updated 2026-10-19, on `work/data/source-feasibility`; changes are uncommitted. The main button retrieves saved places locally, sends selected evidence to OpenAI, validates its selection and renders recommendations. All three core scenarios passed a real browser run; see [live interface evidence](LIVE_INTERFACE_REVIEW.md).

## Start

Without activation, `node scripts/app/start-bounded.mjs` serves local search and an optional technical evidence preview at `http://127.0.0.1:3003`. It does not read credentials or create an allowance. Both modes use ignored `data/runtime/offline-app.json`; a clean checkout needs authorized local data/configuration provisioning. Tests use authored synthetic records.

The user's standing preference is **AI enabled by default**. Restart the current private interface with:

```powershell
node scripts/app/start-ai.mjs
```

This loads the existing ignored `data/runtime/ai-default.json` choice. It points to a separately prepared **100-request** allowance, valid until **2026-11-18T16:01:59Z**, and the server-only environment file. All **11 prior attempts** remain counted in the linked history. The allowance is finite because the user previously asked not to spend all credits; the account balance is unknown. It is a request ceiling, not a monetary guarantee. Restarting does not replenish it. Missing/expired configuration fails startup explicitly instead of substituting local-only mode. This preference does not turn on background calls or automatic retries.

Preparation is an operator action: `run-pilot.mjs prepare-ai-default <new-private-directory> <exhausted-prior-directory>` verifies prior exhaustion and fingerprints, then creates a new allowance exclusively. The private startup choice has `schema_version: 1`, an absolute `activation_file`, and an absolute `env_file`; it must refer to that reviewed activation. Normal startup never creates or repairs accounting. Credentials, source IDs and budgets stay outside Git. Historical pilot preparation retains three attempts / six hours. The separate legacy `npm start` command does not use this setup; use `node scripts/app/start-ai.mjs` for this demo.

## User flow

1. Type a destination idea in the map sidebar, or choose a walk, first visit or coffee. Common RU/KK/EN categories and simple durations are recognized locally; this is a limited vocabulary, not unrestricted language interpretation. Complex or unsupported recognized requests ask for clarification. Names supply lexical ranking. Set hard constraints through the controls. Select a named simulated start or **Choose on map**, then click a point; keyboard users can pan and select the centre. Start selection does not submit a search.
2. Click the main AI button. Local retrieval and deterministic eligibility checks run first. At most five candidate names, categories, approved descriptions and coarse estimates reach OpenAI with structured filters. Raw query, coordinate fields, stable IDs and the full dataset are excluded. Names can still identify the area.
3. Read up to three alternatives with estimated travel/visit times, activity ideas, source facts and uncertainty. The model selects retrieved evidence and allowed reason/activity codes; application templates provide the wording.
4. Suggestions appear below the input and as matching numbered pins. Select a card or pin to calculate a walking route. Start/filters collapse after results and can be expanded again. Changing inputs clears stale suggestions/routes. See [map-interface behavior and verification](MAP_INTERFACE.md).

The active AI interface needs no separate payload preview or checkbox. The disclosure stays beside the button. Inputs are locked during a live request and their previous states restored after budget refresh. Each click can spend at most one attempt; no automatic retries. AI remains the configured main action even if temporarily unavailable, expired or exhausted; the state is explained instead of silently changing the search endpoint. Any provider failure's retrieval-only result is explicitly labeled. Device geolocation is disabled. [OpenStreetMap](OPENSTREETMAP.md) loads on opening the bounded interface; marker rendering is local. Selecting a suggestion sends rounded endpoints to FOSSGIS / Valhalla for pedestrian routing, independently of AI accounting.

## Server boundaries

`POST /api/recommend-ai` runs retrieval and bounded generation. `/api/recommend` remains local. The technical `/api/generation/preview` and `/api/generation/confirm` routes remain available for development but their panel is hidden in the activated UI. All generation routes require JSON, the exact same Origin, a validated loopback Host and the random `X-Qadam-Preview` token from `/api/config`. Browser inputs cannot change model, authorization or allowance. Public config exposes readiness and remaining requests, never keys, paths or record IDs. Responses are `no-store`.

The preview workflow retains one body for two minutes and consumes its token once. Main-button searches invalidate old previews. The persistent ledger reserves before dispatch, allows one in flight, and never refunds failed or uncertain calls. The browser allows 75 seconds for local retrieval plus the 60-second provider deadline; browser cancellation does not undo a server reservation. Source data are untrusted text, never executable instructions.

## Verification and handoff

AI-default follow-up (2026-10-19): independent read-only review found no blocking code defects. **381 guarded offline tests** and **60 JavaScript syntax checks** passed. One real main-button coffee search returned three grounded suggestions and used 2,021 reported tokens. The new allowance has 99 attempts remaining; all 11 prior attempts remain counted (12 total). All eight original source/review/accounting fingerprints matched. Evidence screenshot: ignored `data/runtime/ai-default-verified.png`. No 2GIS requests or public dataset export occurred.

The design keeps credentials server-side and bounds per-request output; [official OpenAI production guidance](https://developers.openai.com/api/docs/guides/production-best-practices) was checked. Provider/account availability and actual credit balance can still stop calls; this local allowance does not establish either.

The three browser scenarios returned two walk, three first-visit and three coffee options. All displayed totals fit the selected time budgets. Full human relevance/multilingual acceptance remains pending. Source rights and missing descriptions remain limitations, not waived checks. [LIVE_INTERFACE_REVIEW.md](LIVE_INTERFACE_REVIEW.md) records current test counts and UI changes. Python/data files are unchanged; no new 2GIS requests, commit, merge or PR update occurred in this task.
