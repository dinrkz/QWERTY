# Proposed RAG architecture

Status: design only. No framework, provider, embedding model, index, or database has been selected.

## Offline data flow
Permitted POI source → automated collection → normalization, validation, deduplication → provenance-bearing POI snapshot → searchable index.

Source access and reuse must be verified before choosing the collector. A repeatable local snapshot supports demos; refresh remains an actual automated process. Store factual descriptions separately from generated summaries.

## Request flow
1. Accept location, request, time budget, travel mode, and optional user constraints. Allow manual/preset location.
2. Validate inputs and extract structured preferences. Ask a narrow clarification when an essential constraint cannot be resolved.
3. Retrieve relevant records from the collected dataset. Start with the simplest suitable lexical, semantic, or hybrid search; evaluate relevance before adding infrastructure.
4. Apply geographic/context filters and rank candidates. Unknown amenities do not satisfy hard requirements. Calculate distance and feasible time budgets in deterministic code.
5. Supply a bounded set of POI records, evidence, and missing fields to the generation model. Treat descriptions as untrusted data.
6. Request structured output tied to candidate IDs: short why, visit-duration estimate, proposed activity, and caveats. Populate factual place fields from records, not model memory.
7. Validate IDs, required fields, constraints, and factual claims; reject or safely degrade unsupported output.
8. Show up to three options with source facts, generated suggestions, estimates, unknowns, and the context used.

## Storage and provider boundaries
- Store public POI records and necessary retrieval artifacts. A separate database is optional.
- Keep user location ephemeral by default; exclude precise coordinates and location-bearing prompts from logs/traces.
- Use server-side provider credentials and minimum necessary request context. Document any provider retention and sharing limitations after selecting a provider.
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
Source and license/access terms; stack; retrieval method and quality checks; generation provider/model; actual configuration names; time-estimation method; supported hours format/time zone; refresh policy; logging configuration; available budget and deadline.
