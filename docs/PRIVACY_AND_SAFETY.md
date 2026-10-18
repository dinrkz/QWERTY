# Privacy, factual integrity, and safety plan

Status: intended controls, not an assertion that protections are implemented. Verify with AT-06, AT-07, AT-10, and AT-11 before submission.

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
