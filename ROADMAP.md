# Roadmap (Skeleton)

Last updated: April 2026

This roadmap is intentionally lightweight and should evolve with contributor priorities.

## Now (0-2 months)

- Stabilize evaluation module boundaries after refactors.
- Expand benchmark scenarios for doubles lead archetypes.
- Improve docs consistency across CLI, API, and TUI references.
- Add Mega Evolution support (generation-dependent availability/behavior).
- Implement proper simulation paths for Terastallization and Dynamax, gated by generation/format rules.

## Next (2-6 months)

- Add more explicit mechanics coverage tests (status, weather, hazards).
- Improve setup-line explainability in result rationale output.
- Add optional export/report formats for batch team analysis.

## Later (6+ months)

- Deeper search options for switch-aware planning (opt-in).
- Per-generation behavior profiles with clearer toggles.
- Additional data-source reconciliation and validation tooling.

## Backlog candidates

- Smarter confidence calibration against larger scenario sets.
- Better handling for niche move/item/ability interactions.
- Bench result history tracking for trend analysis.

## How to propose roadmap changes

Open a PR that:

1. Updates this file.
2. Explains impact and rough implementation scope.
3. Identifies validation strategy (`validate:bench`, targeted checks, manual spot checks).
