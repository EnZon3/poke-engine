# Roadmap

Last updated: April 2026

This roadmap should evolve with contributor priorities.

## Reference IDs

Roadmap items have stable IDs for quick discussion. Use the prefix for the planning horizon, then the item number:

- `0-2:n` for active 0-2 month work.
- `2-6:n` for up-next 2-6 month work.
- `6+:n` for later 6+ month work.
- `UI:n` for the UI track.
- `P:n` for parking-lot items.

Example: `0-2:7` refers to the auto update check task.

## Current Focus: v1.3.0

Theme: mechanics accuracy, explainability, and team diagnostics.

Primary release scope: `0-2:6`, `0-2:7`, `0-2:8`, `0-2:9`, `0-2:10`, `0-2:11`, `2-6:4`, `2-6:5`, `2-6:6`, `2-6:8`, and `2-6:9`.

## Now (0-2 months)

- [ ] `0-2:6` Fix support for TUI in packaged binary builds.
- [ ] `0-2:7` Add an auto update check for this project's GitHub releases and show update availability in the TUI footer/status bar.
- [ ] `0-2:8` Reject team builder Pokémon that are unavailable in the selected generation.
	- Example: when setup is configured for Gen 3, the team builder should reject a future-generation Pokémon such as Meowscarada instead of accepting it and continuing normally.
	- Validation should happen before evaluation/imported team use so teams cannot silently include species from later generations.
- [ ] `0-2:9` Expand ability modeling for high-impact competitive mechanics.
	- Add support for damage and defensive abilities such as Intimidate, Guts, Flash Fire, Multiscale, and Shadow Shield.
	- Normalize common immunity abilities such as Levitate, Motor Drive, Volt Absorb, Lightning Rod, Storm Drain, Water Absorb, and Sap Sipper.
	- Model weather-based speed abilities such as Swift Swim, Chlorophyll, Sand Rush, and Slush Rush.
	- Add evaluation hooks for Unaware, Prankster, Clear Body, White Smoke, and Full Metal Body.
	- Suggested `AbilityEntry` fields: `intimidate`, `weatherSpeed`, `offensiveBoostOnImmunity`, `ignoreBoosts`, `statusBoostAttack`, `fullHpDamageReduction`, and `priorityOnStatus`.
- [ ] `0-2:10` Add speed control awareness.
	- Add `trickRoom?: boolean` to `BattleState` and invert speed comparison while active.
	- Add Tailwind side state, such as `myTailwind?: boolean` and `enemyTailwind?: boolean`, and apply a 2x speed multiplier before speed comparisons.
	- Optionally flag teams carrying Trick Room or Tailwind as able to shift speed dynamics.
- [x] `0-2:11` Rename the project to reduce name collision with other `poke-eval` projects.
	- New project name: `poke-eval`.
	- Update package metadata, CLI references, docs, repository naming, and release artifacts once the new name is chosen.
	- Include a short migration note for users who installed or referenced the old project name.

## Next (2-6 months)

### Engine accuracy

- [ ] `2-6:1` Migrate parsing and data sourcing to Pokémon Showdown's official npm package integration.
	- Treat this as a compatibility-sensitive API migration, not a purely internal refactor.
	- Remove or redesign existing parameters that become redundant under Showdown's sim/data model.
	- Preserve compatibility only where it protects real user workflows, such as common CLI inputs and saved team files.
	- Provide migration notes for any API, JSON, or validation behavior changes.
	- Reference: https://github.com/smogon/pokemon-showdown/blob/HEAD/sim/README.md
- [ ] `2-6:2` Add doubles-specific spread move damage adjustment.
	- Add a move targeting flag, such as `target?: 'single' | 'allAdjacentFoes' | 'allAdjacent'`, to `MoveEntry`.
	- Apply the 0.75x doubles spread modifier for moves such as Earthquake, Rock Slide, Heat Wave, Dazzling Gleam, Muddy Water, Surf, Discharge, and Blizzard.
- [ ] `2-6:3` Model key item interactions.
	- Add survivability effects for Focus Sash, Sitrus Berry, Leftovers, and Assault Vest.
	- Add damage and chip effects for Life Orb and Rocky Helmet where relevant to 2-turn evaluation.
- [ ] `2-6:4` Add team-level diagnostics.
	- coverage heatmap
	- defensive weakness/resistance summary
	- threat pressure map
- [ ] `2-6:5` Add more explicit mechanics coverage tests for status, weather, hazards, screens, and priority.
- [ ] `2-6:6` Expand benchmark quality checks by generation and format.
	- Include doubles score/gap tolerances, more archetype cases, and per-gen validation profiles.
- [ ] `2-6:7` Add switch-in evaluation.
	- Use existing hazard switch-in fraction logic to estimate whether a benched Pokémon can survive entry, take a hit, and threaten back.
	- In doubles, flag safer bench options when one lead goes down.
- [ ] `2-6:8` Improve setup-line and matchup rationale explainability.
	- Explain primary score drivers.
	- Identify key risks.
	- Distinguish offensive, defensive, speed, setup, and gimmick contributions.
	- Keep output flexible and user-facing, not rigid one-size-fits-all templates.
- [ ] `2-6:9` Add optional report/export output for batch team analysis.

### UI groundwork

- [ ] `2-6:10` Prepare the TUI rewrite by separating interface-agnostic view models from Ink rendering components.

## UI Track

Goal: make the interactive experience easier to scan, easier to test, and ready for a possible desktop GUI without coupling engine logic to a specific interface.

### TUI layout rewrite

- [ ] `UI:1` Audit the current TUI screens and record the main layout pain points:
	- setup wizard flow
	- team editor density
	- result card scanning
	- expanded result details
	- help/keybinding discoverability
	- small terminal behavior
- [ ] `UI:2` Define a stable TUI information architecture:
	- setup
	- team source selection
	- team editor
	- battle state controls
	- results overview
	- result details
	- help
- [ ] `UI:3` Split TUI state from rendering more aggressively so layout changes do not affect evaluation behavior.
- [ ] `UI:4` Create reusable TUI layout primitives:
	- screen shell
	- section heading
	- field row
	- selectable list
	- status/footer bar
	- result summary row/card
	- detail panel
- [ ] `UI:5` Add responsive terminal layout rules:
	- narrow terminal fallback
	- minimum usable height behavior
	- predictable truncation for long species/move/item names
	- no content overlap when result notes are long
- [ ] `UI:6` Redesign the team editor workflow:
	- clearer active side indicator
	- clearer active Pokémon slot
	- grouped fields for identity, battle flags, stats, and moves
	- faster add/delete/edit flow
	- safer unsaved-change prompts before destructive actions
- [ ] `UI:7` Redesign the results workflow:
	- compact ranked overview
	- expanded detail view for one matchup
	- explicit score-driver breakdown
	- clearer confidence/risk display
	- clearer gimmick/setup notes
- [ ] `UI:8` Add TUI-focused regression checks where practical:
	- pure state-transition tests
	- field parsing tests
	- terminal-width formatting tests for helpers
	- manual smoke checklist for common terminal sizes
- [ ] `UI:9` Update `docs/TUI_GUIDE.md` after the layout stabilizes.

### Shared UI model groundwork

- [ ] `UI:10` Define interface-agnostic view models for:
	- team editor state
	- setup options
	- battle state controls
	- ranked matchup summaries
	- detailed matchup explanations
- [ ] `UI:11` Keep evaluation, import, and save-loading logic callable without Ink-specific dependencies.
- [ ] `UI:12` Add API helpers for GUI/TUI consumers if repeated transformation logic appears.
- [ ] `UI:13` Document which UI state is persistent user data versus temporary navigation state.

### Electron GUI exploration

- [ ] `UI:14` Write a short GUI feasibility note before implementation:
	- target users
	- supported platforms
	- packaging size tradeoffs
	- whether Electron is worth the maintenance cost
	- alternatives considered, such as a web app shell or lighter desktop wrapper
- [ ] `UI:15` Decide the first GUI scope:
	- team import/edit
	- battle state setup
	- run evaluation
	- results overview/details
	- export report
- [ ] `UI:16` Prototype a minimal Electron shell only after the shared UI model is stable.
- [ ] `UI:17` Keep the first GUI prototype read/write-compatible with existing JSON and Showdown team files.
- [ ] `UI:18` Reuse engine APIs directly rather than duplicating evaluation logic in renderer code.
- [ ] `UI:19` Define packaging and release expectations:
	- local dev command
	- production build command
	- artifact names
	- platform support
	- signing/notarization expectations if macOS distribution becomes a goal
- [ ] `UI:20` Add a go/no-go checkpoint after the prototype:
	- TUI remains supported
	- GUI maintenance cost is acceptable
	- packaging works on at least one primary platform
	- no engine/API compromises were introduced for GUI convenience

## Later (6+ months)

- [ ] `6+:1` Deeper search options for switch-aware planning (opt-in).
- [ ] `6+:2` Add scenario planning/A-B compare workflows for alternate battle states (weather/terrain/screens/hazards).
- [ ] `6+:3` Per-generation behavior profiles with clearer toggles.
- [ ] `6+:4` Additional data-source reconciliation and validation tooling.
- [ ] `6+:5` Add a contact flag on moves for item and ability chip interactions.
	- Add `contact` to `MoveEntry` for Rocky Helmet, Flame Body, Static, Rough Skin, Iron Barbs, and Protective Pads modeling.
- [ ] `6+:6` Complete the TUI layout rewrite for richer comparative views and tradeoff summaries.
- [ ] `6+:7` Evaluate whether an Electron GUI should become an officially supported distribution target.

## Completed

- [x] `0-2:1` Stabilize evaluation module boundaries after refactors.
- [x] `0-2:2` Expand benchmark scenarios for doubles lead archetypes. *(completed April 2026; coverage expanded to Tailwind, Trick Room, redirection+setup, weather, and Intimidate pivot leads; benchmark stable in `validate:bench`)*
	- Definition: broaden `validate:bench` coverage so doubles evaluations are tested against common lead patterns rather than only generic/opening cases.
	- Include at minimum: Fake Out pressure leads, Tailwind speed-control leads, Trick Room setup leads, redirection + setup leads, weather leads, and Intimidate pivot leads.
	- For each added scenario, capture expected ranking/score behavior (or tolerance band) so regressions are obvious and comparable across runs.
	- Done when benchmark output is stable across repeated runs and meaningfully differentiates strong vs weak setup lines for these archetypes.
- [x] `0-2:3` Improve docs consistency across CLI, API, and TUI references. *(completed April 2026; aligned keybindings and CLI/API reference pointers, and synced validation command docs)*
- [x] `0-2:4` Add Mega Evolution support (generation-dependent availability/behavior).
- [x] `0-2:5` Implement proper simulation paths for Terastallization and Dynamax, gated by generation/format rules.

## Parking Lot

- [ ] `P:1` Smarter confidence calibration against larger scenario sets.
- [ ] `P:2` Better handling for niche move/item/ability interactions.
- [ ] `P:3` Bench result history tracking for trend analysis.

## How to propose roadmap changes

Open a PR that:

1. Updates this file.
2. Explains impact and rough implementation scope.
3. Identifies validation strategy (`validate:bench`, targeted checks, manual spot checks).
