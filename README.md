# Qadam — Build with AI

An Astana walking assistant using collected points of interest (POIs) and retrieval-augmented generation (RAG).

**Status:** adapted planning documents and agent rules. Application code, the automated collector, dataset, slides, and demo video are not implemented yet.

## Start here
1. Read [project rules](AGENTS.md) and the [case and requirement map](CASE.md).
2. Review [acceptance checks](ACCEPTANCE_TESTS.md) and [team workflow](TEAM_WORKFLOW.md).
3. Use [Build Lead](prompts/01_BUILD_LEAD.md) to begin implementation.
4. Track evidence in the [submission checklist](docs/SUBMISSION_CHECKLIST.md).

## Planned demo
Choose a real or simulated Astana location, describe your preferences and available time, and receive up to three relevant places with a short explanation, estimated visit duration, a concrete activity, and source/uncertainty labels.

Initial scenarios: a short walk, coffee with specific amenities, and an outing with a child. Automated POI collection and real retrieval plus generation are core requirements.

## Documents
- [Original Russian brief](docs/HACKATHON_BRIEF_RU.txt)
- [Proposed RAG architecture](docs/ARCHITECTURE.md)
- [Data collection plan](docs/DATA_PLAN.md)
- [Scenario and limitations document](docs/TEST_SCENARIOS_AND_LIMITATIONS.md)
- [Privacy and safety](docs/PRIVACY_AND_SAFETY.md)
- [5–7 minute presentation outline](docs/PRESENTATION_OUTLINE.md)
- [Feature backlog](FEATURE_BACKLOG.md)
- [README completion template](README_TEMPLATE.md)

## Setup
No runtime or dependencies have been selected. Add tested installation, environment, ingestion, run, test, and build instructions when the application exists. No API provider or key is required by these planning files.

## Submission
The supplied brief requires a repository link or prototype archive, presentation PDF/slides, a test-scenario and limitations document, and a YouTube demo accessible by link. Exact rubric weights and deadline have not been supplied.

`old/` preserves the previous HackAlem templates unchanged. Use the root documents and `prompts/` for this hackathon.
