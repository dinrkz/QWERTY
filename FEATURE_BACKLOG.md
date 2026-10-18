# Feature backlog

All entries are proposals. Core requirements remain in `CASE.md` and are not optional backlog items.

| Candidate | User/scoring value | Minimum scope | Dependency / risk | Decision |
|---|---|---|---|---|
| Three-stop mini-route | Context, usefulness, creativity | Order three supported POIs and show total estimated time | Valid travel estimates and visit durations; route claims need routing evidence | After core tests |
| Group preferences | Context, creativity | Combine explicit preferences of 3–5 people | Conflict handling; avoid collecting identities | Backlog |
| Additional languages | UX, creativity | Render grounded recommendations in the user's language | Evaluate preserved facts and place names | Backlog |
| Local events | Relevance, creativity | Retrieve events with dates and source links | Fresh permitted source; expired listings and fabricated events | Backlog |
| Accessibility filters | Usefulness, ethics | Filter only by documented accessibility attributes | Coverage and field-level evidence; unknown cannot mean accessible | Backlog |

## Selection rule
Choose additions only after the core works and submission time is protected. Prefer measurable improvements to relevance, context, explanations, or demo usability using current data and architecture. Do not invent numerical score gains or implementation time estimates before inspecting the code and actual remaining time.

For a new candidate record: user need, criterion affected, smallest implementation, data/source requirements, dependencies, estimate with assumptions, risk, acceptance test, and BUILD / BACKLOG / REJECT decision. A recommendation assistant does not need an artificial state-changing action to qualify as useful.
