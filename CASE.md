# Build with AI — Astana walking assistant

## Source and status
Source: [user-supplied Russian brief](docs/HACKATHON_BRIEF_RU.txt), preserved verbatim. Organizer named in that brief: School of AI and Data Science; task partners: Smart City Research Center and GDG Astana. This document summarizes that supplied text; it is not independent verification of organizer rules.

Current repository status (2026-10-19): automated collection, private reviewed data, Python retrieval, all three basic live RAG browser scenarios and an opt-in OpenStreetMap start picker work. See [interface evidence](docs/LIVE_INTERFACE_REVIEW.md) and [map verification](docs/OPENSTREETMAP.md). Source reuse permission, full human acceptance and completed submission artifacts remain pending. The requirement map below remains the competition specification, not a results report.

## Official objective
Show a working Retrieval-Augmented Generation (RAG) concept and interactive demo that recommends where to go and what to do in Astana based on current location, preferences, and context. Recommendations should be useful, safe, concrete, and understandable.

## Requirement map
| ID | Supplied requirement | Project evidence / acceptance check |
|---|---|---|
| R01 | Product concept: idea, audience, scenarios | Concept below; presentation; AT-13 |
| R02 | Interactive demo across several real or simulated locations/requests | AT-01, AT-02, AT-03; demo recording |
| R03 | High-level explanation of POI retrieval plus generation | `docs/ARCHITECTURE.md`; AT-04 |
| R04 | Team collects the dataset and automates the collection process | `docs/DATA_PLAN.md`; AT-05 |
| R05 | POIs include name, approximate coordinates, description, category/tags; hours/contacts and ratings/popularity if available | AT-05, AT-07 |
| R06 | Scenario responses give 1–3 concrete options, short why, approximate visit duration, and what to do | AT-01, AT-06 |
| R07 | Adapt to location, distance, time, user needs, and explicit constraints | AT-02, AT-03, AT-08 |
| R08 | Clearly state which user data and filters are used | AT-10 |
| R09 | Avoid confident availability claims without data; communicate uncertainty | AT-07 |
| R10 | Label POI-backed information versus generated ideas | AT-06 |
| R11 | Test scenarios with inputs and expected answer types; limitations document | `ACCEPTANCE_TESTS.md`; `docs/TEST_SCENARIOS_AND_LIMITATIONS.md` |
| R12 | Ethics/privacy notes covering location, misinformation, and user safety | `docs/PRIVACY_AND_SAFETY.md`; AT-10 |
| R13 | 5–7 minute presentation: business idea, limitations, risks, roadmap | `docs/PRESENTATION_OUTLINE.md`; AT-13 |
| R14 | Repository link (code/scripts optional in the submission wording) or prototype archive; slides/PDF; scenario/limitations document; YouTube demo link | `docs/SUBMISSION_CHECKLIST.md`; AT-13 |

The brief explicitly requires automated collection even though its submission-format wording calls code/scripts optional. Team decision: include the collector and runnable demo in this repository so collection and RAG can be inspected.

## Team concept and audience — confirmed focus; live demo pending
Qadam helps people discover Astana on foot, with primary attention to people taking a walk and first-time visitors. The team's naming rationale is Qadam (қадам, “step”): help someone choose their next worthwhile stop nearby. A user supplies a location, time budget, and preferences; the assistant returns up to three grounded options with practical activities, clear explanations, and visible uncertainty.

Residents can discover something nearby during an ordinary walk. First-time visitors need plain-language context about why a place is worth seeing without assumed knowledge of landmarks or city layout. Walking is the default travel mode; distance and time estimates retain the evidence/uncertainty rules.

## Fit with the supplied track
| Evidence in the supplied brief | Implication for Qadam |
|---|---|
| Task title: «ИИ-помощник по прогулкам в городе Астана» | A walking-first Astana assistant directly matches the stated task |
| Recommendations near the user based on location, preferences, and context | Nearby discovery with a walking/visit budget supports the core objective |
| Examples include a 30–60 minute walk and a tourist with limited time | Walkers and first-time visitors are supported audience choices; first-time visitors are our narrower product interpretation |
| Optional recommendation to focus on two or three strong scenarios | Three walking-focused scenarios are an appropriate scope choice |

Assessment: compatible with the supplied track, not a promise of organizer approval or judging results. Audience focus does not remove any requirement in R01–R14. The original brief remains unchanged.

Initial scenarios:
1. A 30–60 minute walk near Mega Silk Way.
2. A first-time visitor has 60–90 minutes to discover nearby sights on foot; explain why each place matters using sourced facts, with walking and visit estimates.
3. A coffee/rest stop during a walk, with optional quietness/socket constraints supported by actual evidence.

Select location from user input, a map/preset, or permission-based device location. Specific coordinates and venues must come from collected sources; none are asserted here. Russian is the proposed first demo language; the brief does not require a particular language.

Team decisions: **2GIS for the map; OpenAI API for generation**, using API credits reported available by the user. **2GIS Places API remains a candidate data source**, conditional on access, coverage, and applicable collection/storage/indexing/AI-processing/redistribution permissions. The user approved Node.js/JavaScript for member 2; the JSON adapter preserves member 1's proposed Python data component. Model, final dataset source, exact available budget, and schedule remain undecided. Credentials and live integrations have not been verified. These are team choices, not organizer requirements.

The user subsequently authorized changing the map provider: the bounded demo uses OpenStreetMap with local Leaflet assets. Saved 2GIS records remain the data source. The verified generation model is `gpt-5.4-mini`; usable account balance is unknown. These dated implementation decisions supersede the earlier undecided/provider statements above.

## Main flow — implemented within the bounded scope
Location + request + available time → validate and interpret constraints → retrieve relevant collected POIs → filter/rank using geographic and contextual evidence → generate explanations and activity ideas grounded in retrieved records → validate IDs/claims → display recommendations, sources, estimates, and unknowns.

## Judging order
1. Relevance and usefulness.
2. Context and adaptation.
3. Explanation quality.
4. UX / demo clarity.
5. Creativity / unique features.
6. Ethics and privacy.
7. Completeness.

The brief gives an example scale such as 1–10 and refers to organizer-defined weights; no exact weights are supplied.

## Optional, not MVP requirements
Group planning, a three-stop mini-route, multilingual responses, local events, and accessibility-focused recommendations. Route and accessibility claims still need evidence. Child-outing, two-hours-before-a-flight, and nighttime examples remain useful secondary checks, not separate mandatory product modes. General driving itineraries, bookings, fitness/step tracking, and full turn-by-turn navigation are outside the team's initial scope; the name does not imply a pedometer product.

## Open facts and limitations
- Hackathon date, build duration, deadline, exact weights, and upload destination are absent from the supplied brief.
- Earlier authorized 2GIS access and collection were exercised. Reuse rights, broader POI coverage, freshness and permitted live integration still need verification.
- The example museum, rooftop, distances, and exhibition in the brief are not verified facts and must not be copied into the dataset as evidence.
- Hosting is not stated as mandatory. A reliable locally runnable demo is our engineering target; the YouTube upload is explicitly required.
