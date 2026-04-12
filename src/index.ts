export type {
	AbilityEntry,
	BattlePokemon,
	BattleState,
	BattleFormat,
	CliResult,
	DataSource,
	EvaluationOptions,
	ItemEntry,
	MatchupEvaluation,
	MoveEntry,
	PokemonSet,
	SideState,
	SpeciesEntry,
	Stats,
	TrainerSource,
	TypeChart,
} from './types.js';

export { loadData, resolveSpecies } from './data.js';
export { calculateStat, buildPokemon } from './pokemon.js';
export { evaluateTeams, hazardSwitchInFraction } from './evaluation/index.js';
export { estimateSpreadForSet, applyEstimatedSpread, applyEstimatedSpreadsToTeam } from './estimation.js';
export { loadTeamFromSaveFile } from './save-import.js';
export { fetchTrainerTeam, fetchTrainerTeamFromSource } from './trainers.js';
export { promptForTeam, printResultsPretty, runTUI } from './interactive.js';
export { isMain, runCli } from './cli.js';
export {
	toID,
	parseGeneration,
	parseDataSource,
	parseTrainerSource,
	parseBattleFormat,
	parseWeather,
	parseTerrain,
	parseAgainstTrainer,
} from './utils.js';
