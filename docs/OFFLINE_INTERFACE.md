# Private offline interface

Implemented on 2026-10-19 at the user's request, after `510a8e5` on `work/data/source-feasibility`. The existing browser interface now searches saved places through Python. Activities use templates. Live RAG, provider access, source permissions and hackathon completion remain separate work.

## Start

From the repository root, run `npm.cmd run start:offline`. Open the URL printed at startup; the current computer uses `http://127.0.0.1:3002` because another app instance occupies port 3000. Stop with Ctrl+C in the launching terminal. If the coding agent has already started this server, use that instance. The launcher default is 3000 when configuration omits `port`.

The configured computer has an ignored `data/runtime/offline-app.json` containing the existing snapshot, annotations and `binding-v2.json` paths. It contains no keys or POI records. The launcher reads no `.env` or `.env.local`. Use this command for private evaluation; `npm start` remains the separately configured live application.

Tested with Node 24.12 and Python 3.13. The existing Node minimum is 22.14. No dependencies, embedding service, database or build step were added.

## Another authorized local checkout

A clean clone contains code and synthetic tests, not the private dataset. Provision only data you are authorized to use. Follow [retrieval setup](OFFLINE_RETRIEVAL.md) to validate the snapshot, annotations and exact code/policy binding. Never automatically regenerate a binding to bypass a mismatch.

Create `data/runtime/offline-app.json`. These are illustrative paths, not an available dataset:

```json
{
  "python": "C:/path/to/python.exe",
  "snapshot": "data/private/2gis/REVIEWED_SNAPSHOT_HASH",
  "annotations": "data/runtime/walking-review/annotations.json",
  "binding": "data/runtime/retrieval-evaluation/binding-v2.json",
  "port": 3000
}
```

Use forward slashes or escaped backslashes. Paths resolve against the repository root; Python must be an existing executable file. Only these five configuration fields are accepted. A different config can be selected with `npm.cmd run start:offline -- --config data/runtime/another-offline-app.json`.

Startup makes no provider requests. Wrong configuration or missing configured paths fail startup with a generic message. Search checks file contents and bindings; stale/mismatched contents or files removed after startup produce typed data errors, without revealing paths or records. The server binds only to `127.0.0.1`; do not publish it or expose it through a tunnel.

## Use

1. Choose walk, discovery or coffee. Offline categories are park/landmark, park/museum/landmark, and cafe respectively. Gallery-only records remain excluded.
2. Keep/edit the simulated coordinates or select a rounded start near Bayterek, Mega Silk Way or Zhetysu Park. Presets come from the reviewed collection plan and are not verified entrances.
3. Set time, straight-line radius, optional return and buffer. Each of up to three cards is an alternative, not one stop in a combined route.
4. Keywords are optional. They rank word matches without removing every nonmatch or interpreting written constraints. Use the controls for essential requirements. First-visit context does not change offline ranking.
5. Read source facts and reviewer qualifications. Missing descriptions stay missing. Hours, events and amenities are currently unknown, so requiring them yields no places. Ideas are conditional templates; no AI was called.

Eligibility uses full-precision heuristic distances/times. Displayed time components use tenths of a minute; the displayed total sums them. Small rounding at budget boundaries is possible. Source names/descriptions and reviewer notes retain their original language; RU/KK/EN selects interface/template copy.

## Boundaries

Browser → loopback server → isolated Python child → validated private envelope → offline cards.

- The launcher selects a dedicated service before provider construction and pins snapshot/review/policy/binding hashes from the existing manifest. The browser cannot choose files, commands or clocks.
- `offline_ui_adapter.py` uses `-I -B`, an allowlisted environment and socket/DNS guards. It delegates to the existing read-only adapter with `--mode offline`.
- The separate validator requires the private envelope, false eligibility flags, source-version evidence, nullable facts, reviewed status and matching category mapping. It independently checks distances, budgets and hard filters. The live validator remains unchanged and rejects private envelopes.
- Cards retain source attribution/version IDs, fine/source categories, reviewer notes and uncertainty codes. Seating/entrance caveats are visible. Source attribution is plain text without fabricated links.
- OpenAI, the map and device geolocation are disabled. Offline CSP permits local resources only. Submission waits for configuration.
- No prompt/location logging, analytics, cookies or browser storage is introduced. Coordinates and keywords stay transient locally. Only bounded cards enter the browser; raw dataset/config files are outside the static-file allowlist.
- Records remain `demo_eligible=false` and `external_processing_allowed=false`. User-directed private evaluation does not resolve storage, redistribution or external AI-processing permissions. Originals, reviews and accounting ledgers remain preserved.

## Verification

```powershell
node --import ./scripts/app/offline-network-guard.mjs --test tests/app/*.test.mjs
python -B -m unittest discover -s tests/data -p "test_*.py" -q
npm.cmd run check
node scripts/app/verify-offline.mjs
```

The last command uses the configured private files, 45 loopback-only scenarios, source-file hashes and aggregate output. It does not print POIs, names, paths, prompts or precise start coordinates. Localhost must be permitted by the execution environment; external fetch/HTTPS and Python networking are blocked.

Final working-tree checks on 2026-10-19: **250 application tests, 188 Python tests, 63 Node–Python bridge checks (48 estimate cases), and syntax checks for 28 JavaScript modules passed**. The private integration check passed **45 cases**: 16 with results and 29 without, with **eight source/review/binding/accounting files unchanged** and zero external requests. Three independent read-only code reviewers reported no remaining findings after fixes to category consistency, per-place caveats, input bounds and displayed time totals. Documentation corrections from an additional review were applied. These are offline engineering checks, not live RAG or submission acceptance.

For browser checks, run `node tests/app/fixtures/offline-ui-server.mjs` and open `http://127.0.0.1:3001`. This helper uses only visibly labeled authored synthetic records. Stop it after testing. Browser verification exercised RU walk, EN coffee/source metadata, unknown sockets rejection, KK keyword preservation and return estimates. Private cards were not sent to the browser-review tool.

## Handoff

Changed: offline validator/presenter, explicit server branch, startup/network guard, UI labels/presets/cards, tests and docs. The subprocess transport, core retrieval policy and live validator are unchanged. The npm script and ignored JSON configuration are new; no environment-variable contract or dependency was added. This increment is reviewed for the user-authorized update to [PR #4](https://github.com/dinrkz/QWERTY/pull/4) on `work/data/source-feasibility`, based on `510a8e5`. The PR description records the resulting commit; `git log -1 -- src/app/offline.mjs` identifies the interface implementation in a checkout.

| Paths | Change |
|---|---|
| `src/app/offline.mjs`, `src/server.mjs` | Separate private validator, template presentation and server branch |
| `public/app.mjs`, `public/i18n.mjs`, `public/index.html` | Offline controls, RU/KK/EN labels, nullable facts and provenance |
| `scripts/app/start-offline.mjs`, `offline-network-guard.mjs`, `verify-offline.mjs`; `scripts/data/offline_ui_adapter.py`; `package.json` | Explicit local startup, network guards and aggregate verification |
| `tests/app/offline.test.mjs`, `offline-config.test.mjs`, `fixtures/private-envelope.mjs`, `fixtures/offline-ui-server.mjs`; `tests/data/test_offline_ui_adapter.py` | Authored fixtures and offline boundary/configuration/transport checks |
| `CASE.md`, `README.md`, `docs/ARCHITECTURE.md`, `CONTRACTS.md`, `OFFLINE_INTERFACE.md`, `OFFLINE_RETRIEVAL.md`, `MEMBER_2_RETRIEVAL_HANDOFF.md` | Current scope, configuration, evidence and handoff |

Full live RAG, map operation, permitted dataset reuse, multilingual recommendation quality and submission evidence remain pending. See [the shared contract](CONTRACTS.md) and [member 2 handoff](MEMBER_2_RETRIEVAL_HANDOFF.md).
