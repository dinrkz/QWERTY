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

With text interpretation activated (2026-10-20), the main AI button sends typed text and language to OpenAI to extract supported start/activity/time/constraints. Decimal coordinate-like text is redacted, but names and addresses can reveal an area. The input disclosure explains this. Dedicated coordinate fields are not sent; known named starts are resolved locally. Unsupported or ambiguous requests ask for clarification. The resulting filters drive local retrieval, followed by a separate grounded recommendation call when candidates exist. Each call consumes the same finite allowance, up to two attempts per search without retries. Empty text skips interpretation. Device geolocation is disabled. Manual controls remain optional. A separate development preview retains one generation body in memory for up to two minutes; confirmation consumes its token once. Preview text is not persisted in browser storage.

The recommendation-generation call sends at most five selected names, categories, approved existing descriptions, coarse estimates, filters and evidence aliases. Dedicated user/POI coordinate fields, raw query, stable IDs and the full dataset are excluded from that call. Names and relative distances can identify the area; aliases are not anonymity. Both interpretation and generation use store:false without promising zero provider retention; [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data) and account-specific settings govern handling.

The bounded [OpenStreetMap view](OPENSTREETMAP.md) loads on opening and sends viewport tile requests, browser connection information/IP and origin Referer. Marker names and coordinates render locally, without geocoding or marker API calls. Tiles reveal the viewed area. Selecting a suggestion sends only start/destination coordinates rounded to three decimal places through the local server to FOSSGIS / Valhalla; the provider also sees the server connection/IP. No query, name, ID, credential or dataset is included. The application keeps route geometry only in memory and clears its cache when search inputs change; it makes no promise about provider retention. Hide map cannot retract completed requests. Strict offline mode keeps external maps and routing disabled.

Credentials and private authorizations stay outside Git. Normal recommendations do not persist coordinates or queries. Pilot plans retain deliberately simulated inputs, not personal location history. Reports store aggregate outcomes, numeric token usage and allowlisted error codes, never provider messages or raw bodies. Each attempt remains counted; explicit hash-bound recovery never refunds or resets it. The current interface has a finite 100-attempt allowance with all earlier pilot attempts retained in history; model changes share its original ledger. See the dated accounting checkpoints in [BOUNDED_INTERFACE.md](BOUNDED_INTERFACE.md).

Python retrieval and independent Node validation enforce geographic, category, time and hard-constraint eligibility. Source text is untrusted and rendered as text. Generation selects only retrieved aliases, supporting evidence and allowed codes; local templates render wording. Unknown amenities cannot satisfy mandatory requirements. Descriptions are missing for 42/45 candidates. Source-use/redistribution permission remains unresolved; operator approval is not a provider license. Changing the map does not change 2GIS record rights. Original eligibility flags remain unchanged. The legacy npm start pipeline has different behavior and does not use bounded accounting.
