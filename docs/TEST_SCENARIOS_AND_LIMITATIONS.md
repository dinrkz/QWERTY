# Test scenarios and limitations

Status on 2026-10-19: offline engineering checks and all three basic live RAG browser scenarios passed; see [interface evidence](LIVE_INTERFACE_REVIEW.md). Full manual scenario acceptance remains pending. Structured controls carry hard constraints; optional text supplies local lexical ranking, not natural-language interpretation. The example phrases below describe intended scenarios rather than claims that this path understands their wording.

| Scenario | Example input | Setup / expected answer type | Acceptance checks | Full/manual acceptance |
|---|---|---|---|---|
| Short walk | «Я возле Mega Silk Way, хочу прогуляться 30–60 минут.» | Select a sourced nearby location; offer up to three feasible retrieved places, why, visit estimate, activity, travel estimate, sources | AT-01, AT-02, AT-06 | Not run |
| First-time visitor (core) | «Я впервые в Астане. У меня 90 минут, хочу посмотреть интересные места рядом пешком.» | Known location; return sourced nearby options with plain-language explanations, walking/visit estimates within the budget, and concrete activities; no assumed landmark knowledge or invented history | AT-14, AT-02, AT-06 | Not run |
| Coffee/rest stop (core) | «Я гуляю здесь, хочу остановиться на кофе рядом. Есть тихое место с розеткой?» | Known location and walking budget; distinguish verified amenities from unknowns. If sockets are mandatory and unsupported, explain no confirmed match or ask to relax the constraint | AT-03, AT-07 | Not run |
| With a child | «Еду с ребёнком — где рядом есть детская площадка или музей с интерактивами?» | Known location and budget; ask age/mobility only if materially needed. Suggest sourced relevant options, qualify unknown age/access suitability | AT-03, AT-06 | Not run |
| Before a flight | «Я турист, у меня 2 часа перед вылетом: что можно посмотреть поблизости?» | Clarify location and usable sightseeing window/return buffer as needed; avoid a guaranteed arrival claim or itinerary that spends all two hours sightseeing | AT-08 | Not run |
| Late-night activity | «Ищу необычную ночную активность на ближайшие пару часов.» | Controlled local time; avoid invented opening/access claims and restricted rooftops; show unknowns or no confirmed options | AT-07, AT-08 | Not run |
| No match | Request a category or hard amenity absent from the chosen dataset | Explain lack of matching evidence and suggest changing a constraint | AT-02, AT-09 | Not run |
| Service/data failure | Disable generation access; return malformed output or fail refresh | Clear failure or labeled retrieval-only fallback; valid snapshot remains dated; no fabricated successful RAG | AT-05, AT-09 | Not run |
| Privacy/hostile POI text | Decline location permission; retrieve a fixture containing instructions | Manual location works; source instructions are ignored; no sensitive logging | AT-10, AT-11 | Not run |

## Known implementation limits
The three core demo scenarios are the short walk, first-time visitor, and coffee/rest stop. Child-outing, airport, and nighttime examples are secondary robustness checks, not extra required product modes.

- Automated collection saved 73 records: 45 reviewed candidates, seven held and 21 excluded. Descriptions are missing for 42/45 candidates; source links and description-language metadata are also absent.
- Live browser checks produced two walk, three first-visit and three coffee alternatives within their selected budgets. Full human relevance review and the additional constraints in the table remain pending.
- Source-use and redistribution rights remain unresolved. Private operator approval is not a publication grant or proof of source permission.
- Model output selects retrieved evidence and allowed reason/activity codes; local templates render wording. No unrestricted historical/cultural prose is generated.
- Structured controls must express required constraints. The saved-place path does not interpret airport or other unsupported constraints from free text.
- Hours, amenity information, accessibility, quietness, and events may be unavailable or stale.
- Approximate coordinates and straight-line distance do not establish a safe or accessible walking route.
- Travel/visit estimates are uncertain; airport departure buffers need explicit context.
- Generation can introduce unsupported claims; grounding checks and human review are required.
- Provider/network failures need a disclosed fallback; a recorded demo is not a live provider test.

## Result record
For each run record: scenario ID, dataset snapshot/source date, safe test inputs, execution time, actual result, expected-result comparison, evidence reference, defects, and retest status. Use synthetic/manual test locations rather than personal location histories. Report both successes and failures.

Offline evidence is recorded in [OFFLINE_INTERFACE.md](OFFLINE_INTERFACE.md), [GENERATION_EVIDENCE.md](GENERATION_EVIDENCE.md) and [BOUNDED_INTERFACE.md](BOUNDED_INTERFACE.md). Public reports contain aggregate outcomes only. Private records, request bodies, authorizations and credentials remain outside Git and public recordings.
