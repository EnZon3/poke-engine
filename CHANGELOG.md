# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

- _No changes yet._

## [1.1.0] - 2026-04-15

### Added
- Showdown export team import support via new parser utilities:
	- `parseShowdownTeam(text)`
	- `parseTeamInput(text)` (JSON-first, Showdown fallback)
	- `loadTeamInputFile(path)`
- New team-import test coverage in [src/team-import.test.ts](src/team-import.test.ts).
- New trainer parser API export:
	- `parseTrainerScript(text, trainerName, gameCode)`
- New trainer parser test coverage in [src/trainers.test.ts](src/trainers.test.ts).
- New data-loading regression tests in [src/data.test.ts](src/data.test.ts).
- New setup controls for gimmicks in TUI:
	- `mechanicsPolicy`: `generation-default | disable-all`
	- `gimmickControl`: `manual | auto`
- Auto gimmick branch evaluation in matcher logic with tactical notes:
	- `Auto gimmick timing selected: ...`
	- `Opponent best response assumes: ...`
- Critical-hit and multi-hit move metadata support in move loading and damage evaluation.
- Expanded TUI results UX:
	- selectable cards (arrow keys)
	- expandable per-card details (`Enter` / `e`) showing full notes and top lines
- Comprehensive TUI user guide in [docs/TUI_GUIDE.md](docs/TUI_GUIDE.md).
- GitHub issue forms, project label definitions, and label sync workflow:
	- `.github/ISSUE_TEMPLATE/bug_report.yml`
	- `.github/ISSUE_TEMPLATE/feature_request.yml`
	- `.github/labels.yml`
	- `.github/workflows/sync-labels.yml`
- New validation commands:
	- `npm run validate:test`
	- `npm run validate:accuracy`
- Mechanics/process documentation additions:
	- `docs/MECHANICS_CHANGE_PROTOCOL.md`
	- validation reports under `docs/validation-reports/`:
		- `BENCHMARK_ACCURACY_SPOTCHECK_2026-04-12.md`
		- `GIMMICKS_POLICY_BENCHMARK_VERIFICATION_2026-04-12.md`
		- `GIMMICKS_IN_BATTLE_ACCURACY_2026-04-12.md`

### Changed
- Project version metadata bumped from `1.0.0` to `1.1.0`.
- Team-file inputs now accept either JSON arrays or Showdown export text in both CLI and TUI file-loading paths.
- Generation-aware gimmick handling implemented in Pokémon construction/evaluation:
	- Mega Evolution active only in Gen 6-7
	- Dynamax active only in Gen 8
	- Terastallization active only in Gen 9
- Mechanics policy `disable-all` now consistently suppresses Mega/Dynamax/Tera effects.
- Damage modeling improvements:
	- uses `maxMoveBasePower` when available for Dynamax
	- applies Fighting/Poison-specific Max Move BP table behavior
	- updates tera STAB handling for same-type/off-type tera paths
- Benchmark suite expanded and strengthened:
	- increased scenario coverage (including more doubles archetypes and gimmick edge cases)
	- added per-scenario generation/policy context and score tolerance checks
- TUI layout now responds better to terminal size changes in result and help views.
- API and README documentation updated for:
	- `gimmickControl`
	- mechanics policy behavior
	- Showdown team input support
	- updated TUI keybindings and validation commands
- Contributing documentation now references issue forms, label triage, and the mechanics change protocol.

### Fixed
- PokeAPI species loading now falls back to a species default form when direct Pokémon lookup 404s, fixing form-based Pokémon such as Gen 3 Deoxys.
- PokeAPI species loading now skips fully unresolvable entries without failing the whole data load.
- Gen 3 trainer loading now supports `let`, `const`, and `var` declarations and extracts trainer arrays robustly when nested arrays or brackets in strings are present.
- TUI results cards now surface gimmick-related notes more reliably and no longer hide key tactical notes behind a single first-note display.
- Multiple TUI/editor data paths now preserve and edit `megaForm` consistently.
- Validation docs and contributor guidance now consistently include `validate:test` alongside typecheck/bench.
- README nightly-build wording typo fixed.

### Removed
- _None yet_

## [1.0.0] - 2026-04-11

### Added
- Initial public stable release.
- Validation workflow scripts and CI checks.
- Mechanics and accuracy verification documentation.
- Modularized evaluation and TUI code organization.

### Notes
- This is a practical matchup evaluator and not a full battle simulator.
- Mega Evolution and generation-aware Terastallization/Dynamax simulation are planned follow-up work.
