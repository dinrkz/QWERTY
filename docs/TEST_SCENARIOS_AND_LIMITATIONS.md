# Test scenarios and limitations

Status: scenario specification; no execution results yet. Replace pending evidence with actual run notes before submission. Locations can be real or simulated; choose coordinates from sourced POIs rather than asserting unverified coordinates here.

| Scenario | Example input | Setup / expected answer type | Acceptance checks | Result |
|---|---|---|---|---|
| Short walk | «Я возле Mega Silk Way, хочу прогуляться 30–60 минут.» | Select a sourced nearby location; offer up to three feasible retrieved places, why, visit estimate, activity, travel estimate, sources | AT-01, AT-02, AT-06 | Not run |
| Quiet coffee and socket | «Хочу тихое место с кофе и розеткой недалеко от меня.» | Known location; distinguish verified amenities from unknowns. If sockets are mandatory and unsupported, explain no confirmed match or ask to relax the constraint | AT-03, AT-07 | Not run |
| With a child | «Еду с ребёнком — где рядом есть детская площадка или музей с интерактивами?» | Known location and budget; ask age/mobility only if materially needed. Suggest sourced relevant options, qualify unknown age/access suitability | AT-03, AT-06 | Not run |
| Before a flight | «Я турист, у меня 2 часа перед вылетом: что можно посмотреть поблизости?» | Clarify location and usable sightseeing window/return buffer as needed; avoid a guaranteed arrival claim or itinerary that spends all two hours sightseeing | AT-08 | Not run |
| Late-night activity | «Ищу необычную ночную активность на ближайшие пару часов.» | Controlled local time; avoid invented opening/access claims and restricted rooftops; show unknowns or no confirmed options | AT-07, AT-08 | Not run |
| No match | Request a category or hard amenity absent from the chosen dataset | Explain lack of matching evidence and suggest changing a constraint | AT-02, AT-09 | Not run |
| Service/data failure | Disable generation access; return malformed output or fail refresh | Clear failure or labeled retrieval-only fallback; valid snapshot remains dated; no fabricated successful RAG | AT-05, AT-09 | Not run |
| Privacy/hostile POI text | Decline location permission; retrieve a fixture containing instructions | Manual location works; source instructions are ignored; no sensitive logging | AT-10, AT-11 | Not run |

## Known limitations at planning stage
- No collected data, retrieval implementation, or live generation has been verified.
- Source coverage, reuse rights, and refresh frequency remain undecided.
- Hours, amenity information, accessibility, quietness, and events may be unavailable or stale.
- Approximate coordinates and straight-line distance do not establish a safe or accessible walking route.
- Travel/visit estimates are uncertain; airport departure buffers need explicit context.
- Generation can introduce unsupported claims; grounding checks and human review are required.
- Provider/network failures need a disclosed fallback; a recorded demo is not a live provider test.

## Result record
For each run record: scenario ID, dataset snapshot/source date, safe test inputs, execution time, actual result, expected-result comparison, evidence reference, defects, and retest status. Use synthetic/manual test locations rather than personal location histories. Report both successes and failures.
