# Build with AI — Astana walking assistant

## Source and status
Source: [user-supplied Russian brief](docs/HACKATHON_BRIEF_RU.txt), preserved verbatim. Organizer named in that brief: School of AI and Data Science; task partners: Smart City Research Center and GDG Astana. This document summarizes that supplied text; it is not independent verification of organizer rules.

Current repository status: planning and operating rules only. No application, collected POI dataset, or completed demo exists yet.

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

## Team concept and initial scope — proposed
Qadam helps Astana residents and visitors choose a short outing near their selected location. A user supplies a location, time budget, and preferences; the assistant returns up to three grounded options with practical activities and visible uncertainty.

Initial scenarios:
1. A 30–60 minute walk near Mega Silk Way.
2. Coffee in a quiet place with a socket, subject to actual evidence for those attributes.
3. An outing with a child: nearby playground or interactive museum, subject to actual evidence.

Select location from user input, a map/preset, or permission-based device location. Specific coordinates and venues must come from collected sources; none are asserted here. Russian is the proposed first demo language; the brief does not require a particular language.

Team decisions: **2GIS for the map; OpenAI API for generation**, using API credits reported available by the user. **2GIS Places API remains a candidate data source**, conditional on access, coverage, and applicable collection/storage/indexing/AI-processing/redistribution permissions. The stack, model, final dataset source, exact available budget, and schedule remain undecided. Credentials and live integrations have not been verified. These are team choices, not organizer requirements.

## Main flow — proposed
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
Group planning, a three-stop mini-route, multilingual responses, local events, and accessibility-focused recommendations. Route and accessibility claims still need evidence. The two-hours-before-a-flight and nighttime examples are useful boundary scenarios, not a requirement to implement every example as a dedicated feature.

## Open facts and limitations
- Hackathon date, build duration, deadline, exact weights, and upload destination are absent from the supplied brief.
- Data source access, reuse rights, POI coverage, and freshness need verification before implementation.
- The example museum, rooftop, distances, and exhibition in the brief are not verified facts and must not be copied into the dataset as evidence.
- Hosting is not stated as mandatory. A reliable locally runnable demo is our engineering target; the YouTube upload is explicitly required.
