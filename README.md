# Qadam — your next worthwhile stop in Astana

**Qadam (қадам, “step”) is an AI walking assistant for residents and first-time visitors.** Tell it what you want to do and how much time you have. It searches saved local places and suggests up to three options, with reasons, activities, estimated time and sources.

Built for the **Build with AI** hackathon. [Project brief](CASE.md) · [Scenarios and limitations](docs/TEST_SCENARIOS_AND_LIMITATIONS.md) · [Submission checklist](docs/SUBMISSION_CHECKLIST.md)

## What the user sees

1. **Choose a starting point** from a preset or by clicking the map.
2. **Describe the outing** in the sidebar: a short walk, nearby sights, or a coffee stop. Set the time available and any essential filters.
3. **Compare suggestions** below the input and on matching numbered map pins.
4. **Select a place** to see a pedestrian route and updated time estimate.

Each suggestion is an alternative outing, not a stop in a combined itinerary. The interface supports English, Russian and Kazakh; source names and descriptions stay in their original language.

## What works today

The interface has completed all three basic scenarios using **real OpenAI responses grounded in our saved places**:

| Scenario | Starting area | Available time | Actual result |
|---|---|---:|---|
| Short walk | Mega Silk Way | 60 minutes | 2 suggestions |
| First visit | Bayterek | 90 minutes | 3 suggestions |
| Coffee stop | Bayterek | 45 minutes | 3 suggestions |

All displayed alternatives fit their individual planning budgets in the October 19 checks. These results demonstrate the working flow; they do not establish recommendation quality for every request. See the [dated live results](docs/LIVE_INTERFACE_REVIEW.md).

The team has also prepared:

- **A 4:40 English-captioned demo video**, showing three live AI searches and two walking routes. [Recording workflow](scripts/demo/README.md)
- **A 10-slide English presentation**, editable PowerPoint, PDF and speaker notes targeting **6:15**. [Presentation outline](docs/PRESENTATION_OUTLINE.md)

These artifacts are saved locally, outside Git. The video has not been uploaded; presentation rehearsal and final submission are still pending.

## Try the project

### Preview from a clean clone — no API key needed

Requires **Node.js 22.14 or newer**. From the repository root:

```sh
node tests/app/fixtures/offline-ui-server.mjs
```

Open **http://127.0.0.1:3001**. This preview uses clearly labeled **synthetic test places**, not our collected dataset or live AI. Stop it with `Ctrl+C`.

### Run the real AI demo — configured team computer

```sh
node scripts/app/start-ai.mjs
```

Open the URL printed in the terminal, normally **http://127.0.0.1:3003**. AI is enabled for the main search button. With text interpretation activated, type **“I am near Mega and want to go for a walk for 20 minutes.”** AI extracts the start, activity and time before searching saved places. Manual start and filters are optional. Starting the server makes no AI call; a search uses up to two requests. The map loads external tiles when opened, and selecting a suggestion can request a route.

**The real demo is not plug-and-play from a fresh clone.** Private place data, review files, a valid AI authorization/request allowance and a server-side OpenAI key must already be configured. These files are intentionally excluded from Git. Follow [saved-data setup](docs/OFFLINE_INTERFACE.md#another-authorized-local-checkout), then [AI configuration](docs/BOUNDED_INTERFACE.md#start). Missing configuration produces an explicit startup error.

To search configured saved places without any AI, external map or routing requests:

```sh
npm run start:offline
```

Use the URL printed at startup. This mode labels its activities as templates rather than AI output.

> `npm start` launches an older, separate integration pipeline. Use `node scripts/app/start-ai.mjs` for the current demo; its configuration and request accounting differ from the legacy `.env.example` setup.

## How the AI uses our data

Qadam uses **retrieval-augmented generation (RAG)**: it finds relevant records first, then asks AI to work within that evidence.

```text
Saved places → Python filtering and ranking → Up to 5 candidate records
            → OpenAI selection → Evidence validation → Up to 3 suggestions
```

- **Collection:** scripts fetch, validate and deduplicate place records, preserving their source and collection details.
- **Request understanding:** When activated, OpenAI converts the typed sentence into validated filters. Named starts currently support Mega Silk Way, Bayterek and Zhetysu Park; other starts need a map point. Ambiguous or unsupported requests ask for clarification.
- **Retrieval:** Python filters and ranks saved places using the resolved location, category, available time and supported constraints. Without the interpretation capability, a limited local keyword parser remains available.
- **Generation:** OpenAI selects places, supported reasons and activity ideas from the retrieved evidence. The current demo uses `gpt-6-luna` with reasoning disabled for latency; the earlier October 19 results used `gpt-5.4-mini`.
- **Validation:** the server rejects unknown place IDs and unsupported selections. Interface templates turn validated choices into readable explanations; the model does not freely invent venue facts.
- **Routing:** after a selection, a separate routing service supplies a pedestrian path. Earlier distance/time estimates remain distinct from provider route estimates.

The stack is a **Node.js server, plain JavaScript interface, Python retrieval, Leaflet/OpenStreetMap and OpenAI**. No database, embedding service, third-party npm dependency or application build step is required. Leaflet assets are included locally. See [data contracts](docs/CONTRACTS.md) and [map behavior](docs/OPENSTREETMAP.md).

## Data, privacy and limitations

Our automated 2GIS collection contains **73 unique places**. Offline review identified **45 relevance candidates**, seven needing further review and 21 excluded from the walking scenarios. Further distance, category and time filters determine which candidates can appear. [Dataset review](docs/WALKING_DATASET_REVIEW.md)

**Coverage and evidence are limited.** Descriptions are missing for 42 of the 45 candidates. Opening hours, seating, sockets, quietness and accessibility are not established by this dataset. Unknown facts remain unknown; an essential requirement without evidence can produce no matches. Routes do not guarantee entrances, accessibility or current conditions.

The current AI demo shares only the information needed by each provider:

| Destination | Information sent |
|---|---|
| OpenAI | Interpretation receives typed text and language, with decimal coordinate-like text redacted. Names or addresses in the text can reveal the area. A separate recommendation call receives at most five selected places' names, categories, descriptions, coarse estimates and filters; it excludes the raw query, coordinate fields, stable IDs and full dataset. |
| OpenStreetMap tile service | Map viewport and browser connection information when the map loads. |
| FOSSGIS / Valhalla routing | Rounded start/destination coordinates and server connection information when a suggestion is selected. |

The full dataset and API keys stay outside Git; keys stay on the server. The application does not persist user prompts, location histories or routes. Device geolocation is disabled in the current demo. OpenAI requests use `store:false`, but this is not a promise of zero provider retention. [Provider boundaries](docs/BOUNDED_INTERFACE.md)

AI requests have a persistent finite allowance, one request in flight and no automatic retries. Restarting does not reset the allowance. Provider failures and retrieval-only fallbacks are labeled.

**Remaining work:** resolve 2GIS storage/reuse/AI-processing and redistribution permissions, improve descriptions and coverage, complete human relevance testing, verify clean setup with authorized data, rehearse the presentation and upload the demo. Private use or operator approval does not settle source rights. The dataset is not distributed with this repository.

## Verify the code without provider calls

Python **3.13** and Node.js **24.12** were used for the recorded engineering checks. From the repository root:

```sh
node --import ./scripts/app/offline-network-guard.mjs --test tests/app/*.test.mjs
python -B -m unittest discover -s tests/data -p "test_*.py" -q
npm run check
```

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm`. The application suite uses synthetic fixtures and permits local loopback connections while blocking external fetch/HTTPS calls. No private dataset or provider key is needed for these tests.

The latest application checks passed **395 tests and syntax checks for 66 JavaScript modules**. The earlier Python checkpoint passed **188 tests**; Python behavior was unchanged in the natural-input/model update. Syntax checking is not a separate linter or type checker. Automated tests do not replace [human acceptance checks](ACCEPTANCE_TESTS.md).

## Project guide

| Find out about… | Start here |
|---|---|
| Hackathon requirements and product scope | [CASE.md](CASE.md) |
| Current AI demo setup and request limits | [Saved-place AI interface](docs/BOUNDED_INTERFACE.md) |
| Saved-data setup and retrieval | [Offline interface](docs/OFFLINE_INTERFACE.md), [Python retrieval](docs/OFFLINE_RETRIEVAL.md) |
| Collection and source feasibility | [Data plan](docs/DATA_PLAN.md) |
| Member integration and JSON contracts | [Contracts](docs/CONTRACTS.md), [member 2 handoff](docs/MEMBER_2_RETRIEVAL_HANDOFF.md) |
| Scenario evidence and remaining limitations | [Live results](docs/LIVE_INTERFACE_REVIEW.md), [scenario document](docs/TEST_SCENARIOS_AND_LIMITATIONS.md) |
| Demo, slides and submission progress | [Video workflow](scripts/demo/README.md), [presentation outline](docs/PRESENTATION_OUTLINE.md), [checklist](docs/SUBMISSION_CHECKLIST.md) |
| Team responsibilities and contribution process | [TEAM_WORKFLOW.md](TEAM_WORKFLOW.md) |

Verification reports preserve dated checkpoints, including earlier behavior and test counts. This README describes the current demo. `old/` contains superseded material.
