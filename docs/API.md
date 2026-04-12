# API Reference

Public exports are defined in [src/index.ts](../src/index.ts).

## Types

Re-exported from [src/types.ts](../src/types.ts):

- `AbilityEntry`
- `BattlePokemon`
- `BattleState`
- `BattleFormat`
- `CliResult`
- `DataSource`
- `EvaluationOptions`
- `ItemEntry`
- `MatchupEvaluation`
- `MoveEntry`
- `PokemonSet`
- `SideState`
- `SpeciesEntry`
- `Stats`
- `TrainerSource`
- `TypeChart`

## Data layer

### `loadData(gen?: number, dataSource?: DataSource): Promise<void>`
Loads and caches battle data for the selected generation/source.

### `resolveSpecies(name: string): SpeciesEntry | undefined`
Looks up a species from loaded data.

## Pokémon construction

### `calculateStat(...)`
Computes final stat values from base stats, level, IV/EV, and nature.

### `buildPokemon(set: PokemonSet): BattlePokemon`
Transforms a user `PokemonSet` into a battle-ready structure.

## Evaluation

### `evaluateTeams(myTeam: PokemonSet[], enemyTeam: PokemonSet[], options?: EvaluationOptions): CliResult`
Core ranking function. Returns per-enemy candidate matchups sorted by score.

Notable `EvaluationOptions` knobs:

- `battleFormat`: `singles | doubles`
- `mode`: `casual | competitive | custom`
- `lookaheadTurns`: `1 | 2 | 3`
- `defensiveWeight`: defensive reliability contribution
- `opponentRiskWeight`: blend between worst-case and weighted-average opponent response

`MatchupEvaluation` includes helper interpretation fields:

- `confidence`: `Low | Medium | High`
- `rationale`: short bullet explanations for why a line ranked well

### `hazardSwitchInFraction(sideState, mon): number`
Utility for estimating switch-in hazard damage fraction.

## Estimation

### `estimateSpreadForSet(set: PokemonSet): PokemonSet`
Produces a heuristic IV/EV estimate for one set.

### `applyEstimatedSpread(set: PokemonSet): PokemonSet`
Applies estimation defaults to one set if needed.

### `applyEstimatedSpreadsToTeam(team: PokemonSet[]): PokemonSet[]`
Applies spread estimation across a team.

## Save imports

### `loadTeamFromSaveFile(savePath: string): Promise<PokemonSet[]>`
Loads the player's party from a PKHeX-supported save file and maps it into engine `PokemonSet` format.

## Trainer adapters

### `fetchTrainerTeam(game: string, trainerName: string): Promise<PokemonSet[]>`
Fetches a trainer team from default source behavior.

### `fetchTrainerTeamFromSource(source: TrainerSource, game: string, trainerName: string): Promise<PokemonSet[]>`
Fetches trainer team from the selected source.

## Interactive / output

### `promptForTeam(): Promise<PokemonSet[]>`
CLI prompt flow to build a local team interactively.

### `printResultsPretty(result: CliResult): void`
Human-readable terminal rendering of ranked recommendations.

### `runTUI(defaults?): Promise<void>`
Launches the Ink-based terminal UI.

## CLI utilities

### `isMain(): boolean`
Checks whether CLI module is executing as main entrypoint.

### `runCli(): Promise<void>`
Parses args, loads inputs/data, runs evaluation, prints output.

## Utility parsers

From [src/utils.ts](../src/utils.ts):

- `toID(value: string): string`
- `parseGeneration(input?: string): number | undefined`
- `parseDataSource(input?: string): DataSource | undefined`
- `parseTrainerSource(input?: string): TrainerSource | undefined`
- `parseBattleFormat(input?: string): BattleFormat | undefined`
- `parseWeather(input?: string): BattleState['weather'] | undefined`
- `parseTerrain(input?: string): BattleState['terrain'] | undefined`
- `parseAgainstTrainer(value: string): { game: string; trainerName: string }`
