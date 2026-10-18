# Automated POI data collection plan

Status: **2GIS Places API is the candidate POI source**, not a final selection. Account access, applicable permissions, collector implementation, and actual records remain unverified. The map will use 2GIS regardless of whether this candidate is selected. The following is a team plan to satisfy R04/R05.

Member 1 checkpoint (2026-10-18): Python backend confirmed by the user; no 2GIS access yet. See [source feasibility and live Wikidata sample evidence](DATA_SOURCE_FEASIBILITY.md), the [proposed Python boundary](DATA_INTERFACE_PROPOSAL.md), and [handoff](MEMBER_1_HANDOFF.md). A bounded alternate-source probe succeeded; no production collector, normalized demo snapshot, or shared application contract is complete.

User priority (2026-10-18): make **2GIS a main POI source**, prioritizing its evaluation and collector before alternatives. This expresses the team's preferred source, not verified access or permissions. Wikidata/OSM are fallback or supplementary candidates for concrete blockers or measured gaps. Keep the 2GIS map decision separate from the data-use agreement.

## 2GIS feasibility check — member 1
1. Obtain access through the official platform and test Astana categories/locations needed for the demo.
2. Inspect actual returned fields, missing descriptions/amenities/hours, geographic coverage, pagination, and account limits.
3. Verify applicable rights for automated collection, storage, retrieval indexing, sending data to OpenAI, and any public dataset redistribution. API access alone does not establish these permissions.
4. Document the permitted collection/refresh process and attribution. Do not assume live queries alone satisfy the brief's collected-dataset requirement.
5. If the source is unsuitable, propose a permitted alternative without changing the confirmed 2GIS map decision.

Starting references: [Places API](https://docs.2gis.com/en/api/search/places/overview), [map APIs](https://docs.2gis.com/en/maps/overview), and [directory API pricing including storage rights](https://law.2gis.ru/catalog-pay). These references do not establish the permissions of the team's eventual subscription.

## Source selection gate
Before integration, verify the source's current documentation, geographic/category coverage, access method, rate limits, attribution, license/reuse terms, and snapshot redistribution rights. Record direct source links and date checked. Prefer a documented API or export where available. Do not treat the brief's sample recommendations as factual source records.

## Proposed normalized record
| Field | Meaning |
|---|---|
| `id`, `source_id` | Stable internal identifier and original source identifier |
| `name` | Sourced place name |
| `latitude`, `longitude` | Valid approximate POI coordinates; not user tracking data |
| `description`, `description_kind` | Source text or explicitly labeled generated summary |
| `categories`, `tags` | Source-supported classifications |
| `opening_hours`, `contacts`, `rating`, `popularity` | Optional; null/unknown when absent; preserve rating scale/source if present |
| `amenities` | Evidence-backed attributes such as sockets or accessibility; unknown remains unknown |
| `source_url`, `collected_at`, `source_updated_at` | Provenance and collection/update dates; source update date can be unknown |
| `field_evidence` | Source support where fields come from different sources or require qualification |
| `attribution`, `reuse_terms` | Required credit and recorded reuse basis |

## Collector requirements
1. Fetch real Astana POI records automatically from the selected permitted source.
2. Handle pagination if needed, timeouts, source rate limits, and bounded retries. Report failures and partial coverage.
3. Normalize records; validate coordinate ranges and intended city coverage; reject invalid mandatory fields.
4. Deduplicate using stable source IDs and documented cross-source matching rules where applicable.
5. Preserve missing optional values; never fabricate descriptions, amenities, hours, ratings, or contacts.
6. Produce a validation summary with counts, rejected/duplicate records, source dates, and missing-field coverage.
7. Keep a small redistributable snapshot under `data/demo/` when permitted. Otherwise document authorized fetch/setup; never commit prohibited source data.
8. Document exact collection and refresh commands once implemented. Verify repeatability on fixed source input and separately demonstrate successful real collection.

## Coverage review
Check that actual collected records support short walks, first-time visitor discovery, and coffee/rest stops in the chosen demo area. Prioritize nearby parks, landmarks, museums, and cafes with sufficient source descriptions to explain their relevance to someone unfamiliar with Astana. Do not invent historical/cultural context. If sockets/quietness or attributes in secondary child-outing checks are not documented, preserve that limitation and demonstrate honest unknown handling. Do not manufacture positive evidence to make the demo succeed.

## Evidence to capture
Source documentation and terms links; date checked; collector command; collection date; dataset counts; validation report; attribution; refresh behavior; live-source failures; approved snapshot version/hash. Exclude credentials and personal user coordinates.
