# Roadmap

Last updated: April 2026

This roadmap should evolve with contributor priorities.

## Next Release Candidate: v1.3.0

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

## Near Future UI Work: TUI Rewrite + GUI Exploration

Goal: make the interactive experience easier to scan, easier to test, and ready for a possible desktop GUI without coupling engine logic to a specific interface.

### TUI layout rewrite

- [ ] Audit the current TUI screens and record the main layout pain points:
	- setup wizard flow
	- team editor density
	- result card scanning
	- expanded result details
	- help/keybinding discoverability
	- small terminal behavior
- [ ] Define a stable TUI information architecture:
	- setup
	- team source selection
	- team editor
	- battle state controls
	- results overview
	- result details
	- help
- [ ] Split TUI state from rendering more aggressively so layout changes do not affect evaluation behavior.
- [ ] Create reusable TUI layout primitives:
	- screen shell
	- section heading
	- field row
	- selectable list
	- status/footer bar
	- result summary row/card
	- detail panel
- [ ] Add responsive terminal layout rules:
	- narrow terminal fallback
	- minimum usable height behavior
	- predictable truncation for long species/move/item names
	- no content overlap when result notes are long
- [ ] Redesign the team editor workflow:
	- clearer active side indicator
	- clearer active Pokémon slot
	- grouped fields for identity, battle flags, stats, and moves
	- faster add/delete/edit flow
	- safer unsaved-change prompts before destructive actions
- [ ] Redesign the results workflow:
	- compact ranked overview
	- expanded detail view for one matchup
	- explicit score-driver breakdown
	- clearer confidence/risk display
	- clearer gimmick/setup notes
- [ ] Add TUI-focused regression checks where practical:
	- pure state-transition tests
	- field parsing tests
	- terminal-width formatting tests for helpers
	- manual smoke checklist for common terminal sizes
- [ ] Update `docs/TUI_GUIDE.md` after the layout stabilizes.

### Shared UI model groundwork

- [ ] Define interface-agnostic view models for:
	- team editor state
	- setup options
	- battle state controls
	- ranked matchup summaries
	- detailed matchup explanations
- [ ] Keep evaluation, import, and save-loading logic callable without Ink-specific dependencies.
- [ ] Add API helpers for GUI/TUI consumers if repeated transformation logic appears.
- [ ] Document which UI state is persistent user data versus temporary navigation state.

### Electron GUI exploration

- [ ] Write a short GUI feasibility note before implementation:
	- target users
	- supported platforms
	- packaging size tradeoffs
	- whether Electron is worth the maintenance cost
	- alternatives considered, such as a web app shell or lighter desktop wrapper
- [ ] Decide the first GUI scope:
	- team import/edit
	- battle state setup
	- run evaluation
	- results overview/details
	- export report
- [ ] Prototype a minimal Electron shell only after the shared UI model is stable.
- [ ] Keep the first GUI prototype read/write-compatible with existing JSON and Showdown team files.
- [ ] Reuse engine APIs directly rather than duplicating evaluation logic in renderer code.
- [ ] Define packaging and release expectations:
	- local dev command
	- production build command
	- artifact names
	- platform support
	- signing/notarization expectations if macOS distribution becomes a goal
- [ ] Add a go/no-go checkpoint after the prototype:
	- TUI remains supported
	- GUI maintenance cost is acceptable
	- packaging works on at least one primary platform
	- no engine/API compromises were introduced for GUI convenience


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
- [ ] Fix support for TUI in packaged binary builds.
- [ ] Add an auto update check for this project's GitHub releases and show update availability in the TUI footer/status bar.
- [ ] Reject team builder Pokémon that are unavailable in the selected generation.
	- Example: when setup is configured for Gen 3, the team builder should reject a future-generation Pokémon such as Meowscarada instead of accepting it and continuing normally.
	- Validation should happen before evaluation/imported team use so teams cannot silently include species from later generations.

## Next (2-6 months)

- [ ] Replace custom Showdown text parsing and data sourcing with Pokémon Showdown's official npm package integration (sim API) to reduce bespoke parsing code, improve readability, and track upstream format behavior.
	- Reference: https://github.com/smogon/pokemon-showdown/blob/HEAD/sim/README.md
- [ ] Add team-level diagnostics (coverage heatmap + threat pressure map for common archetypes).
- [ ] Add more explicit mechanics coverage tests (status, weather, hazards).
- [ ] Expand benchmark quality checks (doubles score/gap tolerances, more archetype cases, and per-gen validation profiles).
- [ ] Improve setup-line explainability in result rationale output (flexible and user-facing, not rigid one-size-fits-all templates).
- [ ] Add optional export/report formats for batch team analysis.
- [ ] Prepare the TUI rewrite by separating interface-agnostic view models from Ink rendering components.

## Later (6+ months)

- [ ] Deeper search options for switch-aware planning (opt-in).
- [ ] Add scenario planning/A-B compare workflows for alternate battle states (weather/terrain/screens/hazards).
- [ ] Per-generation behavior profiles with clearer toggles.
- [ ] Additional data-source reconciliation and validation tooling.
- [ ] Complete the TUI layout rewrite for richer comparative views and tradeoff summaries.
- [ ] Evaluate whether an Electron GUI should become an officially supported distribution target.

## Backlog candidates

- [ ] Smarter confidence calibration against larger scenario sets.
- [ ] Better handling for niche move/item/ability interactions.
- [ ] Bench result history tracking for trend analysis.

## How to propose roadmap changes

Open a PR that:

1. Updates this file.
2. Explains impact and rough implementation scope.
3. Identifies validation strategy (`validate:bench`, targeted checks, manual spot checks).
