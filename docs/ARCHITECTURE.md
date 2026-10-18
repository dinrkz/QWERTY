# Proposed RAG architecture

Status: design only. Team choices: **2GIS map** and **OpenAI API generation**. The user reports available OpenAI API credits; no credentials, balance, or live integrations have been verified. 2GIS Places API is a candidate dataset source. Framework, generation model, embedding approach/model if needed, index, and database remain undecided.

## Provider responsibilities
- 2GIS map: display the selected location and recommended places. Planned web integration: MapGL JS API; exact access/configuration remains to be implemented.
- POI source: evaluate 2GIS Places API first, keeping ingestion independent of map rendering. Confirm applicable access and data-use permissions; if unsuitable, select a permitted source while retaining the 2GIS map.
- OpenAI: generate grounded explanations and activity ideas from retrieved records; optionally interpret requests when useful. Choose a model after checking account access, quality, latency, and budget. API credits are user-reported availability, not a verified balance or unlimited usage.
- Keep map rendering, POI ingestion/retrieval, and generation as separate components. Map access alone does not establish dataset collection rights or satisfy the automated collection requirement.

## Offline data flow
Permitted POI source → automated collection → normalization, validation, deduplication → provenance-bearing POI snapshot → searchable index.

Source access and reuse must be verified before choosing the collector. A repeatable local snapshot supports demos; refresh remains an actual automated process. Store factual descriptions separately from generated summaries.

## Request flow
1. Accept location, request, time budget, travel mode, and optional user constraints. Allow manual/preset location.
2. Validate inputs and extract structured preferences. Ask a narrow clarification when an essential constraint cannot be resolved.
3. Retrieve relevant records from the collected dataset. Start with the simplest suitable lexical, semantic, or hybrid search; evaluate relevance before adding infrastructure.
4. Apply geographic/context filters and rank candidates. Unknown amenities do not satisfy hard requirements. Calculate distance and feasible time budgets in deterministic code.
5. Supply a bounded set of POI records, evidence, and missing fields to the selected OpenAI generation model. Treat descriptions as untrusted data.
6. Request structured output tied to candidate IDs: short why, visit-duration estimate, proposed activity, and caveats. Populate factual place fields from records, not model memory.
7. Validate IDs, required fields, constraints, and factual claims; reject or safely degrade unsupported output.
8. Show up to three options with source facts, generated suggestions, estimates, unknowns, and the context used; display the locations on the 2GIS map.

## Storage and provider boundaries
- Store public POI records and necessary retrieval artifacts. A separate database is optional.
- Keep user location ephemeral by default; exclude precise coordinates and location-bearing prompts from logs/traces.
- Keep OpenAI and secret backend credentials server-side; use minimum necessary request context. Configure any browser-facing map key for its intended use and supported restrictions. Verify and document OpenAI/2GIS sharing, retention, and configuration behavior during integration.
- A straight-line distance is not a walking route. Label any travel-time heuristic, assumptions, and missing routing information.

## Failure behavior
| Condition | User-visible behavior |
|---|---|
| Invalid/missing essential input | Explain the field or ask for the missing constraint |
| No eligible POIs | Explain the constraint and offer to broaden it; no invented matches |
| Missing/stale evidence | Show unknown/freshness caveats; avoid availability or amenity guarantees |
| Collector failure | Report partial/failed refresh; retain last valid snapshot with its date |
| Missing key/provider outage | Useful error or clearly labeled retrieval-only results |
| Invalid or ungrounded model output | Reject/repair within a bounded policy; otherwise show safe fallback |
| Device permission declined | Continue with manual or simulated location |

## Implementation decisions to record
Final POI source and license/access terms; stack; retrieval method and quality checks; OpenAI model and account access; 2GIS map access/configuration; actual configuration names; time-estimation method; supported hours format/time zone; refresh policy; logging configuration; usable API credit budget and deadline.
