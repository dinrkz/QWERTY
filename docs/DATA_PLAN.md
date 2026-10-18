# Automated POI data collection plan

Status: no source selected, access terms verified, collector implemented, or records collected yet. The following is a team plan to satisfy R04/R05.

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
Check that actual collected records support the chosen walk, coffee, and child-outing scenarios. If sockets/quietness/child suitability are not documented, preserve that limitation and demonstrate honest unknown handling. Do not manufacture positive evidence to make the demo succeed.

## Evidence to capture
Source documentation and terms links; date checked; collector command; collection date; dataset counts; validation report; attribution; refresh behavior; live-source failures; approved snapshot version/hash. Exclude credentials and personal user coordinates.
