# Roadmap

Last updated: April 2026

This roadmap should evolve with contributor priorities.

## Next Release Candidate: v1.2.0

Theme: explainability and team diagnostics.

- [ ] Add team-level diagnostics:
  - coverage heatmap
  - defensive weakness/resistance summary
  - threat pressure map
- [ ] Improve matchup rationale output:
  - explain primary score drivers
  - identify key risks
  - distinguish offensive, defensive, speed, setup, and gimmick contributions
- [ ] Add focused mechanics tests for status, weather, hazards, screens, and priority.
- [ ] Expand benchmark profiles by generation and format.
- [ ] Add optional report/export output for batch analysis.


## Now (0-2 months)

- [x] Stabilize evaluation module boundaries after refactors.
- [x] Expand benchmark scenarios for doubles lead archetypes. *(completed April 2026; coverage expanded to Tailwind, Trick Room, redirection+setup, weather, and Intimidate pivot leads; benchmark stable in `validate:bench`)*
	- Definition: broaden `validate:bench` coverage so doubles evaluations are tested against common lead patterns rather than only generic/opening cases.
	- Include at minimum: Fake Out pressure leads, Tailwind speed-control leads, Trick Room setup leads, redirection + setup leads, weather leads, and Intimidate pivot leads.
	- For each added scenario, capture expected ranking/score behavior (or tolerance band) so regressions are obvious and comparable across runs.
	- Done when benchmark output is stable across repeated runs and meaningfully differentiates strong vs weak setup lines for these archetypes.
- [x] Improve docs consistency across CLI, API, and TUI references. *(completed April 2026; aligned keybindings and CLI/API reference pointers, and synced validation command docs)*
- [x] Add Mega Evolution support (generation-dependent availability/behavior).
- [x] Implement proper simulation paths for Terastallization and Dynamax, gated by generation/format rules.

## Next (2-6 months)

- [ ] Replace custom Showdown text parsing and data sourcing with Pokémon Showdown's official npm package integration (sim API) to reduce bespoke parsing code, improve readability, and track upstream format behavior.
	- Reference: https://github.com/smogon/pokemon-showdown/blob/HEAD/sim/README.md
- [ ] Add team-level diagnostics (coverage heatmap + threat pressure map for common archetypes).
- [ ] Add more explicit mechanics coverage tests (status, weather, hazards).
- [ ] Expand benchmark quality checks (doubles score/gap tolerances, more archetype cases, and per-gen validation profiles).
- [ ] Improve setup-line explainability in result rationale output (flexible and user-facing, not rigid one-size-fits-all templates).
- [ ] Add optional export/report formats for batch team analysis.

## Later (6+ months)

- [ ] Deeper search options for switch-aware planning (opt-in).
- [ ] Add scenario planning/A-B compare workflows for alternate battle states (weather/terrain/screens/hazards).
- [ ] Per-generation behavior profiles with clearer toggles.
- [ ] Additional data-source reconciliation and validation tooling.
- [ ] Matchup results UI redesign for richer comparative views and tradeoff summaries.

## Backlog candidates

- [ ] Smarter confidence calibration against larger scenario sets.
- [ ] Better handling for niche move/item/ability interactions.
- [ ] Bench result history tracking for trend analysis.

## How to propose roadmap changes

Open a PR that:

1. Updates this file.
2. Explains impact and rough implementation scope.
3. Identifies validation strategy (`validate:bench`, targeted checks, manual spot checks).
