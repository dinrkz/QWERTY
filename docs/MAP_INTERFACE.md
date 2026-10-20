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
