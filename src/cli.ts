import { readFileSync } from 'node:fs';
import { loadData } from './data.js';
import { evaluateTeams } from './evaluation/index.js';
import { promptForTeam, printResultsPretty, runTUI } from './interactive.js';
import { loadTeamFromSaveFile } from './save-import.js';
import { fetchTrainerTeamFromSource } from './trainers.js';
import type { DataSource, EvaluationOptions, PokemonSet, TrainerSource } from './types.js';
import {
	parseAgainstTrainer,
	parseBattleFormat,
	parseDataSource,
	parseGeneration,
	parseTerrain,
	parseTrainerSource,
	parseWeather,
} from './utils.js';

export function isMain(): boolean {
	const hasRequire = typeof require !== 'undefined';
	if (hasRequire) {
		// @ts-ignore
		return require.main === module;
	}
	if (typeof import.meta !== 'undefined' && typeof import.meta.url === 'string') {
		if (import.meta.url.startsWith('file://')) {
			const decoded = decodeURI(import.meta.url.slice('file://'.length));
			return !!process.argv[1] && process.argv[1] === decoded;
		}
		return false;
	}
	return false;
}

export async function runCli(): Promise<void> {
	const args = process.argv.slice(2);
	let showHelp = false;
	let launchTui = args.length === 0;
	let jsonOutput = false;
	let gen: number | undefined;
	let dataSource: DataSource = 'showdown';
	let trainerSource: TrainerSource = 'littleroot';
	const evaluationOptions: EvaluationOptions = {
		battleState: { weather: 'none', terrain: 'none', mySide: {}, enemySide: {} },
		battleFormat: 'singles',
		mode: 'casual',
		lookaheadTurns: 2,
		allowSwitching: false,
		roleWeight: 0.12,
		defensiveWeight: 0.3,
		opponentRiskWeight: 0.55,
	};
	let game: string | undefined;
	let trainerName: string | undefined;
	let myFile: string | undefined;
	let mySaveFile: string | undefined;
	let enemyFile: string | undefined;
	let enemyBuilder = false;

	for (const arg of args) {
		if (arg.startsWith('--gen=')) {
			const value = arg.split('=')[1];
			const parsed = parseGeneration(value);
			if (!parsed) throw new Error(`Invalid generation: ${value}. Use 1-9 or aliases like rby/swsh/sv.`);
			gen = parsed;
		} else if (arg.startsWith('--game=')) {
			game = arg.split('=')[1];
		} else if (arg.startsWith('--data-source=')) {
			const parsed = parseDataSource(arg.split('=')[1]);
			if (!parsed) throw new Error('Invalid --data-source. Use showdown or pokeapi.');
			dataSource = parsed;
		} else if (arg.startsWith('--trainer-source=')) {
			const parsed = parseTrainerSource(arg.split('=')[1]);
			if (!parsed) throw new Error('Invalid --trainer-source. Use littleroot or pokeapi.');
			trainerSource = parsed;
		} else if (arg.startsWith('--trainer=')) {
			trainerName = arg.split('=')[1];
		} else if (arg.startsWith('--mode=')) {
			const v = arg.split('=')[1]?.trim().toLowerCase();
			if (v !== 'casual' && v !== 'competitive' && v !== 'custom') {
				throw new Error('Invalid --mode. Use casual, competitive, or custom.');
			}
			evaluationOptions.mode = v;
			if (v === 'casual') {
				evaluationOptions.lookaheadTurns = 2;
				evaluationOptions.defensiveWeight = 0.22;
				evaluationOptions.opponentRiskWeight = 0.5;
			}
			if (v === 'competitive') {
				evaluationOptions.lookaheadTurns = 3;
				evaluationOptions.defensiveWeight = 0.4;
				evaluationOptions.opponentRiskWeight = 0.65;
			}
		} else if (arg.startsWith('--format=')) {
			const parsed = parseBattleFormat(arg.split('=')[1]);
			if (!parsed) throw new Error('Invalid --format. Use singles or doubles.');
			evaluationOptions.battleFormat = parsed;
		} else if (arg.startsWith('--weather=')) {
			const parsed = parseWeather(arg.split('=')[1]);
			if (!parsed) throw new Error('Invalid --weather. Use sun, rain, sand, snow, or none.');
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.weather = parsed;
		} else if (arg.startsWith('--terrain=')) {
			const parsed = parseTerrain(arg.split('=')[1]);
			if (!parsed) throw new Error('Invalid --terrain. Use electric, grassy, misty, psychic, or none.');
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.terrain = parsed;
		} else if (arg.startsWith('--lookahead=')) {
			const v = parseInt(arg.split('=')[1], 10);
			if (v !== 1 && v !== 2 && v !== 3) throw new Error('Invalid --lookahead. Use 1, 2, or 3.');
			evaluationOptions.lookaheadTurns = v;
		} else if (arg === '--allow-switching') {
			evaluationOptions.allowSwitching = true;
		} else if (arg.startsWith('--role-weight=')) {
			const v = Number(arg.split('=')[1]);
			if (Number.isNaN(v) || v < 0) throw new Error('Invalid --role-weight. Use a non-negative number.');
			evaluationOptions.roleWeight = v;
		} else if (arg.startsWith('--defensive-weight=')) {
			const v = Number(arg.split('=')[1]);
			if (Number.isNaN(v) || v < 0) throw new Error('Invalid --defensive-weight. Use a non-negative number.');
			evaluationOptions.defensiveWeight = v;
		} else if (arg.startsWith('--opponent-risk-weight=')) {
			const v = Number(arg.split('=')[1]);
			if (Number.isNaN(v) || v < 0 || v > 1) throw new Error('Invalid --opponent-risk-weight. Use a number from 0 to 1.');
			evaluationOptions.opponentRiskWeight = v;
		} else if (arg === '--my-reflect') {
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.mySide = evaluationOptions.battleState.mySide ?? {};
			evaluationOptions.battleState.mySide.reflect = true;
		} else if (arg === '--my-light-screen') {
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.mySide = evaluationOptions.battleState.mySide ?? {};
			evaluationOptions.battleState.mySide.lightScreen = true;
		} else if (arg === '--enemy-reflect') {
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.enemySide = evaluationOptions.battleState.enemySide ?? {};
			evaluationOptions.battleState.enemySide.reflect = true;
		} else if (arg === '--enemy-light-screen') {
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.enemySide = evaluationOptions.battleState.enemySide ?? {};
			evaluationOptions.battleState.enemySide.lightScreen = true;
		} else if (arg.startsWith('--my-spikes=')) {
			const v = parseInt(arg.split('=')[1], 10);
			if (v < 0 || v > 3 || Number.isNaN(v)) throw new Error('Invalid --my-spikes. Use 0..3.');
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.mySide = evaluationOptions.battleState.mySide ?? {};
			evaluationOptions.battleState.mySide.spikesLayers = v as 0 | 1 | 2 | 3;
		} else if (arg === '--my-stealth-rock') {
			evaluationOptions.battleState = evaluationOptions.battleState ?? {};
			evaluationOptions.battleState.mySide = evaluationOptions.battleState.mySide ?? {};
			evaluationOptions.battleState.mySide.stealthRock = true;
		} else if (arg.startsWith('--against-trainer=')) {
			const parsed = parseAgainstTrainer(arg.split('=')[1]);
			game = parsed.game;
			trainerName = parsed.trainerName;
		} else if (arg === '--interactive' || arg === '--tui') {
			launchTui = true;
		} else if (arg === '--json') {
			jsonOutput = true;
		} else if (arg === '--help' || arg === '-h') {
			showHelp = true;
		} else if (arg.startsWith('--my=')) {
			myFile = arg.split('=')[1];
		} else if (arg.startsWith('--my-save=')) {
			mySaveFile = arg.split('=')[1];
		} else if (arg.startsWith('--enemy=')) {
			enemyFile = arg.split('=')[1];
		} else if (arg === '--enemy-builder') {
			enemyBuilder = true;
		} else {
			if (!myFile) myFile = arg;
			else if (!enemyFile) enemyFile = arg;
		}
	}

	if (myFile && mySaveFile) {
		throw new Error('Use either --my=<team.json> or --my-save=<savefile>, not both.');
	}

	if (showHelp) {
		console.log('Usage:');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json [--gen=sv]');
		console.log('  npm start -- --my=my-team.json --enemy-builder');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --format=doubles');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --format=singles');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --mode=casual');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --mode=competitive');
		console.log('  npm start -- --my-save=/path/to/main.sav --enemy=enemy-team.json [--gen=sv]');
		console.log('  npm start -- --my=my-team.json --game=sv --trainer=nemona [--gen=9]');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --data-source=pokeapi');
		console.log('  npm start -- --my=my-team.json --against-trainer=sv:nemona');
		console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --lookahead=3 --allow-switching --weather=rain --defensive-weight=0.3 --opponent-risk-weight=0.55');
		console.log('  npm start -- --tui');
		return;
	}

	if (launchTui) {
		if ((process as { pkg?: unknown }).pkg) {
			throw new Error('TUI mode is not available in packaged binaries yet. Use --my and --enemy JSON inputs with optional --json output.');
		}
		await runTUI({ gen, myFile, mySaveFile, enemyFile, game, trainerName, dataSource, trainerSource, jsonOutput, evaluationOptions });
		return;
	}

	await loadData(gen, dataSource);
	let myTeam: PokemonSet[];
	if (mySaveFile) {
		myTeam = await loadTeamFromSaveFile(mySaveFile);
	} else if (!myFile) {
		myTeam = await promptForTeam();
	} else {
		myTeam = JSON.parse(readFileSync(myFile, 'utf8'));
	}

	let enemyTeam: PokemonSet[];
	if (trainerName && game) {
		enemyTeam = await fetchTrainerTeamFromSource(trainerSource, game, trainerName);
	} else if (enemyFile) {
		enemyTeam = JSON.parse(readFileSync(enemyFile, 'utf8'));
	} else if (enemyBuilder) {
		enemyTeam = await promptForTeam();
	} else {
		throw new Error('You must specify either --trainer and --game, provide an enemy JSON file via --enemy, or use --enemy-builder');
	}

	const result = evaluateTeams(myTeam, enemyTeam, evaluationOptions);
	if (jsonOutput) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		printResultsPretty(result);
	}
}
