import { readFileSync } from 'node:fs';
import { loadData } from '../data.js';
import { evaluateTeams } from '../evaluation/index.js';
import { promptForTeam, printResultsPretty, runTUI } from '../interactive.js';
import { loadTeamFromSaveFile } from '../save-import.js';
import { parseTeamInput } from '../team-import.js';
import { fetchTrainerTeamFromSource } from '../trainers.js';
import type { PokemonSet } from '../types.js';
import { printCliUsage } from './help.js';
import type { CliParseResult } from './options.js';

export async function executeCliPlan(parsed: CliParseResult, packagedBinary: boolean, argsLength: number): Promise<void> {
	if (parsed.showHelp || (packagedBinary && argsLength === 0)) {
		printCliUsage(packagedBinary, argsLength);
		return;
	}

	if (parsed.launchTui) {
		if (packagedBinary) {
			throw new Error('TUI mode is not available in single-file binaries. Use a portable runtime build for the guided TUI, or pass CLI flags to this binary.');
		}
		await runTUI({
			gen: parsed.gen,
			myFile: parsed.myFile,
			mySaveFile: parsed.mySaveFile,
			enemyFile: parsed.enemyFile,
			game: parsed.game,
			trainerName: parsed.trainerName,
			dataSource: parsed.dataSource,
			trainerSource: parsed.trainerSource,
			jsonOutput: parsed.jsonOutput,
			evaluationOptions: parsed.evaluationOptions,
		});
		return;
	}

	await loadData(parsed.gen, parsed.dataSource);
	let myTeam: PokemonSet[];
	if (parsed.mySaveFile) {
		myTeam = await loadTeamFromSaveFile(parsed.mySaveFile);
	} else if (!parsed.myFile) {
		myTeam = await promptForTeam();
	} else {
		myTeam = parseTeamInput(readFileSync(parsed.myFile, 'utf8'));
	}

	let enemyTeam: PokemonSet[];
	if (parsed.trainerName && parsed.game) {
		enemyTeam = await fetchTrainerTeamFromSource(parsed.trainerSource, parsed.game, parsed.trainerName);
	} else if (parsed.enemyFile) {
		enemyTeam = parseTeamInput(readFileSync(parsed.enemyFile, 'utf8'));
	} else if (parsed.enemyBuilder) {
		enemyTeam = await promptForTeam();
	} else {
		throw new Error('You must specify either --trainer and --game, provide an enemy team file via --enemy (JSON or Showdown text), or use --enemy-builder');
	}

	const result = evaluateTeams(myTeam, enemyTeam, parsed.evaluationOptions);
	if (parsed.jsonOutput) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		printResultsPretty(result);
	}
}
