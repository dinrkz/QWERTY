# Map interface checkpoint — 2026-10-19

The bounded interface is a full-window map with a scrollable search sidebar. Type an idea, set the starting point and submit. Up to three retrieved suggestions appear below the input and as numbered pins. Clicking a suggestion or pin selects it and draws a pedestrian route. The map-start picker remains explicit, so browsing the map does not accidentally move the start. RU/KK/EN controls and a stacked small-screen layout are included.

Search retains the existing saved-place retrieval and bounded OpenAI flow. A small local parser recognizes common category words and single integer minute/hour durations; mixed, negated or recognized unsupported constraints ask for clarification. This does not implement unrestricted natural-language understanding. Unknown named text still provides soft lexical ranking, so exact-name and uncommon-language relevance remain limitations.

Routing uses FOSSGIS / Valhalla via the local server, with rounded endpoint coordinates only. See [map/provider boundaries](OPENSTREETMAP.md). Actual route time is shown separately from the original straight-line planning estimates. The total includes the visit and any explicit return/buffer; exceeding the time budget is flagged. Routes do not verify entrances, accessibility or current street conditions. Public routing/tile availability is best-effort.

## Verification

- Final checks: **379/379 guarded offline application tests passed**, **58 JavaScript modules passed syntax checks**, and `git diff --check` passed. Localhost HTTP tests require sandbox socket permission; the test guard still blocks external traffic.
- Independent subagents reviewed layout, routing/privacy and local input constraints. Their findings were fixed before final checks.
- Offline routing tests cover outbound data minimization, malformed or unrelated paths, ferry rejection, response size/deadline, concurrency, no retries, caching, stale selection and updated time totals. Search tests cover categories, durations, unsupported requests and hard amenities.
- Browser test used actual saved records with AI disabled: a coffee request switched category/time locally, returned three cards and three pins, and selection drew a real walking path. One routing request returned approximately 783 m / 12 minutes; with the estimated visit the total was 37 minutes within a 45-minute budget. The screenshot is ignored under `data/runtime/map-website-route.png`.
- No OpenAI or 2GIS API requests were made for this change. OSM tile traffic and the single disclosed routing test occurred. Dataset/source files remain private; the application writes no route/location history.
- Read-only accounting after the user's interactive testing showed all three interactive attempts used (11 total including eight earlier attempts), with 4,557 reported tokens for that allowance. The original eight source/review/accounting files matched their fingerprints. Restarting preserved the exhausted allowance; the interface now offers explicitly labeled saved-place search.

This checkpoint does not establish full multilingual usability, data redistribution rights, live-provider availability, or hackathon submission completion. Work remains uncommitted until requested.

## Strict UI/UX review — 2026-10-20

Two independent subagents reviewed accessibility and the map/search flow. Fixes:

- Completed results now scroll into view instead of returning the sidebar to the top.
- Phone layouts use document scrolling with a 300px map and route/status sections below it; route selection reveals the map. Desktop zoom controls sit on the right, away from the route summary.
- Supporting text is larger and darker; key buttons have 44px minimum hit areas. Map-selection buttons wrap instead of overflowing.
- Connection failure exposes an explicit configuration retry. Routing failure exposes a route-only retry; unavailable routes no longer display the successful-route disclaimer.
- Route retry keeps keyboard focus on status; closing a route returns focus to its recommendation. Connection recovery returns focus to search.
- Failed map initialization no longer enters start-picking mode or overwrites its error. Invalid hidden settings expand before browser validation.
- The sidebar accessible name follows RU/KK/EN. Clicking the already selected scenario preserves input; switching scenarios preserves a nondefault custom time. Switching to another scenario still replaces search text with that scenario's intent.
- Strict offline mode no longer shows an irrelevant external-routing disclosure.

Verification: 381 guarded application tests and 60 JavaScript syntax checks passed. Chrome checks at 390×844 verified visible completed results, no horizontal overflow, preserved custom time, route-error retry and keyboard focus restoration. Desktop visual inspection confirmed separate route and zoom controls. Tests used authored synthetic places; the optional `node tests/app/fixtures/offline-ui-server.mjs --map-preview` serves them at port 3004. Its server network guard intentionally blocks routing/AI calls so route recovery can be inspected; the browser loads normal OpenStreetMap tiles. It is not a live RAG demo. No OpenAI or 2GIS requests were made for this review; private data were not used. Successful live routing and screen-reader speech were not reverified in this pass.
