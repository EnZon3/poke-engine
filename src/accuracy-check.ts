import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Generations, Pokemon, Move, Field, calculate } from '@smogon/calc';
import { loadData } from './data.js';
import { parseShowdownTeam } from './team-import.js';
import { buildPokemon } from './pokemon.js';
import { computeDamageProfile } from './evaluation/damage.js';
import { horizontalRule } from './reporting/console.js';
import type { PokemonSet } from './types.js';

type TeamSide = 'my' | 'enemy';

type AccuracyCase = {
	name: string;
	attackerSide: TeamSide;
	attackerSpecies: string;
	defenderSide: TeamSide;
	defenderSpecies: string;
	move: string;
	tolerancePercent: number;
};

const CASES: AccuracyCase[] = [
	{
		name: 'Rillaboom Wood Hammer -> Urshifu-Rapid-Strike',
		attackerSide: 'my',
		attackerSpecies: 'Rillaboom',
		defenderSide: 'enemy',
		defenderSpecies: 'Urshifu-Rapid-Strike',
		move: 'Wood Hammer',
		tolerancePercent: 1.5,
	},
	{
		name: 'Raging Bolt Thunderclap -> Urshifu-Rapid-Strike',
		attackerSide: 'my',
		attackerSpecies: 'Raging Bolt',
		defenderSide: 'enemy',
		defenderSpecies: 'Urshifu-Rapid-Strike',
		move: 'Thunderclap',
		tolerancePercent: 2.0,
	},
	{
		name: 'Urshifu-Rapid-Strike Surging Strikes -> Incineroar',
		attackerSide: 'enemy',
		attackerSpecies: 'Urshifu-Rapid-Strike',
		defenderSide: 'my',
		defenderSpecies: 'Incineroar',
		move: 'Surging Strikes',
		tolerancePercent: 2.0,
	},
	{
		name: 'Flutter Mane Moonblast -> Urshifu-Rapid-Strike',
		attackerSide: 'enemy',
		attackerSpecies: 'Flutter Mane',
		defenderSide: 'my',
		defenderSpecies: 'Urshifu-Rapid-Strike',
		move: 'Moonblast',
		tolerancePercent: 1.5,
	},
];

function findSet(team: PokemonSet[], species: string): PokemonSet {
	const found = team.find((set) => set.species.toLowerCase() === species.toLowerCase());
	if (!found) throw new Error(`Missing species ${species} in provided team.`);
	return found;
}

function toCalcPokemon(gen: ReturnType<typeof Generations.get>, set: PokemonSet): Pokemon {
	const options: Record<string, unknown> = {
		level: set.level,
		nature: set.nature,
		ability: set.ability,
		item: set.item,
		evs: set.evs,
		ivs: set.ivs,
	};
	if (set.teraType) {
		options.teraType = set.teraType;
		options.isTera = true;
	}
	return new Pokemon(gen, set.species, options as ConstructorParameters<typeof Pokemon>[2]);
}

function normalizeDamage(raw: number | number[] | number[][]): number[] {
	if (typeof raw === 'number') return [raw];
	if (!Array.isArray(raw)) return [0];
	if (raw.length > 0 && Array.isArray(raw[0])) {
		const hits = raw as number[][];
		const len = hits[0].length;
		const total: number[] = [];
		for (let i = 0; i < len; i++) {
			let sum = 0;
			for (const hit of hits) sum += hit[i] ?? 0;
			total.push(sum);
		}
		return total;
	}
	return raw as number[];
}

function toPercent(value: number, hp: number): number {
	return (100 * value) / Math.max(1, hp);
}

async function main(): Promise<void> {
	const myPath = resolve(process.cwd(), 'my-team.txt');
	const enemyPath = resolve(process.cwd(), 'enemy-team.txt');

	const myTeam = parseShowdownTeam(readFileSync(myPath, 'utf8'));
	const enemyTeam = parseShowdownTeam(readFileSync(enemyPath, 'utf8'));

	await loadData(9, 'showdown');
	const gen = Generations.get(9);
	const field = new Field({ gameType: 'Doubles' });

	let failures = 0;
	console.log('\nAccuracy spot-check vs Showdown calc');
	console.log(horizontalRule(56));

	for (const check of CASES) {
		const attackerSet = findSet(check.attackerSide === 'my' ? myTeam : enemyTeam, check.attackerSpecies);
		const defenderSet = findSet(check.defenderSide === 'my' ? myTeam : enemyTeam, check.defenderSpecies);

		const attacker = buildPokemon(attackerSet);
		const defender = buildPokemon(defenderSet);
		const move = attacker.moves.find((m) => m.name.toLowerCase() === check.move.toLowerCase());
		if (!move) throw new Error(`Move ${check.move} not found for ${check.attackerSpecies}.`);

		const engine = computeDamageProfile(attacker, defender, move, undefined, check.attackerSide === 'my');

		const calcAttacker = toCalcPokemon(gen, attackerSet);
		const calcDefender = toCalcPokemon(gen, defenderSet);
		const calcMove = new Move(gen, check.move);
		const calcResult = calculate(gen, calcAttacker, calcDefender, calcMove, field);
		const calcDist = normalizeDamage(calcResult.damage as number | number[] | number[][]);
		const calcMin = Math.min(...calcDist);
		const calcMax = Math.max(...calcDist);

		const hp = defender.stats.hp;
		const engineMinPct = toPercent(engine.min, hp);
		const engineMaxPct = toPercent(engine.max, hp);
		const calcMinPct = toPercent(calcMin, hp);
		const calcMaxPct = toPercent(calcMax, hp);

		const minDiff = Math.abs(engineMinPct - calcMinPct);
		const maxDiff = Math.abs(engineMaxPct - calcMaxPct);
		const pass = minDiff <= check.tolerancePercent && maxDiff <= check.tolerancePercent;
		if (!pass) failures++;

		console.log(`${pass ? '✓' : '✗'} ${check.name}`);
		console.log(`  engine:       ${engine.min}-${engine.max} (${engineMinPct.toFixed(1)}-${engineMaxPct.toFixed(1)}%)`);
		console.log(`  showdown-calc:${calcMin}-${calcMax} (${calcMinPct.toFixed(1)}-${calcMaxPct.toFixed(1)}%)`);
		console.log(`  diff:         min ${minDiff.toFixed(2)}% | max ${maxDiff.toFixed(2)}% | tol ${check.tolerancePercent.toFixed(2)}%`);
	}

	console.log(horizontalRule(56));
	if (failures > 0) {
		console.error(`Status: FAIL (${failures} case${failures === 1 ? '' : 's'} outside tolerance)`);
		process.exit(1);
	}
	console.log('Status: PASS');
}

main().catch((error) => {
	console.error('Accuracy check failed:', error instanceof Error ? error.message : String(error));
	process.exit(1);
});
