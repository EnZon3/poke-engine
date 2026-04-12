import type { CliResult, DataSource, EvaluationOptions, PokemonSet, TrainerSource } from './types.js';
import { runInkTUI } from './tui/index.js';

export async function promptForTeam(): Promise<PokemonSet[]> {
	const readline = await import('node:readline');
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const ask = (q: string) => new Promise<string>(resolve => {
		const border = '─'.repeat(q.length + 2);
		console.log('┌' + border + '┐');
		console.log('│ ' + q + ' │');
		console.log('└' + border + '┘');
		rl.question('> ', resolve);
	});

	const numStr = await ask('How many Pokémon in your party? (1-6)');
	let count = parseInt(numStr.trim(), 10);
	if (isNaN(count) || count < 1 || count > 6) count = 6;

	const team: PokemonSet[] = [];
	for (let i = 0; i < count; i++) {
		const idx = i + 1;
		console.log('\n=== Pokémon ' + idx + ' ===');
		const species = (await ask('Species (e.g. Garchomp)')).trim() || 'Pikachu';
		const levelInput = (await ask(`Level for ${species} (1-100, default 50)`)).trim();
		let level = parseInt(levelInput, 10);
		if (isNaN(level) || level < 1 || level > 100) level = 50;
		const nature = (await ask(`Nature for ${species} (default Serious)`)).trim() || 'Serious';
		const abilityInput = (await ask(`Ability for ${species} (optional)`)).trim();
		const itemInput = (await ask(`Item for ${species} (optional)`)).trim();
		const teraInput = (await ask(`Tera type for ${species} (leave blank if none)`)).trim();
		const dynInput = (await ask(`Dynamax ${species}? (y/n, default n)`)).trim().toLowerCase();
		const movesInput = (await ask(`Moves for ${species} (comma separated, up to 4)`)).trim();
		const moves = movesInput ? movesInput.split(',').map(s => s.trim()).filter(Boolean) : [];
		team.push({
			species,
			level,
			nature,
			ability: abilityInput || undefined,
			item: itemInput || undefined,
			teraType: teraInput || undefined,
			dynamax: dynInput === 'y' || dynInput === 'yes',
			ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
			evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
			moves,
		});
	}
	rl.close();
	return team;
}

export function printResultsPretty(result: CliResult): void {
	console.log('\n=== Matchup Recommendations ===');
	for (const [enemy, candidates] of Object.entries(result)) {
		console.log(`\nEnemy: ${enemy}`);
		for (const [idx, entry] of candidates.slice(0, 3).entries()) {
			const scorePct = (entry.score * 100).toFixed(1);
			const sign = entry.score >= 0 ? '+' : '';
			const move = entry.move ?? '(no damaging move found)';
			const ko1 = entry.oneHkoChance !== undefined ? ` | 1HKO ${(entry.oneHkoChance * 100).toFixed(1)}%` : '';
			const ko2 = entry.twoHkoChance !== undefined ? ` | 2HKO ${(entry.twoHkoChance * 100).toFixed(1)}%` : '';
			const speed = entry.speedAdvantage ? ' | speed+' : '';
			const role = entry.role ? ` | role ${entry.role}` : '';
			const confidence = entry.confidence ? ` | conf ${entry.confidence}` : '';
			console.log(`  ${idx + 1}. ${entry.pokemon} -> ${move} | score ${sign}${scorePct}%${ko1}${ko2}${speed}${role}${confidence}`);
			for (const why of (entry.rationale ?? []).slice(0, 2)) {
				console.log(`      • ${why}`);
			}
		}
	}
}

export interface TuiDefaults {
	gen?: number;
	myFile?: string;
	mySaveFile?: string;
	enemyFile?: string;
	game?: string;
	trainerName?: string;
	dataSource?: DataSource;
	trainerSource?: TrainerSource;
	jsonOutput?: boolean;
	evaluationOptions?: EvaluationOptions;
}

export async function runTUI(defaults: TuiDefaults = {}): Promise<void> {
	await runInkTUI(defaults);
}
