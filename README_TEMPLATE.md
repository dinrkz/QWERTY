# README completion guide

Use this guide when code exists. Replace planning status with evidenced implementation status; do not publish unsupported setup commands.

1. Product concept, target users, Build with AI case, and supported scenarios.
2. What works, what is incomplete, and a screenshot/demo link if available.
3. High-level RAG flow: data collection → retrieval/filtering → grounded generation → validation.
4. POI sources, attribution, access/reuse terms, collection dates, missing fields, and refresh process.
5. Prerequisites, tested runtime versions, exact dependency installation command, lockfile.
6. Actual environment variables with secret-free `.env.example`; model/provider choices and any verified costs/limits.
7. Exact collection/normalization/index commands and approved demo snapshot setup.
8. Exact start command and demo steps for the selected scenarios.
9. Actual test/type/lint/build commands and recorded verification status.
10. Privacy: location collection, provider sharing, logging, retention, and permission fallback.
11. Limitations: data coverage/freshness, unavailable amenities/hours, distance versus route estimates, provider failures.
12. Submission links: slides/PDF, scenarios and limitations, YouTube demo, repository/archive.

Only include database setup/reset or hosting instructions if the implementation requires them.
