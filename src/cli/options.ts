import type { DataSource, EvaluationOptions, TrainerSource } from '../types.js';
import {
	parseAgainstTrainer,
	parseBattleFormat,
	parseDataSource,
	parseGeneration,
	parseTerrain,
	parseTrainerSource,
	parseWeather,
} from '../utils.js';
import { applyModePreset, CLI_DEFAULT_EVALUATION_OPTIONS } from '../evaluation/config.js';

type ParsedCliArg =
	| { kind: 'kv'; key: string; value: string }
	| { kind: 'flag'; key: string };

export type CliParseResult = {
	showHelp: boolean;
	launchTui: boolean;
	jsonOutput: boolean;
	gen?: number;
	dataSource: DataSource;
	trainerSource: TrainerSource;
	evaluationOptions: EvaluationOptions;
	game?: string;
	trainerName?: string;
	myFile?: string;
	mySaveFile?: string;
	enemyFile?: string;
	enemyBuilder: boolean;
};

function parseCliArg(arg: string): ParsedCliArg | undefined {
	if (!arg.startsWith('--')) return undefined;
	const body = arg.slice(2);
	const eq = body.indexOf('=');
	if (eq === -1) return { kind: 'flag', key: body };
	return {
		kind: 'kv',
		key: body.slice(0, eq),
		value: body.slice(eq + 1),
	};
}

function parseOption<T>(raw: string, parser: (value: string) => T | undefined, errorMessage: string): T {
	const parsed = parser(raw);
	if (!parsed) throw new Error(errorMessage);
	return parsed;
}

function parseIntegerOption(raw: string, isValid: (value: number) => boolean, errorMessage: string): number {
	const value = parseInt(raw, 10);
	if (!isValid(value)) throw new Error(errorMessage);
	return value;
}

function parseNumberOption(raw: string, isValid: (value: number) => boolean, errorMessage: string): number {
	const value = Number(raw);
	if (!isValid(value)) throw new Error(errorMessage);
	return value;
}

function cloneEvaluationOptions(): EvaluationOptions {
	const defaults = CLI_DEFAULT_EVALUATION_OPTIONS;
	return {
		...defaults,
		battleState: {
			weather: defaults.battleState?.weather ?? 'none',
			terrain: defaults.battleState?.terrain ?? 'none',
			mySide: { ...(defaults.battleState?.mySide ?? {}) },
			enemySide: { ...(defaults.battleState?.enemySide ?? {}) },
		},
	};
}

function ensureMySide(options: EvaluationOptions): NonNullable<NonNullable<EvaluationOptions['battleState']>['mySide']> {
	options.battleState = options.battleState ?? {};
	options.battleState.mySide = options.battleState.mySide ?? {};
	return options.battleState.mySide;
}

function ensureEnemySide(options: EvaluationOptions): NonNullable<NonNullable<EvaluationOptions['battleState']>['enemySide']> {
	options.battleState = options.battleState ?? {};
	options.battleState.enemySide = options.battleState.enemySide ?? {};
	return options.battleState.enemySide;
}

export function parseCliArgs(args: string[], packagedBinary: boolean): CliParseResult {
	let showHelp = false;
	let launchTui = args.length === 0 && !packagedBinary;
	let jsonOutput = false;
	let gen: number | undefined;
	let dataSource: DataSource = 'showdown';
	let trainerSource: TrainerSource = 'littleroot';
	const evaluationOptions = cloneEvaluationOptions();
	let game: string | undefined;
	let trainerName: string | undefined;
	let myFile: string | undefined;
	let mySaveFile: string | undefined;
	let enemyFile: string | undefined;
	let enemyBuilder = false;

	const kvHandlers: Record<string, (value: string) => void> = {
		gen(value) {
			gen = parseOption(value, parseGeneration, `Invalid generation: ${value}. Use 1-9 or aliases like rby/swsh/sv.`);
		},
		game(value) {
			game = value;
		},
		'data-source'(value) {
			dataSource = parseOption(value, parseDataSource, 'Invalid --data-source. Use showdown or pokeapi.');
		},
		'trainer-source'(value) {
			trainerSource = parseOption(value, parseTrainerSource, 'Invalid --trainer-source. Use littleroot or pokeapi.');
		},
		trainer(value) {
			trainerName = value;
		},
		mode(value) {
			const normalizedMode = value.trim().toLowerCase();
			if (normalizedMode !== 'casual' && normalizedMode !== 'competitive' && normalizedMode !== 'custom') {
				throw new Error('Invalid --mode. Use casual, competitive, or custom.');
			}
			applyModePreset(evaluationOptions, normalizedMode);
		},
		format(value) {
			evaluationOptions.battleFormat = parseOption(value, parseBattleFormat, 'Invalid --format. Use singles or doubles.');
		},
		weather(value) {
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.weather = parseOption(value, parseWeather, 'Invalid --weather. Use sun, rain, sand, snow, or none.');
		},
		terrain(value) {
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.terrain = parseOption(value, parseTerrain, 'Invalid --terrain. Use electric, grassy, misty, psychic, or none.');
		},
		lookahead(value) {
			evaluationOptions.lookaheadTurns = parseIntegerOption(value, (v) => v === 1 || v === 2 || v === 3, 'Invalid --lookahead. Use 1, 2, or 3.') as 1 | 2 | 3;
		},
		'role-weight'(value) {
			evaluationOptions.roleWeight = parseNumberOption(value, (v) => !Number.isNaN(v) && v >= 0, 'Invalid --role-weight. Use a non-negative number.');
		},
		'defensive-weight'(value) {
			evaluationOptions.defensiveWeight = parseNumberOption(value, (v) => !Number.isNaN(v) && v >= 0, 'Invalid --defensive-weight. Use a non-negative number.');
		},
		'opponent-risk-weight'(value) {
			evaluationOptions.opponentRiskWeight = parseNumberOption(value, (v) => !Number.isNaN(v) && v >= 0 && v <= 1, 'Invalid --opponent-risk-weight. Use a number from 0 to 1.');
		},
		'my-spikes'(value) {
			const spikes = parseIntegerOption(value, (v) => !Number.isNaN(v) && v >= 0 && v <= 3, 'Invalid --my-spikes. Use 0..3.');
			ensureMySide(evaluationOptions).spikesLayers = spikes as 0 | 1 | 2 | 3;
		},
		'against-trainer'(value) {
			const parsed = parseAgainstTrainer(value);
			game = parsed.game;
			trainerName = parsed.trainerName;
		},
		my(value) {
			myFile = value;
		},
		'my-save'(value) {
			mySaveFile = value;
		},
		enemy(value) {
			enemyFile = value;
		},
	};

	const flagHandlers: Record<string, () => void> = {
		'allow-switching'() {
			evaluationOptions.allowSwitching = true;
		},
		'my-reflect'() {
			ensureMySide(evaluationOptions).reflect = true;
		},
		'my-light-screen'() {
			ensureMySide(evaluationOptions).lightScreen = true;
		},
		'enemy-reflect'() {
			ensureEnemySide(evaluationOptions).reflect = true;
		},
		'enemy-light-screen'() {
			ensureEnemySide(evaluationOptions).lightScreen = true;
		},
		'my-stealth-rock'() {
			ensureMySide(evaluationOptions).stealthRock = true;
		},
		interactive() {
			launchTui = true;
		},
		tui() {
			launchTui = true;
		},
		json() {
			jsonOutput = true;
		},
		help() {
			showHelp = true;
		},
		'enemy-builder'() {
			enemyBuilder = true;
		},
	};

	for (const arg of args) {
		if (arg === '-h') {
			showHelp = true;
			continue;
		}

		const parsedArg = parseCliArg(arg);
		if (parsedArg?.kind === 'kv') {
			const handler = kvHandlers[parsedArg.key];
			if (handler) {
				handler(parsedArg.value);
				continue;
			}
		}
		if (parsedArg?.kind === 'flag') {
			const handler = flagHandlers[parsedArg.key];
			if (handler) {
				handler();
				continue;
			}
		}

		if (!myFile) myFile = arg;
		else if (!enemyFile) enemyFile = arg;
	}

	if (myFile && mySaveFile) {
		throw new Error('Use either --my=<team.json> or --my-save=<savefile>, not both.');
	}

	return {
		showHelp,
		launchTui,
		jsonOutput,
		gen,
		dataSource,
		trainerSource,
		evaluationOptions,
		game,
		trainerName,
		myFile,
		mySaveFile,
		enemyFile,
		enemyBuilder,
	};
}
