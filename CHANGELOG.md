# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

- _None yet_

## [1.2.0] - 2026-04-21

### Added
- Refactor phase completion artifacts and validation coverage:
	- Module-level public-surface tests in `tests/public-surface.test.ts`.
	- Golden behavior tests in `tests/golden.test.ts` for fixed `evaluateTeams` ordering and CLI `--json` output shape.
- New packaging cleanup command:
	- `npm run package:clean`
- New shared evaluation configuration module:
	- `src/evaluation/config.ts` with centralized mode presets and default option profiles.
- New CLI submodules for clearer ownership boundaries:
	- `src/cli/options.ts`
	- `src/cli/execute.ts`
	- `src/cli/help.ts`
- New TUI input transition module:
	- `src/tui/state-machine.ts`
- New shared reporting helper:
	- `src/reporting/console.ts`

### Changed
- Completed all items in `docs/REFACTOR_PLAN.md` (items 1-15 marked done).
- Project version metadata bumped from `1.1.2` to `1.2.0`.
- CLI architecture refactored from monolithic parsing/execution into parse + execute + help modules while preserving flag behavior.
- Evaluation mode defaults are now sourced from centralized presets instead of duplicated literals.
- Data cache handling now has explicit boundary helpers in `src/data.ts`:
	- `getDataCache()`
	- `setDataCache()`
	- `resetDataCache()`
	- `isDataLoaded()`
- Cache-consuming modules now use the cache boundary API (pokemon building, estimation, damage/evaluation orchestration).
- TUI keyboard/input handling moved into a dedicated state-transition handler for setup/editor/results phases.
- Benchmark and accuracy scripts now share console-rule formatting helpers to keep output formatting aligned.
- Roadmap structure updated with stable reference IDs and current v1.3.0 planning scope.

### Fixed
- Removed remaining dead internals identified by unused-symbol checks:
	- unused import in `src/evaluation/damage.ts`
	- unused local in `src/evaluation/helpers.ts`
	- unused import binding in `src/evaluation/index.ts`

### Verification
- `npm run validate:all` passes after refactor completion.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` passes.
- Benchmark output remains text-identical to baseline (`diff -u` against `docs/validation-reports/REFACTOR_BENCH_BASELINE_2026-04-17.txt` produced no output).

## [1.1.2] - 2026-04-16

### Security
- Replaced regular-expression parsing over imported Showdown team text with deterministic string parsing to avoid potential regex backtracking denial-of-service cases.
- Replaced form-name regex parsing in species resolution with bounded string parsing.

### Fixed
- Added explicit read-only `GITHUB_TOKEN` permissions to validation workflows.
- Added regression coverage for Showdown imports with nicknames and gender markers.

## [1.1.1] - 2026-04-16

### Added
- New all-platform portable packaging command:
	- `npm run package:portable:all`
- Portable runtime builds now emit ready-to-upload `.tar.gz` archives during packaging:
	- `poke-engine-portable-linux-x64.tar.gz`
	- `poke-engine-portable-windows-x64.tar.gz`
	- `poke-engine-portable-macos-x64.tar.gz`
	- `poke-engine-portable-macos-arm64.tar.gz`
- Nightly release workflow now builds all portable archives from one Ubuntu job while keeping single-file binaries on native runners where needed.

### Changed
- Portable launchers now open the guided TUI by default with no `--tui` flag required.
- Windows portable users can launch the TUI by double-clicking `poke-engine.cmd` from the extracted portable folder.
- Single-file binary packaging now targets Node 22 to match the current dependency stack.
- TUI setup copy was shortened while preserving parenthetical hints for casual users.
- TUI editor fields are now generation-aware:
	- Gen 6-7 shows `megaForm`
	- Gen 8 shows `dynamax`
	- Gen 9 shows `teraType`
	- Gen 1-5 hides all battle-gimmick fields
	- `Disable all battle gimmicks` hides all battle-gimmick fields

### Fixed
- Removed the redundant TUI trainer-source prompt, since PokeAPI trainer rosters currently fall back to Littleroot Dreams data.
- Single-file binaries no longer try to launch the TUI by default; no-argument runs now print usage plus a portable-build tip.
- `--tui` in single-file binaries now exits with an explicit limitation message instead of exposing pkg/Ink runtime internals.
- Release documentation now reflects the portable-first TUI distribution path and precompressed portable artifacts.

## [1.1.0] - 2026-04-15

### Added
- Showdown export team import support via new parser utilities:
	- `parseShowdownTeam(text)`
	- `parseTeamInput(text)` (JSON-first, Showdown fallback)
	- `loadTeamInputFile(path)`
- New team-import test coverage in [tests/team-import.test.ts](tests/team-import.test.ts).
- New trainer parser API export:
	- `parseTrainerScript(text, trainerName, gameCode)`
- New trainer parser test coverage in [tests/trainers.test.ts](tests/trainers.test.ts).
- New data-loading regression tests in [tests/data.test.ts](tests/data.test.ts).
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
- Unit tests moved from `src/` into an independent `tests/` tree; `validate:test` now runs `tests/**/*.test.ts`.

### Fixed
- PokeAPI species loading now falls back to a species default form when direct Pokémon lookup 404s, fixing form-based Pokémon such as Gen 3 Deoxys.
- PokeAPI species loading now skips fully unresolvable entries without failing the whole data load.
- Gen 3 trainer loading now supports `let`, `const`, and `var` declarations and extracts trainer arrays robustly when nested arrays or brackets in strings are present.
- TUI results cards now surface gimmick-related notes more reliably and no longer hide key tactical notes behind a single first-note display.
- Multiple TUI/editor data paths now preserve and edit `megaForm` consistently.
- Validation docs and contributor guidance now consistently include `validate:test` alongside typecheck/bench.
- Packaging builds now use a source-only TypeScript build config so tests outside `src/` do not break portable or binary artifact generation.
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
