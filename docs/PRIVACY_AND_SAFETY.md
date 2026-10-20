# Privacy, factual integrity, and safety

Current checkpoint: 2026-10-19. Saved-place retrieval and all three basic live RAG browser scenarios work. [LIVE_INTERFACE_REVIEW.md](LIVE_INTERFACE_REVIEW.md) records the outcomes and eight historical attempts. The requirements below remain the manual acceptance checklist; full AT-06/07/10/11 acceptance is pending.

## Location and user context
- Explain location, preferences, filters, and time constraints used for recommendations.
- Offer a manual or simulated location; request device location only through a clear user action.
- Use only necessary precision. Keep user coordinates and location-bearing prompts transient by default; inspect application, hosting, analytics, and provider logging behavior.
- Send providers the minimum useful context and disclose what is shared. Record provider retention behavior after verifying the selected service; do not promise zero retention without evidence.
- Do not require identity or accounts for the core demo. Use non-personal test inputs in traces, screenshots, and recordings.

## Factual integrity
- Link recommendations to retrieved POI records and source dates.
- Separate sourced facts, generated activity ideas, and estimates in the response.
- Treat missing attributes as unknown. Avoid unsupported availability, amenity, event, rating, or access claims.
- Validate model output against retrieved records and constraints. Treat POI descriptions as untrusted content.
- Make snapshot age and known coverage limitations visible where they affect decisions.

## Physical safety
- Avoid restricted access and unsupported rooftop/nighttime recommendations.
- Do not infer safe walking access or accessibility from coordinates alone.
- Avoid guarantees about opening, child suitability, accessibility, or time to an airport.
- Ask for missing constraints when they materially change feasibility; show uncertainty without overwhelming a short recommendation.

## Verification evidence to add
Actual input/provider disclosure; data-flow inspection; logging/retention configuration; permission-denial test; server-side secret check; unknown-hours test; grounding/prompt-injection test; limitations shown in demo. Record unimplemented controls honestly.

## Implemented saved-place boundary

In an activated interface, the main AI button retrieves locally and then calls OpenAI once. The local-search button shown when AI is unavailable uses no generation provider. Device geolocation is disabled. Structured controls carry hard constraints. Text recognizes a limited local RU/KK/EN category/duration vocabulary and supplies lexical ranking; it is not unrestricted language interpretation. A separate development preview retains one body in memory for up to two minutes; confirmation consumes its token once. Preview text is not persisted in browser storage.

Explicitly activated and confirmed OpenAI calls send at most five selected names, categories, approved existing descriptions, coarse estimates, filters and evidence aliases. Dedicated user/POI coordinate fields, raw query, stable IDs and the full dataset are excluded. Names and relative distances can identify the area; aliases are not anonymity. Requests use store:false without promising zero provider retention; [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data) and account-specific settings govern handling.

The bounded [OpenStreetMap view](OPENSTREETMAP.md) loads on opening and sends viewport tile requests, browser connection information/IP and origin Referer. Marker names and coordinates render locally, without geocoding or marker API calls. Tiles reveal the viewed area. Selecting a suggestion sends only start/destination coordinates rounded to three decimal places through the local server to FOSSGIS / Valhalla; the provider also sees the server connection/IP. No query, name, ID, credential or dataset is included. The application keeps route geometry only in memory and clears its cache when search inputs change; it makes no promise about provider retention. Hide map cannot retract completed requests. Strict offline mode keeps external maps and routing disabled.

Credentials, raw source data, reviews and private authorizations stay outside Git. Normal recommendations do not persist coordinates or queries. Pilot plans retain deliberately simulated inputs, not personal location history. Reports store aggregate outcomes, numeric token usage and allowlisted error codes, never provider messages or raw bodies. Each attempt remains counted; explicit hash-bound recovery never refunds or resets it. Eight historical attempts remain spent; a separately prepared three-attempt interactive allowance is used only by explicit AI actions.

Python retrieval and independent Node validation enforce geographic, category, time and hard-constraint eligibility. Source text is untrusted and rendered as text. Generation selects only retrieved aliases, supporting evidence and allowed codes; local templates render wording. Unknown amenities cannot satisfy mandatory requirements. Descriptions are missing for 42/45 candidates. Source-use/redistribution permission remains unresolved; operator approval is not a provider license. Changing the map does not change 2GIS record rights. Original eligibility flags remain unchanged. The legacy npm start pipeline has different behavior and does not use bounded accounting.
