# poke-eval

[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: AGPL](https://img.shields.io/badge/License-AGPLv3-blue.svg)](https://opensource.org/licenses/AGPL-3.0)

A TypeScript Pokémon matchup evaluator for ranking team-vs-team options from JSON teams, Showdown export text, PKHeX-compatible save files, named trainers, or an interactive terminal UI.

Designed for practical matchup planning: fast enough for iteration, detailed enough for actionable decisions.

## Table of contents

- [Highlights](#highlights)
- [Repository status](#repository-status)
- [Getting started](#getting-started)
- [For non-CLI users](#for-non-cli-users)
- [Packaged app builds (no Node.js needed)](#packaged-app-builds-no-nodejs-needed)
- [Validation](#validation)
- [Quick usage](#quick-usage)
- [CLI options](#cli-options)
- [TUI keybindings](#tui-keybindings)
- [TUI full guide](docs/TUI_GUIDE.md)
- [Data model](#data-model)
- [Programmatic API](#programmatic-api)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [Release hygiene](#release-hygiene)
- [Accuracy and mechanics](#accuracy-and-mechanics)
- [Roadmap](#roadmap)

## Highlights

- Loads Pokémon/move/item/ability data from configurable sources.
- Builds battle-ready stats from `species`, `level`, `nature`, `ivs`, and `evs`.
- Scores matchups using:
	- type effectiveness
	- damage ranges and KO odds
	- turn order (speed + priority)
	- weather / terrain / screens / hazards
	- setup discovery with short lookahead
- Supports both CLI and Ink-based TUI workflows.
- Exposes a reusable TypeScript API.

## Repository status

- Runtime: Node.js 22+
- Language: TypeScript (ESM)
- CI workflows:
	- `.github/workflows/validate.yml`
	- `.github/workflows/mechanics-validation.yml`

## Getting started

Requirements:

- Node.js 22+
- npm

Install dependencies:

```bash
npm install
```

Show CLI help:

```bash
npm start -- --help
```

## For non-CLI users

If you do not work in terminals often, use the guided TUI flow:

1. Open this project folder in VS Code.
2. Open the built-in terminal (`Terminal` → `New Terminal`).
3. Run:

```bash
npm install
npm start -- --tui
```

4. In setup, choose your sources (team file: JSON/Showdown, save, trainer) and select `doubles` or `singles`.
5. In editor, press `c` to calculate.
6. In results, press `h` for help and `b` to go back and edit.

Quick keys:

- `Enter`: confirm / continue
- `Arrow keys`: move selection
- `e`: edit selected field
- `c`: calculate
- `q`: quit

Starter files you can edit directly:

- [my-team.json](my-team.json)
- [enemy-team.json](enemy-team.json)
- [enemy-team-doubles.json](enemy-team-doubles.json)

## Packaged app builds (no Node.js needed)

If you download packaged artifacts from Releases, users do not need Node.js or npm.

Recommended for most users: **portable runtime builds** (full app, including TUI). On Windows, double-click `poke-eval.cmd` to open the guided TUI.

Portable artifact layout:

- `poke-eval-portable-<platform>-<arch>.tar.gz`
- extracted folder: `portable-<platform>-<arch>/`
- launcher files: `poke-eval`, `poke-eval.cmd`, `poke-eval.ps1`
- bundled runtime + app files

Nightly builds:

- A nightly workflow publishes fresh artifacts and single-file binaries in GitHub Actions:
	- `.github/workflows/nightly-portable-builds.yml`

Run examples after download (portable build):

- macOS / Linux:
	- `chmod +x ./poke-eval`
	- `./poke-eval`
- Windows:
	- double-click `poke-eval.cmd`
	- or run `poke-eval.cmd` from Command Prompt

Alternative: single-file binaries (CLI-focused):

Expected artifacts:

- Windows: `poke-eval-win-x64.exe`
- macOS Intel: `poke-eval-macos-x64`
- macOS Apple Silicon: `poke-eval-macos-arm64`
- Linux x64: `poke-eval-linux-x64`

Run examples after download:

- Windows:
	- `./poke-eval-win-x64.exe --my=my-team.json --enemy=enemy-team.json --json`
- macOS / Linux:
	- `chmod +x ./poke-eval-macos-arm64`
	- `./poke-eval-macos-arm64 --my=my-team.json --enemy=enemy-team.json --json`

Current limitation:

- Single-file binaries currently support file-driven CLI execution.
- TUI mode (`--tui`) is not enabled in single-file binaries because the current Ink/Yoga TUI stack is not compatible with pkg's single-file snapshot runtime.
- Use portable runtime builds for packaged TUI usage.

For maintainers building local binaries:

```bash
npm run package:portable
npm run package:portable:all
npm run package:bin:linux-x64
npm run package:bin:macos-x64
npm run package:bin:macos-arm64
npm run package:bin:win-x64
```

Build all targets:

```bash
npm run package:portable:all
npm run package:bin:all
```

## Validation

Run local quality gates before pushing changes:

```bash
npm run validate:typecheck
npm run validate:test
npm run validate:accuracy
npm run validate:bench
npm run validate:all
```

`validate:all` runs typecheck + tests + calculator-accuracy spot checks + benchmark validations.

## Quick usage

All commands assume repository root.

Team JSON vs team JSON:

```bash
npm start -- --my=my-team.json --enemy=enemy-team.json
```

Showdown export text vs Showdown export text:

```bash
npm start -- --my=my-team.txt --enemy=enemy-team.txt
```

Team JSON vs named trainer:

```bash
npm start -- --my=my-team.json --game=sv --trainer=nemona
```

Save file vs team JSON:

```bash
npm start -- --my-save=/path/to/main.sav --enemy=enemy-team.json
```

TUI mode:

```bash
npm start -- --tui
```

## CLI options

### Core inputs

- `--my=<path>` your team file (JSON array or Showdown export text)
- `--my-save=<path>` your team from PKHeX-compatible save file
- `--enemy=<path>` enemy team file (JSON array or Showdown export text)
- `--enemy-builder` build enemy team interactively
- `--game=<id>` + `--trainer=<name>` load trainer team
- `--against-trainer=<game>:<trainer>` shorthand

### Data sources

- `--data-source=showdown|pokeapi`
- `--trainer-source=littleroot|pokeapi`

### Evaluation controls

- `--format=singles|doubles`
- `--mode=casual|competitive|custom`
- `--gen=<1-9|alias>`
- `--lookahead=1|2|3`
- `--allow-switching`
- `--role-weight=<number>`
- `--defensive-weight=<number>`
- `--opponent-risk-weight=<0..1>`
- `--weather=sun|rain|sand|snow|none`
- `--terrain=electric|grassy|misty|psychic|none`

Mode behavior:

- `casual`: shorter horizon, forgiving risk profile
- `competitive`: deeper horizon, stronger risk weighting
- `custom`: use explicit numeric flags

Format behavior:

- `singles`: 1v1 matchup evaluation
- `doubles`: 2v2 lead-pair evaluation with support-tempo heuristics

### Side-state flags

- `--my-reflect`
- `--my-light-screen`
- `--enemy-reflect`
- `--enemy-light-screen`
- `--my-spikes=0..3`
- `--my-stealth-rock`

### Output / mode flags

- `--json`
- `--interactive` or `--tui`
- `--help`

Notes:

- `--my` and `--my-save` are mutually exclusive.
- Generation alias parsing lives in [src/utils.ts](src/utils.ts).

## TUI keybindings

Full end-user guide (setup wizard, game codes, field formats, workflows): [docs/TUI_GUIDE.md](docs/TUI_GUIDE.md)

Implementation entry: [src/tui/ui.tsx](src/tui/ui.tsx)

Setup phase:

- `Enter`: next/confirm
- `Esc` or `Ctrl+C`: exit

Setup includes a battle-gimmicks policy prompt:

- `Default by generation`: Gen 6-7 Mega, Gen 8 Dynamax, Gen 9 Tera
- `Disable all`: disables Mega Evolution, Dynamax, and Terastallization in evaluation

Setup also includes a gimmick timing control prompt:

- `Manual`: uses team-set gimmick flags directly (`megaForm` / `teraType` / `dynamax`)
- `Auto`: engine chooses timing and evaluates against opponent best-response gimmick branches

Editor phase:

- `Arrow keys`: navigate selection
- `e`: edit selected field
- `Enter`: commit edit
- `Esc`: cancel edit
- `o`: toggle editing side (your team / enemy team)
- `a`: add slot
- `x`: delete slot
- `p`: estimate IV/EV
- `s`: save current team JSON
- `c`: calculate
- `q` or `Ctrl+C`: quit

Results/help phase:

- `h`: open/close fullscreen help
- `m`: close fullscreen help
- `b`: back to editor
- `r`: recompute
- `q` or `Ctrl+C`: quit

## Data model

Each team is an array of `PokemonSet` records.

```json
[
	{
		"species": "Garchomp",
		"level": 50,
		"nature": "Jolly",
		"ability": "Rough Skin",
		"item": "Choice Scarf",
		"megaForm": "Mega",
		"teraType": "Ground",
		"dynamax": false,
		"status": null,
		"boosts": { "atk": 0, "spe": 0 },
		"ivs": { "hp": 31, "atk": 31, "def": 31, "spa": 31, "spd": 31, "spe": 31 },
		"evs": { "hp": 0, "atk": 252, "def": 0, "spa": 0, "spd": 4, "spe": 252 },
		"moves": ["Earthquake", "Dragon Claw", "Swords Dance", "Protect"]
	}
]
```

Mechanics gating is generation-aware during build/evaluation:

- `megaForm` is only applied when loaded generation is Gen 6-7.
- `dynamax` is only applied when loaded generation is Gen 8.
- `teraType` is only applied when loaded generation is Gen 9.

Canonical type definition: [src/types.ts](src/types.ts)

Sample files:

- [my-team.json](my-team.json)
- [enemy-team.json](enemy-team.json)

## Programmatic API

Public exports are centralized in [src/index.ts](src/index.ts).

Detailed API reference: [docs/API.md](docs/API.md)

## Project structure

- [src/main.ts](src/main.ts): executable entry
- [src/cli.ts](src/cli.ts): argument parsing and orchestration
- [src/interactive.ts](src/interactive.ts): prompts, pretty output, TUI launcher
- [src/tui/index.ts](src/tui/index.ts): Ink bootstrap
- [src/tui/ui.tsx](src/tui/ui.tsx): TUI coordinator and input flow
- [src/tui/views.tsx](src/tui/views.tsx): TUI screens/components
- [src/tui/setup.ts](src/tui/setup.ts): setup-question composition
- [src/tui/model.ts](src/tui/model.ts): shared TUI models/constants
- [src/tui/utils.ts](src/tui/utils.ts): TUI helpers and field parsing
- [src/data.ts](src/data.ts): species/move/item/ability loading
- [src/pokemon.ts](src/pokemon.ts): stat and battle Pokémon construction
- [src/evaluation.ts](src/evaluation.ts): matchup scoring engine
- [src/trainers.ts](src/trainers.ts): trainer team fetching/adapters
- [src/estimation.ts](src/estimation.ts): IV/EV spread estimation
- [src/save-import.ts](src/save-import.ts): PKHeX save-file party import
- [src/utils.ts](src/utils.ts): parsing and normalization helpers
- [src/types.ts](src/types.ts): shared contracts

## Contributing

Contributor workflow: [CONTRIBUTING.md](CONTRIBUTING.md)

## Release hygiene

- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Release process and checklist: [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md)

## Accuracy and mechanics

- Mechanics assumptions and known approximations: [docs/MECHANICS_VALIDATION.md](docs/MECHANICS_VALIDATION.md)
- Accuracy verification workflow: [docs/ENGINE_ACCURACY_VERIFICATION.md](docs/ENGINE_ACCURACY_VERIFICATION.md)

## Roadmap

Future planning and priorities: [ROADMAP.md](ROADMAP.md)

## Notes

- This is a practical evaluator, not a full turn-perfect simulator.
- Recommendations are uncertainty-aware and based on known/provided sets.
- `npm test` currently aliases to CLI startup.
